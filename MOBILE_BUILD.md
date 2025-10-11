# 📱 Полная инструкция по созданию мобильного приложения

## 📋 Что получится в итоге?

После выполнения всех шагов вы получите:
- ✅ **APK файл для Android** - готовый для установки на любой Android телефон
- ✅ **IPA файл для iOS** - готовый для установки на iPhone/iPad (требует Mac)
- ✅ **Полноценное мобильное приложение** с нативным Bluetooth
- ✅ **Возможность распространения** - можете отправить APK друзьям или загрузить в Google Play

---

## 🖥️ ЧАСТЬ 1: Работа на компьютере

### Требования к компьютеру

| Операционная система | Что можно собрать | Что нужно установить |
|---------------------|-------------------|---------------------|
| **Windows** | ✅ Android APK | Node.js, Android Studio, Git |
| **macOS** | ✅ Android APK<br>✅ iOS IPA | Node.js, Android Studio (для Android), Xcode (для iOS), Git |
| **Linux** | ✅ Android APK | Node.js, Android Studio, Git |

---

### Шаг 1: Установка необходимых программ

#### 1.1 Установите Node.js (на всех ОС)

**Windows:**
1. Скачайте Node.js с https://nodejs.org/
2. Запустите установщик
3. Следуйте инструкциям установщика
4. Проверьте установку: откройте командную строку и введите:
   ```bash
   node --version
   npm --version
   ```

**macOS:**
1. Скачайте Node.js с https://nodejs.org/
2. Запустите установщик .pkg
3. Проверьте в Terminal:
   ```bash
   node --version
   npm --version
   ```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

#### 1.2 Установите Git (на всех ОС)

**Windows:**
1. Скачайте Git с https://git-scm.com/download/win
2. Запустите установщик
3. Используйте настройки по умолчанию

**macOS:**
```bash
# Установите Homebrew если еще не установлен
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# Установите Git
brew install git
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install git
```

#### 1.3 Установите Android Studio (для сборки Android APK)

**Все ОС:**
1. Скачайте Android Studio с https://developer.android.com/studio
2. Запустите установщик и следуйте инструкциям
3. При первом запуске выберите "Standard" установку
4. Дождитесь загрузки Android SDK
5. Настройте переменные окружения:

**Windows:**
```bash
# Добавьте в переменные среды (System Properties → Environment Variables):
ANDROID_HOME = C:\Users\ВашеИмя\AppData\Local\Android\Sdk
Path += %ANDROID_HOME%\platform-tools
Path += %ANDROID_HOME%\tools
```

**macOS/Linux:**
Добавьте в `~/.bashrc` или `~/.zshrc`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# или
export ANDROID_HOME=$HOME/Android/Sdk  # Linux

export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

#### 1.4 Установите Xcode (только macOS, для iOS)

1. Откройте App Store на Mac
2. Найдите и установите Xcode (это бесплатно, но весит ~15GB)
3. После установки запустите Xcode
4. Согласитесь с лицензией
5. Установите дополнительные компоненты если попросит

---

### Шаг 2: Получение кода проекта

#### 2.1 Экспортируйте проект в GitHub

1. В Lovable нажмите кнопку **"GitHub"** в правом верхнем углу
2. Нажмите **"Connect to GitHub"**
3. Авторизуйтесь в GitHub
4. Нажмите **"Create Repository"**
5. Скопируйте URL вашего репозитория

#### 2.2 Клонируйте проект на компьютер

**Windows (Git Bash или PowerShell):**
```bash
cd C:\Users\ВашеИмя\Desktop  # или другая папка
git clone https://github.com/ваш-username/ваш-репозиторий.git
cd ваш-репозиторий
```

**macOS/Linux (Terminal):**
```bash
cd ~/Desktop  # или другая папка
git clone https://github.com/ваш-username/ваш-репозиторий.git
cd ваш-репозиторий
```

---

### Шаг 3: Установка зависимостей проекта

В папке проекта выполните:

```bash
npm install
```

Это установит все необходимые библиотеки (может занять 2-5 минут).

---

### Шаг 4: Добавление платформ

#### Для Android:
```bash
npx cap add android
```

Эта команда создаст папку `android/` с нативным Android проектом.

#### Для iOS (только на Mac):
```bash
npx cap add ios
```

Эта команда создаст папку `ios/` с нативным iOS проектом.

---

### Шаг 5: Обновление нативных зависимостей

#### Android:
```bash
npx cap update android
```

#### iOS:
```bash
npx cap update ios
```

---

### Шаг 6: Сборка веб-части приложения

```bash
npm run build
```

Эта команда создаст папку `dist/` с оптимизированными файлами приложения.

---

### Шаг 7: Синхронизация с нативными платформами

```bash
npx cap sync
```

Эта команда скопирует веб-файлы в Android и iOS проекты.

---

## 🏗️ ЧАСТЬ 2: Создание APK файла (Android)

### Вариант A: Debug APK (для тестирования)

#### На Windows:
```bash
cd android
gradlew.bat assembleDebug
```

#### На macOS/Linux:
```bash
cd android
./gradlew assembleDebug
```

**Где найти APK:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Этот файл можно сразу установить на телефон для тестирования.

---

### Вариант B: Release APK (для распространения)

Этот вариант нужен, если вы хотите распространять приложение другим людям.

#### Шаг 1: Создайте ключ для подписи (делается один раз)

**Все ОС:**
```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

Вам будет предложено:
- Придумать пароль (запомните его!)
- Ввести имя и организацию
- Подтвердить информацию

**ВАЖНО:** Сохраните файл `my-release-key.jks` и пароль в надежном месте!

#### Шаг 2: Настройте подпись в Android проекте

Создайте файл `android/key.properties`:
```properties
storePassword=ваш-пароль-от-keystore
keyPassword=ваш-пароль-от-ключа
keyAlias=my-key-alias
storeFile=../my-release-key.jks
```

#### Шаг 3: Обновите `android/app/build.gradle`

Найдите секцию `android {` и добавьте перед ней:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Найдите `buildTypes {` и замените на:

```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
        storePassword keystoreProperties['storePassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

#### Шаг 4: Соберите подписанный APK

**Windows:**
```bash
cd android
gradlew.bat assembleRelease
```

**macOS/Linux:**
```bash
cd android
./gradlew assembleRelease
```

**Где найти APK:**
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📱 ЧАСТЬ 3: Работа на телефоне (Android)

### Установка Debug APK (для тестирования)

#### Способ 1: Через USB кабель

1. **На компьютере:**
   - Подключите телефон к компьютеру USB кабелем
   - Скопируйте файл `app-debug.apk` на телефон (в папку Downloads)

2. **На телефоне:**
   - Откройте файловый менеджер
   - Найдите файл `app-debug.apk`
   - Нажмите на файл
   - Разрешите установку из неизвестных источников (при первой установке)
   - Нажмите "Установить"

#### Способ 2: Через облако (Google Drive, Telegram, и т.д.)

1. Загрузите APK в облако/мессенджер
2. Скачайте на телефон
3. Установите как описано выше

#### Способ 3: Прямая установка через ADB

1. **Включите режим разработчика на телефоне:**
   - Настройки → О телефоне → Номер сборки (тапните 7 раз)
   - Настройки → Система → Для разработчиков → Отладка по USB (включите)

2. **На компьютере:**
   ```bash
   npx cap run android
   ```
   Эта команда автоматически установит и запустит приложение на подключенном телефоне.

---

### Установка Release APK (для распространения)

**Для вас и других пользователей:**

1. Скачайте файл `app-release.apk` на телефон
2. Откройте файл
3. При первой установке:
   - Система попросит разрешить установку
   - Настройки → Безопасность → Неизвестные источники (разрешите для вашего браузера или файлового менеджера)
4. Вернитесь к APK и нажмите "Установить"
5. После установки можете запретить неизвестные источники обратно

**Приложение установится как обычное приложение из Play Store!**

---

## 🍎 ЧАСТЬ 4: Создание IPA файла (iOS, только Mac)

### Требования:
- ✅ Mac с macOS
- ✅ Xcode установлен
- ✅ Apple ID (бесплатный)
- ✅ Физическое iOS устройство или симулятор

### Шаг 1: Откройте проект в Xcode

```bash
npx cap open ios
```

### Шаг 2: Настройте подпись

1. В Xcode выберите проект слева
2. Выберите таргет "App"
3. Вкладка "Signing & Capabilities"
4. Выберите свою команду (Team) - используйте ваш Apple ID
5. Xcode автоматически создаст сертификат

### Шаг 3: Запуск на устройстве

#### Для симулятора:
1. В Xcode выберите симулятор (например, iPhone 15)
2. Нажмите кнопку "Play" (▶️)
3. Приложение запустится в симуляторе

#### Для реального iPhone/iPad:
1. Подключите устройство к Mac
2. Разблокируйте устройство
3. Доверьтесь компьютеру (на iPhone появится диалог)
4. В Xcode выберите ваше устройство
5. Нажмите "Play" (▶️)
6. На iPhone: Настройки → Общие → VPN и управление устройством → Доверьтесь разработчику

### Шаг 4: Создание IPA для распространения

**Важно:** Для распространения iOS приложений нужен платный Apple Developer аккаунт ($99/год).

1. Product → Archive
2. Дождитесь завершения архивации
3. В окне Archives выберите ваш архив
4. Нажмите "Distribute App"
5. Выберите метод распространения:
   - **Development:** для установки на устройства вашей команды
   - **Ad Hoc:** для до 100 устройств (нужны UDID устройств)
   - **App Store:** для публикации в App Store

---

## 🚀 Распространение приложения

### Android

#### Вариант 1: Прямое распространение APK
- ✅ Просто отправьте `app-release.apk` пользователям
- ✅ Они установят его вручную
- ❌ Нужно разрешать неизвестные источники
- ❌ Нет автообновлений

#### Вариант 2: Google Play Store
1. Создайте аккаунт разработчика ($25 единоразово)
2. Создайте приложение в Google Play Console
3. Загрузите APK или AAB файл
4. Заполните описание, скриншоты, иконку
5. Отправьте на проверку
6. После одобрения приложение появится в Play Store
7. ✅ Автоматические обновления для пользователей
8. ✅ Больше доверия

### iOS

#### Вариант 1: TestFlight (бесплатное тестирование)
1. Нужен Apple Developer аккаунт ($99/год)
2. Загрузите сборку в App Store Connect
3. Добавьте тестировщиков (до 10,000 человек)
4. Они установят через приложение TestFlight

#### Вариант 2: App Store
1. Apple Developer аккаунт ($99/год)
2. Загрузите приложение в App Store Connect
3. Пройдите проверку Apple
4. Опубликуйте в App Store

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
