import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Linking, Alert } from 'react-native';
import { Search, Phone, MessageSquare } from 'lucide-react-native';
import { loadLeads } from '../lib/storage';

export default function LeadsScreen() {
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    const fetchLeads = async () => {
      const data = await loadLeads();
      setLeads(data);
    };
    fetchLeads();
  }, []);

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(search.toLowerCase()) || 
    lead.type.toLowerCase().includes(search.toLowerCase()) ||
    lead.amount.toLowerCase().includes(search.toLowerCase())
  );

  const openWhatsApp = (phoneNumber, leadName, loanType) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const message = `Hello ${leadName} ji, Bank of India / HSBC DSA Fast-Track Desk se Raj baat kar raha hu. Aapke ${loanType} file ke zero-processing fee aur rate drop clearance par baat karni thi. Kya hum 2 min connect kar sakte hain?`;
    const url = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp Error', 'WhatsApp app installed nahi hai.');
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>📂 Master Pipeline (All Leads)</Text>

      <View style={styles.searchContainer}>
        <Search size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, type (LAP, Home Loan)..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredLeads}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => (
          <View style={styles.leadCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.subText}>{item.type} • {item.amount}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={styles.waIcon} 
                onPress={() => openWhatsApp(item.phone, item.name, item.type)}
              >
                <MessageSquare size={16} color="#10B981" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.callIcon}
                onPress={() => Alert.alert('Dialing', `${item.name} ko call ja raha hai...`)}
              >
                <Phone size={16} color="#00E5FF" />
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 16, marginTop: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, gap: 8, height: 44 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 13 },
  leadCard: { backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  name: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  subText: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: 'rgba(0, 229, 255, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 6 },
  badgeText: { color: '#00E5FF', fontSize: 10, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  waIcon: { backgroundColor: '#1E293B', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#10B981' },
  callIcon: { backgroundColor: '#1E293B', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#00E5FF' }
});