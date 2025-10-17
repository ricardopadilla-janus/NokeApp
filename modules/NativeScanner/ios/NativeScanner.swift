import Foundation
import CoreBluetooth

@objc(NativeScanner)
class NativeScanner: RCTEventEmitter, CBCentralManagerDelegate {
    
    private var centralManager: CBCentralManager!
    private var discoveredPeripherals: [String: CBPeripheral] = [:]
    private var isCurrentlyScanning = false
    private var scanTimer: Timer?
    
    override init() {
        super.init()
        let queue = DispatchQueue(label: "com.noke.scanner", qos: .userInitiated)
        centralManager = CBCentralManager(delegate: self, queue: queue, options: [CBCentralManagerOptionShowPowerAlertKey: false])
    }
    
    override class func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    override func supportedEvents() -> [String]! {
        return ["DeviceDiscovered", "ScanStopped", "BluetoothStateChanged"]
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
        
        NSLog("[NativeScanner] Starting BLE scan...")
        centralManager.scanForPeripherals(withServices: nil, options: options)
        
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
        
        // Build device info
        let deviceInfo: [String: Any] = [
            "id": peripheralId,
            "name": peripheral.name ?? "Unknown",
            "rssi": RSSI,
            "advertising": advertising
        ]
        
        NSLog("[NativeScanner] Discovered: %@ (RSSI: %@)", peripheral.name ?? "Unknown", RSSI)
        
        // Send event to JavaScript
        sendEvent(withName: "DeviceDiscovered", body: deviceInfo)
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

