#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <TestModuleSpec/TestModuleSpec.h>

@interface TestModule : NSObject <NativeTestModuleSpec>
#else
@interface TestModule : NSObject <RCTBridgeModule>
#endif

@end

