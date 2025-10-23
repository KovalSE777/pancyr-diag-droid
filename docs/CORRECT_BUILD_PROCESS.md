# ✅ Правильный процесс сборки APK

## 🎯 Проблемы найденные в pancyr-build-2.sh

### 1. ❌ Base64 несовместимость
- **write()** использовал `Base64.DEFAULT` (с переносами строк)
- **startReader()** использовал `Base64.NO_WRAP`
- **Результат**: данные ломались при передаче
- **Решение**: везде использовать `Base64.NO_WRAP`

### 2. ❌ Разрешения не запрашивались
- Android 6-11 требует `ACCESS_FINE_LOCATION` для discovery
- Проверка была, но разрешение не запрашивалось
- **Результат**: пустой список устройств при сканировании
- **Решение**: добавлен запрос разрешений в `scanPerms()`

### 3. ❌ Скрипт перезаписывал плагин
- Строки 225-300 создавали упрощённый плагин
- Терялись все улучшения (discovery, логи, обработка ошибок)

---

## ✅ Правильный процесс сборки

### Вариант A: Ручная сборка (рекомендуется)

```bash
# 1. Клонируем проект
git clone https://github.com/KovalSE777/pancyr-diag-droid.git
cd pancyr-diag-droid

# 2. Устанавливаем зависимости
npm ci

# 3. Собираем веб-версию
npm run build

# 4. Копируем ПРАВИЛЬНЫЕ Java-файлы
mkdir -p android/app/src/main/java/app/lovable/ba41ab0de47a46879e70cd17cee4dfd3/bt
cp BluetoothSerialPlugin.java android/app/src/main/java/app/lovable/ba41ab0de47a46879e70cd17cee4dfd3/bt/
cp MainActivity.java android/app/src/main/java/app/lovable/ba41ab0de47a46879e70cd17cee4dfd3/

# 5. Синхронизируем с Android
npx cap sync android

# 6. Собираем APK
cd android
./gradlew clean
./gradlew :app:assembleDebug  # или assembleRelease

# 7. APK находится в:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Вариант B: Модифицированный скрипт

Если хотите использовать автоматический скрипт, измените строки 176-350 в `pancyr-build-2.sh`:

```bash
patch_android_in_place(){
  log "Копирую ГОТОВЫЕ Java-файлы плагина"
  
  # НЕ генерируем плагин, а копируем готовый
  local PLUG_PKG="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt"
  local PKG_PATH="android/app/src/main/java/app/lovable/ba41ab0de47a46879e70cd17cee4dfd3"
  
  mkdir -p "$PKG_PATH/bt"
  
  # Копируем из корня проекта
  cp BluetoothSerialPlugin.java "$PKG_PATH/bt/" || fail "Не найден BluetoothSerialPlugin.java"
  cp MainActivity.java "$PKG_PATH/" || fail "Не найден MainActivity.java"
  
  log "✅ Java-файлы скопированы"
}
```

---

## 🔍 Проверка правильности сборки

После сборки проверьте:

### 1. Плагин зарегистрирован
```bash
npx cap run android -l
```

В логах должно быть:
```
MainActivity: 🔌 Registering BluetoothSerialPlugin...
MainActivity: ✅ BluetoothSerialPlugin registered!
```

### 2. Сканирование работает
В логах при нажатии "Scan":
```
BTSerial: 🔍 scan() called
BTSerial: 📍 Android 6-11 - requesting fineLocation
BTSerial: 🔓 Permissions granted, retrying scan
BTSerial: ✅ Found 2 bonded devices
BTSerial:   📱 HC-05 [00:11:22:33:44:55]
BTSerial: 🔎 Discovery started: true
BTSerial: ✅ Scan complete - found 2 devices total
```

### 3. Подключение работает
```
BTSerial: 🔌 connect() to 00:11:22:33:44:55
BTSerial: ✅ Connected successfully
```

### 4. Передача данных
```
BTSerial: ✅ Wrote 22 bytes
```

---

## 📋 Чеклист перед сборкой

- [ ] `appId` в `capacitor.config.ts` = `app.lovable.ba41ab0de47a46879e70cd17cee4dfd3`
- [ ] `package` в `MainActivity.java` = `app.lovable.ba41ab0de47a46879e70cd17cee4dfd3`
- [ ] `package` в `BluetoothSerialPlugin.java` = `app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt`
- [ ] В `AndroidManifest.xml` есть все разрешения Bluetooth + `ACCESS_FINE_LOCATION`
- [ ] `Base64.NO_WRAP` используется везде в плагине
- [ ] `server.url` закомментирован в `capacitor.config.ts` (для standalone APK)

---

## 🐛 Если всё ещё не работает

1. **Очистите всё**:
```bash
cd android
./gradlew clean
cd ..
rm -rf android
npx cap add android
```

2. **Проверьте capacitor.plugins.json**:
```bash
cat android/app/src/main/assets/capacitor.plugins.json
```

Должно быть:
```json
{
  "plugins": [
    {
      "pkg": "app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt",
      "classpath": "app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt.BluetoothSerialPlugin"
    }
  ]
}
```

3. **Проверьте права доступа на устройстве**:
   - Настройки → Приложения → Pancyr Diагностика
   - Разрешения → Bluetooth, Местоположение (для Android 6-11)
