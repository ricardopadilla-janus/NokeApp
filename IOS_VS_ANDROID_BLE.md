# iOS vs Android BLE Implementation - Technical Analysis

## Executive Summary

This document provides a technical analysis of the BLE (Bluetooth Low Energy) implementation differences between iOS and Android platforms for Noke lock integration. Both implementations achieve the same functionality but require different approaches due to platform-specific API designs and constraints.

---

## Platform API Overview

### iOS - CoreBluetooth Framework

**Characteristics:**
- High-level abstraction over BLE operations
- Automatic operation queuing and serialization
- Delegate-based callbacks with main queue dispatch
- Implicit state management
- Optimized for energy efficiency

**Key Classes:**
- `CBCentralManager` - Manages BLE scanning and connections
- `CBPeripheral` - Represents BLE device
- `CBCharacteristic` - Represents GATT characteristic

### Android - BluetoothGatt API

**Characteristics:**
- Lower-level control over BLE operations
- Manual operation queuing required
- Callback-based architecture on GATT thread
- Explicit state management necessary
- Strict operation serialization enforced

**Key Classes:**
- `BluetoothLeScanner` - Manages BLE scanning
- `BluetoothGatt` - Represents GATT connection
- `BluetoothGattCharacteristic` - Represents GATT characteristic

---

## Critical Implementation Differences

### 1. Noke Characteristic Convention

Noke uses a naming convention from the **lock's perspective**:

| UUID | Name | Lock's Role | App's Role | Properties |
|------|------|-------------|------------|------------|
| `1bc50002` | **RX** | Receives commands | Writes commands | `WRITE` + `WRITE_NO_RESPONSE` |
| `1bc50003` | **TX** | Transmits responses | Reads responses | `NOTIFY` + `READ` |
| `1bc50004` | **Session** | Provides session data | Reads once on connect | `READ` |

**Important**: 
- Commands are written to **RX** (lock receives)
- Responses are read from **TX** (lock transmits)

This is consistent across both platforms but requires clear understanding to avoid confusion.

---

## 2. GATT Operation Sequencing

### iOS (CoreBluetooth)

CoreBluetooth automatically manages operation queuing:

```swift
// iOS allows flexible ordering
peripheral.discoverServices([NOKE_SERVICE_UUID])
peripheral.setNotifyValue(true, for: txCharacteristic)
peripheral.readValue(for: sessionCharacteristic)

// All operations are queued automatically
// No manual synchronization needed
```

**Benefits:**
- Simple, linear code
- Framework handles serialization
- Less boilerplate

### Android (BluetoothGatt)

Android requires strict manual sequencing through callbacks:

```kotlin
// Step 1: Discover services
gatt.discoverServices()

override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
    // Step 2: Read session (MUST be first GATT operation)
    gatt.readCharacteristic(sessionCharacteristic)
}

override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
    // Step 3: Enable notifications (only after read completes)
    gatt.setCharacteristicNotification(txCharacteristic, true)
    gatt.writeDescriptor(descriptor)
}

override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
    // Step 4: Mark as ready (only after all operations complete)
    isInitializationComplete = true
}
```

**Requirements:**
- Each operation must complete before starting the next
- Callbacks chain operations sequentially
- State flags prevent premature operations

**Reason**: Android's BluetoothGatt enforces a **single operation queue**. Attempting concurrent operations results in "GATT operation not allowed" errors.

---

## 3. Write Operation Implementation

### iOS

```swift
// Simple direct write
rxCharacteristic.value = commandData
peripheral.writeValue(commandData, for: rxCharacteristic, type: .withoutResponse)

// Callback (optional)
func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    // Handle completion
}
```

### Android

```kotlin
// Must verify initialization is complete
if (!isInitializationComplete) {
    return // Not ready yet
}

// Set value and write type
rxCharacteristic.value = commandBytes
rxCharacteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE

// Initiate write
val success = gatt.writeCharacteristic(rxCharacteristic)

// For NO_RESPONSE type, complete immediately (no callback)
if (rxCharacteristic.writeType == WRITE_TYPE_NO_RESPONSE) {
    promise.resolve(true)
}
```

**Key Difference**: Android requires explicit write type and immediate promise resolution for `WRITE_TYPE_NO_RESPONSE` since no callback is triggered.

---

## 4. Notification Handling

### iOS

```swift
// Enable notifications
peripheral.setNotifyValue(true, for: txCharacteristic)

// Receive responses
func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    if characteristic.uuid == NOKE_TX_CHAR_UUID {
        let response = characteristic.value
        // Process response
    }
}
```

### Android

```kotlin
// Enable notifications
gatt.setCharacteristicNotification(txCharacteristic, true)

// Write descriptor to complete notification setup
val descriptor = txCharacteristic.descriptors.firstOrNull()
descriptor?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
gatt.writeDescriptor(descriptor)

// Confirmation callback
override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
    // Notifications now active
}

// Receive responses
override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
    if (characteristic.uuid == NOKE_TX_CHAR_UUID) {
        val response = characteristic.value
        // Process response
    }
}
```

**Key Difference**: Android requires explicit descriptor write to enable notifications, which is an additional GATT operation that must be sequenced properly.

---

## 5. MAC Address Retrieval

### iOS

**Limitation**: iOS privacy restrictions prevent direct MAC address access from BLE advertising data.

**Solution**: Extract from device name
```swift
// Noke devices encode MAC in name: "NOKE3E_D01FA644B36F"
func extractMacFromName(_ name: String) -> String? {
    guard let match = name.range(of: "[0-9A-F]{12}$", options: .regularExpression) else {
        return nil
    }
    let macWithoutColons = String(name[match])
    // Convert to "D0:1F:A6:44:B3:6F" format
    return macWithoutColons.chunks(of: 2).joined(separator: ":")
}
```

### Android

**Advantage**: Direct access to MAC address from advertising data

```kotlin
override fun onScanResult(callbackType: Int, result: ScanResult) {
    val macAddress = result.device.address  // "D0:1F:A6:44:B3:6F"
    // Also available in advertising data
    val manufacturerData = result.scanRecord?.getManufacturerSpecificData(0x008B)
}
```

---

## 6. Threading Model

### iOS

```swift
// Operations dispatched to main queue automatically
DispatchQueue.main.async {
    peripheral.writeValue(data, for: characteristic, type: .withoutResponse)
}

// Or use default queue
peripheral.writeValue(data, for: characteristic, type: .withoutResponse)
```

**Thread Safety**: CoreBluetooth handles thread safety internally. Most operations can be called from any queue.

### Android

```kotlin
// Callbacks execute on GATT thread (not main thread)
override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
    // This is NOT on main thread
    
    // To update UI, must dispatch to main thread
    runOnUiThread {
        updateUI()
    }
}

// React Native methods automatically on correct thread
@ReactMethod
fun sendCommands(...) {
    // Safe to call GATT operations directly
    gatt.writeCharacteristic(rxCharacteristic)
}
```

**Thread Safety**: Manual thread management required for UI updates, but GATT operations can be called from React Native thread.

---

## 7. Initialization Sequence Comparison

### iOS Initialization Flow

```
Connect
   ↓
Discover Services (automatic)
   ↓
Discover Characteristics (automatic)
   ↓
Enable TX Notifications
   ↓
Read Session
   ↓
✅ Ready (flexible ordering)
```

**Duration**: ~200-500ms  
**Complexity**: Low  
**Failure Points**: Few

### Android Initialization Flow

```
Connect
   ↓
Request MTU (optional optimization)
   ↓ (wait for callback)
Discover Services
   ↓ (wait for callback)
Read Session ← MUST be first GATT read/write operation
   ↓ (wait for callback)
Enable TX Notifications
   ↓ (wait for callback)
Write TX Descriptor
   ↓ (wait for callback)
✅ Ready (strict ordering required)
```

**Duration**: ~500-1000ms  
**Complexity**: Medium-High  
**Failure Points**: Many (if sequence violated)

**Why Different**: Android's BluetoothGatt API enforces that only one GATT operation can be in progress at a time. Violating this causes "GATT operation not allowed" errors.

---

## 8. State Management

### iOS

```swift
// Simple boolean flags
private var isConnected = false
private var sessionReady = false

// Optional: Use CBPeripheral.state
if peripheral.state == .connected {
    // Ready to operate
}
```

### Android

```kotlin
// Explicit state flag required
private var isInitializationComplete: Boolean = false

// Must check before operations
if (!isInitializationComplete) {
    promise.reject("NOT_READY", "Device not ready")
    return
}

// Additional flags for operation coordination
private var writePromise: Promise? = null  // Prevent concurrent writes
private var currentDeviceId: String? = null
```

**Reason**: Due to manual operation sequencing, Android requires more explicit state tracking to ensure GATT operations occur in the correct order and don't overlap.

---

## Complete Feature Comparison

| Feature | iOS Implementation | Android Implementation | Reason for Difference |
|---------|-------------------|------------------------|----------------------|
| **BLE Scanning** | `CBCentralManager.scanForPeripherals` | `BluetoothLeScanner.startScan` | Different API design |
| **Service Discovery** | Automatic after connection | Manual `discoverServices()` | iOS abstracts this |
| **Operation Queue** | Automatic by framework | Manual via callbacks | API design philosophy |
| **Write to Lock** | Write to RX characteristic | Write to RX characteristic | ✅ Same |
| **Read from Lock** | Notify on TX characteristic | Notify on TX characteristic | ✅ Same |
| **Write Type** | `.withoutResponse` | `WRITE_TYPE_NO_RESPONSE` | Same concept, different syntax |
| **Notification Setup** | One call | Call + descriptor write | Android requires explicit descriptor |
| **Session Read** | Flexible timing | Must be first operation | Android GATT queue restriction |
| **MAC Address** | Extract from name | Direct from advertising | iOS privacy restriction |
| **Threading** | Main queue automatic | GATT thread callbacks | Different threading models |
| **State Flags** | Optional | Required | Needed for operation coordination |
| **Error Messages** | Descriptive | Generic GATT codes | API verbosity difference |

---

## Code Architecture Decisions

### Why Separate Native Modules

Both platforms implement:
1. **NativeScanner** - BLE operations (platform-specific)
2. **NokeAPIClient** - HTTP client (platform-specific but similar logic)
3. **Shared JavaScript layer** - Platform-agnostic business logic

**Rationale**: 
- BLE APIs are fundamentally different between platforms
- Cannot share code at native level
- JavaScript layer provides unified interface to React Native app

### Why Callback-Driven on Android

```kotlin
// Callback chain ensures proper sequencing
override fun onServicesDiscovered(...) {
    gatt.readCharacteristic(session)  // Start chain
}

override fun onCharacteristicRead(...) {
    gatt.writeDescriptor(descriptor)  // Next in chain
}

override fun onDescriptorWrite(...) {
    isInitializationComplete = true  // End of chain
}
```

**Rationale**: Android's BluetoothGatt API design enforces sequential operations. Callbacks are the idiomatic way to handle this.

### Why State Flag on Android

```kotlin
private var isInitializationComplete: Boolean = false

@ReactMethod
fun sendCommands(...) {
    if (!isInitializationComplete) {
        promise.reject("NOT_READY", "...")
        return
    }
    // Proceed with write
}
```

**Rationale**: Prevents writes before initialization completes. iOS doesn't need this because CoreBluetooth's automatic queuing handles this implicitly.

---

## Bluetooth Characteristic Properties

### Understanding GATT Properties

| Property | Value | Meaning | Can We...? |
|----------|-------|---------|-----------|
| `READ` | 2 | Characteristic supports read | Read value |
| `WRITE_NO_RESPONSE` | 4 | Supports write without ACK | Write (no callback) |
| `WRITE` | 8 | Supports write with ACK | Write (with callback) |
| `NOTIFY` | 16 | Supports notifications | Subscribe for updates |

### Noke Characteristics Properties

**RX Characteristic** (`1bc50002`):
```
Properties: 12 (binary: 1100)
= WRITE (8) + WRITE_NO_RESPONSE (4)
→ Used for: Writing unlock commands to lock
```

**TX Characteristic** (`1bc50003`):
```
Properties: 18 (binary: 10010)
= NOTIFY (16) + READ (2)
→ Used for: Reading responses from lock
```

**Session Characteristic** (`1bc50004`):
```
Properties: 2 (binary: 10)
= READ (2)
→ Used for: Reading session data once on connection
```

---

## Platform-Specific Implementation Details

### iOS: Event-Driven with Automatic Management

```swift
// 1. Start scan
centralManager.scanForPeripherals(withServices: [NOKE_SERVICE_UUID])

// 2. Connect when found
func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral) {
    peripheral.connect()
}

// 3. Discover characteristics
func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    peripheral.discoverCharacteristics(nil, for: service)
}

// 4. Enable notifications & read session (flexible order)
func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService) {
    peripheral.setNotifyValue(true, for: txCharacteristic)
    peripheral.readValue(for: sessionCharacteristic)
}

// 5. Write commands (available immediately after discovery)
func writeUnlockCommand(_ command: Data) {
    peripheral.writeValue(command, for: rxCharacteristic, type: .withoutResponse)
}
```

**Advantages:**
- Concise code
- Fewer states to manage
- Framework prevents common errors

### Android: Callback-Driven with Manual Sequencing

```kotlin
// 1. Start scan
bluetoothLeScanner.startScan(filters, scanSettings, scanCallback)

// 2. Connect when found
override fun onScanResult(callbackType: Int, result: ScanResult) {
    result.device.connectGatt(context, false, gattCallback)
}

// 3. Request MTU for better performance
override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
    when (newState) {
        BluetoothProfile.STATE_CONNECTED -> {
            gatt.requestMtu(512)  // Optional optimization
        }
    }
}

// 4. Discover services after MTU
override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
    gatt.discoverServices()
}

// 5. Read session FIRST (required for proper GATT state)
override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
    // Find characteristics
    rxCharacteristic = service.getCharacteristic(NOKE_RX_CHAR_UUID)
    txCharacteristic = service.getCharacteristic(NOKE_TX_CHAR_UUID)
    sessionCharacteristic = service.getCharacteristic(NOKE_SESSION_CHAR_UUID)
    
    // Read session FIRST
    gatt.readCharacteristic(sessionCharacteristic)
}

// 6. Enable notifications AFTER session read
override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
    if (characteristic.uuid == NOKE_SESSION_CHAR_UUID) {
        // Save session
        val session = characteristic.value
        
        // Now enable TX notifications
        gatt.setCharacteristicNotification(txCharacteristic, true)
        val descriptor = txCharacteristic.descriptors.firstOrNull()
        descriptor?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        gatt.writeDescriptor(descriptor)
    }
}

// 7. Mark as ready AFTER all GATT operations complete
override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
    isInitializationComplete = true
    // Now writes are allowed
}

// 8. Write commands (only when ready)
fun sendCommands(command: String) {
    if (!isInitializationComplete) return
    
    rxCharacteristic.value = hexToBytes(command)
    rxCharacteristic.writeType = WRITE_TYPE_NO_RESPONSE
    gatt.writeCharacteristic(rxCharacteristic)
}
```

**Requirements:**
- MTU request (optional but recommended)
- Strict callback chaining
- State flag (`isInitializationComplete`)
- Explicit write type

**Reason**: Android's design prioritizes control and flexibility over simplicity. This allows fine-grained management but requires more code.

---

## Performance Characteristics

### Initialization Time

| Platform | Typical Duration | Factors |
|----------|-----------------|---------|
| iOS | 200-500ms | Automatic optimization by OS |
| Android | 500-1000ms | MTU negotiation + callback overhead |

### Write Latency

| Platform | Typical Duration | Notes |
|----------|-----------------|-------|
| iOS | 10-50ms | Optimized by CoreBluetooth |
| Android | 10-50ms | Similar once initialized |

### Memory Usage

| Platform | Footprint | Notes |
|----------|-----------|-------|
| iOS | ~2-3 MB | CoreBluetooth framework overhead |
| Android | ~1-2 MB | Lighter API, more manual management |

---

## React Native Integration

### Common JavaScript Interface

Both platforms expose identical interface:

```typescript
// Scanning
await NativeScanner.startScan(durationSeconds);

// Connection
await NativeScanner.connect(deviceId);

// Commands
await NativeScanner.sendCommands(commandString, deviceId);

// Events (identical on both platforms)
NativeScanner.addListener('DeviceDiscovered', handler);
NativeScanner.addListener('SessionReady', handler);
NativeScanner.addListener('CommandResponse', handler);
```

### Platform Detection

```typescript
import { Platform } from 'react-native';

// Platform-specific behavior (if needed)
const getMacAddress = (device) => {
  if (Platform.OS === 'ios') {
    return extractMacFromName(device.name);
  } else {
    return device.id;  // Android provides MAC directly
  }
};
```

---

## Permissions Model

### iOS Permissions

Required in `Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>We need Bluetooth to unlock your Noke devices</string>
```

**Automatic prompt**: iOS shows permission dialog on first BLE access.

### Android Permissions

Required in `AndroidManifest.xml`:
```xml
<!-- Android 12+ (API 31+) -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Android 11 and below -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

**Runtime request required**: Must request `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `ACCESS_FINE_LOCATION` at runtime for Android 12+.

**Reason**: Android 12+ introduced granular Bluetooth permissions for better privacy. Location permission needed because BLE scanning can be used for location tracking.

---

## API Call Patterns

### Both Platforms Use Same HTTP Client Pattern

```kotlin
// Kotlin (Android)
suspend fun getUnlockCommands(mac: String, session: String): UnlockResponse {
    val response = httpClient.post("$baseURL/lock/unlock/") {
        headers {
            append("Authorization", "Bearer $authToken")
            append("Content-Type", "application/json")
        }
        setBody(json {
            put("mac", mac)
            put("session", session)
        })
    }
    return response
}
```

```swift
// Swift (iOS)
func getUnlockCommands(mac: String, session: String) -> Promise<UnlockResponse> {
    var request = URLRequest(url: URL(string: "\(baseURL)/lock/unlock/")!)
    request.httpMethod = "POST"
    request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = ["mac": mac, "session": session]
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    
    return Promise { seal in
        URLSession.shared.dataTask(with: request) { data, response, error in
            // Handle response
        }.resume()
    }
}
```

**Same Logic**: Both use native HTTP clients with identical request structure.

---

## Summary of Key Differences

### 1. **Operation Sequencing**
- **iOS**: Automatic, flexible
- **Android**: Manual, strict

**Root Cause**: API design philosophy

### 2. **Callback Depth**
- **iOS**: 2-3 levels
- **Android**: 5-6 levels

**Root Cause**: Android requires callback for each GATT operation

### 3. **State Management**
- **iOS**: Implicit (framework managed)
- **Android**: Explicit (developer managed)

**Root Cause**: Level of abstraction

### 4. **Write Operations**
- **iOS**: Direct write with type
- **Android**: Set value + type + write + handle response

**Root Cause**: Android exposes lower-level control

### 5. **Notification Setup**
- **iOS**: Single method call
- **Android**: Enable + write descriptor

**Root Cause**: GATT specification implementation detail

---

## Best Practices Applied

### iOS
- Use `.withoutResponse` for faster writes
- Leverage automatic operation queuing
- Minimal state tracking

### Android
- Always check `isInitializationComplete` before writes
- Chain operations through callbacks
- Use `WRITE_TYPE_NO_RESPONSE` for performance
- Request MTU for better throughput
- Explicit state management with flags

---

## Testing Results

### Both Platforms Achieve:
- ✅ Successful BLE scanning
- ✅ Reliable device connection
- ✅ Session data extraction
- ✅ Online unlock via API
- ✅ Command delivery to lock
- ✅ Response reception
- ✅ Auto re-login on token expiration

### Test Hardware:
- **iOS**: iPhone (iOS 18+) + Noke Lock models 1A and 3E
- **Android**: Samsung SM-A146U (Android 14) + Noke Lock models 1A and 3E

### Performance:
- **iOS**: Unlock completion ~1-2 seconds
- **Android**: Unlock completion ~1-2 seconds

**Conclusion**: Despite implementation differences, both platforms achieve feature parity and similar performance.

---

## References

- [iOS CoreBluetooth Framework](https://developer.apple.com/documentation/corebluetooth)
- [Android BluetoothGatt API](https://developer.android.com/reference/android/bluetooth/BluetoothGatt)
- [Bluetooth GATT Specification](https://www.bluetooth.com/specifications/gatt/)
- [Noke Mobile Library (Android)](https://github.com/noke-inc/noke-mobile-library-android)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)

---

**Document Version**: 1.0  
**Last Updated**: October 21, 2025  
**Status**: Production Ready
