import { useState } from 'react';
import { Alert } from 'react-native';

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  isConnecting: boolean;
}

const MOCK_DEVICES: BLEDevice[] = [
  { id: '1', name: 'Noke Smart Lock 001', rssi: -45, isConnected: false, isConnecting: false },
  { id: '2', name: 'Noke Smart Lock 002', rssi: -62, isConnected: false, isConnecting: false },
  { id: '3', name: 'Noke Smart Lock 003', rssi: -78, isConnected: false, isConnecting: false },
  { id: '4', name: 'Noke Smart Lock 004', rssi: -55, isConnected: false, isConnecting: false },
  { id: '5', name: 'Noke Smart Lock 005', rssi: -68, isConnected: false, isConnecting: false },
];

export function useBleMock() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);

  const startScan = () => {
    setIsScanning(true);
    setDevices([]);
    setTimeout(() => {
      setDevices(MOCK_DEVICES);
      setIsScanning(false);
    }, 2000);
  };

  const stopScan = () => {
    setIsScanning(false);
  };

  const connectToDevice = (deviceId: string) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, isConnecting: true } : d));
    setTimeout(() => {
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, isConnected: true, isConnecting: false } : d));
      Alert.alert('Success', 'Connected to device successfully!');
    }, 1500);
  };

  const disconnectDevice = (deviceId: string) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, isConnected: false, isConnecting: false } : d));
    Alert.alert('Disconnected', 'Device disconnected successfully!');
  };

  return {
    devices,
    isScanning,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
  };
}


