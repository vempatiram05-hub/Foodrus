import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

/* ---------- Navigation Types ---------- */

type RootStackParamList = {
  About: undefined;
};

type AboutScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'About'>;
};

/* ---------- Menu Type ---------- */

type MenuItem = {
  icon: string;
  label: string;
};

/* ---------- Component ---------- */

const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
  const menuItems: MenuItem[] = [
    { icon: '☰', label: 'Terms & Conditions' },
    { icon: '🛡', label: 'Privacy policy' },
    { icon: '✉️', label: 'Contact Us' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>← </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* App Info Card */}
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🍽️</Text>
          </View>

          <Text style={styles.appName}>Ruchi Express</Text>

          <Text style={styles.appDesc}>
            Delicious food&groceries delivered fast to your doorstep
          </Text>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>V 1.0.0</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company</Text>
            <Text style={styles.infoValue}>Ruchi Express pvt Ltd</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder,
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Food Images */}
        <View style={styles.imagesRow}>
          <View style={[styles.foodImage, { backgroundColor: '#c8a87a' }]}>
            <Text style={styles.foodEmoji}>🍛</Text>
          </View>

          <View style={[styles.foodImage, { backgroundColor: '#e8c97a' }]}>
            <Text style={styles.foodEmoji}>🍮</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          © 2026 Ruchi Express. All rights reserved.
        </Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },

  backArrow: { fontSize: 20, color: '#FF6B35', fontWeight: '700' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff0eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  iconEmoji: { fontSize: 32 },
  appName: { fontSize: 22, fontWeight: '800', color: '#FF6B35', marginBottom: 6 },

  appDesc: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },

  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 14,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },

  infoLabel: { fontSize: 14, fontWeight: '600', color: '#222' },
  infoValue: { fontSize: 14, color: '#444' },

  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },

  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { fontSize: 18, marginRight: 14, width: 24, textAlign: 'center' },
  menuLabel: { fontSize: 15, color: '#222', fontWeight: '500' },
  menuArrow: { fontSize: 22, color: '#999' },

  imagesRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },

  foodImage: {
    flex: 1,
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  foodEmoji: { fontSize: 40 },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 20,
  },
});

export default AboutScreen;