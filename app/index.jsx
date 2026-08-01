import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Linking,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, SafeAreaView,
  Pressable, FlatList, Dimensions, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Clipboard from "expo-clipboard";

import {
  STATUS_ORDER, STATUS, INTEREST, PRODUCTS, BANKS, EMPLOYMENT,
  PROPERTY_TYPES, TURNOVER_BANDS, BANKING_TYPES, RENTAL_INCOME_TYPES,
  COMPANY_CATEGORIES, ENTITY_CONSTITUTION, NATURE_OF_BUSINESS,
  ADDITIONAL_INCOME_SOURCES, HOLD_LOST_REASONS, TIME_TAGS,
  CALLBACK_OUTCOMES, FILTER_PILLS, CALL_TIME_SLOTS, PIPELINE_STAGES,
  OBJECTIONS, DEFAULT_SETTINGS, recommendCallTime,
} from "../lib/constants";
import {
  uid, productCode, todayISO, addDays, isToday, fmtDateTime, urgency,
  U_STYLE, initials, toTitleCase, amtNum, toRupees, formatINR, formatINRShort,
  formatAmountShort, dayOfWeek, normalizeDate, todayStr, nowStr,
  buyingIntentScore, intentBand, intentColor, focusRadarPriority,
  focusRadarBadge, quickParseDeterministic, whatsappTemplate, smsTemplate,
  leadsToCSV, emptyForm, buildGeminiPrompt, callGemini, parseCopilotResponse,
} from "../lib/utils";
import {
  loadLeads, saveLeads, loadSettings, saveSettings, loadTheme, saveTheme,
} from "../lib/storage";

const { width: SCREEN_W } = Dimensions.get("window");

// ============================== THEME PALETTES ==============================
const DARK = {
  bg: "#0B0F19",
  card: "#151C2C",
  card2: "#1A2236",
  border: "#2A354D",
  inputBg: "#0B0F19",
  indigo: "#6366F1",
  cyan: "#06B6D4",
  won: "#10B981",
  alert: "#EF4444",
  warn: "#FBBF24",
  text: "#F1F5F9",
  textDim: "#94A3B8",
  textMute: "#64748B",
  shadow: "rgba(99,102,241,0.25)",
};

const LIGHT = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  card2: "#F1F5F9",
  border: "#E2E8F0",
  inputBg: "#F8FAFC",
  indigo: "#6366F1",
  cyan: "#0891B2",
  won: "#059669",
  alert: "#DC2626",
  warn: "#D97706",
  text: "#0F172A",
  textDim: "#475569",
  textMute: "#94A3B8",
  shadow: "rgba(99,102,241,0.15)",
};

function useTheme() {
  const [mode, setMode] = useState("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await loadTheme();
      setMode(t);
      setLoaded(true);
    })();
  }, []);

  const toggle = useCallback(async () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    await saveTheme(next);
  }, [mode]);

  const colors = mode === "dark" ? DARK : LIGHT;
  return { mode, toggle, colors, loaded };
}

// ============================== NOTIFICATIONS ==============================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.HIGH,
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
  if (triggerMs < 5000) return;
  const trigger = new Date(Date.now() + triggerMs);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Call Reminder",
        body: `${lead.name} — ${productCode(lead.product)} · ${lead.phone}`,
        data: { leadId: lead.id },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
      android: {
        channelId: "default",
      },
    });
  } catch (e) {}
}

async function cancelAllScheduled() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (e) {}
}

async function rescheduleAllNotifications(leads) {
  await cancelAllScheduled();
  for (const lead of leads) {
    if (!["converted", "lost", "disbursed"].includes(lead.status)) {
      await scheduleLeadNotification(lead);
    }
  }
}

// ============================== APP ==============================
export default function App() {
  const { mode, toggle: toggleTheme, colors: C, loaded: themeLoaded } = useTheme();
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
  const [filterPill, setFilterPill] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pipelineStage, setPipelineStage] = useState("all");
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
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        }
        await ensureNotificationsPermission();
        await rescheduleAllNotifications(l);
      } else if (typeof Notification !== "undefined" && Notification.requestPermission) {
        try { await Notification.requestPermission(); } catch (e) {}
      }
    })();
  }, []);

  // Web background notification timer — checks every 30 seconds for leads
  // whose nextCallDate (normalized YYYY/MM/DD) and nextCallTime (HH:MM) match
  // the current local date/time. Fires a browser Notification (or alert fallback)
  // and sets lead.notified = true to prevent duplicate alerts.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const interval = setInterval(() => {
      const today = todayStr();
      const now = nowStr();
      setLeads((prev) => {
        let changed = false;
        const next = prev.map((l) => {
          if (l.notified) return l;
          if (!l.nextCallDate || !l.nextCallTime) return l;
          if (["converted", "lost", "disbursed"].includes(l.status)) return l;
          const leadDate = normalizeDate(l.nextCallDate);
          if (leadDate === today && l.nextCallTime === now) {
            changed = true;
            const title = "Call Reminder";
            const body = `${l.name || "Lead"} — ${productCode(l.product)} · ${l.phone || ""}`;
            try {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification(title, { body });
              } else {
                alert(`${title}: ${body}`);
              }
            } catch (e) {
              alert(`${title}: ${body}`);
            }
            return { ...l, notified: true };
          }
          return l;
        });
        if (changed) { saveLeads(next); return next; }
        return prev;
      });
    }, 30000);
    return () => clearInterval(interval);
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
      form.status === "converted" || form.status === "disbursed"
        ? form.convertedAt || Date.now()
        : null;
    if (editingId) {
      persist(
        leads.map((l) =>
          l.id === editingId
            ? { ...form, id: editingId, convertedAt, history: l.history || form.history }
            : l
        )
      );
    } else {
      const newLead = {
        ...form,
        id: uid(),
        createdAt: Date.now(),
        history: form.notes ? [{ date: Date.now(), note: form.notes }] : [],
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
              convertedAt: ["converted", "disbursed"].includes(status) ? l.convertedAt || Date.now() : l.convertedAt,
            }
          : l
      )
    );
  }

  function bumpCounter(id, field) {
    persist(leads.map((l) => (l.id === id ? { ...l, [field]: (l[field] || 0) + 1 } : l)));
  }

  function applyOutcome(id, outcome) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const newHistory = [...(lead.history || []), { date: Date.now(), note: outcome.note }];
    const patch = { history: newHistory };
    if (outcome.setStatus) patch.status = outcome.setStatus;
    if (outcome.setReason) patch.reason = outcome.setReason;
    if (outcome.setInterest) patch.interest = outcome.setInterest;
    if (outcome.nextDays) patch.nextCallDate = addDays(outcome.nextDays);
    if (outcome.nextTime) patch.nextCallTime = outcome.nextTime;
    if (["converted", "disbursed"].includes(outcome.setStatus))
      patch.convertedAt = lead.convertedAt || Date.now();
    persist(leads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function scheduleNext(id, days) {
    persist(
      leads.map((l) =>
        l.id === id ? { ...l, nextCallDate: addDays(days), status: "followup" } : l
      )
    );
  }

  function setCallTime(id, time) {
    persist(
      leads.map((l) =>
        l.id === id ? { ...l, nextCallTime: time, status: l.status === "new" ? "followup" : l.status } : l
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

  // ---- Search + Filter logic ----
  const filteredLeads = useMemo(() => {
    let result = leads;
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((l) =>
        [l.name, l.phone, l.altPhone, l.bank, l.customBank, l.location, l.propertyLocation]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      );
    }
    // Filter pills
    if (filterPill !== "all") {
      result = result.filter((l) => {
        switch (filterPill) {
          case "hot": return l.interest === "hot";
          case "lapbt": return /LAP|BT/i.test(l.product || "");
          case "topup": return /Top-Up/i.test(l.product || "");
          case "today": return urgency(l) === "today" || urgency(l) === "overdue";
          case "highvalue": return toRupees(l.loanAmount) >= 10000000;
          default: return true;
        }
      });
    }
    // Pipeline stage filter
    if (pipelineStage !== "all" && tab === "pipeline") {
      result = result.filter((l) => l.status === pipelineStage);
    }
    return result;
  }, [leads, searchQuery, filterPill, pipelineStage, tab]);

  // Focus Radar: sort by priority (high commission deals first)
  const radarSortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => focusRadarPriority(b) - focusRadarPriority(a));
  }, [filteredLeads]);

  const stats = useMemo(() => {
    const activeLeads = leads.filter((l) => !["converted", "lost", "disbursed"].includes(l.status));
    const overdue = activeLeads.filter((l) => urgency(l) === "overdue").length;
    const today = activeLeads.filter((l) => urgency(l) === "today").length;
    const meetings = leads.reduce((s, l) => s + (l.meetingsDone || 0), 0);
    const logins = leads.reduce((s, l) => s + (l.loginsDone || 0), 0);
    const pipelineValue = activeLeads.reduce((s, l) => s + toRupees(l.loanAmount), 0);
    const wonToday = leads.filter((l) => ["converted", "disbursed"].includes(l.status) && isToday(l.convertedAt));
    const earnedToday = wonToday.reduce((s, l) => s + amtNum(l.loanAmount), 0) * (settings.commissionPct / 100) * 100000;
    return { active: activeLeads.length, overdue, today, meetings, logins, pipelineValue, earnedToday, wonTodayCount: wonToday.length, total: leads.length };
  }, [leads, settings.commissionPct]);

  // Daily Call Queue — leads scheduled for today
  const todayCalls = useMemo(() => {
    return leads
      .filter((l) => !["lost", "disbursed", "converted"].includes(l.status))
      .filter((l) => {
        if (!l.nextCallDate) return false;
        const u = urgency(l);
        return u === "today" || u === "overdue";
      })
      .sort((a, b) => {
        const ta = (a.nextCallTime || "99:99").replace(":", "");
        const tb = (b.nextCallTime || "99:99").replace(":", "");
        return ta.localeCompare(tb);
      });
  }, [leads]);

  const detailLead = leads.find((l) => l.id === detailId);

  const insets = useSafeAreaInsets();

  if (loading || !themeLoaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.indigo} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.bg }]}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} translucent={false} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        stickyHeaderIndices={[0]}
      >
        {/* ============================== HEADER ============================== */}
        <View style={[styles.header, {
          backgroundColor: C.card,
          borderBottomColor: C.border,
          paddingTop: 14 + insets.top,
        }]}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <GrowthArrowLogo size={38} />
              <View>
                <Text style={[styles.headerLabel, { color: C.cyan }]}>RAJ · SALES WAR ROOM</Text>
                <Text style={[styles.headerTitle, { color: C.text }]}>Lead Command Center</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={toggleTheme} style={[styles.themeBtn, { backgroundColor: C.card2, borderColor: C.border }]}>
                <Text style={{ fontSize: 16 }}>{mode === "dark" ? "☀" : "☾"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSettingsDraft(settings); setShowSettings(true); }}
                style={[styles.settingsBtn, { backgroundColor: C.card2, borderColor: C.border }]}
              >
                <Text style={[styles.settingsBtnText, { color: C.textDim }]}>⚙</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBar, { backgroundColor: C.card2, borderColor: C.border }]}>
            <Text style={{ fontSize: 14, color: C.textMute }}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Name, phone, bank, location..."
              placeholderTextColor={C.textMute}
              style={[styles.searchInput, { color: C.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text style={{ color: C.textMute, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 10 }}>
            {FILTER_PILLS.map((p) => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setFilterPill(p.key)}
                style={[styles.filterPill, {
                  backgroundColor: filterPill === p.key ? C.indigo : C.card2,
                  borderColor: filterPill === p.key ? C.indigo : C.border,
                }]}
              >
                <Text style={[styles.filterPillText, { color: filterPill === p.key ? "#fff" : C.textDim }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ============================== AAJ KE CALLS (DAILY QUEUE) ============================== */}
          {todayCalls.length > 0 && (
            <View style={[styles.dailyQueueBox, { backgroundColor: C.card2, borderColor: C.warn + "55" }]}>
              <View style={styles.dailyQueueHeader}>
                <Text style={[styles.dailyQueueTitle, { color: C.warn }]}>📞 AAJ KE CALLS</Text>
                <View style={[styles.dailyQueueCount, { backgroundColor: C.warn + "22", borderColor: C.warn + "66" }]}>
                  <Text style={{ color: C.warn, fontSize: 11, fontWeight: "800" }}>{todayCalls.length}</Text>
                </View>
              </View>
              {todayCalls.map((lead) => {
                const u = urgency(lead);
                const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
                return (
                  <TouchableOpacity
                    key={lead.id}
                    onPress={() => setDetailId(lead.id)}
                    style={[styles.dailyQueueItem, { backgroundColor: C.inputBg, borderColor: C.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardName, { color: C.text }]} numberOfLines={1}>{lead.name}</Text>
                      <Text style={[styles.cardSub, { color: C.textMute }]}>
                        {productCode(lead.product)} · {lead.phone}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {dt && (
                        <Text style={{ color: U_STYLE[u].color, fontSize: 10, fontWeight: "700" }}>
                          {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      )}
                      <Text style={{ color: STATUS[lead.status]?.color || C.textMute, fontSize: 9, marginTop: 2 }}>
                        {STATUS[lead.status]?.label || lead.status}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Earn box */}
          <View style={[styles.earnBox, { backgroundColor: C.card2, borderColor: C.won + "44" }]}>
            <Text style={[styles.earnLabel, { color: C.won }]}>AAJ KI KAMAI</Text>
            <Text style={[styles.earnValue, { color: C.won }]}>
              ₹{Math.round(stats.earnedToday).toLocaleString("en-IN")}
            </Text>
            <Text style={[styles.earnSub, { color: C.textMute }]}>{stats.wonTodayCount} deal close aaj</Text>
          </View>

          {/* Metric grid */}
          <View style={styles.metricGrid}>
            <MetricCard label="Meetings" value={String(stats.meetings)} color={C.indigo} C={C} />
            <MetricCard label="Logins" value={String(stats.logins)} color={C.cyan} C={C} />
            <MetricCard label="Overdue" value={String(stats.overdue)} color={C.alert} C={C} />
            <MetricCard label="Pipeline" value={formatINRShort(stats.pipelineValue)} color={C.won} C={C} small />
          </View>
        </View>

        {/* ============================== TABS ============================== */}
        <View style={[styles.tabRow, { backgroundColor: C.bg }]}>
          {["pipeline", "radar", "list"].map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && { backgroundColor: C.indigo + "22", borderColor: C.indigo }]}
            >
              <Text style={[styles.tabText, { color: tab === t ? C.indigo : C.textMute }]}>
                {t === "pipeline" ? "Pipeline" : t === "radar" ? "Focus Radar" : "List"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ============================== PIPELINE TRACKER ============================== */}
        {tab === "pipeline" && (
          <View style={{ marginTop: 12 }}>
            {/* Stage filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
              <TouchableOpacity
                onPress={() => setPipelineStage("all")}
                style={[styles.filterPill, { backgroundColor: pipelineStage === "all" ? C.indigo : C.card2, borderColor: pipelineStage === "all" ? C.indigo : C.border }]}
              >
                <Text style={[styles.filterPillText, { color: pipelineStage === "all" ? "#fff" : C.textDim }]}>All Stages</Text>
              </TouchableOpacity>
              {PIPELINE_STAGES.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setPipelineStage(s.key)}
                  style={[styles.filterPill, {
                    backgroundColor: pipelineStage === s.key ? s.color : C.card2,
                    borderColor: pipelineStage === s.key ? s.color : C.border,
                  }]}
                >
                  <Text style={[styles.filterPillText, { color: pipelineStage === s.key ? "#fff" : C.textDim }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Horizontal pipeline columns */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {(pipelineStage === "all" ? PIPELINE_STAGES : PIPELINE_STAGES.filter((s) => s.key === pipelineStage)).map((stage) => {
                const col = filteredLeads.filter((l) => l.status === stage.key);
                return (
                  <View key={stage.key} style={{ width: 210 }}>
                    <View style={styles.colHeader}>
                      <View style={[styles.dot, { backgroundColor: stage.color }]} />
                      <Text style={[styles.colTitle, { color: C.text }]}>{stage.label}</Text>
                      <Text style={[styles.colCount, { color: C.textMute }]}>{col.length}</Text>
                    </View>
                    {col.length === 0 && (
                      <View style={[styles.emptyCol, { borderColor: C.border }]}>
                        <Text style={[styles.emptyColText, { color: C.textMute }]}>Khaali</Text>
                      </View>
                    )}
                    {col.map((lead) => {
                      const score = buyingIntentScore(lead);
                      const badge = focusRadarBadge(lead);
                      return (
                        <TouchableOpacity
                          key={lead.id}
                          onPress={() => setDetailId(lead.id)}
                          style={[styles.card, { backgroundColor: C.card, borderColor: C.border }, styles.cardShadow(C)]}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <Text style={[styles.cardName, { color: C.text }]} numberOfLines={1}>{lead.name}</Text>
                            {badge && (
                              <View style={[styles.radarBadge, { backgroundColor: badge.color + "22", borderColor: badge.color }]}>
                                <Text style={{ color: badge.color, fontSize: 8, fontWeight: "800" }}>{badge.label}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.cardSub, { color: C.textMute }]}>
                            {productCode(lead.product)} · {lead.bank === "Other" ? lead.customBank || "Other" : lead.bank || "—"}
                          </Text>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
                            {lead.loanAmount ? (
                              <Text style={{ color: C.won, fontSize: 10.5, fontWeight: "600" }}>{formatAmountShort(lead.loanAmount)}</Text>
                            ) : <View />}
                            <View style={[styles.scorePill, { backgroundColor: intentColor(score) + "22", borderColor: intentColor(score) }]}>
                              <Text style={{ color: intentColor(score), fontSize: 10, fontWeight: "700" }}>{score}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ============================== FOCUS RADAR ============================== */}
        {tab === "radar" && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Text style={[styles.radarTitle, { color: C.text }]}>🎯 Focus Radar</Text>
            <Text style={[styles.radarSub, { color: C.textMute }]}>
              High-commission deals sorted by priority — loan amount, CIBIL, call timing
            </Text>
            {radarSortedLeads.length === 0 && (
              <Text style={[styles.emptyText, { color: C.textMute }]}>Koi lead nahi hai.</Text>
            )}
            {radarSortedLeads.map((lead, idx) => {
              const score = buyingIntentScore(lead);
              const badge = focusRadarBadge(lead);
              const u = urgency(lead);
              const priority = focusRadarPriority(lead);
              return (
                <TouchableOpacity
                  key={lead.id}
                  onPress={() => setDetailId(lead.id)}
                  style={[styles.radarRow, { backgroundColor: C.card, borderColor: C.border }, styles.cardShadow(C)]}
                >
                  <View style={styles.radarRank}>
                    <Text style={[styles.radarRankText, { color: idx < 3 ? C.alert : C.textMute }]}>
                      #{idx + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.cardName, { color: C.text }]} numberOfLines={1}>{lead.name}</Text>
                      {badge && (
                        <View style={[styles.radarBadge, { backgroundColor: badge.color + "22", borderColor: badge.color }]}>
                          <Text style={{ color: badge.color, fontSize: 8, fontWeight: "800" }}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cardSub, { color: C.textMute }]}>
                      {productCode(lead.product)} · {lead.loanAmount ? formatAmountShort(lead.loanAmount) : "—"}
                      {lead.cibilScore ? ` · CIBIL ${lead.cibilScore}` : ""}
                    </Text>
                    {u === "overdue" && (
                      <Text style={{ color: C.alert, fontSize: 9, fontWeight: "700", marginTop: 2 }}>OVERDUE CALL</Text>
                    )}
                    {u === "today" && (
                      <Text style={{ color: C.warn, fontSize: 9, fontWeight: "700", marginTop: 2 }}>AAJ CALL KARO</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: intentColor(score), fontSize: 11, fontWeight: "700" }}>{score}</Text>
                    <Text style={{ color: C.textMute, fontSize: 9, marginTop: 2 }}>{Math.round(priority)} pts</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ============================== LIST ============================== */}
        {tab === "list" && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            {radarSortedLeads.length === 0 && (
              <Text style={[styles.emptyText, { color: C.textMute }]}>
                Koi lead nahi hai. + dabao ya Quick Add use karo.
              </Text>
            )}
            {radarSortedLeads.map((lead) => {
              const u = urgency(lead);
              const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
              const score = buyingIntentScore(lead);
              const badge = focusRadarBadge(lead);
              return (
                <TouchableOpacity
                  key={lead.id}
                  onPress={() => setDetailId(lead.id)}
                  style={[styles.listRow, { backgroundColor: C.card, borderColor: C.border }, styles.cardShadow(C)]}
                >
                  <View style={[styles.avatar, { backgroundColor: C.card2 }]}>
                    <Text style={[styles.avatarText, { color: C.cyan }]}>{initials(lead.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.cardName, { color: C.text }]} numberOfLines={1}>{lead.name}</Text>
                      {badge && (
                        <View style={[styles.radarBadge, { backgroundColor: badge.color + "22", borderColor: badge.color }]}>
                          <Text style={{ color: badge.color, fontSize: 8, fontWeight: "800" }}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cardSub, { color: C.textMute }]}>
                      {productCode(lead.product)} · {lead.bank === "Other" ? lead.customBank || "Other" : lead.bank || "—"}
                      {lead.loanAmount ? ` · ${formatAmountShort(lead.loanAmount)}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: intentColor(score), fontSize: 11, fontWeight: "700" }}>{score}</Text>
                    <Text style={[styles.badge, { color: STATUS[lead.status]?.color || C.textMute }]}>
                      {STATUS[lead.status]?.label || lead.status}
                    </Text>
                    {dt && (
                      <Text style={{ color: U_STYLE[u].color, fontSize: 10, marginTop: 2 }}>
                        {dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
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
      <TouchableOpacity onPress={() => setShowQuick(true)} style={[styles.quickBtn, { backgroundColor: C.card, borderColor: C.indigo }, styles.cardShadow(C)]}>
        <Text style={[styles.quickBtnText, { color: C.indigo }]}>✨ Quick Add</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={openAdd} style={[styles.fab, { backgroundColor: C.indigo }, styles.cardShadow(C)]}>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "600" }}>+</Text>
      </TouchableOpacity>

      {/* ============================== QUICK ADD MODAL ============================== */}
      <Modal visible={showQuick} transparent animationType="slide" onRequestClose={() => setShowQuick(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center" }}>
            <ScrollView
              style={[styles.sheet, { backgroundColor: C.card }]}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.sheetTitle, { color: C.text }]}>Jaldi Add Karo</Text>
              <TextInput
                value={quickText}
                onChangeText={setQuickText}
                multiline
                placeholder="Rampal 9013427441 Req 1cr lap kal 4 baje construction turnover 2cr itr 15l cibil 720 roi 9.5 top-up 20l..."
                placeholderTextColor={C.textMute}
                style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text, minHeight: 100, textAlignVertical: "top" }]}
              />
              <TouchableOpacity onPress={quickAdd} style={[styles.primaryBtn, { backgroundColor: C.indigo }]}>
                <Text style={styles.primaryBtnText}>Auto-fill karo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowQuick(false)} style={{ marginTop: 10, alignItems: "center" }}>
                <Text style={{ color: C.textMute }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ============================== LEAD FORM MODAL ============================== */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center" }}>
            <ScrollView
              style={[styles.sheetTall, { backgroundColor: C.card }]}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: C.text }]}>{editingId ? "Edit Karo" : "Naya Lead"}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Text style={{ color: C.textMute, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <LeadForm form={form} setForm={setForm} onSave={saveLead} onCancel={() => setShowForm(false)} C={C} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ============================== DETAIL MODAL ============================== */}
      {detailLead && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setDetailId(null)}>
          <View style={styles.modalWrap}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
            <ScrollView style={[styles.sheetTall, { backgroundColor: C.card }]} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: C.text }]}>{detailLead.name}</Text>
                <TouchableOpacity onPress={() => setDetailId(null)}>
                  <Text style={{ color: C.textMute, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.cardSub, { color: C.textMute }]}>
                {productCode(detailLead.product)} · {detailLead.bank === "Other" ? detailLead.customBank || "Other" : detailLead.bank || "—"} · {detailLead.phone}
              </Text>

              {/* AI Copilot Card */}
              <AICopilotCard lead={detailLead} apiKey={settings.geminiApiKey} C={C} />

              {/* Smart Call Time */}
              <SmartCallTimeCard lead={detailLead} onApply={() => applyRecommendedTime(detailLead.id)} C={C} />

              {/* Callback Matrix */}
              <CallbackMatrix lead={detailLead} onOutcome={(o) => applyOutcome(detailLead.id, o)} C={C} />

              {/* Objection Destroyer */}
              <ObjectionBox lead={detailLead} C={C} />

              {/* Counters */}
              <View style={styles.counterRow}>
                <CounterBtn label="Meeting" count={detailLead.meetingsDone || 0} onPress={() => bumpCounter(detailLead.id, "meetingsDone")} color={C.indigo} C={C} />
                <CounterBtn label="File Login" count={detailLead.loginsDone || 0} onPress={() => bumpCounter(detailLead.id, "loginsDone")} color={C.cyan} C={C} />
              </View>

              {/* Status */}
              <Text style={[styles.label, { color: C.textDim, marginTop: 14 }]}>Status badlo</Text>
              <View style={styles.chipRow}>
                {PIPELINE_STAGES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => quickStatus(detailLead.id, s.key)}
                    style={[styles.chip, { backgroundColor: C.inputBg, borderColor: detailLead.status === s.key ? s.color : C.border }]}
                  >
                    <Text style={[styles.chipText, { color: detailLead.status === s.key ? s.color : C.textDim }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick schedule */}
              <Text style={[styles.label, { color: C.textDim, marginTop: 14 }]}>Next call schedule</Text>
              <View style={styles.chipRow}>
                {TIME_TAGS.map((t) => (
                  <TouchableOpacity key={t.label} onPress={() => scheduleNext(detailLead.id, t.days)} style={[styles.chip, { backgroundColor: C.inputBg, borderColor: C.border }]}>
                    <Text style={[styles.chipText, { color: C.textDim }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Smart Time Selector */}
              <Text style={[styles.label, { color: C.textDim, marginTop: 14 }]}>Smart Time Selector</Text>
              <View style={styles.chipRow}>
                {CALL_TIME_SLOTS.map((s) => (
                  <TouchableOpacity
                    key={s.time}
                    onPress={() => setCallTime(detailLead.id, s.time)}
                    style={[styles.chip, {
                      backgroundColor: detailLead.nextCallTime === s.time ? C.indigo + "22" : C.inputBg,
                      borderColor: detailLead.nextCallTime === s.time ? C.indigo : C.border,
                    }]}
                  >
                    <Text style={[styles.chipText, { color: detailLead.nextCallTime === s.time ? C.indigo : C.textDim, fontWeight: detailLead.nextCallTime === s.time ? "700" : "400" }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Expandable Notes History */}
              <NotesHistory lead={detailLead} onAdd={(note) => {
                if (!note.trim()) return;
                persist(leads.map((l) => l.id === detailLead.id ? { ...l, history: [...(l.history || []), { date: Date.now(), note }] } : l));
              }} C={C} />

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${detailLead.phone}`)} style={[styles.actionBtn, { backgroundColor: C.indigo }]}>
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://wa.me/91${detailLead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappTemplate(detailLead))}`)}
                  style={[styles.actionBtn, { backgroundColor: C.won }]}
                >
                  <Text style={styles.actionText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`sms:${detailLead.phone}?body=${encodeURIComponent(smsTemplate(detailLead))}`)}
                  style={[styles.actionBtn, { backgroundColor: "#334155" }]}
                >
                  <Text style={styles.actionText}>SMS</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => openEdit(detailLead)} style={[styles.primaryBtn, { backgroundColor: C.card2, borderColor: C.border, borderWidth: 1 }]}>
                <Text style={[styles.primaryBtnText, { color: C.text }]}>Edit Lead</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteLead(detailLead.id)} style={{ marginTop: 16, alignItems: "center" }}>
                <Text style={{ color: C.alert }}>Delete Lead</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDetailId(null)} style={{ marginVertical: 14, alignItems: "center" }}>
                <Text style={{ color: C.textMute }}>Band Karo</Text>
              </TouchableOpacity>
            </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* ============================== SETTINGS MODAL ============================== */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={[styles.sheet, { backgroundColor: C.card }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: C.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text style={{ color: C.textMute, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.label, { color: C.textDim }]}>Commission %</Text>
            <TextInput
              value={String(settingsDraft.commissionPct)}
              onChangeText={(v) => setSettingsDraft((s) => ({ ...s, commissionPct: parseFloat(v) || 0 }))}
              keyboardType="numeric"
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              placeholderTextColor={C.textMute}
            />
            <Text style={[styles.label, { color: C.textDim }]}>Gemini API Key (AI Copilot)</Text>
            <TextInput
              value={settingsDraft.geminiApiKey}
              onChangeText={(v) => setSettingsDraft((s) => ({ ...s, geminiApiKey: v.trim() }))}
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              placeholder="AIza..."
              placeholderTextColor={C.textMute}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.hint, { color: C.textMute }]}>
              Bina key ke demo strategy use hogi. Key set karne par real Gemini 1.5 Flash analysis milega.
            </Text>
            <TouchableOpacity onPress={saveSettingsHandler} style={[styles.primaryBtn, { backgroundColor: C.indigo }]}>
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================== GROWTH ARROW LOGO ==============================
// Inline SVG-style growth arrow: green ascending steps with a gold arrowhead.
// Drawn with nested Views to avoid requiring react-native-svg.
function GrowthArrowLogo({ size = 38 }) {
  const s = size;
  const stepW = s * 0.16;
  const gap = s * 0.04;
  const steps = [
    { h: s * 0.30, color: "#10B981" },
    { h: s * 0.50, color: "#34D399" },
    { h: s * 0.70, color: "#6EE7B7" },
  ];
  return (
    <View style={{
      width: s, height: s, alignItems: "center", justifyContent: "flex-end",
      flexDirection: "row", paddingBottom: s * 0.08, paddingRight: s * 0.04,
    }}>
      {steps.map((st, i) => (
        <View key={i} style={{
          width: stepW, height: st.h,
          backgroundColor: st.color,
          borderRadius: 3,
          marginRight: i < steps.length - 1 ? gap : s * 0.06,
          alignSelf: "flex-end",
        }} />
      ))}
      {/* Gold arrowhead pointing up-right */}
      <View style={{
        width: 0, height: 0,
        alignSelf: "flex-end",
        marginBottom: s * 0.50,
        borderLeftWidth: s * 0.12,
        borderRightWidth: s * 0.12,
        borderBottomWidth: s * 0.20,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: "#FBBF24",
        transform: [{ rotate: "45deg" }],
      }} />
    </View>
  );
}

// ============================== METRIC CARD ==============================
function MetricCard({ label, value, color, small, C }) {
  return (
    <View style={[styles.metricBox, { backgroundColor: C.card2, borderColor: C.border }]}>
      <Text style={[styles.metricVal, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.metricLabel, { color: C.textMute }]}>{label}</Text>
    </View>
  );
}

// ============================== FILTER CHIP ==============================
function FilterChip({ label, active, onPress, C }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { backgroundColor: active ? C.indigo + "22" : C.card2, borderColor: active ? C.indigo : C.border }]}>
      <Text style={[styles.chipText, { color: active ? C.indigo : C.textDim, fontWeight: active ? "700" : "400" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================== COUNTER BTN ==============================
function CounterBtn({ label, count, onPress, color, C }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.counterBtn, { backgroundColor: C.card2, borderColor: color + "55" }]}>
      <Text style={[styles.counterCount, { color }]}>{count}</Text>
      <Text style={[styles.counterLabel, { color: C.textDim }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================== AI COPILOT CARD ==============================
function AICopilotCard({ lead, apiKey, C }) {
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

  useEffect(() => { fetchCopilot(); }, [fetchCopilot]);

  return (
    <View style={[styles.aiCard, { backgroundColor: C.card2, borderColor: C.cyan + "55" }]}>
      <View style={styles.aiHeader}>
        <View style={[styles.aiBadge, { backgroundColor: C.cyan + "22", borderColor: C.cyan + "66" }]}>
          <Text style={[styles.aiBadgeText, { color: C.cyan }]}>AI COPILOT</Text>
        </View>
        <Text style={[styles.aiTitle, { color: C.text }]}>Gemini Sales Strategy</Text>
      </View>
      {loading && (
        <View style={styles.aiLoading}>
          <ActivityIndicator color={C.cyan} size="small" />
          <Text style={[styles.aiLoadingText, { color: C.textDim }]}>Strategy ban raha hai...</Text>
        </View>
      )}
      {error && (
        <View style={[styles.aiErrorBox, { backgroundColor: C.alert + "15", borderColor: C.alert + "44" }]}>
          <Text style={[styles.aiErrorText, { color: C.alert }]}>{error}</Text>
          <TouchableOpacity onPress={fetchCopilot} style={[styles.aiRetryBtn, { backgroundColor: C.alert + "22" }]}>
            <Text style={[styles.aiRetryText, { color: C.alert }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !error && sections && (
        <View style={{ gap: 10 }}>
          <CopilotSection icon="🎯" label="Leverage Point" text={sections.leverage || raw} C={C} />
          {sections.hook && <CopilotSection icon="💬" label="Opening Hook" text={sections.hook} C={C} />}
          {sections.objection && <CopilotSection icon="🛡" label="Objection Destroyer" text={sections.objection} C={C} />}
          {sections.crossSell && <CopilotSection icon="🔀" label="Cross-sell / Bridge" text={sections.crossSell} C={C} />}
          {sections.callTime && <CopilotSection icon="⏰" label="Best Call Time" text={sections.callTime} C={C} />}
        </View>
      )}
      {!loading && !error && (
        <TouchableOpacity onPress={fetchCopilot} style={[styles.aiRefreshBtn, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.aiRefreshText, { color: C.textDim }]}>↻ Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function CopilotSection({ icon, label, text, C }) {
  return (
    <View style={[styles.aiSection, { backgroundColor: C.inputBg, borderColor: C.border }]}>
      <Text style={[styles.aiSectionLabel, { color: C.cyan }]}>{icon} {label}</Text>
      <Text style={[styles.aiSectionText, { color: C.text }]}>{text}</Text>
    </View>
  );
}

// ============================== SMART CALL TIME CARD ==============================
function SmartCallTimeCard({ lead, onApply, C }) {
  const rec = recommendCallTime(lead);
  return (
    <View style={[styles.callTimeCard, { backgroundColor: C.card2, borderColor: C.indigo + "55" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={styles.callTimeIcon}>⏰</Text>
        <Text style={[styles.callTimeTitle, { color: C.indigo }]}>Smart Call Time</Text>
        <View style={[styles.callTimePill, { backgroundColor: C.indigo + "22", borderColor: C.indigo + "66" }]}>
          <Text style={[styles.callTimePillText, { color: C.indigo }]}>{rec.label}</Text>
        </View>
      </View>
      <Text style={[styles.callTimeReason, { color: C.textDim }]}>{rec.reason}</Text>
      <TouchableOpacity onPress={onApply} style={[styles.callTimeBtn, { backgroundColor: C.indigo }]}>
        <Text style={styles.callTimeBtnText}>Schedule at {rec.label}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================== CALLBACK MATRIX ==============================
function CallbackMatrix({ lead, onOutcome, C }) {
  return (
    <View style={[styles.callbackBox, { backgroundColor: C.card2, borderColor: C.border }]}>
      <Text style={[styles.callbackTitle, { color: C.text }]}>📞 Callback Matrix</Text>
      <Text style={[styles.callbackSub, { color: C.textMute }]}>Quick outcome log with auto next-call slot</Text>
      <View style={{ gap: 6, marginTop: 10 }}>
        {CALLBACK_OUTCOMES.map((o) => (
          <TouchableOpacity
            key={o.label}
            onPress={() => onOutcome(o)}
            style={[styles.callbackBtn, { backgroundColor: C.inputBg, borderColor: o.color + "44" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={[styles.callbackDot, { backgroundColor: o.color }]} />
              <Text style={[styles.callbackBtnText, { color: C.text }]}>{o.label}</Text>
            </View>
            {o.nextDays !== undefined && o.nextTime && (
              <Text style={[styles.callbackNext, { color: o.color }]}>
                → {o.nextDays === 0 ? "Aaj" : o.nextDays === 1 ? "Kal" : `${o.nextDays} din`} {o.nextTime}
              </Text>
            )}
            {o.setStatus === "lost" && (
              <Text style={[styles.callbackNext, { color: o.color }]}>→ Lost</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ============================== OBJECTION BOX ==============================
function ObjectionBox({ lead, C }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(false);

  async function copyObjection() {
    if (active === null) return;
    try {
      await Clipboard.setStringAsync(OBJECTIONS[active].a);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  }

  return (
    <View style={[styles.objBox, { backgroundColor: C.card2, borderColor: C.alert + "44" }]}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[styles.objTitle, { color: C.alert }]}>🛡 Objection Destroyer</Text>
        <Text style={{ color: C.textMute }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && OBJECTIONS.map((o, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => setActive(active === i ? null : i)}
          style={[styles.objRow, { backgroundColor: C.inputBg, borderColor: active === i ? C.alert + "66" : C.border }]}
        >
          <Text style={{ color: active === i ? "#fecaca" : C.textDim, fontSize: 11.5 }}>{o.q}</Text>
        </TouchableOpacity>
      ))}
      {active !== null && (
        <View style={[styles.objAnswer, { backgroundColor: C.inputBg, borderColor: C.alert + "44" }]}>
          <Text style={{ color: C.text, fontSize: 12.5, lineHeight: 18 }}>{OBJECTIONS[active].a}</Text>
          <TouchableOpacity onPress={copyObjection} style={[styles.objCopyBtn, { backgroundColor: C.card2, borderColor: C.border }]}>
            <Text style={[styles.objCopyText, { color: C.cyan }]}>{copied ? "✓ Copied" : "Copy"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================== NOTES HISTORY ==============================
function NotesHistory({ lead, onAdd, C }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  function addNote() {
    if (!note.trim()) return;
    onAdd(note);
    setNote("");
  }

  return (
    <View style={[styles.notesBox, { backgroundColor: C.card2, borderColor: C.border }]}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[styles.notesTitle, { color: C.text }]}>📝 Notes & History ({(lead.history || []).length})</Text>
        <Text style={{ color: C.textMute }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 10 }}>
          {(lead.history || []).length === 0 && (
            <Text style={[styles.notesEmpty, { color: C.textMute }]}>Koi history nahi hai.</Text>
          )}
          {(lead.history || []).slice().reverse().map((h, i) => (
            <View key={i} style={[styles.noteItem, { borderColor: C.border }]}>
              <Text style={[styles.noteDate, { color: C.cyan }]}>
                {new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{"  "}
                {new Date(h.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={[styles.noteText, { color: C.text }]}>{h.note}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Naya note add karo..."
              placeholderTextColor={C.textMute}
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text, flex: 1, minHeight: 40 }]}
            />
            <TouchableOpacity onPress={addNote} style={[styles.noteAddBtn, { backgroundColor: C.indigo }]}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================== LEAD FORM ==============================
function LeadForm({ form, setForm, onSave, onCancel, C }) {
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const isBL = /Business Loan/i.test(form.product);
  const isMSME = /MSME/i.test(form.product);
  const isPL = /Personal Loan/i.test(form.product);
  const showBusinessFields = isBL || isMSME;
  const showSalaryFields = isPL;
  const showPropertyFields = !showBusinessFields && !showSalaryFields;
  const isSalaried = /salaried/i.test(form.employment || "");
  const isSelfEmployed = /self-employed/i.test(form.employment || "");
  const isOtherBank = form.bank === "Other";

  return (
    <View>
      <Text style={[styles.label, { color: C.textDim }]}>Naam *</Text>
      <TextInput value={form.name} onChangeText={(v) => set("name", v)} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} placeholderTextColor={C.textMute} />

      <Text style={[styles.label, { color: C.textDim }]}>Phone *</Text>
      <TextInput value={form.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} placeholderTextColor={C.textMute} />

      <Text style={[styles.label, { color: C.textDim }]}>Alt Phone</Text>
      <TextInput value={form.altPhone} onChangeText={(v) => set("altPhone", v)} keyboardType="phone-pad" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} placeholderTextColor={C.textMute} />

      <Text style={[styles.label, { color: C.textDim }]}>Product</Text>
      <View style={styles.chipRow}>
        {PRODUCTS.map((p) => (
          <TouchableOpacity key={p.v} onPress={() => set("product", p.v)} style={[styles.chip, { backgroundColor: form.product === p.v ? C.indigo + "22" : C.inputBg, borderColor: form.product === p.v ? C.indigo : C.border }]}>
            <Text style={[styles.chipText, { color: form.product === p.v ? C.indigo : C.textDim, fontWeight: form.product === p.v ? "700" : "400" }]}>{p.c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: C.textDim }]}>Bank</Text>
      <View style={styles.chipRow}>
        {BANKS.map((b) => (
          <TouchableOpacity key={b} onPress={() => set("bank", b)} style={[styles.chip, { backgroundColor: form.bank === b ? C.indigo + "22" : C.inputBg, borderColor: form.bank === b ? C.indigo : C.border }]}>
            <Text style={[styles.chipText, { color: form.bank === b ? C.indigo : C.textDim, fontWeight: form.bank === b ? "700" : "400" }]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Bank Input */}
      {isOtherBank && (
        <>
          <Text style={[styles.label, { color: C.textDim }]}>Specify Bank Name</Text>
          <TextInput value={form.customBank} onChangeText={(v) => set("customBank", v)} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} placeholderTextColor={C.textMute} placeholder="e.g. South Indian Bank" />
        </>
      )}

      <Text style={[styles.label, { color: C.textDim }]}>Requirement (amount)</Text>
      <TextInput value={form.loanAmount} onChangeText={(v) => set("loanAmount", v)} placeholder="e.g. 1 Cr" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />

      {/* Loan Details Split */}
      <Text style={[styles.label, { color: C.textDim }]}>Existing Loan Amount</Text>
      <TextInput value={form.existingLoanAmount} onChangeText={(v) => set("existingLoanAmount", v)} placeholder="e.g. 40 L" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />

      <Text style={[styles.label, { color: C.textDim }]}>Top-Up Requested (₹)</Text>
      <TextInput value={form.topUpRequested} onChangeText={(v) => set("topUpRequested", v)} placeholder="e.g. 10 L" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />

      {/* Universal financial fields */}
      <Text style={[styles.label, { color: C.textDim }]}>Current Bank & ROI (%)</Text>
      <TextInput value={form.currentROI} onChangeText={(v) => set("currentROI", v)} placeholder="e.g. 9.5" placeholderTextColor={C.textMute} keyboardType="numeric" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />

      <Text style={[styles.label, { color: C.textDim }]}>CIBIL Score</Text>
      <TextInput value={form.cibilScore} onChangeText={(v) => set("cibilScore", v)} placeholder="e.g. 750" placeholderTextColor={C.textMute} keyboardType="numeric" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />

      {/* Property fields */}
      {showPropertyFields && (
        <>
          <Text style={[styles.label, { color: C.textDim }]}>Property Type</Text>
          <SelectField value={form.propertyType} options={PROPERTY_TYPES} onChange={(v) => set("propertyType", v)} C={C} />
          <Text style={[styles.label, { color: C.textDim }]}>Property Location</Text>
          <TextInput value={form.propertyLocation} onChangeText={(v) => set("propertyLocation", v)} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} placeholderTextColor={C.textMute} />
          <Text style={[styles.label, { color: C.textDim }]}>Market Value</Text>
          <TextInput value={form.marketValue} onChangeText={(v) => set("marketValue", v)} placeholder="e.g. 1.5 Cr" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
        </>
      )}

      {/* Business fields */}
      {showBusinessFields && (
        <>
          <Text style={[styles.label, { color: C.textDim }]}>Annual Turnover (₹)</Text>
          <TextInput value={form.turnover} onChangeText={(v) => set("turnover", v)} placeholder="e.g. 2 Cr" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
          <Text style={[styles.label, { color: C.textDim }]}>Banking Type</Text>
          <SelectField value={form.bankingType} options={BANKING_TYPES} onChange={(v) => set("bankingType", v)} C={C} />
          <Text style={[styles.label, { color: C.textDim }]}>Business Name</Text>
          <TextInput value={form.businessName} onChangeText={(v) => set("businessName", v)} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} placeholderTextColor={C.textMute} />
        </>
      )}

      {/* Salary fields */}
      {showSalaryFields && (
        <>
          <Text style={[styles.label, { color: C.textDim }]}>Monthly Net Salary (₹)</Text>
          <TextInput value={form.monthlySalary} onChangeText={(v) => set("monthlySalary", v)} placeholder="e.g. 45000" placeholderTextColor={C.textMute} keyboardType="numeric" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
          <Text style={[styles.label, { color: C.textDim }]}>Company Category</Text>
          <SelectField value={form.companyCategory} options={COMPANY_CATEGORIES} onChange={(v) => set("companyCategory", v)} C={C} />
        </>
      )}

      {/* Universal: Employment */}
      <Text style={[styles.label, { color: C.textDim }]}>Employment Type</Text>
      <SelectField value={form.employment} options={EMPLOYMENT} onChange={(v) => set("employment", v)} C={C} />

      {/* Salaried dynamic fields */}
      {isSalaried && (
        <>
          <Text style={[styles.label, { color: C.textDim }]}>Monthly Net Salary (₹)</Text>
          <TextInput value={form.monthlySalary} onChangeText={(v) => set("monthlySalary", v)} placeholder="e.g. 45000" placeholderTextColor={C.textMute} keyboardType="numeric" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
          <Text style={[styles.label, { color: C.textDim }]}>Additional Income Source</Text>
          <SelectField value={form.additionalIncome} options={ADDITIONAL_INCOME_SOURCES} onChange={(v) => set("additionalIncome", v)} C={C} />
          {form.additionalIncome && form.additionalIncome !== "None" && (
            <>
              <Text style={[styles.label, { color: C.textDim }]}>Additional Monthly Income (₹)</Text>
              <TextInput value={form.additionalIncomeAmt} onChangeText={(v) => set("additionalIncomeAmt", v)} placeholder="e.g. 15000" placeholderTextColor={C.textMute} keyboardType="numeric" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
            </>
          )}
        </>
      )}

      {/* Self-Employed dynamic fields */}
      {isSelfEmployed && (
        <>
          <Text style={[styles.label, { color: C.textDim }]}>Entity Type</Text>
          <SelectField value={form.entityConstitution} options={ENTITY_CONSTITUTION} onChange={(v) => set("entityConstitution", v)} C={C} />
          <Text style={[styles.label, { color: C.textDim }]}>Nature of Business</Text>
          <SelectField value={form.natureOfBusiness} options={NATURE_OF_BUSINESS} onChange={(v) => set("natureOfBusiness", v)} C={C} />
          <Text style={[styles.label, { color: C.textDim }]}>Latest 2 Years ITR Amount (₹)</Text>
          <TextInput value={form.itr} onChangeText={(v) => set("itr", v)} placeholder="e.g. 12L" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
          <Text style={[styles.label, { color: C.textDim }]}>Annual Turnover (₹)</Text>
          <TextInput value={form.turnover} onChangeText={(v) => set("turnover", v)} placeholder="e.g. 2 Cr" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
          <Text style={[styles.label, { color: C.textDim }]}>Additional Income Source</Text>
          <SelectField value={form.additionalIncome} options={ADDITIONAL_INCOME_SOURCES} onChange={(v) => set("additionalIncome", v)} C={C} />
          {form.additionalIncome && form.additionalIncome !== "None" && (
            <>
              <Text style={[styles.label, { color: C.textDim }]}>Additional Income Amount (₹/Month)</Text>
              <TextInput value={form.additionalIncomeAmt} onChangeText={(v) => set("additionalIncomeAmt", v)} placeholder="e.g. 15000" placeholderTextColor={C.textMute} keyboardType="numeric" style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
            </>
          )}
        </>
      )}

      {/* Universal: Rental Income */}
      <Text style={[styles.label, { color: C.textDim }]}>Rental Income Type</Text>
      <SelectField value={form.rentalIncome} options={RENTAL_INCOME_TYPES} onChange={(v) => set("rentalIncome", v)} C={C} />

      <Text style={[styles.label, { color: C.textDim }]}>Co-Applicant</Text>
      <TextInput value={form.coApplicant} onChangeText={(v) => set("coApplicant", v)} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} placeholderTextColor={C.textMute} />

      <Text style={[styles.label, { color: C.textDim }]}>Next Call Date</Text>
      <TextInput value={form.nextCallDate} onChangeText={(v) => set("nextCallDate", v)} placeholder="YYYY-MM-DD" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />
      {form.nextCallDate && /^\d{4}-\d{2}-\d{2}$/.test(form.nextCallDate) && (
        <Text style={[styles.hint, { color: C.cyan, fontWeight: "700" }]}>
          {dayOfWeek(form.nextCallDate) ? `${form.nextCallDate} (${dayOfWeek(form.nextCallDate)})` : ""}
        </Text>
      )}
      <Text style={[styles.label, { color: C.textDim }]}>Next Call Time</Text>
      <TextInput value={form.nextCallTime} onChangeText={(v) => set("nextCallTime", v)} placeholder="HH:MM" placeholderTextColor={C.textMute} style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]} />

      <Text style={[styles.label, { color: C.textDim }]}>Status</Text>
      <View style={styles.chipRow}>
        {PIPELINE_STAGES.map((s) => (
          <TouchableOpacity key={s.key} onPress={() => set("status", s.key)} style={[styles.chip, { backgroundColor: form.status === s.key ? s.color + "22" : C.inputBg, borderColor: form.status === s.key ? s.color : C.border }]}>
            <Text style={[styles.chipText, { color: form.status === s.key ? s.color : C.textDim, fontWeight: form.status === s.key ? "700" : "400" }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: C.textDim }]}>Interest</Text>
      <View style={styles.chipRow}>
        {Object.keys(INTEREST).map((k) => (
          <TouchableOpacity key={k} onPress={() => set("interest", k)} style={[styles.chip, { backgroundColor: form.interest === k ? C.indigo + "22" : C.inputBg, borderColor: form.interest === k ? C.indigo : C.border }]}>
            <Text style={[styles.chipText, { color: form.interest === k ? C.indigo : C.textDim, fontWeight: form.interest === k ? "700" : "400" }]}>{INTEREST[k].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: C.textDim }]}>Notes</Text>
      <TextInput value={form.notes} onChangeText={(v) => set("notes", v)} multiline style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text, minHeight: 70, textAlignVertical: "top" }]} placeholderTextColor={C.textMute} />

      <TouchableOpacity onPress={onSave} style={[styles.primaryBtn, { backgroundColor: C.indigo }]}>
        <Text style={styles.primaryBtnText}>{form.id ? "Update Karo" : "Add Karo"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={{ marginVertical: 14, alignItems: "center" }}>
        <Text style={{ color: C.textMute }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================== SELECT FIELD ==============================
function SelectField({ value, options, onChange, C }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={[styles.selectBox, { backgroundColor: C.inputBg, borderColor: C.border }]}>
        <Text style={[styles.selectText, { color: value ? C.text : C.textMute }]} numberOfLines={1}>{value || "Select..."}</Text>
        <Text style={{ color: C.textMute }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[styles.selectDropdown, { backgroundColor: C.inputBg, borderColor: C.border }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 2 }}>
            <TouchableOpacity onPress={() => { onChange(""); setOpen(false); }} style={styles.selectOption}>
              <Text style={[styles.selectOptionText, { color: C.textMute }]}>— Clear —</Text>
            </TouchableOpacity>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => { onChange(opt); setOpen(false); }}
                style={[styles.selectOption, value === opt && { backgroundColor: C.indigo + "22" }]}
              >
                <Text style={[styles.selectOptionText, { color: value === opt ? C.indigo : C.text, fontWeight: value === opt ? "700" : "400" }]}>{opt}</Text>
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
  container: { flex: 1 },
  header: { borderBottomWidth: 1, padding: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  headerTitle: { fontSize: 20, fontWeight: "800", marginTop: 2 },
  themeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  settingsBtnText: { fontSize: 18 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
  searchInput: { flex: 1, fontSize: 13 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 11, fontWeight: "600" },
  earnBox: { marginTop: 14, borderRadius: 14, padding: 14, borderWidth: 1 },
  dailyQueueBox: { marginTop: 14, marginBottom: 4, borderRadius: 14, padding: 12, borderWidth: 1 },
  dailyQueueHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  dailyQueueTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  dailyQueueCount: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dailyQueueItem: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6, gap: 8 },
  earnLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  earnValue: { fontSize: 24, fontWeight: "800", marginTop: 2 },
  earnSub: { fontSize: 10, marginTop: 2 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  metricBox: { width: (SCREEN_W - 32 - 24) / 4, minWidth: 80, borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1 },
  metricVal: { fontSize: 15, fontWeight: "800" },
  metricLabel: { fontSize: 8, marginTop: 2, textAlign: "center" },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  tabText: { fontWeight: "700", fontSize: 12 },
  colHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  colTitle: { fontSize: 12, fontWeight: "700" },
  colCount: { fontSize: 10, marginLeft: "auto" },
  emptyCol: { padding: 12, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, alignItems: "center" },
  emptyColText: { fontSize: 10 },
  card: { borderRadius: 10, padding: 10, borderWidth: 1, marginBottom: 8 },
  cardShadow: (C) => Platform.select({
    ios: { shadowColor: C.shadow, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 3 },
    default: {},
  }),
  cardName: { fontSize: 13, fontWeight: "700" },
  cardSub: { fontSize: 10.5, marginTop: 2 },
  scorePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  radarBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "700", fontSize: 12 },
  badge: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 40 },
  radarTitle: { fontSize: 16, fontWeight: "800" },
  radarSub: { fontSize: 11, marginTop: 2, marginBottom: 12 },
  radarRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  radarRank: { width: 30, alignItems: "center" },
  radarRankText: { fontSize: 14, fontWeight: "800" },
  quickBtn: { position: "absolute", bottom: 24, left: 20, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  quickBtnText: { fontWeight: "700", fontSize: 12.5 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  modalWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: { width: "92%", maxHeight: "88%", borderRadius: 16, padding: 16, paddingBottom: 30 },
  sheetTall: { width: "92%", maxHeight: "88%", borderRadius: 16, padding: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "600", marginBottom: 4, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 11 },
  primaryBtn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  counterRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  counterBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 12, borderWidth: 1 },
  counterCount: { fontSize: 18, fontWeight: "800" },
  counterLabel: { fontSize: 11, fontWeight: "600" },
  selectBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  selectText: { fontSize: 12, flex: 1 },
  selectDropdown: { borderWidth: 1, borderRadius: 8, marginTop: -4, marginBottom: 8, overflow: "hidden" },
  selectOption: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 6 },
  selectOptionText: { fontSize: 12 },
  hint: { fontSize: 10, marginTop: 4, marginBottom: 10, lineHeight: 15 },
  // AI Copilot
  aiCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 12 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  aiBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  aiBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  aiTitle: { fontSize: 13, fontWeight: "700" },
  aiLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  aiLoadingText: { fontSize: 12 },
  aiErrorBox: { padding: 10, borderRadius: 8, borderWidth: 1 },
  aiErrorText: { fontSize: 11, lineHeight: 16 },
  aiRetryBtn: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  aiRetryText: { fontSize: 11, fontWeight: "700" },
  aiSection: { borderRadius: 8, padding: 10, borderWidth: 1 },
  aiSectionLabel: { fontSize: 10, fontWeight: "700", marginBottom: 4, letterSpacing: 0.5 },
  aiSectionText: { fontSize: 12, lineHeight: 17 },
  aiRefreshBtn: { marginTop: 10, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  aiRefreshText: { fontSize: 11, fontWeight: "600" },
  // Smart Call Time
  callTimeCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 12 },
  callTimeIcon: { fontSize: 16 },
  callTimeTitle: { fontWeight: "700", fontSize: 12 },
  callTimePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  callTimePillText: { fontSize: 11, fontWeight: "800" },
  callTimeReason: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  callTimeBtn: { marginTop: 10, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  callTimeBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  // Callback Matrix
  callbackBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 12 },
  callbackTitle: { fontSize: 13, fontWeight: "700" },
  callbackSub: { fontSize: 10, marginTop: 2 },
  callbackBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10 },
  callbackDot: { width: 8, height: 8, borderRadius: 4 },
  callbackBtnText: { fontSize: 11.5, fontWeight: "600" },
  callbackNext: { fontSize: 10, fontWeight: "700" },
  // Objection
  objBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 12 },
  objTitle: { fontWeight: "700", fontSize: 12 },
  objRow: { padding: 8, borderRadius: 8, marginTop: 6, borderWidth: 1 },
  objAnswer: { marginTop: 8, borderRadius: 8, padding: 10, borderWidth: 1 },
  objCopyBtn: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  objCopyText: { fontSize: 10, fontWeight: "700" },
  // Notes History
  notesBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 12 },
  notesTitle: { fontSize: 13, fontWeight: "700" },
  notesEmpty: { fontSize: 11, textAlign: "center", marginVertical: 10 },
  noteItem: { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 6, marginBottom: 6 },
  noteDate: { fontSize: 9, fontWeight: "700" },
  noteText: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  noteAddBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
});
