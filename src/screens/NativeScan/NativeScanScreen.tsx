import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { styles } from './styles';
import NativeScanner, { BleDevice } from '../../../modules/NativeScanner/js/index';

export const NativeScanScreen: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [bluetoothState, setBluetoothState] = useState<string>('unknown');
  const listenersRef = useRef<any[]>([]);

  useEffect(() => {
    // Setup event listeners
    const deviceListener = NativeScanner.onDeviceDiscovered((device: BleDevice) => {
      console.log('[NativeScan] Device discovered:', device.name, device.id);
      setDevices((prev) => {
        const exists = prev.find((d) => d.id === device.id);
        if (exists) {
          return prev.map((d) => (d.id === device.id ? device : d));
        }
        return [...prev, device];
      });
    });

    const stopListener = NativeScanner.onScanStopped(() => {
      console.log('[NativeScan] Scan stopped');
      setIsScanning(false);
    });

    const stateListener = NativeScanner.onBluetoothStateChanged((state: string) => {
      console.log('[NativeScan] Bluetooth state:', state);
      setBluetoothState(state);
    });

    listenersRef.current = [deviceListener, stopListener, stateListener];

    return () => {
      listenersRef.current.forEach((listener) => listener.remove());
    };
  }, []);

  const handleStartScan = async () => {
    try {
      setDevices([]);
      setIsScanning(true);
      await NativeScanner.startScan(10); // 10 second scan
      console.log('[NativeScan] Scan started');
    } catch (error) {
      console.error('[NativeScan] Error starting scan:', error);
      setIsScanning(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await NativeScanner.stopScan();
      setIsScanning(false);
      console.log('[NativeScan] Scan stopped manually');
    } catch (error) {
      console.error('[NativeScan] Error stopping scan:', error);
    }
  };

  const renderDevice = ({ item }: { item: BleDevice }) => (
    <View style={styles.deviceItem}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceId}>ID: {item.id.substring(0, 8)}...</Text>
        <Text style={styles.deviceRssi}>RSSI: {item.rssi} dBm</Text>
      </View>
    </View>
  );

  const sortedDevices = [...devices].sort((a, b) => b.rssi - a.rssi);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Native Scanner</Text>
        <Text style={styles.subtitle}>Pure iOS CoreBluetooth</Text>
        <Text style={styles.stateText}>Bluetooth: {bluetoothState}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanningButton]}
          onPress={isScanning ? handleStopScan : handleStartScan}
        >
          {isScanning ? (
            <View style={styles.scanningContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.buttonText}>Stop Scan</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Start Native Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.devicesList}>
        <Text style={styles.count}>Devices Found: {devices.length}</Text>
        {isScanning && devices.length === 0 ? (
          <View style={styles.scanning}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Scanning with native code...</Text>
          </View>
        ) : (
          <FlatList
            data={sortedDevices}
            keyExtractor={(item) => item.id}
            renderItem={renderDevice}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No devices found</Text>
                <Text style={styles.emptySubtext}>Tap 'Start Native Scan'</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default NativeScanScreen;

