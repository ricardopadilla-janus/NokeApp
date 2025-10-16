import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import BleManager, { Peripheral } from 'react-native-ble-manager';

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  isConnecting: boolean;
}

// Using BleManager's event helpers (RN 0.76+)

export function useBle() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const connectedRef = useRef<Set<string>>(new Set());
  const wantContinuousScanRef = useRef<boolean>(false);
  const hasClearedForSessionRef = useRef<boolean>(false);

  useEffect(() => {
    BleManager.start({ showAlert: false }).then(() => {
      console.log("Module BLEManager initialized");
    });
    const stopSub = BleManager.onStopScan(() => {
      if (wantContinuousScanRef.current) {
        // Seamlessly restart scanning without flipping isScanning
        BleManager.scan([], 8, true).catch(() => {
          // If restart fails, reflect stopped state
          setIsScanning(false);
        });
      } else {
        setIsScanning(false);
      }
    });
    const discSub = BleManager.onDisconnectPeripheral(({ peripheral }: any) => {
      if (!peripheral) return;
      connectedRef.current.delete(peripheral);
      setDevices(prev => prev.map(d => d.id === peripheral ? { ...d, isConnected: false, isConnecting: false } : d));
    });
    const discoverSub = BleManager.onDiscoverPeripheral((peripheral: Peripheral | any) => {
      const id = peripheral?.id;
      if (!id) return;
      setDevices(prev => {
        const exists = prev.find(d => d.id === id);
        const name = peripheral?.name || peripheral?.advertising?.localName || 'Unknown';
        const updated: BLEDevice = {
          id,
          name,
          rssi: peripheral?.rssi ?? -100,
          isConnected: connectedRef.current.has(id),
          isConnecting: false,
        };
        return exists ? prev.map(d => (d.id === id ? { ...d, ...updated } : d)) : [...prev, updated];
      });
    });
    return () => {
      stopSub.remove();
      discSub.remove();
      discoverSub.remove();
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
    wantContinuousScanRef.current = true;
    if (!hasClearedForSessionRef.current) {
      setDevices([]);
      hasClearedForSessionRef.current = true;
    }
    if (isScanning) return; // already scanning
    setIsScanning(true);
    try {
      console.log("Starting scan");
      await BleManager.scan([], 8, true);
    } catch (e) {
      setIsScanning(false);
      Alert.alert('Scan error', String(e));
    }
  }, [isScanning, requestPermissions]);

  const stopScan = useCallback(async () => {
    wantContinuousScanRef.current = false;
    hasClearedForSessionRef.current = false;
    try { await BleManager.stopScan().then(() => { console.log("Scan stopped"); }); } catch {}
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


