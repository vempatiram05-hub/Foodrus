import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
} from 'react-native';

const PopularRestaurantScreen = () => {
  return (
    <View style={styles.container}>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search for 'pizza' or 'milk'..."
            placeholderTextColor="#999"
          />
        </View>

        {/* Banner */}
        <Image
          source={require('../assets/images/logo/logo.png')}
          style={styles.banner}
        />

        {/* Result Header */}
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>
            Showing 1–12 of 2560 results
          </Text>

          <View style={styles.sortBtn}>
            <Text>Default Sorting ▼</Text>
          </View>
        </View>

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <Text style={styles.filter}>🟢 Pure Veg</Text>
          <Text style={styles.filter}>🟤 Non-Veg</Text>
          <Text style={styles.filter}>⚙ Sort/Filter</Text>
        </View>

        {/* Food Cards */}
        <View style={styles.grid}>

          {[1, 2, 3, 4, 5, 6].map((item) => (
            <View key={item} style={styles.card}>

              <Image
          source={require('../assets/images/logo/logo.png')}
                style={styles.foodImage}
              />

              <View style={styles.rating}>
                <Text>⭐ 4.5</Text>
              </View>

              <Text style={styles.title}>
                The Wedding Biryani
              </Text>

              <Text style={styles.desc}>
                Lorem Ipsum is simply dummy text of printing
              </Text>

              <Text style={styles.offer}>
                🎉 10% OFF Upto ₹140
              </Text>

            </View>
          ))}

        </View>

      </ScrollView>

    </View>
  );
};

export default PopularRestaurantScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },

  searchBox: {
    margin: 15,
    backgroundColor: '#eee',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 45,
    justifyContent: 'center',
  },

  banner: {
    width: '100%',
    height: 170,
    resizeMode: 'cover',
  },

  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 15,
  },

  resultText: {
    color: '#666',
  },

  sortBtn: {
    borderWidth: 1,
    borderColor: '#ff5200',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },

  filter: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    elevation: 2,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },

  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 3,
  },

  foodImage: {
    width: '100%',
    height: 130,
  },

  rating: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },

  title: {
    fontSize: 16,
    fontWeight: 'bold',
    margin: 8,
  },

  desc: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },

  offer: {
    margin: 8,
    color: '#7b3fe4',
    fontWeight: '600',
  },
});