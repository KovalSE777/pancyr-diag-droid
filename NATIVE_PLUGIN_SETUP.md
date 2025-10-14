# Настройка нативного плагина BluetoothSerial для Android

## Проблема
Ошибка: `"BluetoothSerial" plugin is not implemented on android`

## Причина
Кастомный нативный плагин требует дополнительной настройки после выполнения `npx cap sync`.

## Решение

### 1. Убедитесь, что код плагина на месте
Файлы должны быть в проекте:
- `android/app/src/main/java/com/koval/pancyr/bt/BluetoothSerialPlugin.kt`
- `android/app/src/main/java/com/koval/pancyr/MainActivity.kt`

### 2. Выполните синхронизацию
После git pull выполните:
```bash
npm install
npm run build
npx cap sync android
```

### 3. Откройте проект в Android Studio
```bash
npx cap open android
```

### 4. Проверьте структуру пакетов в Android Studio
В Android Studio в папке `app/java/` должна быть структура:
```
com.koval.pancyr
├── MainActivity.kt
└── bt
    └── BluetoothSerialPlugin.kt
```

### 5. Если структура неправильная - пересоздайте файлы вручную:

#### В Android Studio:
1. Правой кнопкой на `app/java/` → New → Package
2. Создайте пакет `com.koval.pancyr.bt`
3. В этом пакете создайте файл `BluetoothSerialPlugin.kt`
4. Скопируйте содержимое из исходного файла проекта

#### Важно! MainActivity.kt должен быть в корне `com.koval.pancyr`:
```kotlin
package com.koval.pancyr

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.koval.pancyr.bt.BluetoothSerialPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(BluetoothSerialPlugin::class.java)
    }
}
```

### 6. Добавьте разрешения в AndroidManifest.xml
Файл: `android/app/src/main/AndroidManifest.xml`

Должен содержать:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### 7. Пересоберите проект
В Android Studio:
- Build → Clean Project
- Build → Rebuild Project

Или через командную строку:
```bash
cd android
./gradlew clean
./gradlew build
cd ..
npx cap run android
```

### 8. Проверка работы плагина
После запуска приложения откройте логи:
```bash
npx cap run android -l
```

Должно появиться сообщение при подключении плагина.

## Альтернативное решение (если проблема сохраняется)

Если плагин все еще не регистрируется, попробуйте:

1. Удалите папку `android/` полностью
2. Выполните:
```bash
npx cap add android
npx cap sync android
```
3. Скопируйте файлы плагина вручную в правильную структуру
4. Откройте проект в Android Studio и выполните Rebuild

## Отладка

Для проверки, что плагин зарегистрирован, добавьте в `BluetoothSerialPlugin.kt` в метод `onCreate`:
```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Log.d("MainActivity", "BluetoothSerialPlugin registered!")
    registerPlugin(BluetoothSerialPlugin::class.java)
}
```

Затем проверьте логи Android через Logcat в Android Studio или через `adb logcat`.

## Важно для Production build

Для финального APK убедитесь, что:
1. В `capacitor.config.ts` закомментирован блок `server` (уже сделано)
2. Выполнен `npm run build` перед `npx cap sync`
3. В Android Studio выбран Build Variant: `release`
