import Foundation
import CoreBluetooth
// import NokeMobileLibrary  // TODO: Add to Podfile when ready - not needed for current functionality

@objc(NativeScanner)
class NativeScanner: RCTEventEmitter, CBCentralManagerDelegate, CBPeripheralDelegate {
    
    private var centralManager: CBCentralManager!
    private var discoveredPeripherals: [String: CBPeripheral] = [:]
    private var connectedPeripheral: CBPeripheral?
    private var isCurrentlyScanning = false
    private var scanTimer: Timer?
    
    // MARK: - Filter Configuration
    
    /// RSSI threshold in dBm. Devices with weaker signal are filtered out.
    /// Default: -89 (same as main app)
    /// Closer to 0 = stronger signal
    private var rssiThreshold: Int = -89
    
    /// Use Service UUID filter (most important filter - eliminates 99% of BLE devices)
    /// Default: true (same as main app)
    /// This is the CRITICAL filter that does 99% of the work
    private var useServiceUUIDFilter: Bool = true
    
    /// Filter to only show Noke devices (by name or manufacturer data)
    /// Default: false (redundant with Service UUID filter)
    /// Only useful if Service UUID filter is disabled for debugging
    private var filterNokeOnly: Bool = false
    
    // MARK: - Noke Service UUIDs (from NokeDevice.swift)
    
    /// Main Noke service UUID - all Noke devices advertise this
    private static let nokeServiceUUID = CBUUID(string: "1bc50001-0200-d29e-e511-446c609db825")
    
    /// Firmware update mode UUID (for Noke 2i and 4i devices)
    private static let nokeFirmwareUUID = CBUUID(string: "0000fe59-0000-1000-8000-00805f9b34fb")
    
    override init() {
        super.init()
        let queue = DispatchQueue(label: "com.noke.scanner", qos: .userInitiated)
        centralManager = CBCentralManager(delegate: self, queue: queue, options: [CBCentralManagerOptionShowPowerAlertKey: false])
    }
    
    override class func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    override func supportedEvents() -> [String]! {
        return [
            "DeviceDiscovered", 
            "ScanStopped", 
            "BluetoothStateChanged",
            "DeviceConnected",
            "DeviceDisconnected",
            "DeviceConnectionError"
        ]
    }
    
    // MARK: - Exported Methods
    
    @objc(startScan:resolve:reject:)
    func startScan(durationSeconds: Double,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("[NativeScanner] startScan called with duration: %.0f seconds", durationSeconds)
        
        guard centralManager.state == .poweredOn else {
            let errorMsg = "Bluetooth is not powered on"
            NSLog("[NativeScanner] ERROR: %@", errorMsg)
            reject("BLE_NOT_READY", errorMsg, nil)
            return
        }
        
        if isCurrentlyScanning {
            NSLog("[NativeScanner] Already scanning, stopping first")
            centralManager.stopScan()
        }
        
        isCurrentlyScanning = true
        
        // Start scanning with duplicates allowed
        let options: [String: Any] = [
            CBCentralManagerScanOptionAllowDuplicatesKey: true
        ]
        
        // CRITICAL FILTER: Service UUIDs
        // This is the most important filter - Core Bluetooth will only return devices
        // that advertise these specific services, eliminating 99% of BLE devices
        let serviceUUIDs: [CBUUID]? = useServiceUUIDFilter ? [
            NativeScanner.nokeServiceUUID,    // Main Noke service
            NativeScanner.nokeFirmwareUUID    // Firmware update mode
        ] : nil
        
        if useServiceUUIDFilter {
            NSLog("[NativeScanner] Starting BLE scan with Noke Service UUID filter (eliminates non-Noke devices)")
        } else {
            NSLog("[NativeScanner] Starting BLE scan WITHOUT Service UUID filter (will see ALL BLE devices)")
        }
        
        centralManager.scanForPeripherals(withServices: serviceUUIDs, options: options)
        
        // Auto-stop after duration
        if durationSeconds > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + durationSeconds) { [weak self] in
                guard let self = self else { return }
                if self.isCurrentlyScanning {
                    NSLog("[NativeScanner] Auto-stopping scan after timeout")
                    self.stopScanInternal()
                }
            }
        }
        
        resolve(true)
    }
    
    @objc(stopScan:reject:)
    func stopScan(resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
        NSLog("[NativeScanner] stopScan called")
        stopScanInternal()
        resolve(true)
    }
    
    @objc(isScanning:reject:)
    func isScanning(resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
        resolve(isCurrentlyScanning)
    }
    
    private func stopScanInternal() {
        if isCurrentlyScanning {
            isCurrentlyScanning = false
            centralManager.stopScan()
            NSLog("[NativeScanner] Scan stopped")
            sendEvent(withName: "ScanStopped", body: [:])
        }
    }
    
    // MARK: - CBCentralManagerDelegate
    
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let state: String
        
        switch central.state {
        case .unknown:
            state = "unknown"
        case .resetting:
            state = "resetting"
        case .unsupported:
            state = "unsupported"
        case .unauthorized:
            state = "unauthorized"
        case .poweredOff:
            state = "off"
        case .poweredOn:
            state = "on"
        @unknown default:
            state = "unknown"
        }
        
        NSLog("[NativeScanner] Bluetooth state: %@", state)
        sendEvent(withName: "BluetoothStateChanged", body: ["state": state])
    }
    
    func centralManager(_ central: CBCentralManager,
                       didDiscover peripheral: CBPeripheral,
                       advertisementData: [String: Any],
                       rssi RSSI: NSNumber) {
        
        // FILTER #1: RSSI Threshold (Distance Filter)
        // Ignore devices that are too far away (weaker signal than threshold)
        if RSSI.intValue < rssiThreshold {
            NSLog("[NativeScanner] FILTERED OUT (RSSI): %@ (RSSI: %@ < %d)", 
                  peripheral.name ?? "Unknown", RSSI, rssiThreshold)
            return
        }
        
        // FILTER #2: Noke Devices Only (Optional - mostly redundant with Service UUID)
        // This filter is only active if explicitly enabled or if Service UUID filter is disabled
        if filterNokeOnly {
            let isNokeDevice = checkIsNokeDevice(peripheral: peripheral, advertisementData: advertisementData)
            if !isNokeDevice {
                NSLog("[NativeScanner] FILTERED OUT (Not Noke): %@", peripheral.name ?? "Unknown")
                return
            }
        }
        
        // ✅ PASSED ALL FILTERS
        // Note: If Service UUID filter is enabled (default), only Noke devices reach this point
        let peripheralId = peripheral.identifier.uuidString
        
        // Store discovered peripheral
        discoveredPeripherals[peripheralId] = peripheral
        
        // Parse advertising data
        var advertising: [String: Any] = [:]
        
        if let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String {
            advertising["localName"] = localName
        }
        
        if let serviceUUIDs = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] {
            advertising["serviceUUIDs"] = serviceUUIDs.map { $0.uuidString }
        }
        
        if let isConnectable = advertisementData[CBAdvertisementDataIsConnectable] as? NSNumber {
            advertising["isConnectable"] = isConnectable
        }
        
        // Extract additional Noke data from manufacturer data
        if let nokeData = extractNokeData(from: advertisementData) {
            advertising["macAddress"] = nokeData.macAddress
            if let version = nokeData.version {
                advertising["version"] = version
            }
            if let battery = nokeData.battery {
                advertising["battery"] = battery
            }
            advertising["manufacturerDataLength"] = nokeData.dataLength
        }
        
        // Build device info
        let deviceInfo: [String: Any] = [
            "id": peripheralId,
            "name": peripheral.name ?? "Unknown",
            "rssi": RSSI,
            "advertising": advertising
        ]
        
        NSLog("[NativeScanner] ✅ Discovered NOKE device: %@ (RSSI: %@)", 
              peripheral.name ?? "Unknown", RSSI)
        
        // Send event to JavaScript
        sendEvent(withName: "DeviceDiscovered", body: deviceInfo)
    }
    
    // MARK: - Filter Helper Methods
    
    /// Checks if a peripheral is a Noke device based on name and/or manufacturer data
    private func checkIsNokeDevice(peripheral: CBPeripheral, advertisementData: [String: Any]) -> Bool {
        
        // Method 1: Check peripheral name
        if let name = peripheral.name, isNokeDeviceName(name) {
            return true
        }
        
        // Method 2: Check local name in advertisement data
        if let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String,
           isNokeDeviceName(localName) {
            return true
        }
        
        // Method 3: Check manufacturer data (Noke-specific format)
        if let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data {
            return isNokeManufacturerData(manufacturerData)
        }
        
        return false
    }
    
    /// Validates if a device name belongs to a Noke device
    private func isNokeDeviceName(_ name: String) -> Bool {
        let nokePrefixes = ["Noke", "NokeFob", "NOKE", "noke"]
        return nokePrefixes.contains { name.hasPrefix($0) }
    }
    
    /// Validates if manufacturer data is from a Noke device
    /// Based on the format used in NokeDeviceManager.swift
    private func isNokeManufacturerData(_ data: Data) -> Bool {
        let bytes = [UInt8](data)
        
        // Noke devices broadcast at least 16 bytes
        // Format includes MAC address in bytes 11-16 (reversed)
        if bytes.count >= 16 {
            // Additional validation could be added here based on
            // specific manufacturer ID or data patterns
            // For now, we validate minimum length
            return true
        }
        
        return false
    }
    
    /// Structure to hold extracted Noke device data
    private struct NokeDeviceData {
        let macAddress: String
        let version: String?
        let battery: Int?
        let dataLength: Int
        let rawData: String  // Hex representation for debugging
    }
    
    /// Extracts Noke-specific data from manufacturer data
    /// Based on Noke BLE protocol format
    private func extractNokeData(from advertisementData: [String: Any]) -> NokeDeviceData? {
        guard let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data else {
            return nil
        }
        
        let bytes = [UInt8](manufacturerData)
        let dataLength = bytes.count
        
        // Convert to hex string for debugging
        let hexString = bytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        
        // Noke devices typically have at least 17 bytes of manufacturer data
        // Format (based on NokeDeviceManager):
        // Bytes 0-1:   Manufacturer ID
        // Bytes 2-10:  Various flags and data
        // Bytes 11-16: MAC address (reversed)
        // Byte 17+:    Additional data (version, battery, etc.)
        
        guard bytes.count >= 17 else {
            NSLog("[NativeScanner] Manufacturer data too short (%d bytes): %@", dataLength, hexString)
            return nil
        }
        
        // Extract MAC address (bytes 11-16, reversed)
        let mac = String(format: "%02X:%02X:%02X:%02X:%02X:%02X",
                       bytes[16], bytes[15], bytes[14],
                       bytes[13], bytes[12], bytes[11])
        
        // Extract version if available (byte 17)
        var version: String? = nil
        if bytes.count > 17 {
            version = String(format: "v%d.%d", bytes[17] >> 4, bytes[17] & 0x0F)
        }
        
        // Extract battery level if available (byte 18)
        var battery: Int? = nil
        if bytes.count > 18 {
            battery = Int(bytes[18])
        }
        
        NSLog("[NativeScanner] 📦 Manufacturer Data (%d bytes): %@", dataLength, hexString)
        NSLog("[NativeScanner]    MAC: %@, Version: %@, Battery: %@", 
              mac, version ?? "N/A", battery != nil ? "\(battery!)%" : "N/A")
        
        return NokeDeviceData(
            macAddress: mac,
            version: version,
            battery: battery,
            dataLength: dataLength,
            rawData: hexString
        )
    }
    
    // MARK: - Configuration Methods
    
    @objc(setRSSIThreshold:resolve:reject:)
    func setRSSIThreshold(_ threshold: Int,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        rssiThreshold = threshold
        NSLog("[NativeScanner] RSSI threshold set to: %d dBm", threshold)
        resolve(true)
    }
    
    @objc(setFilterNokeOnly:resolve:reject:)
    func setFilterNokeOnly(_ enabled: Bool,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        filterNokeOnly = enabled
        NSLog("[NativeScanner] Noke-only filter: %@", enabled ? "ENABLED" : "DISABLED")
        resolve(true)
    }
    
    @objc(setServiceUUIDFilter:resolve:reject:)
    func setServiceUUIDFilter(_ enabled: Bool,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        useServiceUUIDFilter = enabled
        NSLog("[NativeScanner] Service UUID filter: %@", enabled ? "ENABLED (Only Noke devices)" : "DISABLED (All BLE devices)")
        resolve(true)
    }
    
    @objc(getFilterSettings:reject:)
    func getFilterSettings(resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        let settings: [String: Any] = [
            "rssiThreshold": rssiThreshold,
            "filterNokeOnly": filterNokeOnly,
            "useServiceUUIDFilter": useServiceUUIDFilter
        ]
        resolve(settings)
    }
    
    // MARK: - Connection Methods
    
    @objc(connect:resolve:reject:)
    func connect(_ deviceId: String,
                resolve: @escaping RCTPromiseResolveBlock,
                reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("[NativeScanner] connect called for device: %@", deviceId)
        
        guard centralManager.state == .poweredOn else {
            let errorMsg = "Bluetooth is not powered on"
            NSLog("[NativeScanner] ERROR: %@", errorMsg)
            reject("BLE_NOT_READY", errorMsg, nil)
            return
        }
        
        guard let peripheral = discoveredPeripherals[deviceId] else {
            let errorMsg = "Device not found. Make sure to scan first."
            NSLog("[NativeScanner] ERROR: %@", errorMsg)
            reject("DEVICE_NOT_FOUND", errorMsg, nil)
            return
        }
        
        // Stop scanning before connecting (best practice)
        if isCurrentlyScanning {
            NSLog("[NativeScanner] Stopping scan before connection")
            centralManager.stopScan()
            isCurrentlyScanning = false
        }
        
        // Set delegate to receive peripheral events
        peripheral.delegate = self
        
        // Store reference to connecting peripheral
        connectedPeripheral = peripheral
        
        NSLog("[NativeScanner] Connecting to: %@", peripheral.name ?? "Unknown")
        centralManager.connect(peripheral, options: nil)
        
        resolve(true)
    }
    
    @objc(disconnect:resolve:reject:)
    func disconnect(_ deviceId: String,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("[NativeScanner] disconnect called for device: %@", deviceId)
        
        guard let peripheral = discoveredPeripherals[deviceId] else {
            let errorMsg = "Device not found"
            NSLog("[NativeScanner] ERROR: %@", errorMsg)
            reject("DEVICE_NOT_FOUND", errorMsg, nil)
            return
        }
        
        if peripheral.state == .connected || peripheral.state == .connecting {
            NSLog("[NativeScanner] Disconnecting from: %@", peripheral.name ?? "Unknown")
            centralManager.cancelPeripheralConnection(peripheral)
        } else {
            NSLog("[NativeScanner] Device already disconnected")
        }
        
        connectedPeripheral = nil
        resolve(true)
    }
    
    @objc(getConnectionState:resolve:reject:)
    func getConnectionState(_ deviceId: String,
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        
        guard let peripheral = discoveredPeripherals[deviceId] else {
            resolve("disconnected")
            return
        }
        
        let state: String
        switch peripheral.state {
        case .disconnected:
            state = "disconnected"
        case .connecting:
            state = "connecting"
        case .connected:
            state = "connected"
        case .disconnecting:
            state = "disconnecting"
        @unknown default:
            state = "unknown"
        }
        
        resolve(state)
    }
    
    // MARK: - CBCentralManager Connection Delegate
    
    func centralManager(_ central: CBCentralManager, 
                       didConnect peripheral: CBPeripheral) {
        
        NSLog("[NativeScanner] ✅ Connected to: %@", peripheral.name ?? "Unknown")
        
        // Send event to JavaScript
        let deviceInfo: [String: Any] = [
            "id": peripheral.identifier.uuidString,
            "name": peripheral.name ?? "Unknown"
        ]
        
        sendEvent(withName: "DeviceConnected", body: deviceInfo)
    }
    
    func centralManager(_ central: CBCentralManager, 
                       didDisconnectPeripheral peripheral: CBPeripheral, 
                       error: Error?) {
        
        NSLog("[NativeScanner] Disconnected from: %@", peripheral.name ?? "Unknown")
        
        if connectedPeripheral?.identifier == peripheral.identifier {
            connectedPeripheral = nil
        }
        
        // Send event to JavaScript
        var deviceInfo: [String: Any] = [
            "id": peripheral.identifier.uuidString,
            "name": peripheral.name ?? "Unknown"
        ]
        
        if let error = error {
            deviceInfo["error"] = error.localizedDescription
            NSLog("[NativeScanner] Disconnection error: %@", error.localizedDescription)
        }
        
        sendEvent(withName: "DeviceDisconnected", body: deviceInfo)
    }
    
    func centralManager(_ central: CBCentralManager, 
                       didFailToConnect peripheral: CBPeripheral, 
                       error: Error?) {
        
        NSLog("[NativeScanner] ❌ Failed to connect to: %@", peripheral.name ?? "Unknown")
        
        if connectedPeripheral?.identifier == peripheral.identifier {
            connectedPeripheral = nil
        }
        
        // Send event to JavaScript
        let deviceInfo: [String: Any] = [
            "id": peripheral.identifier.uuidString,
            "name": peripheral.name ?? "Unknown",
            "error": error?.localizedDescription ?? "Unknown error"
        ]
        
        sendEvent(withName: "DeviceConnectionError", body: deviceInfo)
    }
    
    // MARK: - Event Emitter Methods (Required for New Architecture)
    
    @objc
    override func addListener(_ eventName: String) {
        super.addListener(eventName)
    }
    
    @objc
    override func removeListeners(_ count: Double) {
        super.removeListeners(count)
    }
}

