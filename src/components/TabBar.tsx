import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const ORANGE = '#FC8019';

const TABS = [
  {
    name: 'Home',
    label: 'Home',
    active: 'home',
    inactive: 'home-outline',
  },
  {
    name: 'Categories',
    label: 'Categories',
    active: 'view-grid',
    inactive: 'view-grid-outline',
  },
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

 export default function TabBar({ state, navigation }: { state: { index: number }; navigation: { navigate: (routeName: string) => void } }) {
  return (
    <View style={styles.container}>
      {TABS.map((tab, index) => {
        const focused = state.index === index;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.name)}
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
              {tab.label}
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