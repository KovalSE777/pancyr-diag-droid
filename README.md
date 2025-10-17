# Панцирь - Диагностическое приложение для БСКУ

Профессиональная система диагностики для блоков управления кондиционированием СКА (Система Кондиционирования Аппаратуры) и СКЭ (Система Кондиционирования Экипажа).

## 🎯 Основные возможности

- **Bluetooth диагностика** - Подключение к БСКУ через Bluetooth SPP (Android)
- **Мониторинг в реальном времени** - Отображение параметров работы системы с частотой 1 Гц
- **Анализ ошибок** - Детальная диагностика неисправностей с рекомендациями по устранению
- **База знаний** - Руководство по ремонту с пошаговыми инструкциями
- **Live HEX монитор** - Просмотр протокола обмена в реальном времени

## 🚀 Технологии

### Frontend
- **React 18** + **TypeScript 5** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** для управления состоянием

### Mobile
- **Capacitor 7** - Нативная обертка для Android
- **Bluetooth Serial Plugin** - Кастомный нативный плагин

### Протокол
- **UDS-like protocol** - UDS-подобный протокол (адреса 0x2A/0xF1)
- **22-байтовый payload** - Оптимизированный формат данных (ТЗ v1.0 от 17.10.2025)

## 📱 Поддерживаемые платформы

- ✅ **Android** - Основная платформа (Bluetooth Serial SPP)
- ⚠️ **Web** - Ограниченная поддержка (Web Bluetooth не поддерживает SPP)
- ⚠️ **iOS** - Требует доработки Bluetooth

## 🛠 Быстрый старт

### Разработка (веб-версия)

```bash
npm install
npm run dev
```

Откройте http://localhost:8080

### Android сборка для разработки

```bash
# 1. Установка зависимостей
npm install

# 2. Сборка проекта
npm run build

# 3. Синхронизация с Capacitor
npx cap sync android

# 4. Запуск в Android Studio
npx cap open android
```

### Production APK

**ВАЖНО**: Перед production сборкой:

1. В `capacitor.config.ts` **закомментируйте** секцию `server`
2. Соберите проект: `npm run build`
3. Синхронизируйте: `npx cap sync android`
4. Подпишите APK в Android Studio (Build → Generate Signed Bundle/APK)

## 📖 Структура проекта

```
src/
├── components/
│   ├── diagnostics/          # Компоненты диагностики
│   │   ├── ComponentIndicator.tsx
│   │   ├── FanIndicator.tsx
│   │   ├── FuseIndicator.tsx
│   │   ├── LiveHexMonitor.tsx
│   │   ├── SoftStartSignals.tsx
│   │   └── TestModeControl.tsx
│   └── ui/                   # shadcn UI компоненты
│
├── pages/
│   ├── Index.tsx            # Главная страница
│   ├── SystemSelect.tsx     # Выбор системы (СКА/СКЭ)
│   ├── BluetoothConnect.tsx # Подключение Bluetooth
│   ├── Diagnostics.tsx      # Экран диагностики
│   └── RepairGuide.tsx      # База знаний
│
├── utils/
│   ├── capacitor-bluetooth.ts    # Главный Bluetooth сервис
│   ├── native-bluetooth.ts       # Обертка нативного плагина
│   ├── protocol-parser.ts        # Парсер протокола (UDS, 0x66, 0x77)
│   ├── screen4-parser.ts         # Парсер телеметрии (22 байта)
│   ├── bluetooth-constants.ts    # Константы протокола
│   └── log-service.ts            # Система логирования
│
├── types/
│   └── bluetooth.ts         # TypeScript типы
│
└── android/                 # Нативный Android код
    └── app/src/main/java/com/koval/pancyr/bt/
        └── BluetoothSerialPlugin.kt
```

## 🔌 Протокол БСКУ (v1.0)

### Адресация
- **BSKU**: 0x2A (адрес устройства)
- **Tester**: 0xF1 (адрес приложения)
- **Транспорт**: Bluetooth SPP (UUID: 00001101-0000-1000-8000-00805F9B34FB)

### Последовательность инициализации
```
1. Connect
2. Пауза 200ms
3. StartDiagnosticSession (0x10 0x01) → Response 0x50
4. Пауза 200ms
5. StartCommunication (0x81) → Response 0xC1
6. TesterPresent (0x3E 0x01) - каждые 1.5 сек
7. ReadDataByIdentifier (0x21 0x01) - каждую 1 сек
```

### Формат ответа 0x21 0x01 (телеметрия)

**Полный кадр (28 байт):**
```
[0]    HDR: 0x80 + len (0x9B для 27 байт тела)
[1]    DST: 0xF1 (приложение)
[2]    SRC: 0x2A (БСКУ)
[3]    SID: 0x61 (положительный ответ)
[4]    ID:  0x01 (LocalIdentifier)
[5-26] DATA: 22 байта payload
[27]   CHK: Контрольная сумма
```

**Payload (22 байта - Data[0]...Data[21]):**
```
[0]  U_U_UM1      - Напряжение М1 (ADC 0-255)
[1]  U_U_UM2      - Напряжение М2
[2]  U_U_UM3      - Напряжение М3
[3]  U_U_FU       - Напряжение питания (~27V)
[4]  uUPR_BT      - Битовая маска управления реле
[5]  uUPR_IND     - Битовая маска предохранителей
[6]  sDAT_BIT     - Битовая маска статусов
[7]  work_rej_cmp - Режим работы компрессора
[8]  vdlt_cnd_i   - Падение U конденсатор
[9]  vdlt_isp_i   - Падение U испаритель
[10] vdlt_cmp_i   - Падение U компрессор
[11] timer_off    - Таймер отключения
[12] rej_cnd      - Режим конденсатор
[13] rej_isp      - Режим испаритель
[14] edlt_cnd     - Порог конденсатор
[15] edlt_isp     - Порог испаритель
[16] edlt_cmp     - Порог компрессор
[17] n_V_cnd      - Активные вентиляторы конденсатора
[18] PWM_spd      - Скорость PWM (1=медленно, 2=быстро)
[19] s1_TMR2      - HIGH период PWM
[20] s0_TMR2      - LOW период PWM
[21] t_v_razg_cnd - Время разгона
```

### Формулы конвертации
```typescript
voltage = (ADC * 30) / 255    // Вольты (0-30V)
temperature = (ADC / 2) - 50  // Градусы Цельсия
pressure = (ADC * 100) / 255  // Проценты
```

### Служебные кадры
- **0x66**: SCR_x (экран) → Ответ: ASCII "UOKS" + байт номера экрана
- **0x77**: Конфигурация → Ответ: ASCII "UOKP" + байт номера пакета

## 🔧 Отладка

### Логирование
Все TX/RX кадры логируются в `LogService`:
```typescript
import { logService } from '@/utils/log-service';

logService.info('BT-TX', 'Отправка команды');
logService.success('BT-RX', 'Получен ответ');
```

### Live HEX монитор
Включите компонент `LiveHexMonitor` на странице диагностики для просмотра всех кадров в реальном времени.

### Android Native логи
```bash
adb logcat | grep BluetoothSerial
```

## 📐 Архитектура

### Service Layer
```typescript
CapacitorBluetoothService
  ├─ NativeBluetoothWrapper (обертка плагина)
  ├─ ProtocolParser (парсинг кадров)
  └─ Screen4Parser (извлечение данных)
```

### Data Flow
```
BSKU → Bluetooth SPP → Native Plugin → NativeBluetoothWrapper 
  → ProtocolParser → Screen4Parser → DiagnosticData → UI
```

## 🧪 Тестирование

### Mock данные
Для тестирования без устройства:
```typescript
// src/pages/BluetoothConnect.tsx
const mockData = capacitorBluetoothService.getMockData('SKA');
```

### Проверка протокола
1. Подключитесь к устройству
2. Откройте DevTools (если веб) или logcat (Android)
3. Проверьте последовательность команд (0x10 → 0x81 → 0x3E → 0x21)
4. Убедитесь что payload = 22 байта

## 📄 Документация

- **ARCHITECTURE.md** - Детальная архитектура проекта
- **PROTOCOL_ANALYSIS_DETAILED_v2.md** - Полный анализ протокола v1.0
- **COMPLETE_VERIFICATION_REPORT.md** - Отчет о соответствии ТЗ
- **BLUETOOTH_INTEGRATION.md** - Интеграция Bluetooth
- **MOBILE_BUILD.md** - Сборка для мобильных платформ

## 🔐 Безопасность

- Все Bluetooth соединения защищены на уровне ОС (PIN: 1234)
- Нет хранения чувствительных данных
- Логи содержат только техническую информацию
- Приложение работает локально (без внешних серверов)

## 🐛 Известные ограничения

1. **Web Bluetooth не поддерживает SPP** - Веб-версия ограничена
2. **iOS требует доработки** - Bluetooth Serial недоступен без дополнительного плагина
3. **Только 22-байтовый формат** - Расширенный формат (26-33 байта) опционален

## 📝 Changelog

### v1.0 (17.10.2025)

**Критические изменения протокола:**
- ✅ UDS адреса обновлены: 0x28/0xF0 → 0x2A/0xF1
- ✅ Формат payload: 33 байта → 22 байта (новая прошивка)
- ✅ ADC формат: u16 → u8 с формулой V = ADC*30/255
- ✅ StartDiagnosticSession (0x10) добавлен перед 0x81
- ✅ Задержки 200ms после connect и между командами
- ✅ Удален deprecated формат 0x88 (телеметрия)
- ✅ Прямое чтение битовых полей (uUPR_BT, sDAT_BIT)

**Документация:**
- ✅ Полное соответствие ТЗ v1.0 от 17.10.2025
- ✅ Актуализированы все маппинги и формулы
- ✅ Удалена устаревшая документация

## 👥 Разработка

### Требования
- Node.js 18+
- Android Studio (для Android сборки)
- Java 17+ (для Capacitor)

### Git workflow
```bash
# Клонирование
git clone <repo-url>

# Установка
npm install

# Разработка
npm run dev

# Сборка
npm run build
```

## 📄 Лицензия

Proprietary - All rights reserved

---

**Версия:** 1.0  
**Дата:** 17.10.2025  
**Протокол:** v1.0 (22-байтовый формат)  
**Прошивка БСКУ:** v1.0+
