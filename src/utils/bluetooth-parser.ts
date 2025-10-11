import { DiagnosticData, ComponentStatus } from '@/types/bluetooth';

/**
 * Парсер данных Bluetooth пакета от БСКУ Панцирь
 * Структура пакета основана на прошивке Pantcir_koval-3.c (строки 679-730)
 */
export class BluetoothDataParser {
  /**
   * Парсит байтовый массив данных от БСКУ в структуру DiagnosticData
   * @param data - Байтовый массив данных из Bluetooth пакета
   * @param systemType - Тип системы ('SKA' или 'SKE')
   * @returns Распарсенные диагностические данные
   */
  static parseData(data: Uint8Array, systemType: 'SKA' | 'SKE' = 'SKA'): DiagnosticData | null {
    // Проверка минимальной длины пакета
    if (data.length < 30) {
      console.error('Packet too short:', data.length);
      return null;
    }

    let index = 0;
    
    // Парсинг напряжений (байты 0-3)
    const U_U_UM1 = data[index++]; // Напряжение конденсатора (ADC значение)
    const U_U_UM2 = data[index++]; // Напряжение испарителя
    const U_U_UM3 = data[index++]; // Напряжение компрессора
    const U_U_FU = data[index++];  // Эталонное напряжение питания (27В)

    // Управление реле и индикацией (байты 4-5)
    const uUPR_BT = data[index++];  // Управление реле (биты: M1..M5, CMP)
    const uUPR_IND = data[index++]; // Управление индикацией (IND1..IND4)

    // Статусные биты (байт 6)
    const sDAT_BIT = data[index++]; // D_DAVL, VKL_CMP, BL_2, K_NORM, FTD_NORM, BL2_1vnt, NO_V_CMP

    // Режим работы компрессора (байт 7)
    const work_rej_cmp = data[index++];

    // Падения напряжения (байты 8-10)
    const vdlt_cnd_i = data[index++]; // Падение напряжения конденсатора
    const vdlt_isp_i = data[index++]; // Падение напряжения испарителя
    const vdlt_cmp_i = data[index++]; // Падение напряжения компрессора

    // Таймер отключения (байт 11)
    const timer_off = data[index++];

    // Режимы работы (байты 12-13)
    const work_rej_cnd = data[index++]; // Режим работы конденсатора
    const work_rej_isp = data[index++]; // Режим работы испарителя

    // Заданные падения напряжения (байты 14-16)
    const edlt_cnd_i = data[index++];
    const edlt_isp_i = data[index++];
    const edlt_cmp_i = data[index++];

    // Количество вентиляторов и скорость (байты 17-18)
    const n_V_cnd = data[index++]; // Активные вентиляторы конденсатора
    const PWM_spd = data[index++] as 1 | 2; // Скорость PWM (1=медленно, 2=быстро)

    // ШИМ параметры (байты 19-20)
    const s1_TMR2 = data[index++]; // Длительность высокого уровня
    const s0_TMR2 = data[index++]; // Длительность низкого уровня

    // Температуры (байты 21-22)
    const T_air = data[index++];  // Температура воздуха
    const T_isp = data[index++];  // Температура испарителя

    // Давление (байт 23)
    const U_davl = data[index++]; // Датчик давления (0-255)

    // Статусы компонентов (байты 24-25)
    const iSOST_UPR1 = data[index++]; // Статус управления 1
    const iSOST_UPR2 = data[index++]; // Статус управления 2

    // Дополнительные измерения (если есть)
    const kUM1_cnd = data[index++] || (systemType === 'SKE' ? 2 : 3); // Количество вентиляторов конденсатора
    const kUM2_isp = data[index++] || 1; // Количество вентиляторов испарителя
    const kUM3_cmp = data[index++] || 1; // Количество вентиляторов компрессора

    const n_V_isp = data[index++] || 1; // Активные вентиляторы испарителя
    const n_V_cmp = data[index++] || 1; // Активные вентиляторы компрессора

    // Преобразование температур (из байта в градусы Цельсия)
    const temp_air = this.convertTemperature(T_air);
    const temp_isp = this.convertTemperature(T_isp);

    // Преобразование напряжений (из ADC в вольты)
    // Формула: U = (ADC_value / 255) * 30V (примерно)
    const voltage_scale = 30 / 255;
    const UP_M1 = U_U_UM1 * voltage_scale;
    const UP_M2 = U_U_UM2 * voltage_scale;
    const UP_M3 = U_U_UM3 * voltage_scale;
    const UP_M4 = U_U_FU * voltage_scale;
    const UP_M5 = U_U_FU * voltage_scale;
    const U_nap = U_U_FU * voltage_scale;

    // Вычисление падений напряжения
    const dUP_M1 = vdlt_cnd_i * voltage_scale;
    const dUP_M2 = vdlt_isp_i * voltage_scale;
    const dUP_M3 = vdlt_cmp_i * voltage_scale;

    // Парсинг статусных битов
    const bD_DAVL = !!(sDAT_BIT & 0x01);   // Датчик давления
    const bVKL_CMP = !!(sDAT_BIT & 0x02);  // Компрессор включен
    const bBL_2 = !!(sDAT_BIT & 0x04);     // Тип системы (0=SKA, 1=SKE)
    const bK_NORM = !!(sDAT_BIT & 0x08);   // Норма конденсатора
    const bFTD_NORM = !!(sDAT_BIT & 0x10); // Норма фотодатчика
    const bBL2_1vnt = !!(sDAT_BIT & 0x20); // 1 вентилятор испарителя
    const bNO_V_CMP = !!(sDAT_BIT & 0x40); // Нет вентилятора компрессора

    // Парсинг управления реле (uUPR_BT)
    const uUP_M1 = !!(uUPR_BT & 0x01); // Реле M1
    const uUP_M2 = !!(uUPR_BT & 0x02); // Реле M2
    const uUP_M3 = !!(uUPR_BT & 0x04); // Реле M3
    const uUP_M4 = !!(uUPR_BT & 0x08); // Реле M4
    const uUP_M5 = !!(uUPR_BT & 0x10); // Реле M5
    const uUP_CMP = !!(uUPR_BT & 0x20); // Реле компрессора

    // Парсинг статусов ошибок из iSOST_UPR1 и iSOST_UPR2
    const zmk_V_isp1 = !!(iSOST_UPR1 & 0x01); // Замыкание вентилятора испарителя
    const obr_V_isp1 = !!(iSOST_UPR1 & 0x02); // Обрыв вентилятора испарителя
    const zmk_V_knd1 = !!(iSOST_UPR1 & 0x04); // Замыкание вентилятора конденсатора
    const obr_V_knd1 = !!(iSOST_UPR1 & 0x08); // Обрыв вентилятора конденсатора

    const zmk_COMP = !!(iSOST_UPR2 & 0x01); // Замыкание компрессора
    const obr_COMP = !!(iSOST_UPR2 & 0x02); // Обрыв компрессора

    // Парсинг предохранителей из uUPR_IND
    const fuseEtalon = !!(uUPR_IND & 0x01);    // Pr1
    const fuseCondenser = !!(uUPR_IND & 0x02); // Pr2
    const fuseEvaporator = !!(uUPR_IND & 0x04); // Pr3
    const fuseCompressor = !!(uUPR_IND & 0x08); // Pr4

    // Определение статусов компонентов
    const compressorStatus: ComponentStatus = zmk_COMP || obr_COMP ? 'error' : 
                                               work_rej_cmp === 0 ? 'off' : 'ok';
    const condenserStatus: ComponentStatus = obr_V_knd1 ? 'error' : 
                                              work_rej_cnd === 0 ? 'off' : 'ok';
    const evaporatorStatus: ComponentStatus = obr_V_isp1 ? 'error' : 
                                               work_rej_isp === 0 ? 'off' : 'ok';
    const pressureSensorStatus: ComponentStatus = bD_DAVL ? 'ok' : 'error';
    const softStartStatus: ComponentStatus = 'ok'; // TODO: определить из данных

    // Создание массивов статусов вентиляторов
    const condenserFans = [];
    for (let i = 1; i <= kUM1_cnd; i++) {
      condenserFans.push({
        id: i,
        status: (i <= n_V_cnd ? 'ok' : 'error') as ComponentStatus,
        errorMessage: i > n_V_cnd ? `Вентилятор конденсатора #${i} не работает` : undefined,
        repairHint: i > n_V_cnd ? 'Проверьте питание и контакты вентилятора. Замените вентилятор при необходимости.' : undefined
      });
    }

    const evaporatorFans = [];
    for (let i = 1; i <= kUM2_isp; i++) {
      evaporatorFans.push({
        id: i,
        status: (i <= n_V_isp ? 'ok' : 'error') as ComponentStatus,
        errorMessage: i > n_V_isp ? `Вентилятор испарителя #${i} не работает` : undefined,
        repairHint: i > n_V_isp ? 'Проверьте питание и контакты вентилятора.' : undefined
      });
    }

    const compressorFans = [];
    for (let i = 1; i <= kUM3_cmp; i++) {
      compressorFans.push({
        id: i,
        status: (i <= n_V_cmp ? 'ok' : 'error') as ComponentStatus,
        errorMessage: i > n_V_cmp ? `Вентилятор компрессора #${i} не работает` : undefined,
        repairHint: i > n_V_cmp ? 'Проверьте питание и контакты вентилятора.' : undefined
      });
    }

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
    if (zmk_COMP) {
      errors.push({
        code: 'E01',
        severity: 'critical' as const,
        component: 'Компрессор',
        description: 'Замыкание цепи компрессора',
        suggestedFix: 'Проверьте проводку компрессора. Возможно короткое замыкание.'
      });
    }
    if (obr_COMP) {
      errors.push({
        code: 'E02',
        severity: 'critical' as const,
        component: 'Компрессор',
        description: 'Обрыв цепи компрессора',
        suggestedFix: 'Проверьте подключение компрессора и целостность проводки.'
      });
    }
    if (obr_V_knd1) {
      errors.push({
        code: 'E03',
        severity: 'warning' as const,
        component: 'Вентилятор конденсатора',
        description: 'Обрыв цепи вентилятора конденсатора',
        suggestedFix: 'Проверьте подключение вентилятора и замените при необходимости.'
      });
    }
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
        suggestedFix: 'Замените предохранитель Pr2. Проверьте нагрузку конденсатора.'
      });
    }
    if (!fuseEvaporator) {
      errors.push({
        code: 'F03',
        severity: 'warning' as const,
        component: 'Предохранитель испарителя (Pr3)',
        description: 'Предохранитель испарителя перегорел',
        suggestedFix: 'Замените предохранитель Pr3. Проверьте нагрузку испарителя.'
      });
    }
    if (!fuseCompressor) {
      errors.push({
        code: 'F04',
        severity: 'critical' as const,
        component: 'Предохранитель компрессора (Pr4)',
        description: 'Предохранитель компрессора перегорел',
        suggestedFix: 'Замените предохранитель Pr4. Проверьте нагрузку компрессора.'
      });
    }

    return {
      // Токи измерения
      UP_M1,
      UP_M2,
      UP_M3,
      UP_M4,
      UP_M5,

      // Падения напряжения
      dUP_M1,
      dUP_M2,
      dUP_M3,

      // Температуры
      T_air: temp_air,
      T_isp: temp_isp,

      // Напряжение питания и давление
      U_nap,
      U_davl,

      // Количество вентиляторов
      kUM1_cnd,
      kUM2_isp,
      kUM3_cmp,

      // Активные вентиляторы
      n_V_cnd,
      n_V_isp,
      n_V_cmp,

      // Скорость PWM
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
      softStartStatus,

      // Детальная диагностика
      zmk_V_isp1,
      obr_V_isp1,
      zmk_V_knd1,
      obr_V_knd1,
      zmk_COMP,
      obr_COMP,

      // Режимы работы
      work_rej_cnd,
      work_rej_isp,
      work_rej_cmp,

      // Предохранители
      fuseEtalon,
      fuseCondenser,
      fuseEvaporator,
      fuseCompressor,

      // Тип системы
      systemType,

      // Режим работы
      mode,

      // Статус системы
      sSTATUS: sDAT_BIT,

      // Ошибки
      errors
    };
  }

  /**
   * Преобразует байтовое значение температуры в градусы Цельсия
   * @param value - Байтовое значение температуры
   * @returns Температура в °C
   */
  private static convertTemperature(value: number): number {
    // Преобразование зависит от калибровки датчика
    // Обычно: T = (ADC_value - 128) / 2.56 для диапазона -50 до +50°C
    // или T = ADC_value / 2 - 50 для упрощенной формулы
    return (value / 2) - 50;
  }
}
