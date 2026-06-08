import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 16) / 3;

const FILTERS = ['All', 'Milk', "Lay's", 'Chips'];

type Product = {
  id: string;
  weight: string;
  name: string;
  price: string;
  image: any;
};

const PRODUCTS: Product[] = [
  { id: '1', weight: '150 g', name: "Lay's Classic Potato", price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '2', weight: '1 L',   name: 'Organic whole milk',   price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '3', weight: '150 g', name: "Lay's Classic Potato", price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '4', weight: '150 g', name: "Lay's Classic Potato", price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '5', weight: '1 L',   name: 'Organic whole milk',   price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '6', weight: '150 g', name: "Lay's Classic Potato", price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '7', weight: '150 g', name: "Lay's Classic Potato", price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '8', weight: '1 L',   name: 'Organic whole milk',   price: '₹349', image: require('../assets/images/logo/biryani.png') },
  { id: '9', weight: '150 g', name: "Lay's Classic Potato", price: '₹349', image: require('../assets/images/logo/biryani.png') },
];

/* ── Product Card ── */
const ProductCard = ({ item }: { item: Product }) => (
  <View style={styles.productCard}>
    <View>
      <Image source={item.image} style={styles.productImageBox} resizeMode="cover" />
      <TouchableOpacity style={styles.wishlistBtn}>
        <Text style={styles.wishlistHeart}>♡</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.productWeight}>{item.weight}</Text>
    <Text style={styles.productName}>{item.name}</Text>
    <View style={styles.productBottom}>
      <Text style={styles.productPrice}>{item.price}</Text>
      <TouchableOpacity style={styles.addBtn}>
        <Text style={styles.addBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

/* ── Screen ── */
export default function ShopGroceries() {
  const [activeFilter, setActiveFilter] = useState('All');

  const rows: Product[][] = [];
  for (let i = 0; i < PRODUCTS.length; i += 3) {
    rows.push(PRODUCTS.slice(i, i + 3));
  }

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* Hero Banner */}
        <View style={styles.hero}>
          <View style={styles.heroOverlay} />
          <Text style={styles.heroTitle}>Shop</Text>
          <Text style={styles.heroBreadcrumb}>Home / Shop</Text>
        </View>

        {/* Results Row */}
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>Showing 1–12 of 2560 results</Text>
          <TouchableOpacity style={styles.sortBtn}>
            <Text style={styles.sortBtnText}>Default Sorting ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, activeFilter === f && styles.chipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.chip}>
            <Text style={styles.chipText}>⚙ Filter</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Section Header */}
        {/* <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shop Groceries</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View> */}

        {/* Product Grid */}
        <View style={styles.productGrid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.productRow}>
              {row.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const ORANGE = '#E05A20';
const ORANGE_LIGHT = '#FDF0EB';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  // Hero
  hero: { height: 140, backgroundColor: '#8AB55A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroOverlay: { backgroundColor: 'rgba(0,0,0,0.35)' },
  heroTitle: { fontSize: 30, fontWeight: '700', color: '#fff', zIndex: 1 },
  heroBreadcrumb: { fontSize: 12, color: 'rgba(255,255,255,0.85)', zIndex: 1, marginTop: 2 },

  // Results
  resultsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  resultsText: { fontSize: 12, color: '#666' },
  sortBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  sortBtnText: { fontSize: 12, color: '#333' },

  // Filters
  filterScroll: { marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  chip: { backgroundColor: ORANGE_LIGHT, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: '#FFD6C8' },
  chipText: { fontSize: 12, fontWeight: '500', color: ORANGE },
  chipTextActive: { color: '#C94A1E' },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  seeAll: { fontSize: 13, color: ORANGE, fontWeight: '500' },

  // Products
  productGrid: { paddingHorizontal: 8, paddingBottom: 16 },
productRow: { flexDirection: 'row', marginBottom: 12 },
productCard: { 
  // width: '100%', 
  padding: 4,
  backgroundColor: '#fff',
  borderRadius: 10,
},
productImageBox: { 
  // width: '100%', 
  // aspectRatio: 1,
  borderRadius: 10, 
  marginBottom: 6,
  overflow: 'hidden',
},
image: { width: 'auto', height: 'auto' },
wishlistBtn: { 
  position: 'absolute', top: 5, right: 5, 
  width: 22, height: 22, borderRadius: 11, 
  backgroundColor: 'rgba(255,255,255,0.85)', 
  alignItems: 'center', justifyContent: 'center' 
},
wishlistHeart: { fontSize: 14, color: '#bbb' },
productWeight: { fontSize: 11, color: '#999', marginBottom: 2, paddingHorizontal: 4 },
productName: { fontSize: 11, fontWeight: '600', color: '#111', lineHeight: 16, marginBottom: 6, paddingHorizontal: 4 },
productBottom: { 
  flexDirection: 'row', alignItems: 'center', 
  justifyContent: 'space-between', 
  paddingHorizontal: 4, paddingBottom: 6 
},
productPrice: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
addBtn: { 
  width: 26, height: 26, borderRadius: 13, 
  backgroundColor: ORANGE, 
  alignItems: 'center', justifyContent: 'center' 
},
addBtnText: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '400' },
});