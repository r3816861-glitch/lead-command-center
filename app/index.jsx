import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';

export default function LeadCommandCenter() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [aiRadarActive, setAiRadarActive] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('Today Calls');

  // Auto-fill state sample
  const [leadForm, setLeadForm] = useState({
    name: 'Rajesh Sharma',
    phone: '9876543210',
    income: '12,00,000 ITR',
    propertyValue: '85,00,000',
    loanType: 'LAP',
    loanAmount: '45,00,000',
  });

  const [objectionInput, setObjectionInput] = useState('');
  const [objectionScript, setObjectionScript] = useState('');

  const autoFillSample = () => {
    setLeadForm({
      name: 'Vikas Malhotra',
      phone: '9811223344',
      income: '18,00,000 ITR',
      propertyValue: '1,20,00,000',
      loanType: 'MSME Business Loan',
      loanAmount: '60,00,000',
    });
  };

  const handleObjectionSolve = () => {
    if (objectionInput.toLowerCase().includes('rate') || objectionInput.toLowerCase().includes('interest')) {
      setObjectionScript('Hook: "Sir, rate 8.5% dikhta hai paper par, hidden processing fees 2% jodoge toh 10.5% padega. Aapko final net payout kitna mil raha hai?"');
    } else {
      setObjectionScript('Hook: "Sir, 30 second me bolta hu, pasand na aaye toh call kaat dena. Loan lena nahi hai, bas aapki baseline limit locked rakhne ke liye bata raha hu."');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Lead Command Center</Text>
          <Text style={styles.headerSubtitle}>NCR High-Conversion Sales Suite</Text>
        </View>
        <TouchableOpacity style={styles.autoFillBtn} onPress={autoFillSample}>
          <Text style={styles.autoFillBtnText}>⚡ Auto-Fill</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.navBar}>
        {['pipeline', 'ai-radar', 'scripts', 'objections', 'voice-audit'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.navTab, activeTab === tab && styles.activeNavTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.navTabText, activeTab === tab && styles.activeNavTabText]}>
              {tab === 'pipeline' ? 'Leads' : tab === 'ai-radar' ? 'AI Radar' : tab === 'scripts' ? 'Scripts' : tab === 'objections' ? 'Objections' : 'Voice Audit'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* TAB 1: PIPELINE & LEADS */}
        {activeTab === 'pipeline' && (
          <View>
            {/* Action Buckets */}
            <Text style={styles.sectionLabel}>Lifecycle Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bucketContainer}>
              {['Today Calls', 'Callback', 'Follow-up', 'Sanctioned', 'Disbursed', 'Hold', 'Lost'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.bucketChip, selectedStatus === status && styles.activeBucketChip]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text style={[styles.bucketText, selectedStatus === status && styles.activeBucketText]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Lead Card & Complete Form */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Active Lead Profile</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.fieldLabel}>Client Name</Text>
                  <TextInput style={styles.input} value={leadForm.name} onChangeText={(t) => setLeadForm({...leadForm, name: t})} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput style={styles.input} value={leadForm.phone} keyboardType="phone-pad" onChangeText={(t) => setLeadForm({...leadForm, phone: t})} />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.fieldLabel}>Annual Income / ITR</Text>
                  <TextInput style={styles.input} value={leadForm.income} onChangeText={(t) => setLeadForm({...leadForm, income: t})} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.fieldLabel}>Property Value</Text>
                  <TextInput style={styles.input} value={leadForm.propertyValue} onChangeText={(t) => setLeadForm({...leadForm, propertyValue: t})} />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.fieldLabel}>Loan Type (LAP/Home/MSME)</Text>
                  <TextInput style={styles.input} value={leadForm.loanType} onChangeText={(t) => setLeadForm({...leadForm, loanType: t})} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.fieldLabel}>Required Loan Amount</Text>
                  <TextInput style={styles.input} value={leadForm.loanAmount} onChangeText={(t) => setLeadForm({...leadForm, loanAmount: t})} />
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.primaryBtn}>
                  <Text style={styles.btnText}>Call Lead Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Save Status</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: AI RADAR & AUTONOMOUS CALLER */}
        {activeTab === 'ai-radar' && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>AI Voice Radar Guardrails</Text>
            <Text style={styles.cardDesc}>
              Controls automated pre-qualification calls. Strictly locked within approved scripts to avoid reputation risk.
            </Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Autonomous Calling Agent</Text>
              <Switch
                value={aiRadarActive}
                onValueChange={(v) => {
                  setAiRadarActive(v);
                  if(v) Alert.alert('AI Guardrails Enabled', 'Agent will only screen cold leads using approved 5-second hooks.');
                }}
                trackColor={{ false: '#D0D5DD', true: '#00D09C' }}
              />
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricTitle}>Queue Status</Text>
              <Text style={styles.metricValue}>1,000 Uncalled Leads Loaded</Text>
              <Text style={styles.metricSub}>Safety Rule: Agent transfers immediately if customer shows high interest or asks complex rate queries.</Text>
            </View>
          </View>
        )}

        {/* TAB 3: PSYCHOLOGICAL SCRIPTS */}
        {activeTab === 'scripts' && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>High-Conversion Cold Call Hooks (5-8s)</Text>
            
            <View style={styles.scriptBox}>
              <Text style={styles.scriptTag}>Hook 1: LAP / Property Owner</Text>
              <Text style={styles.scriptText}>
                "Sir, aapke property par standard rate se 1.5% kam ka sanctioned quota pending hai. Clear karun ya hold pe rakhun?"
              </Text>
            </View>

            <View style={styles.scriptBox}>
              <Text style={styles.scriptTag}>Hook 2: MSME / Business Credit</Text>
              <Text style={styles.scriptText}>
                "Sir, bina collateral ke business turnover pe 50 Lakhs limit pre-approve hui hai. Filhal requirement hai ya next quarter dekhen?"
              </Text>
            </View>
          </View>
        )}

        {/* TAB 4: OBJECTION HANDLER */}
        {activeTab === 'objections' && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Real-Time Objection Neutralizer</Text>
            <TextInput
              style={styles.input}
              placeholder="Type customer objection (e.g. Rate high hai / Interest low hai)"
              placeholderTextColor="#98A2B3"
              value={objectionInput}
              onChangeText={setObjectionInput}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleObjectionSolve}>
              <Text style={styles.btnText}>Generate Lethal Counter</Text>
            </TouchableOpacity>

            {objectionScript ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>{objectionScript}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* TAB 5: VOICE & PITCH AUDITOR */}
        {activeTab === 'voice-audit' && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Live Pitch & Tone Auditor</Text>
            <Text style={styles.cardDesc}>
              Upload or record daily calls to analyze pace, confidence, objection handling, and pitch conversion score.
            </Text>

            <TouchableOpacity style={styles.recordBtn}>
              <Text style={styles.btnText}>🎙️ Record / Analyze Call Session</Text>
            </TouchableOpacity>

            <View style={styles.auditCard}>
              <Text style={styles.auditTitle}>Daily Pitch Feedback</Text>
              <Text style={styles.auditItem}>• Pace: 140 WPM (Optimal)</Text>
              <Text style={styles.auditItem}>• Energy Level: High - Assertive</Text>
              <Text style={styles.auditItem}>• Improvement: Reduce pause duration after customer says "Send on WhatsApp". Use instant rebuttal hook.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#667085',
  },
  autoFillBtn: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  autoFillBtnText: {
    color: '#00D09C',
    fontWeight: '600',
    fontSize: 12,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  navTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeNavTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00D09C',
  },
  navTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#667085',
  },
  activeNavTabText: {
    color: '#00D09C',
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 8,
  },
  bucketContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  bucketChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  activeBucketChip: {
    backgroundColor: '#00D09C',
    borderColor: '#00D09C',
  },
  bucketText: {
    fontSize: 12,
    color: '#344054',
  },
  activeBucketText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#667085',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputHalf: {
    width: '48%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#101828',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: '#00D09C',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  secondaryBtn: {
    backgroundColor: '#F2F4F7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    marginLeft: 6,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryBtnText: {
    color: '#344054',
    fontWeight: '600',
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
  },
  metricBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  metricTitle: {
    fontSize: 12,
    color: '#667085',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101828',
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 11,
    color: '#475467',
  },
  scriptBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#00D09C',
  },
  scriptTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00D09C',
    marginBottom: 4,
  },
  scriptText: {
    fontSize: 13,
    color: '#101828',
    lineHeight: 18,
  },
  resultBox: {
    backgroundColor: '#E6F4EA',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  resultText: {
    fontSize: 13,
    color: '#0F5132',
    fontWeight: '500',
  },
  recordBtn: {
    backgroundColor: '#101828',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  auditCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  auditTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 6,
  },
  auditItem: {
    fontSize: 12,
    color: '#344054',
    marginBottom: 4,
  },
});