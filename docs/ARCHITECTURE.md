# Архитектура проекта Панцирь

## Обзор

Мобильное диагностическое приложение для БСКУ с Bluetooth подключением (протокол v1.0, 22-байтовый формат).

## Технологический стек

**Frontend:** React 18 + TypeScript 5 + Vite + Tailwind CSS + shadcn/ui  
**Mobile:** Capacitor 7 + Кастомный Bluetooth Serial Plugin (Kotlin)  
**State:** TanStack Query + React State

## Структура кода

```
src/
├── components/diagnostics/  # UI компоненты диагностики
├── pages/                   # Страницы (Index, SystemSelect, Diagnostics, etc.)
├── utils/                   # Сервисы (bluetooth, parsers, logs)
├── types/                   # TypeScript типы
└── hooks/                   # React hooks
```

## Архитектурные паттерны

**Service Layer:** CapacitorBluetoothService → NativeBluetoothWrapper → BluetoothSerialPlugin  
**Parser Pattern:** ProtocolParser (кадры) → Screen4Parser (данные)  
**Observer:** LogService (pub/sub), HEX frames callbacks  
**Singleton:** Экспорт сервисов как singleton

## Data Flow

```
БСКУ → BT SPP → Native Plugin → Parser → DiagnosticData → UI
```

## Протокол БСКУ v1.0

**Адреса:** DST=0x2A, SRC=0xF1  
**Payload:** 22 байта (u8 ADC)  
**Формула:** V = ADC*30/255

**Инициализация:**
1. Connect + 200ms delay
2. StartDiagnosticSession (0x10)
3. 200ms delay  
4. StartCommunication (0x81)
5. TesterPresent каждые 1.5с
6. ReadData каждую 1с

Подробнее см. README.md и docs/PROTOCOL_SPECIFICATION_v1.0.md
