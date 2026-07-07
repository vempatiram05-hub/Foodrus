import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../context/AuthContext';

const ORANGE = '#FC8019';

const TABS = [
  {
    name: 'Home',
    label: 'Home',
    active: 'home',
    inactive: 'home-outline',
  },
  // {
  //   name: 'Categories',
  //   label: 'Categories',
  //   active: 'view-grid',
  //   inactive: 'view-grid-outline',
  // },
  {
    name: 'Cart',
    label: 'Cart',
    active: 'cart',
    inactive: 'cart-outline',
  },
  {
    name: 'Wishlist',
    label: 'Wishlist',
    active: 'heart',
    inactive: 'heart-outline',
  },
  {
    name: 'Profile',
    label: 'Profile',
    active: 'account',
    inactive: 'account-outline',
  },
];

export default function TabBar({ state, navigation }: any) {
  const { token } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const focused = state.routes[state.index].name === tab.name;
        const isAuthTab = tab.name === 'Profile';
        const label = isAuthTab && !token ? 'Login' : tab.label;
        const targetRoute = isAuthTab && !token ? 'Login' : tab.name;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(targetRoute)}
          >
            <MaterialCommunityIcons
              name={focused ? tab.active : tab.inactive}
              size={26}
              color={focused ? ORANGE : '#777'}
            />

            <Text
              style={[
                styles.label,
                { color: focused ? ORANGE : '#777' },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});