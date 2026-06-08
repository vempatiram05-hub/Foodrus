import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const RECENT_SEARCHES = [
  'Subway',
  'Burgers',
  'Sandwich',
  'Pizza',
  'Fried Rice with meat',
  'Bakery',
  'Cake',
  'Cookies',
];

export default function SearchScreen() {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState(RECENT_SEARCHES);

  const clearAll = () => setRecents([]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search"
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* ── Recent Searches ── */}
      {recents.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>RECENT SEARCHES</Text>
            <TouchableOpacity onPress={clearAll}>
              <Text style={styles.clearAll}>CLEAR ALL</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={recents}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row}>
                <Text style={styles.rowIcon}>🔍</Text>
                <Text style={styles.rowText}>{item}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  searchIcon: { fontSize: 18, color: '#999' },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: '#111',
    borderLeftWidth: 2,
    borderLeftColor: '#c8a84b',
    paddingLeft: 8,
  },
  cancel: { fontSize: 16, color: '#555', fontWeight: '400' },

  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#999', letterSpacing: 1 },
  clearAll: { fontSize: 12, fontWeight: '600', color: '#999', letterSpacing: 1 },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
  },
  rowIcon: { fontSize: 18, color: '#555' },
  rowText: { fontSize: 16, color: '#111' },
  separator: { height: 1, backgroundColor: '#f5f5f5', marginLeft: 56 },
});