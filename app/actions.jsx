import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Linking, ActivityIndicator, Platform,
} from "react-native";
import { Zap, Phone, Shield, Sparkles, ChevronRight, TrendingUp } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  loadLeads, saveLeads,
} from "../lib/storage";
import {
  buyingIntentScore, intentBand, intentColor, focusRadarPriority,
  productCode, formatAmountShort, initials, urgency, U_STYLE,
} from "../lib/utils";
import { DEFAULT_SETTINGS, GEMINI_ENDPOINT } from "../lib/constants";

const C = {
  bg: "#0A0E1A",
  card: "#131A2B",
  card2: "#1A2236",
  border: "#2A354D",
  borderGlow: "rgba(99,102,241,0.35)",
  inputBg: "#0D1320",
  indigo: "#6366F1",
  cyan: "#06B6D4",
  green: "#10B981",
  red: "#EF4444",
  amber: "#FBBF24",
  text: "#F1F5F9",
  textDim: "#94A3B8",
  textMute: "#64748B",
};

export default function AiActionsScreen({ leads: propLeads }) {
  const insets = useSafeAreaInsets();
  const [internalLeads, setInternalLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [objection, setObjection] = useState("");
  const [counter, setCounter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const leads = propLeads || internalLeads;

  React.useEffect(() => {
    if (propLeads) { setLoaded(true); return; }
    (async () => {
      try {
        const l = await loadLeads();
        setInternalLeads(l);
      } catch (e) {
        // empty state is fine
      } finally {
        setLoaded(true);
      }
    })();
  }, [propLeads]);

  const topLeads = useMemo(() => {
    return leads
      .filter((l) => !["lost", "disbursed", "converted"].includes(l.status))
      .map((l) => ({ ...l, _score: buyingIntentScore(l), _priority: focusRadarPriority(l) }))
      .sort((a, b) => b._priority - a._priority || b._score - a._score)
      .slice(0, 3);
  }, [leads]);

  const callNow = useCallback((phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  }, []);

  const generateCounter = useCallback(async () => {
    if (!objection.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    setCounter("");
    try {
      let apiKey = "";
      try {
        const { loadSettings } = await import("../lib/storage");
        const s = await loadSettings(DEFAULT_SETTINGS);
        apiKey = s.geminiApiKey || "";
      } catch (e) {}

      const prompt =
        "You are a senior Indian loan advisor (DSA) sales coach. A customer raised this objection during a cold call. Generate a powerful 2-3 sentence counter in Hinglish (Hindi+English mix, roman script) that flips the objection into a reason to proceed. Be direct, practical, and field-ready.\n\nObjection: " +
        objection.trim() +
        "\n\nRespond with ONLY the counter script, no labels, no numbering.";

      let text = "";
      if (apiKey) {
        const res = await fetch(GEMINI_ENDPOINT + apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 250 },
          }),
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        // Smart fallback counter
        text = fallbackCounter(objection.trim());
      }
      if (!text) throw new Error("Empty response");
      setCounter(text.trim());
    } catch (e) {
      setCounter(fallbackCounter(objection.trim()));
    } finally {
      setGenerating(false);
    }
  }, [objection, generating]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Sparkles color={C.cyan} size={22} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>AI Actions</Text>
            <Text style={styles.headerSubtitle}>Scoring & Pitch Engine</Text>
          </View>
        </View>

        {/* Section 1: AI Lead Scoring */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Zap color={C.indigo} size={16} strokeWidth={2.5} />
          </View>
          <Text style={styles.sectionTitle}>AI LEAD SCORING</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{topLeads.length} HOT</Text>
          </View>
        </View>

        <Text style={styles.sectionDesc}>
          Top 3 high-priority leads ranked by buying intent and deal value. Call them now.
        </Text>

        {!loaded ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={C.indigo} size="small" />
          </View>
        ) : topLeads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Zap color={C.textMute} size={28} strokeWidth={1.5} />
            <Text style={styles.emptyText}>No active leads to score yet.</Text>
            <Text style={styles.emptySubtext}>Add leads from the War Room to see AI scoring.</Text>
          </View>
        ) : (
          <View style={styles.scoringList}>
            {topLeads.map((lead, idx) => {
              const band = intentBand(lead._score);
              const u = urgency(lead);
              const uStyle = U_STYLE[u] || U_STYLE.none;
              return (
                <View key={lead.id} style={styles.leadCard}>
                  {/* Rank ribbon */}
                  <View style={[styles.rankRibbon, { backgroundColor: idx === 0 ? C.red : idx === 1 ? C.amber : C.cyan }]}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  </View>

                  <View style={styles.leadBody}>
                    <View style={styles.leadTopRow}>
                      <View style={styles.leadAvatar}>
                        <Text style={styles.leadAvatarText}>{initials(lead.name || "?")}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.leadName} numberOfLines={1}>{lead.name || "Unknown"}</Text>
                        <Text style={styles.leadProduct}>{productCode(lead.product)} {lead.bank ? "· " + lead.bank : ""}</Text>
                      </View>
                      <View style={[styles.scoreBadge, { borderColor: band.color }]}>
                        <Text style={[styles.scoreNum, { color: band.color }]}>{lead._score}</Text>
                        <Text style={[styles.scoreLabel, { color: band.color }]}>{band.label}</Text>
                      </View>
                    </View>

                    <View style={styles.leadMetaRow}>
                      {lead.loanAmount ? (
                        <View style={styles.metaChip}>
                          <TrendingUp color={C.cyan} size={11} strokeWidth={2} />
                          <Text style={styles.metaText}>{formatAmountShort(lead.loanAmount)}</Text>
                        </View>
                      ) : null}
                      {uStyle.label ? (
                        <View style={[styles.metaChip, { borderColor: uStyle.color }]}>
                          <Text style={[styles.metaUrgency, { color: uStyle.color }]}>{uStyle.label}</Text>
                        </View>
                      ) : null}
                      {lead.cibilScore ? (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaText}>CIBIL {lead.cibilScore}</Text>
                        </View>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callNow(lead.phone)}
                      activeOpacity={0.85}
                    >
                      <Phone color="#FFF" size={15} strokeWidth={2.5} />
                      <Text style={styles.callBtnText}>Call Now</Text>
                      {lead.phone ? <Text style={styles.callBtnPhone}>{lead.phone}</Text> : null}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Section 2: Pitch Generator */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <View style={[styles.sectionIconWrap, { backgroundColor: "rgba(6,182,212,0.12)" }]}>
            <Shield color={C.cyan} size={16} strokeWidth={2.5} />
          </View>
          <Text style={styles.sectionTitle}>PITCH GENERATOR</Text>
        </View>

        <Text style={styles.sectionDesc}>
          Type the customer's objection and generate a powerful counter-script in Hinglish.
        </Text>

        <View style={styles.pitchCard}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.objectionInput}
              placeholder="e.g. Rate zyada hai, sochna hai, dusre bank se le raha hoon..."
              placeholderTextColor={C.textMute}
              value={objection}
              onChangeText={setObjection}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.generateBtn, (!objection.trim() || generating) && styles.generateBtnDisabled]}
            onPress={generateCounter}
            disabled={!objection.trim() || generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.generateBtnText}>Generating...</Text>
              </>
            ) : (
              <>
                <Zap color="#FFF" size={16} strokeWidth={2.5} />
                <Text style={styles.generateBtnText}>Generate Counter</Text>
              </>
            )}
          </TouchableOpacity>

          {genError ? (
            <Text style={styles.genErrorText}>{genError}</Text>
          ) : null}

          {counter ? (
            <View style={styles.counterResult}>
              <View style={styles.counterHeader}>
                <Shield color={C.green} size={14} strokeWidth={2.5} />
                <Text style={styles.counterLabel}>COUNTER SCRIPT</Text>
              </View>
              <Text style={styles.counterText}>{counter}</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => {
                  if (Platform.OS !== "web" && require("expo-clipboard").setStringAsync) {
                    require("expo-clipboard").setStringAsync(counter);
                  } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(counter).catch(() => {});
                  }
                }}
                activeOpacity={0.7}
              >
                <ChevronRight color={C.cyan} size={13} strokeWidth={2.5} />
                <Text style={styles.copyBtnText}>Copy Script</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.footerNote}>
          <Sparkles color={C.textMute} size={12} strokeWidth={1.5} />
          <Text style={styles.footerText}>
            AI scoring uses rule-based buying intent — transparent, not a black box.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function fallbackCounter(obj) {
  const o = obj.toLowerCase();
  if (/rate|interest|emi|bhaari|zyada|expensive/.test(o)) {
    return "Sirf rate mat dekhiye — total processing cost aur top-up flexibility dekhiye. Main aapko dono banks ka exact comparison bana ke deta hoon, jisme aapki EMI kam hogi aur upar se extra funds bhi milenge.";
  }
  if (/soch|busy|abhi nahi|time|later/.test(o)) {
    return "Bilkul soch lijiye — main sirf documents ke basis pe ek pre-approval nikaal ke rakhta hoon, koi commitment nahi hai. Jab aap ready honge, process 2 din mein shuru ho jayega.";
  }
  if (/trust|bharosa|fraud|safe/.test(o)) {
    return "Main authorized DSA hoon — loan seedha bank se sanction hota hai, aap branch mein bhi verify kar sakte hain. Aapka paisa aur documents sab bank ke system mein safe rahenge.";
  }
  if (/document|paper|jhajhat|chahiye/.test(o)) {
    return "Sirf 4-5 documents chahiye, aur main khud aake collect kar lunga. Aapko bank jaane ki zaroorat nahi — end-to-end main handle karta hoon.";
  }
  if (/family|puchna|wife|parents|ghar/.test(o)) {
    return "Bilkul sahi approach hai. Main summary WhatsApp pe bhej deta hoon, ghar walo ko dikhana easy ho jayega. Kal tak aapko pre-approved offer bhi ready rahega.";
  }
  return "I understand, aur main aapki situation respect karta hoon. Meri baat sirf 30 second ki hai — main aapko ek option dikhata hoon jo aapki EMI kam kar sakta hai. Agar pasand na aaye toh no problem, lekin ek baar dekh lijiye.";
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(6,182,212,0.12)",
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: C.textDim,
    marginTop: 2,
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 1.5,
    flex: 1,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  sectionBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.red,
    letterSpacing: 0.5,
  },
  sectionDesc: {
    fontSize: 12,
    color: C.textDim,
    lineHeight: 18,
    marginBottom: 14,
    marginLeft: 36,
  },

  // Empty / loading
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textDim,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: C.textMute,
  },

  // Lead scoring cards
  scoringList: {
    gap: 12,
  },
  leadCard: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  rankRibbon: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  rankText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFF",
  },
  leadBody: {
    flex: 1,
    padding: 12,
  },
  leadTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  leadAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.15)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  leadAvatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.indigo,
  },
  leadName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  leadProduct: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 2,
  },
  scoreBadge: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
  },
  scoreNum: {
    fontSize: 18,
    fontWeight: "900",
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  leadMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(6,182,212,0.08)",
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.2)",
  },
  metaText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.cyan,
  },
  metaUrgency: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.indigo,
    shadowColor: C.indigo,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  callBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  callBtnPhone: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginLeft: 4,
  },

  // Pitch generator
  pitchCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.inputBg,
    overflow: "hidden",
  },
  objectionInput: {
    minHeight: 80,
    padding: 14,
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.cyan,
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateBtnDisabled: {
    opacity: 0.4,
  },
  generateBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  genErrorText: {
    fontSize: 12,
    color: C.red,
    marginTop: 10,
    textAlign: "center",
  },

  // Counter result
  counterResult: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    backgroundColor: "rgba(16,185,129,0.06)",
    padding: 14,
  },
  counterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  counterLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.green,
    letterSpacing: 1.5,
  },
  counterText: {
    fontSize: 14,
    color: C.text,
    lineHeight: 21,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.cyan,
  },

  // Footer
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  footerText: {
    fontSize: 11,
    color: C.textMute,
    flex: 1,
  },
});
