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
  isConnected?: boolean;           // Connection state
  isConnecting?: boolean;          // Connecting in progress
  advertising?: {
    localName?: string;
    serviceUUIDs?: string[];
    isConnectable?: boolean;
    macAddress?: string;           // MAC address extracted from manufacturer data
    version?: string;              // Firmware version (e.g., "v1.2")
    battery?: number;              // Battery level (0-100%)
    manufacturerDataLength?: number;  // Number of bytes in manufacturer data
  };
}

export interface FilterSettings {
  rssiThreshold: number;
  filterNokeOnly: boolean;
  useServiceUUIDFilter: boolean;
}

export interface BleEventListener {
  remove: () => void;
}

class NativeScanner {
  /**
   * Start scanning for BLE devices
   * @param durationSeconds - How long to scan (0 = indefinite)
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
   * Set RSSI threshold for filtering devices by distance
   * @param threshold - RSSI in dBm (e.g., -89). Closer to 0 = stronger signal
   * Default: -89 dBm (same as main app)
   */
  async setRSSIThreshold(threshold: number): Promise<void> {
    return NativeScannerModule.setRSSIThreshold(threshold);
  }

  /**
   * Enable/disable filtering to show only Noke devices
   * @param enabled - true = only Noke devices, false = all BLE devices
   * Default: true
   */
  async setFilterNokeOnly(enabled: boolean): Promise<void> {
    return NativeScannerModule.setFilterNokeOnly(enabled);
  }

  /**
   * Enable/disable Service UUID filter (MOST IMPORTANT FILTER)
   * This is a Core Bluetooth level filter that eliminates 99% of non-Noke devices
   * @param enabled - true = scan only for Noke Service UUIDs (default), false = scan all BLE
   * Default: true (same as main app)
   */
  async setServiceUUIDFilter(enabled: boolean): Promise<void> {
    return NativeScannerModule.setServiceUUIDFilter(enabled);
  }

  /**
   * Get current filter settings
   */
  async getFilterSettings(): Promise<FilterSettings> {
    return NativeScannerModule.getFilterSettings();
  }

  /**
   * Connect to a discovered device
   * @param deviceId - The device ID from the discovered device
   */
  async connect(deviceId: string): Promise<void> {
    return NativeScannerModule.connect(deviceId);
  }

  /**
   * Disconnect from a device
   * @param deviceId - The device ID to disconnect from
   */
  async disconnect(deviceId: string): Promise<void> {
    return NativeScannerModule.disconnect(deviceId);
  }

  /**
   * Get connection state of a device
   * @param deviceId - The device ID to check
   * @returns 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'unknown'
   */
  async getConnectionState(deviceId: string): Promise<string> {
    return NativeScannerModule.getConnectionState(deviceId);
  }

  /**
   * Event: Device discovered
   */
  onDeviceDiscovered(callback: (device: BleDevice) => void): BleEventListener {
    return eventEmitter.addListener('DeviceDiscovered', callback);
  }

  /**
   * Event: Device connected successfully
   */
  onDeviceConnected(callback: (device: { id: string; name: string }) => void): BleEventListener {
    return eventEmitter.addListener('DeviceConnected', callback);
  }

  /**
   * Event: Device disconnected
   */
  onDeviceDisconnected(callback: (device: { id: string; name: string; error?: string }) => void): BleEventListener {
    return eventEmitter.addListener('DeviceDisconnected', callback);
  }

  /**
   * Event: Connection failed
   */
  onDeviceConnectionError(callback: (device: { id: string; name: string; error: string }) => void): BleEventListener {
    return eventEmitter.addListener('DeviceConnectionError', callback);
  }

  /**
   * Event: Scan stopped
   */
  onScanStopped(callback: () => void): BleEventListener {
    return eventEmitter.addListener('ScanStopped', callback);
  }

  /**
   * Event: Bluetooth state changed
   * States: 'on', 'off', 'unauthorized', 'unsupported', 'resetting', 'unknown'
   */
  onBluetoothStateChanged(callback: (state: { state: string }) => void): BleEventListener {
    return eventEmitter.addListener('BluetoothStateChanged', callback);
  }
}

export default new NativeScanner();

