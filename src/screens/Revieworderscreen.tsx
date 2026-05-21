import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

const ReviewOrderScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Deliver To */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Deliver to</Text>
            <TouchableOpacity>
              <Text style={styles.changeText}>change</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>Home (Default)</Text>
            <Text style={styles.addressPhone}>+919085986689</Text>
            <Text style={styles.address}>
              12,5th main,HSR Layout, Bangalore,karnataka-56007
            </Text>
          </View>
        </View>

        {/* Delivery Time */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Time</Text>
            <TouchableOpacity>
              <Text style={styles.changeText}>change</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.deliveryTime}>Delivery Now (20-30 mins)</Text>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <TouchableOpacity>
              <Text style={styles.changeText}>change</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.paymentMethod}>UPI</Text>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items (4)</Text>
          <View style={styles.itemsContainer}>
            <View style={styles.itemBox}>
              <Text style={styles.itemEmoji}>🥛</Text>
            </View>
            <View style={styles.itemBox}>
              <Text style={styles.itemEmoji}>🍛</Text>
            </View>
            <View style={styles.itemBox}>
              <Text style={styles.itemEmoji}>🍊</Text>
            </View>
            <View style={styles.itemBox}>
              <Text style={styles.itemEmoji}>🍜</Text>
            </View>
          </View>
        </View>

        {/* Bill Details */}
        <View style={styles.billSection}>
          <Text style={styles.sectionTitle}>Bill Details</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>item Total</Text>
            <Text style={styles.billValue}>₹256.00</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Product Discount</Text>
            <Text style={[styles.billValue, { color: '#047857' }]}>-60.00</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery free</Text>
            <Text style={styles.billValue}>₹20.00</Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TO Pay</Text>
            <Text style={styles.totalValue}>₹ 256.00</Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Place Order Button */}
      <TouchableOpacity style={styles.placeOrderBtn}>
        <Text style={styles.placeOrderBtnText}>Place Order</Text>
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

  section: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },

  changeText: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },

  addressBox: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
  },

  addressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },

  addressPhone: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },

  address: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },

  deliveryTime: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  paymentMethod: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  itemsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  itemBox: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemEmoji: {
    fontSize: 32,
  },

  billSection: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },

  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },

  billLabel: {
    fontSize: 13,
    color: '#666',
  },

  billValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },

  billDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },

  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },

  placeOrderBtn: {
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

  placeOrderBtnText: {
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

export default ReviewOrderScreen;