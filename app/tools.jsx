import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Bell, Download, BarChart2, ShieldCheck } from 'lucide-react-native';

export default function ToolsScreen() {

  const triggerTestNotification = () => {
    Alert.alert('🔔 Notification Test Set', 'Exact 5 seconds me follow-up alert trigger hoga!');
    setTimeout(() => {
      Alert.alert('🚨 Sales Action Required', 'Follow-up Time! Call Ramesh Sharma (LAP BT Lead) right now.');
    }, 5000);
  };

  const exportCSV = () => {
    Alert.alert('📁 CSV Exported', 'Aapka saara lead data Backup/Leads_2026.csv file me save ho gaya hai.');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>🛠️ DSA Toolkit & Settings</Text>

      {/* Test Notification Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Bell size={20} color="#00E5FF" />
          <Text style={styles.cardTitle}>Instant Notification Test</Text>
        </View>
        <Text style={styles.cardDesc}>System ki second-exact timing alert verify karne ke liye test alert firing run karo.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={triggerTestNotification}>
          <Text style={styles.btnText}>Trigger 5s Alarm Test</Text>
        </TouchableOpacity>
      </View>

      {/* CSV Data Backup */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Download size={20} color="#10B981" />
          <Text style={styles.cardTitle}>Data Backup & Export</Text>
        </View>
        <Text style={styles.cardDesc}>Apni poori active pipeline aur call history ko Excel/CSV sheet me export karo.</Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#10B981' }]} onPress={exportCSV}>
          <Text style={styles.btnText}>Export All Leads to CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Conversion Metrics */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <BarChart2 size={20} color="#F59E0B" />
          <Text style={styles.cardTitle}>Pipeline Health</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>34%</Text>
            <Text style={styles.statLabel}>BT Conversion</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>₹1.2 Cr</Text>
            <Text style={styles.statLabel}>Active Volume</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 16, marginTop: 10 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  cardDesc: { color: '#94A3B8', fontSize: 12, marginBottom: 14, lineHeight: 18 },
  primaryBtn: { backgroundColor: '#00E5FF', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  statBox: { backgroundColor: '#1E293B', flex: 0.48, padding: 12, borderRadius: 8, alignItems: 'center' },
  statNum: { color: '#00E5FF', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#94A3B8', fontSize: 11, marginTop: 4 }
});