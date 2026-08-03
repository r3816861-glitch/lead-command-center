import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { BookOpen, Copy, CheckCircle, ShieldAlert } from 'lucide-react-native';

const OBJECTION_VAULT = [
  {
    id: '1',
    category: 'Interest Rate',
    tag: 'Rate High',
    objection: 'Dusra bank 8.20% de raha hai, tumhara rate high hai.',
    counter: 'Sir, 0.20% rate difference par mat jaiye. Naye bank me processing fee + legal charges milakar ₹35,000 extra lagega. Hamara offer Zero Hidden Fee ke sath net saving de raha hai.'
  },
  {
    id: '2',
    category: 'Stalling',
    tag: 'Soch Ke Bataunga',
    objection: 'Mai thoda soch kar batata hu.',
    counter: 'Bilkul sir, sochiye. Lekin 8.35% LAP BT rate bracket aur Waiver Scheme sirf is weekend tak valid hai. Documents aaj pickup karwau taaki rate freeze ho jaye?'
  },
  {
    id: '3',
    category: 'WhatsApp Request',
    tag: 'Quote On WhatsApp',
    objection: 'Pehle mujhe WhatsApp par details bhej do.',
    counter: 'Sir, generic WhatsApp quote ka koi fayda nahi. 2 min me aapki eligibility check karke exact net-disbursement amount calculate kar deta hu. CIBIL login bina kisi score impact ke hoga.'
  },
  {
    id: '4',
    category: 'Fees & Charges',
    tag: 'Processing Fee',
    objection: 'Processing fee nahi dunga bilkul bhi.',
    counter: 'Sir, hum upfront ₹1 bhi nahi lete. Pure file processing me processing fee waive off hai, sirf disbursement ke baad bank-to-bank official deduction hota hai.'
  },
  {
    id: '5',
    category: 'DSAs & Agents',
    tag: 'Direct Bank Call',
    objection: 'Mai direct bank se hi baat karunga, DSA se nahi.',
    counter: 'Sir, direct bank branch me aapko multiple chakkar kaatne padenge. DSA Fast-Track portal se login hoga toh 72 hours me direct approval milega bina branch gaye.'
  }
];

export default function VaultScreen() {
  const [copiedId, setCopiedId] = useState(null);

  const copyScript = (id, text) => {
    setCopiedId(id);
    Alert.alert('Script Copied', 'Pitch clipboard me copy ho gayi hai!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>📖 40-Objection Pitch Vault</Text>
      <Text style={styles.subTitle}>Delhi/NCR Financial Sales - Lethal Psychological Counters</Text>

      {OBJECTION_VAULT.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{item.tag}</Text>
            </View>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>

          <Text style={styles.objectionText}>"{item.objection}"</Text>
          <View style={styles.divider} />
          <Text style={styles.counterText}>{item.counter}</Text>

          <TouchableOpacity 
            style={styles.copyBtn} 
            onPress={() => copyScript(item.id, item.counter)}
          >
            {copiedId === item.id ? (
              <CheckCircle size={16} color="#10B981" />
            ) : (
              <Copy size={16} color="#00E5FF" />
            )}
            <Text style={styles.copyBtnText}>
              {copiedId === item.id ? 'Copied' : 'Copy Pitch'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 10 },
  subTitle: { fontSize: 12, color: '#94A3B8', marginBottom: 16, marginTop: 4 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tagBadge: { backgroundColor: 'rgba(0, 229, 255, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tagText: { color: '#00E5FF', fontSize: 11, fontWeight: '700' },
  categoryText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  objectionText: { color: '#EF4444', fontSize: 13, fontWeight: '600', fontStyle: 'italic', marginBottom: 8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },
  counterText: { color: '#E2E8F0', fontSize: 13, lineHeight: 18 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-end' },
  copyBtnText: { color: '#00E5FF', fontSize: 12, fontWeight: '600' }
});