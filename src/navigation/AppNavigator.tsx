import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import FoodTabNavigator from './FoodTabNavigator';
import LoginScreen from '../screens/Loginscreen';
import SearchScreen from '../screens/Searchscreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        {/* Main App Tabs */}
        <Stack.Screen name="MainTabs" component={FoodTabNavigator} />
                <Stack.Screen name="Login"    component={LoginScreen}   />
                <Stack.Screen name="Search" component={SearchScreen} />



       

      </Stack.Navigator>
    </NavigationContainer>
  );
}