package app.lovable.ba41ab0de47a46879e70cd17cee4dfd3;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import app.lovable.ba41ab0de47a46879e70cd17cee4dfd3.bt.BluetoothSerialPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    Log.d("MainActivity", "🔌 Registering BluetoothSerialPlugin...");
    // ВАЖНО: регистрируем плагин ДО super.onCreate(...)
    registerPlugin(BluetoothSerialPlugin.class);
    super.onCreate(savedInstanceState);
    Log.d("MainActivity", "✅ BluetoothSerialPlugin registered!");
  }
}
