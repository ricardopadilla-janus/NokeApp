#import "NokeBleManager.h"
#import <CoreBluetooth/CoreBluetooth.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTConvert.h>
#import <React/RCTUtils.h>
#else
#import <React/RCTBridge.h>
#import <React/RCTConvert.h>
#import <React/RCTEventDispatcher.h>
#endif

@interface NokeBleManager () <CBCentralManagerDelegate, CBPeripheralDelegate>
@property (nonatomic, strong) CBCentralManager *centralManager;
@property (nonatomic, strong) NSMutableDictionary *discoveredPeripherals;
@property (nonatomic, strong) NSMutableDictionary *connectedPeripherals;
@property (nonatomic, assign) BOOL isScanning;
@property (nonatomic, strong) NSTimer *scanTimer;
@property (nonatomic, strong) NSArray *serviceUUIDs;
@property (nonatomic, assign) BOOL allowDuplicates;
@end

@implementation NokeBleManager

RCT_EXPORT_MODULE()

- (instancetype)init {
    self = [super init];
    if (self) {
        _discoveredPeripherals = [NSMutableDictionary dictionary];
        _connectedPeripherals = [NSMutableDictionary dictionary];
        _isScanning = NO;
        
        dispatch_queue_t centralQueue = dispatch_queue_create("com.noke.ble.central", DISPATCH_QUEUE_SERIAL);
        _centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:centralQueue options:@{CBCentralManagerOptionShowPowerAlertKey: @NO}];
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"BleManagerDiscoverPeripheral",
             @"BleManagerStopScan",
             @"BleManagerConnectPeripheral",
             @"BleManagerDisconnectPeripheral",
             @"BleManagerDidUpdateState"];
}

#pragma mark - Module Methods

RCT_EXPORT_METHOD(startScan:(NSArray *)serviceUUIDs
                  seconds:(double)seconds
                  allowDuplicates:(BOOL)allowDuplicates
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    if (self.centralManager.state != CBManagerStatePoweredOn) {
        reject(@"BLE_NOT_READY", @"Bluetooth is not powered on", nil);
        return;
    }
    
    if (self.isScanning) {
        [self.centralManager stopScan];
    }
    
    self.serviceUUIDs = serviceUUIDs;
    self.allowDuplicates = allowDuplicates;
    self.isScanning = YES;
    
    NSArray *services = nil;
    if (serviceUUIDs.count > 0) {
        NSMutableArray *uuids = [NSMutableArray array];
        for (NSString *uuidString in serviceUUIDs) {
            CBUUID *uuid = [CBUUID UUIDWithString:uuidString];
            [uuids addObject:uuid];
        }
        services = uuids;
    }
    
    NSDictionary *options = @{
        CBCentralManagerScanOptionAllowDuplicatesKey: @(allowDuplicates)
    };
    
    [self.centralManager scanForPeripheralsWithServices:services options:options];
    
    if (seconds > 0) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(seconds * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            if (self.isScanning) {
                [self stopScanInternal];
            }
        });
    }
    
    resolve(@YES);
}

RCT_EXPORT_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self stopScanInternal];
    resolve(@YES);
}

- (void)stopScanInternal {
    if (self.isScanning) {
        self.isScanning = NO;
        [self.centralManager stopScan];
        [self sendEventWithName:@"BleManagerStopScan" body:@{@"status": @0}];
    }
}

RCT_EXPORT_METHOD(connect:(NSString *)deviceId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    CBPeripheral *peripheral = self.discoveredPeripherals[deviceId];
    if (!peripheral) {
        reject(@"DEVICE_NOT_FOUND", @"Device not found", nil);
        return;
    }
    
    peripheral.delegate = self;
    [self.centralManager connectPeripheral:peripheral options:nil];
    
    // Store resolve/reject for later callback
    resolve(@YES);
}

RCT_EXPORT_METHOD(disconnect:(NSString *)deviceId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    CBPeripheral *peripheral = self.connectedPeripherals[deviceId];
    if (!peripheral) {
        reject(@"DEVICE_NOT_CONNECTED", @"Device is not connected", nil);
        return;
    }
    
    [self.centralManager cancelPeripheralConnection:peripheral];
    resolve(@YES);
}

RCT_EXPORT_METHOD(isScanning:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    resolve(@(self.isScanning));
}

RCT_EXPORT_METHOD(getConnectedDevices:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    NSArray *deviceIds = [self.connectedPeripherals allKeys];
    resolve(deviceIds);
}

#pragma mark - CBCentralManagerDelegate

- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
    NSString *state = @"unknown";
    switch (central.state) {
        case CBManagerStateUnknown:
            state = @"unknown";
            break;
        case CBManagerStateResetting:
            state = @"resetting";
            break;
        case CBManagerStateUnsupported:
            state = @"unsupported";
            break;
        case CBManagerStateUnauthorized:
            state = @"unauthorized";
            break;
        case CBManagerStatePoweredOff:
            state = @"off";
            break;
        case CBManagerStatePoweredOn:
            state = @"on";
            break;
    }
    
    [self sendEventWithName:@"BleManagerDidUpdateState" body:@{@"state": state}];
}

- (void)centralManager:(CBCentralManager *)central
 didDiscoverPeripheral:(CBPeripheral *)peripheral
     advertisementData:(NSDictionary<NSString *,id> *)advertisementData
                  RSSI:(NSNumber *)RSSI {
    
    NSString *peripheralId = peripheral.identifier.UUIDString;
    self.discoveredPeripherals[peripheralId] = peripheral;
    
    NSMutableDictionary *advertisingData = [NSMutableDictionary dictionary];
    
    // Parse advertising data
    if (advertisementData[CBAdvertisementDataLocalNameKey]) {
        advertisingData[@"localName"] = advertisementData[CBAdvertisementDataLocalNameKey];
    }
    
    if (advertisementData[CBAdvertisementDataServiceUUIDsKey]) {
        NSArray *serviceUUIDs = advertisementData[CBAdvertisementDataServiceUUIDsKey];
        NSMutableArray *services = [NSMutableArray array];
        for (CBUUID *uuid in serviceUUIDs) {
            [services addObject:uuid.UUIDString];
        }
        advertisingData[@"serviceUUIDs"] = services;
    }
    
    if (advertisementData[CBAdvertisementDataIsConnectable]) {
        advertisingData[@"isConnectable"] = advertisementData[CBAdvertisementDataIsConnectable];
    }
    
    NSDictionary *deviceInfo = @{
        @"id": peripheralId,
        @"name": peripheral.name ?: @"Unknown",
        @"rssi": RSSI,
        @"advertising": advertisingData
    };
    
    [self sendEventWithName:@"BleManagerDiscoverPeripheral" body:deviceInfo];
}

- (void)centralManager:(CBCentralManager *)central
  didConnectPeripheral:(CBPeripheral *)peripheral {
    
    NSString *peripheralId = peripheral.identifier.UUIDString;
    self.connectedPeripherals[peripheralId] = peripheral;
    
    [self sendEventWithName:@"BleManagerConnectPeripheral" 
                       body:@{@"peripheral": peripheralId, @"status": @0}];
}

- (void)centralManager:(CBCentralManager *)central
didFailToConnectPeripheral:(CBPeripheral *)peripheral
                 error:(NSError *)error {
    
    NSString *peripheralId = peripheral.identifier.UUIDString;
    
    [self sendEventWithName:@"BleManagerConnectPeripheral"
                       body:@{@"peripheral": peripheralId, 
                              @"status": @(error.code),
                              @"error": error.localizedDescription}];
}

- (void)centralManager:(CBCentralManager *)central
didDisconnectPeripheral:(CBPeripheral *)peripheral
                 error:(NSError *)error {
    
    NSString *peripheralId = peripheral.identifier.UUIDString;
    [self.connectedPeripherals removeObjectForKey:peripheralId];
    
    NSMutableDictionary *body = [@{@"peripheral": peripheralId} mutableCopy];
    if (error) {
        body[@"status"] = @(error.code);
        body[@"error"] = error.localizedDescription;
    } else {
        body[@"status"] = @0;
    }
    
    [self sendEventWithName:@"BleManagerDisconnectPeripheral" body:body];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)addListener:(NSString *)eventName {
    [super addListener:eventName];
}

- (void)removeListeners:(double)count {
    [super removeListeners:count];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeBleManagerSpecJSI>(params);
}
#endif

@end

