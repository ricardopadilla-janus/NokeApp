#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <NokeBleManagerSpec/NokeBleManagerSpec.h>

@interface NokeBleManager : RCTEventEmitter <NativeBleManagerSpec>
#else
@interface NokeBleManager : RCTEventEmitter <RCTBridgeModule>
#endif

@end

