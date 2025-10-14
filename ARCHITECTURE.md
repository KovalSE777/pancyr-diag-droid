# Архитектура проекта Панцирь

## Обзор

Панцирь - мобильное диагностическое приложение для систем кондиционирования СКА/СКЭ с Bluetooth подключением к БСКУ (Блок Силовой Коммутации и Управления).

## Технологический стек

### Frontend
- **React 18.3** - UI библиотека
- **TypeScript 5** - Типизация
- **Vite** - Сборщик и dev-сервер
- **React Router 6** - Роутинг
- **TanStack Query 5** - Управление серверным состоянием

### UI/Styling
- **Tailwind CSS 3** - Утилитарный CSS
- **shadcn/ui** - Компонентная библиотека
- **Lucide React** - Иконки
- **class-variance-authority** - Варианты компонентов

### Mobile
- **Capacitor 7** - Native wrapper
- **Android** - Основная платформа (Bluetooth Serial)

## Структура проекта

```
src/
├── components/
│   ├── diagnostics/           # Компоненты страницы диагностики
│   │   ├── ComponentIndicator.tsx    # Индикатор состояния компонента
│   │   ├── DebugLogPanel.tsx        # Панель отладочных логов
│   │   ├── FanIndicator.tsx         # Индикатор вентиляторов
│   │   ├── FuseIndicator.tsx        # Индикатор предохранителей
│   │   ├── LiveHexMonitor.tsx       # Монитор HEX потока
│   │   ├── SoftStartSignals.tsx     # Сигналы УПП
│   │   └── TestModeControl.tsx      # Управление тестовым режимом
│   └── ui/                    # shadcn UI компоненты
│
├── pages/                     # Страницы приложения
│   ├── Index.tsx             # Главная - выбор СКА/СКЭ
│   ├── SystemSelect.tsx      # Информация о системе
│   ├── BluetoothConnect.tsx  # Подключение Bluetooth
│   ├── Diagnostics.tsx       # Основная диагностика
│   ├── RepairGuide.tsx       # База знаний по ремонту
│   └── NotFound.tsx          # 404
│
├── utils/                     # Утилиты
│   ├── capacitor-bluetooth.ts      # Главный Bluetooth сервис
│   ├── native-bluetooth.ts         # Обертка нативного плагина
│   ├── protocol-parser.ts          # Парсер протокола БСКУ
│   ├── screen4-parser.ts           # Парсер телеметрии Screen 4
│   ├── bluetooth-constants.ts      # Константы протокола
│   ├── hex.ts                      # Утилиты для HEX
│   └── log-service.ts              # Сервис логирования
│
├── types/                     # TypeScript типы
│   ├── bluetooth.ts          # Типы диагностических данных
│   └── web-bluetooth.d.ts    # Web Bluetooth типы
│
├── hooks/                     # React хуки
│   ├── use-mobile.tsx        # Определение мобильного устройства
│   └── use-toast.ts          # Toast уведомления
│
└── lib/
    └── utils.ts              # Общие утилиты (cn)
```

## Архитектурные паттерны

### 1. Service Layer Pattern
Bluetooth функциональность инкапсулирована в сервисы:
- `CapacitorBluetoothService` - основной сервис для Android
- `NativeBluetoothWrapper` - обертка над нативным плагином

### 2. Parser Pattern
Протокол БСКУ обрабатывается через парсеры:
- `ProtocolParser` - парсинг кадров 0x88, 0x66, 0x77, UDS
- `Screen4Parser` - извлечение телеметрии из Screen 4

### 3. Observer Pattern
- `LogService` - pub/sub для логов
- `CapacitorBluetoothService` - колбэки для HEX фреймов

### 4. Singleton Pattern
Сервисы экспортируются как синглтоны:
```typescript
export const capacitorBluetoothService = new CapacitorBluetoothService();
export const logService = new LogService();
```

## Поток данных

### Подключение Bluetooth
```
BluetoothConnect.tsx
    ↓
NativeBluetoothWrapper.connect()
    ↓
CapacitorBluetoothService.connectToDeviceId()
    ↓
Native Bluetooth Serial Plugin
    ↓
onBytes() callback → ProtocolParser.feed()
    ↓
Screen4Parser.parse()
    ↓
DiagnosticData → UI
```

### Протокол БСКУ

#### Инициализация соединения
1. **Connection stabilization** - 200ms задержка
2. **UDS Start Communication** `0x81` → БСКУ
3. **Tester Present** каждые 1.5 сек
4. **Read Diagnostic Data** каждую 1 сек

#### Типы кадров
- **0x88** - Телеметрия (Screen 4, 33 байта payload)
- **0x66** - Запрос экрана → ответ UOKS
- **0x77** - Конфигурация → ответ UOKP
- **≥0x80** - UDS команды

#### Screen 4 Payload (33 байта)
```
[0-6]   - маски отображения
[7]     - sim2 (битовые флаги)
[8]     - sim3 (битовые флаги)
[9-10]  - U_U_FU (напряжение питания)
[11-12] - U_U_UM1 (напряжение конденсатора)
...
[32]    - последний байт
```

## Компоненты и их ответственность

### Страницы

**Index.tsx**
- Выбор типа системы (СКА/СКЭ)
- Навигация к подключению или руководству

**BluetoothConnect.tsx**
- Сканирование Bluetooth устройств (Android)
- Подключение к выбранному MAC адресу
- Валидация формата адреса
- Демо режим

**Diagnostics.tsx**
- Отображение live данных
- Мониторинг вентиляторов, предохранителей
- Температуры, напряжения, давление
- HEX монитор потока
- Тестовый режим
- Список ошибок

**RepairGuide.tsx**
- База знаний по ремонту
- Поиск по симптомам
- Категории: предохранители, вентиляторы, компрессор, датчики

### Компоненты диагностики

**ComponentIndicator**
- Универсальный индикатор состояния
- Цветовая индикация: ok (зеленый), error (красный), off (серый)

**FanIndicator**
- Отображение вентиляторов
- Анимация вращения для работающих
- Сообщения об ошибках

**FuseIndicator**
- Визуализация предохранителей
- Предупреждения о перегоревших

**LiveHexMonitor**
- Последние 6 HEX кадров
- TX/RX с временными метками
- Checksum валидация

**DebugLogPanel**
- Лог Bluetooth событий
- Фильтрация по уровню (info, warn, error, success)
- Автоскролл

## Константы и конфигурация

### bluetooth-constants.ts
```typescript
BT_TIMING = {
  CONNECTION_STABILIZATION_DELAY: 200,
  TESTER_PRESENT_INTERVAL: 1500,
  PERIODIC_READ_INTERVAL: 1000,
  UI_POLLING_INTERVAL: 2000,
  REDIRECT_DELAY: 1200,
}

UDS_ADDRESSES = {
  BSKU: 0x28,
  TESTER: 0xF0,
  EXPECTED_DST: 0xF1,
  EXPECTED_SRC: 0x28,
}

DATA_LIMITS = {
  MAX_HEX_FRAMES: 100,
  MAX_LOG_ENTRIES: 100,
}

BT_DEFAULT_PIN = '1234'
```

## Типы данных

### DiagnosticData
Основная структура телеметрии:
- **Напряжения**: UP_M1-M5, U_nap
- **Падения напряжения**: dUP_M1-M3
- **Температуры**: T_air, T_isp, T_kmp
- **Давление**: U_davl
- **Вентиляторы**: массивы FanStatus для каждого типа
- **Предохранители**: fuseEtalon, fuseCondenser, fuseEvaporator, fuseCompressor
- **Сигналы УПП**: signal_SVD, signal_ContactNorm
- **Ошибки**: DiagnosticError[]

### SystemType
```typescript
type SystemType = 'SKA' | 'SKE';
```
- SKA: 2 вентилятора конденсатора
- SKE: 3 вентилятора конденсатора

## Логирование и отладка

### LogService
Централизованное логирование всех событий:
- Bluetooth подключение/отключение
- Получение/отправка кадров
- Ошибки парсинга
- UDS команды

### DebugLogPanel
UI компонент для отображения логов в реальном времени.

## Оптимизации

### Performance
1. **Lazy loading** компонентов UI
2. **Memoization** в парсерах
3. **Throttling** логов (max 100 записей)
4. **Efficient re-renders** через React.memo

### Memory Management
1. Очистка listeners при disconnect
2. Ограничение размера HEX frames (100)
3. Ограничение логов (100)

### Error Handling
1. Валидация MAC адресов
2. Checksum верификация
3. Timeout для подключения
4. Graceful disconnect

## Нативная интеграция

### Android
- **BluetoothSerialPlugin.kt** - нативный Bluetooth Serial
- **MainActivity.kt** - регистрация плагина
- **AndroidManifest.xml** - permissions

### Permissions
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
```

## Build и Deployment

### Development
```bash
npm run dev              # Vite dev server
npx cap run android      # Android emulator/device
```

### Production APK
1. Закомментировать `server.url` в capacitor.config.ts
2. `npm run build`
3. `npx cap sync android`
4. Подписать в Android Studio

## Тестирование

### Mock Data
- `getMockData()` в сервисе
- Доступ через query param `?mock=true`
- Реалистичные физические значения

## Безопасность

1. Bluetooth соединение защищено PIN-кодом
2. Локальное хранение данных (без сервера)
3. Нет передачи чувствительных данных
4. Логи содержат только техническую информацию

## Известные ограничения

1. **iOS** - Bluetooth Serial не поддерживается (требует BLE)
2. **Web** - Web Bluetooth API ограничен (нет Serial)
3. **Только Android** в production версии

## Roadmap

- [ ] BLE поддержка для iOS
- [ ] Экспорт логов диагностики
- [ ] История подключений
- [ ] Сравнение параметров
- [ ] Графики параметров в реальном времени
- [ ] Удаленная диагностика

---

**Версия**: 1.0  
**Последнее обновление**: 2025-10-14
