import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
  Image,
} from 'react-native';

const ORANGE = '#F97316';
const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2;

const CATEGORIES = [
  { id: 1, label: 'Fruits & Vegetables', image: require('../assets/images/logo/logo.png') },
  { id: 2, label: 'Breakfast',           image: require('../assets/images/logo/logo.png') },
  { id: 3, label: 'Beverages',           image: require('../assets/images/logo/logo.png') },
  { id: 4, label: 'Meat & Fish',         image: require('../assets/images/logo/logo.png') },
  { id: 5, label: 'Snacks',              image: require('../assets/images/logo/logo.png') },
  { id: 6, label: 'Dairy',              image: require('../assets/images/logo/logo.png') },
  { id: 7, label: 'Bakery',             image: require('../assets/images/logo/logo.png') },
  { id: 8, label: 'Organic',            image: require('../assets/images/logo/logo.png') },
];

type Category = {
  id: number;
  label: string;
  image: any;
};

const CategoryCard = ({ item }: { item: Category }) => (
  <TouchableOpacity style={styles.card}>
    <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
    <Text style={styles.cardLabel}>{item.label}</Text>
  </TouchableOpacity>
);

export default function CategoryScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Category</Text>
      </View>

      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <CategoryCard item={item} />}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  cardImage: {
  width: '100%',
  height: CARD_SIZE * 0.75,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
},

  headerRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111' },

  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  row: { justifyContent: 'space-between', marginBottom: 16 },

  card: {
    width: CARD_SIZE,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardImageArea: {
    width: '100%',
    height: CARD_SIZE * 0.75,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardEmoji: { fontSize: 48 },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },


});