# Noke BLE Manager

Custom native BLE module for Noke with support for both Old and New Architecture.

## Status

- ✅ iOS Implementation (Turbo Module + Legacy Bridge)
- ⏳ Android Implementation (Placeholder - TODO)

## Features

- Scan for BLE peripherals
- Connect/Disconnect to devices
- Event-driven architecture
- Compatible with both Old and New React Native architecture

## Usage

```typescript
import NokeBleManager from '../modules/NokeBleManager/js';

// Start scanning
await NokeBleManager.startScan([], 10, true);

// Listen for discovered devices
const listener = NokeBleManager.onDiscoverPeripheral((peripheral) => {
  console.log('Found device:', peripheral.name, peripheral.id);
});

// Stop scanning
await NokeBleManager.stopScan();

// Connect to device
await NokeBleManager.connect(deviceId);

// Disconnect
await NokeBleManager.disconnect(deviceId);

// Cleanup
listener.remove();
```

## BLE Service Facade

Use the BLE Service facade to switch between implementations:

```typescript
import { BleService } from '../src/services/BleService';

// Same API as above, but implementation can be toggled
// Edit BLE_IMPLEMENTATION constant in BleService.ts
```

## Installation

Already configured in the main app. To use in a new project:

1. Copy `modules/NokeBleManager` to your project
2. Add to `package.json`:
```json
"codegenConfig": {
  "name": "NokeBleManagerSpec",
  "type": "modules",
  "jsSrcsDir": "modules/NokeBleManager/js"
}
```
3. iOS: Add to Podfile:
```ruby
pod 'NokeBleManager', :path => '../modules/NokeBleManager'
```
4. Run `pod install` (iOS) or sync gradle (Android)

## Development

### iOS
The iOS implementation uses CoreBluetooth and supports both:
- **Turbo Module** (New Architecture) - via codegen
- **Legacy Bridge** (Old Architecture) - via RCT_EXPORT_METHOD

### Android
TODO: Implement using Android BLE APIs

## Events

- `BleManagerDiscoverPeripheral` - Device discovered during scan
- `BleManagerStopScan` - Scan stopped
- `BleManagerConnectPeripheral` - Device connected
- `BleManagerDisconnectPeripheral` - Device disconnected
- `BleManagerDidUpdateState` - Bluetooth state changed

## Architecture Compatibility

The module automatically detects and uses the appropriate implementation:
- **New Architecture**: Uses Turbo Module (JSI)
- **Old Architecture**: Uses Legacy Bridge

Toggle via `newArchEnabled` in `gradle.properties` (Android) or build settings (iOS).

