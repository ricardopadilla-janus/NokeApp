#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NokeAPIClient, NSObject)

// Configuration
RCT_EXTERN_METHOD(setEnvironment:(NSString *)environment
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Authentication
RCT_EXTERN_METHOD(login:(NSString *)email
                  password:(NSString *)password
                  companyUUID:(NSString *)companyUUID
                  siteUUID:(NSString *)siteUUID
                  deviceId:(NSString *)deviceId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Offline Keys
RCT_EXTERN_METHOD(getAllOfflineKeys:(NSString *)userUUID
                  companyUUID:(NSString *)companyUUID
                  siteUUID:(NSString *)siteUUID
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Online Unlock Commands
RCT_EXTERN_METHOD(getUnlockCommands:(NSString *)mac
                  session:(NSString *)session
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Support Commands
RCT_EXTERN_METHOD(getSupportCommands:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Locate
RCT_EXTERN_METHOD(locateLock:(NSString *)lockUUID
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Token Management
RCT_EXTERN_METHOD(getAuthToken:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setAuthToken:(NSString *)token
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearAuthToken:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end

