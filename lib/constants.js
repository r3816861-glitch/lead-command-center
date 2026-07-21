import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Linking,
  ActivityIndicator, Platform, KeyboardAvoidingView, SafeAreaView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

import {
  STATUS_ORDER, STATUS, INTEREST, PRODUCTS, BANKS, EMPLOYMENT, PROPERTY_TYPES,
  HOLD_LOST_REASONS, TIME_TAGS, OUTCOME_TAGS, OBJECTIONS, DEFAULT_SETTINGS,
  AI_PROVIDERS, MOCK_HOOKS, MOCK_COACH,
} from "../lib/constants";
import {
  uid, productCode, todayISO, addDays, isToday, fmtDateTime, urgency, U_STYLE,
  initials, daysSince, amtNum, buyingIntentScore, intentBand,
  quickParseDeterministic, whatsappTemplate, smsTemplate, leadsToCSV, emptyForm,
  formatINR, toRupees, fillTemplate,
} from "../lib/utils";
import { loadLeads, saveLeads, loadSettings, saveSettings } from "../lib/storage";

/* ============================== ROOT SCREEN ============================== */
export default function Index() {
  const [leads, setLeads] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState("pipeline");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [showQuick, setShowQuick] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dupWarning, setDupWarning] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    (async () => {
      const l = await loadLeads();
      setLeads(l);
      const s = await loadSettings(DEFAULT_SETTINGS);
      setSettings(s);
      setLoading(false);
    })();
  }, []);

  async function persist(next) {
    setLeads(next);
    setSaving(true); setSaveError(false);
    const ok = await saveLeads(next);
    setSaving(false); setSaveError(!ok);
  }
  async function retrySave() { setSaving(true); const ok = await saveLeads(leads); setSaving(false); setSaveError(!ok); }
  async function persistSettings(next) { setSettings(next); await saveSettings(next); }

  function openAdd() { setForm(emptyForm); setEditingId(null); setShowForm(true); }
  function openEdit(lead) { setForm({ ...emptyForm, ...lead }); setEditingId(lead.id); setShowForm(true); }

  function saveLead(force) {
    if (!form.name.trim() || !form.phone.trim()) return;
    if (!editingId && !force) {
      const dup = leads.find((l) => l.phone.replace(/\D/g, "") === form.phone.replace(/\D/g, "") && l.phone.trim());
      if (dup) { setDupWarning(dup); return; }
    }
    setDupWarning(null);
    const convertedAt = form.status === "converted" ? (form.convertedAt || Date.now()) : null;
    if (editingId) persist(leads.map((l) => (l.id === editingId ? { ...form, id: editingId, convertedAt } : l)));
    else {
      const hist = form.notes ? [{ date: Date.now(), note: form.notes }] : [];
      persist([...leads, { ...form, id: uid(), createdAt: Date.now(), history: hist, convertedAt }]);
    }
    setShowForm(false); setForm(emptyForm); setEditingId(null);
  }

  function deleteLead(id) { persist(leads.filter((l) => l.id !== id)); setDetailId(null); }
  function quickStatus(id, status) {
    persist(leads.map((l) => (l.id === id ? { ...l, status, convertedAt: status === "converted" ? (l.convertedAt || Date.now()) : l.convertedAt } : l)));
  }
  function addNoteToHistory(id, note) {
    if (!note.trim()) return;
    persist(leads.map((l) => (l.id === id ? { ...l, notes: note, history: [...(l.history || []), { date: Date.now(), note }] } : l)));
  }
  function applyOutcomeTag(id, tag) {
    persist(leads.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, notes: tag.note, history: [...(l.history || []), { date: Date.now(), note: tag.note }] };
      if (tag.status) { next.status = tag.status; if (tag.status === "converted") next.convertedAt = l.convertedAt || Date.now(); }
      if (tag.reason) next.reason = tag.reason;
      return next;
    }));
  }
  function applyTimeTag(id, days) {
    const date = addDays(days), note = `Agla call: ${days === 1 ? "kal" : days + " din baad"}`;
    persist(leads.map((l) => (l.id === id ? {
      ...l, nextCallDate: date, nextCallTime: l.nextCallTime || "11:00",
      status: ["converted", "lost"].includes(l.status) ? l.status : l.status === "new" ? "followup" : l.status,
      history: [...(l.history || []), { date: Date.now(), note }],
    } : l)));
  }

  function quickAddInstant() {
    if (!quickText.trim()) return;
    const parsed = quickParseDeterministic(quickText);
    const merged = { ...emptyForm, ...parsed, history: parsed.notes ? [{ date: Date.now(), note: parsed.notes }] : [] };
    setForm(merged); setEditingId(null); setShowQuick(false); setShowForm(true); setQuickText("");
  }

  // Full implementations — real API call when a key is set, clean deterministic
  // mock fallback when it isn't. Never throws unhandled, never leaves the UI stuck.
  async function callAI(systemPrompt, userContent, maxTokens) {
    const provider = AI_PROVIDERS.find((p) => p.id === settings.aiProvider) || AI_PROVIDERS[0];
    if (provider.id === "anthropic") {
      const res = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
      const data = await res.json();
      return (data.content || []).map((c) => c.text || "").join("").trim();
    } else {
      const res = await fetch(provider.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: maxTokens,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
      const data = await res.json();
      return (data.choices || []).map((c) => c.message?.content || "").join("").trim();
    }
  }

  async function generateHook(lead) {
    persist(leads.map((l) => (l.id === lead.id ? { ...l, hook: { loading: true } } : l)));
    if (!settings.apiKey) {
      const template = MOCK_HOOKS[lead.product] || MOCK_HOOKS.default;
      const text = fillTemplate(template, lead);
      persist(leads.map((l) => (l.id === lead.id ? { ...l, hook: { text, date: Date.now(), mock: true } } : l)));
      return;
    }
    try {
      const sys = "Tum ek elite loan-sales copywriter ho. Sirf EK line do — Hinglish mein, 8 second mein bola ja sake, customer ka dhyan turant kheeche. Product/profile ke hisaab se sharp aur specific ho, generic salesy line nahi. Sirf ye ek line return karo, koi quotes/markdown/extra text nahi.";
      const context = JSON.stringify({ name: lead.name, product: lead.product, bank: lead.bank, loanAmount: lead.loanAmount, employment: lead.employment, existingLoanRemarks: lead.existingLoanRemarks, interest: lead.interest });
      const text = (await callAI(sys, context, 120)).replace(/^["']|["']$/g, "");
      persist(leads.map((l) => (l.id === lead.id ? { ...l, hook: { text, date: Date.now() } } : l)));
    } catch (e) {
      const template = MOCK_HOOKS[lead.product] || MOCK_HOOKS.default;
      const text = fillTemplate(template, lead);
      persist(leads.map((l) => (l.id === lead.id ? { ...l, hook: { text, date: Date.now(), mock: true, fallbackFromError: true } } : l)));
    }
  }

  async function generateCoach(lead) {
    persist(leads.map((l) => (l.id === lead.id ? { ...l, aiSuggestion: { loading: true } } : l)));
    if (!settings.apiKey) {
      const text = MOCK_COACH[lead.status] || MOCK_COACH.new;
      persist(leads.map((l) => (l.id === lead.id ? { ...l, aiSuggestion: { text, date: Date.now(), mock: true } } : l)));
      return;
    }
    try {
      const recentHistory = [...(lead.history || [])].sort((a, b) => b.date - a.date).slice(0, 4).map((h) => h.note).join(" | ");
      const sys = "Tum senior loan sales manager ho jo Delhi-NCR DSA ko coach karte ho. Hinglish mein seedha, practical jawab do. Format: 1) situation ek line mein 2) agli call mein exactly kya bolna hai (2-3 lines) 3) objection kaise handle karna hai 4) kya avoid karna hai. Max 7 lines, plain text, ethical aur honest sales technique — kabhi bhi galat/deceptive jaankari customer ko dene ki salah mat do.";
      const context = JSON.stringify({ name: lead.name, product: lead.product, bank: lead.bank, loanAmount: lead.loanAmount, status: STATUS[lead.status]?.label, reason: lead.reason, interest: lead.interest, propertyType: lead.propertyType, employment: lead.employment, existingLoanRemarks: lead.existingLoanRemarks, recentHistory });
      const text = await callAI(sys, context, 500);
      persist(leads.map((l) => (l.id === lead.id ? { ...l, aiSuggestion: { text, date: Date.now() } } : l)));
    } catch (e) {
      const text = MOCK_COACH[lead.status] || MOCK_COACH.new;
      persist(leads.map((l) => (l.id === lead.id ? { ...l, aiSuggestion: { text, date: Date.now(), mock: true, fallbackFromError: true } } : l)));
    }
  }

  const filtered = useMemo(() => {
    let arr = leads;
    if (filterStatus !== "all") arr = arr.filter((l) => l.status === filterStatus);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter((l) => [l.name, l.phone, l.bank, l.product, l.location, l.businessName, l.propertyLocation].filter(Boolean).some((f) => f.toLowerCase().includes(s)));
    }
    return [...arr].sort((a, b) => {
      const da = fmtDateTime(a.nextCallDate, a.nextCallTime), db = fmtDateTime(b.nextCallDate, b.nextCallTime);
      if (!da && !db) return b.createdAt - a.createdAt;
      if (!da) return 1; if (!db) return -1;
      return da - db;
    });
  }, [leads, search, filterStatus]);

  const stats = useMemo(() => {
    const active = leads.filter((l) => !["converted", "lost"].includes(l.status)).length;
    const converted = leads.filter((l) => l.status === "converted").length;
    const closed = leads.filter((l) => ["converted", "lost"].includes(l.status)).length;
    const overdue = leads.filter((l) => urgency(l) === "overdue" && !["converted", "lost"].includes(l.status)).length;
    const today = leads.filter((l) => urgency(l) === "today" && !["converted", "lost"].includes(l.status)).length;
    const convRate = closed > 0 ? Math.round((converted / closed) * 100) : 0;
    const wonToday = leads.filter((l) => l.status === "converted" && isToday(l.convertedAt));
    const earnedToday = wonToday.reduce((s, l) => s + amtNum(l.loanAmount), 0) * (settings.commissionPct / 100) * 100000;
    const pipelineValue = leads.filter((l) => !["converted", "lost"].includes(l.status)).reduce((s, l) => s + amtNum(l.loanAmount), 0);
    const potentialToday = pipelineValue * (settings.commissionPct / 100) * 100000;
    return { active, converted, overdue, today, convRate, total: leads.length, earnedToday, potentialToday, wonTodayCount: wonToday.length };
  }, [leads, settings]);

  const priorityQueue = useMemo(() => leads.filter((l) => ["overdue", "today"].includes(urgency(l)) && !["converted", "lost"].includes(l.status))
    .sort((a, b) => fmtDateTime(a.nextCallDate, a.nextCallTime) - fmtDateTime(b.nextCallDate, b.nextCallTime)), [leads]);

  const detailLead = leads.find((l) => l.id === detailId);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color="#a78bfa" />
        <Text className="text-slate-500 mt-2">Loading War Room...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <Header stats={stats} settings={settings} onOpenSettings={() => setShowSettings(true)} />

      <View className="flex-row px-4 pt-3 gap-2">
        <TabBtn active={tab === "pipeline"} onPress={() => setTab("pipeline")} icon="grid-outline" label="Pipeline" />
        <TabBtn active={tab === "list"} onPress={() => setTab("list")} icon="list-outline" label="List" />
        <TabBtn active={tab === "insights"} onPress={() => setTab("insights")} icon="bar-chart-outline" label="Insights" />
        <TouchableOpacity onPress={() => setShowExport(true)} className="w-10 items-center justify-center">
          <Ionicons name="download-outline" size={17} color="#64748b" />
        </TouchableOpacity>
      </View>

      {tab !== "insights" && priorityQueue.length > 0 && (
        <View className="px-4 pt-4">
          <SectionTitle>⚡ Abhi Call Karo ({priorityQueue.length})</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {priorityQueue.map((lead) => {
              const u = urgency(lead);
              return (
                <TouchableOpacity key={lead.id} onPress={() => setDetailId(lead.id)} className="mr-2 w-52 rounded-xl p-3 bg-card border" style={{ borderColor: `${U_STYLE[u].color}55` }}>
                  <View className="flex-row items-center gap-2">
                    <Avatar name={lead.name} size={28} />
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-slate-100" numberOfLines={1}>{lead.name}</Text>
                      <Text style={{ color: U_STYLE[u].color, fontSize: 10 }} className="font-bold">
                        {U_STYLE[u].label} · {fmtDateTime(lead.nextCallDate, lead.nextCallTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {tab === "pipeline" && <PipelineView leads={leads} onCardClick={setDetailId} />}

      {tab === "list" && (
        <>
          <View className="px-4 pt-4 pb-2 flex-row gap-2">
            <View className="flex-1 flex-row items-center bg-card border border-line rounded-lg px-2.5">
              <Ionicons name="search" size={14} color="#64748b" />
              <TextInput value={search} onChangeText={setSearch} placeholder="Naam, phone, bank, area..." placeholderTextColor="#475569" className="flex-1 py-2 px-2 text-slate-100 text-sm" />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-2">
            <FilterChip label="Sab" active={filterStatus === "all"} onPress={() => setFilterStatus("all")} />
            {STATUS_ORDER.map((k) => <FilterChip key={k} label={STATUS[k].label} active={filterStatus === k} onPress={() => setFilterStatus(k)} />)}
          </ScrollView>
          <ScrollView className="px-4" contentContainerStyle={{ gap: 8, paddingBottom: 100 }}>
            {filtered.length === 0 && <Text className="text-center text-slate-600 text-sm py-10">{leads.length === 0 ? "Koi lead nahi hai. + dabao ya Quick Add use karo." : "Kuchh nahi mila."}</Text>}
            {filtered.map((lead) => <ListRow key={lead.id} lead={lead} onPress={() => setDetailId(lead.id)} />)}
          </ScrollView>
        </>
      )}

      {tab === "insights" && <InsightsView leads={leads} stats={stats} />}

      {saving && !saveError && (
        <View className="absolute bottom-24 left-4 right-4 bg-card border border-line rounded-lg p-2 flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color="#94a3b8" />
          <Text className="text-slate-400 text-xs">Save ho raha hai...</Text>
        </View>
      )}
      {saveError && (
        <View className="absolute bottom-24 left-4 right-4 bg-rose-950 border border-rose-800 rounded-lg p-2.5 flex-row items-center justify-between">
          <Text className="text-rose-400 text-xs flex-1 mr-2">Save nahi ho paaya, phone storage check karo.</Text>
          <TouchableOpacity onPress={retrySave} className="bg-rose-800 px-2.5 py-1 rounded-md"><Text className="text-rose-100 text-xs font-bold">Retry</Text></TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={() => setShowQuick(true)} className="absolute bottom-6 left-5 h-12 px-4 py-3 rounded-full bg-card border border-violet-800 flex-row items-center gap-2">
        <Ionicons name="sparkles" size={15} color="#a78bfa" />
        <Text className="text-violet-300 text-xs font-bold">Quick Add</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={openAdd} className="absolute bottom-6 right-5 w-14 h-14 rounded-full bg-violet-600 items-center justify-center">
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <QuickAddModal visible={showQuick} quickText={quickText} setQuickText={setQuickText} onClose={() => setShowQuick(false)} onSubmit={quickAddInstant} />
      <LeadFormModal visible={showForm} form={form} setForm={setForm} onSave={saveLead} onClose={() => { setShowForm(false); setEditingId(null); setDupWarning(null); }} isEdit={!!editingId} dupWarning={dupWarning} onCancelDup={() => setDupWarning(null)} />
      <ExportModal visible={showExport} leads={leads} onClose={() => setShowExport(false)} />
      <SettingsModal visible={showSettings} settings={settings} onSave={persistSettings} onClose={() => setShowSettings(false)} />
      {detailLead && (
        <DetailModal lead={detailLead} onClose={() => setDetailId(null)} onEdit={() => { openEdit(detailLead); setDetailId(null); }}
          onDelete={() => deleteLead(detailLead.id)} onQuickStatus={quickStatus} onAddNote={addNoteToHistory}
          onOutcomeTag={applyOutcomeTag} onTimeTag={applyTimeTag} hasApiKey={!!settings.apiKey}
          onGenerateHook={generateHook} onGenerateCoach={generateCoach} />
      )}
    </SafeAreaView>
  );
}

/* ============================== HEADER ============================== */
function Header({ stats, settings, onOpenSettings }) {
  return (
    <View className="px-4 pt-3 pb-4 border-b border-line" style={{ backgroundColor: "#0b0f1a" }}>
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-violet-400 font-bold" style={{ fontSize: 10, letterSpacing: 2 }}>RAJ · SALES WAR ROOM</Text>
          <Text className="text-white font-extrabold text-xl mt-0.5">Lead Command Center</Text>
        </View>
        <TouchableOpacity onPress={onOpenSettings} className="p-1"><Ionicons name="settings-outline" size={18} color="#64748b" /></TouchableOpacity>
      </View>

      <View className="mt-4 bg-card rounded-2xl p-3.5 border border-emerald-900">
        <View className="flex-row justify-between">
          <View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="trophy" size={11} color="#34d399" />
              <Text className="text-emerald-400 font-bold" style={{ fontSize: 10 }}>AAJ KI KAMAI (LOCKED)</Text>
            </View>
            <Text className="text-emerald-400 font-extrabold text-2xl mt-0.5">₹{Math.round(stats.earnedToday).toLocaleString("en-IN")}</Text>
            <Text className="text-slate-500 mt-0.5" style={{ fontSize: 10 }}>{stats.wonTodayCount} deal{stats.wonTodayCount === 1 ? "" : "s"} close aaj · @{settings.commissionPct}%</Text>
          </View>
          <View className="items-end">
            <Text className="text-slate-500 uppercase" style={{ fontSize: 9.5 }}>Pipeline potential</Text>
            <Text className="text-slate-300 font-bold text-sm">₹{Math.round(stats.potentialToday).toLocaleString("en-IN")}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-2 mt-3">
        <MicroStat label="Overdue" value={stats.overdue} color="#fb7185" />
        <MicroStat label="Aaj" value={stats.today} color="#fbbf24" />
        <MicroStat label="Active" value={stats.active} color="#38bdf8" />
        <MicroStat label="Conv." value={`${stats.convRate}%`} color="#a78bfa" />
      </View>
    </View>
  );
}
function MicroStat({ label, value, color }) {
  return (
    <View className="flex-1 bg-card rounded-xl p-2.5 border border-line items-center">
      <Text style={{ color }} className="font-extrabold text-lg">{value}</Text>
      <Text className="text-slate-500 uppercase" style={{ fontSize: 8.5 }}>{label}</Text>
    </View>
  );
}
function TabBtn({ active, onPress, icon, label }) {
  return (
    <TouchableOpacity onPress={onPress} className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg border ${active ? "bg-violet-950 border-violet-700" : "border-transparent"}`}>
      <Ionicons name={icon} size={14} color={active ? "#c4b5fd" : "#64748b"} />
      <Text className={active ? "text-violet-300 text-xs font-bold" : "text-slate-500 text-xs font-bold"}>{label}</Text>
    </TouchableOpacity>
  );
}
function SectionTitle({ children }) { return <Text className="text-slate-500 uppercase font-bold mb-2" style={{ fontSize: 10, letterSpacing: 0.5 }}>{children}</Text>; }
function Avatar({ name, size = 36 }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},55%,18%)`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: `hsl(${hue},80%,70%)`, fontSize: size * 0.36, fontWeight: "bold" }}>{initials(name)}</Text>
    </View>
  );
}
function IntentBadge({ score }) {
  const b = intentBand(score);
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name="locate" size={10} color={b.color} />
      <Text style={{ color: b.color, fontSize: 10 }} className="font-bold">{score}</Text>
    </View>
  );
}
function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} className={`px-3 py-1.5 rounded-full mr-1.5 border ${active ? "bg-violet-950 border-violet-700" : "border-line bg-card"}`}>
      <Text className={active ? "text-violet-300 text-xs font-bold" : "text-slate-400 text-xs"}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ============================== PIPELINE (Kanban) ============================== */
function PipelineView({ leads, onCardClick }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pt-4" contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
      {STATUS_ORDER.map((key) => {
        const col = leads.filter((l) => l.status === key).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const st = STATUS[key];
        return (
          <View key={key} style={{ width: 210 }}>
            <View className="flex-row items-center gap-1.5 mb-2 px-0.5">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st.color }} />
              <Text className="text-slate-200 text-xs font-bold">{st.label}</Text>
              <Text className="text-slate-500 ml-auto" style={{ fontSize: 10 }}>{col.length}</Text>
            </View>
            <View style={{ gap: 8 }}>
              {col.length === 0 && <View className="py-3 items-center border border-dashed border-line rounded-lg"><Text className="text-slate-700" style={{ fontSize: 10 }}>Khaali</Text></View>}
              {col.map((lead) => {
                const u = urgency(lead), score = buyingIntentScore(lead);
                return (
                  <TouchableOpacity key={lead.id} onPress={() => onCardClick(lead.id)} className="bg-card rounded-xl p-2.5 border border-line">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <Avatar name={lead.name} size={22} />
                      <Text className="text-slate-100 text-xs font-bold flex-1" numberOfLines={1}>{lead.name}</Text>
                    </View>
                    <Text className="text-slate-500 mb-1" style={{ fontSize: 10 }}>{productCode(lead.product)} · {lead.bank || "—"}</Text>
                    <View className="flex-row items-center justify-between">
                      {lead.loanAmount ? <Text className="text-emerald-400" style={{ fontSize: 10.5 }}>₹{lead.loanAmount}</Text> : <View />}
                      <IntentBadge score={score} />
                    </View>
                    {(u === "overdue" || u === "today") && (
                      <View className="mt-1.5 self-start px-1.5 py-0.5 rounded" style={{ backgroundColor: `${U_STYLE[u].color}20` }}>
                        <Text style={{ color: U_STYLE[u].color, fontSize: 9 }} className="font-bold">{U_STYLE[u].label}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

/* ============================== LIST ============================== */
function ListRow({ lead, onPress }) {
  const u = urgency(lead), st = STATUS[lead.status], dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
  const ds = daysSince(lead), stale = ds !== null && ds >= 4 && !["converted", "lost"].includes(lead.status);
  const score = buyingIntentScore(lead);
  return (
    <TouchableOpacity onPress={onPress} className="bg-card rounded-xl p-3 flex-row items-center gap-2.5 border border-line">
      <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: st.color }} />
      <Avatar name={lead.name} size={34} />
      <View className="flex-1">
        <Text className="text-slate-100 text-sm font-bold" numberOfLines={1}>{lead.name}</Text>
        <Text className="text-slate-500" style={{ fontSize: 10.5 }}>{productCode(lead.product)} · {lead.bank || "—"}{lead.loanAmount ? ` · ₹${lead.loanAmount}` : ""}</Text>
        {stale && <Text className="text-amber-400 font-bold mt-0.5" style={{ fontSize: 9.5 }}>⏱ {ds} din se contact nahi</Text>}
      </View>
      <View className="items-end">
        <IntentBadge score={score} />
        <View className="px-1.5 py-0.5 rounded mt-1" style={{ backgroundColor: `${st.color}25` }}>
          <Text style={{ color: st.color, fontSize: 9.5 }} className="font-bold">{st.label}</Text>
        </View>
        {dt && <Text style={{ color: U_STYLE[u].color, fontSize: 10 }} className="font-semibold mt-0.5">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>}
      </View>
    </TouchableOpacity>
  );
}

/* ============================== INSIGHTS ============================== */
function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <View className="mb-2.5">
      <View className="flex-row justify-between mb-1"><Text className="text-slate-300" style={{ fontSize: 11 }}>{label}</Text><Text className="text-slate-500" style={{ fontSize: 11 }}>{value}</Text></View>
      <View className="bg-slate-800 rounded" style={{ height: 6, overflow: "hidden" }}><View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} /></View>
    </View>
  );
}
function InsightsView({ leads, stats }) {
  const byStatus = STATUS_ORDER.map((k) => ({ k, count: leads.filter((l) => l.status === k).length }));
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count));
  const productMap = {}; leads.forEach((l) => { if (l.product) productMap[l.product] = (productMap[l.product] || 0) + 1; });
  const byProduct = Object.entries(productMap).sort((a, b) => b[1] - a[1]);
  const maxProduct = Math.max(1, ...byProduct.map((p) => p[1]));
  const bankMap = {}; leads.forEach((l) => { if (l.bank) bankMap[l.bank] = (bankMap[l.bank] || 0) + 1; });
  const byBank = Object.entries(bankMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxBank = Math.max(1, ...byBank.map((b) => b[1]));
  const reasonMap = {}; leads.filter((l) => ["hold", "lost"].includes(l.status) && l.reason).forEach((l) => { reasonMap[l.reason] = (reasonMap[l.reason] || 0) + 1; });
  const byReason = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);
  const maxReason = Math.max(1, ...byReason.map((r) => r[1]));
  const totalValueLakh = leads.filter((l) => !["converted", "lost"].includes(l.status)).reduce((s, l) => s + amtNum(l.loanAmount), 0);
  return (
    <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 100 }}>
      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 bg-card rounded-xl p-3.5 border border-line"><Text className="text-violet-400 font-extrabold text-xl">{stats.total}</Text><Text className="text-slate-500" style={{ fontSize: 10 }}>Total leads</Text></View>
        <View className="flex-1 bg-card rounded-xl p-3.5 border border-line"><Text className="text-emerald-400 font-extrabold text-xl">₹{totalValueLakh >= 100 ? (totalValueLakh / 100).toFixed(1) + "Cr" : totalValueLakh.toFixed(0) + "L"}</Text><Text className="text-slate-500" style={{ fontSize: 10 }}>Pipeline value (active)</Text></View>
      </View>
      <View className="bg-card rounded-xl p-3.5 border border-line mb-3.5"><SectionTitle>Funnel</SectionTitle>{byStatus.map((s) => <BarRow key={s.k} label={STATUS[s.k].label} value={s.count} max={maxStatus} color={STATUS[s.k].color} />)}</View>
      {byProduct.length > 0 && <View className="bg-card rounded-xl p-3.5 border border-line mb-3.5"><SectionTitle>Product-wise</SectionTitle>{byProduct.map(([p, c]) => <BarRow key={p} label={p} value={c} max={maxProduct} color="#38bdf8" />)}</View>}
      {byBank.length > 0 && <View className="bg-card rounded-xl p-3.5 border border-line mb-3.5"><SectionTitle>Bank-wise (top 6)</SectionTitle>{byBank.map(([b, c]) => <BarRow key={b} label={b} value={c} max={maxBank} color="#a78bfa" />)}</View>}
      {byReason.length > 0 && <View className="bg-card rounded-xl p-3.5 border border-line"><SectionTitle>Hold / Lost — kyun?</SectionTitle>{byReason.map(([r, c]) => <BarRow key={r} label={r} value={c} max={maxReason} color="#fb7185" />)}</View>}
      {leads.length === 0 && <Text className="text-center text-slate-600 text-sm py-8">Data aayega to yahan insights dikhengi.</Text>}
    </ScrollView>
  );
}

/* ============================== QUICK ADD ============================== */
function QuickAddModal({ visible, quickText, setQuickText, onClose, onSubmit }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="bg-card rounded-t-2xl p-4 border-t border-violet-900" style={{ paddingBottom: 28 }}>
            <View className="flex-row justify-between items-center mb-2.5">
              <View className="flex-row items-center gap-1.5"><Ionicons name="sparkles" size={15} color="#a78bfa" /><Text className="text-slate-100 font-bold text-sm">Jaldi Add Karo</Text></View>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color="#64748b" /></TouchableOpacity>
            </View>
            <TextInput
              value={quickText} onChangeText={setQuickText} multiline numberOfLines={5}
              placeholder={"e.g.\n9013427441 Rampal Goyal\nReq- 1cr lap\nProperty - Mayur Vihar commercial\nM.V - 1.5cr\nITR- 7 lakh\nkal 4 baje baat karni hai..."}
              placeholderTextColor="#475569"
              className="border border-line rounded-xl p-2.5 bg-slate-900 text-slate-100 text-sm"
              style={{ minHeight: 110, textAlignVertical: "top" }}
            />
            <Text className="text-slate-600 mt-1.5" style={{ fontSize: 10 }}>Turant fields bhar jayenge — koi wait nahi karna padega.</Text>
            <TouchableOpacity onPress={onSubmit} disabled={!quickText.trim()} className={`mt-2.5 py-3 rounded-xl items-center flex-row justify-center gap-1.5 ${quickText.trim() ? "bg-violet-600" : "bg-slate-800"}`}>
              <Ionicons name="sparkles" size={14} color={quickText.trim() ? "#fff" : "#475569"} />
              <Text className={quickText.trim() ? "text-white font-bold text-sm" : "text-slate-600 font-bold text-sm"}>Auto-fill karo</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ============================== EXPORT / SETTINGS ============================== */
function ExportModal({ visible, leads, onClose }) {
  const [copied, setCopied] = useState(false);
  const csv = leadsToCSV(leads);
  async function copy() { await Clipboard.setStringAsync(csv); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="bg-card rounded-t-2xl p-4 border-t border-line" style={{ maxHeight: "75%", paddingBottom: 28 }}>
          <View className="flex-row justify-between items-center mb-2"><Text className="text-slate-100 font-bold text-sm">Export ({leads.length} leads)</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color="#64748b" /></TouchableOpacity></View>
          <Text className="text-slate-500 mb-2" style={{ fontSize: 11 }}>Copy karke Excel/Google Sheets mein paste kar do.</Text>
          <ScrollView className="bg-slate-900 border border-line rounded-lg p-2" style={{ maxHeight: 220 }}>
            <Text className="text-slate-400" style={{ fontSize: 10 }}>{csv}</Text>
          </ScrollView>
          <TouchableOpacity onPress={copy} className="mt-2.5 py-3 rounded-xl bg-violet-600 items-center flex-row justify-center gap-1.5">
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color="#fff" />
            <Text className="text-white font-bold text-sm">{copied ? "Copied!" : "Copy CSV"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
function SettingsModal({ visible, settings, onSave, onClose }) {
  const [pct, setPct] = useState(String(settings.commissionPct));
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [provider, setProvider] = useState(settings.aiProvider || "anthropic");
  useEffect(() => { setPct(String(settings.commissionPct)); setApiKey(settings.apiKey || ""); setProvider(settings.aiProvider || "anthropic"); }, [settings, visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="bg-card rounded-t-2xl p-4 border-t border-line" style={{ paddingBottom: 28 }}>
            <View className="flex-row justify-between items-center mb-3"><Text className="text-slate-100 font-bold text-sm">Settings</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color="#64748b" /></TouchableOpacity></View>
            <Text className="text-slate-500 mb-1.5 font-semibold" style={{ fontSize: 11 }}>Commission % (loan amount pe) — "Aaj Ki Kamai" isi se calculate hoti hai</Text>
            <TextInput value={pct} onChangeText={setPct} keyboardType="numeric" className="bg-slate-900 border border-line rounded-lg p-2.5 text-slate-100 text-sm mb-3" />

            <Text className="text-slate-500 mb-1.5 font-semibold" style={{ fontSize: 11 }}>AI Provider (Smart Hook + AI Coach ke liye)</Text>
            <View className="flex-row gap-2 mb-3">
              {AI_PROVIDERS.map((p) => (
                <TouchableOpacity key={p.id} onPress={() => setProvider(p.id)} className={`flex-1 py-2.5 rounded-lg border items-center ${provider === p.id ? "bg-violet-950 border-violet-700" : "border-line bg-slate-900"}`}>
                  <Text className={provider === p.id ? "text-violet-300 font-bold" : "text-slate-400"} style={{ fontSize: 12 }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-slate-500 mb-1.5 font-semibold" style={{ fontSize: 11 }}>{provider === "anthropic" ? "Anthropic" : "OpenAI"} API Key (optional — AI Coach/Hook features ke liye)</Text>
            <TextInput value={apiKey} onChangeText={setApiKey} secureTextEntry placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."} placeholderTextColor="#475569" className="bg-slate-900 border border-line rounded-lg p-2.5 text-slate-100 text-sm mb-1" />
            <Text className="text-slate-600 mb-3" style={{ fontSize: 9.5 }}>Bina key ke bhi poora CRM (Quick Add, Pipeline, Objection Destroyer, Call/WhatsApp/SMS) kaam karta hai — AI Hook/Coach bina key ke bhi chalte hain, bas generic templates ke saath instead of live AI.</Text>
            <TouchableOpacity onPress={() => { onSave({ ...settings, commissionPct: parseFloat(pct) || 0, apiKey, aiProvider: provider }); onClose(); }} className="py-3 rounded-xl bg-violet-600 items-center">
              <Text className="text-white font-bold text-sm">Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ============================== SELECT FIELD (custom modal picker) ============================== */
function SelectField({ label, value, options, onChange, placeholder = "— Select —" }) {
  const [open, setOpen] = useState(false);
  const display = value || placeholder;
  return (
    <View className="flex-1">
      <Text className="text-slate-500 mb-1 font-semibold" style={{ fontSize: 11 }}>{label}</Text>
      <TouchableOpacity onPress={() => setOpen(true)} className="p-2.5 rounded-lg border border-line bg-slate-900 flex-row justify-between items-center">
        <Text className={value ? "text-slate-100" : "text-slate-600"} style={{ fontSize: 13.5 }} numberOfLines={1}>{display}</Text>
        <Ionicons name="chevron-down" size={14} color="#64748b" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity className="flex-1 bg-black/70 justify-center px-8" activeOpacity={1} onPress={() => setOpen(false)}>
          <View className="bg-card rounded-xl border border-line" style={{ maxHeight: 380 }}>
            <ScrollView>
              <TouchableOpacity onPress={() => { onChange(""); setOpen(false); }} className="p-3 border-b border-line">
                <Text className="text-slate-500 text-sm">{placeholder}</Text>
              </TouchableOpacity>
              {options.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => { onChange(opt); setOpen(false); }} className="p-3 border-b border-line">
                  <Text className={opt === value ? "text-violet-300 text-sm font-bold" : "text-slate-200 text-sm"}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ============================== LEAD FORM ============================== */
function LeadFormModal({ visible, form, setForm, onSave, onClose, isEdit, dupWarning, onCancelDup }) {
  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }
  const showReason = form.status === "hold" || form.status === "lost";
  const canSave = form.name.trim() && form.phone.trim();
  const inputCls = "p-2.5 rounded-lg border border-line bg-slate-900 text-slate-100 text-sm";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="bg-card rounded-t-2xl border-t border-violet-900" style={{ maxHeight: "92%" }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-100 font-bold text-base">{isEdit ? "Lead Edit Karo" : "Naya Lead — Check & Save"}</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color="#64748b" /></TouchableOpacity>
            </View>

            {dupWarning && (
              <View className="mb-3 bg-rose-950 border border-rose-800 rounded-lg p-2.5">
                <View className="flex-row items-center gap-1.5 mb-1"><Ionicons name="warning" size={13} color="#fbbf24" /><Text className="text-amber-400 font-bold" style={{ fontSize: 12 }}>Ye number pehle se hai</Text></View>
                <Text className="text-slate-300 mb-2" style={{ fontSize: 12 }}>{dupWarning.name} ke naam se already ek lead hai isi phone number pe.</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={onCancelDup} className="flex-1 py-1.5 rounded-lg border border-line items-center"><Text className="text-slate-300" style={{ fontSize: 11 }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => onSave(true)} className="flex-1 py-1.5 rounded-lg bg-amber-500 items-center"><Text className="text-slate-950 font-bold" style={{ fontSize: 11 }}>Phir Bhi Add Karo</Text></TouchableOpacity>
                </View>
              </View>
            )}

            <SectionTitle>Basic</SectionTitle>
            <FieldLabel label="Customer ka naam *"><TextInput value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Rampal Goyal" placeholderTextColor="#475569" className={inputCls} /></FieldLabel>
            <View className="flex-row gap-2.5 mt-3">
              <FieldLabel label="Phone *" style={{ flex: 1 }}><TextInput value={form.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="98xxxxxxxx" placeholderTextColor="#475569" className={inputCls} /></FieldLabel>
              <FieldLabel label="Alt phone" style={{ flex: 1 }}><TextInput value={form.altPhone} onChangeText={(v) => set("altPhone", v)} keyboardType="phone-pad" className={inputCls} /></FieldLabel>
            </View>
            <View className="flex-row gap-2.5 mt-3">
              <SelectField label="Product" value={form.product} options={PRODUCTS.map((p) => p.v)} onChange={(v) => set("product", v)} />
              <SelectField label="Bank" value={form.bank} options={BANKS} onChange={(v) => set("bank", v)} />
            </View>
            <View className="flex-row gap-2.5 mt-3">
              <FieldLabel label="Requirement (amount)" style={{ flex: 1 }}><TextInput value={form.loanAmount} onChangeText={(v) => set("loanAmount", v)} placeholder="e.g. 1 Cr" placeholderTextColor="#475569" className={inputCls} /></FieldLabel>
              <FieldLabel label="Area / Location" style={{ flex: 1 }}><TextInput value={form.location} onChangeText={(v) => set("location", v)} className={inputCls} /></FieldLabel>
            </View>
            <View className="mt-3"><FieldLabel label="Business naam (optional)"><TextInput value={form.businessName} onChangeText={(v) => set("businessName", v)} className={inputCls} /></FieldLabel></View>

            <View className="mt-4"><SectionTitle>Property & Underwriting</SectionTitle></View>
            <View className="flex-row gap-2.5">
              <SelectField label="Property type" value={form.propertyType} options={PROPERTY_TYPES} onChange={(v) => set("propertyType", v)} />
              <FieldLabel label="Property location" style={{ flex: 1 }}><TextInput value={form.propertyLocation} onChangeText={(v) => set("propertyLocation", v)} className={inputCls} /></FieldLabel>
            </View>
            <View className="flex-row gap-2.5 mt-3">
              <FieldLabel label="Market Value" style={{ flex: 1 }}><TextInput value={form.marketValue} onChangeText={(v) => set("marketValue", v)} placeholder="e.g. 1.5 Cr" placeholderTextColor="#475569" className={inputCls} /></FieldLabel>
              <FieldLabel label="ITR" style={{ flex: 1 }}><TextInput value={form.itr} onChangeText={(v) => set("itr", v)} placeholder="e.g. 7 Lakh" placeholderTextColor="#475569" className={inputCls} /></FieldLabel>
            </View>
            <View className="flex-row gap-2.5 mt-3">
              <SelectField label="Employment / N.O.B." value={form.employment} options={EMPLOYMENT} onChange={(v) => set("employment", v)} />
              <FieldLabel label="Co-applicant" style={{ flex: 1 }}><TextInput value={form.coApplicant} onChangeText={(v) => set("coApplicant", v)} className={inputCls} /></FieldLabel>
            </View>
            <View className="mt-3"><FieldLabel label="Existing loan bank"><TextInput value={form.existingLoanBank} onChangeText={(v) => set("existingLoanBank", v)} className={inputCls} /></FieldLabel></View>
            <View className="mt-3"><FieldLabel label="Existing loan remarks"><TextInput value={form.existingLoanRemarks} onChangeText={(v) => set("existingLoanRemarks", v)} multiline numberOfLines={2} className={inputCls} style={{ minHeight: 60, textAlignVertical: "top" }} /></FieldLabel></View>

            <View className="mt-4"><SectionTitle>Status & Follow-up</SectionTitle></View>
            <View className="flex-row gap-2.5">
              <SelectField label="Status" value={STATUS[form.status]?.label} options={STATUS_ORDER.map((k) => STATUS[k].label)} onChange={(label) => { const k = STATUS_ORDER.find((k) => STATUS[k].label === label); if (k) set("status", k); }} />
              <SelectField label="Interest" value={INTEREST[form.interest]?.label} options={Object.keys(INTEREST).map((k) => INTEREST[k].label)} onChange={(label) => { const k = Object.keys(INTEREST).find((k) => INTEREST[k].label === label); if (k) set("interest", k); }} />
            </View>
            {showReason && <View className="mt-3"><SelectField label="Reason (Hold/Lost)" value={form.reason} options={HOLD_LOST_REASONS} onChange={(v) => set("reason", v)} /></View>}
            <View className="flex-row gap-2.5 mt-3">
              <FieldLabel label="Next call date (YYYY-MM-DD)" style={{ flex: 1 }}><TextInput value={form.nextCallDate} onChangeText={(v) => set("nextCallDate", v)} placeholder={todayISO()} placeholderTextColor="#475569" className={inputCls} /></FieldLabel>
              <FieldLabel label="Next call time (HH:MM)" style={{ flex: 1 }}><TextInput value={form.nextCallTime} onChangeText={(v) => set("nextCallTime", v)} placeholder="14:00" placeholderTextColor="#475569" className={inputCls} /></FieldLabel>
            </View>
            <View className="mt-3"><FieldLabel label="Notes / remarks"><TextInput value={form.notes} onChangeText={(v) => set("notes", v)} multiline numberOfLines={3} className={inputCls} style={{ minHeight: 70, textAlignVertical: "top" }} /></FieldLabel></View>

            <TouchableOpacity onPress={() => onSave()} disabled={!canSave} className={`mt-5 py-3.5 rounded-xl items-center ${canSave ? "bg-violet-600" : "bg-slate-800"}`}>
              <Text className={canSave ? "text-white font-bold text-sm" : "text-slate-600 font-bold text-sm"}>{isEdit ? "Update Karo" : "Lead Add Karo"}</Text>
            </TouchableOpacity>
            {!canSave && <Text className="text-amber-400 text-center mt-1.5" style={{ fontSize: 11 }}>Naam aur phone number zaroori hai — upar bhar do.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
function FieldLabel({ label, children, style }) {
  return <View style={style}><Text className="text-slate-500 mb-1 font-semibold" style={{ fontSize: 11 }}>{label}</Text>{children}</View>;
}

/* ============================== DETAIL MODAL ============================== */
function DetailModal({ lead, onClose, onEdit, onDelete, onQuickStatus, onAddNote, onOutcomeTag, onTimeTag, hasApiKey, onGenerateHook, onGenerateCoach }) {
  const [noteDraft, setNoteDraft] = useState("");
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [activeObjection, setActiveObjection] = useState(null);
  const [objCopied, setObjCopied] = useState(false);
  const [hookCopied, setHookCopied] = useState(false);
  const [coachCopied, setCoachCopied] = useState(false);
  const u = urgency(lead), dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
  const interest = INTEREST[lead.interest] || INTEREST.warm;
  const history = [...(lead.history || [])].sort((a, b) => b.date - a.date);
  const hasUW = lead.propertyType || lead.propertyLocation || lead.marketValue || lead.employment || lead.itr || lead.coApplicant || lead.existingLoanBank;
  const score = buyingIntentScore(lead), band = intentBand(score);
  const hook = lead.hook, coach = lead.aiSuggestion;

  function rebuttalText(a) { return a.replace("{{BANK}}", lead.bank || "partner bank"); }
  function call() { Linking.openURL(`tel:${lead.phone}`); }
  function whatsapp() { Linking.openURL(`https://wa.me/91${lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappTemplate(lead))}`); }
  function sms() { Linking.openURL(`sms:${lead.phone}?body=${encodeURIComponent(smsTemplate(lead))}`); }
  async function copyObjection() { await Clipboard.setStringAsync(rebuttalText(OBJECTIONS[activeObjection].a)); setObjCopied(true); setTimeout(() => setObjCopied(false), 1500); }
  async function copyHook() { await Clipboard.setStringAsync(hook.text); setHookCopied(true); setTimeout(() => setHookCopied(false), 1500); }
  async function copyCoach() { await Clipboard.setStringAsync(coach.text); setCoachCopied(true); setTimeout(() => setCoachCopied(false), 1500); }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="bg-card rounded-t-2xl border-t border-violet-900" style={{ maxHeight: "90%" }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
            <View className="flex-row items-center gap-2.5 mb-3">
              <Avatar name={lead.name} size={44} />
              <View className="flex-1">
                <Text className="text-slate-100 font-bold text-base">{lead.name}</Text>
                <Text className="text-slate-500" style={{ fontSize: 11 }}>{productCode(lead.product)} · {lead.bank || "—"}</Text>
              </View>
              <View className="items-end mr-1">
                <View className="flex-row items-center gap-1"><Ionicons name="locate" size={12} color={band.color} /><Text style={{ color: band.color, fontSize: 14 }} className="font-extrabold">{score}</Text></View>
                <Text className="text-slate-500 uppercase" style={{ fontSize: 8.5 }}>{band.label} Intent</Text>
              </View>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color="#64748b" /></TouchableOpacity>
            </View>

            {dt && (
              <View className="rounded-lg p-2.5 mb-3 flex-row justify-between items-center border" style={{ backgroundColor: `${U_STYLE[u].color}18`, borderColor: `${U_STYLE[u].color}55` }}>
                <Text style={{ color: U_STYLE[u].color, fontSize: 12 }} className="font-bold">{U_STYLE[u].label || "Next call"}</Text>
                <Text className="text-slate-200" style={{ fontSize: 12 }}>{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            )}

            {!hasApiKey && (
              <View className="rounded-xl p-3 mb-3 border border-slate-800 bg-slate-900">
                <Text className="text-slate-500" style={{ fontSize: 11 }}>💡 Abhi generic templates use ho rahe hain Hook/Coach ke liye. Settings mein API key daaloge to live AI-generated versions milenge, specific tumhare is lead ke liye.</Text>
              </View>
            )}

            {/* Smart Hook Generator */}
            <View className="rounded-xl p-3 mb-3 border border-sky-900 bg-slate-900">
              <View className="flex-row justify-between items-center mb-1.5">
                <View className="flex-row items-center gap-1.5"><Ionicons name="flash" size={13} color="#38bdf8" /><Text className="text-sky-400 font-bold" style={{ fontSize: 12 }}>Smart Hook (opening line)</Text></View>
                <TouchableOpacity onPress={() => onGenerateHook(lead)} disabled={hook && hook.loading} className="px-2 py-1 rounded-md border border-sky-800">
                  {hook && hook.loading ? <ActivityIndicator size="small" color="#38bdf8" /> : <Text className="text-sky-400 font-bold" style={{ fontSize: 10 }}>{hook ? "Refresh" : "Generate"}</Text>}
                </TouchableOpacity>
              </View>
              {hook && !hook.loading && hook.text && (
                <View>
                  <Text className="text-slate-100 italic" style={{ fontSize: 13 }}>"{hook.text}"</Text>
                  {hook.mock && <Text className="text-slate-600 mt-1" style={{ fontSize: 9.5 }}>{hook.fallbackFromError ? "AI call fail hui, generic template use ho raha hai" : "Generic template — API key add karo live AI ke liye"}</Text>}
                  <TouchableOpacity onPress={copyHook} className="flex-row items-center gap-1 mt-1.5">
                    <Ionicons name={hookCopied ? "checkmark" : "copy-outline"} size={10} color="#64748b" />
                    <Text className="text-slate-500" style={{ fontSize: 10 }}>{hookCopied ? "Copied" : "Copy"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Objection Destroyer */}
            <View className="rounded-xl p-3 mb-3 border border-rose-900 bg-slate-900">
              <TouchableOpacity onPress={() => setObjectionOpen((o) => !o)} className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-1.5"><Ionicons name="shield-checkmark" size={14} color="#fb7185" /><Text className="text-rose-400 font-bold" style={{ fontSize: 12 }}>Objection Destroyer</Text></View>
                <Ionicons name={objectionOpen ? "chevron-up" : "chevron-down"} size={14} color="#64748b" />
              </TouchableOpacity>
              {objectionOpen && (
                <View className="mt-2" style={{ gap: 4 }}>
                  {OBJECTIONS.map((o, i) => (
                    <TouchableOpacity key={i} onPress={() => setActiveObjection(activeObjection === i ? null : i)} className={`px-2.5 py-2 rounded-lg border ${activeObjection === i ? "border-rose-700 bg-rose-950" : "border-line"}`}>
                      <Text className={activeObjection === i ? "text-rose-200" : "text-slate-300"} style={{ fontSize: 11.5 }}>{o.q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {activeObjection !== null && (
                <View className="mt-2 bg-slate-950 border border-rose-800 rounded-lg p-2.5">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-rose-400 font-bold uppercase" style={{ fontSize: 9.5 }}>Rebuttal</Text>
                    <TouchableOpacity onPress={copyObjection} className="flex-row items-center gap-1">
                      <Ionicons name={objCopied ? "checkmark" : "copy-outline"} size={11} color="#fb7185" />
                      <Text className="text-rose-400" style={{ fontSize: 10 }}>{objCopied ? "Copied" : "Copy"}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-slate-100" style={{ fontSize: 12.5, lineHeight: 18 }}>{rebuttalText(OBJECTIONS[activeObjection].a)}</Text>
                </View>
              )}
            </View>

            <SectionTitle>Call ke baad — 1 tap mein log karo</SectionTitle>
            <View className="flex-row flex-wrap gap-1.5 mb-2">
              {TIME_TAGS.map((t) => (
                <TouchableOpacity key={t.label} onPress={() => onTimeTag(lead.id, t.days)} className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-slate-900">
                  <Ionicons name="time-outline" size={12} color="#94a3b8" />
                  <Text className="text-slate-300 font-semibold" style={{ fontSize: 11 }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row flex-wrap gap-1.5 mb-3.5">
              {OUTCOME_TAGS.map((t) => (
                <TouchableOpacity key={t.label} onPress={() => onOutcomeTag(lead.id, t)} className="px-2.5 py-1.5 rounded-lg border bg-slate-900" style={{ borderColor: `${t.color}55` }}>
                  <Text style={{ color: t.color, fontSize: 11 }} className="font-bold">{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* AI Sales Coach */}
            <View className="rounded-xl p-3 mb-3.5 border border-violet-900 bg-slate-900">
              <View className="flex-row justify-between items-center mb-1.5">
                <View className="flex-row items-center gap-1.5"><Ionicons name="bulb" size={13} color="#a78bfa" /><Text className="text-violet-400 font-bold" style={{ fontSize: 12 }}>AI Sales Coach</Text></View>
                <TouchableOpacity onPress={() => onGenerateCoach(lead)} disabled={coach && coach.loading} className="px-2 py-1 rounded-md border border-violet-800">
                  {coach && coach.loading ? <ActivityIndicator size="small" color="#a78bfa" /> : <Text className="text-violet-400 font-bold" style={{ fontSize: 10 }}>{coach ? "Refresh" : "Suggest karo"}</Text>}
                </TouchableOpacity>
              </View>
              {coach && !coach.loading && coach.text && (
                <View>
                  <Text className="text-slate-100" style={{ fontSize: 12.5, lineHeight: 18 }}>{coach.text}</Text>
                  {coach.mock && <Text className="text-slate-600 mt-1.5" style={{ fontSize: 9.5 }}>{coach.fallbackFromError ? "AI call fail hui, generic advice use ho raha hai" : "Generic advice — API key add karo pipeline-specific coaching ke liye"}</Text>}
                  <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-slate-600" style={{ fontSize: 9.5 }}>{new Date(coach.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                    <TouchableOpacity onPress={copyCoach} className="flex-row items-center gap-1">
                      <Ionicons name={coachCopied ? "checkmark" : "copy-outline"} size={11} color="#64748b" />
                      <Text className="text-slate-500" style={{ fontSize: 10 }}>{coachCopied ? "Copied" : "Copy"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>


            <View className="flex-col gap-1.5 mb-3">
              <Row icon="call-outline" text={lead.phone} />
              {lead.altPhone ? <Row icon="call-outline" text={`${lead.altPhone} (alt)`} /> : null}
              {lead.location ? <Row icon="location-outline" text={lead.location} /> : null}
              {lead.businessName ? <Row icon="business-outline" text={lead.businessName} /> : null}
              {lead.loanAmount ? <Row icon="cash-outline" text={`Requirement: ₹${lead.loanAmount}`} /> : null}
            </View>

            {hasUW && (
              <View className="bg-slate-900 border border-line rounded-lg p-2.5 mb-3">
                <SectionTitle>Property & Underwriting</SectionTitle>
                <View style={{ gap: 6 }}>
                  {(lead.propertyType || lead.propertyLocation) ? <Row icon="business-outline" text={`${lead.propertyType || ""}${lead.propertyType && lead.propertyLocation ? " — " : ""}${lead.propertyLocation || ""}`} /> : null}
                  {lead.marketValue ? <Row icon="cash-outline" text={`M.V. ₹${lead.marketValue}`} /> : null}
                  {lead.employment ? <Row icon="briefcase-outline" text={lead.employment} /> : null}
                  {lead.itr ? <Row icon="document-text-outline" text={`ITR ₹${lead.itr}`} /> : null}
                  {lead.coApplicant ? <Row icon="people-outline" text={`Co-applicant: ${lead.coApplicant}`} /> : null}
                  {(lead.existingLoanBank || lead.existingLoanRemarks) ? <Row icon="bookmark-outline" text={`${lead.existingLoanBank ? lead.existingLoanBank + " — " : ""}${lead.existingLoanRemarks || ""}`} /> : null}
                </View>
              </View>
            )}

            {lead.reason ? (
              <View className="mb-3 self-start bg-rose-950 px-2.5 py-1 rounded-md">
                <Text className="text-rose-400" style={{ fontSize: 11 }}>Reason: {lead.reason}</Text>
              </View>
            ) : null}

            <SectionTitle>Status badlo</SectionTitle>
            <View className="flex-row flex-wrap gap-1.5 mb-4">
              {STATUS_ORDER.map((k) => (
                <TouchableOpacity key={k} onPress={() => onQuickStatus(lead.id, k)} className="px-2.5 py-1.5 rounded-lg border" style={{ borderColor: lead.status === k ? STATUS[k].color : "#1e293b" }}>
                  <Text style={{ color: lead.status === k ? STATUS[k].color : "#64748b", fontSize: 11 }} className="font-semibold">{STATUS[k].label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {history.length > 0 && (
              <View className="mb-3">
                <SectionTitle>Baat-cheet ki history</SectionTitle>
                <View style={{ gap: 6 }}>
                  {history.map((h, i) => (
                    <View key={i} className="bg-slate-900 border border-line rounded-lg p-2">
                      <Text className="text-slate-600 mb-0.5" style={{ fontSize: 9.5 }}>{new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, {new Date(h.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                      <Text className="text-slate-300" style={{ fontSize: 12.5, lineHeight: 18 }}>{h.note}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View className="flex-row gap-1.5 mb-3 items-center">
              <TextInput value={noteDraft} onChangeText={setNoteDraft} placeholder="Nayi update likho..." placeholderTextColor="#475569" className="flex-1 bg-slate-900 border border-line rounded-lg p-2 text-slate-100" style={{ fontSize: 12.5 }} />
              <TouchableOpacity onPress={() => { onAddNote(lead.id, noteDraft); setNoteDraft(""); }} disabled={!noteDraft.trim()} className={`px-3 py-2 rounded-lg ${noteDraft.trim() ? "bg-violet-600" : "bg-slate-800"}`}>
                <Text className={noteDraft.trim() ? "text-white font-bold" : "text-slate-600 font-bold"} style={{ fontSize: 12 }}>Add</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-1.5">
              <TouchableOpacity onPress={onEdit} className="flex-1 py-2.5 rounded-lg border border-line items-center"><Text className="text-slate-300 font-semibold" style={{ fontSize: 11 }}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={call} className="flex-1 py-2.5 rounded-lg bg-violet-600 items-center flex-row justify-center gap-1"><Ionicons name="call" size={12} color="#fff" /><Text className="text-white font-bold" style={{ fontSize: 11 }}>Call</Text></TouchableOpacity>
              <TouchableOpacity onPress={whatsapp} className="flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-1" style={{ backgroundColor: "#16a34a" }}><Ionicons name="logo-whatsapp" size={12} color="#fff" /><Text className="text-white font-bold" style={{ fontSize: 11 }}>WA</Text></TouchableOpacity>
              <TouchableOpacity onPress={sms} className="flex-1 py-2.5 rounded-lg border border-line items-center flex-row justify-center gap-1"><Ionicons name="chatbox-outline" size={12} color="#cbd5e1" /><Text className="text-slate-300 font-bold" style={{ fontSize: 11 }}>SMS</Text></TouchableOpacity>
              <TouchableOpacity onPress={onDelete} className="px-3 py-2.5 rounded-lg border border-rose-900 bg-rose-950"><Text className="text-rose-400" style={{ fontSize: 11 }}>Del</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
function Row({ icon, text }) {
  if (!text || !String(text).trim()) return null;
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon} size={13} color="#64748b" />
      <Text className="text-slate-300" style={{ fontSize: 13 }}>{text}</Text>
    </View>
  );
}
