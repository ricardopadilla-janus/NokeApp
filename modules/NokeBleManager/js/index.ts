import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import NativeNokeBleManager from './NativeBleManager';

const LINKING_ERROR =
  `The package 'noke-ble-manager' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const NokeBleManagerModule = isTurboModuleEnabled
  ? NativeNokeBleManager
  : NativeModules.NokeBleManager;

if (!NokeBleManagerModule) {
  throw new Error(LINKING_ERROR);
}

const eventEmitter = new NativeEventEmitter(NokeBleManagerModule);

export interface BlePeripheral {
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

class NokeBleManager {
  /**
   * Start scanning for BLE peripherals
   */
  async startScan(
    serviceUUIDs: string[] = [],
    seconds: number = 0,
    allowDuplicates: boolean = true
  ): Promise<void> {
    return NokeBleManagerModule.startScan(serviceUUIDs, seconds, allowDuplicates);
  }

  /**
   * Stop scanning for BLE peripherals
   */
  async stopScan(): Promise<void> {
    return NokeBleManagerModule.stopScan();
  }

  /**
   * Connect to a BLE peripheral
   */
  async connect(deviceId: string): Promise<void> {
    return NokeBleManagerModule.connect(deviceId);
  }

  /**
   * Disconnect from a BLE peripheral
   */
  async disconnect(deviceId: string): Promise<void> {
    return NokeBleManagerModule.disconnect(deviceId);
  }

  /**
   * Check if currently scanning
   */
  async isScanning(): Promise<boolean> {
    return NokeBleManagerModule.isScanning();
  }

  /**
   * Get list of connected device IDs
   */
  async getConnectedDevices(): Promise<string[]> {
    return NokeBleManagerModule.getConnectedDevices();
  }

  /**
   * Event: Peripheral discovered during scan
   */
  onDiscoverPeripheral(
    callback: (peripheral: BlePeripheral) => void
  ): BleEventListener {
    return eventEmitter.addListener('BleManagerDiscoverPeripheral', callback);
  }

  /**
   * Event: Scan stopped
   */
  onStopScan(callback: (data: { status: number }) => void): BleEventListener {
    return eventEmitter.addListener('BleManagerStopScan', callback);
  }

  /**
   * Event: Peripheral connected
   */
  onConnectPeripheral(
    callback: (data: { peripheral: string; status: number }) => void
  ): BleEventListener {
    return eventEmitter.addListener('BleManagerConnectPeripheral', callback);
  }

  /**
   * Event: Peripheral disconnected
   */
  onDisconnectPeripheral(
    callback: (data: { peripheral: string; status?: number }) => void
  ): BleEventListener {
    return eventEmitter.addListener('BleManagerDisconnectPeripheral', callback);
  }

  /**
   * Event: Bluetooth state changed
   */
  onDidUpdateState(
    callback: (data: { state: string }) => void
  ): BleEventListener {
    return eventEmitter.addListener('BleManagerDidUpdateState', callback);
  }
}

export default new NokeBleManager();

