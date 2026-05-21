import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

const SelectAddressScreen: React.FC = () => {
  const [selectedAddress, setSelectedAddress] = useState('home');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Address</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Home Address */}
        <TouchableOpacity
          style={[
            styles.addressCard,
            selectedAddress === 'home' && styles.addressCardSelected,
          ]}
          onPress={() => setSelectedAddress('home')}
        >
          <View style={styles.radioContainer}>
            <View
              style={[
                styles.radio,
                selectedAddress === 'home' && styles.radioSelected,
              ]}
            >
              {selectedAddress === 'home' && (
                <View style={styles.radioDot} />
              )}
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressType}>Home</Text>
              <Text style={styles.personName}>Rohan Kumar</Text>
              <Text style={styles.phone}>+919085986689</Text>
              <Text style={styles.address}>
                12,5th main,HSR Layout, Bangalore,karnataka-56007
              </Text>
            </View>
          </View>
          {selectedAddress === 'home' && (
            <TouchableOpacity style={styles.menuBtn}>
              <Text style={styles.menuIcon}>⋮</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Work Address */}
        <TouchableOpacity
          style={[
            styles.addressCard,
            selectedAddress === 'work' && styles.addressCardSelected,
          ]}
          onPress={() => setSelectedAddress('work')}
        >
          <View style={styles.radioContainer}>
            <View
              style={[
                styles.radio,
                selectedAddress === 'work' && styles.radioSelected,
              ]}
            >
              {selectedAddress === 'work' && (
                <View style={styles.radioDot} />
              )}
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressType}>Work</Text>
              <Text style={styles.personName}>Rohan Kumar</Text>
              <Text style={styles.phone}>+919085986689</Text>
              <Text style={styles.address}>
                12,5th main,HSR Layout, Bangalore,karnataka-56007
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Other Saved Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other saved addresses</Text>
          <TouchableOpacity
            style={styles.addressCard}
            onPress={() => setSelectedAddress('parents')}
          >
            <View style={styles.radioContainer}>
              <View
                style={[
                  styles.radio,
                  selectedAddress === 'parents' && styles.radioSelected,
                ]}
              >
                {selectedAddress === 'parents' && (
                  <View style={styles.radioDot} />
                )}
              </View>
              <View style={styles.addressInfo}>
                <Text style={styles.addressType}>Parents Home</Text>
                <Text style={styles.address}>
                  7th Cross,karmangala 4th Black, Bangalore-569009
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Continue Button */}
      <TouchableOpacity style={styles.continueBtn}>
        <Text style={styles.continueBtnText}>Continue</Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    fontSize: 28,
    color: '#333',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },

  addressCard: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  addressCardSelected: {
    borderColor: '#FFB3D9',
    backgroundColor: '#FFF5F9',
  },

  radioContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioSelected: {
    borderColor: '#FF6B35',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
  },

  addressInfo: {
    flex: 1,
  },
  addressType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  personName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  phone: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  address: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },

  menuBtn: {
    padding: 4,
  },
  menuIcon: {
    fontSize: 20,
    color: '#FF6B35',
  },

  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },

  continueBtn: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  arrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default SelectAddressScreen;