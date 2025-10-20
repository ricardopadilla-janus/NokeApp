import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { styles } from './styles';
import TestModule from '../../../modules/TestModule/js/index';

export const SettingsScreen: React.FC = () => {
  const [nativeString, setNativeString] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<string>('');

  const testGetString = async () => {
    try {
      const result = await TestModule.getNativeString();
      setNativeString(result);
      Alert.alert('Success', `Got: ${result}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const testNativeAlert = async () => {
    try {
      const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';
      await TestModule.showAlert('Native Alert', `This alert comes from native ${platformName} code! 🎉`);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const testVibrate = async () => {
    try {
      await TestModule.vibrate();
      Alert.alert('Success', 'Device vibrated!');
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const testDeviceInfo = async () => {
    try {
      const info = await TestModule.getDeviceInfo();
      const infoStr = `Platform: ${info.platform}\nOS: ${info.osVersion}\nModel: ${info.model}`;
      setDeviceInfo(infoStr);
      Alert.alert('Device Info', infoStr);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Native Module Test</Text>
        <Text style={styles.subtitle}>Test Turbo Module Integration</Text>

        <View style={styles.testSection}>
          <TouchableOpacity style={styles.testButton} onPress={testGetString}>
            <Text style={styles.buttonText}>Get Native String</Text>
          </TouchableOpacity>
          {nativeString ? <Text style={styles.resultText}>{nativeString}</Text> : null}

          <TouchableOpacity style={styles.testButton} onPress={testNativeAlert}>
            <Text style={styles.buttonText}>Show Native Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testVibrate}>
            <Text style={styles.buttonText}>Vibrate Device</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testDeviceInfo}>
            <Text style={styles.buttonText}>Get Device Info</Text>
          </TouchableOpacity>
          {deviceInfo ? <Text style={styles.resultText}>{deviceInfo}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;


