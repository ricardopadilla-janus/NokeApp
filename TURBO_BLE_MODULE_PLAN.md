# Implement Hybrid Turbo Native BLE Module (iOS-first)

## Phase 1: Module Scaffolding & Setup

Create a native module structure that supports both Old and New Architecture, with iOS implementation first.

### 1.1 Create Module Structure
- Create `modules/NokeBleManager/` folder in project root
- Set up TypeScript specs for Turbo Module codegen in `modules/NokeBleManager/js/NativeBleManager.ts`
- Create iOS native files in `modules/NokeBleManager/ios/`
  - `NokeBleManager.h` / `NokeBleManager.mm` (Turbo Module)
  - `NokeBleManagerLegacy.h` / `NokeBleManagerLegacy.m` (Legacy bridge fallback)
- Add Android placeholder structure for future implementation

### 1.2 Configure Codegen & Autolinking
- Update `package.json` with `codegenConfig` pointing to the spec
- Create `modules/NokeBleManager/NokeBleManager.podspec` for iOS autolinking
- Update `ios/Podfile` to include the local pod
- Run `pod install` to link the module

### 1.3 Define Initial Interface
- TypeScript spec with methods: `startScan()`, `stopScan()`, `connect(deviceId)`, `disconnect(deviceId)`
- Event emitters: `onDiscoverPeripheral`, `onStopScan`, `onConnectPeripheral`, `onDisconnectPeripheral`
- Mirror react-native-ble-manager API for easy switching

## Phase 2: iOS Native Implementation

Import and adapt existing native BLE code for scan/connect functionality.

### 2.1 iOS Scanning Implementation
- Copy/adapt existing native scan code into `NokeBleManager.mm`
- Implement `startScan()` using CoreBluetooth `CBCentralManager`
- Implement peripheral discovery callback → emit `onDiscoverPeripheral` events
- Implement `stopScan()`

### 2.2 iOS Connection Implementation
- Implement `connect(deviceId)` using existing native connection logic
- Implement `disconnect(deviceId)`
- Handle connection state changes → emit events

### 2.3 Legacy Bridge Compatibility
- Implement same methods in `NokeBleManagerLegacy.m` using `RCT_EXPORT_METHOD`
- Use `#if RCT_NEW_ARCH_ENABLED` to conditionally compile Turbo vs Legacy
- Ensure both code paths call the same CoreBluetooth logic

## Phase 3: TypeScript Wrapper & Gradual Migration

Create a facade that allows switching between react-native-ble-manager and the new native module.

### 3.1 Create BLE Facade
- Create `src/services/BleService.ts` with unified interface
- Environment/config flag to toggle between implementations
- Factory pattern to instantiate correct implementation

### 3.2 Update useBle Hook
- Modify `src/screens/Home/hooks/useBle.ts` to use `BleService` facade
- Keep react-native-ble-manager as fallback initially
- Add toggle mechanism (env var or settings screen)

### 3.3 Testing & Validation
- Test scanning on iOS with new module
- Test connection flow
- Compare behavior against react-native-ble-manager
- Document any differences or bugs found

## Phase 4: Advanced Features (Future)

Once scan/connect are stable, migrate advanced features from existing native code.

### 4.1 Characteristic Operations
- Read/write characteristics
- Notifications/indications
- Service discovery

### 4.2 Android Implementation
- Port iOS implementation to Android using existing native code
- Test on Android devices

### 4.3 Complete Migration
- Remove react-native-ble-manager dependency
- Switch all code to use native module exclusively

## Key Files to Create/Modify

**New Files:**
- `modules/NokeBleManager/js/NativeBleManager.ts` - Turbo Module spec
- `modules/NokeBleManager/ios/NokeBleManager.h/mm` - Turbo implementation
- `modules/NokeBleManager/ios/NokeBleManagerLegacy.h/m` - Legacy bridge
- `modules/NokeBleManager/NokeBleManager.podspec` - iOS pod configuration
- `modules/NokeBleManager/package.json` - Module package config
- `src/services/BleService.ts` - Facade interface

**Modified Files:**
- `package.json` - Add codegenConfig
- `ios/Podfile` - Add local pod reference
- `src/screens/Home/hooks/useBle.ts` - Use BleService facade

## Notes

- Start with iOS only; Android stubs for structure
- Keep react-native-ble-manager installed during migration
- Use feature flags to enable/disable new module
- Test thoroughly before removing old dependency
- Document bugs found in existing native code for future fixes

## To-dos

- [x] Create module folder structure and initial files
- [x] Define TypeScript spec for Turbo Module codegen
- [x] Create iOS Turbo and Legacy bridge implementations
- [x] Configure podspec and autolinking for iOS
- [x] Implement iOS scanning using existing native code
- [x] Implement iOS connection/disconnection logic
- [x] Create BleService facade with toggle mechanism
- [ ] Update useBle hook to use BleService
- [ ] Test new module against react-native-ble-manager baseline

## Progress Update

### Phase 1: Module Scaffolding ✅ COMPLETED

All core infrastructure is in place:
- Module folder structure created
- TypeScript Turbo Module spec defined
- iOS native implementation with CoreBluetooth
- Podspec configured and installed successfully
- Codegen generated native code
- BLE Service facade created with toggle mechanism
- Android placeholder structure added

### Next Steps

1. Test the native module compilation by building iOS app
2. Update `useBle` hook to use BLE Service facade
3. Add toggle in Settings to switch between implementations
4. Test scanning and connection on iOS device
5. Import your existing native BLE code to replace basic implementation

