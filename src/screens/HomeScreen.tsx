import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  isConnecting: boolean;
}

const HomeScreen: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  // Mock devices data
  const mockDevices: BLEDevice[] = [
    { id: '1', name: 'Noke Smart Lock 001', rssi: -45, isConnected: false, isConnecting: false },
    { id: '2', name: 'Noke Smart Lock 002', rssi: -62, isConnected: false, isConnecting: false },
    { id: '3', name: 'Noke Smart Lock 003', rssi: -78, isConnected: false, isConnecting: false },
    { id: '4', name: 'Noke Smart Lock 004', rssi: -55, isConnected: false, isConnecting: false },
    { id: '5', name: 'Noke Smart Lock 005', rssi: -68, isConnected: false, isConnecting: false },
  ];

  const startScan = () => {
    setIsScanning(true);
    setDevices([]);
    
    // Simulate scanning process
    setTimeout(() => {
      setDevices(mockDevices);
      setIsScanning(false);
    }, 2000);
  };

  const stopScan = () => {
    setIsScanning(false);
  };

  const connectToDevice = (deviceId: string) => {
    setDevices(prevDevices => 
      prevDevices.map(device => 
        device.id === deviceId 
          ? { ...device, isConnecting: true }
          : device
      )
    );

    // Simulate connection process
    setTimeout(() => {
      setDevices(prevDevices => 
        prevDevices.map(device => 
          device.id === deviceId 
            ? { ...device, isConnected: true, isConnecting: false }
            : device
        )
      );
      setConnectedDevice(deviceId);
      Alert.alert('Success', 'Connected to device successfully!');
    }, 1500);
  };

  const disconnectDevice = (deviceId: string) => {
    setDevices(prevDevices => 
      prevDevices.map(device => 
        device.id === deviceId 
          ? { ...device, isConnected: false, isConnecting: false }
          : device
      )
    );
    setConnectedDevice(null);
    Alert.alert('Disconnected', 'Device disconnected successfully!');
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi > -50) return { text: 'Excellent', color: '#4CAF50' };
    if (rssi > -70) return { text: 'Good', color: '#8BC34A' };
    if (rssi > -85) return { text: 'Fair', color: '#FF9800' };
    return { text: 'Weak', color: '#F44336' };
  };

  const renderDevice = ({ item }: { item: BLEDevice }) => {
    const signal = getSignalStrength(item.rssi);
    
    return (
      <View style={styles.deviceItem}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name}</Text>
          <View style={styles.deviceDetails}>
            <Text style={styles.deviceRSSI}>RSSI: {item.rssi} dBm</Text>
            <View style={[styles.signalIndicator, { backgroundColor: signal.color }]}>
              <Text style={styles.signalText}>{signal.text}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.connectButton,
            item.isConnected ? styles.disconnectButton : styles.connectButton
          ]}
          onPress={() => item.isConnected ? disconnectDevice(item.id) : connectToDevice(item.id)}
          disabled={item.isConnecting}
        >
          {item.isConnecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {item.isConnected ? 'Disconnect' : 'Connect'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Noke Smart Locks</Text>
        <Text style={styles.subtitle}>Scan and connect to your devices</Text>
      </View>

      <View style={styles.scanSection}>
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanningButton]}
          onPress={isScanning ? stopScan : startScan}
        >
          {isScanning ? (
            <View style={styles.scanningContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.scanButtonText}>Scanning...</Text>
            </View>
          ) : (
            <Text style={styles.scanButtonText}>
              {devices.length > 0 ? 'Scan Again' : 'Start Scan'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.devicesSection}>
        <Text style={styles.sectionTitle}>
          Available Devices ({devices.length})
        </Text>
        {isScanning ? (
          <View style={styles.scanningPlaceholder}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Scanning for devices...</Text>
          </View>
        ) : devices.length > 0 ? (
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            style={styles.devicesList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No devices found</Text>
            <Text style={styles.emptySubtext}>Tap "Start Scan" to search for devices</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  scanSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningButton: {
    backgroundColor: '#FF6B6B',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devicesSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  devicesList: {
    flex: 1,
  },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  deviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceRSSI: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  signalIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  signalText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    minWidth: 80,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scanningPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanningText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});

export default HomeScreen;
