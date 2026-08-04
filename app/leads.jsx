import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Linking, Alert } from 'react-native';
import { Search, Filter, Phone, MessageSquare, Briefcase, FileText, CheckCircle2 } from 'lucide-react-native';
import { loadLeads } from '../lib/storage';

export default function LeadsScreen() {
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const data = await loadLeads();
    setLeads(data);
  };

  const filteredLeads = leads.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.phone.includes(searchQuery);
    
    if (selectedFilter === 'ALL') return matchesSearch;
    if (selectedFilter === 'LAP') return matchesSearch && item.type.includes('LAP');
    if (selectedFilter === 'HOME') return matchesSearch && item.type.includes('Home');
    if (selectedFilter === 'MSME') return matchesSearch && item.type.includes('MSME');
    if (selectedFilter === 'HOT') return matchesSearch && (item.status === 'Hot BT' || item.status === 'Doc Pickup');
    
    return matchesSearch;
  });

  const triggerCall = (phone) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => Alert.alert('Error', 'Unable to open dialer'));
  };

  const triggerWhatsApp = (phone, name, type) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const msg = `Hello ${name} ji, Bank of India / HSBC DSA desk se Raj baat kar raha hu. Aapke ${type} ke regarding follow-up call karni thi. Convenient time bataiye?`;
    Linking.openURL(`whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(msg)}`).catch(() => {
      Alert.alert('Error', 'WhatsApp not installed');
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Lead Database & Vault</Text>
        <Text style={styles.headerSubtitle}>Filter by Product & Priority</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Search size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or number..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Pills */}
      <View style={styles.filterRow}>
        {['ALL', 'LAP', 'HOME', 'MSME', 'HOT'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, selectedFilter === filter && styles.activeChip]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.activeFilterText]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtered Lead Stream */}
      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 90 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ color: '#64748B', fontSize: 13 }}>No leads match current filter criteria.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>{item.type} • {item.amount}</Text>
              <Text style={styles.phoneText}>📞 {item.phone}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.actionCol}>
              <TouchableOpacity style={styles.callBtn} onPress={() => triggerCall(item.phone)}>
                <Phone size={16} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.waBtn} onPress={() => triggerWhatsApp(item.phone, item.name, item.type)}>
                <MessageSquare size={16} color="#10B981" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  header: { marginTop: 10, marginBottom: 14 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#00E5FF', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  searchInput: { flex: 1, color: '#FFF', paddingVertical: 10, paddingHorizontal: 8, fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  filterChip: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  activeChip: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  filterText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  activeFilterText: { color: '#0A0E1A' },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cardSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  phoneText: { color: '#64748B', fontSize: 11, marginTop: 4 },
  statusBadge: { backgroundColor: 'rgba(0, 229, 255, 0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 6 },
  statusBadgeText: { color: '#00E5FF', fontSize: 10, fontWeight: '600' },
  actionCol: { gap: 8, justifyContent: 'center' },
  callBtn: { backgroundColor: '#10B981', padding: 10, borderRadius: 20 },
  waBtn: { backgroundColor: '#1E293B', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#10B981' },
  emptyState: { padding: 20, alignItems: 'center' }
});