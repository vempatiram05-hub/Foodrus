import React, { useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ListRenderItemInfo,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../config/apiConfig';

// Colors
const ORANGE = '#F97316';    // buttons / links / accents
const WHITE = '#FFFFFF';     // screen background
const BLACK = '#000000';     // all text
const GRAY_BG = '#F5F5F5';   // section label background
const GRAY_TEXT = '#6B6B6B'; // secondary/address text
const BORDER = '#E5E5E5';    // divider lines

type AddressType = 'Home' | 'Work' | 'Other' | string;

interface AddressItem {
  id: string;
  type: AddressType;
  icon: string;
  address: string;
  phone?: string;
  isDefault: boolean;
}

interface SavedAddressesScreenProps {
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string, params?: Record<string, unknown>) => void;
  };
}

// Decode a JWT payload
function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') {
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
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

export default function SavedAddressesScreen({
  navigation,
}: SavedAddressesScreenProps) {
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useContext(AuthContext);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const payload: any = parseJwt(token);
      if (!payload || !payload.id) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${BASE_URL}/addresses/getAddressesByUserId/${payload.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      const json = await response.json();
      if (json.success && json.data) {
        const mappedAddresses: AddressItem[] = json.data.map((addr: any) => {
          const type = addr.label || 'Other';
          let icon = '➤';
          if (type.toLowerCase() === 'home') icon = '⌂';
          else if (type.toLowerCase() === 'work') icon = '▭';

          const addressParts = [
            addr.line1,
            addr.line2,
            addr.city,
            addr.state_name,
            addr.country_name,
            addr.postal_code,
          ].filter(Boolean);

          return {
            id: addr.id,
            type: type,
            icon: icon,
            address: addressParts.join(', '),
            phone: payload.phone, // fallback to user's phone
            isDefault: !!addr.is_default,
          };
        });
        setAddresses(mappedAddresses);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [token])
  );

  const handleBack = (): void => {
    navigation?.goBack?.();
  };

  const handleAddAddress = (): void => {
    navigation?.navigate?.('CreateAddressScreen');
  };

  const handleEdit = (id: string): void => {
    navigation?.navigate?.('CreateAddressScreen', { id });
  };

  const handleToggleDefault = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${BASE_URL}/addresses/updateAddress/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_default: !currentStatus
        })
      });
      const json = await response.json();
      if (json.success) {
        fetchAddresses();
      } else {
        console.error('Failed to update default address:', json.message);
      }
    } catch (error) {
      console.error('Error updating default address:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/addresses/deleteAddress/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      const json = await response.json();
      if (json.success) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      } else {
        console.error('Failed to delete address:', json.message);
      }
    } catch (error) {
      console.error('Error deleting address:', error);
    }
  };

  const renderAddress = ({ item, index }: ListRenderItemInfo<AddressItem>) => (
    <View
      style={[
        styles.addressRow,
        index !== addresses.length - 1 && styles.addressRowBorder,
      ]}
    >
      <View style={styles.rowContent}>
        <View style={styles.titleRow}>
          <Text style={styles.rowTitle}>{item.type}</Text>
          {item.isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
        </View>
        <Text style={styles.rowAddress}>{item.address}</Text>
        {item.phone ? <Text style={styles.rowPhone}>Phone number: {item.phone}</Text> : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={() => handleEdit(item.id)}>
            <Text style={styles.actionText}>EDIT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={styles.actionText}>DELETE</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleToggleDefault(item.id, !!item.isDefault)}>
            <Text style={[styles.actionText, styles.defaultActionText]}>
              {item.isDefault ? 'REMOVE DEFAULT' : 'SET AS DEFAULT'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No saved addresses</Text>
        <Text style={styles.emptySubtitle}>
          Add an address to get started with faster checkout
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ADDRESSES</Text>
      </View>
      <View style={styles.headerDivider} />

      {/* Section Label */}
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
      </View>

      {/* Address List */}
      <FlatList<AddressItem>
        data={addresses}
        keyExtractor={(item) => item.id}
        renderItem={renderAddress}
        contentContainerStyle={
          addresses.length === 0 ? styles.listEmptyContainer : styles.listContainer
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Address Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.85}
          onPress={handleAddAddress}
        >
          <Text style={styles.addButtonText}>ADD NEW ADDRESS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    padding: 8,
  },
  backArrow: {
    fontSize: 22,
    color: BLACK,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: BLACK,
    marginLeft: 6,
  },
  headerDivider: {
    height: 1,
    backgroundColor: BORDER,
  },
  sectionLabelWrap: {
    backgroundColor: GRAY_BG,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: BLACK,
  },
  listContainer: {
    paddingBottom: 12,
  },
  listEmptyContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  addressRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  addressRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowIcon: {
    fontSize: 22,
    color: BLACK,
    width: 32,
    marginTop: 2,
  },
  rowContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BLACK,
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
  rowAddress: {
    fontSize: 14,
    color: GRAY_TEXT,
    lineHeight: 20,
    marginBottom: 8,
  },
  rowPhone: {
    fontSize: 14,
    color: GRAY_TEXT,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: ORANGE,
    marginRight: 24,
  },
  defaultActionText: {
    color: '#4B5563',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: GRAY_TEXT,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  addButton: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: WHITE,
  },
});