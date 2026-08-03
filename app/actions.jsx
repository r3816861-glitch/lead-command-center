import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Zap, Phone, Shield, Copy } from 'lucide-react-native';

export default function AiActionsScreen() {
  const [objection, setObjection] = useState('');
  const [pitch, setPitch] = useState('');

  const generateCounter = () => {
    if (!objection.trim()) return;
    
    // Core objection mapping for financial loans
    const input = objection.toLowerCase();
    let res = "";

    if (input.includes("rate") || input.includes("byaj") || input.includes("interest")) {
      res = "Sir, rate difference 0.25% ho sakta hai, lekin hamara Zero Processing Fee aur No Hidden Foreclosure offer cash flow me aapko net ₹45,000 save karke dega. Exact calculation dikhau?";
    } else if (input.includes("soch") || input.includes("time") || input.includes("baad")) {
      res = "Bilkul sir, sochne ka time lijiye. Lekin ye 8.35% LAP BT rate bracket sirf is weekend tak valid hai. Doc pickup aaj schedule karein taaki rate lock ho jaye?";
    } else {
      res = "Sir, aapki concern genuine hai. Par Fast-Track DSA portal se login hoga toh 72 hours me direct bank disbursement milega, koi multiple bank chakkarmukh nahi. File processing start karein?";
    }

    setPitch(res);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>⚡ AI Lead Radar & Pitch Engine</Text>

      {/* AI Lead Scoring */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔥 Priority Lead Scoring</Text>

        <View style={styles.leadRow}>
          <View>
            <Text style={styles.leadName}>1. Rajesh Malhotra (LAP ₹45L)</Text>
            <Text style={styles.leadSub}>Score: 94/100 • Intent: High BT Interest</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert('Calling', 'Dialing Rajesh Malhotra...')}>
            <Phone size={14} color="#FFF" />
            <Text style={styles.btnText}>Call</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.leadRow}>
          <View>
            <Text style={styles.leadName}>2. Vikram Mehta (Home Loan ₹80L)</Text>
            <Text style={styles.leadSub}>Score: 88/100 • Intent: Rate Comparison</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert('Calling', 'Dialing Vikram Mehta...')}>
            <Phone size={14} color="#FFF" />
            <Text style={styles.btnText}>Call</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pitch Generator */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛡️ Instant Objection Counter</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Type objection (e.g., Rate zyada hai, Soch ke bataunga)..."
          placeholderTextColor="#64748B"
          value={objection}
          onChangeText={setObjection}
        />

        <TouchableOpacity style={styles.actionBtn} onPress={generateCounter}>
          <Zap size={16} color="#00E5FF" />
          <Text style={styles.actionBtnText}>Generate Counter Pitch</Text>
        </TouchableOpacity>

        {pitch !== '' && (
          <View style={styles.pitchBox}>
            <Text style={styles.pitchText}>{pitch}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 16, marginTop: 10 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardTitle: { color: '#00E5FF', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  leadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  leadName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  leadSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  callBtn: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: '#1E293B', color: '#FFF', padding: 12, borderRadius: 8, marginTop: 4, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  actionBtn: { flexDirection: 'row', backgroundColor: '#1E293B', borderColor: '#00E5FF', borderWidth: 1, padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnText: { color: '#00E5FF', fontWeight: '600', fontSize: 13 },
  pitchBox: { backgroundColor: 'rgba(0, 229, 255, 0.1)', padding: 12, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#00E5FF' },
  pitchText: { color: '#E2E8F0', fontSize: 13, lineHeight: 18 }
});