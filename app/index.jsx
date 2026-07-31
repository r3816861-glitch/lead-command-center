import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Linking,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, SafeAreaView,
  Pressable, FlatList, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Clipboard from "expo-clipboard";

import {
  STATUS_ORDER, STATUS, INTEREST, PRODUCTS, BANKS, EMPLOYMENT,
  PROPERTY_TYPES, TURNOVER_BANDS, BANKING_TYPES, RENTAL_INCOME_TYPES,
  COMPANY_CATEGORIES, ENTITY_CONSTITUTION, NATURE_OF_BUSINESS,
  ADDITIONAL_INCOME_SOURCES, HOLD_LOST_REASONS, TIME_TAGS, OUTCOME_TAGS,
  OBJECTIONS, DEFAULT_SETTINGS, getDocumentChecklist, recommendCallTime,
} from "../lib/constants";
import {
  uid, productCode, todayISO, addDays, isToday, fmtDateTime, urgency,
  U_STYLE, initials, toTitleCase, amtNum, toRupees, formatINR,
  buyingIntentScore, intentBand, intentColor, quickParseDeterministic,
  whatsappTemplate, smsTemplate, leadsToCSV, emptyForm,
  buildGeminiPrompt, callGemini, parseCopilotResponse,
} from "../lib/utils";
import { loadLeads, saveLeads, loadSettings, saveSettings } from "../lib/storage";

const { width: SCREEN_W } = Dimensions.get("window");

// ============================== THEME ==============================
const C = {
  bg: "#0B0F19",
  card: "#151C2C",
  card2: "#1A2236",
  border: "#2A354D",
  indigo: "#6366F1",
  cyan: "#06B6D4",
  won: "#10B981",
  alert: "#EF4444",
  warn: "#FBBF24",
  text: "#F1F5F9",
  textDim: "#94A3B8",
  textMute: "#64748B",
};

// ============================== NOTIFICATIONS ==============================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureNotificationsPermission() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    return final === "granted";
  } catch (e) {
    return false;
  }
}

async function scheduleLeadNotification(lead) {
  if (!lead.nextCallDate) return;
  const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
  if (!dt) return;
  const triggerMs = dt.getTime() - Date.now();
  if (triggerMs < 5000) return; // skip past/imminent
  const trigger = new Date(Date.now() + triggerMs);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Call Reminder",
        body: `${lead.name} — ${productCode(lead.product)} · ${lead.phone}`,
        data: { leadId: lead.id },
        sound: true,
      },
      trigger,
    });
  } catch (e) {
    // best-effort
  }
}

async function cancelAllScheduled() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (e) {
    // best-effort
  }
}

async function rescheduleAllNotifications(leads) {
  await cancelAllScheduled();
  for (const lead of leads) {
    if (!["converted", "lost"].includes(lead.status)) {
      await scheduleLeadNotification(lead);
    }
  }
}

// ============================== APP ==============================
export default function App() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("pipeline");
  const [showQuick, setShowQuick] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      const s = await loadSettings(DEFAULT_SETTINGS);
      setSettings(s);
      setSettingsDraft(s);
      const l = await loadLeads();
      setLeads(l);
      setLoading(false);
      if (Platform.OS !== "web") {
        await ensureNotificationsPermission();
        await rescheduleAllNotifications(l);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setLeads(next);
    await saveLeads(next);
    if (Platform.OS !== "web") await rescheduleAllNotifications(next);
  }, []);

  function openAdd() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(lead) {
    setForm({ ...emptyForm, ...lead });
    setEditingId(lead.id);
    setShowForm(true);
    setDetailId(null);
  }

  function saveLead() {
    if (!form.name.trim() || !form.phone.trim()) return;
    const convertedAt =
      form.status === "converted" ? form.convertedAt || Date.now() : null;
    if (editingId) {
      persist(
        leads.map((l) =>
          l.id === editingId
            ? {
                ...form,
                id: editingId,
                convertedAt,
                history: l.history || form.history,
              }
            : l
        )
      );
    } else {
      const newLead = {
        ...form,
        id: uid(),
        createdAt: Date.now(),
        history: form.notes
          ? [{ date: Date.now(), note: form.notes }]
          : [],
        convertedAt,
      };
      persist([...leads, newLead]);
    }
    setShowForm(false);
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  function deleteLead(id) {
    persist(leads.filter((l) => l.id !== id));
    setDetailId(null);
  }

  function quickStatus(id, status) {
    persist(
      leads.map((l) =>
        l.id === id
          ? {
              ...l,
              status,
              convertedAt:
                status === "converted" ? l.convertedAt || Date.now() : l.convertedAt,
            }
          : l
      )
    );
  }

  function bumpCounter(id, field) {
    persist(
      leads.map((l) =>
        l.id === id ? { ...l, [field]: (l[field] || 0) + 1 } : l
      )
    );
  }

  function applyOutcome(id, outcome) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const newHistory = [
      ...(lead.history || []),
      { date: Date.now(), note: outcome.note },
    ];
    const patch = { history: newHistory };
    if (outcome.status) patch.status = outcome.status;
    if (outcome.reason) patch.reason = outcome.reason;
    if (outcome.status === "converted")
      patch.convertedAt = lead.convertedAt || Date.now();
    persist(leads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function scheduleNext(id, days) {
    persist(
      leads.map((l) =>
        l.id === id
          ? { ...l, nextCallDate: addDays(days), status: "followup" }
          : l
      )
    );
  }

  function applyRecommendedTime(id) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const rec = recommendCallTime(lead);
    persist(
      leads.map((l) =>
        l.id === id
          ? {
              ...l,
              nextCallDate: l.nextCallDate || addDays(1),
              nextCallTime: rec.time,
              status: l.status === "new" ? "followup" : l.status,
            }
          : l
      )
    );
  }

  function quickAdd() {
    if (!quickText.trim()) return;
    const parsed = quickParseDeterministic(quickText);
    setForm({ ...emptyForm, ...parsed, history: [] });
    setEditingId(null);
    setShowQuick(false);
    setShowForm(true);
    setQuickText("");
  }

  async function saveSettingsHandler() {
    setSettings(settingsDraft);
    await saveSettings(settingsDraft);
    setShowSettings(false);
  }

  const stats = useMemo(() => {
    const activeLeads = leads.filter(
      (l) => !["converted", "lost"].includes(l.status)
    );
    const overdue = activeLeads.filter((l) => urgency(l) === "overdue").length;
    const today = activeLeads.filter((l) => urgency(l) === "today").length;
    const meetings = leads.reduce((s, l) => s + (l.meetingsDone || 0), 0);
    const logins = leads.reduce((s, l) => s + (l.loginsDone || 0), 0);
    const pipelineValue = activeLeads.reduce(
      (s, l) => s + toRupees(l.loanAmount),
      0
    );
    const wonToday = leads.filter(
      (l) => l.status === "converted" && isToday(l.convertedAt)
    );
    const earnedToday =
      wonToday.reduce((s, l) => s + amtNum(l.loanAmount), 0) *
      (settings.commissionPct / 100) *
      100000;
    return {
      active: activeLeads.length,
      overdue,
      today,
      meetings,
      logins,
      pipelineValue,
      earnedToday,
      wonTodayCount: wonToday.length,
      total: leads.length,
    };
  }, [leads, settings.commissionPct]);

  const detailLead = leads.find((l) => l.id === detailId);

  const filteredLeads = useMemo(() => {
    if (filterStatus === "all") return leads;
    return leads.filter((l) => l.status === filterStatus);
  }, [leads, filterStatus]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.indigo} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        stickyHeaderIndices={[0]}
      >
        {/* ============================== HEADER ============================== */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <View style={styles.logoBox}>
                <ShieldLogo size={36} />
              </View>
              <View>
                <Text style={styles.headerLabel}>RAJ · SALES WAR ROOM</Text>
                <Text style={styles.headerTitle}>Lead Command Center</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSettingsDraft(settings);
                setShowSettings(true);
              }}
              style={styles.settingsBtn}
            >
              <Text style={styles.settingsBtnText}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Earn box */}
          <View style={styles.earnBox}>
            <Text style={styles.earnLabel}>AAJ KI KAMAI</Text>
            <Text style={styles.earnValue}>
              ₹{Math.round(stats.earnedToday).toLocaleString("en-IN")}
            </Text>
            <Text style={styles.earnSub}>{stats.wonTodayCount} deal close aaj</Text>
          </View>

          {/* Metric grid */}
          <View style={styles.metricGrid}>
            <MetricCard
              label="Meetings Done"
              value={String(stats.meetings)}
              color={C.indigo}
            />
            <MetricCard
              label="Files Logged In"
              value={String(stats.logins)}
              color={C.cyan}
            />
            <MetricCard
              label="Overdue Calls"
              value={String(stats.overdue)}
              color={C.alert}
            />
            <MetricCard
              label="Active Pipeline"
              value={formatINR(stats.pipelineValue)}
              color={C.won}
              small
            />
          </View>
        </View>

        {/* ============================== TABS ============================== */}
        <View style={styles.tabRow}>
          {["pipeline", "list"].map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "pipeline" ? "Pipeline" : "List"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ============================== PIPELINE ============================== */}
        {tab === "pipeline" && (
          <ScrollView
            horizontal
            style={{ marginTop: 12 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            showsHorizontalScrollIndicator={false}
          >
            {STATUS_ORDER.map((key) => {
              const col = leads.filter((l) => l.status === key);
              return (
                <View key={key} style={{ width: 210 }}>
                  <View style={styles.colHeader}>
                    <View
                      style={[styles.dot, { backgroundColor: STATUS[key].color }]}
                    />
                    <Text style={styles.colTitle}>{STATUS[key].label}</Text>
                    <Text style={styles.colCount}>{col.length}</Text>
                  </View>
                  {col.length === 0 && (
                    <View style={styles.emptyCol}>
                      <Text style={styles.emptyColText}>Khaali</Text>
                    </View>
                  )}
                  {col.map((lead) => {
                    const score = buyingIntentScore(lead);
                    return (
                      <TouchableOpacity
                        key={lead.id}
                        onPress={() => setDetailId(lead.id)}
                        style={styles.card}
                      >
                        <Text style={styles.cardName} numberOfLines={1}>
                          {lead.name}
                        </Text>
                        <Text style={styles.cardSub}>
                          {productCode(lead.product)} · {lead.bank || "—"}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginTop: 6,
                            alignItems: "center",
                          }}
                        >
                          {lead.loanAmount ? (
                            <Text style={{ color: C.won, fontSize: 10.5, fontWeight: "600" }}>
                              ₹{lead.loanAmount}
                            </Text>
                          ) : (
                            <View />
                          )}
                          <View
                            style={[
                              styles.scorePill,
                              { backgroundColor: intentColor(score) + "22", borderColor: intentColor(score) },
                            ]}
                          >
                            <Text
                              style={{
                                color: intentColor(score),
                                fontSize: 10,
                                fontWeight: "700",
                              }}
                            >
                              {score}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ============================== LIST ============================== */}
        {tab === "list" && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 10 }}
            >
              <FilterChip
                label="All"
                active={filterStatus === "all"}
                onPress={() => setFilterStatus("all")}
              />
              {STATUS_ORDER.map((k) => (
                <FilterChip
                  key={k}
                  label={STATUS[k].label}
                  active={filterStatus === k}
                  onPress={() => setFilterStatus(k)}
                />
              ))}
            </ScrollView>

            {filteredLeads.length === 0 && (
              <Text style={styles.emptyText}>
                Koi lead nahi hai. + dabao ya Quick Add use karo.
              </Text>
            )}
            {filteredLeads.map((lead) => {
              const u = urgency(lead);
              const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
              const score = buyingIntentScore(lead);
              return (
                <TouchableOpacity
                  key={lead.id}
                  onPress={() => setDetailId(lead.id)}
                  style={styles.listRow}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(lead.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{lead.name}</Text>
                    <Text style={styles.cardSub}>
                      {productCode(lead.product)} · {lead.bank || "—"}
                      {lead.loanAmount ? ` · ₹${lead.loanAmount}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: intentColor(score),
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {score}
                    </Text>
                    <Text
                      style={[
                        styles.badge,
                        { color: STATUS[lead.status].color },
                      ]}
                    >
                      {STATUS[lead.status].label}
                    </Text>
                    {dt && (
                      <Text
                        style={{ color: U_STYLE[u].color, fontSize: 10, marginTop: 2 }}
                      >
                        {dt.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ============================== FAB + QUICK ============================== */}
      <TouchableOpacity
        onPress={() => setShowQuick(true)}
        style={styles.quickBtn}
      >
        <Text style={styles.quickBtnText}>✨ Quick Add</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={openAdd} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "600" }}>+</Text>
      </TouchableOpacity>

      {/* ============================== QUICK ADD MODAL ============================== */}
      <Modal
        visible={showQuick}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuick(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Jaldi Add Karo</Text>
            <TextInput
              value={quickText}
              onChangeText={setQuickText}
              multiline
              placeholder="Rampal Goyal 9013427441 Req 1cr lap kal 4 baje construction business turnover 2cr heavy cash cibil 720 roi 9.5..."
              placeholderTextColor={C.textMute}
              style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
            />
            <TouchableOpacity onPress={quickAdd} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Auto-fill karo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowQuick(false)}
              style={{ marginTop: 10, alignItems: "center" }}
            >
              <Text style={{ color: C.textMute }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================== LEAD FORM MODAL ============================== */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <ScrollView style={styles.sheetTall}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {editingId ? "Edit Karo" : "Naya Lead"}
                </Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Text style={{ color: C.textMute, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <LeadForm
                form={form}
                setForm={setForm}
                onSave={saveLead}
                onCancel={() => setShowForm(false)}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ============================== DETAIL MODAL ============================== */}
      {detailLead && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setDetailId(null)}
        >
          <View style={styles.modalWrap}>
            <ScrollView style={styles.sheetTall}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{detailLead.name}</Text>
                <TouchableOpacity onPress={() => setDetailId(null)}>
                  <Text style={{ color: C.textMute, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSub}>
                {productCode(detailLead.product)} · {detailLead.bank || "—"} ·{" "}
                {detailLead.phone}
              </Text>

              {/* AI Copilot Card */}
              <AICopilotCard lead={detailLead} apiKey={settings.geminiApiKey} />

              {/* Smart Call Time */}
              <SmartCallTimeCard
                lead={detailLead}
                onApply={() => applyRecommendedTime(detailLead.id)}
              />

              {/* Objection Destroyer */}
              <ObjectionBox lead={detailLead} />

              {/* Counters */}
              <View style={styles.counterRow}>
                <CounterBtn
                  label="Meeting"
                  count={detailLead.meetingsDone || 0}
                  onPress={() => bumpCounter(detailLead.id, "meetingsDone")}
                  color={C.indigo}
                />
                <CounterBtn
                  label="File Login"
                  count={detailLead.loginsDone || 0}
                  onPress={() => bumpCounter(detailLead.id, "loginsDone")}
                  color={C.cyan}
                />
              </View>

              {/* Status */}
              <Text style={[styles.label, { marginTop: 14 }]}>Status badlo</Text>
              <View style={styles.chipRow}>
                {STATUS_ORDER.map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => quickStatus(detailLead.id, k)}
                    style={[
                      styles.chip,
                      detailLead.status === k && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        detailLead.status === k && styles.chipTextActive,
                      ]}
                    >
                      {STATUS[k].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick schedule */}
              <Text style={[styles.label, { marginTop: 14 }]}>Next call schedule</Text>
              <View style={styles.chipRow}>
                {TIME_TAGS.map((t) => (
                  <TouchableOpacity
                    key={t.label}
                    onPress={() => scheduleNext(detailLead.id, t.days)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Outcome tags */}
              <Text style={[styles.label, { marginTop: 14 }]}>Quick outcome log</Text>
              <View style={styles.chipRow}>
                {OUTCOME_TAGS.map((t) => (
                  <TouchableOpacity
                    key={t.label}
                    onPress={() => applyOutcome(detailLead.id, t)}
                    style={[
                      styles.chip,
                      { borderColor: t.color + "66" },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: t.color }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${detailLead.phone}`)}
                  style={[styles.actionBtn, { backgroundColor: C.indigo }]}
                >
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      `https://wa.me/91${detailLead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappTemplate(detailLead))}`
                    )
                  }
                  style={[styles.actionBtn, { backgroundColor: C.won }]}
                >
                  <Text style={styles.actionText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      `sms:${detailLead.phone}?body=${encodeURIComponent(smsTemplate(detailLead))}`
                    )
                  }
                  style={[styles.actionBtn, { backgroundColor: "#334155" }]}
                >
                  <Text style={styles.actionText}>SMS</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => openEdit(detailLead)}
                style={[styles.primaryBtn, { backgroundColor: C.card2, borderColor: C.border, borderWidth: 1 }]}
              >
                <Text style={[styles.primaryBtnText, { color: C.text }]}>Edit Lead</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => deleteLead(detailLead.id)}
                style={{ marginTop: 16, alignItems: "center" }}
              >
                <Text style={{ color: C.alert }}>Delete Lead</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDetailId(null)}
                style={{ marginVertical: 14, alignItems: "center" }}
              >
                <Text style={{ color: C.textMute }}>Band Karo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* ============================== SETTINGS MODAL ============================== */}
      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text style={{ color: C.textMute, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Commission %</Text>
            <TextInput
              value={String(settingsDraft.commissionPct)}
              onChangeText={(v) =>
                setSettingsDraft((s) => ({
                  ...s,
                  commissionPct: parseFloat(v) || 0,
                }))
              }
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={C.textMute}
            />

            <Text style={styles.label}>Gemini API Key (AI Copilot)</Text>
            <TextInput
              value={settingsDraft.geminiApiKey}
              onChangeText={(v) =>
                setSettingsDraft((s) => ({ ...s, geminiApiKey: v.trim() }))
              }
              style={styles.input}
              placeholder="AIza..."
              placeholderTextColor={C.textMute}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Bina key ke demo strategy use hogi. Key set karne par real Gemini
              1.5 Flash analysis milega — call script, objection counter, aur
              best call time recommendation ke saath.
            </Text>

            <TouchableOpacity
              onPress={saveSettingsHandler}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================== SHIELD LOGO ==============================
function ShieldLogo({ size = 36 }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: s * 0.82,
          height: s,
          backgroundColor: C.indigo,
          borderRadius: s * 0.12,
          borderTopLeftRadius: s * 0.12,
          borderTopRightRadius: s * 0.12,
          borderBottomLeftRadius: s * 0.35,
          borderBottomRightRadius: s * 0.35,
          borderWidth: 1.5,
          borderColor: C.cyan,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: s * 0.42, fontWeight: "900" }}>L</Text>
      </View>
    </View>
  );
}

// ============================== METRIC CARD ==============================
function MetricCard({ label, value, color, small }) {
  return (
    <View style={styles.metricBox}>
      <Text style={[styles.metricVal, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ============================== FILTER CHIP ==============================
function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: C.indigo + "22", borderColor: C.indigo },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active && { color: C.indigo, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================== COUNTER BTN ==============================
function CounterBtn({ label, count, onPress, color }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.counterBtn, { borderColor: color + "55" }]}
    >
      <Text style={[styles.counterCount, { color }]}>{count}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================== AI COPILOT CARD ==============================
function AICopilotCard({ lead, apiKey }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState(null);
  const [raw, setRaw] = useState(null);

  const fetchCopilot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await callGemini(apiKey, lead);
      setRaw(text);
      setSections(parseCopilotResponse(text));
    } catch (e) {
      setError(e.message || "AI analysis fail ho gaya");
    } finally {
      setLoading(false);
    }
  }, [apiKey, lead]);

  useEffect(() => {
    fetchCopilot();
  }, [fetchCopilot]);

  return (
    <View style={styles.aiCard}>
      <View style={styles.aiHeader}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI COPILOT</Text>
        </View>
        <Text style={styles.aiTitle}>Gemini Sales Strategy</Text>
      </View>

      {loading && (
        <View style={styles.aiLoading}>
          <ActivityIndicator color={C.cyan} size="small" />
          <Text style={styles.aiLoadingText}>Strategy ban raha hai...</Text>
        </View>
      )}

      {error && (
        <View style={styles.aiErrorBox}>
          <Text style={styles.aiErrorText}>{error}</Text>
          <TouchableOpacity onPress={fetchCopilot} style={styles.aiRetryBtn}>
            <Text style={styles.aiRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && sections && (
        <View style={{ gap: 10 }}>
          <CopilotSection
            icon="🎯"
            label="Leverage Point"
            text={sections.leverage || raw}
          />
          {sections.hook && (
            <CopilotSection
              icon="💬"
              label="Opening Hook"
              text={sections.hook}
            />
          )}
          {sections.objection && (
            <CopilotSection
              icon="🛡"
              label="Objection Destroyer"
              text={sections.objection}
            />
          )}
          {sections.crossSell && (
            <CopilotSection
              icon="🔀"
              label="Cross-sell / Bridge"
              text={sections.crossSell}
            />
          )}
          {sections.callTime && (
            <CopilotSection
              icon="⏰"
              label="Best Call Time"
              text={sections.callTime}
            />
          )}
        </View>
      )}

      {!loading && !error && (
        <TouchableOpacity onPress={fetchCopilot} style={styles.aiRefreshBtn}>
          <Text style={styles.aiRefreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function CopilotSection({ icon, label, text }) {
  return (
    <View style={styles.aiSection}>
      <Text style={styles.aiSectionLabel}>
        {icon} {label}
      </Text>
      <Text style={styles.aiSectionText}>{text}</Text>
    </View>
  );
}

// ============================== SMART CALL TIME CARD ==============================
function SmartCallTimeCard({ lead, onApply }) {
  const rec = recommendCallTime(lead);
  return (
    <View style={styles.callTimeCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={styles.callTimeIcon}>⏰</Text>
        <Text style={styles.callTimeTitle}>Smart Call Time</Text>
        <View style={styles.callTimePill}>
          <Text style={styles.callTimePillText}>{rec.label}</Text>
        </View>
      </View>
      <Text style={styles.callTimeReason}>{rec.reason}</Text>
      <TouchableOpacity onPress={onApply} style={styles.callTimeBtn}>
        <Text style={styles.callTimeBtnText}>Schedule at {rec.label}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================== OBJECTION BOX ==============================
function ObjectionBox({ lead }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(false);

  async function copyObjection() {
    if (active === null) return;
    try {
      await Clipboard.setStringAsync(OBJECTIONS[active].a);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // best-effort
    }
  }

  return (
    <View style={styles.objBox}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: "row", justifyContent: "space-between" }}
      >
        <Text style={styles.objTitle}>🛡 Objection Destroyer</Text>
        <Text style={{ color: C.textMute }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open &&
        OBJECTIONS.map((o, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setActive(active === i ? null : i)}
            style={[styles.objRow, active === i && styles.objRowActive]}
          >
            <Text
              style={{
                color: active === i ? "#fecaca" : C.textDim,
                fontSize: 11.5,
              }}
            >
              {o.q}
            </Text>
          </TouchableOpacity>
        ))}
      {active !== null && (
        <View style={styles.objAnswer}>
          <Text style={{ color: C.text, fontSize: 12.5, lineHeight: 18 }}>
            {OBJECTIONS[active].a}
          </Text>
          <TouchableOpacity onPress={copyObjection} style={styles.objCopyBtn}>
            <Text style={styles.objCopyText}>
              {copied ? "✓ Copied" : "Copy"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================== LEAD FORM ==============================
function LeadForm({ form, setForm, onSave, onCancel }) {
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const isBL = /Business Loan/i.test(form.product);
  const isMSME = /MSME/i.test(form.product);
  const isPL = /Personal Loan/i.test(form.product);
  const showBusinessFields = isBL || isMSME;
  const showSalaryFields = isPL;
  const showPropertyFields = !showBusinessFields && !showSalaryFields;

  const isSalaried = /salaried/i.test(form.employment || "");
  const isSelfEmployed = /self-employed/i.test(form.employment || "");

  const checklist = getDocumentChecklist(form);

  return (
    <View>
      <Text style={styles.label}>Naam *</Text>
      <TextInput
        value={form.name}
        onChangeText={(v) => set("name", v)}
        style={styles.input}
        placeholderTextColor={C.textMute}
      />

      <Text style={styles.label}>Phone *</Text>
      <TextInput
        value={form.phone}
        onChangeText={(v) => set("phone", v)}
        keyboardType="phone-pad"
        style={styles.input}
        placeholderTextColor={C.textMute}
      />

      <Text style={styles.label}>Alt Phone</Text>
      <TextInput
        value={form.altPhone}
        onChangeText={(v) => set("altPhone", v)}
        keyboardType="phone-pad"
        style={styles.input}
        placeholderTextColor={C.textMute}
      />

      <Text style={styles.label}>Product</Text>
      <View style={styles.chipRow}>
        {PRODUCTS.map((p) => (
          <TouchableOpacity
            key={p.v}
            onPress={() => set("product", p.v)}
            style={[styles.chip, form.product === p.v && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                form.product === p.v && styles.chipTextActive,
              ]}
            >
              {p.c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Bank</Text>
      <View style={styles.chipRow}>
        {BANKS.map((b) => (
          <TouchableOpacity
            key={b}
            onPress={() => set("bank", b)}
            style={[styles.chip, form.bank === b && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                form.bank === b && styles.chipTextActive,
              ]}
            >
              {b}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Requirement (amount)</Text>
      <TextInput
        value={form.loanAmount}
        onChangeText={(v) => set("loanAmount", v)}
        placeholder="e.g. 1 Cr"
        placeholderTextColor={C.textMute}
        style={styles.input}
      />

      {/* Universal financial fields */}
      <Text style={styles.label}>Current Bank & ROI (%)</Text>
      <TextInput
        value={form.currentROI}
        onChangeText={(v) => set("currentROI", v)}
        placeholder="e.g. 9.5"
        placeholderTextColor={C.textMute}
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.label}>CIBIL Score</Text>
      <TextInput
        value={form.cibilScore}
        onChangeText={(v) => set("cibilScore", v)}
        placeholder="e.g. 750"
        placeholderTextColor={C.textMute}
        keyboardType="numeric"
        style={styles.input}
      />

      {/* Property fields */}
      {showPropertyFields && (
        <>
          <Text style={styles.label}>Property Type</Text>
          <SelectField
            value={form.propertyType}
            options={PROPERTY_TYPES}
            onChange={(v) => set("propertyType", v)}
          />
          <Text style={styles.label}>Property Location</Text>
          <TextInput
            value={form.propertyLocation}
            onChangeText={(v) => set("propertyLocation", v)}
            style={styles.input}
            placeholderTextColor={C.textMute}
          />
          <Text style={styles.label}>Market Value</Text>
          <TextInput
            value={form.marketValue}
            onChangeText={(v) => set("marketValue", v)}
            placeholder="e.g. 1.5 Cr"
            placeholderTextColor={C.textMute}
            style={styles.input}
          />
        </>
      )}

      {/* Business fields */}
      {showBusinessFields && (
        <>
          <Text style={styles.label}>Annual Turnover (T.O.)</Text>
          <SelectField
            value={form.turnover}
            options={TURNOVER_BANDS}
            onChange={(v) => set("turnover", v)}
          />
          <Text style={styles.label}>Banking Type</Text>
          <SelectField
            value={form.bankingType}
            options={BANKING_TYPES}
            onChange={(v) => set("bankingType", v)}
          />
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            value={form.businessName}
            onChangeText={(v) => set("businessName", v)}
            style={styles.input}
            placeholderTextColor={C.textMute}
          />
          <Text style={styles.label}>ITR</Text>
          <TextInput
            value={form.itr}
            onChangeText={(v) => set("itr", v)}
            placeholder="e.g. 12L"
            placeholderTextColor={C.textMute}
            style={styles.input}
          />
        </>
      )}

      {/* Salary fields */}
      {showSalaryFields && (
        <>
          <Text style={styles.label}>Monthly Net Salary (₹)</Text>
          <TextInput
            value={form.monthlySalary}
            onChangeText={(v) => set("monthlySalary", v)}
            placeholder="e.g. 45000"
            placeholderTextColor={C.textMute}
            keyboardType="numeric"
            style={styles.input}
          />
          <Text style={styles.label}>Company Category</Text>
          <SelectField
            value={form.companyCategory}
            options={COMPANY_CATEGORIES}
            onChange={(v) => set("companyCategory", v)}
          />
        </>
      )}

      {/* Universal: Employment */}
      <Text style={styles.label}>Employment Type</Text>
      <SelectField
        value={form.employment}
        options={EMPLOYMENT}
        onChange={(v) => set("employment", v)}
      />

      {/* Salaried dynamic fields */}
      {isSalaried && (
        <>
          <Text style={styles.label}>Additional Income Source</Text>
          <SelectField
            value={form.additionalIncome}
            options={ADDITIONAL_INCOME_SOURCES}
            onChange={(v) => set("additionalIncome", v)}
          />
          {form.additionalIncome && form.additionalIncome !== "None" && (
            <>
              <Text style={styles.label}>Additional Monthly Income (₹)</Text>
              <TextInput
                value={form.additionalIncomeAmt}
                onChangeText={(v) => set("additionalIncomeAmt", v)}
                placeholder="e.g. 15000"
                placeholderTextColor={C.textMute}
                keyboardType="numeric"
                style={styles.input}
              />
            </>
          )}
        </>
      )}

      {/* Self-Employed dynamic fields */}
      {isSelfEmployed && (
        <>
          <Text style={styles.label}>Entity Constitution</Text>
          <SelectField
            value={form.entityConstitution}
            options={ENTITY_CONSTITUTION}
            onChange={(v) => set("entityConstitution", v)}
          />
          <Text style={styles.label}>Nature of Business</Text>
          <SelectField
            value={form.natureOfBusiness}
            options={NATURE_OF_BUSINESS}
            onChange={(v) => set("natureOfBusiness", v)}
          />
          <Text style={styles.label}>Annual Turnover / Gross Profit (₹)</Text>
          <TextInput
            value={form.turnover}
            onChangeText={(v) => set("turnover", v)}
            placeholder="e.g. 2 Cr"
            placeholderTextColor={C.textMute}
            style={styles.input}
          />
          <Text style={styles.label}>Additional Income Source</Text>
          <SelectField
            value={form.additionalIncome}
            options={ADDITIONAL_INCOME_SOURCES}
            onChange={(v) => set("additionalIncome", v)}
          />
        </>
      )}

      {/* Universal: Rental Income */}
      <Text style={styles.label}>Rental Income Type</Text>
      <SelectField
        value={form.rentalIncome}
        options={RENTAL_INCOME_TYPES}
        onChange={(v) => set("rentalIncome", v)}
      />

      <Text style={styles.label}>Co-Applicant</Text>
      <TextInput
        value={form.coApplicant}
        onChangeText={(v) => set("coApplicant", v)}
        style={styles.input}
        placeholderTextColor={C.textMute}
      />

      <Text style={styles.label}>Next Call Date</Text>
      <TextInput
        value={form.nextCallDate}
        onChangeText={(v) => set("nextCallDate", v)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={C.textMute}
        style={styles.input}
      />
      <Text style={styles.label}>Next Call Time</Text>
      <TextInput
        value={form.nextCallTime}
        onChangeText={(v) => set("nextCallTime", v)}
        placeholder="HH:MM"
        placeholderTextColor={C.textMute}
        style={styles.input}
      />

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {STATUS_ORDER.map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => set("status", k)}
            style={[styles.chip, form.status === k && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                form.status === k && styles.chipTextActive,
              ]}
            >
              {STATUS[k].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Interest</Text>
      <View style={styles.chipRow}>
        {Object.keys(INTEREST).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => set("interest", k)}
            style={[styles.chip, form.interest === k && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                form.interest === k && styles.chipTextActive,
              ]}
            >
              {INTEREST[k].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Document Checklist */}
      {checklist.length > 4 && (
        <View style={styles.checklistBox}>
          <Text style={styles.checklistTitle}>📋 Document Checklist</Text>
          <Text style={styles.checklistSub}>
            Based on {form.employment || "employment type"}
            {form.entityConstitution ? ` · ${form.entityConstitution}` : ""}
          </Text>
          {checklist.map((doc, i) => (
            <View key={i} style={styles.checklistItem}>
              <Text style={styles.checklistBullet}>☐</Text>
              <Text style={styles.checklistText}>{doc}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={form.notes}
        onChangeText={(v) => set("notes", v)}
        multiline
        style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
        placeholderTextColor={C.textMute}
      />

      <TouchableOpacity onPress={onSave} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>
          {form.id ? "Update Karo" : "Add Karo"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onCancel}
        style={{ marginVertical: 14, alignItems: "center" }}
      >
        <Text style={{ color: C.textMute }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================== SELECT FIELD ==============================
function SelectField({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={styles.selectBox}
      >
        <Text
          style={[styles.selectText, !value && { color: C.textMute }]}
          numberOfLines={1}
        >
          {value || "Select..."}
        </Text>
        <Text style={{ color: C.textMute }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.selectDropdown}>
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 180 }}
            contentContainerStyle={{ gap: 2 }}
          >
            <TouchableOpacity
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
              style={styles.selectOption}
            >
              <Text style={[styles.selectOptionText, { color: C.textMute }]}>
                — Clear —
              </Text>
            </TouchableOpacity>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                style={[
                  styles.selectOption,
                  value === opt && { backgroundColor: C.indigo + "22" },
                ]}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    value === opt && { color: C.indigo, fontWeight: "700" },
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ============================== STYLES ==============================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    padding: 16,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.indigo + "22", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.indigo + "66" },
  headerLabel: { color: C.cyan, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  settingsBtnText: { color: C.textDim, fontSize: 18 },
  earnBox: { marginTop: 14, backgroundColor: C.card2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.won + "44" },
  earnLabel: { color: C.won, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  earnValue: { color: C.won, fontSize: 24, fontWeight: "800", marginTop: 2 },
  earnSub: { color: C.textMute, fontSize: 10, marginTop: 2 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  metricBox: { width: (SCREEN_W - 32 - 24) / 4, minWidth: 80, backgroundColor: C.card2, borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1, borderColor: C.border },
  metricVal: { fontSize: 15, fontWeight: "800" },
  metricLabel: { color: C.textMute, fontSize: 8, marginTop: 2, textAlign: "center" },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  tabBtnActive: { backgroundColor: C.indigo + "22", borderColor: C.indigo },
  tabText: { color: C.textMute, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: C.indigo },
  colHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  colTitle: { color: C.text, fontSize: 12, fontWeight: "700" },
  colCount: { color: C.textMute, fontSize: 10, marginLeft: "auto" },
  emptyCol: { padding: 12, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", borderRadius: 8, alignItems: "center" },
  emptyColText: { color: C.textMute, fontSize: 10 },
  card: { backgroundColor: C.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  cardName: { color: C.text, fontSize: 13, fontWeight: "700" },
  cardSub: { color: C.textMute, fontSize: 10.5, marginTop: 2 },
  scorePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card2, alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.cyan, fontWeight: "700", fontSize: 12 },
  badge: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  emptyText: { color: C.textMute, textAlign: "center", marginTop: 40 },
  quickBtn: { position: "absolute", bottom: 24, left: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.indigo, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  quickBtnText: { color: C.indigo, fontWeight: "700", fontSize: 12.5 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.indigo, alignItems: "center", justifyContent: "center", shadowColor: C.indigo, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30 },
  sheetTall: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: "90%" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  label: { color: C.textDim, fontSize: 11, fontWeight: "600", marginBottom: 4, marginTop: 6 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, color: C.text, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  chipActive: { backgroundColor: C.indigo + "22", borderColor: C.indigo },
  chipText: { color: C.textDim, fontSize: 11 },
  chipTextActive: { color: C.indigo, fontWeight: "700" },
  primaryBtn: { backgroundColor: C.indigo, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  counterRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  counterBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.card2, borderRadius: 10, paddingVertical: 12, borderWidth: 1 },
  counterCount: { fontSize: 18, fontWeight: "800" },
  counterLabel: { color: C.textDim, fontSize: 11, fontWeight: "600" },
  selectBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, marginBottom: 6 },
  selectText: { color: C.text, fontSize: 12, flex: 1 },
  selectDropdown: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, marginTop: -4, marginBottom: 8, overflow: "hidden" },
  selectOption: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 6 },
  selectOptionText: { color: C.text, fontSize: 12 },
  hint: { color: C.textMute, fontSize: 10, marginTop: 4, marginBottom: 10, lineHeight: 15 },
  // AI Copilot
  aiCard: { backgroundColor: C.card2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.cyan + "55", marginTop: 12 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  aiBadge: { backgroundColor: C.cyan + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.cyan + "66" },
  aiBadgeText: { color: C.cyan, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  aiTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  aiLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  aiLoadingText: { color: C.textDim, fontSize: 12 },
  aiErrorBox: { padding: 10, backgroundColor: C.alert + "15", borderRadius: 8, borderWidth: 1, borderColor: C.alert + "44" },
  aiErrorText: { color: C.alert, fontSize: 11, lineHeight: 16 },
  aiRetryBtn: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: C.alert + "22" },
  aiRetryText: { color: C.alert, fontSize: 11, fontWeight: "700" },
  aiSection: { backgroundColor: C.bg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border },
  aiSectionLabel: { color: C.cyan, fontSize: 10, fontWeight: "700", marginBottom: 4, letterSpacing: 0.5 },
  aiSectionText: { color: C.text, fontSize: 12, lineHeight: 17 },
  aiRefreshBtn: { marginTop: 10, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  aiRefreshText: { color: C.textDim, fontSize: 11, fontWeight: "600" },
  // Smart Call Time
  callTimeCard: { backgroundColor: C.card2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.indigo + "55", marginTop: 12 },
  callTimeIcon: { fontSize: 16 },
  callTimeTitle: { color: C.indigo, fontWeight: "700", fontSize: 12 },
  callTimePill: { backgroundColor: C.indigo + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.indigo + "66" },
  callTimePillText: { color: C.indigo, fontSize: 11, fontWeight: "800" },
  callTimeReason: { color: C.textDim, fontSize: 11, lineHeight: 16, marginTop: 8 },
  callTimeBtn: { marginTop: 10, backgroundColor: C.indigo, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  callTimeBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  // Objection
  objBox: { backgroundColor: C.card2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.alert + "44", marginTop: 12 },
  objTitle: { color: C.alert, fontWeight: "700", fontSize: 12 },
  objRow: { padding: 8, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: C.border },
  objRowActive: { borderColor: C.alert + "66", backgroundColor: C.alert + "12" },
  objAnswer: { marginTop: 8, backgroundColor: C.bg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.alert + "44" },
  objCopyBtn: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  objCopyText: { color: C.cyan, fontSize: 10, fontWeight: "700" },
  // Document Checklist
  checklistBox: { backgroundColor: C.card2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginTop: 12, marginBottom: 8 },
  checklistTitle: { color: C.cyan, fontSize: 12, fontWeight: "700" },
  checklistSub: { color: C.textMute, fontSize: 10, marginTop: 2, marginBottom: 8 },
  checklistItem: { flexDirection: "row", gap: 8, paddingVertical: 3 },
  checklistBullet: { color: C.textDim, fontSize: 13 },
  checklistText: { color: C.text, fontSize: 11.5, flex: 1 },
});
