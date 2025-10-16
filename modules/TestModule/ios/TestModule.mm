#import "TestModule.h"
#import <UIKit/UIKit.h>
#import <AudioToolbox/AudioToolbox.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTUtils.h>
#endif

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

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeTestModuleSpecJSI>(params);
}
#endif

@end

