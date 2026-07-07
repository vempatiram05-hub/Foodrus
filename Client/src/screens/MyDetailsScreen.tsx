import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  StatusBar,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../config/apiConfig';

const ORANGE = '#F97316';

// Decode a JWT payload
function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
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
    if (typeof global !== 'undefined' && (global as any).Buffer) {
      const jsonPayload = (global as any).Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    }
    return null;
  } catch (e) {
    return null;
  }
}

const DetailRow = ({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) => (
  <View style={[styles.detailRow, isLast && styles.noBorder]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="tail">
      {value || 'N/A'}
    </Text>
  </View>
);

export default function MyDetailsScreen() {
  const navigation = useNavigation<any>();
  const { token } = useContext(AuthContext);

  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  useEffect(() => {
    if (!token) return;

    const payload: any = parseJwt(token) || {};
    setUserId(payload.id ?? '');
    setFullName(payload.full_name ?? payload.fullName ?? '');
    setEmail(payload.email ?? '');
    setPhone(payload.phone ?? '');

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

  useEffect(() => {
    if (!userId || !token) return;

    const fetchAddresses = async () => {
      try {
        setLoadingAddresses(true);
        const response = await fetch(`${BASE_URL}/addresses/getAddressesByUserId/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const json = await response.json();
        if (json.success && json.data) {
          setAddresses(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch addresses in MyDetailsScreen", err);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, [userId, token]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Details</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            activeOpacity={0.9}
            onPress={() => {
              if (profileImage) {
                setImageModalVisible(true);
              }
            }}
          >
            {profileImage ? (
              <Image
                source={{
                  uri: profileImage.startsWith('http')
                    ? profileImage
                    : `${BASE_URL.replace('/api', '')}${profileImage}`,
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {fullName ? fullName.substring(0, 2).toUpperCase() : 'ME'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.profileName}>{fullName || 'N/A'}</Text>
        </View>

        {/* Full Screen Image Preview Modal */}
        <Modal
          visible={imageModalVisible}
          transparent={true}
          onRequestClose={() => setImageModalVisible(false)}
          animationType="fade"
        >
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setImageModalVisible(false)}
          >
            <TouchableOpacity style={styles.closeButton} onPress={() => setImageModalVisible(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            {profileImage ? (
              <Image
                source={{
                  uri: profileImage.startsWith('http')
                    ? profileImage
                    : `${BASE_URL.replace('/api', '')}${profileImage}`,
                }}
                style={styles.largeImage}
                resizeMode="contain"
                resizeMethod="scale"
              />
            ) : null}
          </TouchableOpacity>
        </Modal>

        {/* Details Card */}
        <View style={styles.card}>
          <DetailRow label="Full Name" value={fullName} />
          <DetailRow label="Email Address" value={email} />
          <DetailRow label="Phone Number" value={phone} />
        </View>

        {/* Saved Addresses Section */}
        <Text style={styles.sectionHeader}>Saved Addresses</Text>
        
        {loadingAddresses ? (
          <ActivityIndicator size="small" color={ORANGE} style={{ marginVertical: 20 }} />
        ) : addresses.length > 0 ? (
          <View style={styles.card}>
            {addresses.map((addr, index) => {
              const addressParts = [
                addr.line1,
                addr.line2,
                addr.city,
                addr.state_name,
                addr.country_name,
                addr.postal_code,
              ].filter(Boolean);
              
              const isLast = index === addresses.length - 1;

              return (
                <View key={addr.id} style={[styles.addressItem, isLast && styles.noBorder]}>
                  <View style={styles.addressLabelRow}>
                    <Text style={styles.addressLabelIcon}>📍</Text>
                    <Text style={styles.addressLabel}>{addr.label || 'Other'}</Text>
                    {addr.is_default ? <Text style={styles.defaultBadge}>Default</Text> : null}
                  </View>
                  <Text style={styles.addressText}>{addressParts.join(', ')}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>No saved addresses found</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 8,
  },
  backArrow: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  backButtonPlaceholder: {
    width: 38,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FEF3E7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginTop: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
    maxWidth: '65%',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
    marginTop: 8,
  },
  addressItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressLabelIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  defaultBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: ORANGE,
    backgroundColor: '#FEF3E7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    overflow: 'hidden',
  },
  addressText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    paddingLeft: 20,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  largeImage: {
    width: '100%',
    height: '100%',
  },
});
