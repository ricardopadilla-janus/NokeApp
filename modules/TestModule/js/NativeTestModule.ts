import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Simple string method
  getNativeString(): Promise<string>;
  
  // Show native alert
  showAlert(title: string, message: string): Promise<void>;
  
  // Vibrate device
  vibrate(): Promise<void>;
  
  // Get device info
  getDeviceInfo(): Promise<{
    platform: string;
    osVersion: string;
    model: string;
  }>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('TestModule');

