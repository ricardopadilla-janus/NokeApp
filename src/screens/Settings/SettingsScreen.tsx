import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { styles } from './styles';

export const SettingsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configure your app preferences</Text>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;


