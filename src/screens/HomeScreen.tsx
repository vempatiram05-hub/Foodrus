import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Image,
} from 'react-native';

// ─── DATA ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: '1', name: 'Cake', emoji: '🎂' },
  { id: '2', name: "Biryani's", emoji: '🍛' },
  { id: '3', name: 'Omelette', emoji: '🍳' },
  { id: '4', name: 'Shakes', emoji: '🥤' },
  { id: '5', name: 'Chinese', emoji: '🥡' },
  { id: '6', name: 'Burger', emoji: '🍔' },
];

const RESTAURANTS = [
  {
    id: '1',
    name: 'The Wedding Bir...',
    desc: 'Lorem Ipsum is simply dummy text of the printing and type...',
    rating: '4.5',
    discount: '10% OFF Upto ₹140',
    color: '#8B2500',
    emoji: '🍛',
  },
  {
    id: '2',
    name: 'Hyderabadi Biry...',
    desc: 'Lorem Ipsum is simply dummy text of the printing and type...',
    rating: '4.5',
    discount: '10% OFF Upto ₹100',
    color: '#C67D2E',
    emoji: '🍛',
  },
];

const CUISINES = [
  { id: '1', name: 'Snacks', emoji: '🥐' },
  { id: '2', name: 'Desserts', emoji: '🍰' },
  { id: '3', name: 'Indiansweet', emoji: '🍮' },
  { id: '4', name: 'Beverages', emoji: '🧃' },
  { id: '5', name: 'Donuts', emoji: '🍩' },
  { id: '6', name: 'Rice', emoji: '🍚' },
];

const GROCERIES = [
  {
    id: '1',
    weight: '150 g',
    name: "Lay's Classic Potato Chips",
    price: '$3.49',
    color: '#e8d5b0',
    emoji: '🥔',
  },
  {
    id: '2',
    weight: '1 L',
    name: 'Organic whole milk',
    price: '$3.49',
    color: '#f0f0f0',
    emoji: '🥛',
  },
  {
    id: '3',
    weight: '150 g',
    name: "Lay's Classic Potato Chips",
    price: '$3.49',
    color: '#d4a85a',
    emoji: '🥔',
  },
  {
    id: '4',
    weight: '150 g',
    name: "Lay's Classic Potato Chips",
    price: '$3.49',
    color: '#b5651d',
    emoji: '🥔',
  },
  {
    id: '5',
    weight: '150 g',
    name: "Lay's Classic Potato Chips",
    price: '$3.49',
    color: '#6aaa5e',
    emoji: '🥔',
  },
  {
    id: '6',
    weight: '150 g',
    name: "Lay's Classic Potato Chips",
    price: '$3.49',
    color: '#e8d5b0',
    emoji: '🥔',
  },
];





// ─── MAIN HOME SCREEN COMPONENT ────────────────────────────────────────────────

const HomeScreen: React.FC = () => {
  const navigation = useNavigation(); // ← add this line


  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/images/logo/image_cropped.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Text style={styles.loginText}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconTxt}>❤️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconTxt}>🛒</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* ── Search Bar ── */}
        <TouchableOpacity style={styles.searchWrap} onPress={() => navigation.navigate('Search' as never)}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchInput}>Search for 'pizza' or 'milk'...</Text>
        </TouchableOpacity>

        {/* ── Hero Banner ── */}
        <View style={styles.heroBanner}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>Groceries & Food</Text>
            <Text style={styles.heroSubtitle}>delivery in 10 mins</Text>
            <Text style={styles.heroDesc}>
              Quality groceries and delicious meals, right when you need them.
            </Text>
            <TouchableOpacity style={styles.heroBtn}>
              <Text style={styles.heroBtnText}>Order Groceries</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeStar}>⭐ 4.5</Text>
              <Text style={styles.heroBadgeLabel}>Top Rated</Text>
            </View>
            <View style={styles.heroImageBox}>
              <Text style={styles.heroEmoji}>🍔</Text>
              <Text style={styles.heroEmoji2}>🥗</Text>
            </View>
          </View>
        </View>

        {/* ── Hero Tags ── */}
        <View style={styles.heroTags}>
          <Text style={styles.heroTag}>🌿 Fresh products</Text>
          <Text style={styles.heroTag}>👌 Best quality</Text>
          <Text style={styles.heroTag}>⏱ 10 min delivery</Text>
        </View>

        {/* ── Explore Categories ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explore Categories</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.id} style={styles.categoryItem}>
              <View style={styles.categoryCircle}>
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              </View>
              <Text style={styles.categoryName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Promo Banners ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.promoScroll}
        >
          {/* Banner 1 – dark */}
          <View style={[styles.promoBanner, { backgroundColor: '#1a1a2e' }]}>
            <Text style={styles.promoTag1}>TIME{'\n'}OFF</Text>
            <Text style={styles.promoSub1}>Subscribe</Text>
            <TouchableOpacity style={styles.promoBtn1}>
              <Text style={styles.promoBtnTxt1}>Now</Text>
            </TouchableOpacity>
          </View>

          {/* Banner 2 – blue */}
          <View style={[styles.promoBanner, { backgroundColor: '#005fa3' }]}>
            <Text style={styles.promoTagBlue}>SWIFT PASS</Text>
            <View style={styles.freeDeliveryBadge}>
              <Text style={styles.freeDeliveryTxt}>Free & Free{'\n'}DELIVERY</Text>
            </View>
            <Text style={styles.promoSubBlue}>Free Delivery</Text>
            <TouchableOpacity style={styles.promoBtnWhite}>
              <Text style={styles.promoBtnWhiteTxt}>Subscribe</Text>
            </TouchableOpacity>
          </View>

          {/* Banner 3 – green */}
          <View style={[styles.promoBanner, { backgroundColor: '#1a6b3c' }]}>
            <Text style={styles.promoTagGreen}>WEEKEND SPECIAL</Text>
            <Text style={styles.promoSubGreen}>Up to 60% OFF</Text>
            <TouchableOpacity style={styles.promoBtnWhite}>
              <Text style={styles.promoBtnWhiteTxt}>Order Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* ── Popular Restaurants ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Popular Restaurants</Text>
          <TouchableOpacity style={styles.viewAllBtn}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.restScroll}
        >
          {RESTAURANTS.map((r) => (
            <TouchableOpacity key={r.id} style={styles.restCard}>
              <View style={[styles.restImageBox, { backgroundColor: r.color }]}>
                <Text style={styles.restEmoji}>{r.emoji}</Text>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>⭐ {r.rating}</Text>
                </View>
              </View>
              <Text style={styles.restName}>{r.name}</Text>
              <Text style={styles.restDesc}>{r.desc}</Text>
              <View style={styles.discountRow}>
                <Text style={styles.discountIcon}>🏷</Text>
                <Text style={styles.discountText}>{r.discount}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Variety of Cuisines ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Popular Restaurants</Text>

          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() =>
              navigation.navigate('FoodTabs' as never, {
                screen: 'PopularRestaurantScreen' as never,
              } as never)
            }          >
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cuisineScroll}
        >
          {CUISINES.map((c) => (
            <TouchableOpacity key={c.id} style={styles.cuisineItem}>
              <View style={styles.cuisineCircle}>
                <Text style={styles.cuisineEmoji}>{c.emoji}</Text>
              </View>
              <Text style={styles.cuisineName}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Shop Groceries ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Shop Groceries</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.groceryGrid}>
          {GROCERIES.map((g) => (
            <View key={g.id} style={styles.groceryCard}>
              <View
                style={[styles.groceryImageBox, { backgroundColor: g.color }]}
              >
                <Text style={styles.groceryEmoji}>{g.emoji}</Text>
              </View>
              <Text style={styles.groceryWeight}>{g.weight}</Text>
              <Text style={styles.groceryName}>{g.name}</Text>
              <View style={styles.groceryBottom}>
                <Text style={styles.groceryPrice}>{g.price}</Text>
                <TouchableOpacity style={styles.addBtn}>
                  <Text style={styles.addBtnTxt}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Bottom Tab ── */}
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 84, height: 54 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {},
  loginText: { fontSize: 15, fontWeight: '600', color: '#222' },
  iconBtn: { padding: 4 },
  iconTxt: { fontSize: 20 },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },

  // Hero Banner
  heroBanner: {
    flexDirection: 'row',
    backgroundColor: '#fff8f0',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  heroLeft: { flex: 1, justifyContent: 'center' },
  heroTitle: { fontSize: 16, fontWeight: '800', color: '#222' },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF6B35',
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 17,
  },
  heroBtn: {
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  heroBtnText: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  heroRight: { width: 120, alignItems: 'center', justifyContent: 'center' },
  heroBadge: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-end',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroBadgeStar: { fontSize: 11, fontWeight: '700', color: '#FF6B35' },
  heroBadgeLabel: { fontSize: 9, color: '#888' },
  heroImageBox: {
    backgroundColor: '#FF6B35',
    borderRadius: 60,
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 30 },
  heroEmoji2: { fontSize: 22, position: 'absolute', bottom: 5, right: 5 },

  // Hero Tags
  heroTags: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    gap: 10,
  },
  heroTag: { fontSize: 11, color: '#555' },

  // Section Headers
  sectionHeader: { paddingHorizontal: 16, marginTop: 18, marginBottom: 15 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  viewAllBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  viewAllText: { fontSize: 13, color: '#444' },
  viewAllBtnOutline: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  viewAllOutlineText: { fontSize: 12, color: '#444' },
  seeAllText: { fontSize: 14, color: '#FF6B35', fontWeight: '700' },

  // Categories
  categoryScroll: { paddingLeft: 16 },
  categoryItem: { alignItems: 'center', marginRight: 16, width: 64 },
  categoryCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryEmoji: { fontSize: 28 },
  categoryName: { fontSize: 12, color: '#333', textAlign: 'center', marginBottom: 8 },

  // Promo Banners
  promoScroll: { paddingLeft: 16, marginBottom: 4 },
  promoBanner: {
    width: 140,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  promoTag1: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FF6B35',
    lineHeight: 18,
  },
  promoSub1: { fontSize: 10, color: '#ccc', flex: 1 },
  promoBtn1: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  promoBtnTxt1: { color: '#fff', fontSize: 12, fontWeight: '700' },

  promoTagBlue: { fontSize: 13, fontWeight: '900', color: '#fff' },
  freeDeliveryBadge: {
    backgroundColor: '#f0c040',
    borderRadius: 6,
    padding: 4,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  freeDeliveryTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#333',
    lineHeight: 12,
  },
  promoSubBlue: { fontSize: 9, color: '#cce4ff', lineHeight: 13 },

  promoTagGreen: { fontSize: 11, fontWeight: '900', color: '#fff' },
  promoSubGreen: { fontSize: 9, color: '#b2dfcc', lineHeight: 13, flex: 1 },

  promoBtnWhite: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  promoBtnWhiteTxt: { color: '#333', fontSize: 11, fontWeight: '700' },

  // Restaurants
  restScroll: { paddingLeft: 16 },
  restCard: {
    width: 170,
    marginRight: 14,
    marginBottom: 4,
  },
  restImageBox: {
    width: 170,
    height: 140,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  restEmoji: { fontSize: 48 },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#333' },
  restName: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
  restDesc: { fontSize: 11, color: '#888', lineHeight: 15, marginBottom: 6 },
  discountRow: { flexDirection: 'row', alignItems: 'center' },
  discountIcon: { fontSize: 12, marginRight: 4 },
  discountText: { fontSize: 11, color: '#7B2D8B', fontWeight: '600' },

  // Cuisines
  cuisineScroll: { paddingLeft: 16 },
  cuisineItem: { alignItems: 'center', marginRight: 16, width: 70 },
  cuisineCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cuisineEmoji: { fontSize: 30 },
  cuisineName: { fontSize: 11, color: '#333', textAlign: 'center' },

  // Groceries Grid
  groceryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  groceryCard: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  groceryImageBox: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  groceryEmoji: { fontSize: 32 },
  groceryWeight: { fontSize: 10, color: '#888', marginBottom: 2 },
  groceryName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#222',
    marginBottom: 6,
    lineHeight: 14,
  },
  groceryBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groceryPrice: { fontSize: 13, fontWeight: '700', color: '#111' },
  addBtn: {
    backgroundColor: '#FF6B35',
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },

  // Bottom Tab
  bottomTab: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20, marginBottom: 2 },
  tabLabel: { fontSize: 10, color: '#999' },
  tabLabelActive: { color: '#FF6B35', fontWeight: '700' },
});

export default HomeScreen;