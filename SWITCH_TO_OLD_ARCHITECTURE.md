# How to Switch to Old Architecture (For Testing)

## Current State: New Architecture ✅

We are currently using:
- ✅ Turbo Modules (not Nitro Modules)
- ✅ New Architecture enabled
- ✅ JSI for direct native calls

---

## Steps to Test in Old Architecture

### 1. Change Android Configuration

**File**: `android/gradle.properties`

**Line 35**, change from:
```properties
newArchEnabled=true
```

To:
```properties
newArchEnabled=false
```

### 2. Change iOS Configuration

**File**: `ios/NokeApp/Info.plist`

Find the `RCTNewArchEnabled` key and change to `false`:

```xml
<key>RCTNewArchEnabled</key>
<false/>
```

**Note**: Currently your Info.plist has `<true/>` on line 39.

### 3. Clean Everything

```bash
# Clean Android
cd android
./gradlew clean
cd ..

# Clean iOS
cd ios
rm -rf build Pods Podfile.lock
pod install
cd ..

# Clean Metro cache
rm -rf $TMPDIR/metro-* $TMPDIR/haste-*
watchman watch-del-all

# Clean Xcode DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/NokeApp-*
```

### 4. Rebuild

```bash
# iOS
npm run ios

# Android
npm run android
```

### 5. Verify the Change

**In build logs you should see**:

**Old Architecture (Bridge)**:
- You will NOT see messages about "Configuring the target with the New Architecture"
- `*JSI.cpp` files will NOT be generated
- Modules use `RCTBridge` instead of JSI

**New Architecture (Turbo)**:
- You WILL see "Configuring the target with the New Architecture"
- `NativeScannerSpecJSI-generated.cpp` files ARE generated
- Modules use JSI

---

## What Changes in Behavior?

### What DOES NOT change (your code)

```typescript
// JavaScript - EXACTLY THE SAME
import NativeScanner from './modules/NativeScanner/js';
await NativeScanner.startScan(10);  // Works the same
```

### What DOES change (internal)

| Aspect | New Arch | Old Arch |
|---------|----------|----------|
| **Communication** | JSI (direct) | Bridge (serialized) |
| **Performance** | Faster | Slightly slower |
| **Compilation** | Generates JSI wrappers | Uses RCTBridge |
| **Logs** | `[Turbo]` | `[Bridge]` |

### Testing Checklist

When you switch to Old Architecture, test:

- [ ] Home tab: BLE scanning works
- [ ] Native tab: NativeScanner works
- [ ] Settings tab: TestModule works
- [ ] No crashes
- [ ] Acceptable performance

---

## To Return to New Architecture

### Same process but reversed:

**Android** - `android/gradle.properties`:
```properties
newArchEnabled=true
```

**iOS** - `ios/NokeApp/Info.plist`:
```xml
<key>RCTNewArchEnabled</key>
<true/>
```

Then clean and rebuild.

---

## Why Test Both?

### Reasons for testing:

1. **Validation**: Confirm our hybrid code works on both
2. **Debugging**: If there's a bug in New Arch, test in Old
3. **Comparison**: Measure performance difference
4. **Confidence**: Know we have a working fallback

### Our Recommendation

**Keep New Architecture** unless:
- ❌ You find critical bugs specific to New Arch
- ❌ Some third-party library is incompatible
- ❌ Performance issues (unlikely)

---

## Answers to Your Questions

### "Are we using Nitro or Turbo?"

**Answer**: TURBO MODULES (official)

- ✅ Turbo Modules = Meta/React Native system
- ❌ Nitro Modules = NO (Marc Rousavy's, experimental)

**Evidence in code**:
```typescript
// modules/*/js/Native*.ts
import { TurboModuleRegistry } from 'react-native';
//        ^^^^^ Turbo, not Nitro
```

### "How to test Old Architecture?"

**Answer**: Change flags and rebuild (steps above)

**Important**:
- Your code does NOT change
- Only project configuration
- Should work on both (already prepared)
- Currently: New Arch (better performance)

---

## Current Project State

```
NokeApp
├── Architecture: NEW (Turbo Modules)
├── Native Modules: Turbo (not Nitro)
├── Compatible: New + Old (hybrid code)
└── Recommendation: Keep NEW
```

**Do you need to switch to Old?**
- Only for testing/validation
- Switch back to New afterwards
- Not necessary for functionality

---

**TL;DR**:
- We use Turbo (official), not Nitro (experimental)
- We're on New Architecture (better)
- To test Old: change 2 flags and rebuild
- Our code works on both automatically
