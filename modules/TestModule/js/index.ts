import { NativeModules, Platform } from 'react-native';
import NativeTestModule from './NativeTestModule';

const LINKING_ERROR =
  `The package 'test-module' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const TestModuleNative = isTurboModuleEnabled
  ? NativeTestModule
  : NativeModules.TestModule;

if (!TestModuleNative) {
  throw new Error(LINKING_ERROR);
}

export interface DeviceInfo {
  platform: string;
  osVersion: string;
  model: string;
}

class TestModule {
  /**
   * Get a string from native code
   */
  async getNativeString(): Promise<string> {
    return TestModuleNative.getNativeString();
  }

  /**
   * Show a native alert dialog
   */
  async showAlert(title: string, message: string): Promise<void> {
    return TestModuleNative.showAlert(title, message);
  }

  /**
   * Vibrate the device
   */
  async vibrate(): Promise<void> {
    return TestModuleNative.vibrate();
  }

  /**
   * Get device information from native
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    return TestModuleNative.getDeviceInfo();
  }
}

export default new TestModule();

