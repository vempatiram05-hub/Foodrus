import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';

const ORANGE = '#F97316';
const BEIGE = '#F5F0E8';

const initialItems = [
  { id: 1, name: 'Fresh Oranges', weight: '500 g', price: 1000, qty: 4 },
  { id: 2, name: 'Fresh Oranges', weight: '500 g', price: 1000, qty: 4 },
  { id: 3, name: 'Fresh Oranges', weight: '500 g', price: 1000, qty: 4 },
  { id: 4, name: 'Fresh Oranges', weight: '500 g', price: 1000, qty: 4 },
];

export default function WishlistScreen() {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');

  const updateQty = (id, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );
  };

  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search for 'pizza' or 'milk'..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </View>

        {/* Hero banner */}
        <View style={styles.heroBanner}>
          {/* Left content */}
          <View style={styles.heroLeft}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle}>My Wishlist </Text>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>3</Text>
              </View>
            </View>
            <Text style={styles.heroSub}>Save your favorite items{'\n'}for later</Text>
            {/* Decorative orange */}
            <Text style={styles.heroDecorEmoji}>🍊</Text>
          </View>
          {/* Right image placeholder */}
          <View style={styles.heroRight}>
            <View style={styles.heroImageBox}>
              <Text style={{ fontSize: 56 }}>🍊</Text>
            </View>
          </View>
        </View>

        {/* Items count row */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>{items.length} items</Text>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.trashIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {/* Wishlist items */}
        {items.map((item) => (
          <View key={item.id} style={styles.wishItem}>
            <TouchableOpacity onPress={() => removeItem(item.id)}>
              <Text style={styles.removeX}>✕</Text>
            </TouchableOpacity>

            <View style={styles.productThumb}>
              <Text style={{ fontSize: 28 }}>🍊</Text>
            </View>

            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemWeight}>{item.weight}</Text>
            </View>

            {/* Stepper */}
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
          </View>
        ))}

        {/* Feature badges */}
        <View style={styles.featureRow}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>💳</Text>
            <View>
              <Text style={styles.featureTitle}>Flexible Payment</Text>
              <Text style={styles.featureSub}>Multiple secure payment options</Text>
            </View>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🕐</Text>
            <View>
              <Text style={styles.featureTitle}>24 x 7 Support</Text>
              <Text style={styles.featureSub}>We support online all days.</Text>
            </View>
          </View>
        </View>

        {/* Move all to cart banner */}
        <View style={styles.moveAllBanner}>
          <View style={styles.moveAllLeft}>
            <Text style={styles.moveAllHeart}>❤️</Text>
            <View>
              <Text style={styles.moveAllTitle}>Looks like you love these!</Text>
              <Text style={styles.moveAllSub}>Add items to cart and place your order.</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.moveAllBtn}>
            <Text style={styles.moveAllBtnText}>Move All to cart ›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BEIGE },
  container: { flex: 1, paddingHorizontal: 16 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#374151' },

  // Hero
  heroBanner: {
    flexDirection: 'row',
    backgroundColor: BEIGE,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    minHeight: 150,
  },
  heroLeft: { flex: 1, paddingTop: 8, paddingBottom: 16 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  heroBadge: {
    backgroundColor: '#ef4444', borderRadius: 10,
    width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
  },
  heroBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  heroSub: { fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 20 },
  heroDecorEmoji: { fontSize: 32, marginTop: 12 },
  heroRight: { width: 140, justifyContent: 'flex-end', alignItems: 'flex-end' },
  heroImageBox: {
    width: 130, height: 130,
    backgroundColor: '#eddab8',
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },

  // Count row
  countRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 8, gap: 8,
  },
  countText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  editBtn: {},
  editText: { fontSize: 14, color: ORANGE, fontWeight: '600' },
  trashIcon: { fontSize: 18 },

  // Wish items
  wishItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  removeX: { fontSize: 14, color: '#9ca3af' },
  productThumb: {
    width: 52, height: 52, backgroundColor: '#fef9ee',
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#111' },
  itemWeight: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden',
  },
  stepBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f9fafb' },
  stepText: { fontSize: 16, color: '#374151', fontWeight: '600' },
  qtyText: { paddingHorizontal: 10, fontSize: 14, fontWeight: '700', color: '#111' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: '#111', minWidth: 72, textAlign: 'right' },

  // Feature row
  featureRow: {
    flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16,
  },
  featureItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    padding: 12, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  featureIcon: { fontSize: 22 },
  featureTitle: { fontSize: 12, fontWeight: '700', color: '#111' },
  featureSub: { fontSize: 10, color: '#9ca3af', marginTop: 2 },

  // Move all banner
  moveAllBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16, padding: 14, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  moveAllLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  moveAllHeart: { fontSize: 20 },
  moveAllTitle: { fontSize: 12, fontWeight: '700', color: '#111' },
  moveAllSub: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  moveAllBtn: {
    backgroundColor: ORANGE, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  moveAllBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});