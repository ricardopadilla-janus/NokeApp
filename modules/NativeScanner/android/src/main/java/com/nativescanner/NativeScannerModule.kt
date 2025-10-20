package com.nativescanner

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.*

class NativeScannerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "NativeScanner"
        private const val MODULE_NAME = "NativeScanner"
        
        // Noke Service UUIDs (same as iOS)
        private const val NOKE_SERVICE_UUID = "1bc50001-0200-d29e-e511-446c609db825"
        private const val NOKE_FIRMWARE_UUID = "0000fe59-0000-1000-8000-00805f9b34fb"
    }

    private val bluetoothManager: BluetoothManager =
        reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter
    private var bluetoothLeScanner: BluetoothLeScanner? = bluetoothAdapter?.bluetoothLeScanner
    
    private val discoveredDevices = mutableMapOf<String, BluetoothDevice>()
    private var connectedGatt: BluetoothGatt? = null
    private var isCurrentlyScanning = false
    private val mainHandler = Handler(Looper.getMainLooper())
    
    // Filter configuration
    private var rssiThreshold: Int = -89
    private var filterNokeOnly: Boolean = false
    private var useServiceUUIDFilter: Boolean = true

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        Log.d(TAG, "NativeScanner module initialized")
    }

    // MARK: - Event Emission

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // MARK: - Scanning Methods

    @ReactMethod
    fun startScan(durationSeconds: Double, promise: Promise) {
        Log.d(TAG, "startScan called with duration: $durationSeconds seconds")

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            Log.e(TAG, "ERROR: Bluetooth is not enabled")
            promise.reject("BLE_NOT_READY", "Bluetooth is not enabled")
            return
        }

        if (!hasPermissions()) {
            Log.e(TAG, "ERROR: Missing Bluetooth permissions")
            promise.reject("PERMISSION_DENIED", "Bluetooth permissions not granted")
            return
        }

        if (isCurrentlyScanning) {
            Log.d(TAG, "Already scanning, stopping first")
            stopScanInternal()
        }

        isCurrentlyScanning = true

        // Build scan filters
        val filters = if (useServiceUUIDFilter) {
            listOf(
                ScanFilter.Builder()
                    .setServiceUuid(ParcelUuid.fromString(NOKE_SERVICE_UUID))
                    .build(),
                ScanFilter.Builder()
                    .setServiceUuid(ParcelUuid.fromString(NOKE_FIRMWARE_UUID))
                    .build()
            )
        } else {
            emptyList()
        }

        // Scan settings
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .build()

        Log.d(TAG, if (useServiceUUIDFilter) 
            "Starting BLE scan with Noke Service UUID filter" 
            else 
            "Starting BLE scan WITHOUT Service UUID filter (will see ALL BLE devices)")

        try {
            bluetoothLeScanner?.startScan(filters, settings, scanCallback)
            
            // Auto-stop after duration
            if (durationSeconds > 0) {
                mainHandler.postDelayed({
                    if (isCurrentlyScanning) {
                        Log.d(TAG, "Auto-stopping scan after timeout")
                        stopScanInternal()
                    }
                }, (durationSeconds * 1000).toLong())
            }
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting scan", e)
            isCurrentlyScanning = false
            promise.reject("SCAN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        Log.d(TAG, "stopScan called")
        stopScanInternal()
        promise.resolve(true)
    }

    @ReactMethod
    fun isScanning(promise: Promise) {
        promise.resolve(isCurrentlyScanning)
    }

    private fun stopScanInternal() {
        if (isCurrentlyScanning) {
            isCurrentlyScanning = false
            try {
                bluetoothLeScanner?.stopScan(scanCallback)
                Log.d(TAG, "Scan stopped")
                sendEvent("ScanStopped", Arguments.createMap())
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping scan", e)
            }
        }
    }

    // MARK: - Scan Callback

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            val rssi = result.rssi
            val scanRecord = result.scanRecord

            // FILTER #1: RSSI Threshold
            if (rssi < rssiThreshold) {
                Log.d(TAG, "FILTERED OUT (RSSI): ${device.name ?: "Unknown"} (RSSI: $rssi < $rssiThreshold)")
                return
            }

            // FILTER #2: Noke Devices Only (secondary filter)
            if (filterNokeOnly && !isNokeDevice(device, scanRecord)) {
                Log.d(TAG, "FILTERED OUT (Not Noke): ${device.name ?: "Unknown"}")
                return
            }

            // Store discovered device
            discoveredDevices[device.address] = device

            // Build device info
            val deviceInfo = Arguments.createMap().apply {
                putString("id", device.address)
                putString("name", device.name ?: "Unknown")
                putInt("rssi", rssi)

                // Advertising data
                val advertising = Arguments.createMap()
                scanRecord?.let { record ->
                    record.deviceName?.let { advertising.putString("localName", it) }
                    
                    record.serviceUuids?.let { uuids ->
                        val uuidArray = Arguments.createArray()
                        uuids.forEach { uuidArray.pushString(it.toString()) }
                        advertising.putArray("serviceUUIDs", uuidArray)
                    }

                    // Extract Noke-specific data from manufacturer data
                    record.manufacturerSpecificData?.let { data ->
                        extractNokeData(data)?.let { nokeData ->
                            advertising.putString("macAddress", nokeData.macAddress)
                            nokeData.version?.let { advertising.putString("version", it) }
                            nokeData.battery?.let { advertising.putInt("battery", it) }
                            advertising.putInt("manufacturerDataLength", nokeData.dataLength)
                        }
                    }
                }
                putMap("advertising", advertising)
            }

            Log.d(TAG, "✅ Discovered NOKE device: ${device.name ?: "Unknown"} (RSSI: $rssi)")
            sendEvent("DeviceDiscovered", deviceInfo)
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "Scan failed with error code: $errorCode")
            isCurrentlyScanning = false
            val errorMap = Arguments.createMap().apply {
                putInt("errorCode", errorCode)
                putString("message", getScanErrorMessage(errorCode))
            }
            sendEvent("ScanStopped", errorMap)
        }
    }

    // MARK: - Filter Configuration

    @ReactMethod
    fun setRSSIThreshold(threshold: Int, promise: Promise) {
        rssiThreshold = threshold
        Log.d(TAG, "RSSI threshold set to: $threshold dBm")
        promise.resolve(true)
    }

    @ReactMethod
    fun setFilterNokeOnly(enabled: Boolean, promise: Promise) {
        filterNokeOnly = enabled
        Log.d(TAG, "Noke-only filter: ${if (enabled) "ENABLED" else "DISABLED"}")
        promise.resolve(true)
    }

    @ReactMethod
    fun setServiceUUIDFilter(enabled: Boolean, promise: Promise) {
        useServiceUUIDFilter = enabled
        Log.d(TAG, "Service UUID filter: ${if (enabled) "ENABLED (Only Noke)" else "DISABLED (All BLE)"}")
        promise.resolve(true)
    }

    @ReactMethod
    fun getFilterSettings(promise: Promise) {
        val settings = Arguments.createMap().apply {
            putInt("rssiThreshold", rssiThreshold)
            putBoolean("filterNokeOnly", filterNokeOnly)
            putBoolean("useServiceUUIDFilter", useServiceUUIDFilter)
        }
        promise.resolve(settings)
    }

    // MARK: - Connection Methods

    @ReactMethod
    fun connect(deviceId: String, promise: Promise) {
        Log.d(TAG, "connect called for device: $deviceId")

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            promise.reject("BLE_NOT_READY", "Bluetooth is not enabled")
            return
        }

        val device = discoveredDevices[deviceId]
        if (device == null) {
            promise.reject("DEVICE_NOT_FOUND", "Device not found. Make sure to scan first.")
            return
        }

        // Stop scanning before connecting
        if (isCurrentlyScanning) {
            Log.d(TAG, "Stopping scan before connection")
            stopScanInternal()
        }

        try {
            Log.d(TAG, "Connecting to: ${device.name ?: "Unknown"}")
            connectedGatt = device.connectGatt(reactApplicationContext, false, gattCallback)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Connection error", e)
            promise.reject("CONNECTION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun disconnect(deviceId: String, promise: Promise) {
        Log.d(TAG, "disconnect called for device: $deviceId")

        try {
            connectedGatt?.let {
                Log.d(TAG, "Disconnecting from: ${it.device.name ?: "Unknown"}")
                it.disconnect()
                it.close()
                connectedGatt = null
            } ?: Log.d(TAG, "Device already disconnected")
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Disconnection error", e)
            promise.reject("DISCONNECTION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getConnectionState(deviceId: String, promise: Promise) {
        val device = discoveredDevices[deviceId]
        if (device == null) {
            promise.resolve("disconnected")
            return
        }

        val state = bluetoothManager.getConnectionState(device, BluetoothProfile.GATT)
        val stateString = when (state) {
            BluetoothProfile.STATE_CONNECTED -> "connected"
            BluetoothProfile.STATE_CONNECTING -> "connecting"
            BluetoothProfile.STATE_DISCONNECTING -> "disconnecting"
            else -> "disconnected"
        }
        
        promise.resolve(stateString)
    }

    // MARK: - GATT Callback

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            val deviceInfo = Arguments.createMap().apply {
                putString("id", gatt.device.address)
                putString("name", gatt.device.name ?: "Unknown")
            }

            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    Log.d(TAG, "✅ Connected to: ${gatt.device.name ?: "Unknown"}")
                    sendEvent("DeviceConnected", deviceInfo)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "Disconnected from: ${gatt.device.name ?: "Unknown"}")
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        deviceInfo.putString("error", "Disconnection error: status $status")
                        Log.e(TAG, "Disconnection error: status $status")
                    }
                    sendEvent("DeviceDisconnected", deviceInfo)
                    gatt.close()
                    if (connectedGatt == gatt) {
                        connectedGatt = null
                    }
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "Services discovered for ${gatt.device.name}")
            }
        }
    }

    // MARK: - Helper Methods

    private fun isNokeDevice(device: BluetoothDevice, scanRecord: android.bluetooth.le.ScanRecord?): Boolean {
        // Check device name
        device.name?.let { name ->
            if (isNokeDeviceName(name)) return true
        }

        // Check local name in scan record
        scanRecord?.deviceName?.let { localName ->
            if (isNokeDeviceName(localName)) return true
        }

        // Check manufacturer data
        scanRecord?.manufacturerSpecificData?.let { data ->
            if (isNokeManufacturerData(data)) return true
        }

        return false
    }

    private fun isNokeDeviceName(name: String): Boolean {
        val nokePrefixes = listOf("Noke", "NokeFob", "NOKE", "noke")
        return nokePrefixes.any { name.startsWith(it) }
    }

    private fun isNokeManufacturerData(data: android.util.SparseArray<ByteArray>): Boolean {
        // Check if any manufacturer data has at least 16 bytes (Noke format)
        for (i in 0 until data.size()) {
            if (data.valueAt(i).size >= 16) {
                return true
            }
        }
        return false
    }

    private data class NokeDeviceData(
        val macAddress: String,
        val version: String?,
        val battery: Int?,
        val dataLength: Int,
        val rawData: String
    )

    private fun extractNokeData(manufacturerData: android.util.SparseArray<ByteArray>): NokeDeviceData? {
        // Get first manufacturer data (usually there's only one)
        if (manufacturerData.size() == 0) return null
        
        val bytes = manufacturerData.valueAt(0)
        val dataLength = bytes.size

        // Convert to hex string for debugging
        val hexString = bytes.joinToString(" ") { "%02X".format(it) }

        if (bytes.size < 17) {
            Log.d(TAG, "Manufacturer data too short ($dataLength bytes): $hexString")
            return null
        }

        // Extract MAC address (bytes 11-16, reversed)
        val mac = "%02X:%02X:%02X:%02X:%02X:%02X".format(
            bytes[16], bytes[15], bytes[14],
            bytes[13], bytes[12], bytes[11]
        )

        // Extract version if available (byte 17)
        val version = if (bytes.size > 17) {
            val versionByte = bytes[17].toInt() and 0xFF
            "v${versionByte shr 4}.${versionByte and 0x0F}"
        } else null

        // Extract battery level if available (byte 18)
        val battery = if (bytes.size > 18) {
            bytes[18].toInt() and 0xFF
        } else null

        Log.d(TAG, "📦 Manufacturer Data ($dataLength bytes): $hexString")
        Log.d(TAG, "   MAC: $mac, Version: ${version ?: "N/A"}, Battery: ${battery?.let { "$it%" } ?: "N/A"}")

        return NokeDeviceData(mac, version, battery, dataLength, hexString)
    }

    private fun hasPermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun getScanErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            ScanCallback.SCAN_FAILED_ALREADY_STARTED -> "Scan already started"
            ScanCallback.SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "App registration failed"
            ScanCallback.SCAN_FAILED_FEATURE_UNSUPPORTED -> "BLE scan feature not supported"
            ScanCallback.SCAN_FAILED_INTERNAL_ERROR -> "Internal error"
            else -> "Unknown error: $errorCode"
        }
    }

    // MARK: - Event Emitter Support

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RCTEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // Required for RCTEventEmitter
    }
}

