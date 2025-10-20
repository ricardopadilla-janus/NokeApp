# NativeScanner Module Updates

## New Features

### 1. Advanced BLE Filtering

**Service UUID Filter (Primary - Recommended)**
- Filters at CoreBluetooth level using Noke-specific Service UUIDs
- Eliminates 99% of non-Noke BLE devices instantly
- Most efficient filter (hardware-level)
- Default: ON

**RSSI Threshold Filter**
- Filters devices by signal strength
- Default: -89 dBm
- Adjustable: -100 to -30 dBm

**Noke Name Filter (Secondary)**
- Additional validation by device name/manufacturer data
- Mostly redundant with Service UUID filter
- Default: OFF

### 2. Device Connection

**Methods**:
- `connect(deviceId)` - Connect to discovered device
- `disconnect(deviceId)` - Disconnect from device
- `getConnectionState(deviceId)` - Get current connection state

**Events**:
- `DeviceConnected` - Successful connection
- `DeviceDisconnected` - Device disconnected
- `DeviceConnectionError` - Connection failed

**Features**:
- Auto-stops scan before connecting (best practice)
- Single device connection support
- UI buttons with states: Connect (blue) → Connecting (spinner) → Disconnect (red)

### 3. Extended Device Data

**Manufacturer Data Extraction**:
- MAC Address (bytes 11-16, reversed)
- Firmware Version (byte 17, format: v1.2)
- Battery Level (byte 18, 0-100%)
- Data length for debugging

**Note**: Only devices broadcasting manufacturer data (≥17 bytes) show extended info.

### 4. UI Improvements

**Search**: By name, ID, or MAC address
**Signal Indicators**: Color-coded badges (Excellent/Good/Fair/Weak)
**Collapsible Filters**: Tap to expand/collapse filter controls
**Stats**: Shows total devices and count with full manufacturer data

## How Service UUID Filter Works

```swift
// With Filter ON (default) - Only Noke devices
centralManager.scanForPeripherals(
  withServices: [nokeServiceUUID, nokeFirmwareUUID],
  options: options
)

// With Filter OFF (debugging) - All BLE devices
centralManager.scanForPeripherals(
  withServices: nil,
  options: options
)
```

## Usage

**Recommended Settings**:
- Service UUID Filter: ON (eliminates non-Noke devices)
- RSSI Threshold: -89 dBm (balanced)
- Noke Name Filter: OFF (redundant)

**For Debugging**:
- Turn Service UUID Filter OFF to see all BLE devices
- Adjust RSSI to test signal strength filtering
- Enable Noke Name Filter for additional validation

## Technical Details

**iOS Implementation**: Swift (NativeScanner.swift) - CoreBluetooth
**Android Implementation**: Kotlin (NativeScannerModule.kt) - BluetoothLeScanner
**TypeScript Spec**: Updated with all methods
**React Native UI**: Full integration with collapsible controls

## Platform Compatibility

✅ **iOS** (API Level 10+)  
✅ **Android** (API Level 21+, Android 5.0 Lollipop+)

Both platforms support:
- Service UUID filtering (hardware-level)
- RSSI threshold filtering
- Device name filtering
- Manufacturer data extraction (MAC, version, battery)
- Connection/disconnection
- Full event-driven architecture

