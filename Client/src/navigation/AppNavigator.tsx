import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import FoodTabNavigator from './FoodTabNavigator';
import LoginScreen from '../screens/Loginscreen';
import SearchScreen from '../screens/Searchscreen';
import SuccessScreen from '../screens/Successscreen';
import SignupScreen from '../screens/Signupscreen';
import ReviewOrderScreen from '../screens/Revieworderscreen';
import PaymentMethodScreen from '../screens/Paymentmethodscreen';
import SelectAddressScreen from '../screens/Selectaddressscreen';
const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        {/* Main App Tabs */}
        <Stack.Screen name="MainTabs" component={FoodTabNavigator} />
                <Stack.Screen name="Login"    component={LoginScreen}   />
                <Stack.Screen name="Search" component={SearchScreen} />
                {/* <Stack.Screen name="Success" component={SuccessScreen} /> */}
                {/* <Stack.Screen name="Signup" component={SignupScreen} /> */}
                {/* <Stack.Screen name="ReviewOrder" component={ReviewOrderScreen} /> */}
                {/* <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} /> */}
                {/* <Stack.Screen name="SelectAddress" component={SelectAddressScreen} /> */}



       

      </Stack.Navigator>
    </NavigationContainer>
  );
}