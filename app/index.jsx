import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Linking, ScrollView } from 'react-native';
import { Phone, MessageSquare, Plus, RefreshCw, CheckCircle, Clock, XCircle, FileCheck, Zap, ShieldAlert, Layers } from 'lucide-react-native';
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

  const totalQueue = leads.length;
  const freshCalls = leads.filter(l => l.status === 'Fresh Lead').length;
  const hotConversions = leads.filter(l => l.status === 'Hot BT' || l.status === 'Doc Pickup').length;

  return (
    <View style={styles.container}>
      {/* 3D Glossy Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerBadge}>
          <Zap size={10} color="#00F0FF" />
          <Text style={styles.headerSub}>RAJ • 1% CLUB COMMAND CENTER</Text>
        </View>
        <View style={styles.headerMain}>
          <Text style={styles.headerTitle}>Sales War Room</Text>
          <TouchableOpacity style={styles.glossRefreshBtn} onPress={refreshData}>
            <RefreshCw size={16} color="#00F0FF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3D Floating Metrics Deck */}
      <View style={styles.metricsRow}>
        <View style={[styles.metric3dCard, styles.cardGlowCyan]}>
          <Text style={styles.metricVal}>{totalQueue}</Text>
          <Text style={styles.metricLbl}>Total Queue</Text>
        </View>
        <View style={[styles.metric3dCard, styles.cardGlowBlue]}>
          <Text style={[styles.metricVal, { color: '#00F0FF' }]}>{freshCalls}</Text>
          <Text style={styles.metricLbl}>Fresh Leads</Text>
        </View>
        <View style={[styles.metric3dCard, styles.cardGlowGreen]}>
          <Text style={[styles.metricVal, { color: '#10B981' }]}>{hotConversions}</Text>
          <Text style={styles.metricLbl}>Hot Deals</Text>
        </View>
      </View>

      {/* Control Panel Bar */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleRow}>
          <Layers size={16} color="#00F0FF" />
          <Text style={styles.sectionTitle}>LIVE QUEUE</Text>
        </View>
        <TouchableOpacity style={styles.primary3dBtn} onPress={() => setAddLeadModal(true)}>
          <Plus size={14} color="#050811" />
          <Text style={styles.primaryBtnTxt}>+ ADD LEAD</Text>
        </TouchableOpacity>
      </View>

      {/* 3D Lead Cards Stream */}
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.lead3dCard}>
            <View style={styles.leadCardContent}>
              <View style={styles.leadMainInfo}>
                <Text style={styles.leadName}>{item.name}</Text>
                <Text style={styles.leadMeta}>{item.type} • <Text style={styles.amountHighlight}>{item.amount}</Text></Text>
              </View>
              <View style={styles.statusPill3d}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.cardActions3d}>
              <TouchableOpacity 
                style={styles.waBtn3d}
                onPress={() => Linking.openURL(`whatsapp://send?phone=91${item.phone.replace(/[^0-9]/g, '')}`)}
              >
                <MessageSquare size={16} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.callBtn3d}
                onPress={() => handleCallAction(item)}
              >
                <Phone size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* 3D Glass Modal: Call Outcome */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal3dCard}>
            <View style={styles.modalHeader}>
              <ShieldAlert size={20} color="#00F0FF" />
              <Text style={styles.modalTitle}>Post-Call Intelligence</Text>
            </View>
            <Text style={styles.modalSub}>Tag response for {selectedLead?.name}:</Text>

            <View style={styles.outcomeGrid}>
              <TouchableOpacity style={[styles.outcome3dBtn, { borderColor: '#10B981' }]} onPress={() => updateOutcome('Doc Pickup')}>
                <FileCheck size={18} color="#10B981" />
                <Text style={styles.outcomeTxt}>Doc Pickup</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.outcome3dBtn, { borderColor: '#00F0FF' }]} onPress={() => updateOutcome('Follow-Up')}>
                <Clock size={18} color="#00F0FF" />
                <Text style={styles.outcomeTxt}>Follow-Up</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.outcome3dBtn, { borderColor: '#F59E0B' }]} onPress={() => updateOutcome('Hot BT')}>
                <CheckCircle size={18} color="#F59E0B" />
                <Text style={styles.outcomeTxt}>Hot BT</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.outcome3dBtn, { borderColor: '#EF4444' }]} onPress={() => updateOutcome('Not Interested')}>
                <XCircle size={18} color="#EF4444" />
                <Text style={styles.outcomeTxt}>Rejected</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input3d}
              placeholder="Key objection / Loan ROI demands..."
              placeholderTextColor="#475569"
              value={note}
              onChangeText={setNote}
            />

            <TouchableOpacity style={styles.closeBtn3d} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnTxt}>DISCARD</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3D Glass Modal: Add Lead */}
      <Modal visible={addLeadModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal3dCard}>
            <Text style={styles.modalTitle}>⚡ Add Prospect</Text>
            
            <TextInput style={styles.input3d} placeholder="Client Full Name" placeholderTextColor="#475569" value={newName} onChangeText={setNewName} />
            <TextInput style={styles.input3d} placeholder="Mobile Number" placeholderTextColor="#475569" keyboardType="phone-pad" value={newPhone} onChangeText={setNewPhone} />
            <TextInput style={styles.input3d} placeholder="Requirement Amount (in Lakhs)" placeholderTextColor="#475569" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} />

            <View style={styles.modalFormActions}>
              <TouchableOpacity style={styles.primary3dBtn} onPress={handleAddLead}>
                <Text style={styles.primaryBtnTxt}>SAVE LEAD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ padding: 12 }} onPress={() => setAddLeadModal(false)}>
                <Text style={{ color: '#64748B', fontWeight: '700' }}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050811', padding: 16 },
  headerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    marginBottom: 16,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  headerSub: { color: '#00F0FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  headerMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  glossRefreshBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)'
  },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metric3dCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  cardGlowCyan: { borderColor: 'rgba(0, 240, 255, 0.2)', shadowColor: '#00F0FF' },
  cardGlowBlue: { borderColor: 'rgba(59, 130, 246, 0.2)', shadowColor: '#3B82F6' },
  cardGlowGreen: { borderColor: 'rgba(16, 185, 129, 0.2)', shadowColor: '#10B981' },
  metricVal: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  metricLbl: { color: '#64748B', fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  primary3dBtn: {
    backgroundColor: '#00F0FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6
  },
  primaryBtnTxt: { color: '#050811', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  lead3dCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5
  },
  leadCardContent: { flex: 1 },
  leadName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  leadMeta: { color: '#64748B', fontSize: 12, marginTop: 2, fontWeight: '600' },
  amountHighlight: { color: '#00F0FF', fontWeight: '700' },
  statusPill3d: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)'
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00F0FF' },
  statusText: { color: '#00F0FF', fontSize: 10, fontWeight: '700' },
  cardActions3d: { flexDirection: 'row', gap: 8 },
  waBtn3d: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  callBtn3d: {
    backgroundColor: '#10B981',
    padding: 10,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 8, 17, 0.85)', justifyContent: 'flex-end' },
  modal3dCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)'
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  modalSub: { color: '#64748B', fontSize: 12, marginBottom: 16 },
  outcomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  outcome3dBtn: {
    width: '48%',
    backgroundColor: '#050811',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  outcomeTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  input3d: {
    backgroundColor: '#050811',
    color: '#FFF',
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12
  },
  modalFormActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  closeBtn3d: { alignItems: 'center', paddingVertical: 10 },
  closeBtnTxt: { color: '#EF4444', fontWeight: '800', fontSize: 12, letterSpacing: 1 }
});