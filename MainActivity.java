package app.lovable.ba41ab0de47a46879e70cd17cee4dfd3;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;


public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Log.d("MainActivity", "✅ MainActivity started");
  }
}
