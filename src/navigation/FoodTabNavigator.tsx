import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/Categoryscreen';
import CartScreen from '../screens/Cartscreen';
import WishlistScreen from '../screens/Wishlistscreen';
import ProfileScreen from '../screens/Profilescreen';
import PopularRestaurantScreen from '../screens/PopularRestaurantScreen';

import TabBar from '../components/TabBar';

const Tab = createBottomTabNavigator();

export default function FoodTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Wishlist" component={WishlistScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />

      {/* ✅ Hidden Screen */}
      <Tab.Screen
        name="PopularRestaurant"
        component={PopularRestaurantScreen}
        options={{
          tabBarButton: () => null, // hides tab button
        }}
      />
    </Tab.Navigator>
  );
}