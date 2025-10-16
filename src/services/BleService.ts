/**
 * BLE Service Facade
 * Allows switching between react-native-ble-manager and NokeBleManager
 */

export interface BleDevice {
  id: string;
  name: string;
  rssi: number;
  advertising?: any;
}

export interface BleEventListener {
  remove: () => void;
}

export interface IBleService {
  // Scanning
  startScan(serviceUUIDs?: string[], seconds?: number, allowDuplicates?: boolean): Promise<void>;
  stopScan(): Promise<void>;
  isScanning(): Promise<boolean>;
  
  // Connection
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  getConnectedDevices(): Promise<string[]>;
  
  // Events
  onDiscoverPeripheral(callback: (peripheral: BleDevice) => void): BleEventListener;
  onStopScan(callback: (data: any) => void): BleEventListener;
  onConnectPeripheral(callback: (data: any) => void): BleEventListener;
  onDisconnectPeripheral(callback: (data: any) => void): BleEventListener;
  onDidUpdateState?(callback: (data: any) => void): BleEventListener;
}

// Feature flag to switch implementations
// Set to 'noke' to use custom native module, 'default' for react-native-ble-manager
const BLE_IMPLEMENTATION: 'noke' | 'default' = 'default';

class BleServiceFactory {
  private static instance: IBleService;

  static getInstance(): IBleService {
    if (!BleServiceFactory.instance) {
      if (BLE_IMPLEMENTATION === 'noke') {
        BleServiceFactory.instance = BleServiceFactory.createNokeBleService();
      } else {
        BleServiceFactory.instance = BleServiceFactory.createDefaultBleService();
      }
    }
    return BleServiceFactory.instance;
  }

  private static createNokeBleService(): IBleService {
    const NokeBleManager = require('../../modules/NokeBleManager/js/index').default;
    
    return {
      async startScan(serviceUUIDs = [], seconds = 0, allowDuplicates = true) {
        return NokeBleManager.startScan(serviceUUIDs, seconds, allowDuplicates);
      },
      
      async stopScan() {
        return NokeBleManager.stopScan();
      },
      
      async isScanning() {
        return NokeBleManager.isScanning();
      },
      
      async connect(deviceId: string) {
        return NokeBleManager.connect(deviceId);
      },
      
      async disconnect(deviceId: string) {
        return NokeBleManager.disconnect(deviceId);
      },
      
      async getConnectedDevices() {
        return NokeBleManager.getConnectedDevices();
      },
      
      onDiscoverPeripheral(callback: (peripheral: BleDevice) => void) {
        return NokeBleManager.onDiscoverPeripheral(callback);
      },
      
      onStopScan(callback: (data: any) => void) {
        return NokeBleManager.onStopScan(callback);
      },
      
      onConnectPeripheral(callback: (data: any) => void) {
        return NokeBleManager.onConnectPeripheral(callback);
      },
      
      onDisconnectPeripheral(callback: (data: any) => void) {
        return NokeBleManager.onDisconnectPeripheral(callback);
      },
      
      onDidUpdateState(callback: (data: any) => void) {
        return NokeBleManager.onDidUpdateState(callback);
      },
    };
  }

  private static createDefaultBleService(): IBleService {
    const BleManager = require('react-native-ble-manager').default;
    
    return {
      async startScan(serviceUUIDs = [], seconds = 0, allowDuplicates = true) {
        return BleManager.scan(serviceUUIDs, seconds, allowDuplicates);
      },
      
      async stopScan() {
        return BleManager.stopScan();
      },
      
      async isScanning() {
        // react-native-ble-manager doesn't have this method, track manually
        return Promise.resolve(false);
      },
      
      async connect(deviceId: string) {
        return BleManager.connect(deviceId);
      },
      
      async disconnect(deviceId: string) {
        return BleManager.disconnect(deviceId);
      },
      
      async getConnectedDevices() {
        const devices = await BleManager.getConnectedPeripherals([]);
        return devices.map((d: any) => d.id);
      },
      
      onDiscoverPeripheral(callback: (peripheral: BleDevice) => void) {
        return BleManager.onDiscoverPeripheral(callback);
      },
      
      onStopScan(callback: (data: any) => void) {
        return BleManager.onStopScan(callback);
      },
      
      onConnectPeripheral(callback: (data: any) => void) {
        return BleManager.onConnectPeripheral(callback);
      },
      
      onDisconnectPeripheral(callback: (data: any) => void) {
        return BleManager.onDisconnectPeripheral(callback);
      },
      
      onDidUpdateState(callback: (data: any) => void) {
        return BleManager.onDidUpdateState?.(callback) || { remove: () => {} };
      },
    };
  }
}

export const BleService = BleServiceFactory.getInstance();
export { BLE_IMPLEMENTATION };

