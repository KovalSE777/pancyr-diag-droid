# 🔴 КРИТИЧЕСКИЕ ОШИБКИ В СБОРКЕ APK

## Анализ файлов

Проверено:
- ✅ `pancyr-build-2.sh` (1046 строк)
- ✅ `BluetoothSerialPlugin-2.java` (217 строк)
- ✅ `MainActivity-2.java` (15 строк)
- ✅ `AndroidManifest-2.xml` (46 строк)
- ✅ `BluetoothConnect.tsx` (текущий код приложения)

---

## ❌ ОШИБКА #1: Base64.DEFAULT в скрипте (строка 694, 972)

### Где:
```bash
# pancyr-build-2.sh, строки 694 и 972
byte[] data = Base64.decode(b64, Base64.DEFAULT);  // ❌ НЕПРАВИЛЬНО!
```

### Проблема:
- `Base64.DEFAULT` добавляет переносы строк (`\n`) каждые 76 символов
- TypeScript отправляет данные без переносов строк (`NO_WRAP`)
- **Результат**: данные разрываются, байты искажаются, протокол UDS ломается

### Решение:
```java
byte[] data = Base64.decode(b64, Base64.NO_WRAP);  // ✅ ПРАВИЛЬНО
```

---

## ❌ ОШИБКА #2: Скрипт ПЕРЕЗАПИСЫВАЕТ правильные файлы

### Где:
```bash
# pancyr-build-2.sh, строка 478-495 (ensure_bt_plugin)
# Строка 826-840 (after_sync_patches)
cat > "$MAIN_ACTIVITY_JAVA" <<EOF
cat > "$PLUGIN_JAVA" <<'EOF'
```

### Проблема:
Скрипт **генерирует** упрощённые версии файлов, **удаляя**:
- Discovery для сканирования новых устройств
- Правильную обработку разрешений для Android 6-11
- `ACCESS_FINE_LOCATION` (без него discovery вернёт пустой список)
- Логи отладки
- Обработку `connectionLost`

### Ваши загруженные файлы ПРАВИЛЬНЫЕ, но скрипт их уничтожает!

---

## ❌ ОШИБКА #3: Неправильная регистрация плагина

### Где:
```bash
# pancyr-build-2.sh, строка 835-838
public void onStart() {
  super.onStart();
  registerPlugin(BluetoothSerialPlugin.class);  // ❌ ПОЗДНО!
}
```

### Проблема:
Плагин регистрируется **ПОСЛЕ** `super.onCreate()` в `onStart()`. Capacitor уже инициализирован без плагина.

### Правильно (ваш загруженный файл):
```java
public void onCreate(Bundle savedInstanceState) {
  registerPlugin(BluetoothSerialPlugin.class);  // ✅ ДО super.onCreate()
  super.onCreate(savedInstanceState);
}
```

---

## ❌ ОШИБКА #4: Отсутствует ACCESS_FINE_LOCATION в манифесте скрипта

### Где:
```bash
# pancyr-build-2.sh, строки 748-751, 1017-1020
# Добавляются только BLUETOOTH_CONNECT и BLUETOOTH_SCAN
```

### Проблема:
Android 6-11 **требует** `ACCESS_FINE_LOCATION` для `startDiscovery()`. Без него:
- `a.startDiscovery()` вернёт `false`
- Receiver не получит ни одного `ACTION_FOUND`
- Список устройств **всегда пустой**

### Правильно (ваш загруженный AndroidManifest-2.xml):
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
```

---

## ❌ ОШИБКА #5: Скрипт НЕ запрашивает fineLocation

### Где:
```bash
# pancyr-build-2.sh, строки 558-570, 893-898
# Проверяется только btScan и btConnect для Android 12+
# Для Android 6-11 НЕТ запроса fineLocation
```

### Проблема:
```java
// Скрипт:
if (Build.VERSION.SDK_INT >= 31) {
  if (!hasPermission("btScan") || !hasPermission("btConnect")) {
    requestAllPermissions(call, "scanPerms");
  }
}
// ❌ Для Android 6-11 НЕТ НИЧЕГО!
```

### Правильно (ваш BluetoothSerialPlugin-2.java):
```java
} else {
  // Android 6–11 — нужна геопозиция
  if (!hasPermission("fineLocation")) {
    requestPermissionForAlias("fineLocation", call, "scanPerms");
    return;
  }
}
```

---

## ❌ ОШИБКА #6: Неправильный формат capacitor.plugins.json

### Где:
```bash
# pancyr-build-2.sh, строки 722-727
{ "name": "BluetoothSerial", "className": "${APP_ID}.bt.BluetoothSerialPlugin" }
```

### Проблема:
Capacitor 7 требует формат:
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

Скрипт использует **старый формат** (`name`, `className` вместо `pkg`, `classpath`).

---

## ❌ ОШИБКА #7: Двойная генерация плагина

### Где:
```bash
# pancyr-build-2.sh
# Строки 478-770: ensure_bt_plugin()  ← генерирует плагин
# Строки 815-1031: after_sync_patches() ← генерирует плагин СНОВА
# Строка 1040-1041: main() вызывает ОБЕ функции
```

### Проблема:
Плагин генерируется **дважды** с разными версиями кода. Последняя перезаписывает первую, и остаётся **самая плохая** версия.

---

## ❌ ОШИБКА #8: Нет Discovery в скрипте после строки 890

### Где:
```bash
# pancyr-build-2.sh, строки 890-916
@PluginMethod
public void scan(PluginCall call) {
  // ... только getBondedDevices() ...
  // ❌ НЕТ startDiscovery(), НЕТ BroadcastReceiver
}
```

### Проблема:
Скрипт возвращает только **спаренные** устройства. Если БСКУ не спарено с телефоном — **оно не будет найдено**.

---

## ❌ ОШИБКА #9: "mac" vs "address" несоответствие

### Где:
```bash
# pancyr-build-2.sh, строка 587, 606, 907
o.put("mac", d.getAddress());  // ❌ НЕПРАВИЛЬНОЕ ИМЯ ПОЛЯ
```

### TypeScript ожидает:
```typescript
// src/utils/native-bluetooth.ts, BluetoothSerialPlugin interface
scan(): Promise<{ devices: Array<{ address: string; name: string }> }>;
//                                    ↑↑↑↑↑↑↑ НЕ "mac"!
```

### Проблема:
TypeScript ищет `d.address`, но получает `undefined`, потому что плагин отправляет `d.mac`.

---

## ❌ ОШИБКА #10: Скрипт удаляет capacitor.plugins.json

### Где:
```bash
# pancyr-build-2.sh, строка 754, 823
rm -f android/app/src/main/assets/capacitor.plugins.json || true
```

### Проблема:
Скрипт **удаляет** `capacitor.plugins.json`, надеясь на ручную регистрацию. Но Capacitor 7 **требует** этот файл для автоматической регистрации плагинов.

---

## ❌ ОШИБКА #11: Нет логов в упрощённой версии

### Где:
```bash
# pancyr-build-2.sh, строки 890-994
# НЕТ ни одного Log.d() или Log.w()
```

### Проблема:
Без логов **невозможно отладить**, почему:
- Сканирование не находит устройства
- Подключение не работает
- Данные не передаются

---

## ✅ ПРАВИЛЬНОЕ РЕШЕНИЕ

### Вариант 1: НЕ используйте скрипт для генерации плагина

Измените `pancyr-build-2.sh`:

```bash
ensure_bt_plugin(){
  log "Копирую ГОТОВЫЕ Java-файлы (НЕ генерирую заново)"
  
  local APP_ID="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3"
  local PKG_DIR="android/app/src/main/java/${APP_ID//.//}"
  
  mkdir -p "$PKG_DIR/bt"
  
  # Копируем из КОРНЯ проекта (git должен их содержать)
  cp BluetoothSerialPlugin.java "$PKG_DIR/bt/" || fail "Не найден BluetoothSerialPlugin.java"
  cp MainActivity.java "$PKG_DIR/" || fail "Не найден MainActivity.java"
  
  log "✅ Скопированы готовые файлы из репозитория"
}

# УДАЛИТЕ функцию after_sync_patches() полностью
# или закомментируйте вызов в main():
main(){
  ensure_basics
  ensure_android_sdk
  sync_repo
  build_web
  ensure_ts_bridge
  ensure_android_platform
  ensure_bt_plugin
  # patch_android_in_place  # ← ЗАКОММЕНТИРОВАТЬ ЭТУ СТРОКУ
  build_apk
  log "Готово."
}
```

### Вариант 2: Ручная сборка (РЕКОМЕНДУЕТСЯ)

```bash
# 1. Клонируем
git clone https://github.com/KovalSE777/pancyr-diag-droid.git
cd pancyr-diag-droid

# 2. Добавляем ПРАВИЛЬНЫЕ файлы в репозиторий
mkdir -p android/app/src/main/java/app/lovable/ba41ab0de47a46879e70cd17cee4dfd3/bt

# Копируем ваши загруженные файлы:
cp ~/Downloads/BluetoothSerialPlugin-2.java android/app/src/main/java/app/lovable/ba41ab0de47a46879e70cd17cee4dfd3/bt/BluetoothSerialPlugin.java
cp ~/Downloads/MainActivity-2.java android/app/src/main/java/app/lovable/ba41ab0de47a46879e70cd17cee4dfd3/MainActivity.java
cp ~/Downloads/AndroidManifest-2.xml android/app/src/main/AndroidManifest.xml

# 3. Коммитим в репозиторий
git add android/
git commit -m "Add correct Java files for Bluetooth plugin"
git push

# 4. Собираем
npm ci
npm run build
npx cap sync android
cd android
./gradlew clean
./gradlew assembleDebug

# APK находится в:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📋 Чеклист правильности

После сборки проверьте:

### 1. Правильный Base64
```bash
grep -n "Base64.decode" android/app/src/main/java/app/lovable/*/bt/BluetoothSerialPlugin.java
# Должно быть: Base64.NO_WRAP (НЕ Base64.DEFAULT)
```

### 2. Правильная регистрация
```bash
grep -A5 "onCreate" android/app/src/main/java/app/lovable/*/MainActivity.java
# registerPlugin должен быть ДО super.onCreate()
```

### 3. Правильный формат поля
```bash
grep "o.put" android/app/src/main/java/app/lovable/*/bt/BluetoothSerialPlugin.java
# Должно быть: o.put("address", ...) НЕ o.put("mac", ...)
```

### 4. ACCESS_FINE_LOCATION есть
```bash
grep "ACCESS_FINE_LOCATION" android/app/src/main/AndroidManifest.xml
# Должна быть строка с этим разрешением
```

### 5. Discovery есть в коде
```bash
grep "startDiscovery" android/app/src/main/java/app/lovable/*/bt/BluetoothSerialPlugin.java
# Должен быть вызов a.startDiscovery()
```

### 6. Логи есть
```bash
grep "Log.d" android/app/src/main/java/app/lovable/*/bt/BluetoothSerialPlugin.java
# Должны быть логи для отладки
```

---

## 🎯 Почему ваш скрипт НЕ РАБОТАЕТ

Таблица проблем:

| Компонент | Проблема | Результат |
|-----------|----------|-----------|
| Base64 | `DEFAULT` вместо `NO_WRAP` | Данные искажаются при передаче |
| Регистрация | `onStart()` вместо `onCreate()` | Плагин не виден Capacitor |
| Discovery | Отсутствует | Не находит неспаренные устройства |
| Разрешения | Нет `ACCESS_FINE_LOCATION` | Discovery вернёт пустой список на Android 6-11 |
| Формат JSON | Имя поля `"mac"` вместо `"address"` | TypeScript получает `undefined` |
| Двойная генерация | 2 функции создают плагин | Худшая версия остаётся |
| Удаление JSON | `rm capacitor.plugins.json` | Capacitor не видит плагин |
| Логи | Отсутствуют | Невозможно отладить |

---

## ✅ ИТОГ

**Используйте ваши загруженные Java-файлы напрямую:**
- `BluetoothSerialPlugin-2.java` ✅ (НО исправьте `"mac"` → `"address"` в строках 88, 106)
- `MainActivity-2.java` ✅ ОТЛИЧНО
- `AndroidManifest-2.xml` ✅ ОТЛИЧНО

**НЕ позволяйте скрипту генерировать их заново!**
