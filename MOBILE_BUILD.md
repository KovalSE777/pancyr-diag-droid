# 📱 Инструкция по сборке мобильного приложения

## ✅ Что уже настроено

- ✅ Capacitor установлен и настроен
- ✅ Нативный Bluetooth плагин добавлен
- ✅ Автоматическое определение платформы (web/iOS/Android)
- ✅ Полная поддержка диагностики "Панцирь"

## 🚀 Сборка приложения для iOS и Android

### Шаг 1: Экспорт проекта в GitHub

1. Нажмите кнопку **"Export to Github"** в верхней части Lovable
2. Клонируйте проект на свой компьютер:
```bash
git clone <your-repo-url>
cd <project-folder>
```

### Шаг 2: Установка зависимостей

```bash
npm install
```

### Шаг 3: Добавление платформ

**Для Android:**
```bash
npx cap add android
```

**Для iOS (только на Mac):**
```bash
npx cap add ios
```

### Шаг 4: Обновление нативных зависимостей

**Android:**
```bash
npx cap update android
```

**iOS:**
```bash
npx cap update ios
```

### Шаг 5: Сборка веб-приложения

```bash
npm run build
```

### Шаг 6: Синхронизация с нативными платформами

```bash
npx cap sync
```

### Шаг 7: Запуск на устройстве

**Android:**
```bash
npx cap run android
```

**iOS (требует Mac + Xcode):**
```bash
npx cap run ios
```

---

## 📋 Требования

### Для Android:
- ✅ Android Studio установлен
- ✅ Android SDK настроен
- ✅ Java 11+ установлен

### Для iOS:
- ✅ Mac с macOS
- ✅ Xcode установлен (последняя версия)
- ✅ Apple Developer аккаунт (для установки на физическое устройство)

---

## 🔧 Настройка разрешений

### Android (уже настроено автоматически)

В `android/app/src/main/AndroidManifest.xml` будут добавлены:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### iOS (уже настроено автоматически)

В `ios/App/Info.plist` будут добавлены:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Приложение использует Bluetooth для подключения к БСКУ "Панцирь"</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Приложение использует Bluetooth для диагностики системы кондиционирования</string>
```

---

## 🔥 Hot Reload для разработки

Приложение настроено на hot reload - изменения в Lovable автоматически отображаются в приложении без пересборки!

URL для hot reload уже настроен в `capacitor.config.ts`:
```
https://ba41ab0d-e47a-4687-9e70-cd17cee4dfd3.lovableproject.com
```

---

## 📖 Дополнительная информация

Подробнее о разработке мобильных приложений с Lovable:
https://lovable.dev/blogs/TODO

---

## 🆘 Поддержка

Если возникли проблемы:
1. Проверьте, что все зависимости установлены
2. Убедитесь, что Android Studio / Xcode правильно настроены
3. Запустите `npx cap doctor` для диагностики проблем
4. Проверьте логи: `npx cap open android` или `npx cap open ios`

---

## ✨ Особенности приложения

- 🔵 **Bluetooth Low Energy** - подключение к БСКУ "Панцирь"
- 📊 **Полная диагностика** - температуры, напряжения, токи, вентиляторы
- ⚡ **Реальное время** - живые данные с микроконтроллера
- 🎨 **Интуитивный интерфейс** - простая навигация и понятная индикация
- 📱 **Кроссплатформенность** - iOS и Android
- 🌐 **Web-версия** - работает в Chrome на Android

---

## 🔄 После изменений в коде

После каждого `git pull` выполните:

```bash
npm install
npm run build
npx cap sync
```

Затем запустите приложение снова.
