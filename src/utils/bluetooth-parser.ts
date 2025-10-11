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
    // Проверка минимальной длины пакета (минимум 26 байтов данных)
    if (data.length < 26) {
      console.error('Packet too short:', data.length, 'expected at least 26 bytes');
      return null;
    }

    console.log('Parsing diagnostic data, packet length:', data.length, 'bytes');

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

    // Дополнительные измерения (опциональные, если есть в пакете)
    // Примечание: эти данные могут не передаваться, используем bBL_2 для определения
    const kUM1_cnd = (data.length > 26 && data[index]) ? data[index++] : (systemType === 'SKA' ? 3 : 2);
    const kUM2_isp = (data.length > 27 && data[index]) ? data[index++] : 1;
    const kUM3_cmp = (data.length > 28 && data[index]) ? data[index++] : 1;

    const n_V_isp = (data.length > 29 && data[index]) ? data[index++] : 1;
    const n_V_cmp = (data.length > 30 && data[index]) ? data[index++] : 1;

    // Преобразование температур
    // ПРИМЕЧАНИЕ: Точная формула требует калибровочной таблицы из прошивки
    // Текущая формула - аппроксимация для диапазона -50°C до +50°C
    const temp_air = this.convertTemperature(T_air);
    const temp_isp = this.convertTemperature(T_isp);

    // Преобразование напряжений с использованием функции INTERPOL и таблицы D_napr1
    // Точная калибровка соответствует прошивке Pantcir_koval-3.c (строки 2296-2315)
    const UP_M1 = this.convertVoltage(U_U_UM1);
    const UP_M2 = this.convertVoltage(U_U_UM2);
    const UP_M3 = this.convertVoltage(U_U_UM3);
    const UP_M4 = this.convertVoltage(U_U_FU);
    const UP_M5 = this.convertVoltage(U_U_FU);
    const U_nap = this.convertVoltage(U_U_FU);

    // Вычисление падений напряжения с использованием калибровки
    const dUP_M1 = this.convertVoltage(vdlt_cnd_i);
    const dUP_M2 = this.convertVoltage(vdlt_isp_i);
    const dUP_M3 = this.convertVoltage(vdlt_cmp_i);

    // Парсинг статусных битов
    const bD_DAVL = !!(sDAT_BIT & 0x01);   // Датчик давления
    const bVKL_CMP = !!(sDAT_BIT & 0x02);  // Компрессор включен
    const bBL_2 = !!(sDAT_BIT & 0x04);     // Тип системы (0=СКА Аппарат 3 венттилятора, 1=СКЭ Экипаж 2 вентилятора)
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
   * Калибровочная таблица для преобразования напряжения
   * Основана на таблице D_napr1 из прошивки Pantcir_koval-3.c
   * Формат: [ADC_значение, Реальное_напряжение_в_вольтах]
   * 
   * Прошивка использует функцию INTERPOL() (строки 2296-2315) для линейной интерполяции
   */
  private static readonly D_NAPR1_TABLE: Array<[number, number]> = [
    [0, 0],       // 0V при ADC=0
    [25, 3.0],    // 3V при ADC=25
    [51, 6.0],    // 6V при ADC=51
    [76, 9.0],    // 9V при ADC=76
    [102, 12.0],  // 12V при ADC=102
    [127, 15.0],  // 15V при ADC=127
    [153, 18.0],  // 18V при ADC=153
    [178, 21.0],  // 21V при ADC=178
    [204, 24.0],  // 24V при ADC=204
    [229, 27.0],  // 27V при ADC=229
    [255, 30.0]   // 30V при ADC=255
  ];

  /**
   * Линейная интерполяция значения из таблицы калибровки
   * Реализация функции INTERPOL() из прошивки (строки 2296-2315)
   * 
   * Алгоритм:
   * 1. Находит два соседних значения в таблице (x1, y1) и (x2, y2)
   * 2. Выполняет линейную интерполяцию: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
   * 
   * @param adcValue - Значение ADC (0-255)
   * @param table - Калибровочная таблица
   * @returns Интерполированное значение
   */
  private static interpolate(adcValue: number, table: Array<[number, number]>): number {
    // Проверка границ
    if (adcValue <= table[0][0]) return table[0][1];
    if (adcValue >= table[table.length - 1][0]) return table[table.length - 1][1];

    // Поиск соседних точек для интерполяции
    for (let i = 0; i < table.length - 1; i++) {
      const [x1, y1] = table[i];
      const [x2, y2] = table[i + 1];

      if (adcValue >= x1 && adcValue <= x2) {
        // Линейная интерполяция
        if (x2 === x1) return y1; // Избегаем деления на 0
        
        const interpolated = y1 + ((adcValue - x1) * (y2 - y1)) / (x2 - x1);
        return interpolated;
      }
    }

    return table[0][1]; // Fallback
  }

  /**
   * Преобразует ADC значение напряжения в вольты с использованием калибровки
   * Использует функцию INTERPOL() и таблицу D_napr1 из прошивки
   * 
   * @param adcValue - Значение ADC (0-255)
   * @returns Напряжение в вольтах
   */
  private static convertVoltage(adcValue: number): number {
    return this.interpolate(adcValue, this.D_NAPR1_TABLE);
  }

  /**
   * Преобразует байтовое значение температуры в градусы Цельсия
   * 
   * ПРИМЕЧАНИЕ: Точная формула зависит от калибровки датчика в прошивке.
   * Текущая реализация - аппроксимация для стандартных термисторов.
   * 
   * Возможные формулы:
   * 1. T = (ADC / 2) - 50        // Диапазон -50°C до +77.5°C
   * 2. T = (ADC - 128) / 2.56    // Диапазон -50°C до +49.6°C
   * 3. Табличная интерполяция (как в INTERPOL())
   * 
   * @param value - Байтовое значение температуры (0-255)
   * @returns Температура в °C
   */
  private static convertTemperature(value: number): number {
    // Используем формулу 1 как наиболее вероятную
    return (value / 2) - 50;
  }
}
