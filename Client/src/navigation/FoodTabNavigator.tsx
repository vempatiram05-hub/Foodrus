import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/Categoryscreen';
import CartScreen from '../screens/Cartscreen';
import WishlistScreen from '../screens/Wishlistscreen';
import ProfileScreen from '../screens/Profilescreen';
import PopularRestaurantScreen from '../screens/PopularRestaurantScreen';
import AboutScreen from '../screens/AboutScreen';
import CakeScreen from '../screens/CakeScreen';
import BiryaniScreen from '../screens/BiryaniScreen';
import BurgerScreen from '../screens/BurgerScreen';
import PongalScreen from '../screens/PongalScreen';
import ShakesScreen from '../screens/Shakesscreen';

import TabBar from '../components/TabBar';
import OmeletteScreen from '../screens/Omelettescreen';
import ChineseScreen from '../screens/Chinesescreen';
import ShopGroceries from '../screens/Shopgroceries';

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
      <Tab.Screen name="About" component={AboutScreen} />
      <Tab.Screen name="Cake" component={CakeScreen} />
      <Tab.Screen name="Biryani" component={BiryaniScreen} />
      <Tab.Screen name="Burger" component={BurgerScreen} />
      <Tab.Screen name="Pongal" component={PongalScreen} />
      <Tab.Screen name="Omelette" component={OmeletteScreen} />
      <Tab.Screen name="Shakes" component={ShakesScreen} />
      <Tab.Screen name="Chinese" component={ChineseScreen} />
      <Tab.Screen name="Groceries" component={ShopGroceries} />

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