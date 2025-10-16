#import "NativeScanner.h"
#import <CoreBluetooth/CoreBluetooth.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTUtils.h>
#endif

@interface NativeScanner () <CBCentralManagerDelegate>
@property (nonatomic, strong) CBCentralManager *centralManager;
@property (nonatomic, strong) NSMutableDictionary *discoveredPeripherals;
@property (nonatomic, assign) BOOL isScanning;
@property (nonatomic, strong) NSTimer *scanTimer;
@end

@implementation NativeScanner

RCT_EXPORT_MODULE()

- (instancetype)init {
    self = [super init];
    if (self) {
        _discoveredPeripherals = [NSMutableDictionary dictionary];
        _isScanning = NO;
        
        // Initialize Central Manager on a background queue
        dispatch_queue_t centralQueue = dispatch_queue_create("com.noke.scanner", DISPATCH_QUEUE_SERIAL);
        _centralManager = [[CBCentralManager alloc] initWithDelegate:self 
                                                                queue:centralQueue 
                                                              options:@{CBCentralManagerOptionShowPowerAlertKey: @NO}];
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"DeviceDiscovered", @"ScanStopped", @"BluetoothStateChanged"];
}

#pragma mark - Exported Methods

RCT_EXPORT_METHOD(startScan:(double)durationSeconds
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    NSLog(@"[NativeScanner] startScan called with duration: %.0f seconds", durationSeconds);
    
    if (self.centralManager.state != CBManagerStatePoweredOn) {
        NSString *errorMsg = @"Bluetooth is not powered on";
        NSLog(@"[NativeScanner] ERROR: %@", errorMsg);
        reject(@"BLE_NOT_READY", errorMsg, nil);
        return;
    }
    
    if (self.isScanning) {
        NSLog(@"[NativeScanner] Already scanning, stopping first");
        [self.centralManager stopScan];
    }
    
    self.isScanning = YES;
    
    // Start scanning for all peripherals
    NSDictionary *options = @{
        CBCentralManagerScanOptionAllowDuplicatesKey: @YES
    };
    
    NSLog(@"[NativeScanner] Starting BLE scan...");
    [self.centralManager scanForPeripheralsWithServices:nil options:options];
    
    // Auto-stop after duration
    if (durationSeconds > 0) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(durationSeconds * NSEC_PER_SEC)), 
                      dispatch_get_main_queue(), ^{
            if (self.isScanning) {
                NSLog(@"[NativeScanner] Auto-stopping scan after timeout");
                [self stopScanInternal];
            }
        });
    }
    
    resolve(@YES);
}

RCT_EXPORT_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    NSLog(@"[NativeScanner] stopScan called");
    [self stopScanInternal];
    resolve(@YES);
}

RCT_EXPORT_METHOD(isScanning:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    resolve(@(self.isScanning));
}

- (void)stopScanInternal {
    if (self.isScanning) {
        self.isScanning = NO;
        [self.centralManager stopScan];
        NSLog(@"[NativeScanner] Scan stopped");
        [self sendEventWithName:@"ScanStopped" body:@{}];
    }
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
    
    NSLog(@"[NativeScanner] Bluetooth state: %@", state);
    [self sendEventWithName:@"BluetoothStateChanged" body:@{@"state": state}];
}

- (void)centralManager:(CBCentralManager *)central
 didDiscoverPeripheral:(CBPeripheral *)peripheral
     advertisementData:(NSDictionary<NSString *,id> *)advertisementData
                  RSSI:(NSNumber *)RSSI {
    
    NSString *peripheralId = peripheral.identifier.UUIDString;
    
    // Store discovered peripheral
    self.discoveredPeripherals[peripheralId] = peripheral;
    
    // Parse advertising data
    NSMutableDictionary *advertising = [NSMutableDictionary dictionary];
    
    if (advertisementData[CBAdvertisementDataLocalNameKey]) {
        advertising[@"localName"] = advertisementData[CBAdvertisementDataLocalNameKey];
    }
    
    if (advertisementData[CBAdvertisementDataServiceUUIDsKey]) {
        NSArray *serviceUUIDs = advertisementData[CBAdvertisementDataServiceUUIDsKey];
        NSMutableArray *services = [NSMutableArray array];
        for (CBUUID *uuid in serviceUUIDs) {
            [services addObject:uuid.UUIDString];
        }
        advertising[@"serviceUUIDs"] = services;
    }
    
    if (advertisementData[CBAdvertisementDataIsConnectable]) {
        advertising[@"isConnectable"] = advertisementData[CBAdvertisementDataIsConnectable];
    }
    
    // Build device info
    NSDictionary *deviceInfo = @{
        @"id": peripheralId,
        @"name": peripheral.name ?: @"Unknown",
        @"rssi": RSSI,
        @"advertising": advertising
    };
    
    NSLog(@"[NativeScanner] Discovered: %@ (RSSI: %@)", peripheral.name ?: @"Unknown", RSSI);
    
    // Send event to JavaScript
    [self sendEventWithName:@"DeviceDiscovered" body:deviceInfo];
}

#pragma mark - Turbo Module Support

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
    return std::make_shared<facebook::react::NativeScannerSpecJSI>(params);
}
#endif

@end

