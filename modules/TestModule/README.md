# Test Module

Simple Turbo Native Module for validating native integration before implementing complex BLE functionality.

## Purpose

This module serves as a **proof of concept** to validate that:
- Turbo Module architecture works correctly
- Codegen generates proper native code
- JavaScript can call native iOS methods
- Both Old and New Architecture are supported
- The build pipeline is configured correctly

## Features

✅ **Get Native String**
- Returns a string from native iOS code
- Tests basic promise resolution

✅ **Show Native Alert**
- Displays a native UIAlertController
- Tests async operations and UI interaction

✅ **Vibrate Device**
- Triggers haptic feedback using AudioToolbox
- Tests simple native API calls

✅ **Get Device Info**
- Returns platform, OS version, and device model
- Tests returning complex objects from native

## Usage

The module is already integrated in the Settings screen. To test:

1. Run the app: `npm run ios`
2. Go to the **Settings** tab
3. Tap each test button to verify native calls work

### Programmatic Usage

```typescript
import TestModule from '../modules/TestModule/js';

// Get a string from native
const str = await TestModule.getNativeString();
console.log(str); // "Hello from native iOS! 🚀"

// Show native alert
await TestModule.showAlert('Title', 'Message');

// Vibrate device
await TestModule.vibrate();

// Get device info
const info = await TestModule.getDeviceInfo();
console.log(info.platform, info.osVersion, info.model);
```

## Architecture

### TypeScript Spec
`js/NativeTestModule.ts` defines the Turbo Module interface for codegen.

### iOS Implementation
`ios/TestModule.mm` implements the native methods using:
- `UIAlertController` for alerts
- `AudioServicesPlaySystemSound` for vibration
- `UIDevice` for device info

### Hybrid Architecture Support
The module automatically works with both:
- **New Architecture** (Turbo Module via JSI)
- **Old Architecture** (Legacy Bridge via RCT_EXPORT_METHOD)

## Files

```
modules/TestModule/
├── js/
│   ├── NativeTestModule.ts    # Turbo Module spec
│   └── index.ts               # Module wrapper
├── ios/
│   ├── TestModule.h           # iOS header
│   └── TestModule.mm          # iOS implementation
├── package.json               # Module config with codegenConfig
└── TestModule.podspec         # iOS pod specification
```

## Integration Points

1. **Root package.json** - Has `codegenConfig` pointing to TestModuleSpec
2. **ios/Podfile** - Includes `pod 'TestModule'`
3. **Settings Screen** - UI to test all methods

## What This Validates

✅ Codegen works and generates native code  
✅ Pod linking works correctly  
✅ JavaScript can call native iOS methods  
✅ Promises resolve from native to JS  
✅ Complex objects can be passed back  
✅ UI operations work from native  
✅ Build pipeline is configured correctly  

## Next Steps

Once this module works successfully:
1. Apply the same pattern to NokeBleManager
2. Import existing native BLE code
3. Test BLE functionality incrementally
4. Remove TestModule when no longer needed

## Success Criteria

If all 4 buttons in Settings work without errors, you're ready to proceed with the BLE native module integration! 🚀

