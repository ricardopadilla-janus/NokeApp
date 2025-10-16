# Noke - Library Distribution Strategy

## Product Overview

Create **two separate NPM packages** for third-party integration:

1. **@noke/ble-manager** - Native BLE module (headless, no UI)
2. **@noke/ui-components** - Pre-built UI components (uses @noke/ble-manager)

---

## Package 1: @noke/ble-manager (Core BLE Library)

### Purpose
Headless BLE library with Noke protocol implementation. No UI, pure logic.

### What it provides

```typescript
import NokeBLE from '@noke/ble-manager';

// BLE Operations
await NokeBLE.startScan();
await NokeBLE.connect(deviceId);
await NokeBLE.unlock(deviceId, code);
await NokeBLE.updateFirmware(deviceId, firmwareData);

// Events
NokeBLE.onDeviceDiscovered((device) => { ... });
NokeBLE.onLockStateChanged((state) => { ... });
```

### Architecture Support

✅ React Native 0.60+ (Old Architecture)  
✅ React Native 0.76+ (New Architecture / Turbo Modules)  
✅ iOS 13+  
✅ Android API 23+ (future)

### Package Structure

```
@noke/ble-manager/
├── js/
│   ├── NativeNokeBLE.ts    # Turbo Module spec
│   └── index.ts            # Public API
├── ios/
│   ├── NokeBLE.h
│   └── NokeBLE.mm          # Hybrid (Old+New) implementation
├── android/
│   └── ... (future)
├── package.json
│   ├── name: "@noke/ble-manager"
│   ├── peerDependencies: "react-native": ">=0.60.0"
│   └── codegenConfig       # For New Arch
└── NokeBLE.podspec
```

### Installation (Cliente)

```bash
npm install @noke/ble-manager
cd ios && pod install
```

**Auto-detects architecture** - No configuration needed from client.

---

## Package 2: @noke/ui-components (UI Library)

### Purpose
Pre-built React Native UI components for Noke integration. Drop-in solution.

### What it provides

```typescript
import { NokeScanScreen, NokeDeviceList, NokeUnlockButton } from '@noke/ui-components';

// Drop-in screen
<NokeScanScreen onDeviceConnected={(device) => console.log(device)} />

// Individual components
<NokeDeviceList
  onDeviceSelected={(device) => handleSelect(device)}
  autoSort={true}
  searchable={true}
/>

<NokeUnlockButton
  deviceId="abc-123"
  onUnlocked={() => console.log('Unlocked!')}
/>
```

### Architecture

Pure JavaScript/TypeScript - No native code. Works on any React Native version.

### Package Structure

```
@noke/ui-components/
├── src/
│   ├── screens/
│   │   ├── NokeScanScreen.tsx
│   │   └── NokeDeviceDetailScreen.tsx
│   ├── components/
│   │   ├── NokeDeviceList.tsx
│   │   ├── NokeDeviceItem.tsx
│   │   ├── NokeUnlockButton.tsx
│   │   └── NokeConnectionStatus.tsx
│   ├── hooks/
│   │   ├── useNokeScanner.ts
│   │   ├── useNokeConnection.ts
│   │   └── useNokeUnlock.ts
│   └── styles/
│       └── ... (themed styles)
├── package.json
│   ├── name: "@noke/ui-components"
│   ├── peerDependencies:
│   │   ├── "react-native": ">=0.60.0"
│   │   └── "@noke/ble-manager": "^1.0.0"
│   └── dependencies:
│       └── "@react-navigation/*" (if needed)
└── README.md
```

### Installation (Cliente)

```bash
npm install @noke/ble-manager @noke/ui-components
cd ios && pod install
```

---

## Client Integration Patterns

### Pattern 1: Full UI Package (Easiest for client)

Cliente uses pre-built screens and components:

```typescript
// ClientApp/App.tsx
import { NokeScanScreen } from '@noke/ui-components';

function App() {
  return (
    <NavigationContainer>
      <Stack.Screen name="Scan" component={NokeScanScreen} />
    </NavigationContainer>
  );
}
```

**Client effort**: ~5 minutes  
**What they get**: Full Noke functionality with polished UI

### Pattern 2: Custom UI with BLE Library

Cliente builds their own UI, uses BLE logic:

```typescript
// ClientApp/screens/CustomScan.tsx
import NokeBLE from '@noke/ble-manager';
import { useState } from 'react';

function CustomScan() {
  const [devices, setDevices] = useState([]);
  
  useEffect(() => {
    const listener = NokeBLE.onDeviceDiscovered((device) => {
      setDevices(prev => [...prev, device]);
    });
    NokeBLE.startScan();
    return () => listener.remove();
  }, []);
  
  return (
    <View>
      {/* Their own custom UI */}
      {devices.map(d => <Text>{d.name}</Text>)}
    </View>
  );
}
```

**Client effort**: Custom development  
**What they get**: Full control over UI, Noke logic handled

### Pattern 3: Hybrid (Most Common)

Cliente uses some pre-built components, customizes others:

```typescript
import { NokeDeviceList, NokeUnlockButton } from '@noke/ui-components';

function ClientScreen() {
  return (
    <View style={clientStyles}>
      {/* Client's custom header */}
      <CustomHeader />
      
      {/* Noke pre-built device list */}
      <NokeDeviceList onDeviceSelected={handleSelect} />
      
      {/* Client's custom footer */}
      <CustomFooter />
    </View>
  );
}
```

**Client effort**: Medium  
**What they get**: Speed + flexibility

---

## Your Current Project Structure

### NokeApp (Development/Demo project)

```
NokeApp/  ← Este proyecto (testing/demo)
├── src/
│   ├── screens/
│   │   ├── Home/          ← Se convertirá en @noke/ui-components
│   │   ├── NativeScan/    ← Testing
│   │   └── Settings/      ← Testing
│   └── services/
│       └── BleService.ts  ← Facade (solo para testing)
├── modules/
│   ├── NokeBleManager/    ← Se convertirá en @noke/ble-manager
│   ├── NativeScanner/     ← Testing module
│   └── TestModule/        ← Testing module
└── Docs/                  ← Documentation
```

### Future: Extracted Packages

```
Monorepo (recomendado)
├── packages/
│   ├── ble-manager/       ← @noke/ble-manager (native)
│   │   ├── js/
│   │   ├── ios/
│   │   ├── android/
│   │   └── package.json
│   ├── ui-components/     ← @noke/ui-components (React)
│   │   ├── src/
│   │   └── package.json
│   └── demo-app/          ← NokeApp (example/testing)
│       └── ... (current NokeApp)
├── package.json           ← Root (monorepo config)
└── lerna.json / pnpm-workspace.yaml
```

---

## Migration Plan Updated

### Phase 1: Development ✅ CURRENT
- Build everything in NokeApp
- Test modules work
- Validate UI/UX
- Get existing native code integrated

### Phase 2: Extract BLE Library (2 weeks)
- Move `modules/NokeBleManager` → separate package
- Create `@noke/ble-manager` npm package
- Add proper package.json, README, examples
- Test in Old + New Architecture
- Publish to npm (private or public)

### Phase 3: Extract UI Library (1 week)
- Move `src/screens/Home` → separate package
- Create reusable components
- Create `@noke/ui-components` npm package
- Document all components
- Add theming support
- Publish to npm

### Phase 4: Client Testing (1 week)
- Create demo integration projects
- Test with Old Arch client (RN 0.68)
- Test with New Arch client (RN 0.76)
- Document integration steps
- Create video tutorials

### Phase 5: Production (1 week)
- Client integrates packages
- Production testing
- Bug fixes
- Support

**Total: 5-6 weeks**

---

## Distribution Options

### Option A: Public NPM (Open Source)

```bash
npm publish @noke/ble-manager
npm publish @noke/ui-components
```

**Pros**:
- Easy installation for clients
- Community can contribute
- Free hosting

**Cons**:
- Code is public
- Anyone can use it

### Option B: Private NPM Registry

```bash
npm publish @noke/ble-manager --registry=https://your-registry.com
```

**Pros**:
- Code stays private
- Control over who installs
- Professional

**Cons**:
- Requires npm organization ($$$)
- Or self-hosted registry

### Option C: Git Dependencies

```json
{
  "dependencies": {
    "@noke/ble-manager": "git+https://github.com/noke/ble-manager.git",
    "@noke/ui-components": "git+https://github.com/noke/ui-components.git"
  }
}
```

**Pros**:
- Free
- Private repos possible
- Version control

**Cons**:
- Slower installation
- Requires git access

**Recommendation**: Start with Option C (git), move to Option B (private npm) for production.

---

## Client Integration Example

### Scenario: Client wants "Activity" to scan and unlock

**Client's React Native app**:

```typescript
// ClientApp/src/screens/UnlockScreen.tsx
import React from 'react';
import { NokeScanScreen } from '@noke/ui-components';

export function UnlockScreen() {
  const handleDeviceUnlocked = (deviceId: string) => {
    // Client's custom logic after unlock
    navigation.navigate('Success');
  };

  return (
    <NokeScanScreen
      onDeviceUnlocked={handleDeviceUnlocked}
      customStyles={clientTheme}
      autoConnect={true}
    />
  );
}
```

**That's it!** Full Noke functionality in client's app with ~10 lines of code.

### What client needs to do:

1. Install packages:
```bash
npm install @noke/ble-manager @noke/ui-components
cd ios && pod install
```

2. Add permissions (we provide in docs):
```xml
<!-- iOS: Info.plist -->
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Access Noke locks</string>
```

3. Import and use:
```typescript
import { NokeScanScreen } from '@noke/ui-components';
<NokeScanScreen />
```

**Total integration time**: < 30 minutes

---

## Your Development Workflow

### Current (Development in NokeApp)

```
1. Write code in NokeApp
2. Test in NokeApp
3. Iterate quickly
```

### Future (After extraction)

```
1. Write code in packages/ble-manager or packages/ui-components
2. Test in packages/demo-app (NokeApp moved here)
3. Publish to npm
4. Client installs from npm
```

### Monorepo Benefits

```
packages/
├── ble-manager/      ← Edit here
├── ui-components/    ← Edit here
└── demo-app/         ← Test changes immediately
    └── node_modules/
        ├── @noke/ble-manager → symlink to ../../ble-manager
        └── @noke/ui-components → symlink to ../../ui-components
```

Changes in packages reflect immediately in demo-app (via symlinks).

---

## Architecture Support Strategy (For Libraries)

### Both packages must support Old + New

**Why?**
- You don't know client's RN version
- Some clients on RN 0.68 (Old)
- Some clients on RN 0.76+ (New)
- Library must work for ALL

### How to guarantee compatibility

#### @noke/ble-manager (Native module)

```objective-c
// ALWAYS include both code paths
RCT_EXPORT_METHOD(...) { }  // Works in both

#ifdef RCT_NEW_ARCH_ENABLED
  getTurboModule() { }      // Only for New Arch clients
#endif
```

**Client with New Arch**: Uses Turbo Module (fast)  
**Client with Old Arch**: Uses Bridge (works)  
**Same package, adapts automatically**

#### @noke/ui-components (Pure JS/React)

No native code → Works everywhere automatically.

### Testing matrix

Test your packages in:

| RN Version | Architecture | Test Result |
|------------|--------------|-------------|
| 0.68 | Old | Must work ✅ |
| 0.72 | Old | Must work ✅ |
| 0.76 | New | Must work ✅ |
| 0.82 | New | Must work ✅ |

---

## Package Dependencies

### @noke/ble-manager

```json
{
  "name": "@noke/ble-manager",
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-native": ">=0.60.0"
  },
  "dependencies": {}
}
```

**No UI dependencies** - Pure BLE logic.

### @noke/ui-components

```json
{
  "name": "@noke/ui-components",
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-native": ">=0.60.0",
    "@noke/ble-manager": "^1.0.0"
  },
  "dependencies": {
    "@react-navigation/bottom-tabs": "^7.0.0"
  }
}
```

**Depends on** @noke/ble-manager.

---

## Client Use Cases

### Use Case 1: Full Integration (UI + BLE)

```typescript
// Client installs both
npm install @noke/ble-manager @noke/ui-components

// Client uses pre-built screen
import { NokeScanScreen } from '@noke/ui-components';

function App() {
  return <NokeScanScreen />;
}
```

**Effort**: Minimal  
**Result**: Full Noke functionality

### Use Case 2: Custom UI (BLE only)

```typescript
// Client installs only BLE
npm install @noke/ble-manager

// Client builds own UI
import NokeBLE from '@noke/ble-manager';

function CustomUI() {
  const [devices, setDevices] = useState([]);
  
  useEffect(() => {
    NokeBLE.onDeviceDiscovered(d => setDevices(prev => [...prev, d]));
    NokeBLE.startScan();
  }, []);
  
  return <CustomDeviceList devices={devices} />;
}
```

**Effort**: Medium  
**Result**: Custom UI, Noke logic

### Use Case 3: Hybrid (Some components)

```typescript
// Client uses mix
import NokeBLE from '@noke/ble-manager';
import { NokeDeviceList, NokeUnlockButton } from '@noke/ui-components';

function HybridScreen() {
  return (
    <View>
      <CustomHeader />
      <NokeDeviceList />        {/* Your component */}
      <NokeUnlockButton />      {/* Your component */}
      <CustomFooter />
    </View>
  );
}
```

**Effort**: Low-Medium  
**Result**: Best of both

---

## What Changes in Your Current Project

### Current Structure (NokeApp - Monolithic)

Everything in one project:
- BLE logic
- UI components
- Testing modules
- Demo tabs

### Future Structure (Packages)

```
NokeApp (now "demo-app")
├── Uses @noke/ble-manager from npm
├── Uses @noke/ui-components from npm
└── Demonstrates integration
```

Separate repositories:
```
noke-ble-manager/        ← Package 1 (own repo)
├── Source moved from modules/NokeBleManager
└── Published to npm

noke-ui-components/      ← Package 2 (own repo)
├── Source moved from src/screens/Home
└── Published to npm

noke-demo-app/           ← Demo/testing (own repo)
├── Current NokeApp code
└── Shows how to integrate both packages
```

---

## Updated Timeline

### Week 1-2: Complete BLE Logic
- Import existing native code
- Test in NokeApp
- Validate all features work

### Week 3: Extract @noke/ble-manager
- Create package structure
- Move code from modules/NokeBleManager
- Test in multiple RN versions (Old + New)
- Write documentation
- Publish v1.0.0

### Week 4: Extract @noke/ui-components
- Create package structure
- Move UI from src/screens/Home
- Make components reusable/themeable
- Write documentation
- Publish v1.0.0

### Week 5: Client Integration Support
- Provide to test client
- Help with integration
- Fix issues
- Iterate on feedback

### Week 6: Production
- Client deploys
- Monitor for issues
- Support and maintenance

---

## Package Versioning Strategy

### @noke/ble-manager (Core)

```
v1.0.0 - Initial release (scan, connect, unlock)
v1.1.0 - Add firmware update
v1.2.0 - Add advanced features
v2.0.0 - Breaking changes (if needed)
```

### @noke/ui-components (UI)

```
v1.0.0 - Initial components (scan screen, device list)
v1.1.0 - Add theming support
v1.2.0 - Add unlock screen
v2.0.0 - UI redesign (if needed)
```

**Compatibility**:
```json
{
  "@noke/ui-components": "^1.0.0",
  "peerDependencies": {
    "@noke/ble-manager": "^1.0.0"  // Compatible versions
  }
}
```

---

## Documentation Requirements

### For @noke/ble-manager

Must include:
- Installation instructions (iOS + Android)
- Permission setup (both platforms)
- API reference (all methods)
- Event documentation
- Architecture compatibility notes
- Troubleshooting guide
- Example usage

### For @noke/ui-components

Must include:
- Installation instructions
- Component catalog with screenshots
- Props documentation
- Theming guide
- Usage examples
- Customization guide

### For Clients

Provide:
- Quick start guide (5 min integration)
- Full integration guide
- Migration guide (if from old system)
- Video tutorial
- Sample app (NokeApp as example)

---

## Architectural Decision: Why 2 Packages?

### Why not 1 package with everything?

**Separation of concerns**:

| Aspect | BLE Package | UI Package |
|--------|-------------|------------|
| **Purpose** | BLE logic | User interface |
| **Language** | Native (Obj-C/Java) | JavaScript/React |
| **Updates** | Rarely (stable protocol) | Often (UI improvements) |
| **Testing** | BLE device testing | Visual/UX testing |
| **Dependencies** | React Native core only | React, navigation, etc. |
| **Size** | Small (~100KB) | Larger (~500KB) |

**Benefits**:
- Client can use just BLE if they want custom UI
- UI updates don't require native recompilation
- Smaller bundle if client only needs BLE
- Easier testing (separate concerns)
- Clearer versioning

### Why not separate repositories?

**Actually, you SHOULD** (eventually):

```
3 separate repos:
├── noke-ble-manager        (npm package 1)
├── noke-ui-components      (npm package 2)
└── noke-demo-app          (example app)
```

But start with monorepo during development, split later.

---

## Next Steps (Updated)

### Immediate (This Week)

1. ✅ Finish current NokeApp implementation
2. ✅ Test all features work
3. ✅ Get manager approval
4. 📋 Plan package extraction strategy

### Phase 2 (Week 2-3)

1. Import existing native BLE code
2. Complete @noke/ble-manager functionality
3. Test in Old + New Architecture
4. Prepare for extraction

### Phase 3 (Week 4)

1. Extract to separate package
2. Set up monorepo structure
3. Create proper package.json
4. Write documentation
5. Test installation flow

### Phase 4 (Week 5)

1. Extract UI components
2. Make themeable/customizable
3. Create component catalog
4. Write UI documentation

### Phase 5 (Week 6)

1. Provide to test client
2. Integration support
3. Bug fixes
4. Production ready

---

## Summary for Manager

### What We're Building

**Not just an app** - We're building a **Noke SDK for React Native**

**Two products**:
1. **@noke/ble-manager** - Core BLE library (native)
2. **@noke/ui-components** - Drop-in UI components

**Target Users**:
- Third-party React Native apps
- Want to integrate Noke locks
- May have Old or New Architecture
- Want easy integration (< 30 min)

**Your Solution**:
- Hybrid architecture support (auto-adapts)
- Pre-built UI (if they want it)
- Headless BLE (if they want custom UI)
- Flexible and production-ready

**Competitive Advantage**:
- Most BLE libs don't support both architectures
- Most don't provide UI components
- Ours does both = easier for clients

---

**Current Status**: Development phase in NokeApp  
**Next**: Extract to distributable packages  
**Timeline**: 5-6 weeks to production SDK  
**Architecture**: Supports Old + New automatically

