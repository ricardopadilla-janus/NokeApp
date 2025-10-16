import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import NativeNativeScanner from './NativeScanner';

const LINKING_ERROR =
  `The package 'native-scanner' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const NativeScannerModule = isTurboModuleEnabled
  ? NativeNativeScanner
  : NativeModules.NativeScanner;

if (!NativeScannerModule) {
  throw new Error(LINKING_ERROR);
}

const eventEmitter = new NativeEventEmitter(NativeScannerModule);

export interface BleDevice {
  id: string;
  name: string;
  rssi: number;
  advertising?: {
    localName?: string;
    serviceUUIDs?: string[];
    isConnectable?: boolean;
  };
}

export interface BleEventListener {
  remove: () => void;
}

class NativeScanner {
  /**
   * Start scanning for BLE devices
   */
  async startScan(durationSeconds: number = 10): Promise<void> {
    return NativeScannerModule.startScan(durationSeconds);
  }

  /**
   * Stop scanning
   */
  async stopScan(): Promise<void> {
    return NativeScannerModule.stopScan();
  }

  /**
   * Check if currently scanning
   */
  async isScanning(): Promise<boolean> {
    return NativeScannerModule.isScanning();
  }

  /**
   * Event: Device discovered
   */
  onDeviceDiscovered(callback: (device: BleDevice) => void): BleEventListener {
    return eventEmitter.addListener('DeviceDiscovered', callback);
  }

  /**
   * Event: Scan stopped
   */
  onScanStopped(callback: () => void): BleEventListener {
    return eventEmitter.addListener('ScanStopped', callback);
  }

  /**
   * Event: Bluetooth state changed
   */
  onBluetoothStateChanged(callback: (state: string) => void): BleEventListener {
    return eventEmitter.addListener('BluetoothStateChanged', callback);
  }
}

export default new NativeScanner();

