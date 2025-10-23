# 🔧 Исправления для pancyr-build-FIXED.sh

## 🔴 Найденные проблемы:

### 1. Конфликт Kotlin vs Java
**Проблема**: В проекте были 2 версии плагина:
- `com.koval.pancyr` (Kotlin) - старая версия
- `app.lovable.ba41ab0de47a46879e70cd17cee4dfd3` (Java) - правильная версия

**Решение**: Удалены Kotlin файлы из `android/app/src/main/java/com/koval/pancyr/`

### 2. Неправильный формат capacitor.plugins.json (строка 212-218)
**Проблема**: Capacitor 7 требует другой формат

**Исправить строку 212-218:**
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

### 3. ACCESS_FINE_LOCATION с maxSdkVersion (строка 242)
**Проблема**: `maxSdkVersion="30"` блокирует права на Android 6-11

**Исправить строку 241-242:**
```bash
grep -q 'android.permission.ACCESS_FINE_LOCATION' "$MAN" || \
  sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' "$MAN"
```

### 4. Проверка capacitor.config.json (строка 176-182)
**Проблема**: Возможны пробелы/табы при парсинге JSON

**Исправить строку 178-179:**
```bash
APP_ID="$(grep -oP '"appId"\s*:\s*"\K[^"]+' "$CFG_JSON" | head -n1)"
```

---

## ✅ Исправленная версия ensure_bt_plugin():

```bash
ensure_bt_plugin(){
  log "Android: КОПИРУЮ MainActivity + BluetoothSerial с GitHub"
  cd "$APP_DIR" || fail "Нет каталога проекта: $APP_DIR"
  [ -d android ] || fail "android/ не найден"

  local CFG_JSON="android/app/src/main/assets/capacitor.config.json"
  local APP_ID=""
  if [ -f "$CFG_JSON" ]; then
    APP_ID="$(grep -oP '"appId"\s*:\s*"\K[^"]+' "$CFG_JSON" | head -n1)"
  fi
  [ -n "$APP_ID" ] || APP_ID="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3"
  local APP_PKG_DIR="${APP_ID//.//}"

  local MAIN_ACTIVITY_JAVA="android/app/src/main/java/${APP_PKG_DIR}/MainActivity.java"
  local PLUGIN_JAVA="android/app/src/main/java/${APP_PKG_DIR}/bt/BluetoothSerialPlugin.java"
  mkdir -p "android/app/src/main/java/${APP_PKG_DIR}/bt"

  # КОПИРУЕМ готовые файлы с GitHub!
  if [ -f "$APP_DIR/MainActivity.java" ]; then
    log "✅ Копирую MainActivity.java с GitHub"
    cp "$APP_DIR/MainActivity.java" "$MAIN_ACTIVITY_JAVA"
  else
    fail "MainActivity.java не найден в корне проекта!"
  fi

  if [ -f "$APP_DIR/BluetoothSerialPlugin.java" ]; then
    log "✅ Копирую BluetoothSerialPlugin.java с GitHub"
    cp "$APP_DIR/BluetoothSerialPlugin.java" "$PLUGIN_JAVA"
  else
    fail "BluetoothSerialPlugin.java не найден в корне проекта!"
  fi

  # Исправляем package на правильный APP_ID
  sed -i "s|package .*;|package ${APP_ID};|" "$MAIN_ACTIVITY_JAVA"
  sed -i "s|package .*\.bt;|package ${APP_ID}.bt;|" "$PLUGIN_JAVA"
  sed -i "s|import .*\.bt\.BluetoothSerialPlugin;|import ${APP_ID}.bt.BluetoothSerialPlugin;|" "$MAIN_ACTIVITY_JAVA"

  log "✅ Файлы с GitHub скопированы и package исправлен на ${APP_ID}"

  # ✅ ИСПРАВЛЕНО: Capacitor 7 формат
  mkdir -p android/app/src/main/assets
  cat > android/app/src/main/assets/capacitor.plugins.json <<JSON
{
  "plugins": [
    { 
      "pkg": "${APP_ID}.bt",
      "classpath": "${APP_ID}.bt.BluetoothSerialPlugin"
    }
  ]
}
JSON

  # Патчим манифест
  local MAN="android/app/src/main/AndroidManifest.xml"
  [ -f "$MAN" ] || fail "Нет $MAN"

  sed -i "s|android:name=\"com.getcapacitor.BridgeActivity\"|android:name=\"${APP_ID}.MainActivity\"|g" "$MAN"

  awk -v fqcn="${APP_ID}.MainActivity" '
    {
      if ($0 ~ "<activity" && $0 ~ fqcn){
        if ($0 !~ /android:exported=/){
          sub(/<activity /,"<activity android:exported=\"true\" ",$0)
        }
      }
      print
    }' "$MAN" > "$MAN.tmp" && mv "$MAN.tmp" "$MAN"

  # Права BT
  grep -q 'android.permission.BLUETOOTH_CONNECT' "$MAN" || \
    sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />' "$MAN"
  grep -q 'android.permission.BLUETOOTH_SCAN' "$MAN" || \
    sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />' "$MAN"
  # ✅ ИСПРАВЛЕНО: убран maxSdkVersion
  grep -q 'android.permission.ACCESS_FINE_LOCATION' "$MAN" || \
    sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' "$MAN"

  printf 'sdk.dir=%s\n' "$ANDROID_SDK_DIR" > android/local.properties
  if [ -n "${JAVA_HOME:-}" ]; then
    grep -q '^org.gradle.java.home=' android/gradle.properties || \
      echo "org.gradle.java.home=$JAVA_HOME" >> android/gradle.properties
  fi

  ( cd "$APP_DIR" && npx cap sync android )
  
  if [ -f android/app/src/main/assets/capacitor.plugins.json ]; then
    log "✅ capacitor.plugins.json создан"
  fi
}
```

---

## 📋 Чек-лист перед сборкой:

- [x] Удалены Kotlin файлы из `com.koval.pancyr`
- [ ] Исправлен формат `capacitor.plugins.json` (строка 212-218)
- [ ] Убран `maxSdkVersion="30"` из `ACCESS_FINE_LOCATION` (строка 242)
- [ ] В `capacitor.config.ts` используется `appId: app.lovable.ba41ab0de47a46879e70cd17cee4dfd3`
- [ ] Java файлы есть в корне: `MainActivity.java`, `BluetoothSerialPlugin.java`

---

## 🔍 Как проверить после сборки:

```bash
# 1. Проверить что плагин зарегистрирован
adb logcat -c
adb install -r "путь/к/app-debug.apk"
adb logcat | Select-String "MainActivity|BTSerial"

# Должно быть:
# MainActivity: 🔌 Registering BluetoothSerialPlugin...
# MainActivity: ✅ BluetoothSerialPlugin registered!

# 2. При нажатии Scan:
# BTSerial: 🔍 scan() called
# BTSerial: ✅ Found X bonded devices
```
