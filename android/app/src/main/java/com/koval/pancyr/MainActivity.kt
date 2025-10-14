package com.koval.pancyr

import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import com.koval.pancyr.bt.BluetoothSerialPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("MainActivity", "🔌 Registering BluetoothSerialPlugin...")
        registerPlugin(BluetoothSerialPlugin::class.java)
        Log.d("MainActivity", "✅ BluetoothSerialPlugin registered!")
    }
}
