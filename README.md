# Панцирь - Диагностическое приложение

Профессиональная система диагностики для систем кондиционирования СКА (Система Кондиционирования Аппаратуры) и СКЭ (Система Кондиционирования Экипажа).

## 🎯 Основные возможности

- **Bluetooth диагностика** - Подключение к БСКУ через Bluetooth Serial (Android) или Web Bluetooth (браузер)
- **Мониторинг в реальном времени** - Отображение параметров работы системы
- **Анализ ошибок** - Детальная диагностика неисправностей с рекомендациями по устранению
- **База знаний** - Руководство по ремонту с пошаговыми инструкциями
- **Тестовый режим** - Ручное управление компонентами для диагностики

## 🚀 Технологии

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Mobile**: Capacitor 7 (Android/iOS)
- **Bluetooth**: 
  - Android: Нативный Bluetooth Serial плагин
  - Web: Web Bluetooth API
- **State Management**: TanStack Query

## 📱 Поддерживаемые платформы

- **Android** - Нативное приложение с Bluetooth Serial
- **Web/Desktop** - PWA с Web Bluetooth API
- **iOS** - Через Capacitor (требует доработки Bluetooth)

## 🛠 Установка и запуск

### Веб-версия

```bash
npm install
npm run dev
```

### Android сборка

```bash
# 1. Установите зависимости
npm install

# 2. Соберите проект
npm run build

# 3. Синхронизируйте с Capacitor
npx cap sync android

# 4. Откройте в Android Studio
npx cap open android
```

### Production APK

**ВАЖНО**: Перед сборкой production APK:

1. В `capacitor.config.ts` закомментируйте секцию `server` (уже сделано)
2. Соберите проект: `npm run build`
3. Синхронизируйте: `npx cap sync android`
4. Подпишите APK в Android Studio

## 📖 Структура проекта

```
src/
├── components/
│   ├── diagnostics/      # Компоненты диагностики
│   └── ui/              # UI компоненты (shadcn)
├── pages/
│   ├── Index.tsx        # Главная страница
│   ├── SystemSelect.tsx # Выбор системы (СКА/СКЭ)
│   ├── BluetoothConnect.tsx # Подключение Bluetooth
│   ├── Diagnostics.tsx  # Экран диагностики
│   └── RepairGuide.tsx  # База знаний
├── utils/
│   ├── capacitor-bluetooth.ts # Bluetooth сервис (Android)
│   ├── protocol-parser.ts     # Парсер протокола БСКУ
│   ├── screen4-parser.ts      # Парсер телеметрии
│   ├── native-bluetooth.ts    # Обертка нативного плагина
│   ├── bluetooth-constants.ts # Константы протокола
│   └── log-service.ts         # Система логирования
└── types/
    └── bluetooth.ts     # TypeScript типы
```

## 🔧 Протокол БСКУ

Приложение работает по протоколу, описанному в документации прошивки:
- **UDS команды** - Управление и запрос данных
- **Телеметрия 0x88** - Screen 4 с диагностическими данными
- **Tester Present** - Поддержание соединения (каждые 1.5 сек)
- **Periodic Read** - Запрос данных (каждую 1 сек)

### Основные UDS команды:
- `0x10 0x03` - Start Communication
- `0x3E 0x80` - Tester Present
- `0x21 0x01` - Read Diagnostic Data (Screen 4)

## 📝 Changelog последних изменений

### Оптимизация и рефакторинг

1. **Удалены неиспользуемые файлы:**
   - `src/utils/bluetooth.ts` - Web Bluetooth (не используется в production)
   - `src/utils/bluetooth-parser.ts` - Старый парсер (заменен на screen4-parser)
   - `src/utils/adc-conversion.ts` - Дубликат (используется screen4-parser)
   - `src/utils/checksum.ts` - Дубликат (используется protocol-parser)

2. **Улучшены типы:**
   - SystemType теперь 'SKA' | 'SKE' (верхний регистр)
   - Унифицировано использование типов во всех файлах

3. **Исправлены баги UI:**
   - ComponentIndicator: текст теперь использует семантические цвета (text-foreground/text-muted-foreground вместо text-white)
   - Улучшен контраст в темной теме

4. **Обновлены метаданные:**
   - SEO-оптимизированные теги в index.html
   - Правильные Open Graph теги
   - Русский язык как основной
   - Mobile-оптимизированный viewport

5. **Capacitor конфиг:**
   - Добавлен backgroundColor для splash screen
   - Упрощена конфигурация плагинов
   - Улучшены комментарии для production/development

## 🔐 Безопасность

- Все Bluetooth соединения защищены на уровне ОС
- Нет хранения чувствительных данных
- Логи содержат только техническую информацию

## 📄 Лицензия

Proprietary - All rights reserved

## 👥 Поддержка

Для вопросов и поддержки обращайтесь к разработчикам проекта.

---

**Текущая версия**: 1.0
**Последнее обновление**: 2025-10-14
