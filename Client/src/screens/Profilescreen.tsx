import React from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';

const MenuRow = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress}>
    <Text style={styles.menuIcon}>{icon}</Text>
    <Text style={styles.menuLabel}>{label}</Text>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

const SectionTitle = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

export default function ProfileScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>My Profile</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>JN</Text>
            </View>
            <View style={styles.cameraIcon}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Jeevithram N K</Text>
            <Text style={styles.profileEmail}>jeevithramm@gmail.com</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Profile ✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Orders Section */}
        <SectionTitle title="Orders" />
        <MenuRow icon="🛍️" label="Orders" />
        <MenuRow icon="♡" label="My Wishlist" />

        {/* Account Section */}
        <SectionTitle title="Account" />
        <MenuRow icon="👤" label="My Details" />
        <MenuRow icon="📍" label="Delivery Address" />
        <MenuRow icon="💳" label="Payment Methods" />
        <MenuRow icon="🏷️" label="Promo Cord" />

        {/* Preferences Section */}
        <SectionTitle title="Preferences" />
        <MenuRow icon="🔔" label="Notifecations" />
        <MenuRow icon="⚙️" label="Settings" />

        {/* Support Section */}
        <SectionTitle title="Support" />
        <MenuRow icon="❓" label="Help" />
        <MenuRow
          icon="ℹ️"
          label="About"
          onPress={() => navigation.navigate('About' as never)}
        />
        {/* Log Out */}
        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutIcon}>↪</Text>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const ORANGE = '#F97316';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111', marginTop: 16, marginBottom: 12 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  avatarWrapper: { position: 'relative', width: 56, height: 56 },
  avatarPlaceholder: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#d1d5db',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  cameraIcon: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#fff', borderRadius: 10, padding: 2,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: '#111' },
  profileEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  editButton: {
    borderWidth: 1.5, borderColor: ORANGE,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  editButtonText: { color: ORANGE, fontSize: 12, fontWeight: '600' },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginTop: 8, marginBottom: 4 },

  // Menu row
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  menuIcon: { fontSize: 18, width: 32 },
  menuLabel: { flex: 1, fontSize: 15, color: '#374151' },
  chevron: { fontSize: 20, color: '#9ca3af' },

  // Logout
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF3E7',
    borderRadius: 12,
    paddingVertical: 18,
    marginTop: 24,
    gap: 10,
  },
  logoutIcon: { fontSize: 20, color: ORANGE },
  logoutText: { fontSize: 17, fontWeight: '600', color: ORANGE },


});