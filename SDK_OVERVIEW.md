# Noke React Native SDK - Manager Overview

## 🎯 Project Objective

Create **React Native SDK** (2 NPM packages) for third parties to integrate Noke Smart Locks into their apps.

---

## 📦 Final Products

### 1. @noke/ble-manager (Native BLE Library)

**What it is**: Native module with BLE logic and Noke protocols  
**No UI**: Just functionality, client provides their own UI if they want  
**Platforms**: iOS + Android  

```bash
# Client installs:
npm install @noke/ble-manager
```

```typescript
// Client uses:
import NokeBLE from '@noke/ble-manager';
await NokeBLE.startScan();
await NokeBLE.unlock(deviceId);
```

### 2. @noke/ui-components (UI Components)

**What it is**: Pre-built React Native screens and components  
**Optional**: Client can use them or build their own UI  
**Depends on**: @noke/ble-manager  

```bash
# Client installs:
npm install @noke/ble-manager @noke/ui-components
```

```typescript
// Client uses complete screen:
import { NokeScanScreen } from '@noke/ui-components';
<NokeScanScreen />  // Ready! Works immediately
```

---

## ✅ Why Support Both Architectures

### The Problem

**We don't know which React Native the client uses**:
- Some have RN 0.68 → Old Architecture
- Some have RN 0.76 → New Architecture
- We can't ask them to update their project

### The Solution

**Hybrid code that works on BOTH**:

```objective-c
// Our native code has both implementations
RCT_EXPORT_METHOD(...)  // Always works

#ifdef RCT_NEW_ARCH_ENABLED
  getTurboModule()      // Only if client has New Arch
#endif
```

**Result**:
- Client with Old Arch → Uses Bridge (works)
- Client with New Arch → Uses Turbo (faster)
- **Same NPM package for both**

### Decision: NOT up to us

**Depends on the CLIENT's project**:

| Client has | Our library uses |
|---------------|---------------------|
| RN 0.60-0.75 (Old) | Bridge automatically |
| RN 0.76+ (New) | Turbo automatically |

**It adapts itself** by detecting the client's `newArchEnabled` flag.

---

## 🔧 NokeApp = Development Project

### NokeApp is NOT the final product

**NokeApp is**:
- Development and testing project
- Sandbox to test features
- Demo to show clients
- Eventually becomes "example app"

**The final products are**:
- Package 1: @noke/ble-manager
- Package 2: @noke/ui-components

### Current vs Future Structure

**Current (development)**:
```
NokeApp/
├── modules/NokeBleManager/  → Will be @noke/ble-manager
├── src/screens/Home/        → Will be @noke/ui-components
└── Everything in one project
```

**Future (distribution)**:
```
3 repositories:
├── noke-ble-manager/      → npm package 1
├── noke-ui-components/    → npm package 2
└── noke-demo-app/         → NokeApp (example)
```

---

## ⏱️ Updated Timeline

### Phase 1-2: Development (3-4 weeks)
- Complete BLE functionality
- Import existing native code
- Polish UI components
- **Output**: Everything working in NokeApp

### Phase 3: Extract to Packages (1 week)
- Create package structure
- Move code to separate packages
- Configure monorepo
- **Output**: 2 NPM packages ready

### Phase 4: Compatibility Testing (1 week)
- Create demo project RN 0.68 (Old Arch)
- Create demo project RN 0.76 (New Arch)
- Install packages in both
- Validate they work
- **Output**: Compatibility guarantee

### Phase 5: Client Integration (1 week)
- Client installs packages
- Support during integration
- Fix issues
- **Output**: Client using SDK in production

**Total: 6-7 weeks**

---

## 🎯 Client Integration (Real Use Case)

### Scenario: Client wants to add Noke to their app

**Client has**: Existing React Native app (RN 0.72, Old Arch)

**Client steps**:

```bash
# 1. Install (2 minutes)
npm install @noke/ble-manager @noke/ui-components
cd ios && pod install

# 2. Add iOS permissions (2 minutes)
# (We provide in our docs)

# 3. Use in code (5 minutes)
import { NokeScanScreen } from '@noke/ui-components';

function App() {
  return (
    <Stack.Screen name="Unlock" component={NokeScanScreen} />
  );
}
```

**Total integration time**: < 30 minutes  
**Result**: Client's app can scan and unlock Nokes

---

## ✅ Advantages of Our Solution

### vs. Other BLE Libraries

| Feature | Other libraries | Noke SDK |
|----------------|-----------------|----------|
| Old Arch support | ⚠️ Some | ✅ Yes |
| New Arch support | ⚠️ Some | ✅ Yes |
| Noke protocols | ❌ No | ✅ Yes |
| UI included | ❌ No | ✅ Optional |
| Easy integration | ⚠️ Medium | ✅ 30 min |

### Value for Client

✅ **Plug & Play**: Install package and it works  
✅ **Flexible**: Use their own UI or ours  
✅ **Compatible**: Works with their RN version  
✅ **Support**: Complete docs and examples  
✅ **Performance**: Optimized (Turbo if they can, Bridge if not)  

---

## 📋 Key Technical Decisions

### 1. Old or New Architecture?

**Decision**: BOTH (hybrid code)

**Reason**: We don't know what the client uses. Must work for everyone.

**How**: Conditional compilation (`#ifdef`). Adapts automatically.

### 2. 1 or 2 Packages?

**Decision**: 2 separate packages

**Reason**:
- Client may want only BLE (their own UI)
- UI updates don't require recompiling native
- Smaller bundles
- Separation of concerns

### 3. Turbo Modules or Nitro?

**Decision**: Turbo Modules (official from RN)

**Reason**:
- Official and supported by Meta
- Better documentation
- More stable than Nitro
- Also compatible with Old Arch

### 4. Monorepo or Separate Repos?

**Decision**: Start monorepo, separate later

**Reason**:
- Faster development now
- Easy joint testing
- Separate when ready to publish

---

## 🚀 Business Value

### For Noke

- **Product**: Reusable SDK
- **Market**: Any React Native app
- **Scalable**: Multiple clients, one SDK
- **Revenue**: Potential licensing

### For Client

- **Savings**: 30 min vs 2-3 weeks of development
- **Quality**: Tested and maintained code by Noke
- **Support**: Documentation and updates
- **Flexibility**: Can customize what they need

---

## Frequently Asked Questions

### "Does the client need to know about architectures?"

**NO**. Our library adapts automatically. It's transparent to them.

### "Does it work if the client has old RN?"

**YES**. We support from RN 0.60+ (Old Architecture).

### "What if they update to new RN?"

**It keeps working**. Automatically adapts to New Architecture (faster).

### "Do they have to use our UI?"

**NO**. They can:
- Option A: Use our components (fast)
- Option B: Use only BLE and build their UI (flexible)
- Option C: Mix (some of our components, others their own)

### "How do we test compatibility?"

**Testing on**:
- NokeApp with New Arch (current)
- Demo project with Old Arch (RN 0.68)
- Demo project with New Arch (RN 0.76)

---

## Next Steps

### This Week
1. ✅ Complete functionality in NokeApp
2. ✅ Validate hybrid architecture
3. 📋 Present to manager
4. 🎯 Get approval

### Weeks 2-3
1. Import existing native BLE code
2. Complete all features
3. Exhaustive testing

### Weeks 4-5
1. Extract to NPM packages
2. Create client documentation
3. Compatibility testing

### Week 6
1. Deliver to first client
2. Integration support
3. Final adjustments

---

**Recommendation**: ✅ Proceed with SDK development  
**Justification**: Hybrid code guarantees universal compatibility  
**Timeline**: 6-7 weeks to SDK in production  
**Risk**: Low (validated strategy, fallbacks in place)
