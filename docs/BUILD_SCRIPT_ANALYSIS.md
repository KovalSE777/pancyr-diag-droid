# 🔍 Полный анализ pancyr-build-FIXED-2.sh

## 📋 Оглавление

1. [Общая структура скрипта](#общая-структура-скрипта)
2. [Критические проблемы](#критические-проблемы)
3. [Детальный анализ по секциям](#детальный-анализ-по-секциям)
4. [Точные правки с номерами строк](#точные-правки-с-номерами-строк)
5. [Проверка после сборки](#проверка-после-сборки)

---

## Общая структура скрипта

Скрипт выполняет следующие шаги:

1. **ensure_basics** (стр. 34-46): Проверяет и устанавливает базовые инструменты (git, wget, Java, Node.js)
2. **ensure_android_sdk** (стр. 48-92): Устанавливает/проверяет Android SDK и командные инструменты
3. **sync_repo** (стр. 95-116): Клонирует или обновляет репозиторий с GitHub
4. **build_web** (стр. 119-125): Собирает веб-версию приложения (`npm ci && npm run build`)
5. **ensure_ts_bridge** (стр. 128-150): ⚠️ Генерирует TypeScript мост для плагина
6. **ensure_android_platform** (стр. 153-168): Добавляет Android платформу через Capacitor
7. **ensure_bt_plugin** (стр. 171-255): ⚠️ Копирует Java-файлы и патчит манифест
8. **build_apk** (стр. 258-299): Собирает APK через Gradle

---

## Критические проблемы

### 🔴 Проблема #1: Неправильный формат `capacitor.plugins.json`

**Где**: Строки 212-218

**Что не так**:
```json
{
  "plugins": [
    { "name": "BluetoothSerial", "className": "app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt.BluetoothSerialPlugin" }
  ]
}
```

**Почему это проблема**:
- Capacitor 7 использует новый формат регистрации плагинов
- Старый формат (`name`/`className`) был в Capacitor 6
- Capacitor 7 требует: `pkg` (package) и `classpath` (полный путь к классу)
- Без правильного формата плагин **НЕ БУДЕТ ЗАРЕГИСТРИРОВАН** в Capacitor

**Последствия**:
- Приложение не видит плагин `BluetoothSerial`
- Вызовы `BluetoothSerial.scan()` выдают ошибку "Plugin not implemented"
- В логах нет `MainActivity: ✅ BluetoothSerialPlugin registered!`

---

### 🔴 Проблема #2: `maxSdkVersion="30"` блокирует сканирование

**Где**: Строка 242

**Что не так**:
```bash
sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />' "$MAN"
```

**Почему это проблема**:
- `maxSdkVersion="30"` означает: "это разрешение нужно ТОЛЬКО до Android 11 (API 30)"
- На Android 12+ (API 31+) `BLUETOOTH_SCAN` требует либо `ACCESS_FINE_LOCATION`, либо флаг `neverForLocation` в манифесте
- Но ваш плагин НЕ использует флаг `neverForLocation`
- Поэтому на Android 12+ сканирование **НЕ РАБОТАЕТ** без `ACCESS_FINE_LOCATION`

**Последствия**:
- **Android 6-11 (API 23-30)**: `startDiscovery()` работает только с `ACCESS_FINE_LOCATION`
- **Android 12+ (API 31+)**: `BLUETOOTH_SCAN` требует `ACCESS_FINE_LOCATION` (если нет `neverForLocation`)
- С `maxSdkVersion="30"` на Android 12+ система **НЕ ДАЁТ** разрешение → сканирование не находит устройства

**Правильное поведение**:
```bash
# Без maxSdkVersion - разрешение доступно на всех версиях
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

### 🔴 Проблема #3: Конфликт MainActivity (Kotlin vs Java)

**Где**: Строки 224, 189-191

**Что не так**:
В репозитории есть **ДВА** файла MainActivity:

1. **Kotlin** (старый): `android/app/src/main/java/com/koval/pancyr/MainActivity.kt`
2. **Java** (новый): `MainActivity.java` в корне (копируется в `app.lovable.ba41ab0de47a46879e70cd17cee4dfd3`)

Скрипт:
- Строка 224: меняет `BridgeActivity` на `app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.MainActivity`
- Но в манифесте **УЖЕ ЕСТЬ** `com.koval.pancyr.MainActivity` из предыдущей сборки!

**Почему это проблема**:
- В `AndroidManifest.xml` может остаться ссылка на старую `com.koval.pancyr.MainActivity`
- Gradle найдёт **ОБЕ** MainActivity и выдаст ошибку компиляции, либо использует не ту, которую вы хотите
- Если манифест указывает на старую MainActivity → регистрация плагина не происходит (старая не регистрирует плагин)

**Последствия**:
- APK собирается, но при запуске использует **старую** MainActivity без регистрации плагина
- `BluetoothSerial` не работает
- В логах: нет `MainActivity: ✅ BluetoothSerialPlugin registered!`

---

### 🔴 Проблема #4: Извлечение `APP_ID` из JSON может не работать

**Где**: Строки 178-179

**Что не так**:
```bash
APP_ID="$(sed -n 's/.*"appId"[[:space:]]*:[[:space:]]*"\([^"]\+\)".*/\1/p' "$CFG_JSON" | head -n1)"
```

**Почему это проблема**:
- Регулярное выражение `[[:space:]]` может не работать в некоторых версиях sed
- Если в JSON есть табы или переносы строк между `"appId"` и значением, sed может не найти
- Если парсинг не работает → `APP_ID` пустой → fallback на `app.lovable.ba41ab0de47a46879e70cd17cee4dfd3`

**Более надёжный способ**:
```bash
APP_ID="$(grep -oP '"appId"\s*:\s*"\K[^"]+' "$CFG_JSON" 2>/dev/null | head -n1)"
```

- `grep -oP` (Perl regex) более надёжен
- `\s*` распознаёт любые пробельные символы
- `\K` сбрасывает совпадение (возвращает только значение после `"`)

---

### ⚠️ Проблема #5: Перезапись TypeScript моста

**Где**: Строки 128-150

**Что не так**:
Скрипт генерирует `src/lib/capacitor-bluetooth.ts`, но в проекте уже есть:
- `src/utils/native-bluetooth.ts` (правильный файл с правильным API)
- Возможно, приложение импортирует из `@/utils/native-bluetooth`

**Почему это проблема**:
- Генерируемый файл может перезаписать правильный, если путь совпадёт
- Если приложение импортирует из другого пути → два источника истины
- API может отличаться (в генерируемом нет `NativeBluetoothWrapper`)

**Правильное решение**:
- **НЕ генерировать** TypeScript файл, если он уже есть в репозитории
- Использовать файл из репозитория: `src/utils/native-bluetooth.ts`
- Или проверять, что путь импорта совпадает с генерируемым файлом

---

### ⚠️ Проблема #6: Патч манифеста не удаляет старую Activity

**Где**: Строки 224, 226-234

**Что не так**:
```bash
sed -i "s|android:name=\"com.getcapacitor.BridgeActivity\"|android:name=\"${APP_ID}.MainActivity\"|g" "$MAN"
```

Эта команда работает **ТОЛЬКО** если в манифесте стоит `BridgeActivity`.

Но если в манифесте **УЖЕ ЕСТЬ** `com.koval.pancyr.MainActivity` (из предыдущей сборки) → замена не происходит!

**Последствия**:
- Манифест остаётся со старой MainActivity
- APK использует старую версию без регистрации плагина
- Сканирование не работает

**Правильное решение**:
- Найти `<activity>` с `android.intent.category.LAUNCHER`
- Заменить её `android:name` на новый APP_ID, независимо от текущего значения

---

## Детальный анализ по секциям

### Секция: `ensure_ts_bridge` (строки 128-150)

**Что делает**:
- Проверяет, существует ли `src/lib/capacitor-bluetooth.ts`
- Если нет или нет строки `registerPlugin<` → создаёт файл с интерфейсом плагина

**Проблемы**:
1. ❌ В проекте уже есть `src/utils/native-bluetooth.ts` с правильным API
2. ❌ Скрипт создаёт файл в другом месте: `src/lib/` вместо `src/utils/`
3. ❌ Генерируемый файл не содержит `NativeBluetoothWrapper` (обёртку для удобства)

**Рекомендация**:
```bash
ensure_ts_bridge(){
  # НЕ генерируем файл, если он есть в репозитории!
  local TS_FILE="src/utils/native-bluetooth.ts"
  if [ -f "$TS_FILE" ]; then
    log "✅ TypeScript мост уже есть: $TS_FILE"
    return 0
  fi
  
  # Только если файла НЕТ - генерируем
  log "⚠️  native-bluetooth.ts не найден, создаю заглушку"
  mkdir -p "$(dirname "$TS_FILE")"
  cat > "$TS_FILE" <<'TS'
import { registerPlugin } from '@capacitor/core';

export interface BluetoothSerialPlugin {
  scan(): Promise<{ devices: {name:string|null; address:string}[] }>;
  connect(opts:{ mac:string; uuid?:string }): Promise<void>;
  write(opts:{ data:string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(event:'data'|'connectionLost', cb:(ev?:any)=>void): Promise<void>;
}

export const BluetoothSerial = registerPlugin<BluetoothSerialPlugin>('BluetoothSerial');
export const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB';
TS
}
```

**Объяснение изменений**:
- Проверяем `src/utils/native-bluetooth.ts` (правильный путь из репозитория)
- Если файл есть → ничего не делаем
- Если нет → генерируем минимальную версию как fallback

---

### Секция: `ensure_bt_plugin` (строки 171-255)

#### Подсекция: Извлечение APP_ID (строки 176-181)

**Текущий код**:
```bash
local CFG_JSON="android/app/src/main/assets/capacitor.config.json"
local APP_ID=""
if [ -f "$CFG_JSON" ]; then
  APP_ID="$(sed -n 's/.*"appId"[[:space:]]*:[[:space:]]*"\([^"]\+\)".*/\1/p' "$CFG_JSON" | head -n1)"
fi
[ -n "$APP_ID" ] || APP_ID="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3"
```

**Проблема**:
- `sed` с `[[:space:]]` может не работать корректно
- Не обрабатывает случаи с табами или многострочным JSON

**Исправление**:
```bash
local CFG_JSON="android/app/src/main/assets/capacitor.config.json"
local APP_ID=""
if [ -f "$CFG_JSON" ]; then
  # Используем grep с Perl regex для надёжности
  APP_ID="$(grep -oP '"appId"\s*:\s*"\K[^"]+' "$CFG_JSON" 2>/dev/null | head -n1)"
fi
[ -n "$APP_ID" ] || APP_ID="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3"
log "📱 Используется APP_ID: $APP_ID"
```

**Почему лучше**:
- `grep -oP` с Perl regex надёжнее sed
- `\K` отбрасывает всё до него (возвращает только значение)
- `2>/dev/null` подавляет ошибки, если файла нет

---

#### Подсекция: Создание capacitor.plugins.json (строки 210-218)

**Текущий код**:
```json
{
  "plugins": [
    { "name": "BluetoothSerial", "className": "${APP_ID}.bt.BluetoothSerialPlugin" }
  ]
}
```

**Проблема**: ❌ Формат Capacitor 6, не работает в Capacitor 7

**Исправление**:
```bash
# ✅ Создаем capacitor.plugins.json (формат Capacitor 7)
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
log "✅ capacitor.plugins.json создан (формат Capacitor 7)"
```

**Объяснение**:
- `pkg` — пакет, в котором находится плагин (`app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt`)
- `classpath` — полный путь к классу плагина
- Именно этот формат требуется для автоматической регистрации в Capacitor 7

---

#### Подсекция: Патч AndroidManifest.xml (строки 220-242)

**Текущий код (строка 224)**:
```bash
sed -i "s|android:name=\"com.getcapacitor.BridgeActivity\"|android:name=\"${APP_ID}.MainActivity\"|g" "$MAN"
```

**Проблема**:
- Работает только если в манифесте `BridgeActivity`
- Если уже стоит `com.koval.pancyr.MainActivity` → замена не происходит
- Результат: APK использует старую MainActivity без регистрации плагина

**Исправление (замените строки 220-234)**:
```bash
# Патчим манифест: ВАЖНО - заменяем launcher activity на нашу MainActivity
local MAN="android/app/src/main/AndroidManifest.xml"
[ -f "$MAN" ] || fail "Нет $MAN"

log "📝 Патчим AndroidManifest.xml"

# Шаг 1: Заменяем BridgeActivity (если есть)
sed -i "s|android:name=\"com.getcapacitor.BridgeActivity\"|android:name=\"${APP_ID}.MainActivity\"|g" "$MAN"

# Шаг 2: Находим LAUNCHER activity и заменяем её name на новый APP_ID
# Это обрабатывает случай, когда уже стоит другая MainActivity (например, com.koval.pancyr.MainActivity)
awk -v new_activity="${APP_ID}.MainActivity" '
BEGIN { in_activity=0; has_launcher=0; activity_line="" }

# Начало activity
/<activity/ {
  in_activity=1
  has_launcher=0
  activity_line=$0
  next
}

# Внутри activity - ищем LAUNCHER
in_activity && /android.intent.category.LAUNCHER/ {
  has_launcher=1
}

# Конец activity
/<\/activity>/ {
  if (in_activity && has_launcher) {
    # Это launcher activity - заменяем android:name
    gsub(/android:name="[^"]*"/, "android:name=\"" new_activity "\"", activity_line)
    
    # Добавляем exported=true если нет
    if (activity_line !~ /android:exported=/) {
      gsub(/<activity /, "<activity android:exported=\"true\" ", activity_line)
    }
    
    print activity_line
    has_launcher=0
  }
  in_activity=0
  next
}

# Остальные строки
!in_activity { print }
in_activity { activity_line = activity_line "\n" $0 }
' "$MAN" > "$MAN.tmp" && mv "$MAN.tmp" "$MAN"

log "✅ MainActivity заменена на ${APP_ID}.MainActivity"
```

**Почему это лучше**:
- Находит `<activity>` с `LAUNCHER` intent
- Заменяет её `android:name` **независимо от текущего значения**
- Добавляет `exported="true"` если нет
- Работает даже если в манифесте `com.koval.pancyr.MainActivity` или другая activity

---

#### Подсекция: Разрешения Bluetooth (строки 236-242)

**Текущий код (строка 242)**:
```bash
grep -q 'android.permission.ACCESS_FINE_LOCATION' "$MAN" || \
  sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />' "$MAN"
```

**Проблема**: ❌ `maxSdkVersion="30"` блокирует разрешение на Android 12+

**Исправление (замените строки 236-242)**:
```bash
# ✅ Права BT (БЕЗ maxSdkVersion для LOCATION!)
log "📱 Проверяю разрешения Bluetooth"

grep -q 'android.permission.BLUETOOTH_CONNECT' "$MAN" || {
  sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />' "$MAN"
  log "  ✅ Добавлено BLUETOOTH_CONNECT"
}

grep -q 'android.permission.BLUETOOTH_SCAN' "$MAN" || {
  sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />' "$MAN"
  log "  ✅ Добавлено BLUETOOTH_SCAN"
}

# КРИТИЧНО: БЕЗ maxSdkVersion!
# Android 6-11: нужно для startDiscovery()
# Android 12+: нужно для BLUETOOTH_SCAN (если нет neverForLocation)
grep -q 'android.permission.ACCESS_FINE_LOCATION' "$MAN" || {
  sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' "$MAN"
  log "  ✅ Добавлено ACCESS_FINE_LOCATION (без maxSdkVersion)"
}
```

**Объяснение**:
- **Android 12+ (API 31+)**: `BLUETOOTH_SCAN` требует либо `ACCESS_FINE_LOCATION`, либо флаг `neverForLocation`
- **Android 6-11 (API 23-30)**: `startDiscovery()` требует `ACCESS_FINE_LOCATION`
- Без `maxSdkVersion` разрешение работает **на всех версиях Android**

---

### Секция: `build_apk` (строки 258-299)

**Что делает**:
- Повторно вызывает `npx cap sync android` (страховка)
- Собирает APK через Gradle (`assembleDebug` или `assembleRelease`)
- Копирует APK в `BUILD_OUT_DIR` с таймстампом
- Опционально копирует в Windows Downloads (для WSL)

**Проблемы**: ✅ Нет проблем в этой секции

**Рекомендация**:
Добавить проверку, что файлы скопированы до `cap sync`:
```bash
build_apk(){
  cd "$APP_DIR"
  
  # Проверяем, что критические файлы на месте
  local APP_ID="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3"  # или извлечь из config
  [ -f "android/app/src/main/java/${APP_ID//.//}/MainActivity.java" ] || \
    fail "MainActivity.java не скопирована!"
  [ -f "android/app/src/main/java/${APP_ID//.//}/bt/BluetoothSerialPlugin.java" ] || \
    fail "BluetoothSerialPlugin.java не скопирован!"
  
  log "Повторный cap sync"
  npx cap sync android
  
  # ... остальной код без изменений
}
```

---

## Точные правки с номерами строк

### ✏️ Правка #1: Исправить извлечение APP_ID

**Строки 176-181** → заменить на:

```bash
local CFG_JSON="android/app/src/main/assets/capacitor.config.json"
local APP_ID=""
if [ -f "$CFG_JSON" ]; then
  APP_ID="$(grep -oP '"appId"\s*:\s*"\K[^"]+' "$CFG_JSON" 2>/dev/null | head -n1)"
fi
[ -n "$APP_ID" ] || APP_ID="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3"
log "📱 APP_ID: $APP_ID"
```

---

### ✏️ Правка #2: Исправить формат capacitor.plugins.json

**Строки 210-218** → заменить на:

```bash
# ✅ Создаем capacitor.plugins.json (формат Capacitor 7)
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
log "✅ capacitor.plugins.json (Capacitor 7 format)"
```

---

### ✏️ Правка #3: Исправить патч AndroidManifest (LAUNCHER activity)

**Строки 220-234** → заменить на:

```bash
# Патчим манифест: заменяем LAUNCHER activity
local MAN="android/app/src/main/AndroidManifest.xml"
[ -f "$MAN" ] || fail "Нет $MAN"

log "📝 Патчим AndroidManifest.xml"

# Шаг 1: Заменяем BridgeActivity (если есть)
sed -i "s|android:name=\"com.getcapacitor.BridgeActivity\"|android:name=\"${APP_ID}.MainActivity\"|g" "$MAN"

# Шаг 2: Находим LAUNCHER activity и жёстко заменяем на новую MainActivity
awk -v fqcn="${APP_ID}.MainActivity" '
/<activity[^>]*android:name="[^"]*"[^>]*>/,/<\/activity>/ {
  if ($0 ~ /android.intent.category.LAUNCHER/) {
    in_launcher=1
  }
  if (in_launcher && $0 ~ /<activity/) {
    # Заменяем android:name на наш
    gsub(/android:name="[^"]*"/, "android:name=\"" fqcn "\"")
    # Добавляем exported если нет
    if ($0 !~ /android:exported=/) {
      gsub(/<activity /, "<activity android:exported=\"true\" ")
    }
  }
  print
  if ($0 ~ /<\/activity>/) in_launcher=0
  next
}
{ print }
' "$MAN" > "$MAN.tmp" && mv "$MAN.tmp" "$MAN"

log "✅ LAUNCHER activity → ${APP_ID}.MainActivity"
```

---

### ✏️ Правка #4: Убрать maxSdkVersion из ACCESS_FINE_LOCATION

**Строки 236-242** → заменить на:

```bash
# ✅ Права BT (БЕЗ maxSdkVersion!)
log "📱 Проверяю Bluetooth permissions"

grep -q 'android.permission.BLUETOOTH_CONNECT' "$MAN" || \
  sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />' "$MAN"

grep -q 'android.permission.BLUETOOTH_SCAN' "$MAN" || \
  sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />' "$MAN"

# КРИТИЧНО: БЕЗ maxSdkVersion!
grep -q 'android.permission.ACCESS_FINE_LOCATION' "$MAN" || \
  sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' "$MAN"

log "✅ Bluetooth permissions добавлены"
```

---

### ✏️ Правка #5 (опционально): Удалить конфликтующие Kotlin-файлы

**После строки 186** (создание директории `bt`), добавить:

```bash
# Удаляем старые Kotlin-файлы, если они есть (конфликт пакетов)
if [ -d "android/app/src/main/java/com/koval/pancyr" ]; then
  log "⚠️  Найдены старые Kotlin-файлы (com.koval.pancyr), удаляю для избежания конфликтов"
  rm -rf "android/app/src/main/java/com/koval/pancyr"
fi
```

**Почему это важно**:
- Предотвращает конфликт между старой Kotlin MainActivity и новой Java MainActivity
- Гарантирует, что используется правильная версия

---

### ✏️ Правка #6: Отключить генерацию TS-моста (если файл есть в репо)

**Строки 128-150** → заменить функцию целиком:

```bash
# ------------------------- ПРОВЕРКА TS-МОСТА -----------------------------------
ensure_ts_bridge(){
  local TS_FILE="src/utils/native-bluetooth.ts"
  
  if [ -f "$TS_FILE" ]; then
    log "✅ TypeScript мост уже есть в репозитории: $TS_FILE"
    return 0
  fi
  
  # Если файла нет - генерируем минимальную версию
  log "⚠️  $TS_FILE не найден, создаю базовую версию"
  mkdir -p "$(dirname "$TS_FILE")"
  cat > "$TS_FILE" <<'TS'
import { registerPlugin } from '@capacitor/core';

export interface BluetoothSerialPlugin {
  scan(): Promise<{ devices: {name:string|null; address:string}[] }>;
  connect(opts:{ mac:string; uuid?:string }): Promise<void>;
  write(opts:{ data:string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(event:'data'|'connectionLost', cb:(ev?:any)=>void): Promise<void>;
}

export const BluetoothSerial = registerPlugin<BluetoothSerialPlugin>('BluetoothSerial');
export const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB';

export function toB64(u8: Uint8Array): string {
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
TS
  log "✅ Базовый TypeScript мост создан"
}
```

---

## Проверка после сборки

### 1. Проверка логов при запуске APK

```powershell
# PowerShell команды
adb logcat -c
adb logcat | Select-String -Pattern "MainActivity|BTSerial"
```

**Ожидаемые строки**:
```
MainActivity: 🔌 Registering BluetoothSerialPlugin...
MainActivity: ✅ BluetoothSerialPlugin registered!
```

**Если этого НЕТ** → плагин не зарегистрирован!

---

### 2. Проверка при нажатии кнопки Scan

**Ожидаемые логи**:
```
BTSerial: 🔍 scan() called
BTSerial: 📍 Android 6-11 detected, checking fineLocation
BTSerial: ✅ fineLocation granted
BTSerial: ✅ Found 2 bonded devices
BTSerial:   📱 HC-05 [00:11:22:33:44:55]
BTSerial:   📱 My Bluetooth Device [AA:BB:CC:DD:EE:FF]
BTSerial: 🔎 Starting discovery...
BTSerial: 🔎 Discovery started: true
BTSerial: ✅ Scan complete - found 2 devices total
```

**Если сканирование не находит устройства**:
```
BTSerial: ❌ Scan failed: java.lang.SecurityException: Need BLUETOOTH_SCAN permission
```
→ Проблема с разрешениями или `capacitor.plugins.json`

---

### 3. Проверка файлов после `cap sync`

```bash
# В репозитории (после запуска скрипта)
cd /home/koval/dev/pancyr-diag-droid-main

# Проверить capacitor.plugins.json
cat android/app/src/main/assets/capacitor.plugins.json
```

**Должно быть**:
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

**НЕ должно быть**:
```json
{ "name": "BluetoothSerial", "className": "..." }  // ❌ Старый формат
```

---

### 4. Проверка AndroidManifest.xml

```bash
grep -A 20 'android.intent.category.LAUNCHER' android/app/src/main/AndroidManifest.xml
```

**Должно быть**:
```xml
<activity
    android:name="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.MainActivity"
    android:exported="true"
    ...>
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>
```

**НЕ должно быть**:
```xml
<activity android:name="com.koval.pancyr.MainActivity" ...>  <!-- ❌ Старая MainActivity -->
```

---

### 5. Проверка разрешений

```bash
grep 'uses-permission' android/app/src/main/AndroidManifest.xml | grep -E 'BLUETOOTH|LOCATION'
```

**Должно быть**:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

**НЕ должно быть**:
```xml
<uses-permission ... android:maxSdkVersion="30" />  <!-- ❌ Блокирует Android 12+ -->
```

---

## Итоговый чеклист правок

- [ ] **Правка #1**: Извлечение APP_ID через `grep -oP` (строки 176-181)
- [ ] **Правка #2**: Формат `capacitor.plugins.json` → Capacitor 7 (строки 210-218)
- [ ] **Правка #3**: Патч LAUNCHER activity в манифесте (строки 220-234)
- [ ] **Правка #4**: Убрать `maxSdkVersion="30"` из `ACCESS_FINE_LOCATION` (строки 236-242)
- [ ] **Правка #5**: Удалить старые Kotlin-файлы `com.koval.pancyr` (после строки 186)
- [ ] **Правка #6**: Не перезаписывать TS-мост, если он есть в репо (строки 128-150)

---

## Почему это важно

### Без правок скрипта:
1. ❌ Плагин не регистрируется (неправильный формат `capacitor.plugins.json`)
2. ❌ Сканирование не находит устройства (блокировка `maxSdkVersion="30"`)
3. ❌ APK использует старую MainActivity без регистрации плагина (конфликт пакетов)
4. ❌ Приложение показывает "Scan failed" или "Plugin not implemented"

### С правками:
1. ✅ Плагин корректно регистрируется в Capacitor 7
2. ✅ Разрешения работают на всех версиях Android (6-14)
3. ✅ Используется правильная MainActivity с регистрацией плагина
4. ✅ Сканирование находит устройства и работает корректно

---

## Дополнительные рекомендации

### Отладка через adb в PowerShell

```powershell
# Очистить логи и смотреть в реальном времени
adb logcat -c
adb logcat | Select-String -Pattern "MainActivity|BTSerial|BluetoothSerialPlugin"

# Или сохранить логи в файл
adb logcat > logs.txt
# Затем открыть logs.txt и найти строки с MainActivity/BTSerial
```

### Если после правок всё ещё не работает

1. **Проверить, что git pull был выполнен**:
   ```bash
   cd /home/koval/dev/pancyr-diag-droid-main
   git log -1 --oneline
   # Должен быть последний коммит с исправлением спама scan()
   ```

2. **Полностью пересобрать Android платформу**:
   ```bash
   rm -rf android
   npx cap add android
   # Затем запустить скрипт заново
   ```

3. **Проверить права на устройстве вручную**:
   - Настройки → Приложения → Pancyr Диагностика
   - Разрешения → Bluetooth, Местоположение (должны быть включены)

4. **Проверить, что HC-05 в paired devices**:
   - Настройки → Bluetooth → Найти HC-05 и спарить (PIN: 1234 или 0000)
