import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { Copy, BookOpen } from 'lucide-react-native';

const VAULT_SCRIPTS = [
  { id: '1', tag: 'Rate Objection', objection: 'Dusra bank 8.2% de raha hai', script: 'Sir, 8.2% teaser rate hai ya final ROI? Processing fee waived off ke saath hamara net IRR check kijiye, ₹15,000 ka direct saving hai.' },
  { id: '2', tag: 'Indecision', objection: 'Soch kar batata hu', script: 'Bilkul sir. Sochne se pehle eligibility sanction letter ready kar lete hain, zero cost setup hai. Processing initiate karein?' },
  { id: '3', tag: 'Agent Hesitation', objection: 'Direct bank se karunga', script: 'Direct branch me 3 alag desk par file ghumti hai. DSA desk multiple banks me parallel login karke 48 hrs me final approval nikalta hai.' },
  { id: '4', tag: 'Documentation', objection: 'ITR complete nahi hai', script: 'MSME scheme me turnover base aur banking surrogate policy par approval mil jayega. ITR ka issue nahi aayega.' }
];

export default function ScriptsScreen() {
  const [selectedTag, setSelectedTag] = useState('ALL');

  const copyScript = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Script clipboard me save ho gayi.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 1% Club Scripts Vault</Text>
        <Text style={styles.headerSubtitle}>High-Conversion Calling Scripts</Text>
      </View>

      <FlatList
        data={VAULT_SCRIPTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.tag}>{item.tag}</Text>
              <TouchableOpacity onPress={() => copyScript(item.script)}>
                <Copy size={16} color="#00E5FF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.objectionText}>"{item.objection}"</Text>
            <Text style={styles.scriptText}>{item.script}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  header: { marginTop: 10, marginBottom: 16 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#00E5FF', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  card: { backgroundColor: '#1E293B', padding: 14, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  tag: { color: '#10B981', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  objectionText: { color: '#94A3B8', fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  scriptText: { color: '#FFF', fontSize: 13, lineHeight: 18, fontWeight: '500' }
});