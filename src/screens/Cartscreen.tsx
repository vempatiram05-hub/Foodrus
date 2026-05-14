import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';

const ORANGE = '#F97316';

const initialItems = [
  { id: 1, name: 'Fresh Oranges', weight: '500 g', discount: '10 %off', price: 1000, qty: 4 },
  { id: 2, name: 'Fresh Oranges', weight: '500 g', discount: '10 %off', price: 1000, qty: 4 },
  { id: 3, name: 'Fresh Oranges', weight: '500 g', discount: '10 %off', price: 1000, qty: 4 },
  { id: 4, name: 'Fresh Oranges', weight: '500 g', discount: '10 %off', price: 1000, qty: 4 },
];

export default function CartScreen() {
  const [items, setItems] = useState(initialItems);

  const updateQty = (id, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );
  };

  const removeItem = (id) => setItems((prev) => prev.filter((item) => item.id !== id));

  const subtotal = 56.27;
  const gst = -17.4;
  const delivery = 3.99;
  const coupon = -17.4;
  const total = (subtotal + gst + delivery + coupon).toFixed(2);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY Cart</Text>
        <TouchableOpacity style={styles.wishlistBtn}>
          <Text style={styles.heartIcon}>❤️</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
        </TouchableOpacity>
      </View>

      {/* Delivery location */}
      <View style={styles.deliveryRow}>
        <Text style={styles.deliveryText}>Delivery 560103 📍</Text>
      </View>

      {/* Savings banner */}
      <View style={styles.savingsBanner}>
        <Text style={styles.savingsText}>You saved $50 on this order</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Cart items */}
        {items.map((item) => (
          <View key={item.id} style={styles.cartItem}>
            {/* Product image placeholder */}
            <View style={styles.productImage}>
              <Text style={{ fontSize: 28 }}>🍊</Text>
            </View>

            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemWeight}>{item.weight}</Text>
              <Text style={styles.itemDiscount}>{item.discount}</Text>
            </View>

            {/* Qty stepper */}
            <View style={styles.stepper}>
              <TouchableOpacity onPress={() => updateQty(item.id, -1)} style={styles.stepBtn}>
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.qty}</Text>
              <TouchableOpacity onPress={() => updateQty(item.id, 1)} style={styles.stepBtn}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.itemPrice}>₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>

            <TouchableOpacity onPress={() => removeItem(item.id)}>
              <Text style={styles.removeX}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Order Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Order  summary</Text>
          {[
            { label: 'Subtotal', value: subtotal.toFixed(2) },
            { label: 'GST(15%)', value: gst.toFixed(1) },
            { label: 'Delivery Charges', value: `+${delivery}` },
            { label: 'Coupon Disscount', value: coupon.toFixed(1) },
          ].map(({ label, value }) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{total}</Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Checkout button */}
      <View style={styles.checkoutWrapper}>
        <TouchableOpacity style={styles.checkoutBtn}>
          <Text style={styles.checkoutText}>Proceed to Checkout</Text>
          <Text style={styles.checkoutArrow}>→</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 28, color: '#374151', lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111' },
  wishlistBtn: { position: 'relative', padding: 4 },
  heartIcon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#ef4444', borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  deliveryRow: { paddingHorizontal: 16, paddingVertical: 8 },
  deliveryText: { fontSize: 14, color: '#6b7280' },

  savingsBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#f0fdf4', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  savingsText: { fontSize: 14, fontWeight: '600', color: '#16a34a' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  productImage: {
    width: 60, height: 60, backgroundColor: '#f9fafb',
    borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#111' },
  itemWeight: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  itemDiscount: { fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: '600' },

  stepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden',
  },
  stepBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f9fafb' },
  stepText: { fontSize: 16, color: '#374151', fontWeight: '600' },
  qtyText: { paddingHorizontal: 10, fontSize: 14, fontWeight: '700', color: '#111' },

  itemPrice: { fontSize: 13, fontWeight: '700', color: '#111', minWidth: 72, textAlign: 'right' },
  removeX: { fontSize: 16, color: '#9ca3af', paddingLeft: 4 },

  summary: {
    marginTop: 16, padding: 16,
    backgroundColor: '#fafafa', borderRadius: 12,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#6b7280' },
  summaryValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  totalValue: { fontSize: 15, fontWeight: '700', color: '#111' },

  checkoutWrapper: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  checkoutBtn: {
    backgroundColor: ORANGE, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  checkoutText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  checkoutArrow: { fontSize: 18, color: '#fff' },
});