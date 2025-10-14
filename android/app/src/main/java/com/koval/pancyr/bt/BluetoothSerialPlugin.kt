package com.koval.pancyr.bt

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(
    name = "BluetoothSerial",
    permissions = [
        Permission(strings = [Manifest.permission.BLUETOOTH_CONNECT], alias = "btConnect"),
        Permission(strings = [Manifest.permission.BLUETOOTH_SCAN], alias = "btScan")
    ]
)
class BluetoothSerialPlugin : Plugin() {
    private val TAG = "BTSerial"
    private val sppUUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    
    @Volatile private var sock: BluetoothSocket? = null
    @Volatile private var inp: InputStream? = null
    @Volatile private var out: OutputStream? = null
    private val readerRunning = AtomicBoolean(false)
    private val ioPool = Executors.newSingleThreadExecutor()
    
    @PluginMethod
    fun connect(call: PluginCall) {
        Log.d(TAG, "✅ connect() called! mac=" + call.getString("mac") + ", uuid=" + call.getString("uuid"))
        val mac = call.getString("mac")
        val uuidStr = call.getString("uuid")
        if (mac == null) {
            call.reject("mac is required")
            return
        }
        
        // Разрешения
        if (!hasPermission("btConnect") || !hasPermission("btScan")) {
            requestAllPermissions(object : PermissionCallback {
                override fun onPermissionsResult(results: Array<String>) {
                    connect(call)
                }
            }, "btConnect")
            return
        }
        
        try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
            val dev: BluetoothDevice = adapter.getRemoteDevice(mac)
            val uuid = if (uuidStr != null) UUID.fromString(uuidStr) else sppUUID
            val s = dev.createRfcommSocketToServiceRecord(uuid)
            adapter.cancelDiscovery()
            s.connect()
            sock = s
            inp = s.inputStream
            out = s.outputStream
            startReader()
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "connect error", e)
            call.reject("connect failed: ${e.message}")
        }
    }
    
    private fun startReader() {
        if (readerRunning.getAndSet(true)) return
        ioPool.execute {
            try {
                val buf = ByteArray(1024)
                while (readerRunning.get()) {
                    val n = inp?.read(buf) ?: -1
                    if (n <= 0) {
                        Log.w(TAG, "Connection closed (read=$n)")
                        break
                    }
                    // emit 'data' СТРОГО этим именем
                    val chunk = Base64.encodeToString(buf.copyOfRange(0, n), Base64.NO_WRAP)
                    val ev = JSObject().put("data", chunk)
                    notifyListeners("data", ev)
                    Log.d(TAG, "RX emit n=$n bytes")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Read loop error: ${e.message}", e)
                // Уведомляем об обрыве соединения
                notifyListeners("connectionLost", JSObject())
            } finally {
                readerRunning.set(false)
                Log.i(TAG, "Reader stopped")
            }
        }
    }
    
    @PluginMethod
    fun write(call: PluginCall) {
        Log.d(TAG, "✅ write() called, data length=" + (call.getString("data")?.length ?: 0))
        try {
            val b64 = call.getString("data") ?: run {
                call.reject("data base64 required")
                return
            }
            val bytes = Base64.decode(b64, Base64.NO_WRAP)
            out?.write(bytes)
            out?.flush()
            call.resolve()
        } catch (e: Exception) {
            call.reject("write failed: ${e.message}")
        }
    }
    
    @PluginMethod
    fun disconnect(call: PluginCall) {
        Log.d(TAG, "✅ disconnect() called")
        try {
            readerRunning.set(false)
            inp?.close()
            out?.close()
            sock?.close()
            sock = null
            inp = null
            out = null
            call.resolve()
        } catch (e: Exception) {
            call.reject("disconnect failed: ${e.message}")
        }
    }
    
    @PluginMethod
    fun scan(call: PluginCall) {
        Log.d(TAG, "✅ scan() called")
        if (!hasPermission("btConnect") || !hasPermission("btScan")) {
            requestAllPermissions(object : PermissionCallback {
                override fun onPermissionsResult(results: Array<String>) {
                    scan(call)
                }
            }, "btScan")
            return
        }
        
        try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
            val pairedDevices = adapter.bondedDevices
            val devices = JSObject()
            val deviceArray = mutableListOf<JSObject>()
            
            for (device in pairedDevices) {
                val dev = JSObject()
                dev.put("address", device.address)
                dev.put("name", device.name ?: "Unknown")
                deviceArray.add(dev)
            }
            
            devices.put("devices", deviceArray)
            call.resolve(devices)
        } catch (e: Exception) {
            Log.e(TAG, "scan error", e)
            call.reject("scan failed: ${e.message}")
        }
    }
}
