#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

// Note: TestModule is using legacy bridge module for now
// To enable New Architecture, add codegenConfig to package.json
@interface TestModule : NSObject <RCTBridgeModule>

@end

