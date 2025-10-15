import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useBleMock } from './hooks/useBleMock';
import { styles } from './styles';
import { DeviceList } from './components/DeviceList';

export const HomeScreen: React.FC = () => {
  const {
    devices,
    isScanning,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
  } = useBleMock();

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
        <Text style={styles.sectionTitle}>Available Devices ({devices.length})</Text>
        <DeviceList
          devices={devices}
          isScanning={isScanning}
          onConnect={connectToDevice}
          onDisconnect={disconnectDevice}
        />
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;


