#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(NativeScanner, RCTEventEmitter)

// Scanning Methods
RCT_EXTERN_METHOD(startScan:(double)durationSeconds
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isScanning:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Filter Configuration Methods
RCT_EXTERN_METHOD(setRSSIThreshold:(NSInteger)threshold
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setFilterNokeOnly:(BOOL)enabled
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setServiceUUIDFilter:(BOOL)enabled
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getFilterSettings:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Connection Methods
RCT_EXTERN_METHOD(connect:(NSString *)deviceId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(disconnect:(NSString *)deviceId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getConnectionState:(NSString *)deviceId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Event Emitter Methods
RCT_EXTERN_METHOD(addListener:(NSString *)eventName)

RCT_EXTERN_METHOD(removeListeners:(double)count)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end


