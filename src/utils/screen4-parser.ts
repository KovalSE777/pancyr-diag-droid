import { DiagnosticData, ComponentStatus } from '@/types/bluetooth';
import { adc8ToTempA, adc8ToTempB, adc8ToPressureBar } from './adc-conversion';

/**
 * Парсер данных экрана 4 (33 байта payload)
 * Согласно документу "Главное.docx" §3.1
 */
export class Screen4Parser {
  /**
   * Читает U16 в little-endian формате
   */
  private static readU16LE(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  /**
   * Парсит payload экрана 4 (33 байта)
   * Индексация: payload[0] = byte[3] в полном кадре
   */
  static parse(payload: Uint8Array, systemType: 'SKA' | 'SKE' = 'SKA'): DiagnosticData | null {
    // Валидация systemType
    if (systemType !== 'SKA' && systemType !== 'SKE') {
      console.error('Invalid systemType:', systemType, 'expected SKA or SKE');
      return null;
    }
    
    if (payload.length < 33) {
      console.error('Screen 4 payload too short:', payload.length, 'expected 33 bytes');
      return null;
    }
    
    // Проверка валидности критичных индексов
    const requiredIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    for (const idx of requiredIndices) {
      if (payload[idx] === undefined) {
        console.error(`Screen 4 payload invalid at index ${idx}`);
        return null;
      }
    }

    // [0-6] - маски отображения (пропускаем, используются прошивкой для UI)
    // [7] = sim2 - битовое поле
    const sim2 = payload[7];
    
    // [8] = sim3 - битовое поле  
    const sim3 = payload[8];
    
    // [9-10] - U_U_FU + 100 (u16, little-endian)
    const U_U_FU = this.readU16LE(payload, 9) - 100;
    
    // [11-12] - U_U_UM1 + 100 (u16, LE)
    const U_U_UM1 = this.readU16LE(payload, 11) - 100;
    
    // [13-14] - U_U_UM2 + 100 (u16, LE)
    const U_U_UM2 = this.readU16LE(payload, 13) - 100;
    
    // [15-16] - U_U_UM3 + 100 (u16, LE)
    const U_U_UM3 = this.readU16LE(payload, 15) - 100;
    
    // [17] - vdlt_cnd_i (падение напряжения конденсатора)
    const vdlt_cnd_i = payload[17];
    
    // [18] - vdlt_isp_i (падение напряжения испарителя)
    const vdlt_isp_i = payload[18];
    
    // [19] - vdlt_cmp_i (падение напряжения компрессора)
    const vdlt_cmp_i = payload[19];
    
    // [20] - edlt_cnd_i (заданное падение конденсатора)
    const edlt_cnd_i = payload[20];
    
    // [21] - edlt_isp_i (заданное падение испарителя)
    const edlt_isp_i = payload[21];
    
    // [22] - edlt_cmp_i (заданное падение компрессора)
    const edlt_cmp_i = payload[22];
    
    // [23] - cikl_COM (счётчик циклов BT)
    const cikl_COM = payload[23];
    
    // [24] - cikl_K_line (счётчик циклов K-Line)
    const cikl_K_line = payload[24];
    
    // [25] - timer_off (таймер отключения)
    const timer_off = payload[25];
    
    // [26] - n_V_cnd (активные вентиляторы конденсатора)
    const n_V_cnd = payload[26];
    
    // [27] - PWM_spd (скорость PWM: 1=медленно, 2=быстро)
    const PWM_spd = payload[27] as 1 | 2;
    
    // [28] - s1_TMR2 (длительность высокого уровня ШИМ)
    const s1_TMR2 = payload[28];
    
    // [29] - s0_TMR2 (длительность низкого уровня ШИМ)
    const s0_TMR2 = payload[29];
    
    // [30] - work_rej_cnd (режим работы конденсатора)
    const work_rej_cnd = payload[30];
    
    // [31] - work_rej_isp (режим работы испарителя)
    const work_rej_isp = payload[31];
    
    // [32] - work_rej_cmp (режим работы компрессора)
    const work_rej_cmp = payload[32];

    // Декодирование sim2 - битовое поле статусов
    // bit1 ← sDAT_BIT & 0x02
    // bit2 ← sDAT_BIT & 0x04
    // bit3 ← sDAT_BIT & 0x20
    // bit4 ← sDAT_BIT & 0x08
    // bit5 ← sDAT_BIT & 0x10
    // bit6 ← uUPR_IND & 0x01
    // bit7 ← uUPR_IND & 0x02
    
    // Восстанавливаем sDAT_BIT из sim2
    let sDAT_BIT = 0;
    if (sim2 & 0x02) sDAT_BIT |= 0x02; // bit1
    if (sim2 & 0x04) sDAT_BIT |= 0x04; // bit2
    if (sim2 & 0x20) sDAT_BIT |= 0x20; // bit3
    if (sim2 & 0x08) sDAT_BIT |= 0x08; // bit4
    if (sim2 & 0x10) sDAT_BIT |= 0x10; // bit5
    
    // Восстанавливаем uUPR_IND частично из sim2 и sim3
    let uUPR_IND = 0;
    if (sim2 & 0x40) uUPR_IND |= 0x01; // bit6 → uUPR_IND bit0
    if (sim2 & 0x80) uUPR_IND |= 0x02; // bit7 → uUPR_IND bit1
    
    // Декодирование sim3 - битовое поле управления
    // bit0 ← uUPR_IND & 0x04
    // bit1 ← uUPR_IND & 0x08
    // bit2 ← uUPR_BT & 0x01
    // bit3 ← uUPR_BT & 0x02
    // bit4 ← uUPR_BT & 0x04
    // bit5 ← uUPR_BT & 0x08
    // bit6 ← uUPR_BT & 0x10
    // bit7 ← uUPR_BT & 0x40
    
    if (sim3 & 0x01) uUPR_IND |= 0x04; // bit0 → uUPR_IND bit2
    if (sim3 & 0x02) uUPR_IND |= 0x08; // bit1 → uUPR_IND bit3
    
    // Восстанавливаем uUPR_BT из sim3
    let uUPR_BT = 0;
    if (sim3 & 0x04) uUPR_BT |= 0x01; // bit2
    if (sim3 & 0x08) uUPR_BT |= 0x02; // bit3
    if (sim3 & 0x10) uUPR_BT |= 0x04; // bit4
    if (sim3 & 0x20) uUPR_BT |= 0x08; // bit5
    if (sim3 & 0x40) uUPR_BT |= 0x10; // bit6
    if (sim3 & 0x80) uUPR_BT |= 0x40; // bit7

    // Парсинг статусных битов sDAT_BIT
    const bD_DAVL = !!(sDAT_BIT & 0x01);   // Датчик давления
    const bVKL_CMP = !!(sDAT_BIT & 0x02);  // Компрессор включен
    const bBL_2 = !!(sDAT_BIT & 0x04);     // Тип системы
    const bK_NORM = !!(sDAT_BIT & 0x08);   // Норма конденсатора
    const bFTD_NORM = !!(sDAT_BIT & 0x10); // Норма фотодатчика
    
    // Парсинг предохранителей из uUPR_IND
    const fuseEtalon = !!(uUPR_IND & 0x01);
    const fuseCondenser = !!(uUPR_IND & 0x02);
    const fuseEvaporator = !!(uUPR_IND & 0x04);
    const fuseCompressor = !!(uUPR_IND & 0x08);
    
    // Парсинг управления реле из uUPR_BT
    const uUP_M1 = !!(uUPR_BT & 0x01);
    const uUP_M2 = !!(uUPR_BT & 0x02);
    const uUP_M3 = !!(uUPR_BT & 0x04);
    const uUP_M4 = !!(uUPR_BT & 0x08);
    const uUP_M5 = !!(uUPR_BT & 0x10);
    const uUP_CMP = !!(uUPR_BT & 0x20);

    // Преобразование напряжений (простое масштабирование)
    const UP_M1 = U_U_UM1 * 0.12; // Примерный коэффициент
    const UP_M2 = U_U_UM2 * 0.12;
    const UP_M3 = U_U_UM3 * 0.12;
    const U_nap = U_U_FU * 0.12;
    
    const dUP_M1 = vdlt_cnd_i * 0.05;
    const dUP_M2 = vdlt_isp_i * 0.05;
    const dUP_M3 = vdlt_cmp_i * 0.05;

    // Определение количества вентиляторов по типу системы
    const kUM1_cnd = systemType === 'SKE' ? 3 : 2;
    const kUM2_isp = 1;
    const kUM3_cmp = 1;

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
      status: 'ok' as ComponentStatus
    }];

    // Определение статусов компонентов
    const compressorStatus: ComponentStatus = work_rej_cmp === 0 ? 'off' : 
                                               work_rej_cmp === 10 ? 'error' : 'ok';
    const condenserStatus: ComponentStatus = work_rej_cnd === 0 ? 'off' :
                                              work_rej_cnd === 10 ? 'error' : 'ok';
    const evaporatorStatus: ComponentStatus = work_rej_isp === 0 ? 'off' :
                                               work_rej_isp === 10 ? 'error' : 'ok';
    const pressureSensorStatus: ComponentStatus = bD_DAVL ? 'ok' : 'error';

    // Определение режима работы
    let mode: 'cooling' | 'ventilation' | 'standby' | 'error' = 'standby';
    if (work_rej_cmp === 2 && work_rej_cnd === 2) {
      mode = 'cooling';
    } else if (work_rej_cmp === 0 && work_rej_cnd > 0) {
      mode = 'ventilation';
    } else if (work_rej_cmp === 10 || work_rej_cnd === 10) {
      mode = 'error';
    }

    // Формирование массива ошибок
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

      // Температуры (используем калибровочные таблицы из прошивки)
      // ADC bytes: 24=T_air, 25=T_isp, 26=T_kmp
      T_air: adc8ToTempA(payload[24]),  // Воздух - таблица A
      T_isp: adc8ToTempA(payload[25]),  // Испаритель - таблица A
      T_kmp: adc8ToTempB(payload[26]),  // Компрессор - таблица B

      // Напряжение и давление
      U_nap,
      U_davl: adc8ToPressureBar(payload[23]), // Давление в барах

      // Количество вентиляторов
      kUM1_cnd,
      kUM2_isp,
      kUM3_cmp,

      // Активные вентиляторы
      n_V_cnd,
      n_V_isp: 1,
      n_V_cmp: 1,

      // PWM
      PWM_spd,

      // Детальные статусы вентиляторов
      condenserFans,
      evaporatorFans,
      compressorFans,

      // Статусы компонентов
      compressorStatus,
      condenserStatus,
      evaporatorStatus,
      pressureSensorStatus,
      softStartStatus: 'ok',

      // Диагностика (заглушки)
      zmk_V_isp1: false,
      obr_V_isp1: false,
      zmk_V_knd1: false,
      obr_V_knd1: n_V_cnd < kUM1_cnd,
      zmk_COMP: false,
      obr_COMP: false,

      // Режимы работы
      work_rej_cnd,
      work_rej_isp,
      work_rej_cmp,

      // Предохранители
      fuseEtalon,
      fuseCondenser,
      fuseEvaporator,
      fuseCompressor,

      // Soft start signals
      signal_SVD: bFTD_NORM,
      signal_ContactNorm: bK_NORM,

      // Дополнительные данные
      cikl_COM,
      cikl_K_line,
      timer_off,
      s1_TMR2,
      s0_TMR2,
      edlt_cnd_i,
      edlt_isp_i,
      edlt_cmp_i,

      // Тип системы и режим
      systemType,
      mode,
      sSTATUS: sDAT_BIT,

      // Ошибки
      errors
    };
  }
}
