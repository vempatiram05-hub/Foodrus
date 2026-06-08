import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
});

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <AppNavigator />
    </SafeAreaView>
  );
}