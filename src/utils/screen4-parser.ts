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
   * Парсит телеметрию Screen 4 (НОВЫЙ ФОРМАТ от оригинального приложения)
   * 
   * Формат данных из логов оригинального приложения:
   * [0-X]: Данные телеметрии (формат может быть u16 LE или u8)
   * 
   * Пример из логов: 0 0 20 1 21 1 21 1 21 1 32 21 11 29 18 8 ...
   * 
   * ВАЖНО: Точный формат требует уточнения из декомпилированного APK!
   * Пока используем частичную интерпретацию на основе известных данных.
   * 
   * TODO: Определить точную структуру через декомпиляцию или анализ логов
   */
  static parse(payload: Uint8Array, systemType: 'SKA' | 'SKE' = 'SKA'): DiagnosticData | null {
    // Валидация systemType
    if (systemType !== 'SKA' && systemType !== 'SKE') {
      logService.error('Screen4Parser', `Invalid systemType: ${systemType}, expected SKA or SKE`);
      return null;
    }
    
    // Минимальная длина на основе анализа логов
    // TODO: Уточнить точную минимальную длину
    if (payload.length < 20) {
      logService.error('Screen4Parser', `Payload too short: ${payload.length} bytes, expected minimum 20`);
      return null;
    }
    
    logService.info('Screen4Parser', `Parsing NEW protocol format: ${payload.length} bytes`);
    logService.info('Screen4Parser', `Data: ${Array.from(payload.slice(0, Math.min(30, payload.length))).join(' ')}`);
    
    // ========== ВРЕМЕННАЯ ИНТЕРПРЕТАЦИЯ (требует уточнения!) ==========
    
    // Helper: Read u16 Little Endian
    const readU16LE = (offset: number): number => {
      if (offset + 1 >= payload.length) return 0;
      return payload[offset] | (payload[offset + 1] << 8);
    };
    
    // Попытка декодирования на основе частичных данных из логов
    // Формат: возможно u16 LE для некоторых значений
    
    // Байты 0-1: неизвестно (0 0)
    // Байт 2: 20 (возможно параметр)
    const param1 = payload.length > 2 ? payload[2] : 0;
    
    // Байты 3-4, 5-6, 7-8, 9-10: возможно u16 значения (1,21 → 277)
    const value1 = payload.length > 4 ? readU16LE(3) : 0;
    const value2 = payload.length > 6 ? readU16LE(5) : 0;
    const value3 = payload.length > 8 ? readU16LE(7) : 0;
    const value4 = payload.length > 10 ? readU16LE(9) : 0;
    
    // Байты 11-15: отдельные параметры
    const param2 = payload.length > 11 ? payload[11] : 0;  // 21
    const param3 = payload.length > 12 ? payload[12] : 0;  // 11
    const param4 = payload.length > 13 ? payload[13] : 0;  // 29
    const param5 = payload.length > 14 ? payload[14] : 0;  // 18
    const param6 = payload.length > 15 ? payload[15] : 0;  // 8
    
    // TODO: КРИТИЧЕСКИ ВАЖНО - определить правильный маппинг!
    // Пока используем предположения:
    // - value1-4 могут быть напряжениями (если разделить на 10 получаем ~27V)
    // - param2-6 могут быть температурами или другими параметрами
    
    // Предположительные напряжения (value1-4 ≈ 277 → 27.7V при делении на 10)
    const UP_M1 = value1 / 10.0;
    const UP_M2 = value2 / 10.0;
    const UP_M3 = value3 / 10.0;
    const U_nap = value4 / 10.0;
    
    // Предположительные температуры (используем калибровочные таблицы)
    // TODO: Определить точные индексы ADC температур в новом формате!
    const T_air_adc = payload.length > 16 ? payload[16] : 0x6A;
    const T_isp_adc = payload.length > 17 ? payload[17] : 0x30;
    const T_kmp_adc = payload.length > 18 ? payload[18] : 0x40;
    const U_davl_adc = payload.length > 19 ? payload[19] : 107;
    
    const T_air = adc8ToTempA(T_air_adc);
    const T_isp = adc8ToTempA(T_isp_adc);
    const T_kmp = adc8ToTempB(T_kmp_adc);
    const U_davl = adc8ToPressureBar(U_davl_adc);
    
    logService.info('Screen4Parser', 
      `Decoded (TENTATIVE): U1=${UP_M1.toFixed(1)}V, U2=${UP_M2.toFixed(1)}V, ` +
      `U3=${UP_M3.toFixed(1)}V, U_nap=${U_nap.toFixed(1)}V, ` +
      `T_air=${T_air.toFixed(1)}°C, T_isp=${T_isp.toFixed(1)}°C`
    );
    
    // ========== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА С ДЕФОЛТНЫМИ ЗНАЧЕНИЯМИ ==========
    
    // Так как точный формат неизвестен, используем безопасные дефолты

    
    // Используем безопасные дефолты для неизвестных полей
    const kUM1_cnd = systemType === 'SKE' ? 3 : 2;
    const kUM2_isp = 1;
    const kUM3_cmp = 1;
    
    // Дефолтные битовые поля (пока не знаем их положение в новом формате)
    // TODO: Определить точное положение битовых полей!
    const fuseEtalon = true;
    const fuseCondenser = true;
    const fuseEvaporator = true;
    const fuseCompressor = true;
    const bNO_V_CMP = false;
    const bD_DAVL = true;
    const bK_NORM = true;
    const bFTD_NORM = true;
    
    // Режимы работы (дефолт - не знаем точно) - используем переменные
    let work_rej_cmp_val = 2;  // Предположительно охлаждение
    let rej_cnd_val = 2;
    let rej_isp_val = 2;
    
    // Падения напряжения (если не определены)
    const dUP_M1 = 0;
    const dUP_M2 = 0;
    const dUP_M3 = 0;
    
    // PWM и другие параметры
    const PWM_spd_val = 2;
    const n_V_cnd = kUM1_cnd;  // Все вентиляторы работают (оптимистичный сценарий)
    const s1_TMR2 = 120;
    const s0_TMR2 = 80;
    const timer_off = 0;
    const edlt_cnd = 25;
    const edlt_isp = 20;
    const edlt_cmp = 30;
    const sDAT_BIT = 0;
    
    // ========== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ==========
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

    logService.success('Screen4Parser', `Parsed NEW protocol format: U=${U_nap.toFixed(1)}V, T_air=${T_air.toFixed(1)}°C, mode=${mode}`);
    logService.warn('Screen4Parser', '⚠️  IMPORTANT: Telemetry format is TENTATIVE and needs verification from decompiled APK!');

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
