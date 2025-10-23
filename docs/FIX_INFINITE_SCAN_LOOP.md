# 🔴 ИСПРАВЛЕНИЕ: Бесконечный цикл scan()

## Проблема

Логи показывают бесконечный цикл:
```
🔓 Permissions granted, retrying scan
🔍 scan() called
📍 Android 6-11 - requesting fineLocation
🔓 Permissions granted, retrying scan
🔍 scan() called
...
```

### Причина

В `BluetoothSerialPlugin.java` после получения разрешений происходит следующее:

1. `scan()` вызывается из приложения
2. Плагин проверяет разрешения → их нет
3. Плагин запрашивает `fineLocation`
4. После получения разрешений вызывается callback `scanPerms()`
5. `scanPerms()` вызывает `scan()` СНОВА
6. Но `scan()` снова видит что нужны разрешения → цикл!

---

## 🔧 РЕШЕНИЕ

Нужно исправить логику в `BluetoothSerialPlugin.java`:

### Файл: `/BluetoothSerialPlugin.java` (корень проекта)

**Найди строки (~80-110):**

```java
@PluginMethod
public void scan(PluginCall call) {
    Log.d(TAG, "🔍 scan() called");
    
    if (Build.VERSION.SDK_INT >= 31) {
        // Android 12+ логика
        if (!hasPermission("btScan") || !hasPermission("btConnect")) {
            Log.d(TAG, "🔐 Android 12+ - requesting btScan & btConnect");
            requestAllPermissions(call, "scanPerms");
            return;
        }
    } else {
        // Android 6-11 — нужна геопозиция
        if (!hasPermission("fineLocation")) {
            Log.d(TAG, "📍 Android 6-11 - requesting fineLocation");
            requestPermissionForAlias("fineLocation", call, "scanPerms");
            return; // ❌ ПРОБЛЕМА: После получения разрешений callback вызовет scan() снова!
        }
    }
    
    Log.d(TAG, "✅ All permissions granted, starting scan");
    // ... реальная логика сканирования ...
}

@PermissionCallback
private void scanPerms(PluginCall call) {
    if (!hasAllPermissions()) {
        call.reject("Scan failed: permissions denied");
        return;
    }
    Log.d(TAG, "🔓 Permissions granted, retrying scan");
    scan(call); // ❌ ПРОБЛЕМА: Это вызывает бесконечный цикл!
}
```

---

### ✅ ИСПРАВЛЕННЫЙ КОД:

**Вариант 1: Флаг "разрешения уже проверены"**

```java
@PluginMethod
public void scan(PluginCall call) {
    scan(call, false);
}

private void scan(PluginCall call, boolean permissionsAlreadyChecked) {
    Log.d(TAG, "🔍 scan() called");
    
    if (!permissionsAlreadyChecked) {
        if (Build.VERSION.SDK_INT >= 31) {
            // Android 12+ логика
            if (!hasPermission("btScan") || !hasPermission("btConnect")) {
                Log.d(TAG, "🔐 Android 12+ - requesting btScan & btConnect");
                requestAllPermissions(call, "scanPerms");
                return;
            }
        } else {
            // Android 6-11 — нужна геопозиция
            if (!hasPermission("fineLocation")) {
                Log.d(TAG, "📍 Android 6-11 - requesting fineLocation");
                requestPermissionForAlias("fineLocation", call, "scanPerms");
                return;
            }
        }
    }
    
    Log.d(TAG, "✅ All permissions granted, starting scan");
    
    // Реальная логика сканирования
    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
    if (adapter == null) {
        call.reject("Bluetooth not available");
        return;
    }
    
    // ... остальной код сканирования ...
}

@PermissionCallback
private void scanPerms(PluginCall call) {
    if (!hasAllPermissions()) {
        call.reject("Scan failed: permissions denied");
        return;
    }
    Log.d(TAG, "🔓 Permissions granted, continuing scan");
    scan(call, true); // ✅ Передаём флаг что разрешения уже проверены!
}
```

---

**Вариант 2: Вынести логику сканирования в отдельный метод (ПРОЩЕ)**

```java
@PluginMethod
public void scan(PluginCall call) {
    Log.d(TAG, "🔍 scan() called");
    
    // Проверка разрешений
    if (Build.VERSION.SDK_INT >= 31) {
        if (!hasPermission("btScan") || !hasPermission("btConnect")) {
            Log.d(TAG, "🔐 Android 12+ - requesting btScan & btConnect");
            requestAllPermissions(call, "scanPerms");
            return;
        }
    } else {
        if (!hasPermission("fineLocation")) {
            Log.d(TAG, "📍 Android 6-11 - requesting fineLocation");
            requestPermissionForAlias("fineLocation", call, "scanPerms");
            return;
        }
    }
    
    // Разрешения есть - выполняем сканирование
    performScan(call);
}

@PermissionCallback
private void scanPerms(PluginCall call) {
    if (!hasAllPermissions()) {
        call.reject("Scan failed: permissions denied");
        return;
    }
    Log.d(TAG, "🔓 Permissions granted, performing scan");
    performScan(call); // ✅ Вызываем реальное сканирование, а не scan()!
}

// ✅ Реальная логика сканирования
private void performScan(PluginCall call) {
    Log.d(TAG, "✅ Starting actual scan");
    
    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
    if (adapter == null) {
        call.reject("Bluetooth not available");
        return;
    }
    
    // Получаем спаренные устройства
    Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
    Log.d(TAG, "✅ Found " + pairedDevices.size() + " bonded devices");
    
    JSONArray devices = new JSONArray();
    for (BluetoothDevice device : pairedDevices) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("name", device.getName());
            obj.put("address", device.getAddress());
            devices.put(obj);
            Log.d(TAG, "  📱 " + device.getName() + " [" + device.getAddress() + "]");
        } catch (JSONException e) {
            Log.w(TAG, "❌ Error adding device: " + e.getMessage());
        }
    }
    
    // Запускаем discovery для новых устройств
    if (adapter.isDiscovering()) {
        adapter.cancelDiscovery();
    }
    
    Log.d(TAG, "🔎 Starting discovery...");
    boolean started = adapter.startDiscovery();
    Log.d(TAG, "🔎 Discovery started: " + started);
    
    // Возвращаем результат
    JSObject ret = new JSObject();
    ret.put("devices", devices);
    call.resolve(ret);
}
```

---

## 📝 Рекомендация

**Используй Вариант 2** - он проще и понятнее:

1. `scan()` - проверяет разрешения и запрашивает если нужно
2. `scanPerms()` - callback после получения разрешений
3. `performScan()` - реальная логика сканирования (вызывается из обоих мест)

---

## 🔍 Как проверить что исправлено:

После исправления логи должны быть:
```
🔍 scan() called
📍 Android 6-11 - requesting fineLocation
🔓 Permissions granted, performing scan
✅ Starting actual scan
✅ Found 2 bonded devices
  📱 HC-05 [00:11:22:33:44:55]
🔎 Starting discovery...
🔎 Discovery started: true
```

**Без бесконечного цикла!**

---

## 🚀 Пошаговая инструкция:

1. **Открой файл**: `/home/koval/dev/pancyr-diag-droid-main/BluetoothSerialPlugin.java`

2. **Найди метод** `scan()` (примерно строка 80-110)

3. **Найди метод** `scanPerms()` (примерно строка 120-130)

4. **Замени** оба метода на код из **Варианта 2** выше

5. **Добавь новый метод** `performScan()` с реальной логикой сканирования

6. **Пересобери APK**:
   ```bash
   cd /home/koval/dev/pancyr-diag-droid-main/apkmaker
   bash pancyr-build.sh
   ```

7. **Установи новый APK**:
   ```bash
   adb install -r "Last APK/pancyr-diag-droid-debug-*.apk"
   ```

8. **Проверь логи** что цикл исчез

---

## 💡 Альтернативное решение (без изменения кода)

Если не хочешь менять плагин, можно исправить в **приложении** (TypeScript):

**Файл**: `src/utils/capacitor-bluetooth.ts` или где вызывается `BluetoothSerial.scan()`

**Добавь флаг** чтобы не вызывать scan() повторно:

```typescript
private isScanning = false;

async scan() {
  if (this.isScanning) {
    console.log('Scan already in progress, skipping');
    return;
  }
  
  this.isScanning = true;
  try {
    const result = await BluetoothSerial.scan();
    return result;
  } finally {
    this.isScanning = false;
  }
}
```

Но это **костыль** - лучше исправить плагин!

---

**Проблема**: Бесконечный цикл в логике разрешений  
**Причина**: `scanPerms()` вызывает `scan()` который снова запрашивает разрешения  
**Решение**: Вынести реальную логику в `performScan()` и вызывать её напрямую из callback  
**Статус**: ❌ Требует исправления в `BluetoothSerialPlugin.java`

