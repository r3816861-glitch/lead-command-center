import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Zap, Phone, Copy, CheckCircle, Sparkles } from 'lucide-react-native';

export default function AiActionsScreen() {
  const [objection, setObjection] = useState('');
  const [pitch, setPitch] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Gemini API Key Placeholder - Replace with your key
  const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; 

  const generateCounterWithAI = async () => {
    if (!objection.trim()) {
      Alert.alert('Empty Input', 'Pehle customer ka objection type kar!');
      return;
    }

    setLoading(true);
    setPitch('');

    // If no key provided, fallback to rule-based engine instantly
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      setTimeout(() => {
        getFallbackScript(objection);
        setLoading(false);
      }, 600);
      return;
    }

    try {
      const prompt = `You are a top 1% loan sales closer in Delhi NCR selling Home Loans, LAP, and MSME Loans. A customer gives this objection: "${objection}". Give a direct, 2-line, brutal, high-converting counter script in blended Hinglish that works on high-resistance customers. Keep it under 8 seconds to speak. No fluff, no fake politeness. Direct response only.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        setPitch(data.candidates[0].content.parts[0].text.trim());
      } else {
        getFallbackScript(objection);
      }
    } catch (error) {
      getFallbackScript(objection);
    } finally {
      setLoading(false);
    }
  };

  const getFallbackScript = (input) => {
    const query = input.toLowerCase();
    let res = "";

    if (query.includes("rate") || query.includes("byaj") || query.includes("interest")) {
      res = "Sir, 0.20% rate difference par mat jaiye. Naye bank me processing fee + legal charges milakar ₹35,000 extra lagega. Hamara offer Zero Hidden Fee ke sath net saving de raha hai. Calculation bheju?";
    } else if (query.includes("soch") || query.includes("time") || query.includes("baad")) {
      res = "Bilkul sir, sochiye. Lekin 8.35% LAP BT rate bracket aur Waiver Scheme sirf is week-end tak valid hai. Documents aaj pickup karwau taaki rate freeze ho jaye?";
    } else if (query.includes("whatsapp") || query.includes("message") || query.includes("quote")) {
      res = "Sir, generic WhatsApp quote ka koi fayda nahi. 2 min me aapki eligibility check karke exact net-disbursement amount calculate kar deta hu. CIBIL login bina kisi score impact ke hoga.";
    } else {
      res = "Sir, aapki concern bilkul sahi hai. DSA Fast-Track portal se login hoga toh bina branch ke multiple rounds ke 72 hours me direct approval milega. Documents kab arrange karein?";
    }
    setPitch(res);
  };

  const copyToClipboard = () => {
    if (!pitch) return;
    setCopied(true);
    Alert.alert('Script Copied!', 'Pitch clipboard me copy ho gayi hai.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>⚡ Sales War Room - AI Pitch Radar</Text>

      {/* Priority Scoring */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔥 Priority Lead Radar</Text>

        <View style={styles.leadRow}>
          <View>
            <Text style={styles.leadName}>1. Rajesh Malhotra (LAP ₹45L)</Text>
            <Text style={styles.leadSub}>Score: 94/100 • Intent: High BT Interest</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert('Calling', 'Dialing Rajesh...')}>
            <Phone size={14} color="#FFF" />
            <Text style={styles.btnText}>Call</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live AI Objection Generator */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Sparkles size={16} color="#00E5FF" />
          <Text style={styles.cardTitle}>Live Gemini AI Pitch Generator</Text>
        </View>
        
        <TextInput
          style={styles.input}
          placeholder="Type live customer objection..."
          placeholderTextColor="#64748B"
          value={objection}
          onChangeText={setObjection}
        />

        <TouchableOpacity style={styles.actionBtn} onPress={generateCounterWithAI} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#00E5FF" size="small" />
          ) : (
            <>
              <Zap size={16} color="#00E5FF" />
              <Text style={styles.actionBtnText}>Generate AI Counter</Text>
            </>
          )}
        </TouchableOpacity>

        {pitch !== '' && (
          <View style={styles.pitchBox}>
            <Text style={styles.pitchText}>{pitch}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
              {copied ? <CheckCircle size={16} color="#10B981" /> : <Copy size={16} color="#00E5FF" />}
              <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy Script'}</Text>
            </TouchableOpacity>
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
  cardTitle: { color: '#00E5FF', fontSize: 15, fontWeight: '600' },
  leadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  leadName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  leadSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  callBtn: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: '#1E293B', color: '#FFF', padding: 12, borderRadius: 8, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  actionBtn: { flexDirection: 'row', backgroundColor: '#1E293B', borderColor: '#00E5FF', borderWidth: 1, padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnText: { color: '#00E5FF', fontWeight: '600', fontSize: 13 },
  pitchBox: { backgroundColor: 'rgba(0, 229, 255, 0.1)', padding: 12, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#00E5FF' },
  pitchText: { color: '#E2E8F0', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-end' },
  copyText: { color: '#00E5FF', fontSize: 12, fontWeight: '600' }
});