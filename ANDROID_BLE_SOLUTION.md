# Android BLE Implementation - Technical Solution

## Overview

This document details the Android-specific implementation for Noke lock BLE communication, focusing on the technical requirements and design decisions necessitated by the Android BluetoothGatt API.

---

## Core Technical Requirements

### 1. GATT Operation Serialization

Android's BluetoothGatt API enforces **strict operation serialization**: only one GATT operation can be active at a time.

**Implementation Pattern:**
```kotlin
class GattCallback : BluetoothGattCallback() {
    
    // Operation 1: Service Discovery
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
            gatt.requestMtu(512)
        }
    }
    
    // Operation 2: Service Discovery (after MTU)
    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
        gatt.discoverServices()
    }
    
    // Operation 3: Read Session (after services discovered)
    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
        gatt.readCharacteristic(sessionCharacteristic)
    }
    
    // Operation 4: Enable Notifications (after session read)
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
        gatt.setCharacteristicNotification(txCharacteristic, true)
        gatt.writeDescriptor(txDescriptor)
    }
    
    // Operation 5: Mark Ready (after descriptor write)
    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
        isInitializationComplete = true
    }
}
```

**Rationale**: Each operation must complete (callback invoked) before the next can begin. Violating this constraint causes the Android BLE stack to reject subsequent operations.

---

## 2. Characteristic Role Clarification

### Naming Convention (Lock's Perspective)

```
Phone                           Noke Lock
  |                                 |
  |---- Write Command to RX ------->| RX Characteristic
  |                                 | (Lock RECEIVES)
  |                                 |
  |<--- Read Response from TX ------| TX Characteristic
  |                                 | (Lock TRANSMITS)
```

### Characteristic Mappings

| Characteristic | UUID | Our Action | Lock's Action | Properties |
|---------------|------|------------|---------------|------------|
| **RX** | `1bc50002` | `writeCharacteristic()` | Receives command | `WRITE` + `WRITE_NO_RESPONSE` |
| **TX** | `1bc50003` | Subscribe via `onCharacteristicChanged()` | Transmits response | `NOTIFY` + `READ` |
| **Session** | `1bc50004` | `readCharacteristic()` (once) | Provides session | `READ` |

### Code Implementation

```kotlin
// Write unlock command to RX characteristic
fun sendUnlockCommand(commandHex: String) {
    val commandBytes = hexStringToByteArray(commandHex)
    
    rxCharacteristic.value = commandBytes
    rxCharacteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
    
    val success = gatt.writeCharacteristic(rxCharacteristic)
    
    if (rxCharacteristic.writeType == WRITE_TYPE_NO_RESPONSE) {
        // No callback expected, resolve immediately
        promise.resolve(true)
    }
}

// Receive response from TX characteristic
override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
    if (characteristic.uuid == NOKE_TX_CHAR_UUID) {
        val response = characteristic.value
        // Process lock's response
    }
}
```

---

## 3. State Management Architecture

### State Flag Design

```kotlin
private var isInitializationComplete: Boolean = false
```

**Purpose**: Prevents write operations before GATT initialization completes.

**State Transitions:**
```
false (default)
  ↓ connect()
false (connecting)
  ↓ onServicesDiscovered()
false (reading session)
  ↓ onCharacteristicRead()
false (enabling notifications)
  ↓ onDescriptorWrite()
true (ready for operations) ✅
```

### Write Guard Pattern

```kotlin
@ReactMethod
fun sendCommands(commandString: String, deviceId: String, promise: Promise) {
    // Guard clause prevents premature writes
    if (!isInitializationComplete) {
        promise.reject("NOT_READY", "Device initialization in progress")
        return
    }
    
    // Proceed with write operation
    rxCharacteristic.value = bytes
    gatt.writeCharacteristic(rxCharacteristic)
}
```

---

## 4. Write Type Selection

### WRITE_TYPE_NO_RESPONSE

**Chosen for Noke implementation** due to:

1. **Performance**: No wait for ACK from lock
2. **RX Properties Support**: Characteristic supports `WRITE_NO_RESPONSE` (property flag 4)
3. **Lock Firmware Design**: Noke locks don't require write acknowledgment
4. **Simplified Flow**: No `onCharacteristicWrite` callback needed

```kotlin
rxCharacteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
val success = gatt.writeCharacteristic(rxCharacteristic)

// Resolve immediately since no callback
if (success && writeType == WRITE_TYPE_NO_RESPONSE) {
    promise.resolve(true)
}
```

### Alternative: WRITE_TYPE_DEFAULT

Could be used for reliability:
```kotlin
rxCharacteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
gatt.writeCharacteristic(rxCharacteristic)

// Wait for callback
override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
    if (status == BluetoothGatt.GATT_SUCCESS) {
        promise.resolve(true)
    }
}
```

**Trade-off**: Slower but provides confirmation. Not necessary for Noke locks.

---

## 5. MTU Negotiation

### Why Request MTU?

```kotlin
override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
    if (newState == BluetoothProfile.STATE_CONNECTED) {
        gatt.requestMtu(512)  // Request larger MTU
    }
}

override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
    // Typically negotiates to 23 (default) or higher
    // Then proceed with service discovery
    gatt.discoverServices()
}
```

**Benefits:**
- Larger packet size for data transfer
- Reduced overhead for multi-byte operations
- Better performance for firmware updates

**Note**: Noke unlock commands are 20 bytes, fitting in default MTU (23). MTU request is optional but included for completeness.

---

## 6. Descriptor Write for Notifications

### Why Descriptor Write is Required

Android requires explicit GATT descriptor write to enable notifications:

```kotlin
// Step 1: Enable local notification listening
gatt.setCharacteristicNotification(txCharacteristic, true)

// Step 2: Write to CCCD descriptor to tell remote device
val descriptor = txCharacteristic.descriptors.firstOrNull()
descriptor?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
gatt.writeDescriptor(descriptor)

// Step 3: Confirmation callback
override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
    // Notifications now active on remote device
}
```

**CCCD**: Client Characteristic Configuration Descriptor (`00002902-0000-1000-8000-00805f9b34fb`)

**Why Needed**: GATT spec requires writing to CCCD to enable notifications on the remote device (lock).

**iOS Equivalent**: CoreBluetooth handles this automatically in `setNotifyValue()`.

---

## 7. Complete Initialization Sequence

### State Diagram

```
┌──────────────┐
│ DISCONNECTED │
└──────┬───────┘
       │ connectGatt()
       ↓
┌──────────────┐
│  CONNECTING  │
└──────┬───────┘
       │ onConnectionStateChange()
       ↓
┌──────────────┐
│  CONNECTED   │
└──────┬───────┘
       │ requestMtu()
       ↓
┌──────────────┐
│ MTU_CHANGED  │
└──────┬───────┘
       │ discoverServices()
       ↓
┌──────────────────┐
│ SERVICES_FOUND   │
└──────┬───────────┘
       │ readCharacteristic(session)
       ↓
┌──────────────────┐
│ SESSION_READ     │
└──────┬───────────┘
       │ setNotification(TX) + writeDescriptor()
       ↓
┌──────────────────────┐
│ NOTIFICATIONS_ENABLED│
└──────┬───────────────┘
       │ onDescriptorWrite()
       ↓
┌──────────────────┐
│ READY_FOR_WRITE  │← isInitializationComplete = true
└──────┬───────────┘
       │ writeCharacteristic(RX)
       ↓
┌──────────────────┐
│ COMMAND_SENT     │
└──────┬───────────┘
       │ onCharacteristicChanged(TX)
       ↓
┌──────────────────┐
│ RESPONSE_RECEIVED│
└──────────────────┘
```

---

## 8. Error Handling

### GATT Status Codes

```kotlin
override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
    when (status) {
        BluetoothGatt.GATT_SUCCESS -> {
            // Write successful
        }
        BluetoothGatt.GATT_WRITE_NOT_PERMITTED -> {
            // Characteristic doesn't support write
        }
        BluetoothGatt.GATT_INVALID_ATTRIBUTE_LENGTH -> {
            // Data too long for MTU
        }
        else -> {
            // Other GATT error
        }
    }
}
```

### Connection State Handling

```kotlin
override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
    when (newState) {
        BluetoothProfile.STATE_CONNECTED -> {
            // Reset state
            isInitializationComplete = false
            // Begin initialization
            gatt.requestMtu(512)
        }
        BluetoothProfile.STATE_DISCONNECTED -> {
            // Clean up
            rxCharacteristic = null
            txCharacteristic = null
            sessionCharacteristic = null
            isInitializationComplete = false
            gatt.close()
        }
    }
}
```

---

## 9. Memory Management

### Connection Cleanup

```kotlin
fun disconnect(deviceId: String) {
    connectedGatt?.let { gatt ->
        // Clear state
        isInitializationComplete = false
        writePromise = null
        currentDeviceId = null
        
        // Clear characteristic references
        rxCharacteristic = null
        txCharacteristic = null
        sessionCharacteristic = null
        
        // Disconnect and close
        gatt.disconnect()
        gatt.close()
        connectedGatt = null
    }
}
```

**Importance**: Proper cleanup prevents memory leaks and ensures clean state for next connection.

---

## 10. Comparison with Official Noke Library

### What We Adopted

From `noke-mobile-library-android`:

1. **Characteristic naming and usage**
   - Write to RX
   - Read from TX
   - Session is STATE_CHAR

2. **Operation sequence**
   - Read session first
   - Enable TX notifications second
   - Mark as connected in descriptor callback

3. **Write type**
   - Use `WRITE_TYPE_NO_RESPONSE` for commands

### What We Simplified

1. **No NokeDevice abstraction**
   - Direct GATT management
   - Lighter weight
   - Tailored for React Native

2. **Minimal state machine**
   - Single `isInitializationComplete` flag
   - Simpler than full NokeDevice state tracking

3. **Direct Promise integration**
   - Native Promise support for React Native
   - No intermediate callback layers

---

## Architecture Decisions

### Why Manual GATT Management?

**Option 1: Use Noke Library Directly**
```kotlin
// Add noke-mobile-library-android as dependency
implementation 'com.noke:noke-mobile-library-android:1.0.0'

// Use NokeDeviceManager
NokeDeviceManager.shared.connectToNoke(device)
```

**Cons:**
- Additional 2-3 MB dependency
- Less control over BLE operations
- Harder to debug
- More abstraction layers

**Option 2: Custom Implementation** ✅ (Chosen)
```kotlin
// Direct BluetoothGatt usage
device.connectGatt(context, false, gattCallback)
```

**Pros:**
- Full control over BLE operations
- Minimal dependencies
- Easier debugging
- Optimized for our use case

---

## Implementation Highlights

### 1. Characteristic Discovery

```kotlin
override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
    val nokeService = gatt.getService(UUID.fromString(NOKE_SERVICE_UUID))
    
    // Find all three characteristics
    rxCharacteristic = nokeService.characteristics.find { 
        it.uuid.toString().equals(NOKE_RX_CHAR_UUID, ignoreCase = true)
    }
    txCharacteristic = nokeService.characteristics.find { 
        it.uuid.toString().equals(NOKE_TX_CHAR_UUID, ignoreCase = true)
    }
    sessionCharacteristic = nokeService.characteristics.find { 
        it.uuid.toString().equals(NOKE_SESSION_CHAR_UUID, ignoreCase = true)
    }
    
    // Begin initialization sequence
    gatt.readCharacteristic(sessionCharacteristic)
}
```

### 2. Session Extraction

```kotlin
override fun onCharacteristicRead(
    gatt: BluetoothGatt, 
    characteristic: BluetoothGattCharacteristic, 
    status: Int
) {
    if (characteristic.uuid == NOKE_SESSION_CHAR_UUID) {
        val sessionBytes = characteristic.value
        val sessionHex = sessionBytes.joinToString("") { "%02X".format(it) }
        
        // Example: "E70300003366D14680CBD75D2865C579385BFA89"
        sendEvent("SessionReady", mapOf(
            "id" to gatt.device.address,
            "session" to sessionHex
        ))
        
        // Continue initialization
        enableTxNotifications(gatt)
    }
}
```

### 3. Notification Setup

```kotlin
private fun enableTxNotifications(gatt: BluetoothGatt) {
    // Local notification listening
    gatt.setCharacteristicNotification(txCharacteristic, true)
    
    // Remote device notification enable (via descriptor)
    val descriptor = txCharacteristic?.descriptors?.firstOrNull()
    
    if (descriptor != null) {
        descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        gatt.writeDescriptor(descriptor)
        // Will trigger onDescriptorWrite callback
    } else {
        // No descriptor present (rare)
        // Mark as ready immediately since no GATT operation needed
        isInitializationComplete = true
    }
}
```

### 4. Command Transmission

```kotlin
@ReactMethod
fun sendCommands(commandString: String, deviceId: String, promise: Promise) {
    // Validate ready state
    if (!isInitializationComplete) {
        promise.reject("NOT_READY", "Device initialization in progress")
        return
    }
    
    // Convert hex string to bytes
    val commandBytes = hexStringToByteArray(commandString)
    
    // Write to RX characteristic (where lock receives)
    rxCharacteristic.value = commandBytes
    rxCharacteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
    
    val success = gatt.writeCharacteristic(rxCharacteristic)
    
    // Resolve immediately for NO_RESPONSE type
    if (success && rxCharacteristic.writeType == WRITE_TYPE_NO_RESPONSE) {
        promise.resolve(true)
    } else if (!success) {
        promise.reject("WRITE_FAILED", "BluetoothGatt write operation failed")
    }
}
```

### 5. Response Reception

```kotlin
override fun onCharacteristicChanged(
    gatt: BluetoothGatt, 
    characteristic: BluetoothGattCharacteristic
) {
    if (characteristic.uuid == NOKE_TX_CHAR_UUID) {
        val responseBytes = characteristic.value
        val responseHex = responseBytes.joinToString("") { "%02X".format(it) }
        
        // Emit to JavaScript
        sendEvent("CommandResponse", mapOf(
            "deviceId" to gatt.device.address,
            "response" to responseHex,
            "responseType" to "0x%02X".format(responseBytes[0])
        ))
    }
}
```

---

## Performance Optimization

### 1. MTU Negotiation

```kotlin
gatt.requestMtu(512)  // Request larger MTU

override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
    // Typically negotiates to 23-512 depending on device support
    // Larger MTU = fewer packets for large data transfers
}
```

**Impact**: Minimal for 20-byte unlock commands, but beneficial for potential future features (firmware updates, bulk operations).

### 2. Write Type Selection

```kotlin
// NO_RESPONSE is faster
rxCharacteristic.writeType = WRITE_TYPE_NO_RESPONSE  // ~10-20ms
// vs
rxCharacteristic.writeType = WRITE_TYPE_DEFAULT      // ~50-100ms
```

**Chosen**: `WRITE_TYPE_NO_RESPONSE` for optimal unlock latency.

### 3. Event Emission Strategy

```kotlin
private fun sendEvent(eventName: String, params: WritableMap) {
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
}
```

**Pattern**: Direct event emission to JavaScript without intermediate buffering.

---

## Code Organization

### Module Structure

```
NativeScannerModule.kt
├── Scanning Methods
│   ├── startScan()
│   ├── stopScan()
│   └── scanCallback
│
├── Connection Methods
│   ├── connect()
│   ├── disconnect()
│   └── gattCallback
│       ├── onConnectionStateChange()
│       ├── onMtuChanged()
│       ├── onServicesDiscovered()
│       ├── onCharacteristicRead()
│       ├── onCharacteristicChanged()
│       ├── onCharacteristicWrite()
│       └── onDescriptorWrite()
│
├── Command Methods
│   └── sendCommands()
│
└── Utility Methods
    ├── checkPermissions()
    └── hexStringToByteArray()
```

### State Variables

```kotlin
// Connection state
private var connectedGatt: BluetoothGatt? = null
private var currentDeviceId: String? = null

// Characteristics
private var rxCharacteristic: BluetoothGattCharacteristic? = null  // For writing
private var txCharacteristic: BluetoothGattCharacteristic? = null  // For reading
private var sessionCharacteristic: BluetoothGattCharacteristic? = null

// Operation coordination
private var isInitializationComplete: Boolean = false
private var writePromise: Promise? = null

// Scanning state
private var discoveredDevices: MutableMap<String, BluetoothDevice>
private var isCurrentlyScanning: Boolean = false
```

---

## Integration with React Native

### Module Registration

```kotlin
// NativeScannerPackage.kt
class NativeScannerPackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == NativeScannerModule.MODULE_NAME) {
            NativeScannerModule(reactContext)
        } else {
            null
        }
    }
}

// MainApplication.kt
override fun getPackages(): List<ReactPackage> {
    return PackageList(this).packages.apply {
        add(NativeScannerPackage())
        add(NokeAPIClientPackage())
    }
}
```

### JavaScript Interface

```typescript
// Identical interface for both platforms
import NativeScanner from './modules/NativeScanner';

// Methods
await NativeScanner.startScan(10);
await NativeScanner.connect(deviceId);
await NativeScanner.sendCommands(commandString, deviceId);

// Events
NativeScanner.addListener('DeviceDiscovered', handler);
NativeScanner.addListener('SessionReady', handler);
NativeScanner.addListener('CommandResponse', handler);
```

---

## Testing Checklist

### Functional Tests

- [x] BLE scan discovers Noke devices
- [x] Connection establishes successfully
- [x] Session data read correctly
- [x] TX notifications enabled
- [x] Unlock command writes to RX
- [x] Response received from TX
- [x] Disconnect cleans up properly

### Performance Tests

- [x] Initialization completes in <1s
- [x] Write latency <50ms
- [x] No memory leaks on repeated connect/disconnect

### Edge Cases

- [x] Handle missing TX descriptor
- [x] Prevent writes before initialization
- [x] Prevent concurrent writes
- [x] Clean disconnect on errors

---

## Maintenance Considerations

### Future Enhancements

1. **Multiple Command Queue**
   - Current: Handles one command at a time
   - Future: Queue and send sequentially

2. **Reconnection Logic**
   - Current: Manual reconnect required
   - Future: Auto-reconnect on disconnect

3. **Characteristic Caching**
   - Current: Re-discover on each connection
   - Future: Cache service/characteristic info

### Compatibility

- **Minimum SDK**: Android 6.0 (API 23)
- **Target SDK**: Android 14 (API 34)
- **Tested On**: 
  - Device: Samsung SM-A146U (Android 14)
  - Locks: Noke Lock models 1A and 3E

---

## References

- [Android BluetoothGatt Documentation](https://developer.android.com/reference/android/bluetooth/BluetoothGatt)
- [Bluetooth GATT Specifications](https://www.bluetooth.com/specifications/specs/)
- [React Native Native Modules (Android)](https://reactnative.dev/docs/native-modules-android)
- Noke Official Library: `noke-mobile-library-android` (reference implementation)

---

**Version**: 1.0  
**Last Updated**: October 21, 2025  
**Status**: ✅ Production Ready - Feature Parity with iOS
