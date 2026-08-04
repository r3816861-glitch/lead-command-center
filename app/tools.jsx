import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Clipboard, Alert } from 'react-native';
import { Zap, Copy, ShieldAlert, Sparkles } from 'lucide-react-native';
import { generateAIPitch } from '../lib/lib/gemini';

export default function ToolsScreen() {
  const [objection, setObjection] = useState('');
  const [pitch, setPitch] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!objection.trim()) {
      Alert.alert('Empty Input', 'Pehle customer ka objection likho (e.g. Rate zyada hai)');
      return;
    }
    setLoading(true);
    const result = await generateAIPitch(objection);
    setPitch(result);
    setLoading(false);
  };

  const copyToClipboard = () => {
    Clipboard.setString(pitch);
    Alert.alert('Copied!', 'Counter pitch script clipboard me copy ho gayi hai.');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ AI Pitch Generator & Radar</Text>
        <Text style={styles.headerSubtitle}>Instant Objection Handling Script</Text>
      </View>

      {/* Input Box */}
      <View style={styles.inputCard}>
        <Text style={styles.label}>Customer Objection / Resitance Point:</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Kisi aur bank me 8.4% mil raha hai..."
          placeholderTextColor="#64748B"
          value={objection}
          onChangeText={setObjection}
          multiline
        />

        <TouchableOpacity 
          style={styles.generateBtn} 
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0A0E1A" />
          ) : (
            <>
              <Sparkles size={18} color="#0A0E1A" />
              <Text style={styles.generateBtnText}>Generate Counter Script</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Script Result Box */}
      {pitch ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>🎯 1% Club High-Conversion Counter</Text>
            <TouchableOpacity onPress={copyToClipboard} style={styles.copyBtn}>
              <Copy size={16} color="#00E5FF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.pitchText}>{pitch}</Text>
        </View>
      ) : null}

      {/* Common Quick Chips */}
      <View style={styles.quickSection}>
        <Text style={styles.quickTitle}>🔥 Fast Objections Quick-Select:</Text>
        <View style={styles.chipWrapper}>
          {['Rate zyada hai', 'Soch ke batate hain', 'Pehle se loan chal raha hai', 'DSA se nahi lena'].map((item) => (
            <TouchableOpacity 
              key={item} 
              style={styles.chip}
              onPress={() => setObjection(item)}
            >
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  header: { marginTop: 10, marginBottom: 16 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#00E5FF', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  inputCard: { backgroundColor: '#1E293B', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 16 },
  label: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  textInput: { backgroundColor: '#0F172A', color: '#FFF', borderRadius: 8, padding: 12, fontSize: 13, minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  generateBtn: { backgroundColor: '#00E5FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 8 },
  generateBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 14 },
  resultCard: { backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#10B981', marginBottom: 16 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultTitle: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  copyBtn: { padding: 4 },
  pitchText: { color: '#FFF', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  quickSection: { marginTop: 8 },
  quickTitle: { color: '#64748B', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  chipWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  chipText: { color: '#94A3B8', fontSize: 11 }
});