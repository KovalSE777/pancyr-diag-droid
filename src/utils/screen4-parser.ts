import { DiagnosticData, ComponentStatus } from '@/types/bluetooth';
import { logService } from './log-service';

/**
 * ADC to Temperature conversion tables
 * Based on firmware calibration tables
 */

// Температура, вариант A (для воздуха/испарителя): ADC -> temp_x10 (°C * 10)
const TEMP_TABLE_A: [number, number][] = [
  [0x00, 29], [0x01, 29], [0x02, 30], [0x10, 38], [0x17, 40],
  [0x49, 66], [0x6A, 80], [0x85, 95], [0xF0, 155], [0xFF, 165],
];

// Температура, вариант B (для компрессора)
const TEMP_TABLE_B: [number, number][] = [
  [0x01, 165], [0x10, 175], [0x20, 185], [0x30, 195], [0x40, 205],
  [0x50, 215], [0x60, 225], [0x70, 235], [0xFF, 250],
];

// Давление: ADC -> P_x10 (бар * 10)
const PRESS_TABLE: [number, number][] = [
  [0, 0], [19, 1], [30, 3], [107, 15], [224, 34], [250, 38],
];

/**
 * Linear interpolation helper
 */
function interp8(x: number, table: [number, number][]): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x2, y2] = table[i];
    const [x1, y1] = table[i - 1];
    if (x <= x2) {
      const dy = y2 - y1, dx = x2 - x1;
      return Math.round(y1 + (dx ? (x - x1) * dy / dx : 0));
    }
  }
  return table[table.length - 1][1];
}

/**
 * ADC conversion functions
 */
const adc8ToTempA = (adc: number): number => interp8(adc & 0xFF, TEMP_TABLE_A) / 10;
const adc8ToTempB = (adc: number): number => interp8(adc & 0xFF, TEMP_TABLE_B) / 10;
const adc8ToPressureBar = (adc: number): number => interp8(adc & 0xFF, PRESS_TABLE) / 10;

/**
 * Парсер данных экрана 4 (22 байта payload - НОВЫЙ ФОРМАТ v1.0)
 * Согласно ТЗ от 17.10.2025
 */
export class Screen4Parser {
  /**
   * Парсит телеметрию Screen 4 (ФОРМАТ 0x88 - 38 байт)
   * 
   * Формат данных согласно документу УСПЕХ_ДАННЫЕ_ПРИХОДЯТ.md:
   * [0]    = 0x88         - HDR (заголовок UDS-like)
   * [1]    = 0x04         - Screen ID
   * [2]    = 0x21         - Длина данных / тип
   * [3-7]  = 0xFF × 5     - Синхронизация
   * [8]    = битовая маска/флаги
   * [9]    = битовая маска/флаги
   * [10-11] = параметры
   * [12-19] = напряжения (u16 Big Endian)
   * [20-25] = дополнительные данные
   * [26-36] = параметры
   * [37]    = счетчик пакетов
   */
  static parse(payload: Uint8Array, systemType: 'SKA' | 'SKE' = 'SKA'): DiagnosticData | null {
    // Валидация systemType
    if (systemType !== 'SKA' && systemType !== 'SKE') {
      logService.error('Screen4Parser', `Invalid systemType: ${systemType}, expected SKA or SKE`);
      return null;
    }
    
    // Проверка минимальной длины (38 байт для формата 0x88)
    if (payload.length < 38) {
      logService.error('Screen4Parser', `Payload too short: ${payload.length} bytes, expected 38`);
      return null;
    }
    
    // Проверка заголовка 0x88
    if (payload[0] !== 0x88) {
      logService.error('Screen4Parser', `Invalid header: 0x${payload[0].toString(16)}, expected 0x88`);
      return null;
    }
    
    logService.info('Screen4Parser', `Parsing 0x88 format: ${payload.length} bytes`);
    
    // ========== ИЗВЛЕЧЕНИЕ ДАННЫХ ==========
    
    // Заголовок
    const screenId = payload[1];  // 0x04
    const dataType = payload[2];  // 0x21
    
    // Битовые маски
    const flags1 = payload[8];  // 0x0F
    const flags2 = payload[9];  // 0xC0
    
    // Helper: Read u16 Big Endian
    const readU16BE = (offset: number): number => {
      return (payload[offset] << 8) | payload[offset + 1];
    };
    
    // Напряжения (u16 Big Endian) - байты 12-19
    const U_UM1_raw = readU16BE(12);  // 0xE400 = 58368
    const U_UM2_raw = readU16BE(14);  // 0xE400 = 58368
    const U_UM3_raw = readU16BE(16);  // 0xE500 = 58624
    const U_FU_raw  = readU16BE(18);  // 0xE500 = 58624
    
    // Коэффициент преобразования (ВРЕМЕННАЯ ФОРМУЛА - требует проверки!)
    // Вариант: value / 65535 * 30
    // TODO: Проверить с реальными значениями из оригинального приложения!
    const toVoltage = (raw: number): number => {
      return (raw / 65535) * 30;
    };
    
    const UP_M1 = toVoltage(U_UM1_raw);
    const UP_M2 = toVoltage(U_UM2_raw);
    const UP_M3 = toVoltage(U_UM3_raw);
    const U_nap = toVoltage(U_FU_raw);
    
    // Параметры
    const param1 = payload[27];  // Счетчик/температура? (растет со временем)
    const pwm_mode = payload[31];  // PWM или режим (0x02)
    const param2 = payload[32];  // 0xA8 (168)
    const param3 = payload[33];  // 0x56 (86)
    const param4 = payload[34];  // 0x0A (10)
    const flag1 = payload[35];   // 0x01
    
    // Счетчик пакетов
    const packet_counter = payload[37];
    
    logService.info('Screen4Parser', 
      `Decoded 0x88: UM1=${UP_M1.toFixed(2)}V, UM2=${UP_M2.toFixed(2)}V, ` +
      `UM3=${UP_M3.toFixed(2)}V, U_nap=${U_nap.toFixed(2)}V, packet#${packet_counter}`
    );
    
    // ========== ИЗВЛЕЧЕНИЕ БИТОВЫХ ПОЛЕЙ ==========
    // TODO: Определить точное значение каждого бита из декомпиляции оригинального APK
    
    // Временные значения - предположительные
    const fuseEtalon = (flags1 & 0x01) !== 0;
    const fuseCondenser = (flags1 & 0x02) !== 0;
    const fuseEvaporator = (flags1 & 0x04) !== 0;
    const fuseCompressor = (flags1 & 0x08) !== 0;
    
    const bNO_V_CMP = (flags2 & 0x40) !== 0;  // Компрессор не вращается?
    const bD_DAVL = (flags2 & 0x80) !== 0;    // Датчик давления OK?
    const bK_NORM = true;  // TODO: Извлечь из flags
    const bFTD_NORM = true;  // TODO: Извлечь из flags
    
    // Режимы работы (на основе pwm_mode)
    let work_rej_cmp_val = pwm_mode === 0x02 ? 2 : 0;  // 2 = охлаждение
    let rej_cnd_val = pwm_mode === 0x02 ? 2 : 0;
    let rej_isp_val = pwm_mode === 0x02 ? 2 : 0;
    
    // Температуры (используем ADC таблицы - значения по умолчанию)
    // TODO: Определить откуда извлекать ADC температур в формате 0x88!
    const T_air_adc = 0x6A;  // Дефолт
    const T_isp_adc = 0x30;  // Дефолт
    const T_kmp_adc = 0x40;  // Дефолт
    const U_davl_adc = 107;  // Дефолт
    
    const T_air = adc8ToTempA(T_air_adc);
    const T_isp = adc8ToTempA(T_isp_adc);
    const T_kmp = adc8ToTempB(T_kmp_adc);
    const U_davl = adc8ToPressureBar(U_davl_adc);
    
    // ========== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ==========
    
    const kUM1_cnd = systemType === 'SKE' ? 3 : 2;
    const kUM2_isp = 1;
    const kUM3_cmp = 1;
    
    const dUP_M1 = 0;
    const dUP_M2 = 0;
    const dUP_M3 = 0;
    
    const PWM_spd_val = 2;
    const n_V_cnd = kUM1_cnd;
    const s1_TMR2 = 120;
    const s0_TMR2 = 80;
    const timer_off = 0;
    const edlt_cnd = 25;
    const edlt_isp = 20;
    const edlt_cmp = 30;
    const sDAT_BIT = flags1;  // Используем flags1 для sDAT_BIT
    
    // Создание массивов статусов вентиляторов
    const condenserFans = [];
    for (let i = 1; i <= kUM1_cnd; i++) {
      condenserFans.push({
        id: i,
        status: (i <= n_V_cnd ? 'ok' : 'error') as ComponentStatus,
        errorMessage: i > n_V_cnd ? `Вентилятор конденсатора #${i} не работает` : undefined,
        repairHint: i > n_V_cnd ? 'Проверьте питание и контакты вентилятора.' : undefined
      });
    }

    const evaporatorFans = [{
      id: 1,
      status: 'ok' as ComponentStatus
    }];

    const compressorFans = [{
      id: 1,
      status: bNO_V_CMP ? 'error' as ComponentStatus : 'ok' as ComponentStatus,
      errorMessage: bNO_V_CMP ? 'Компрессор не вращается' : undefined,
      repairHint: bNO_V_CMP ? 'Проверьте компрессор и его подключение.' : undefined
    }];

    // Статусы компонентов
    const compressorStatus: ComponentStatus = work_rej_cmp_val === 0 ? 'off' : 
                                              work_rej_cmp_val === 10 ? 'error' : 'ok';
    const condenserStatus: ComponentStatus = rej_cnd_val === 0 ? 'off' :
                                             rej_cnd_val === 10 ? 'error' : 'ok';
    const evaporatorStatus: ComponentStatus = rej_isp_val === 0 ? 'off' :
                                              rej_isp_val === 10 ? 'error' : 'ok';
    const pressureSensorStatus: ComponentStatus = bD_DAVL ? 'ok' : 'error';

    // Режим работы
    let mode: 'cooling' | 'ventilation' | 'standby' | 'error' = 'standby';
    if (work_rej_cmp_val === 2 && rej_cnd_val === 2) {
      mode = 'cooling';
    } else if (work_rej_cmp_val === 0 && rej_cnd_val > 0) {
      mode = 'ventilation';
    } else if (work_rej_cmp_val === 10 || rej_cnd_val === 10) {
      mode = 'error';
    }

    // Формирование ошибок
    const errors = [];
    if (!fuseEtalon) {
      errors.push({
        code: 'F01',
        severity: 'critical' as const,
        component: 'Предохранитель эталон (Pr1)',
        description: 'Предохранитель эталона перегорел',
        suggestedFix: 'Замените предохранитель Pr1.'
      });
    }
    if (!fuseCondenser) {
      errors.push({
        code: 'F02',
        severity: 'critical' as const,
        component: 'Предохранитель конденсатора (Pr2)',
        description: 'Предохранитель конденсатора перегорел',
        suggestedFix: 'Замените предохранитель Pr2.'
      });
    }
    if (!fuseEvaporator) {
      errors.push({
        code: 'F03',
        severity: 'warning' as const,
        component: 'Предохранитель испарителя (Pr3)',
        description: 'Предохранитель испарителя перегорел',
        suggestedFix: 'Замените предохранитель Pr3.'
      });
    }
    if (!fuseCompressor) {
      errors.push({
        code: 'F04',
        severity: 'critical' as const,
        component: 'Предохранитель компрессора (Pr4)',
        description: 'Предохранитель компрессора перегорел',
        suggestedFix: 'Замените предохранитель Pr4.'
      });
    }
    if (bNO_V_CMP) {
      errors.push({
        code: 'E01',
        severity: 'critical' as const,
        component: 'Компрессор',
        description: 'Компрессор не вращается',
        suggestedFix: 'Проверьте компрессор и его питание.'
      });
    }

    logService.success('Screen4Parser', `Parsed 0x88 format: U=${U_nap.toFixed(1)}V, T_air=${T_air.toFixed(1)}°C, mode=${mode}, pkt#${packet_counter}`);
    logService.warn('Screen4Parser', '⚠️  ФОРМУЛЫ НАПРЯЖЕНИЙ ТРЕБУЮТ ПРОВЕРКИ! Сравните с оригинальным приложением.');

    return {
      // Напряжения
      UP_M1,
      UP_M2,
      UP_M3,
      UP_M4: U_nap,
      UP_M5: U_nap,

      // Падения напряжения
      dUP_M1,
      dUP_M2,
      dUP_M3,

      // Температуры
      T_air,
      T_isp,
      T_kmp,

      // Напряжение и давление
      U_nap,
      U_davl,

      // Количество вентиляторов
      kUM1_cnd,
      kUM2_isp,
      kUM3_cmp,

      // Активные вентиляторы
      n_V_cnd,
      n_V_isp: 1,
      n_V_cmp: 1,

      // PWM
      PWM_spd: PWM_spd_val as 1 | 2,

      // Детальные статусы вентиляторов
      condenserFans,
      evaporatorFans,
      compressorFans,

      // Статусы компонентов
      compressorStatus,
      condenserStatus,
      evaporatorStatus,
      pressureSensorStatus,
      
      // Power system
      powerStatus: U_nap >= 22 && U_nap <= 30 ? 'ok' : 'error',
      batteryVoltage: U_nap,
      powerSupplyOk: U_nap >= 22 && U_nap <= 30,
      
      softStartStatus: bK_NORM && bFTD_NORM ? 'ok' : 'error',

      // Диагностика soft-start
      zmk_V_isp1: false,
      obr_V_isp1: false,
      zmk_V_knd1: false,
      obr_V_knd1: n_V_cnd < kUM1_cnd,
      zmk_COMP: false,
      obr_COMP: bNO_V_CMP,

      // Режимы работы
      work_rej_cnd: rej_cnd_val,
      work_rej_isp: rej_isp_val,
      work_rej_cmp: work_rej_cmp_val,

      // Предохранители
      fuseEtalon,
      fuseCondenser,
      fuseEvaporator,
      fuseCompressor,

      // Soft start signals
      signal_SVD: bFTD_NORM,
      signal_ContactNorm: bK_NORM,

      // Дополнительные данные
      cikl_COM: 0,  // Не передается в новом формате
      cikl_K_line: 0,  // Не передается в новом формате
      timer_off,
      s1_TMR2,
      s0_TMR2,
      edlt_cnd_i: edlt_cnd,
      edlt_isp_i: edlt_isp,
      edlt_cmp_i: edlt_cmp,

      // Тип системы и режим
      systemType,
      mode,
      sSTATUS: sDAT_BIT,

      // Ошибки
      errors
    };
  }
}
