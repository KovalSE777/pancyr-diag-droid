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
