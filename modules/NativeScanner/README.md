# NativeScanner Module

Native BLE scanning module for React Native using CoreBluetooth directly.

## Overview

NativeScanner is a Turbo Native Module that provides BLE device scanning functionality with real-time device discovery events.

**Implementation Language**: Swift 5+  
**iOS Framework**: CoreBluetooth  
**Architecture Support**: Both Old and New Architecture

## Purpose

This module serves as a **native BLE implementation** that:
- Demonstrates Swift-based Turbo Module integration
- Provides real-time BLE scanning with event-driven discovery
- Bridges CoreBluetooth to React Native seamlessly
- Validates that Swift modules work with React Native's New Architecture

## Features

✅ **Start/Stop BLE Scanning**
- Configurable scan duration with auto-stop
- Allow duplicate advertisements for RSSI updates
- Background dispatch queue for better performance

✅ **Real-time Device Discovery**
- Event-driven device discovery
- RSSI (signal strength) reporting
- Advertising data parsing (local name, service UUIDs, connectability)

✅ **Bluetooth State Monitoring**
- Real-time Bluetooth state changes
- Power state detection (on/off/unauthorized/etc.)

✅ **Scanning Status**
- Check if currently scanning
- Safe start/stop with state management

## Usage

The module is integrated in the **Native** tab. To test:

1. Run the app: `npm run ios`
2. Go to the **Native** tab
3. Tap "Start Native Scan" to discover devices
4. Watch devices appear in real-time
5. Tap "Stop Scan" to stop discovery

### Programmatic Usage

```typescript
import NativeScanner from '../modules/NativeScanner/js';

// Start scanning for 10 seconds
await NativeScanner.startScan(10);

// Listen for device discovery
const listener = NativeScanner.addListener('DeviceDiscovered', (device) => {
  console.log('Found:', device.name, 'RSSI:', device.rssi);
  console.log('ID:', device.id);
  console.log('Advertising:', device.advertising);
});

// Check if scanning
const isScanning = await NativeScanner.isScanning();

// Stop scanning manually
await NativeScanner.stopScan();

// Remove listener
listener.remove();
```

### Event Listening

```typescript
// Device discovered event
NativeScanner.addListener('DeviceDiscovered', (device) => {
  // device = { id, name, rssi, advertising: { localName, serviceUUIDs, isConnectable } }
});

// Scan stopped event
NativeScanner.addListener('ScanStopped', () => {
  console.log('Scanning stopped');
});

// Bluetooth state changed
NativeScanner.addListener('BluetoothStateChanged', (event) => {
  console.log('Bluetooth state:', event.state); // 'on', 'off', 'unauthorized', etc.
});
```

## Architecture

### TypeScript Spec
`js/NativeScanner.ts` defines the Turbo Module interface for codegen.

### Swift Implementation
`ios/NativeScanner.swift` implements the native methods using:
- `CBCentralManager` for BLE operations
- `@objc` decorators for React Native bridging
- `RCTEventEmitter` for sending events to JavaScript
- CoreBluetooth delegate pattern

### Objective-C Bridging
`ios/NativeScannerModule.m` provides the module registration macros:
- `RCT_EXTERN_MODULE` for module registration
- `RCT_EXTERN_METHOD` for method exports

### Bridging Header
`ios/NativeScanner-Bridging-Header.h` imports React Native headers for Swift:
- `React/RCTBridgeModule.h`
- `React/RCTEventEmitter.h`

## Why Swift?

**Advantages of Swift for this module**:
- ✅ Modern, type-safe language
- ✅ Better null safety and error handling
- ✅ Cleaner CoreBluetooth delegate implementation
- ✅ Reduced boilerplate compared to Objective-C
- ✅ Easier to maintain and extend
- ✅ Fully compatible with React Native's New Architecture

## Architecture Support

### New Architecture (Turbo Modules)
The module works seamlessly with JSI for direct JavaScript-to-native calls.

### Old Architecture (Bridge)
Falls back to traditional React Native bridge automatically.

### How It Works
Swift uses `@objc` attributes to expose methods and classes to the Objective-C runtime, which React Native's bridge and Turbo Module system rely on. This allows Swift code to work with both architectures without conditional compilation.

## Files Structure

```
modules/NativeScanner/
├── js/
│   ├── NativeScanner.ts           # Turbo Module TypeScript spec
│   └── index.ts                   # Module wrapper with event helpers
├── ios/
│   ├── NativeScanner.swift        # Swift implementation with CoreBluetooth
│   ├── NativeScannerModule.m      # Objective-C module registration
│   └── NativeScanner-Bridging-Header.h  # Swift-ObjC bridge
├── package.json                   # Module config with codegenConfig
└── NativeScanner.podspec          # iOS pod specification
```

## Implementation Details

### CoreBluetooth Setup
```swift
private var centralManager: CBCentralManager!

override init() {
    super.init()
    let queue = DispatchQueue(label: "com.noke.scanner", qos: .userInitiated)
    centralManager = CBCentralManager(delegate: self, queue: queue)
}
```

### Method Export
```swift
@objc(startScan:resolve:reject:)
func startScan(durationSeconds: Double,
               resolve: @escaping RCTPromiseResolveBlock,
               reject: @escaping RCTPromiseRejectBlock) {
    // Implementation...
}
```

### Event Emission
```swift
func centralManager(_ central: CBCentralManager,
                   didDiscover peripheral: CBPeripheral,
                   advertisementData: [String: Any],
                   rssi RSSI: NSNumber) {
    
    let deviceInfo: [String: Any] = [
        "id": peripheral.identifier.uuidString,
        "name": peripheral.name ?? "Unknown",
        "rssi": RSSI,
        "advertising": advertisingData
    ]
    
    sendEvent(withName: "DeviceDiscovered", body: deviceInfo)
}
```

## Integration Points

1. **Root package.json** - Has `codegenConfig` pointing to NativeScannerSpec
2. **ios/Podfile** - Includes `pod 'NativeScanner'`
3. **NativeScan Screen** - UI to test scanning functionality

## API Reference

### Methods

#### `startScan(durationSeconds: number): Promise<boolean>`
Starts BLE scanning for the specified duration.
- **durationSeconds**: Auto-stop after this many seconds (0 = scan indefinitely)
- **Returns**: Promise that resolves when scan starts
- **Throws**: Error if Bluetooth is not powered on

#### `stopScan(): Promise<boolean>`
Stops BLE scanning.
- **Returns**: Promise that resolves when scan stops

#### `isScanning(): Promise<boolean>`
Checks if currently scanning.
- **Returns**: Promise that resolves with current scanning state

### Events

#### `DeviceDiscovered`
Emitted when a BLE device is discovered.

**Payload**:
```typescript
{
  id: string;                    // Peripheral UUID
  name: string;                  // Device name or "Unknown"
  rssi: number;                  // Signal strength (dBm)
  advertising: {
    localName?: string;          // Advertised local name
    serviceUUIDs?: string[];     // Advertised service UUIDs
    isConnectable?: boolean;     // Whether device is connectable
  };
}
```

#### `ScanStopped`
Emitted when scanning stops (manually or auto-timeout).

**Payload**: `{}`

#### `BluetoothStateChanged`
Emitted when Bluetooth state changes.

**Payload**:
```typescript
{
  state: 'on' | 'off' | 'unknown' | 'resetting' | 'unsupported' | 'unauthorized';
}
```

## Migration from Objective-C

This module was **recently migrated from Objective-C to Swift** for:
- Better code maintainability
- Modern iOS development practices
- Cleaner delegate implementations
- Improved type safety

The functionality remains identical, but the implementation is more concise and maintainable.

## Testing

### Manual Testing
1. Open app → Native tab
2. Ensure "Bluetooth: on" is shown
3. Tap "Start Native Scan"
4. Verify devices appear in the list
5. Check Xcode logs for `[NativeScanner]` messages
6. Tap "Stop Scan" to stop

### Xcode Logs
```
[NativeScanner] startScan called with duration: 10 seconds
[NativeScanner] Starting BLE scan...
[NativeScanner] Bluetooth state: on
[NativeScanner] Discovered: Device Name (RSSI: -45)
[NativeScanner] Auto-stopping scan after timeout
[NativeScanner] Scan stopped
```

### Expected Behavior
- Devices with Bluetooth enabled should appear
- RSSI values update as devices are re-discovered
- Scan auto-stops after specified duration
- Manual stop works immediately

## Troubleshooting

### "Bluetooth is not powered on" error
- Enable Bluetooth on the device
- Check iOS Settings → Privacy → Bluetooth → Allow app

### No devices found
- Ensure there are BLE devices nearby
- Check that Bluetooth is enabled
- Verify iOS permissions are granted

### Build errors
- Clean build: `cd ios && rm -rf build && cd ..`
- Reinstall pods: `cd ios && pod install && cd ..`
- Check bridging header is included in Xcode project

## Next Steps

This module demonstrates that Swift-based Turbo Modules work correctly. Future enhancements:
1. Add connection management (connect/disconnect)
2. Service and characteristic discovery
3. Read/write operations
4. Migrate to full NokeBleManager implementation

## Comparison with TestModule

| Aspect | TestModule | NativeScanner |
|--------|-----------|---------------|
| **Language** | Objective-C++ | Swift |
| **Purpose** | Validation | BLE Scanning |
| **Framework** | UIKit, AudioToolbox | CoreBluetooth |
| **Events** | No | Yes (3 events) |
| **Complexity** | Simple | Medium |
| **Screen** | Settings | Native |

Both modules validate that React Native's Turbo Module system works with different native languages and complexities.

## Success Criteria

If BLE scanning works and devices appear in the Native tab, you're ready to:
1. Import existing native BLE code
2. Extend with connection management
3. Migrate to full NokeBleManager module

---

**Status**: ✅ Complete and working  
**Language**: Swift 5+  
**iOS Support**: iOS 13+  
**Last Updated**: October 2025 (Migrated to Swift)

