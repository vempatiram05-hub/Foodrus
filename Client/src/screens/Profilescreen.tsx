import React, { useContext, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../config/apiConfig';

// Decode a JWT payload (lightweight, no external deps)
function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // prefer atob if available
    if (typeof atob === 'function') {
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(jsonPayload);
    }

    // fallback to Buffer (packagers often polyfill Buffer)
    if (typeof global !== 'undefined' && (global as any).Buffer) {
      const jsonPayload = (global as any).Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    }

    return null;
  } catch (e) {
    return null;
  }
}

const MenuRow = ({ icon, label, onPress }: any) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress}>
    <Text style={styles.menuIcon}>{icon}</Text>
    <Text style={styles.menuLabel}>{label}</Text>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

const SectionTitle = ({ title }: any) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { setToken } = useContext(AuthContext);
  const { token } = useContext(AuthContext);

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            // clear token from context
            setToken(null);
            // navigate to home screen
            navigation.navigate('Home' as never);
          },
        },
      ],
      { cancelable: true }
    );
  };

  useEffect(() => {
    if (!token) {
      setProfileName('');
      setProfileEmail('');
      setProfileImage(null);
      return;
    }

    const payload: any = parseJwt(token) || {};
    // server uses `full_name` and `email` in token payload
    setProfileName(payload.full_name ?? payload.fullName ?? '');
    setProfileEmail(payload.email ?? '');
    let userImages: any[] = [];
    if (Array.isArray(payload.images)) {
      userImages = payload.images;
    } else if (typeof payload.images === 'string') {
      try {
        userImages = JSON.parse(payload.images);
      } catch (e) {
        userImages = [];
      }
    }
    setProfileImage(userImages.length > 0 ? userImages[0] : null);
  }, [token]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>My Profile</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {profileImage ? (
              <Image
                source={{
                  uri: profileImage.startsWith('http')
                    ? profileImage
                    : `${BASE_URL.replace('/api', '')}${profileImage}`,
                }}
                style={styles.avatarPlaceholder}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {profileName ? profileName.substring(0, 2).toUpperCase() : 'ME'}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileName || 'My Name'}</Text>
            <Text style={styles.profileEmail}>{profileEmail || ''}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('UpdateProfile' as never)}>
            <Text style={styles.editButtonText}>Update</Text>
          </TouchableOpacity>
        </View>

        {/* Orders Section */}
        <SectionTitle title="Orders" />
        <MenuRow icon="🛍️" label="Orders" />
        <MenuRow icon="♡" label="My Wishlist" />

        {/* Account Section */}
        <SectionTitle title="Account" />
        <MenuRow icon="👤" label="My Details" />
        <MenuRow icon="🔒" label="Change Password" onPress={() => navigation.navigate('UpdatePassword' as never)} />
        <MenuRow icon="📍" label="Delivery Address" onPress={() => navigation.navigate('SavedAddressesScreen' as never)} />
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
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
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
  profileEmail: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  editButton: {
    backgroundColor: '#FEF3E7',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
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
    paddingVertical: 12,
    marginTop: 24,
    gap: 10,
  },
  logoutIcon: { fontSize: 20, color: ORANGE },
  logoutText: { fontSize: 17, fontWeight: '600', color: ORANGE },


});