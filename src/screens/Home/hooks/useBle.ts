import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import BleManager, { BleDisconnectPeripheralEvent, BleScanCallbackType, Peripheral } from 'react-native-ble-manager';
import { NativeEventEmitter, NativeModules } from 'react-native';

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  isConnecting: boolean;
}

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export function useBle() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const connectedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    BleManager.start({ showAlert: false });
    const stopSub = bleManagerEmitter.addListener('BleManagerStopScan', () => setIsScanning(false));
    const discSub = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', (event: BleDisconnectPeripheralEvent) => {
      connectedRef.current.delete(event.peripheral);
      setDevices(prev => prev.map(d => d.id === event.peripheral ? { ...d, isConnected: false, isConnecting: false } : d));
    });
    return () => {
      stopSub.remove();
      discSub.remove();
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 31) {
      const scan = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
      const connect = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return scan === 'granted' && connect === 'granted' && fine === 'granted';
    } else {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return fine === 'granted';
    }
  }, []);

  const startScan = useCallback(async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert('Permission required', 'Bluetooth permissions are needed to scan devices.');
      return;
    }
    if (isScanning) return;
    setDevices([]);
    setIsScanning(true);
    try {
      await BleManager.scan([], 5, true, { numberOfMatches: 1, matchMode: 1, scanMode: 2 } as any);
      const discoverSub = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', (peripheral: Peripheral) => {
        if (!peripheral?.id) return;
        setDevices(prev => {
          const exists = prev.find(d => d.id === peripheral.id);
          const name = peripheral.name || peripheral.advertising?.localName || 'Unknown';
          const updated: BLEDevice = {
            id: peripheral.id,
            name,
            rssi: peripheral.rssi ?? -100,
            isConnected: connectedRef.current.has(peripheral.id),
            isConnecting: false,
          };
          return exists ? prev.map(d => (d.id === updated.id ? { ...d, ...updated } : d)) : [...prev, updated];
        });
      });
      // Auto cleanup of discovery listener when scan stops
      const stopOnce = bleManagerEmitter.addListener('BleManagerStopScan', () => {
        discoverSub.remove();
        stopOnce.remove();
      });
    } catch (e) {
      setIsScanning(false);
      Alert.alert('Scan error', String(e));
    }
  }, [isScanning, requestPermissions]);

  const stopScan = useCallback(async () => {
    try { await BleManager.stopScan(); } catch {}
    setIsScanning(false);
  }, []);

  const connectToDevice = useCallback(async (id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isConnecting: true } : d));
    try {
      await BleManager.connect(id);
      connectedRef.current.add(id);
      setDevices(prev => prev.map(d => d.id === id ? { ...d, isConnected: true, isConnecting: false } : d));
    } catch (e) {
      setDevices(prev => prev.map(d => d.id === id ? { ...d, isConnecting: false } : d));
      Alert.alert('Connection error', String(e));
    }
  }, []);

  const disconnectDevice = useCallback(async (id: string) => {
    try { await BleManager.disconnect(id); } catch {}
    connectedRef.current.delete(id);
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isConnected: false, isConnecting: false } : d));
  }, []);

  return { devices, isScanning, startScan, stopScan, connectToDevice, disconnectDevice };
}


