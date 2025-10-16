import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Scanning methods
  startScan(durationSeconds: number): Promise<void>;
  stopScan(): Promise<void>;
  isScanning(): Promise<boolean>;
  
  // Event emitter setup
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeScanner');

