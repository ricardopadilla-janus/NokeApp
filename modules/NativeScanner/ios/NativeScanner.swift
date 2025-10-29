import Foundation
import CoreBluetooth
import CommonCrypto
// import NokeMobileLibrary  // TODO: Add to Podfile when ready - not needed for current functionality

@objc(NativeScanner)
class NativeScanner: RCTEventEmitter, CBCentralManagerDelegate, CBPeripheralDelegate {
    
    private var centralManager: CBCentralManager!
    private var discoveredPeripherals: [String: CBPeripheral] = [:]
    private var connectedPeripheral: CBPeripheral?
    private var isCurrentlyScanning = false
    private var scanTimer: Timer?
    
    // MARK: - Noke Device Characteristics
    private var nokeService: CBService?
    private var txCharacteristic: CBCharacteristic?  // Write
    private var rxCharacteristic: CBCharacteristic?  // Read (notifications)
    private var sessionCharacteristic: CBCharacteristic?  // Session for encryption
    private var sessionData: Data?
    private var commandQueue: [Data] = []
    
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
    
    // MARK: - Noke Characteristic UUIDs
    
    /// TX Characteristic (Write) - for sending commands to lock
    private static let txCharacteristicUUID = CBUUID(string: "1bc50002-0200-d29e-e511-446c609db825")
    
    /// RX Characteristic (Read/Notify) - for receiving responses from lock
    private static let rxCharacteristicUUID = CBUUID(string: "1bc50003-0200-d29e-e511-446c609db825")
    
    /// Session Characteristic - provides session data for encryption
    private static let sessionCharacteristicUUID = CBUUID(string: "1bc50004-0200-d29e-e511-446c609db825")
    
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
            "DeviceConnectionError",
            "ServicesDiscovered",
            "CharacteristicsReady",
            "SessionReady",
            "CommandResponse",
            "UnlockSuccess",
            "UnlockFailed"
        ]
    }
    
    // MARK: - Exported Methods
    
    @objc(startScan:resolve:reject:)
    func startScan(durationSeconds: Double,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("startScan called with duration: %.0f seconds", durationSeconds)
        
        guard centralManager.state == .poweredOn else {
            let errorMsg = "Bluetooth is not powered on"
            NSLog("ERROR: %@", errorMsg)
            reject("BLE_NOT_READY", errorMsg, nil)
            return
        }
        
        if isCurrentlyScanning {
            NSLog("Already scanning, stopping first")
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
            NSLog("Starting BLE scan with Noke Service UUID filter (eliminates non-Noke devices)")
        } else {
            NSLog("Starting BLE scan WITHOUT Service UUID filter (will see ALL BLE devices)")
        }
        
        centralManager.scanForPeripherals(withServices: serviceUUIDs, options: options)
        
        // Auto-stop after duration
        if durationSeconds > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + durationSeconds) { [weak self] in
                guard let self = self else { return }
                if self.isCurrentlyScanning {
                    NSLog("Auto-stopping scan after timeout")
                    self.stopScanInternal()
                }
            }
        }
        
        resolve(true)
    }
    
    @objc(stopScan:reject:)
    func stopScan(resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
        NSLog("stopScan called")
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
            NSLog("Scan stopped")
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
        
        NSLog("Bluetooth state: %@", state)
        sendEvent(withName: "BluetoothStateChanged", body: ["state": state])
    }
    
    func centralManager(_ central: CBCentralManager,
                       didDiscover peripheral: CBPeripheral,
                       advertisementData: [String: Any],
                       rssi RSSI: NSNumber) {
        
        // FILTER #1: RSSI Threshold (Distance Filter)
        // Ignore devices that are too far away (weaker signal than threshold)
        if RSSI.intValue < rssiThreshold {
            NSLog("FILTERED OUT (RSSI): %@ (RSSI: %@ < %d)", 
                  peripheral.name ?? "Unknown", RSSI, rssiThreshold)
            return
        }
        
        // FILTER #2: Noke Devices Only (Optional - mostly redundant with Service UUID)
        // This filter is only active if explicitly enabled or if Service UUID filter is disabled
        if filterNokeOnly {
            let isNokeDevice = checkIsNokeDevice(peripheral: peripheral, advertisementData: advertisementData)
            if !isNokeDevice {
                NSLog("FILTERED OUT (Not Noke): %@", peripheral.name ?? "Unknown")
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
        
        NSLog("✅ Discovered NOKE device: %@ (RSSI: %@)", 
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
            NSLog("Manufacturer data too short (%d bytes): %@", dataLength, hexString)
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
        
        NSLog("📦 Manufacturer Data (%d bytes): %@", dataLength, hexString)
        NSLog("   MAC: %@, Version: %@, Battery: %@", 
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
        NSLog("RSSI threshold set to: %d dBm", threshold)
        resolve(true)
    }
    
    @objc(setFilterNokeOnly:resolve:reject:)
    func setFilterNokeOnly(_ enabled: Bool,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        filterNokeOnly = enabled
        NSLog("Noke-only filter: %@", enabled ? "ENABLED" : "DISABLED")
        resolve(true)
    }
    
    @objc(setServiceUUIDFilter:resolve:reject:)
    func setServiceUUIDFilter(_ enabled: Bool,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        useServiceUUIDFilter = enabled
        NSLog("Service UUID filter: %@", enabled ? "ENABLED (Only Noke devices)" : "DISABLED (All BLE devices)")
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
        
        NSLog("connect called for device: %@", deviceId)
        
        guard centralManager.state == .poweredOn else {
            let errorMsg = "Bluetooth is not powered on"
            NSLog("ERROR: %@", errorMsg)
            reject("BLE_NOT_READY", errorMsg, nil)
            return
        }
        
        guard let peripheral = discoveredPeripherals[deviceId] else {
            let errorMsg = "Device not found. Make sure to scan first."
            NSLog("ERROR: %@", errorMsg)
            reject("DEVICE_NOT_FOUND", errorMsg, nil)
            return
        }
        
        // Stop scanning before connecting (best practice)
        if isCurrentlyScanning {
            NSLog("Stopping scan before connection")
            centralManager.stopScan()
            isCurrentlyScanning = false
        }
        
        // Set delegate to receive peripheral events
        peripheral.delegate = self
        
        // Store reference to connecting peripheral
        connectedPeripheral = peripheral
        
        NSLog("Connecting to: %@", peripheral.name ?? "Unknown")
        centralManager.connect(peripheral, options: nil)
        
        resolve(true)
    }
    
    @objc(disconnect:resolve:reject:)
    func disconnect(_ deviceId: String,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("disconnect called for device: %@", deviceId)
        
        guard let peripheral = discoveredPeripherals[deviceId] else {
            let errorMsg = "Device not found"
            NSLog("ERROR: %@", errorMsg)
            reject("DEVICE_NOT_FOUND", errorMsg, nil)
            return
        }
        
        if peripheral.state == .connected || peripheral.state == .connecting {
            NSLog("Disconnecting from: %@", peripheral.name ?? "Unknown")
            centralManager.cancelPeripheralConnection(peripheral)
        } else {
            NSLog("Device already disconnected")
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
    
    // MARK: - Command Methods
    
    @objc(sendCommands:deviceId:resolve:reject:)
    func sendCommands(_ commandString: String,
                     deviceId: String,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("sendCommands called: %@", commandString)
        
        guard let peripheral = discoveredPeripherals[deviceId], 
              peripheral.state == .connected else {
            reject("NOT_CONNECTED", "Device is not connected", nil)
            return
        }
        
        guard txCharacteristic != nil else {
            reject("NOT_READY", "Characteristics not discovered yet", nil)
            return
        }
        
        // Split commands by '+'
        let commands = commandString.components(separatedBy: "+")
        commandQueue.removeAll()
        
        for command in commands {
            guard let commandData = hexStringToData(command) else {
                reject("INVALID_COMMAND", "Invalid hex string: \(command)", nil)
                return
            }
            commandQueue.append(commandData)
        }
        
        // Start sending commands
        if let firstCommand = commandQueue.first {
            writeCommand(firstCommand)
            resolve(true)
        } else {
            reject("EMPTY_COMMANDS", "No commands to send", nil)
        }
    }
    
    @objc(offlineUnlock:command:deviceId:resolve:reject:)
    func offlineUnlock(_ key: String,
                      command: String,
                      deviceId: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        
        // Extract MAC address from device name
        var deviceMAC = "Unknown"
        if let peripheral = discoveredPeripherals[deviceId] {
            if let name = peripheral.name, name.contains("_") {
                // Extract MAC from name like "NOKE3E_D01FA644B36F"
                let parts = name.components(separatedBy: "_")
                if parts.count > 1 {
                    let macPart = parts[1]
                    // Format with colons: D0:1F:A6:44:B3:6F
                    if macPart.count == 12 {
                        let chars = Array(macPart)
                        deviceMAC = "\(chars[0])\(chars[1]):\(chars[2])\(chars[3]):\(chars[4])\(chars[5]):\(chars[6])\(chars[7]):\(chars[8])\(chars[9]):\(chars[10])\(chars[11])"
                    }
                }
            }
        }
        
        let keyBytes = key.count / 2  // hex chars to bytes
        let keyHexChars = keyBytes * 2  // bytes to hex chars for display
        let cmdBytes = command.count / 2
        let cmdHexChars = cmdBytes * 2
        
        NSLog("\n" + String(repeating: "═", count: 60))
        NSLog("🔐 OFFLINE UNLOCK - Starting")
        NSLog(String(repeating: "═", count: 60))
        NSLog("📱 Device MAC: %@", deviceMAC)
        NSLog("🔑 Offline Key: %@ (Length: %d hex chars = %d bytes)", key, keyHexChars, keyBytes)
        NSLog("📝 Unlock Cmd: %@ (Length: %d hex chars = %d bytes)", command, cmdHexChars, cmdBytes)
        NSLog("🕐 Add Timestamp: false")
        
        guard let peripheral = discoveredPeripherals[deviceId], 
              peripheral.state == .connected else {
            reject("NOT_CONNECTED", "Device is not connected", nil)
            return
        }
        
        guard txCharacteristic != nil else {
            reject("NOT_READY", "Characteristics not discovered yet", nil)
            return
        }
        
        guard let session = sessionData, session.count >= 16 else {
            NSLog("❌ Session data not available or too short (count: \(sessionData?.count ?? 0))")
            reject("NO_SESSION", "Session data not available", nil)
            return
        }
        
        // Log session data for debugging
        let sessionHex = session.map { String(format: "%02X", $0) }.joined()
        let sessionHexChars = sessionHex.count
        NSLog("📋 Session: %@ (Length: %d hex chars)", sessionHex.lowercased(), sessionHexChars)
        NSLog("📏 Expected Lengths: OFFLINE_KEY_LENGTH=32 bytes, OFFLINE_COMMAND_LENGTH=40 bytes")
        
        // Validate key and command lengths
        // Key: 32 hex chars = 16 bytes (as per NokeMobileLibrary and storage-smart-entry-ios)
        // Command: 40 hex chars = 20 bytes
        guard key.count == 32 else {
            reject("INVALID_KEY", "Key must be 32 hex characters (16 bytes), got \(key.count)", nil)
            return
        }
        
        guard command.count == 40 else {
            reject("INVALID_COMMAND", "Command must be 40 hex characters (20 bytes), got \(command.count)", nil)
            return
        }
        
        // STEP 1: Parsing Offline Key from hex to bytes
        NSLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        NSLog("📥 STEP 1: Parsing Offline Key from hex to bytes")
        NSLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        NSLog("   Input hex string: %@", key)
        
        guard let keyData = hexStringToData(key) else {
            reject("INVALID_KEY", "Invalid key hex string", nil)
            return
        }
        
        let keyBytesString = keyData.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Parsed to bytes: %@", keyBytesString)
        NSLog("   Total: %d bytes", keyData.count)
        
        // STEP 2: Parsing Unlock Command from hex to bytes
        NSLog("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        NSLog("📥 STEP 2: Parsing Unlock Command from hex to bytes")
        NSLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        NSLog("   Input hex string: %@", command)
        
        guard let commandData = hexStringToData(command) else {
            reject("INVALID_COMMAND", "Invalid command hex string", nil)
            return
        }
        
        let commandBytesString = commandData.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Parsed to bytes: %@", commandBytesString)
        NSLog("   Total: %d bytes", commandData.count)
        
        // Log timestamp information
        let timestamp = Int(Date().timeIntervalSince1970)
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss Z"
        dateFormatter.timeZone = TimeZone(secondsFromGMT: 0)
        let timestampDate = Date(timeIntervalSince1970: TimeInterval(timestamp))
        let dateString = dateFormatter.string(from: timestampDate)
        NSLog("🕐 Timestamp: %d (Date: %@)", timestamp, dateString)
        
        let timestampBytes = [
            UInt8((timestamp >> 24) & 0xFF),
            UInt8((timestamp >> 16) & 0xFF),
            UInt8((timestamp >> 8) & 0xFF),
            UInt8(timestamp & 0xFF)
        ]
        let timestampHex = timestampBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("📅 Timestamp bytes: %@", timestampHex)
        
        
        // Encrypt command using the process from NokeMobileLibrary
        guard let encryptedCommand = encryptCommand(commandData: commandData, 
                                                    keyData: keyData, 
                                                    sessionData: session) else {
            reject("ENCRYPTION_FAILED", "Failed to encrypt command", nil)
            return
        }
        
        
        // Clear queue and add encrypted command
        commandQueue.removeAll()
        
        // Split encrypted command into 20-byte packets
        let packets = splitIntoPackets(data: encryptedCommand)
        commandQueue = packets
        
        // Start sending
        if let firstPacket = commandQueue.first {
            writeCommand(firstPacket)
            resolve(true)
        } else {
            reject("EMPTY_COMMAND", "No command packets to send", nil)
        }
    }
    
    // MARK: - Helper Methods
    
    private func writeCommand(_ commandData: Data) {
        guard let peripheral = connectedPeripheral,
              let tx = txCharacteristic else {
            NSLog("❌ Cannot write command: peripheral or characteristic not available")
            return
        }
        
        let hexString = commandData.map { String(format: "%02X", $0) }.joined()
        NSLog("📤 Writing command: \(hexString)")
        
        peripheral.writeValue(commandData, for: tx, type: .withoutResponse)
    }
    
    private func hexStringToData(_ hexString: String) -> Data? {
        var data = Data()
        var hex = hexString
        
        // Remove spaces and make sure it's even length
        hex = hex.replacingOccurrences(of: " ", with: "")
        guard hex.count % 2 == 0 else { return nil }
        
        var index = hex.startIndex
        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2)
            let byteString = String(hex[index..<nextIndex])
            guard let byte = UInt8(byteString, radix: 16) else { return nil }
            data.append(byte)
            index = nextIndex
        }
        
        return data
    }
    
    private func splitIntoPackets(data: Data) -> [Data] {
        var packets: [Data] = []
        let packetSize = 20
        var offset = 0
        
        while offset < data.count {
            let length = min(packetSize, data.count - offset)
            let packet = data.subdata(in: offset..<offset+length)
            packets.append(packet)
            offset += length
        }
        
        return packets
    }
    
    private func encryptCommand(commandData: Data, keyData: Data, sessionData: Data) -> Data? {
        let commandBytes = [UInt8](commandData)
        
        NSLog("\n════════════════════════════════════════════════════════════")
        NSLog("🔨 BUILDING OFFLINE UNLOCK COMMAND")
        NSLog("════════════════════════════════════════════════════════════\n")
        
        // CREATING COMBINED KEY FIRST
        NSLog("🔐 CREATING COMBINED KEY (key + session)")
        
        // According to Noke Encryption Cheat Sheet:
        // CombinedKey = BASE + SESSION
        // For offline unlock, the offlineKey IS the base key
        
        let baseKeyBytes = [UInt8](keyData)
        let sessionBytes = [UInt8](sessionData)
        
        // Log base key
        let baseKeyString = baseKeyBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Base Key (16 bytes): %@", baseKeyString)
        
        // Log session - full session without truncation
        let sessionString = sessionBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Session (%d bytes): %@", sessionBytes.count, sessionString)
        
        // Take first 16 bytes of session
        let sessionFirst16 = Array(sessionBytes.prefix(16))
        let session16String = sessionFirst16.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Taking first 16 bytes of session: %@", session16String)
        
        NSLog("\n   Adding byte by byte:")
        
        // Create combined key by adding session bytes to the base key
        var combinedKeyBytes = [UInt8](keyData)
        
        for i in 0..<16 {
            let base = Int(baseKeyBytes[i])
            let session = Int(sessionFirst16[i])
            let total = base + session
            let result = UInt8(total % 256)
            combinedKeyBytes[i] = result
            
            // Always show result, format matching desired output
            if total > 255 {
                NSLog("   byte[%d]: 0x%02X + 0x%02X = 0x%X → 0x%02X (overflow, using only 8 bits)", i, baseKeyBytes[i], sessionFirst16[i], total, result)
            } else {
                NSLog("   byte[%d]: 0x%02X + 0x%02X = 0x%02X → 0x%02X", i, baseKeyBytes[i], sessionFirst16[i], total, result)
            }
        }
        
        let combinedKey = Data(combinedKeyBytes)
        
        // Log combined key result
        let combinedKeyString = combinedKeyBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("\n   Resulting Combined Key: %@", combinedKeyString)
        
        // Log full command
        let fullCommandString = commandBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("\n📋 INPUT - Full Unlock Cmd (20 bytes):")
        NSLog("   %@", fullCommandString)
        
        // Extract header and payload
        var headerBytes = [UInt8](repeating: 0, count: 4)
        for i in 0..<4 {
            headerBytes[i] = commandBytes[i]
        }
        
        let headerString = headerBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("\n📌 STEP 1: Extract Header (bytes 0-3)")
        NSLog("   Header extracted: %@", headerString)
        NSLog("   header[0] = 0x%02X (source)", headerBytes[0])
        NSLog("   header[1] = 0x%02X (destination)", headerBytes[1])
        NSLog("   header[2] = 0x%02X (type)", headerBytes[2])
        NSLog("   header[3] = 0x%02X (length)", headerBytes[3])
        
        // Extract payload (bytes 4-19)
        var payloadBytes = [UInt8](repeating: 0, count: 16)
        for i in 0..<16 {
            payloadBytes[i] = commandBytes[i + 4]
        }
        
        let payloadString = payloadBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("\n📦 STEP 2: Extract Payload (bytes 4-19, 16 bytes total)")
        NSLog("   Payload extracted: %@", payloadString)
        
        // First 4 bytes go to newCommandPacket[0-3]
        // Next 16 bytes get encrypted
        var newCommandPacket = [UInt8](repeating: 0, count: 20)
        
        // Copy first 4 bytes
        for i in 0..<4 {
            newCommandPacket[i] = commandBytes[i]
        }
        
        // Copy payload bytes for modification
        var cmddata = [UInt8](payloadBytes)
        
        // STEP 3: Skipped (addTimestamp = false for scheduledUnlockCmd)
        NSLog("\n⏭️  STEP 3: Skipped (addTimestamp = false)")
        
        // Recalculate checksum in byte 15 (required even without timestamp)
        var checksum: UInt16 = 0
        for i in 0..<15 {
            checksum += UInt16(cmddata[i])
        }
        cmddata[15] = UInt8(checksum & 0xFF)
        
        // Log payload final before encryption
        let payloadFinalString = cmddata.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("\n📤 STEP 3: Final Payload BEFORE encryption (16 bytes):")
        NSLog("   %@", payloadFinalString)
        
        // STEP 4: Encrypt with AES-128-ECB
        NSLog("\n🔐 STEP 4: Encrypt with AES-128-ECB")
        let combinedKeyHex = combinedKeyBytes.map { String(format: "%02X", $0) }.joined()
        NSLog("   Key (combined): %@", combinedKeyHex)
        NSLog("   Key in bytes: %@", combinedKeyString)
        let cmddataString = cmddata.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Data to encrypt: %@", cmddataString)
        
        // Encrypt cmddata with combined key using AES-128-ECB
        var encryptedBytes = [UInt8](repeating: 0, count: 16)
        var numBytesEncrypted: size_t = 0
        
        let cryptStatus = combinedKey.withUnsafeBytes { keyBytes in
            cmddata.withUnsafeBytes { dataBytes in
                encryptedBytes.withUnsafeMutableBytes { encryptedBytesPointer in
                    CCCrypt(
                        CCOperation(kCCEncrypt),
                        CCAlgorithm(kCCAlgorithmAES128),
                        CCOptions(kCCOptionECBMode),
                        keyBytes.baseAddress,
                        kCCKeySizeAES128,
                        nil,
                        dataBytes.baseAddress,
                        16,
                        encryptedBytesPointer.baseAddress,
                        16,
                        &numBytesEncrypted
                    )
                }
            }
        }
        
        guard cryptStatus == kCCSuccess else {
            NSLog("❌ Encryption failed with status: \(cryptStatus)")
            return nil
        }
        
        let encryptedString = encryptedBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Encrypted result: %@", encryptedString)
        
        // STEP 5: Combine Header + Encrypted Payload
        NSLog("\n🔨 STEP 5: Combine Header + Encrypted Payload")
        NSLog("   Copying header (4 bytes)...")
        
        // Build final packet: first 4 bytes + encrypted 16 bytes
        for i in 0..<16 {
            newCommandPacket[i + 4] = encryptedBytes[i]
        }
        
        NSLog("   Copying encrypted payload (16 bytes) at positions [4-19]...")
        
        let encryptedData = Data(newCommandPacket)
        
        // STEP 6: Final Command Built
        NSLog("\n✅ STEP 6: Final Command Built")
        NSLog("   Bytes [0-3]:   %@  ← Header", headerString)
        NSLog("   Bytes [4-19]:  %@ ← Encrypted Payload", encryptedString)
        let finalHex = newCommandPacket.map { String(format: "%02X", $0) }.joined()
        NSLog("   Total (hex):   %@", finalHex)
        let finalSpaced = newCommandPacket.map { String(format: "%02X", $0) }.joined(separator: " ")
        NSLog("   Total (spaced): %@", finalSpaced)
        
        NSLog("\n════════════════════════════════════════════════════════════")
        NSLog("✅ Build complete - Ready to send")
        NSLog("════════════════════════════════════════════════════════════\n")
        
        NSLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        NSLog("🚀 FINAL COMMAND TO SEND (20 bytes):")
        NSLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        NSLog("📤 Hex String: %@", finalHex.lowercased())
        NSLog("📦 Raw Data: %@", finalSpaced)
        NSLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
        
        return encryptedData
    }
    
    // MARK: - CBCentralManager Connection Delegate
    
    func centralManager(_ central: CBCentralManager, 
                       didConnect peripheral: CBPeripheral) {
        
        NSLog("✅ Connected to: %@", peripheral.name ?? "Unknown")
        
        // Send event to JavaScript
        let deviceInfo: [String: Any] = [
            "id": peripheral.identifier.uuidString,
            "name": peripheral.name ?? "Unknown"
        ]
        
        sendEvent(withName: "DeviceConnected", body: deviceInfo)
        
        // Automatically discover services after connection
        NSLog("Discovering services...")
        peripheral.discoverServices([NativeScanner.nokeServiceUUID])
    }
    
    func centralManager(_ central: CBCentralManager, 
                       didDisconnectPeripheral peripheral: CBPeripheral, 
                       error: Error?) {
        
        NSLog("Disconnected from: %@", peripheral.name ?? "Unknown")
        
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
            NSLog("Disconnection error: %@", error.localizedDescription)
        }
        
        sendEvent(withName: "DeviceDisconnected", body: deviceInfo)
    }
    
    func centralManager(_ central: CBCentralManager, 
                       didFailToConnect peripheral: CBPeripheral, 
                       error: Error?) {
        
        NSLog("❌ Failed to connect to: %@", peripheral.name ?? "Unknown")
        
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
    
    // MARK: - CBPeripheral Delegate (Services & Characteristics)
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil else {
            NSLog("❌ Error discovering services: %@", error!.localizedDescription)
            return
        }
        
        NSLog("Services discovered")
        
        guard let services = peripheral.services else { return }
        
        for service in services {
            if service.uuid == NativeScanner.nokeServiceUUID {
                NSLog("Found Noke service, discovering characteristics...")
                nokeService = service
                peripheral.discoverCharacteristics([
                    NativeScanner.txCharacteristicUUID,
                    NativeScanner.rxCharacteristicUUID,
                    NativeScanner.sessionCharacteristicUUID
                ], for: service)
            }
        }
        
        sendEvent(withName: "ServicesDiscovered", body: [
            "id": peripheral.identifier.uuidString,
            "servicesCount": services.count
        ])
    }
    
    func peripheral(_ peripheral: CBPeripheral, 
                   didDiscoverCharacteristicsFor service: CBService, 
                   error: Error?) {
        guard error == nil else {
            NSLog("❌ Error discovering characteristics: %@", error!.localizedDescription)
            return
        }
        
        guard let characteristics = service.characteristics else { return }
        
        NSLog("Discovered %d characteristics", characteristics.count)
        
        for characteristic in characteristics {
            switch characteristic.uuid {
            case NativeScanner.txCharacteristicUUID:
                txCharacteristic = characteristic
                NSLog("✓ TX Characteristic found (Write)")
                
            case NativeScanner.rxCharacteristicUUID:
                rxCharacteristic = characteristic
                peripheral.setNotifyValue(true, for: characteristic)
                NSLog("✓ RX Characteristic found (Read/Notify)")
                
            case NativeScanner.sessionCharacteristicUUID:
                sessionCharacteristic = characteristic
                peripheral.readValue(for: characteristic)
                NSLog("✓ Session Characteristic found, reading value...")
                
            default:
                break
            }
        }
        
        // Check if all required characteristics are found
        if txCharacteristic != nil && rxCharacteristic != nil && sessionCharacteristic != nil {
            NSLog("✅ All characteristics ready")
            sendEvent(withName: "CharacteristicsReady", body: [
                "id": peripheral.identifier.uuidString
            ])
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, 
                   didUpdateValueFor characteristic: CBCharacteristic, 
                   error: Error?) {
        guard error == nil else {
            NSLog("❌ Error reading characteristic: %@", error!.localizedDescription)
            return
        }
        
        // Session characteristic - store for encryption
        if characteristic.uuid == NativeScanner.sessionCharacteristicUUID {
            sessionData = characteristic.value
            if let data = sessionData {
                let hexString = data.map { String(format: "%02X", $0) }.joined()
                // Session log already printed in offlineUnlock function
                
                // Emit session ready event with the session data
                sendEvent(withName: "SessionReady", body: [
                    "id": peripheral.identifier.uuidString,
                    "session": hexString
                ])
            }
        }
        
        // RX characteristic - responses from lock
        if characteristic.uuid == NativeScanner.rxCharacteristicUUID {
            guard let data = characteristic.value else { return }
            let hexString = data.map { String(format: "%02X", $0) }.joined()
            NSLog("📨 Response from lock: \(hexString)")
            
            // Parse response
            parseCommandResponse(data: data)
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, 
                   didWriteValueFor characteristic: CBCharacteristic, 
                   error: Error?) {
        if let error = error {
            NSLog("❌ Error writing to characteristic: %@", error.localizedDescription)
            return
        }
        
        NSLog("✓ Command written successfully")
        
        // Send next command in queue if any
        if !commandQueue.isEmpty {
            commandQueue.removeFirst()
            if let nextCommand = commandQueue.first {
                writeCommand(nextCommand)
            }
        }
    }
    
    // MARK: - Command Parsing
    
    private func parseCommandResponse(data: Data) {
        let bytes = [UInt8](data)
        
        guard bytes.count > 0 else { return }
        
        let responseType = bytes[0]
        
        let hexString = data.map { String(format: "%02X", $0) }.joined(separator: " ")
        
        // Common response types (from NokeDefines.swift)
        switch responseType {
        case 0x60: // SUCCESS
            NSLog("✅ SUCCESS response")
            sendEvent(withName: "UnlockSuccess", body: [
                "response": hexString,
                "type": "success"
            ])
            
        case 0x61: // INVALID KEY
            NSLog("❌ INVALID KEY")
            sendEvent(withName: "UnlockFailed", body: [
                "error": "Invalid key",
                "response": hexString
            ])
            
        case 0x62: // INVALID COMMAND
            NSLog("❌ INVALID COMMAND")
            sendEvent(withName: "UnlockFailed", body: [
                "error": "Invalid command",
                "response": hexString
            ])
            
        case 0x63: // INVALID PERMISSION
            NSLog("❌ INVALID PERMISSION")
            sendEvent(withName: "UnlockFailed", body: [
                "error": "Invalid permission",
                "response": hexString
            ])
            
        case 0x69: // FAILED TO UNLOCK
            NSLog("❌ FAILED TO UNLOCK")
            sendEvent(withName: "UnlockFailed", body: [
                "error": "Failed to unlock",
                "response": hexString
            ])
            
        default:
            NSLog("Response type: 0x%02X", responseType)
        }
        
        // Always send raw response event
        sendEvent(withName: "CommandResponse", body: [
            "response": hexString,
            "responseType": String(format: "0x%02X", responseType)
        ])
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

