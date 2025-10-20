import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface FilterSettings {
  rssiThreshold: number;
  filterNokeOnly: boolean;
  useServiceUUIDFilter: boolean;
}

export interface Spec extends TurboModule {
  // Scanning methods
  startScan(durationSeconds: number): Promise<void>;
  stopScan(): Promise<void>;
  isScanning(): Promise<boolean>;
  
  // Filter configuration methods
  setRSSIThreshold(threshold: number): Promise<void>;
  setFilterNokeOnly(enabled: boolean): Promise<void>;
  setServiceUUIDFilter(enabled: boolean): Promise<void>;
  getFilterSettings(): Promise<FilterSettings>;
  
  // Connection methods
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  getConnectionState(deviceId: string): Promise<string>;
  
  // Event emitter setup
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeScanner');

