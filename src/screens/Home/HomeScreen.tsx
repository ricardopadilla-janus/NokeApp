import React, { useState, useMemo } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
// Swap mock for real BLE
import { useBle } from './hooks/useBle';
import { styles } from './styles';
import { DeviceList } from './components/DeviceList';

export const HomeScreen: React.FC = () => {
  const { devices, isScanning, startScan, stopScan, connectToDevice, disconnectDevice } = useBle();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedDevices = useMemo(() => {
    let filtered = devices;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = devices.filter(d => d.name.toLowerCase().includes(query) || d.id.toLowerCase().includes(query));
    }
    // Sort by best signal (highest RSSI first)
    return [...filtered].sort((a, b) => b.rssi - a.rssi);
  }, [devices, searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scanSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search devices..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanningButton]}
          onPress={isScanning ? stopScan : startScan}
        >
          {isScanning ? (
            <View style={styles.scanningContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.scanButtonText}>Stop Scan</Text>
            </View>
          ) : (
            <Text style={styles.scanButtonText}>Start Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.devicesSection}>
        <Text style={styles.sectionTitle}>Available Devices ({devices.length})</Text>
        <DeviceList
          devices={filteredAndSortedDevices}
          isScanning={isScanning}
          onConnect={connectToDevice}
          onDisconnect={disconnectDevice}
        />
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;


