#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <NativeScannerSpec/NativeScannerSpec.h>

@interface NativeScanner : RCTEventEmitter <NativeScannerSpec>
#else
@interface NativeScanner : RCTEventEmitter <RCTBridgeModule>
#endif

@end

