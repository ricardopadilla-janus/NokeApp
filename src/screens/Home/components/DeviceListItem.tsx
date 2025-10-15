import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BLEDevice } from '../hooks/useBleMock';
import { styles, getSignalStrength } from '../styles';

interface Props {
  device: BLEDevice;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export const DeviceListItem: React.FC<Props> = ({ device, onConnect, onDisconnect }) => {
  const signal = getSignalStrength(device.rssi);

  return (
    <View style={styles.deviceItem}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <View style={styles.deviceDetails}>
          <Text style={styles.deviceRSSI}>RSSI: {device.rssi} dBm</Text>
          <View style={[styles.signalIndicator, { backgroundColor: signal.color }]}>
            <Text style={styles.signalText}>{signal.text}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.connectButton, device.isConnected ? styles.disconnectButton : styles.connectButton]}
        onPress={() => (device.isConnected ? onDisconnect(device.id) : onConnect(device.id))}
        disabled={device.isConnecting}
      >
        {device.isConnecting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{device.isConnected ? 'Disconnect' : 'Connect'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};


