import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Linking } from 'react-native';
import { Phone, MessageSquare, Plus, RefreshCw, CheckCircle, Clock, XCircle, FileCheck } from 'lucide-react-native';
import { loadLeads, saveLeads } from '../lib/storage';
import { scheduleLeadReminder } from '../lib/notifications';
import { sendAutomatedWhatsApp } from '../lib/whatsapp';

export default function WarRoomScreen() {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [addLeadModal, setAddLeadModal] = useState(false);
  const [note, setNote] = useState('');

  // New Lead Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState('LAP BT');
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    const data = await loadLeads();
    setLeads(data);
  };

  const handleCallAction = (lead) => {
    setSelectedLead(lead);
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => Alert.alert('Error', 'Dialer open nahi ho saka.'));
    setModalVisible(true);
  };

  const updateOutcome = async (newStatus) => {
    const updated = leads.map((item) => {
      if (item.id === selectedLead.id) {
        return { ...item, status: newStatus, notes: note || item.notes };
      }
      return item;
    });

    await saveLeads(updated);
    setLeads(updated);
    setModalVisible(false);
    setNote('');

    // Trigger Auto-WhatsApp Template based on outcome
    if (newStatus === 'Doc Pickup') {
      sendAutomatedWhatsApp(selectedLead.phone, selectedLead.name, selectedLead.type, 'DOC_PICKUP');
    } else if (newStatus === 'Hot BT') {
      sendAutomatedWhatsApp(selectedLead.phone, selectedLead.name, selectedLead.type, 'HOT_BT');
    } else if (newStatus === 'Follow-Up') {
      scheduleLeadReminder(selectedLead.name, selectedLead.type, 30);
    }
  };

  const handleAddLead = async () => {
    if (!newName || !newPhone) {
      Alert.alert('Incomplete Data', 'Name aur Phone number zaroori hai.');
      return;
    }

    const newEntry = {
      id: Date.now().toString(),
      name: newName,
      type: newType,
      amount: newAmount ? `₹${newAmount} Lakhs` : '₹25 Lakhs',
      phone: newPhone,
      status: 'Fresh Lead'
    };

    const updatedList = [newEntry, ...leads];
    await saveLeads(updatedList);
    setLeads(updatedList);
    setAddLeadModal(false);
    setNewName('');
    setNewPhone('');
    setNewAmount('');
  };

  // Live Metrics Calculation
  const totalQueue = leads.length;
  const freshCalls = leads.filter(l => l.status === 'Fresh Lead').length;
  const hotConversions = leads.filter(l => l.status === 'Hot BT' || l.status === 'Doc Pickup').length;

  return (
    <View style={styles.container}>
      {/* War Room Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>RAJ • SALES WAR ROOM</Text>
          <Text style={styles.headerTitle}>Lead Command Center</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshData}>
          <RefreshCw size={18} color="#00E5FF" />
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>{totalQueue}</Text>
          <Text style={styles.metricLbl}>Total Queue</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricVal, { color: '#00E5FF' }]}>{freshCalls}</Text>
          <Text style={styles.metricLbl}>Fresh Calls</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricVal, { color: '#10B981' }]}>{hotConversions}</Text>
          <Text style={styles.metricLbl}>Hot Conversions</Text>
        </View>
      </View>

      {/* Section Header */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>🔥 Active Calling Queue</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddLeadModal(true)}>
          <Plus size={14} color="#0A0E1A" />
          <Text style={styles.addBtnText}>Add Lead</Text>
        </TouchableOpacity>
      </View>

      {/* Queue List */}
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => (
          <View style={styles.leadCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.leadName}>{item.name}</Text>
              <Text style={styles.leadDetails}>{item.type} • {item.amount}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity 
                style={styles.waIcon}
                onPress={() => Linking.openURL(`whatsapp://send?phone=91${item.phone.replace(/[^0-9]/g, '')}`)}
              >
                <MessageSquare size={16} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.callIcon}
                onPress={() => handleCallAction(item)}
              >
                <Phone size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Call Outcome Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📞 Call Outcome: {selectedLead?.name}</Text>
            <Text style={styles.modalSub}>Select post-call status to update pipeline:</Text>

            <View style={styles.outcomeGrid}>
              <TouchableOpacity style={styles.outcomeBtn} onPress={() => updateOutcome('Doc Pickup')}>
                <FileCheck size={18} color="#10B981" />
                <Text style={styles.outcomeTxt}>Doc Pickup</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.outcomeBtn} onPress={() => updateOutcome('Follow-Up')}>
                <Clock size={18} color="#00E5FF" />
                <Text style={styles.outcomeTxt}>Follow-Up</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.outcomeBtn} onPress={() => updateOutcome('Hot BT')}>
                <CheckCircle size={18} color="#F59E0B" />
                <Text style={styles.outcomeTxt}>Hot BT</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.outcomeBtn} onPress={() => updateOutcome('Not Interested')}>
                <XCircle size={18} color="#EF4444" />
                <Text style={styles.outcomeTxt}>Rejected</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder="Add call notes (e.g. 8.5% rate demand)..."
              placeholderTextColor="#64748B"
              value={note}
              onChangeText={setNote}
            />

            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Lead Modal */}
      <Modal visible={addLeadModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>➕ Add New Lead</Text>
            
            <TextInput style={styles.formInput} placeholder="Client Name" placeholderTextColor="#64748B" value={newName} onChangeText={setNewName} />
            <TextInput style={styles.formInput} placeholder="Phone Number" placeholderTextColor="#64748B" keyboardType="phone-pad" value={newPhone} onChangeText={setNewPhone} />
            <TextInput style={styles.formInput} placeholder="Loan Amount (e.g. 45)" placeholderTextColor="#64748B" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddLead}>
                <Text style={styles.saveBtnTxt}>Save to Queue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelFormBtn} onPress={() => setAddLeadModal(false)}>
                <Text style={{ color: '#94A3B8' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  header: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerSub: { color: '#00E5FF', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  refreshBtn: { backgroundColor: '#1E293B', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  metricVal: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  metricLbl: { color: '#64748B', fontSize: 10, fontWeight: '600', marginTop: 2 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  addBtn: { backgroundColor: '#00E5FF', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: '#0A0E1A', fontSize: 11, fontWeight: '700' },
  leadCard: { backgroundColor: '#1E293B', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  leadName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  leadDetails: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  statusBadge: { backgroundColor: 'rgba(0, 229, 255, 0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 6 },
  statusText: { color: '#00E5FF', fontSize: 10, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8 },
  waIcon: { backgroundColor: '#0F172A', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#10B981' },
  callIcon: { backgroundColor: '#10B981', padding: 10, borderRadius: 20 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E293B', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modalSub: { color: '#94A3B8', fontSize: 12, marginTop: 2, marginBottom: 16 },
  outcomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  outcomeBtn: { width: '48%', backgroundColor: '#0F172A', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 8 },
  outcomeTxt: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  noteInput: { backgroundColor: '#0F172A', color: '#FFF', borderRadius: 8, padding: 10, fontSize: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 16 },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeBtnTxt: { color: '#EF4444', fontWeight: '600', fontSize: 13 },
  formInput: { backgroundColor: '#0F172A', color: '#FFF', borderRadius: 8, padding: 12, fontSize: 13, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  saveBtn: { backgroundColor: '#00E5FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  saveBtnTxt: { color: '#0A0E1A', fontWeight: '700', fontSize: 13 },
  cancelFormBtn: { padding: 10 }
});