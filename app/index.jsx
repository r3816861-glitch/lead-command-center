import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Linking } from 'react-native';
import { Phone, Plus, RefreshCw, MessageSquare, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react-native';
import { loadLeads, saveLeads } from '../lib/storage';

export default function WarRoomScreen() {
  const [leads, setLeads] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  
  // Add Lead Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('LAP BT');

  useEffect(() => {
    fetchLeadsData();
  }, []);

  const fetchLeadsData = async () => {
    const storedLeads = await loadLeads();
    setLeads(storedLeads);
  };

  const handleAddLead = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Name aur Phone required hain!');
      return;
    }

    const newLead = {
      id: Date.now().toString(),
      name: name.trim(),
      phone: phone.trim(),
      amount: amount.trim() ? `₹${amount.trim()} Lakhs` : '₹25 Lakhs',
      type: type,
      status: 'Fresh Lead',
      notes: 'Direct Cold Call'
    };

    const updatedLeads = [newLead, ...leads];
    setLeads(updatedLeads);
    await saveLeads(updatedLeads);

    setName('');
    setPhone('');
    setAmount('');
    setModalVisible(false);
    Alert.alert('Success', 'Lead Pipeline me add ho gayi!');
  };

  const triggerCallFlow = (lead) => {
    setSelectedLead(lead);
    // Real dialing trigger
    const phoneNumber = lead.phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Dialer Error', 'Direct call dialer open nahi ho saka.');
    });
    // Open Post-Call Outcome Modal
    setCallModalVisible(true);
  };

  const updateLeadStatus = async (newStatus) => {
    if (!selectedLead) return;

    const updatedLeads = leads.map((item) => {
      if (item.id === selectedLead.id) {
        return { ...item, status: newStatus };
      }
      return item;
    });

    setLeads(updatedLeads);
    await saveLeads(updatedLeads);
    setCallModalVisible(false);
    setSelectedLead(null);
    Alert.alert('Status Updated', `Lead status ab "${newStatus}" set ho gaya hai!`);
  };

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>RAJ - SALES WAR ROOM</Text>
          <Text style={styles.headerTitle}>Lead Command Center</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={fetchLeadsData}>
          <RefreshCw size={18} color="#00E5FF" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{leads.length}</Text>
          <Text style={styles.statLabel}>Total Queue</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{leads.filter(l => l.status === 'Fresh Lead').length}</Text>
          <Text style={styles.statLabel}>Fresh Calls</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{leads.filter(l => l.status === 'Doc Pickup' || l.status === 'Hot BT').length}</Text>
          <Text style={styles.statLabel}>Hot Conversions</Text>
        </View>
      </View>

      {/* Queue Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🔥 Active Calling Queue</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={16} color="#0A0E1A" />
          <Text style={styles.addBtnText}>Add Lead</Text>
        </TouchableOpacity>
      </View>

      {/* Lead Stream */}
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => (
          <View style={styles.leadCard}>
            <View style={styles.leadInfo}>
              <Text style={styles.leadName}>{item.name}</Text>
              <Text style={styles.leadMeta}>{item.type} • {item.amount}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={styles.waActionBtn} 
                onPress={() => openWhatsApp(item.phone, item.name, item.type)}
              >
                <MessageSquare size={16} color="#10B981" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.callActionBtn} 
                onPress={() => triggerCallFlow(item)}
              >
                <Phone size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modal 1: Quick Lead Add */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚡ Quick Lead Add</Text>
            <TextInput
              style={styles.input}
              placeholder="Customer Name"
              placeholderTextColor="#64748B"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount in Lakhs (e.g. 45)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddLead}>
                <Text style={styles.saveText}>Save Lead</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Post-Call Outcome Logger */}
      <Modal visible={callModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📞 Post-Call Log Outcome</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>
              {selectedLead ? `Customer: ${selectedLead.name} (${selectedLead.phone})` : 'Select Outcome'}
            </Text>

            <TouchableOpacity style={styles.outcomeOption} onPress={() => updateLeadStatus('Doc Pickup')}>
              <FileText size={18} color="#10B981" />
              <Text style={styles.outcomeText}>Doc Pickup Scheduled</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outcomeOption} onPress={() => updateLeadStatus('Hot BT')}>
              <CheckCircle2 size={18} color="#00E5FF" />
              <Text style={styles.outcomeText}>Hot Interest / Rate Agreed</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outcomeOption} onPress={() => updateLeadStatus('Callback')}>
              <Clock size={18} color="#F59E0B" />
              <Text style={styles.outcomeText}>Callback Later / Busy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outcomeOption} onPress={() => updateLeadStatus('Rejected')}>
              <XCircle size={18} color="#EF4444" />
              <Text style={styles.outcomeText}>Not Interested / Rate Too High</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 10, alignSelf: 'center' }]} onPress={() => setCallModalVisible(false)}>
              <Text style={styles.cancelText}>Skip Outcome</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 16 },
  headerSubtitle: { color: '#00E5FF', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  iconBtn: { backgroundColor: '#1E293B', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statsCard: { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statCol: { alignItems: 'center' },
  statNumber: { color: '#00E5FF', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  addBtn: { backgroundColor: '#00E5FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  addBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 12 },
  leadCard: { backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  leadInfo: { flex: 1 },
  leadName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  leadMeta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: 'rgba(0, 229, 255, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 6 },
  badgeText: { color: '#00E5FF', fontSize: 10, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  waActionBtn: { backgroundColor: '#1E293B', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#10B981' },
  callActionBtn: { backgroundColor: '#10B981', padding: 10, borderRadius: 20 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#0F172A', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#00E5FF' },
  modalTitle: { color: '#00E5FF', fontSize: 18, fontWeight: '700' },
  input: { backgroundColor: '#1E293B', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: { padding: 10 },
  cancelText: { color: '#94A3B8', fontWeight: '600' },
  saveBtn: { backgroundColor: '#00E5FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  saveText: { color: '#0A0E1A', fontWeight: '700' },
  outcomeOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 12, borderRadius: 8, marginBottom: 10, gap: 10, borderWidth: 1, borderColor: '#334155' },
  outcomeText: { color: '#FFF', fontSize: 13, fontWeight: '600' }
});