#import "TestModule.h"
#import <UIKit/UIKit.h>
#import <AudioToolbox/AudioToolbox.h>

@implementation TestModule

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(getNativeString:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    NSString *nativeString = @"Hello from native iOS! 🚀";
    resolve(nativeString);
}

RCT_EXPORT_METHOD(showAlert:(NSString *)title
                  message:(NSString *)message
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    dispatch_async(dispatch_get_main_queue(), ^{
        UIAlertController *alert = [UIAlertController alertControllerWithTitle:title
                                                                       message:message
                                                                preferredStyle:UIAlertControllerStyleAlert];
        
        UIAlertAction *okAction = [UIAlertAction actionWithTitle:@"OK"
                                                           style:UIAlertActionStyleDefault
                                                         handler:^(UIAlertAction * _Nonnull action) {
            resolve(@YES);
        }];
        
        [alert addAction:okAction];
        
        UIViewController *rootVC = [UIApplication sharedApplication].keyWindow.rootViewController;
        [rootVC presentViewController:alert animated:YES completion:nil];
    });
}

RCT_EXPORT_METHOD(vibrate:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    // Trigger haptic feedback
    AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
    resolve(@YES);
}

RCT_EXPORT_METHOD(getDeviceInfo:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    UIDevice *device = [UIDevice currentDevice];
    
    NSDictionary *info = @{
        @"platform": @"iOS",
        @"osVersion": device.systemVersion,
        @"model": device.model
    };
    
    resolve(info);
}

// Note: New Architecture support disabled until codegen is properly configured
// To enable, add codegenConfig to package.json and regenerate specs

@end

