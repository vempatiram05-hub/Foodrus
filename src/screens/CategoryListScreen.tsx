import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Image,
} from 'react-native';

/* ================= TYPES ================= */
type RestaurantItem = {
  id: string;
  name: string;
  rating: string;
  time: string;
  tags?: string;
  location?: string;
  offer?: string;
  image: any;
};

type CategoryData = {
  title?: string;
  desc?: string;
  filters: string[];
  showAddBtn?: boolean;
  items: RestaurantItem[];
};

/* ================= DATA ================= */
const RESTAURANT_DATA: Record<string, CategoryData> = {
  Biryani: {
    title: 'Biryani',
    desc: 'Taste these delectable classics, delectable biryanis to make your day.',
    filters: ['Pure Veg', 'Non-Veg', 'Sort/Filter'],
    items: [
      { id: '1', name: 'Pista House', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
      { id: '2', name: 'Haveli Family Restaurant', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
      { id: '3', name: 'Spice Garden', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
      { id: '4', name: 'Royal Biryani House', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
      { id: '5', name: 'Kaveri Restaurant', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
      { id: '6', name: 'Golden Restaurant', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
      { id: '7', name: 'Biryani House', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
      { id: '8', name: 'Paradise Biryani', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Biryani, Kebabs, Fast Food, North Indian, Indian', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/biryani.png') },
    ],
  },
  Burger: {
    title: 'Burger',
    desc: 'BurgerSatisfy your cravings with these fresh and flavoursome burgers.',
    filters: ['All', 'Fruites', 'Pure veg', 'Non-veg', 'Filter'],
    items: [
      { id: '1', name: 'Burger King', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '60% OFF UPTO ₹120', image: require('../assets/images/logo/burger.png') },
      { id: '2', name: 'Smart Foodies', rating: '4.7', time: '30-35 mins', tags: 'American, Fast Food, Snacks, Korean, Burgers, Beverages', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/burger.png') },
      { id: '3', name: 'Indiana Burgers', rating: '4.7', time: '30-35 mins', tags: 'Burgers, Beverages, Desserts, American, Cafe', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/burger.png') },
      { id: '4', name: 'Momo Streat', rating: '4.7', time: '30-35 mins', tags: 'Burgers, Fast Food, Rolls & Wraps', location: 'Khammam', offer: '', image: require('../assets/images/logo/burger.png') },
      { id: '5', name: 'Burger King', rating: '4.7', time: '30-35 mins', tags: 'Pizzas, Beverages, Italian, Continental', location: 'z.p center', offer: '', image: require('../assets/images/logo/burger.png') },
      { id: '6', name: 'Burger King', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Beverages, Street Food, Pizzas, Fast Food, Burgers', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/burger.png') },
      { id: '7', name: 'Burger Point', rating: '4.7', time: '30-35 mins', tags: 'Burgers, Fast Food', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/burger.png') },
      { id: '8', name: 'Big Bite', rating: '4.7', time: '30-35 mins', tags: 'Burgers, Snacks', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/burger.png') },
    ],
  },
  Cake: {
    title: 'Cakes & Desserts',
    desc: 'Satisfy your sweet cravings with these delicious cakes and desserts.',
    filters: ['Pure Veg', 'Non-Veg', 'Sort/Filter'],
    items: [
      { id: '1', name: 'The Belgian Waffle Co.', rating: '4.7', time: '30-35 mins', tags: 'Waffle, Desserts, Ice Cream, Beverages', location: 'Khanapuram Haveli', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '2', name: 'Ibaco', rating: '4.7', time: '30-35 mins', tags: 'Waffle, Desserts, Ice Cream, Beverages', location: 'Khanapuram Haveli', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '3', name: 'Dark Cakes', rating: '4.7', time: '30-25 mins', tags: 'Desserts, Sweets, Beverages', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '4', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: 'ITEMS AT ₹109', image: require('../assets/images/logo/cake.png') },
      { id: '5', name: 'Gourmet Ice Cream Cake..', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '6', name: 'Sweet Delights', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '25% OFF UPTO ₹60', image: require('../assets/images/logo/cake.png') },
      { id: '7', name: 'Cake World', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '8', name: 'Bake House', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Cakes', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/cake.png') },
    ],
  },
  Omelette: {
    title: 'Omelette',
    desc: 'Have a protein packed treat to kick-start your day.',
    filters: ['Pure Veg', 'Non-Veg', 'Sort/Filter'],
    items: [
      { id: '1', name: '', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/omlette.png') },
      { id: '2', name: 'Sri Sri Sri Hotel', rating: '4.7', time: '30-35 mins', tags: 'Biryani, Chinese, Tandoor', location: 'Raparthi nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/omlette.png') },
      { id: '3', name: '', rating: '4.7', time: '30-25 mins', tags: '', location: '', offer: '40% Upto ₹84', image: require('../assets/images/logo/omlette.png') },
      { id: '4', name: '', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/omlette.png') },
      { id: '5', name: 'Brewberrys Coffee', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '37% OFF ABOVE ₹399', image: require('../assets/images/logo/omlette.png') },
      { id: '6', name: 'Burger It Up', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/omlette.png') },
      { id: '7', name: '', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/omlette.png') },
      { id: '8', name: '', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/omlette.png') },
    ],
  },
  Pongal: {
    title: 'Pongal',
    desc: 'Kickstart your day with a healthy & filling plate of Pongal.',
    filters: ['All', 'Fruites', 'Pure veg', 'Non-veg', 'Filter'],
    showAddBtn: true,
    items: [
      { id: '1', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '2', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '3', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '4', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '5', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '6', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '7', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
      { id: '8', name: 'Cake Factory', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'yellandu x road', offer: '', image: require('../assets/images/logo/cake.png') },
    ],
  },
  Shakes: {
    title: '',
    desc: '',
    filters: ['Pure Veg', 'Non-Veg', 'Sort/Filter'],
    items: [
      { id: '1', name: '', rating: '4.7', time: '30-35 mins', tags: 'Beverages, Continental', location: 'mamatha Road', offer: 'ITEMS AT ₹99', image: require('../assets/images/logo/shakes.png') },
      { id: '2', name: 'Zam Zam Juice ...', rating: '4.7', time: '30-35 mins', tags: 'Juices, Chaat, Snacks', location: 'Lenin Nagar', offer: '₹100 OFF ABOVE ₹299', image: require('../assets/images/logo/shakes.png') },
      { id: '3', name: 'Slurpy Shakes', rating: '4.7', time: '30-35 mins', tags: 'Beverages, Ice Cream, Desserts', location: 'Lenin Nagar', offer: '40% Off Upto ₹80', image: require('../assets/images/logo/shakes.png') },
      { id: '4', name: 'Havmor Ice Creams and Thick Shakes', rating: '4.7', time: '30-35 mins', tags: 'Desserts, Sweets, Beverages', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/shakes.png') },
      { id: '5', name: 'Sri Juices And Milkshakes', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '37% ABOVE ₹...', image: require('../assets/images/logo/shakes.png') },
      { id: '6', name: 'Burger It Up', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/shakes.png') },
      { id: '7', name: '', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/shakes.png') },
      { id: '8', name: '', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/shakes.png') },
    ],
  },
   Chinese: {
    title: 'Chinese',
    desc: 'Transport your taste buds to the heart of Chinese cuisine with these scrumptious dishes.',
    filters: ['All', 'Fruites', 'Pure veg', 'Non-veg', 'Filter'],
    items: [
      { id: '1', name: 'Kaveri Restaurant ....', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '50% ...', image: require('../assets/images/logo/chinese.png') },
      { id: '2', name: 'Sage N Salt', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Andhra, Biryani, South Indian, Hyderabadi, Juices, Fast Food', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/chinese.png') },
      { id: '3', name: '', rating: '4.7', time: '30-35 mins', tags: 'Biryani, Chinese', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/chinese.png') },
      { id: '4', name: 'Momo Streat', rating: '4.7', time: '30-35 mins', tags: 'Burgers, Fast Food, Rolls & Wraps', location: 'Khammam', offer: '', image: require('../assets/images/logo/chinese.png') },
      { id: '5', name: 'Just Bake', rating: '4.7', time: '30-35 mins', tags: 'Bakery, Chinese, Desserts', location: 'Mamatha Road', offer: '', image: require('../assets/images/logo/chinese.png') },
      { id: '6', name: 'Indian Fast Food @ Fec', rating: '4.7', time: '30-35 mins', tags: 'Chinese, Bakery, Pizzas, Pastas, Burgers', location: 'Lenin Nagar', offer: '', image: require('../assets/images/logo/chinese.png') },
      { id: '7', name: '', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/chinese.png') },
      { id: '8', name: '', rating: '4.7', time: '30-35 mins', tags: '', location: '', offer: '', image: require('../assets/images/logo/chinese.png') },
    ],
  },
};

/* ================= CARD ================= */
const RestaurantCard = ({ item, showAddBtn }: { item: RestaurantItem; showAddBtn?: boolean }) => (
  <TouchableOpacity style={styles.card} activeOpacity={0.85}>
    <View style={styles.cardImageWrap}>
      <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
      {item.offer ? (
        <View style={styles.offerBadge}>
          <Text style={styles.offerText}>{item.offer}</Text>
        </View>
      ) : null}
      {showAddBtn && (
        <TouchableOpacity style={styles.addBtn}>
          <Text style={styles.addBtnTxt}>+</Text>
        </TouchableOpacity>
      )}
    </View>
    <View style={styles.cardInfo}>
      {item.name ? <Text style={styles.cardName}>{item.name}</Text> : null}
      <View style={styles.ratingRow}>
        <Text style={styles.star}>⭐</Text>
        <Text style={styles.ratingText}>{item.rating}  {item.time}</Text>
      </View>
      {item.tags ? <Text style={styles.cardTags}>{item.tags}</Text> : null}
      {item.location ? <Text style={styles.cardTags}>{item.location}</Text> : null}
    </View>
  </TouchableOpacity>
);

/* ================= SCREEN ================= */
const CategoryListScreen = (props: any) => {
  const category: string = props.route?.params?.category ?? props.category ?? 'Biryani';
  const data: CategoryData = RESTAURANT_DATA[category] || RESTAURANT_DATA['Biryani'];
  const [activeFilter, setActiveFilter] = useState<string>(data.filters[0]);

  const pairs: RestaurantItem[][] = [];
  for (let i = 0; i < data.items.length; i += 2) {
    pairs.push(data.items.slice(i, i + 2));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      {/* <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🍕</Text>
          <Text style={styles.brandName}>Rush</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity><Text style={styles.loginText}>Log in</Text></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Text style={styles.iconTxt}>❤️</Text></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Text style={styles.iconTxt}>🛒</Text></TouchableOpacity>
        </View>
      </View> */}

      {/* Search */}
      {/* <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for 'pizza' or 'milk'..."
          placeholderTextColor="#aaa"
        />
      </View> */}

      <ScrollView showsVerticalScrollIndicator={false}>

         {/* Hero Banner */}
  <View style={styles.hero}>
    <View style={styles.heroOverlay} />
    <Text style={styles.heroTitle}>{data.title || category}</Text>
    <Text style={styles.heroBreadcrumb}>Home / {data.title || category}</Text>
  </View>

        {/* Title & Desc */}
        {data.title ? (
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>{data.title}</Text>
            {data.desc ? <Text style={styles.pageDesc}>{data.desc}</Text> : null}
          </View>
        ) : data.desc ? (
          <View style={styles.titleSection}>
            <Text style={styles.pageDesc}>{data.desc}</Text>
          </View>
        ) : null}

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {data.filters.map((f: string) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, activeFilter === f && styles.filterBtnActive]}
              onPress={() => setActiveFilter(f)}
            >
              {f === 'Pure Veg' && (
                <View style={styles.vegBox}>
                  <View style={styles.vegDotGreen} />
                </View>
              )}
              {f === 'Non-Veg' && (
                <View style={styles.vegBox}>
                  <View style={styles.vegDotRed} />
                </View>
              )}
              {(f === 'Sort/Filter' || f === 'Filter') && (
                <Text style={styles.filterIcon}>⚙️ </Text>
              )}
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Grid */}
        <View style={styles.grid}>
          {pairs.map((pair, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {pair.map((item: RestaurantItem) => (
                <View key={item.id} style={styles.col}>
                  <RestaurantCard item={item} showAddBtn={data.showAddBtn} />
                </View>
              ))}
              {pair.length === 1 && <View style={styles.col} />}
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
  },
  logoWrap:    { flexDirection: 'row', alignItems: 'center' },
  logoEmoji:   { fontSize: 22 },
  brandName:   { fontSize: 18, fontWeight: '800', color: '#FF6B35', marginLeft: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginText:   { fontSize: 15, fontWeight: '600', color: '#222' },
  iconBtn:     { padding: 4 },
  iconTxt:     { fontSize: 20 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 12,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchIcon:  { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },

  // Hero Banner
  hero: {
    height: 140,
    backgroundColor: '#8AB55A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    zIndex: 1,
  },
  heroBreadcrumb: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    zIndex: 1,
    marginTop: 2,
  },

  titleSection: { paddingHorizontal: 16, marginBottom: 10 },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 },
  pageDesc:     { fontSize: 13, color: '#777', lineHeight: 18 },

  filterScroll: { paddingLeft: 16, marginBottom: 14 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd',
    borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 7, marginRight: 8,
    backgroundColor: '#fff',
  },
  filterBtnActive:  { borderColor: '#FF6B35', backgroundColor: '#fff5f0' },
  filterText:       { fontSize: 13, color: '#555', fontWeight: '500' },
  filterTextActive: { color: '#FF6B35', fontWeight: '700' },
  vegBox:      { width: 18, height: 18, borderWidth: 1.5, borderColor: '#555', borderRadius: 3, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  vegDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#27ae60' },
  vegDotRed:   { width: 10, height: 10, borderRadius: 5, backgroundColor: '#c0392b' },
  filterIcon:  { fontSize: 12 },

  grid: { paddingHorizontal: 10 },
  row:  { flexDirection: 'row', marginBottom: 4 },
  col:  { flex: 1, paddingHorizontal: 6, marginBottom: 10 },

  card: {
    backgroundColor: '#fff', borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 6, elevation: 3,
  },
  cardImageWrap: { width: '100%', height: 140, position: 'relative' },
  cardImage:     { width: '100%', height: '100%', borderRadius: 12 },

  offerBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 5, paddingHorizontal: 8,
  },
  offerText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  addBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B35', shadowOpacity: 0.4,
    shadowRadius: 4, elevation: 4,
    borderWidth: 1.5, borderColor: '#FF6B35',
  },
  addBtnTxt: { color: '#FF6B35', fontSize: 20, fontWeight: '700', lineHeight: 24 },

  cardInfo:   { padding: 10 },
  cardName:   { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 4 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  star:       { fontSize: 11, marginRight: 3 },
  ratingText: { fontSize: 11, color: '#555' },
  cardTags:   { fontSize: 10, color: '#888', lineHeight: 14 },
});

export default CategoryListScreen;