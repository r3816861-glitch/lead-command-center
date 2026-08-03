import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { Search, Phone, Filter } from 'lucide-react-native';

const INITIAL_LEADS = [
  { id: '1', name: 'Ramesh Sharma', type: 'LAP BT', status: 'Follow-up', phone: '9876543210', amount: '₹45 Lakhs' },
  { id: '2', name: 'Vikram Mehta', type: 'Home Loan', status: 'Fresh Lead', phone: '9811223344', amount: '₹80 Lakhs' },
  { id: '3', name: 'Anil Gupta', type: 'MSME Loan', status: 'Doc Pickup', phone: '9900112233', amount: '₹25 Lakhs' },
  { id: '4', name: 'Sanjay Verma', type: 'Personal BT', status: 'Sanctioned', phone: '9711002288', amount: '₹12 Lakhs' },
];

export default function LeadsScreen() {
  const [search, setSearch] = useState('');

  const filteredLeads = INITIAL_LEADS.filter(lead => 
    lead.name.toLowerCase().includes(search.toLowerCase()) || 
    lead.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>📂 Master Pipeline (All Leads)</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search lead by name, type, amount..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredLeads}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.leadCard}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.subText}>{item.type} • {item.amount}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.callIcon}>
              <Phone size={18} color="#00E5FF" />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 16, marginTop: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, gap: 8, height: 44 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 13 },
  leadCard: { backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  name: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  subText: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: 'rgba(0, 229, 255, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 6 },
  badgeText: { color: '#00E5FF', fontSize: 10, fontWeight: '600' },
  callIcon: { backgroundColor: '#1E293B', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#00E5FF' }
});