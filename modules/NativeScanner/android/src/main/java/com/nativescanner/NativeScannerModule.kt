package com.nativescanner

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
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
        
        // Noke Characteristics UUIDs
        private const val NOKE_RX_CHAR_UUID = "1bc50002-0200-d29e-e511-446c609db825"  // Write (where lock receives)
        private const val NOKE_TX_CHAR_UUID = "1bc50003-0200-d29e-e511-446c609db825"  // Read/Notify (where lock transmits)
        private const val NOKE_SESSION_CHAR_UUID = "1bc50004-0200-d29e-e511-446c609db825"  // Session/State
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
    
    // Noke Characteristics
    private var rxCharacteristic: BluetoothGattCharacteristic? = null
    private var txCharacteristic: BluetoothGattCharacteristic? = null
    private var sessionCharacteristic: BluetoothGattCharacteristic? = null
    private var currentDeviceId: String? = null
    private var writePromise: Promise? = null
    private var isInitializationComplete: Boolean = false

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        Log.d(TAG, "NativeScanner module initialized")
        
        // Check and log permission status
        val hasPerms = hasPermissions()
        Log.d(TAG, "Bluetooth permissions: ${if (hasPerms) "✅ GRANTED" else "❌ NOT GRANTED"}")
        
        if (!hasPerms) {
            Log.w(TAG, "⚠️ Bluetooth permissions not granted. App will need to request them.")
            Log.w(TAG, "   Required permissions:")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Log.w(TAG, "   - BLUETOOTH_SCAN")
                Log.w(TAG, "   - BLUETOOTH_CONNECT")
            } else {
                Log.w(TAG, "   - ACCESS_FINE_LOCATION")
            }
        }
    }
    
    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val hasPerms = hasPermissions()
        val result = Arguments.createMap().apply {
            putBoolean("granted", hasPerms)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                putBoolean("bluetoothScan", ActivityCompat.checkSelfPermission(
                    reactApplicationContext, 
                    Manifest.permission.BLUETOOTH_SCAN
                ) == PackageManager.PERMISSION_GRANTED)
                
                putBoolean("bluetoothConnect", ActivityCompat.checkSelfPermission(
                    reactApplicationContext, 
                    Manifest.permission.BLUETOOTH_CONNECT
                ) == PackageManager.PERMISSION_GRANTED)
            } else {
                putBoolean("location", ActivityCompat.checkSelfPermission(
                    reactApplicationContext, 
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED)
            }
        }
        promise.resolve(result)
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
        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "✅ MTU changed to: $mtu")
            } else {
                Log.w(TAG, "MTU change failed with status: $status, using default")
            }
            // Now discover services
            Log.d(TAG, "Discovering services...")
            gatt.discoverServices()
        }
        
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            val deviceInfo = Arguments.createMap().apply {
                putString("id", gatt.device.address)
                putString("name", gatt.device.name ?: "Unknown")
            }

            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    Log.d(TAG, "✅ Connected to: ${gatt.device.name ?: "Unknown"}")
                    Log.d(TAG, "Requesting MTU...")
                    currentDeviceId = gatt.device.address
                    isInitializationComplete = false
                    sendEvent("DeviceConnected", deviceInfo)
                    
                    // Request larger MTU for better performance
                    gatt.requestMtu(512)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "Disconnected from: ${gatt.device.name ?: "Unknown"}")
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        deviceInfo.putString("error", "Disconnection error: status $status")
                        Log.e(TAG, "Disconnection error: status $status")
                    }
                    sendEvent("DeviceDisconnected", deviceInfo)
                    
                    // Clear characteristics
                    rxCharacteristic = null
                    txCharacteristic = null
                    sessionCharacteristic = null
                    currentDeviceId = null
                    isInitializationComplete = false
                    
                    gatt.close()
                    if (connectedGatt == gatt) {
                        connectedGatt = null
                    }
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "Services discovered")
                val servicesCount = gatt.services.size
                Log.d(TAG, "Found $servicesCount services")
                
                // Find Noke service
                val nokeService = gatt.getService(UUID.fromString(NOKE_SERVICE_UUID))
                
                if (nokeService != null) {
                    Log.d(TAG, "Found Noke service, discovering characteristics...")
                    val characteristics = nokeService.characteristics
                    Log.d(TAG, "Discovered ${characteristics.size} characteristics")
                    
                    // Find characteristics
                    rxCharacteristic = characteristics.find { 
                        it.uuid.toString().equals(NOKE_RX_CHAR_UUID, ignoreCase = true)
                    }
                    txCharacteristic = characteristics.find { 
                        it.uuid.toString().equals(NOKE_TX_CHAR_UUID, ignoreCase = true)
                    }
                    sessionCharacteristic = characteristics.find { 
                        it.uuid.toString().equals(NOKE_SESSION_CHAR_UUID, ignoreCase = true)
                    }
                    
                    // Log what we found
                    if (rxCharacteristic != null) {
                        Log.d(TAG, "✓ RX Characteristic found (Read/Notify)")
                    }
                    
                    if (txCharacteristic != null) {
                        Log.d(TAG, "✓ TX Characteristic found (Write)")
                    }
                    
                    if (sessionCharacteristic != null) {
                        Log.d(TAG, "✓ Session Characteristic found (Read)")
                    }
                    
                    // Following official Noke library pattern:
                    // 1. First read session characteristic
                    // 2. Then enable notifications in onCharacteristicRead
                    // 3. Then mark as ready in onDescriptorWrite
                    if (sessionCharacteristic != null) {
                        Log.d(TAG, "Reading session characteristic...")
                        gatt.readCharacteristic(sessionCharacteristic)
                    } else {
                        Log.e(TAG, "❌ Session characteristic not found!")
                    }
                } else {
                    Log.e(TAG, "❌ Noke service not found")
                }
                
                val servicesMap = Arguments.createMap().apply {
                    putString("id", gatt.device.address)
                    putInt("servicesCount", servicesCount)
                }
                sendEvent("ServicesDiscovered", servicesMap)
            } else {
                Log.e(TAG, "❌ Service discovery failed: status $status")
            }
        }
        
        override fun onCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                val value = characteristic.value
                
                if (characteristic.uuid.toString().equals(NOKE_SESSION_CHAR_UUID, ignoreCase = true)) {
                    Log.d(TAG, "Session data received (${value.size} bytes)")
                    val sessionHex = value.joinToString("") { "%02X".format(it) }
                    Log.d(TAG, "Session: $sessionHex")
                    
                    val sessionMap = Arguments.createMap().apply {
                        putString("id", gatt.device.address)
                        putString("session", sessionHex)
                    }
                    sendEvent("SessionReady", sessionMap)
                    
                    // Following official Noke library: enable TX notifications AFTER reading session
                    // TX is where the lock transmits responses back to us
                    if (txCharacteristic != null) {
                        Log.d(TAG, "Enabling TX notifications (for receiving responses)...")
                        gatt.setCharacteristicNotification(txCharacteristic, true)
                        
                        val descriptor = txCharacteristic?.descriptors?.firstOrNull()
                        if (descriptor != null) {
                            descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                            Log.d(TAG, "Writing TX descriptor...")
                            gatt.writeDescriptor(descriptor)
                            // Will complete in onDescriptorWrite callback
                        } else {
                            // No descriptor - mark as ready immediately since setCharacteristicNotification
                            // doesn't require a GATT operation when there's no descriptor
                            Log.w(TAG, "No TX descriptor found, marking as ready immediately")
                            isInitializationComplete = true
                            Log.d(TAG, "✅ Initialization complete (no TX descriptor)")
                            
                            val charMap = Arguments.createMap().apply {
                                putString("id", gatt.device.address)
                            }
                            sendEvent("CharacteristicsReady", charMap)
                        }
                    } else {
                        // No TX characteristic, mark as ready
                        Log.w(TAG, "No TX characteristic found")
                        isInitializationComplete = true
                        Log.d(TAG, "✅ Initialization complete (no TX characteristic)")
                    }
                }
            }
        }
        
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic
        ) {
            // Response from lock (TX characteristic notification - lock transmits to us)
            if (characteristic.uuid.toString().equals(NOKE_TX_CHAR_UUID, ignoreCase = true)) {
                val value = characteristic.value
                val responseHex = value.joinToString("") { "%02X".format(it) }
                val responseType = if (value.isNotEmpty()) "0x%02X".format(value[0]) else "0x00"
                
                Log.d(TAG, "📨 Response from lock (TX): $responseHex")
                Log.d(TAG, "Response type: $responseType")
                
                val responseMap = Arguments.createMap().apply {
                    putString("deviceId", gatt.device.address)
                    putString("response", value.joinToString(" ") { "%02X".format(it) })
                    putString("responseType", responseType)
                }
                sendEvent("CommandResponse", responseMap)
            }
        }
        
        override fun onCharacteristicWrite(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "✅ Characteristic write successful")
                writePromise?.resolve(true)
            } else {
                Log.e(TAG, "❌ Characteristic write failed with status: $status")
                writePromise?.reject("WRITE_FAILED", "Failed to write characteristic (status: $status)")
            }
            writePromise = null
        }
        
        override fun onDescriptorWrite(
            gatt: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int
        ) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "✅ Descriptor write successful (TX notifications enabled for responses)")
            } else {
                Log.e(TAG, "❌ Descriptor write failed with status: $status")
            }
            
            // Following official Noke library: this is the FINAL step
            // Session was already read, TX notifications are now enabled, device is ready
            isInitializationComplete = true
            Log.d(TAG, "✅ Initialization complete, device ready for commands")
            
            val charMap = Arguments.createMap().apply {
                putString("id", gatt.device.address)
            }
            sendEvent("CharacteristicsReady", charMap)
        }
    }

    // MARK: - Send Commands

    @ReactMethod
    fun sendCommands(commandString: String, deviceId: String, promise: Promise) {
        Log.d(TAG, "📤 sendCommands called: $commandString")
        Log.d(TAG, "Device ID requested: $deviceId")
        Log.d(TAG, "Current device ID: $currentDeviceId")
        Log.d(TAG, "GATT connected: ${connectedGatt != null}")
        Log.d(TAG, "RX Char exists: ${rxCharacteristic != null}")
        Log.d(TAG, "Initialization complete: $isInitializationComplete")
        
        if (connectedGatt == null) {
            promise.reject("NOT_CONNECTED", "Device not connected")
            return
        }
        
        if (rxCharacteristic == null) {
            promise.reject("CHAR_NOT_FOUND", "RX characteristic not found (needed for writing)")
            return
        }
        
        // Ensure initialization is complete before allowing writes
        if (!isInitializationComplete) {
            promise.reject("NOT_READY", "Device not ready - initialization in progress")
            return
        }
        
        // Check if there's already a write in progress
        if (writePromise != null) {
            promise.reject("WRITE_IN_PROGRESS", "Another write operation is in progress")
            return
        }
        
        try {
            // Parse command string (can have multiple commands separated by +)
            val commands = commandString.split("+")
            
            // For now, just handle the first command
            // TODO: Handle multiple commands sequentially
            val command = commands[0].trim()
            
            if (command.isEmpty()) {
                promise.reject("INVALID_COMMAND", "Empty command string")
                return
            }
            
            // Convert hex string to bytes
            val bytes = hexStringToByteArray(command)
            
            Log.d(TAG, "📤 Command bytes (${bytes.size}): ${bytes.joinToString("") { "%02X".format(it) }}")
            Log.d(TAG, "RX Characteristic (for writing): ${rxCharacteristic?.uuid}")
            Log.d(TAG, "RX Properties: ${rxCharacteristic?.properties}")
            Log.d(TAG, "RX Permissions: ${rxCharacteristic?.permissions}")
            Log.d(TAG, "GATT connection state: ${bluetoothManager.getConnectionState(connectedGatt?.device, BluetoothProfile.GATT)}")
            
            // Store the promise for the callback
            writePromise = promise
            
            // IMPORTANT: Following Noke library convention:
            // - RX characteristic = where we WRITE commands (lock receives)
            // - TX characteristic = where we READ responses (lock transmits)
            rxCharacteristic?.value = bytes
            rxCharacteristic?.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            
            Log.d(TAG, "Attempting write to RX characteristic with WRITE_TYPE_NO_RESPONSE")
            
            // Write to RX characteristic (where lock receives commands)
            val writeStarted = connectedGatt?.writeCharacteristic(rxCharacteristic)
            
            Log.d(TAG, "writeCharacteristic returned: $writeStarted")
            
            if (writeStarted != true) {
                writePromise = null
                promise.reject("WRITE_START_FAILED", "Failed to start write operation (writeCharacteristic returned false)")
            }
            // If NO_RESPONSE, the write completes immediately without callback
            else if (rxCharacteristic?.writeType == BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE) {
                // NO_RESPONSE writes don't trigger onCharacteristicWrite callback
                Log.d(TAG, "✅ Write initiated successfully (NO_RESPONSE type)")
                writePromise?.resolve(true)
                writePromise = null
            }
            // Otherwise wait for onCharacteristicWrite callback
            
        } catch (e: Exception) {
            writePromise = null
            Log.e(TAG, "❌ Error sending commands: ${e.message}", e)
            
            if (e.message?.contains("hex") == true || e.message?.contains("Invalid") == true) {
                promise.reject("INVALID_COMMAND", e.message, e)
            } else {
                promise.reject("WRITE_ERROR", e.message, e)
            }
        }
    }
    
    private fun hexStringToByteArray(hexString: String): ByteArray {
        val cleanHex = hexString.replace("\\s+".toRegex(), "").replace(":", "")
        
        if (cleanHex.length % 2 != 0) {
            throw IllegalArgumentException("Invalid hex string: $hexString")
        }
        
        return ByteArray(cleanHex.length / 2) { i ->
            cleanHex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
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

