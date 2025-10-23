package app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
  name = "BluetoothSerial",
  permissions = {
    @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "btConnect"),
    @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "btScan"),
    @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = "fineLocation")
  }
)
public class BluetoothSerialPlugin extends Plugin {
  private static final String TAG = "BTSerial";
  private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

  private BluetoothSocket sock;
  private InputStream inp;
  private OutputStream out;
  private final AtomicBoolean readerRunning = new AtomicBoolean(false);
  private final ExecutorService ioPool = Executors.newSingleThreadExecutor();

  @PluginMethod
  public void scan(PluginCall call) {
    Log.d(TAG, "🔍 scan() called");

    // КРИТИЧНО: Запрашиваем разрешения в зависимости от версии Android
    if (Build.VERSION.SDK_INT >= 31) {
      // Android 12+
      if (!hasPermission("btScan") || !hasPermission("btConnect")) {
        Log.d(TAG, "📱 Android 12+ - requesting btScan + btConnect");
        requestAllPermissions(call, "scanPerms");
        return;
      }
    } else {
      // Android 6-11 - ОБЯЗАТЕЛЬНА геопозиция для discovery
      if (!hasPermission("fineLocation")) {
        Log.d(TAG, "📍 Android 6-11 - requesting fineLocation");
        requestPermissionForAlias("fineLocation", call, "scanPerms");
        return;
      }
    }

    BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
    JSONArray arr = new JSONArray();
    if (a == null) {
      Log.w(TAG, "❌ BluetoothAdapter is null");
      JSObject ret = new JSObject(); 
      ret.put("devices", arr); 
      call.resolve(ret); 
      return;
    }

    // 1) Спаренные устройства
    Set<String> seen = new HashSet<>();
    try {
      Set<BluetoothDevice> bonded = a.getBondedDevices();
      if (bonded != null) {
        Log.d(TAG, "✅ Found " + bonded.size() + " bonded devices");
        for (BluetoothDevice d : bonded) {
          try {
            JSONObject o = new JSONObject();
            o.put("name", d.getName());
            o.put("address", d.getAddress());
            arr.put(o);
            seen.add(d.getAddress());
            Log.d(TAG, "  📱 " + d.getName() + " [" + d.getAddress() + "]");
          } catch (Exception ignored) {}
        }
      }
    } catch (Exception e) {
      Log.w(TAG, "getBondedDevices error: " + e.getMessage());
    }

    // 2) Discovery для новых устройств (8 секунд)
    final Context ctx = getContext();
    final IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
    final BroadcastReceiver receiver = new BroadcastReceiver() {
      @Override 
      public void onReceive(Context c, Intent i) {
        if (BluetoothDevice.ACTION_FOUND.equals(i.getAction())) {
          BluetoothDevice d = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
          if (d != null && d.getAddress() != null && !seen.contains(d.getAddress())) {
            try {
              JSONObject o = new JSONObject();
              o.put("name", d.getName());
              o.put("address", d.getAddress());
              arr.put(o);
              seen.add(d.getAddress());
              Log.d(TAG, "  🆕 Discovered: " + d.getName() + " [" + d.getAddress() + "]");
            } catch (Exception ignored) {}
          }
        }
      }
    };

    try {
      try { ctx.unregisterReceiver(receiver); } catch (Exception ignored) {}
      ctx.registerReceiver(receiver, filter);

      try { a.cancelDiscovery(); } catch (Exception ignored) {}
      boolean started = a.startDiscovery();
      Log.d(TAG, "🔎 Discovery started: " + started);

      long end = System.currentTimeMillis() + 8000L;
      while (System.currentTimeMillis() < end) {
        try { Thread.sleep(250); } catch (InterruptedException ignored) {}
        if (!a.isDiscovering()) {
          Log.d(TAG, "⏹️ Discovery finished early");
          break;
        }
      }
    } catch (Exception e) {
      Log.w(TAG, "❌ Discovery error: " + e.getMessage());
    } finally {
      try { a.cancelDiscovery(); } catch (Exception ignored) {}
      try { ctx.unregisterReceiver(receiver); } catch (Exception ignored) {}
    }

    Log.d(TAG, "✅ Scan complete - found " + arr.length() + " devices total");
    JSObject ret = new JSObject(); 
    ret.put("devices", arr); 
    call.resolve(ret);
  }
  
  @PermissionCallback 
  private void scanPerms(PluginCall call) { 
    Log.d(TAG, "🔓 Permissions granted, retrying scan");
    scan(call); 
  }

  @PluginMethod
  public void connect(PluginCall call) {
    String mac = call.getString("mac", "");
    String uuidStr = call.getString("uuid", SPP_UUID.toString());
    Log.d(TAG, "🔌 connect() to " + mac + " with UUID " + uuidStr);
    
    if (Build.VERSION.SDK_INT >= 31) {
      if (!hasPermission("btConnect")) {
        requestPermissionForAlias("btConnect", call, "connectPerms");
        return;
      }
    }
    
    try {
      BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
      BluetoothDevice dev = a.getRemoteDevice(mac);
      BluetoothSocket s = dev.createRfcommSocketToServiceRecord(UUID.fromString(uuidStr));
      try { a.cancelDiscovery(); } catch (Exception ignored) {}
      s.connect();
      sock = s;
      inp = s.getInputStream();
      out = s.getOutputStream();
      startReader();
      Log.d(TAG, "✅ Connected successfully");
      call.resolve();
    } catch (Exception e) {
      Log.e(TAG, "❌ Connect failed: " + e.getMessage());
      call.reject("connect failed: " + e.getMessage());
    }
  }
  
  @PermissionCallback 
  private void connectPerms(PluginCall call) { 
    connect(call); 
  }

  private void startReader() {
    if (readerRunning.getAndSet(true)) return;
    ioPool.execute(() -> {
      byte[] buf = new byte[1024];
      try {
        while (readerRunning.get()) {
          int n = inp.read(buf);
          if (n <= 0) break;
          byte[] chunk = Arrays.copyOf(buf, n);
          JSObject ev = new JSObject();
          // КРИТИЧНО: NO_WRAP для совместимости с TypeScript
          ev.put("data", Base64.encodeToString(chunk, Base64.NO_WRAP));
          notifyListeners("data", ev);
        }
      } catch (Exception e) {
        Log.e(TAG, "❌ Reader error: " + e.getMessage());
        JSObject ev = new JSObject();
        ev.put("message", e.getMessage());
        notifyListeners("connectionLost", ev);
      } finally {
        readerRunning.set(false);
      }
    });
  }

  @PluginMethod
  public void write(PluginCall call) {
    try {
      String b64 = call.getString("data");
      // КРИТИЧНО: NO_WRAP для совместимости с TypeScript toB64()
      byte[] data = Base64.decode(b64, Base64.NO_WRAP);
      out.write(data);
      out.flush();
      Log.d(TAG, "✅ Wrote " + data.length + " bytes");
      call.resolve();
    } catch (Exception e) {
      Log.e(TAG, "❌ Write failed: " + e.getMessage());
      call.reject("write failed: " + e.getMessage());
    }
  }

  @PluginMethod
  public void disconnect(PluginCall call) {
    try {
      readerRunning.set(false);
      if (inp != null) inp.close();
      if (out != null) out.close();
      if (sock != null) sock.close();
      inp = null; 
      out = null; 
      sock = null;
      Log.d(TAG, "✅ Disconnected");
      call.resolve();
    } catch (Exception e) {
      Log.e(TAG, "❌ Disconnect failed: " + e.getMessage());
      call.reject("disconnect failed: " + e.getMessage());
    }
  }
}
