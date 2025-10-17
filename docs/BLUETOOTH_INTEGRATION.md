# Интеграция Bluetooth для БСКУ Панцирь

## 📡 Обзор

Приложение поддерживает двойную интеграцию Bluetooth для максимальной совместимости:
- **Web Bluetooth API** - для браузеров Chrome на Android
- **Capacitor Bluetooth LE** - для нативных мобильных приложений (iOS/Android)

## 🔧 Архитектура

### Bluetooth Сервисы

1. **`bluetooth.ts`** - Web Bluetooth API (браузер)
2. **`capacitor-bluetooth.ts`** - Capacitor Bluetooth LE (нативные платформы)
3. **`bluetooth-parser.ts`** - Парсер данных от БСКУ

### Структура Bluetooth Пакета

Согласно прошивке `Pantcir_koval-3.c`:

```
┌─────────┬────────┬────────┬──────────────┬──────────┐
│ Header  │ Screen │ Length │     Data     │ Checksum │
│  0x88   │  0xF1  │  N     │  N bytes     │   CRC    │
└─────────┴────────┴────────┴──────────────┴──────────┘
```

**Байты данных (Data):**

| Байт | Параметр | Описание |
|------|----------|----------|
| 0 | U_U_UM1 | Напряжение конденсатора (ADC) |
| 1 | U_U_UM2 | Напряжение испарителя (ADC) |
| 2 | U_U_UM3 | Напряжение компрессора (ADC) |
| 3 | U_U_FU | Эталонное напряжение питания 27В |
| 4 | uUPR_BT | Управление реле (M1-M5, CMP) |
| 5 | uUPR_IND | Управление индикацией (IND1-IND4) |
| 6 | sDAT_BIT | Статусные биты |
| 7 | work_rej_cmp | Режим работы компрессора |
| 8 | vdlt_cnd_i | Падение напряжения конденсатора |
| 9 | vdlt_isp_i | Падение напряжения испарителя |
| 10 | vdlt_cmp_i | Падение напряжения компрессора |
| 11 | timer_off | Таймер отключения |
| 12 | work_rej_cnd | Режим работы конденсатора |
| 13 | work_rej_isp | Режим работы испарителя |
| 14 | edlt_cnd_i | Заданное падение (конд.) |
| 15 | edlt_isp_i | Заданное падение (исп.) |
| 16 | edlt_cmp_i | Заданное падение (комп.) |
| 17 | n_V_cnd | Количество активных вент. конденсатора |
| 18 | PWM_spd | Скорость ШИМ (1=медленно, 2=быстро) |
| 19 | s1_TMR2 | Длительность высокого уровня ШИМ |
| 20 | s0_TMR2 | Длительность низкого уровня ШИМ |
| 21 | T_air | Температура воздуха |
| 22 | T_isp | Температура испарителя |
| 23 | U_davl | Датчик давления (0-255) |
| 24 | iSOST_UPR1 | Статус управления 1 |
| 25 | iSOST_UPR2 | Статус управления 2 |

### Статусные биты (sDAT_BIT)

| Бит | Флаг | Описание |
|-----|------|----------|
| 0 | bD_DAVL | Датчик давления |
| 1 | bVKL_CMP | Компрессор включен |
| 2 | bBL_2 | Тип системы (0=SKA, 1=SKE) |
| 3 | bK_NORM | Норма конденсатора |
| 4 | bFTD_NORM | Норма фотодатчика |
| 5 | bBL2_1vnt | 1 вентилятор испарителя |
| 6 | bNO_V_CMP | Нет вентилятора компрессора |

### Управление реле (uUPR_BT)

| Бит | Реле | Описание |
|-----|------|----------|
| 0 | uUP_M1 | Реле вентилятора конденсатора 1 |
| 1 | uUP_M2 | Реле вентилятора конденсатора 2 |
| 2 | uUP_M3 | Реле вентилятора конденсатора 3 (только SKA) |
| 3 | uUP_M4 | Реле вентилятора испарителя 1 |
| 4 | uUP_M5 | Реле вентилятора испарителя 2 |
| 5 | uUP_CMP | Реле компрессора |

### Статусы ошибок (iSOST_UPR1, iSOST_UPR2)

**iSOST_UPR1:**
| Бит | Флаг | Описание |
|-----|------|----------|
| 0 | zmk_V_isp1 | Замыкание вентилятора испарителя |
| 1 | obr_V_isp1 | Обрыв вентилятора испарителя |
| 2 | zmk_V_knd1 | Замыкание вентилятора конденсатора |
| 3 | obr_V_knd1 | Обрыв вентилятора конденсатора |

**iSOST_UPR2:**
| Бит | Флаг | Описание |
|-----|------|----------|
| 0 | zmk_COMP | Замыкание компрессора |
| 1 | obr_COMP | Обрыв компрессора |

## 📊 Преобразование данных

### Напряжение
```typescript
voltage = (ADC_value / 255) * 30V
```

### Температура
```typescript
temperature = (ADC_value / 2) - 50  // Диапазон -50°C до +50°C
```

### Давление
```typescript
pressure_percent = (U_davl / 255) * 100
```

## 🔌 Использование

### Web Bluetooth (браузер)

```typescript
import { bluetoothService } from '@/utils/bluetooth';

// Подключение
const connected = await bluetoothService.connect('SKA');

// Запрос данных
await bluetoothService.requestDiagnosticData();

// Получение данных
const data = bluetoothService.getLatestData();
```

### Capacitor Bluetooth (мобильное приложение)

```typescript
import { capacitorBluetoothService } from '@/utils/capacitor-bluetooth';

// Подключение
const connected = await capacitorBluetoothService.connect('SKE');

// Запрос данных
await capacitorBluetoothService.requestDiagnosticData();

// Получение данных
const data = capacitorBluetoothService.getLatestData();
```

### Автоматический выбор сервиса

```typescript
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();
const service = isNative ? capacitorBluetoothService : bluetoothService;

const connected = await service.connect(systemType);
```

## 🎯 Формат данных DiagnosticData

```typescript
interface DiagnosticData {
  // Токи измерения
  UP_M1: number;  // Конденсатор
  UP_M2: number;  // Испаритель
  UP_M3: number;  // Компрессор
  UP_M4: number;  // Доп. канал
  UP_M5: number;  // Питание вентиляторов
  
  // Падения напряжения
  dUP_M1: number;
  dUP_M2: number;
  dUP_M3: number;
  
  // Температуры
  T_air: number;   // °C
  T_isp: number;   // °C
  T_kmp?: number;  // °C (опционально)
  
  // Напряжение и давление
  U_nap: number;   // V
  U_davl: number;  // 0-255
  
  // Количество вентиляторов
  kUM1_cnd: number; // Всего конденсатора
  kUM2_isp: number; // Всего испарителя
  kUM3_cmp: number; // Всего компрессора
  
  // Активные вентиляторы
  n_V_cnd: number;
  n_V_isp: number;
  n_V_cmp: number;
  
  // Скорость PWM
  PWM_spd: 1 | 2;  // 1=медленно, 2=быстро
  
  // Детальные статусы вентиляторов
  condenserFans: FanStatus[];
  evaporatorFans: FanStatus[];
  compressorFans: FanStatus[];
  
  // Статусы компонентов
  compressorStatus: ComponentStatus;
  condenserStatus: ComponentStatus;
  evaporatorStatus: ComponentStatus;
  pressureSensorStatus: ComponentStatus;
  softStartStatus: ComponentStatus;
  
  // Детальная диагностика
  zmk_V_isp1: boolean;  // Замыкание испарителя
  obr_V_isp1: boolean;  // Обрыв испарителя
  zmk_V_knd1: boolean;  // Замыкание конденсатора
  obr_V_knd1: boolean;  // Обрыв конденсатора
  zmk_COMP: boolean;    // Замыкание компрессора
  obr_COMP: boolean;    // Обрыв компрессора
  
  // Режимы работы
  work_rej_cnd: number; // 0=выкл, 1=пуск, 2=работа, 10=стоп
  work_rej_isp: number;
  work_rej_cmp: number;
  
  // Предохранители
  fuseEtalon: boolean;    // Pr1
  fuseCondenser: boolean; // Pr2
  fuseEvaporator: boolean;// Pr3
  fuseCompressor: boolean;// Pr4
  
  // Тип системы
  systemType: 'SKA' | 'SKE';
  
  // Режим работы
  mode: 'cooling' | 'ventilation' | 'standby' | 'error';
  
  // Статус системы
  sSTATUS: number;
  
  // Ошибки
  errors: DiagnosticError[];
}
```

## ⚙️ Конфигурация систем

### SKA (Система кондиционирования аппаратуры)
- **Вентиляторы конденсатора**: 3 (M1, M2, M3)
- **Вентиляторы испарителя**: 1-2
- **Вентиляторы компрессора**: 1

### SKE (Система кондиционирования экипажа)
- **Вентиляторы конденсатора**: 2 (M1, M2)
- **Вентиляторы испарителя**: 1-2
- **Вентиляторы компрессора**: 1

## 🔍 Отладка

### Логирование
Все Bluetooth операции логируются в консоль:
```javascript
console.log('Bluetooth connected successfully');
console.log('Diagnostic data received:', data);
console.warn('Invalid packet header');
console.warn('Checksum mismatch');
```

### Проверка подключения
```typescript
if (service.isConnected()) {
  console.log('Connected to БСКУ');
} else {
  console.log('Not connected');
}
```

### Mock данные
Для тестирования без реального устройства:
```typescript
const mockData = service.getMockData('SKA');
```

## 🚀 Развертывание

### Для Web (браузер)
1. Используйте Chrome на Android
2. Убедитесь, что Bluetooth включен
3. Сайт должен использовать HTTPS

### Для мобильных приложений
1. Соберите APK/IPA согласно `MOBILE_BUILD.md`
2. Установите приложение
3. Разрешите доступ к Bluetooth

## ⚠️ Известные ограничения

1. **Web Bluetooth** работает только в Chrome на Android
2. **iOS Web** не поддерживает Web Bluetooth API (требуется нативное приложение)
3. **Desktop** Web Bluetooth поддерживается частично (только Chrome/Edge)

## 📝 Ссылки

- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Capacitor Bluetooth LE](https://github.com/capacitor-community/bluetooth-le)
- [Nordic UART Service](https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/libraries/bluetooth_services/services/nus.html)
