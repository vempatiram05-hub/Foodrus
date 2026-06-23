import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import FoodTabNavigator from './FoodTabNavigator';
import LoginScreen from '../screens/Loginscreen';
import RegisterationScreen from '../screens/RegisterationScreen';
import SearchScreen from '../screens/Searchscreen';
import OTPVerifyScreen from '../screens/OTPVerifyScreen'
import RequestOTPScreen from '../screens/RequestOTPScreen';
import UpdatePasswordScreen from '../screens/UpdatePasswordScreen';
import UpdateProfileScreen from '../screens/UpdateProfileScreen';
const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>

        {/* Main App Tabs */}
        <Stack.Screen name="MainTabs" component={FoodTabNavigator} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Register" component={RegisterationScreen} />
        <Stack.Screen name="VerifyOTP" component={OTPVerifyScreen} />
        <Stack.Screen name="RequestOTP" component={RequestOTPScreen} />
        <Stack.Screen name="UpdatePassword" component={UpdatePasswordScreen} />
        <Stack.Screen name="UpdateProfile" component={UpdateProfileScreen} />
        {/* <Stack.Screen name="Success" component={SuccessScreen} /> */}
        {/* <Stack.Screen name="Signup" component={SignupScreen} /> */}
        {/* <Stack.Screen name="ReviewOrder" component={ReviewOrderScreen} /> */}
        {/* <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} /> */}
        {/* <Stack.Screen name="SelectAddress" component={SelectAddressScreen} /> */}





      </Stack.Navigator>
    </NavigationContainer>
  );
}