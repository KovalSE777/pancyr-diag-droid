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

### 2. Выполните полную синхронизацию и сборку
После git pull выполните:
```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew clean :app:assembleDebug
cd ..
```

### 3. КРИТИЧНО: Проверьте файл capacitor.plugins.json
Файл: `android/app/src/main/assets/capacitor.plugins.json`

Откройте этот файл и убедитесь, что там есть ваш плагин:
```json
{
  "plugins": [
    {
      "pkg": "com.koval.pancyr.bt",
      "classpath": "com.koval.pancyr.bt.BluetoothSerialPlugin"
    }
  ]
}
```

**Если вашего плагина там нет** - Android его не видит! Причины:
- Неправильный путь к файлу плагина
- Ошибка в аннотации `@CapacitorPlugin`
- Модуль не скомпилировался
- Не совпадают имена в Kotlin и TypeScript

### 4. Проверьте совпадение имён плагина
В файле `android/app/src/main/java/com/koval/pancyr/bt/BluetoothSerialPlugin.kt` 
аннотация должна быть:
```kotlin
@CapacitorPlugin(name = "BluetoothSerial")
class BluetoothSerialPlugin : Plugin() { ... }
```

В файле `src/utils/native-bluetooth.ts` регистрация должна быть:
```typescript
export const BluetoothSerial = registerPlugin<BluetoothSerialPlugin>('BluetoothSerial');
```

**Любое расхождение имён даёт ошибку "not implemented"!**

### 5. Откройте проект в Android Studio
```bash
npx cap open android
```

### 6. Проверьте структуру пакетов в Android Studio
В Android Studio в папке `app/java/` должна быть структура:
```
com.koval.pancyr
├── MainActivity.kt
└── bt
    └── BluetoothSerialPlugin.kt
```

### 7. Если структура неправильная - пересоздайте файлы вручную:

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

### 8. Добавьте разрешения в AndroidManifest.xml
Файл: `android/app/src/main/AndroidManifest.xml`

Должен содержать:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### 9. Пересоберите проект
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

### 10. ВАЖНО: Добавьте отладочные логи в плагин

В файле `android/app/src/main/java/com/koval/pancyr/bt/BluetoothSerialPlugin.kt`
добавьте логи в начало каждого метода:

```kotlin
@PluginMethod
fun connect(call: PluginCall) {
    Log.d("BTSerial", "connect() called, mac=" + call.getString("mac"))
    // ... остальной код
}

@PluginMethod
fun scan(call: PluginCall) {
    Log.d("BTSerial", "scan() called")
    // ... остальной код
}
```

### 11. Проверка работы плагина
После запуска приложения откройте логи:
```bash
npx cap run android -l
```

Или в Android Studio → Logcat.

**Что искать в логах:**
- ✅ `BTSerial: connect() called, mac=XX:XX:XX:XX:XX:XX` - плагин работает!
- ❌ Если этих логов нет при нажатии кнопки - значит вызывается веб-заглушка
- ❌ Проверьте совпадение имён и файл `capacitor.plugins.json`

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

## Отладка - пошаговая диагностика

### Шаг 1: Проверьте регистрацию в MainActivity
В `MainActivity.kt` должен быть лог:
```kotlin
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("MainActivity", "Registering BluetoothSerialPlugin...")
        registerPlugin(BluetoothSerialPlugin::class.java)
        Log.d("MainActivity", "BluetoothSerialPlugin registered!")
    }
}
```

### Шаг 2: Проверьте файл capacitor.plugins.json
```bash
cat android/app/src/main/assets/capacitor.plugins.json
```
Если файла нет или плагина там нет - выполните заново `npx cap sync android` и `./gradlew clean :app:assembleDebug`.

### Шаг 3: Проверьте аннотацию плагина
В `BluetoothSerialPlugin.kt` должно быть:
```kotlin
@CapacitorPlugin(name = "BluetoothSerial",
    permissions = [
        Permission(strings=[Manifest.permission.BLUETOOTH_CONNECT], alias="btConnect"),
        Permission(strings=[Manifest.permission.BLUETOOTH_SCAN], alias="btScan")
    ])
class BluetoothSerialPlugin : Plugin() { ... }
```

### Шаг 4: Добавьте логи в методы плагина
```kotlin
@PluginMethod
fun connect(call: PluginCall) {
    Log.d("BTSerial", "✅ connect() called! mac=" + call.getString("mac"))
    // ...
}
```

### Шаг 5: Запустите с логами
```bash
npx cap run android -l
```

**В логах ищите:**
1. `MainActivity: Registering BluetoothSerialPlugin...` - плагин регистрируется
2. `BTSerial: ✅ connect() called!` - метод плагина вызван
3. Если этих логов нет - плагин не работает, используется веб-заглушка

## Важно для Production build

Для финального APK убедитесь, что:
1. В `capacitor.config.ts` закомментирован блок `server` (уже сделано)
2. Выполнен `npm run build` перед `npx cap sync`
3. В Android Studio выбран Build Variant: `release`
