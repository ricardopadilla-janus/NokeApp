# Quick Reference Guide

## 🎯 Current App Structure

### 3 Tabs Active

```
┌─────────────────────────────────────────┐
│  NokeApp - Bottom Tab Navigation        │
├─────────────────────────────────────────┤
│                                         │
│  📱 Tab 1: Home (Scan Devices)          │
│     • Uses: react-native-ble-manager   │
│     • Features: Full BLE (scan/connect)│
│     • Search, filter, sort by signal   │
│     • Live continuous scanning         │
│     • Status: ✅ Production ready       │
│                                         │
│  🔧 Tab 2: Native (Native Scan)         │
│     • Uses: NativeScanner module       │
│     • Features: BLE scan only          │
│     • Status: ✅ Testing/Demo           │
│                                         │
│  ⚙️  Tab 3: Settings                    │
│     • Uses: TestModule                 │
│     • Features: Native module tests    │
│     • Status: ✅ Validation             │
│                                         │
└─────────────────────────────────────────┘
```

## 🔧 Native Modules Status

| Module | Status | Purpose |
|--------|--------|---------|
| TestModule | ✅ Active | Validate native integration |
| NativeScanner | ✅ Active | BLE scan-only (incremental test) |
| NokeBleManager | 🔒 Disabled | Full BLE (awaiting code migration) |

## 📁 Where Is Everything?

### Source Code
```
src/screens/
  ├── Home/                    # BLE scanning (library)
  │   ├── HomeScreen.tsx
  │   ├── hooks/useBle.ts      # BLE state management
  │   ├── components/          # DeviceList, DeviceListItem
  │   └── styles.ts
  ├── NativeScan/              # BLE scanning (native)
  │   ├── NativeScanScreen.tsx
  │   └── styles.ts
  └── Settings/                # Native tests
      ├── SettingsScreen.tsx
      └── styles.ts

src/services/
  └── BleService.ts            # Implementation switcher
```

### Native Modules
```
modules/
  ├── TestModule/              # Simple native (alerts, vibrate)
  │   ├── js/                  # TypeScript specs
  │   └── ios/                 # Native iOS code
  ├── NativeScanner/           # BLE scan native
  │   ├── js/
  │   └── ios/
  └── NokeBleManager/          # Full BLE (disabled)
      ├── js/
      ├── ios/
      └── package.json.disabled
```

### Documentation
```
├── EXECUTIVE_SUMMARY.md         # This overview (for manager)
├── TURBO_BLE_MODULE_PLAN.md     # Technical implementation plan
├── IMPLEMENTATION_SUMMARY.md    # Phase 1 details & re-enable steps
└── QUICK_REFERENCE.md           # This file (quick lookup)
```

## 🚀 How To Test

### Test TestModule (Settings Tab)
1. Open app → Settings tab
2. Tap "Get Native String" → Should show "Hello from native iOS! 🚀"
3. Tap "Show Native Alert" → Native iOS alert appears
4. Tap "Vibrate Device" → Device vibrates
5. Tap "Get Device Info" → Shows iOS version/model

### Test NativeScanner (Native Tab)
1. Open app → Native tab
2. See "Bluetooth: on" status
3. Tap "Start Native Scan"
4. Watch devices appear in real-time
5. Verify logs in Xcode show `[NativeScanner]`
6. Tap "Stop Scan"

### Test Library Scanner (Home Tab)
1. Open app → Home tab
2. Tap "Start Scan"
3. Search and sort devices
4. Connect to devices
5. Verify full functionality works

## 🔄 Switching BLE Implementations

### Current: Using Library (Default)
```typescript
// src/services/BleService.ts
const BLE_IMPLEMENTATION: 'noke' | 'default' = 'default';
```

### Future: Using Native Module
```typescript
// src/services/BleService.ts
const BLE_IMPLEMENTATION: 'noke' | 'default' = 'noke';
```

## 📋 Next Steps Checklist

### Before Meeting with Manager
- [ ] Test all 3 tabs work
- [ ] Verify TestModule methods
- [ ] Verify NativeScanner finds devices
- [ ] Review EXECUTIVE_SUMMARY.md
- [ ] Prepare demo of both scanning approaches

### After Manager Approval
- [ ] Get access to existing native code
- [ ] Code review session (2-3 hours)
- [ ] Map out existing features and bugs
- [ ] Prioritize what to migrate first
- [ ] Begin Phase 2 implementation

### For Code Migration
- [ ] Share existing iOS project files
- [ ] Identify main BLE manager class
- [ ] List Noke-specific features needed
- [ ] Define acceptance criteria
- [ ] Set milestone dates

## 🛠️ Common Commands

### Run App
```bash
npm run ios          # Run on iOS
npm run android      # Run on Android (future)
npm start            # Start Metro bundler
```

### Clean Build (if issues)
```bash
cd ios && rm -rf build Pods Podfile.lock && pod install && cd ..
rm -rf ~/Library/Developer/Xcode/DerivedData/NokeApp-*
watchman watch-del-all
npm start -- --reset-cache
```

### Enable/Disable Native Modules
See detailed steps in `IMPLEMENTATION_SUMMARY.md` section "Steps to Re-enable Module"

## 📞 Key Contacts & Info

**Project**: NokeApp - Smart Lock BLE Management  
**Platform**: React Native 0.82 (New Architecture)  
**Primary OS**: iOS (Android future)  
**BLE Library**: react-native-ble-manager (current), Custom (future)  

---

## Quick Decision Matrix

### Should We Use Native Module?

**Use Custom Native Module IF**:
- ✅ Need Noke-specific BLE protocols
- ✅ Want full control over implementation
- ✅ Existing code has features library doesn't
- ✅ Performance is critical
- ✅ Long-term maintenance in-house

**Keep Library IF**:
- ❌ Generic BLE is sufficient
- ❌ Limited native development resources
- ❌ Tight timeline (< 1 week)
- ❌ No Noke-specific features needed

**Our Recommendation**: ✅ **Use Custom Native Module**  
**Reason**: Full Noke protocol support + better performance + full control

---

**Created**: Today  
**For**: Manager presentation and team alignment  
**Status**: Ready for review and code migration kickoff

