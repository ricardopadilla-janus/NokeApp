import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Scanning methods
  startScan(serviceUUIDs: string[], seconds: number, allowDuplicates: boolean): Promise<void>;
  stopScan(): Promise<void>;
  
  // Connection methods
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  
  // Utility methods
  isScanning(): Promise<boolean>;
  getConnectedDevices(): Promise<string[]>;
  
  // Event emitter setup
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NokeBleManager');

