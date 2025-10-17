# React Native Architecture: Old vs New - Simple Explanation

## What is this Old vs New Architecture thing?

React Native has two ways to communicate JavaScript with native code. Think of them as two different messaging systems.

---

## Old Architecture (Bridge) - The traditional system

### How does it work?

```
JavaScript                     Native (iOS/Android)
    |                               |
    |  "Call function X"            |
    |  (convert to JSON)            |
    |------------------------------>|
    |         BRIDGE                |
    |  (serialization/queue)        |
    |                               |
    |                          Execute X
    |                               |
    |     Result (JSON)             |
    |<------------------------------|
    |         BRIDGE                |
    |  (deserialization)            |
    |                               |
Show result
```

**Problem**: Everything is serialized to JSON, passes through a queue, and is asynchronous. Slow for frequent operations.

---

## New Architecture (JSI/Turbo Modules) - The modern system

### How does it work?

```
JavaScript                     Native (iOS/Android)
    |                               |
    |  Call function X              |
    |  (direct call)                |
    |==============================>|  (JSI - shared memory)
    |      NO SERIALIZATION         |
    |                               |
    |                          Execute X
    |                               |
    |     Result (direct)           |
    |<==============================|  (JSI - no conversion)
    |                               |
Show result
```

**Advantage**: Direct calls, no serialization, can be synchronous. Much faster.

---

## How does our code work in BOTH?

### Conditional Compilation

Our modules have **two implementations in the same file**:

**Note**: NativeScanner is implemented in **Swift** with bridging to React Native, while other modules may use Objective-C. The hybrid architecture concept applies to both languages.

**Conceptual example with Objective-C module**:
```objective-c
// Example: modules/SomeModule/ios/SomeModule.h

#ifdef RCT_NEW_ARCH_ENABLED
  // 👇 New Architecture version
  #import <SomeModuleSpec/SomeModuleSpec.h>
  @interface SomeModule : RCTEventEmitter <SomeModuleSpec>
#else
  // 👇 Old Architecture version
  @interface SomeModule : RCTEventEmitter <RCTBridgeModule>
#endif
```

**NativeScanner (Swift)**:
```swift
// modules/NativeScanner/ios/NativeScanner.swift

@objc(NativeScanner)
class NativeScanner: RCTEventEmitter, CBCentralManagerDelegate {
    // Swift uses @objc decorators to export methods
    @objc(startScan:resolve:reject:)
    func startScan(durationSeconds: Double,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        // Swift code with CoreBluetooth
        centralManager.scanForPeripherals(withServices: nil, options: options)
    }
}
```

**What does this mean?**

- If `RCT_NEW_ARCH_ENABLED` is active → Uses Turbo Module
- If NOT active → Uses traditional Bridge
- **Same code works for both** (Swift or Objective-C)
- Swift uses `@objc` decorators; Objective-C uses `#ifdef` preprocessor

### Swift vs Objective-C Compatibility

Both languages work with both architectures:

```
┌─────────────────────────────────────┐
│  React Native Architecture          │
├─────────────────────────────────────┤
│  New Arch ✅    │    Old Arch ✅    │
├─────────────────┼───────────────────┤
│  Swift ✅       │    Swift ✅       │
│  Objective-C ✅ │    Objective-C ✅ │
└─────────────────────────────────────┘
```

---

## How is one or the other activated?

### Current State: New Architecture ENABLED ✅

**File**: `android/gradle.properties`
```properties
newArchEnabled=true
```

**File**: `ios/NokeApp/Info.plist`
```xml
<key>RCTNewArchEnabled</key>
<true/>
```

### To Change to Old Architecture

**Android** - Edit `android/gradle.properties`:
```properties
newArchEnabled=false  # Change to false
```

**iOS** - Edit `ios/NokeApp/Info.plist`:
```xml
<key>RCTNewArchEnabled</key>
<false/>  <!-- Change to false -->
```

**Then**:
```bash
# Android
cd android && ./gradlew clean && cd ..

# iOS
cd ios && rm -rf build Pods Podfile.lock && pod install && cd ..

# Rebuild
npm run ios   # or npm run android
```

---

## What is our app using NOW?

### Current State: New Architecture (Turbo Modules)

**Evidence**:
1. `gradle.properties`: `newArchEnabled=true`
2. When compiling iOS, it says: `"Configuring the target with the New Architecture"`
3. Codegen generates JSI files (`NativeScannerSpecJSI`)

**What it means**:
- ✅ Our modules use JSI (direct calls)
- ✅ Better performance
- ✅ Prepared for the future of React Native
- ✅ But still works on Old if we change the flag

---

## JavaScript: Does it notice the difference?

### NO. JavaScript code is IDENTICAL

**From JavaScript**:
```typescript
import NativeScanner from './modules/NativeScanner/js';

// This code works THE SAME on both architectures
await NativeScanner.startScan(10);
```

**What changes internally**:
- **New Arch**: Direct call via JSI
- **Old Arch**: Call via Bridge

**But your JavaScript code doesn't change**. Transparent.

---

## Advantages of supporting both

### Why did we do this?

1. **Compatibility**: If there's an issue with New Arch, we switch to Old
2. **Testing**: We can test on both and compare
3. **Users**: Some devices/versions prefer Old Arch
4. **Migration**: Allows gradual transition

### Which should we use?

**Recommendation**: ✅ **New Architecture (current)**

**Reasons**:
- It's the future of React Native (Old will be deprecated)
- Better performance for BLE (frequent callbacks)
- Already working in our project
- React Native 0.76+ recommends New Arch

**Keep Old as an option**:
- Only if we find specific New Arch bugs
- For testing/comparison
- Don't change without reason

---

## Summary for Managers

### Question: "Does it work on both architectures?"

**Answer**: Yes, our native modules work on:
- ✅ New Architecture (Turbo Modules) - CURRENT
- ✅ Old Architecture (Bridge) - FALLBACK

**How**: We use conditional compilation (`#ifdef`). The same code compiles in two different ways depending on the flag.

### Question: "Which are we using?"

**Answer**: New Architecture (Turbo Modules)

**Evidence**:
- `gradle.properties` has `newArchEnabled=true`
- Build logs show "New Architecture"
- Better performance

### Question: "How do we switch?"

**Answer**: Change a flag in configuration and recompile:
```
Android: gradle.properties → newArchEnabled=false
iOS: Info.plist → RCTNewArchEnabled=false
```

### Question: "Should we switch?"

**Answer**: No. New Architecture is:
- Faster (critical for BLE)
- The future of React Native
- Already working in our project
- Recommended by React Native for new projects

---

## Visual Diagram

```
┌─────────────────────────────────────────────────┐
│           JavaScript Code (React Native)            │
│                                                     │
│  await NativeScanner.startScan(10);                 │
└────────────────┬────────────────────────────────────┘
                 │
                 │
      ┌──────────┴──────────┐
      │                     │
      ▼                     ▼
┌─────────────┐       ┌─────────────┐
│ NEW ARCH    │       │ OLD ARCH    │
│ (JSI/Turbo) │       │ (Bridge)    │
│             │       │             │
│ Direct      │       │ Serialize   │
│ Call ⚡     │       │ to JSON     │
│             │       │ Pass queue  │
└──────┬──────┘       └──────┬──────┘
       │                     │
       │                     │
       ▼                     ▼
┌─────────────────────────────────────┐
│    Native iOS Code                  │
│    (NativeScanner.swift)            │
│                                     │
│    centralManager.scanFor...        │
└─────────────────────────────────────┘

Flag: newArchEnabled=true  →  Uses NEW ARCH
Flag: newArchEnabled=false →  Uses OLD ARCH
```

---

## For Presentations

### Key Points

1. **We have dual compatibility**
   - Single code works on both architectures
   - Magic of `#ifdef` at compile time

2. **We currently use New Architecture**
   - More modern and faster
   - Recommended by React Native
   - Better for BLE (frequent operations)

3. **We can switch easily**
   - Just a configuration flag
   - No code changes
   - Fallback if there are problems

4. **No need to decide now**
   - Already working on New Arch
   - Old Arch available if needed
   - Transparent to end user

### If they ask: "Which is better?"

**New Architecture** for:
- ✅ Better performance (BLE with many callbacks)
- ✅ Future of React Native
- ✅ New projects (our case)

**Old Architecture** only if:
- ❌ Critical bugs in New Arch
- ❌ Need to support very old RN versions
- ❌ Incompatible third-party modules

**Our recommendation**: Continue with New Architecture (current)

---

## Quick Glossary

- **Bridge**: Old communication system JS ↔ Native (serializes everything to JSON)
- **JSI**: JavaScript Interface - shared memory between JS and Native
- **Turbo Module**: Native module that uses JSI (New Architecture)
- **Codegen**: Automatically generates C++ code from TypeScript
- **RCT_NEW_ARCH_ENABLED**: Compile flag that enables/disables New Arch

---

**Conclusion**: Our modules are "smart hybrids" that automatically adapt to the configured architecture. They currently use New Architecture (faster), but can fall back to Old if necessary.
