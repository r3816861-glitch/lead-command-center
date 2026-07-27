import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Linking,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ============================== CONSTANTS ============================== */
const STATUS_ORDER = ["new", "followup", "callback", "hold", "converted", "lost"];
const STATUS = {
  new: { label: "Naya", color: "#38bdf8" },
  followup: { label: "Follow-up", color: "#fbbf24" },
  callback: { label: "Callback", color: "#a78bfa" },
  hold: { label: "Hold", color: "#94a3b8" },
  converted: { label: "Won", color: "#34d399" },
  lost: { label: "Lost", color: "#fb7185" },
};
const PRODUCTS = [
  { v: "Home Loan (Fresh)", c: "HL" }, { v: "Home Loan BT", c: "HL BT" },
  { v: "LAP (Fresh)", c: "LAP" }, { v: "LAP Balance Transfer", c: "LAP BT" },
  { v: "MSME Loan (Fresh)", c: "MSME" }, { v: "Top-up Loan", c: "Top-up" },
];
const BANKS = ["HDFC", "ICICI", "Axis Bank", "Kotak Mahindra", "IIFL", "Federal Bank", "SBI", "Other"];
const OBJECTIONS = [
  { q: "Interest rate zyada hai", a: "Sirf rate mat dekho — total processing cost aur top-up flexibility dekho. Main aapko exact comparison bana ke doon dono banks ka." },
  { q: "Pehle se dusre bank se loan hai", a: "Bilkul, isiliye toh Balance Transfer hai — aapki EMI kam ho sakti hai aur upar se top-up bhi mil sakta hai." },
  { q: "Sochna hai / abhi busy hoon", a: "Bilkul soch lijiye — main sirf documents ke basis pe ek pre-approval nikaal ke rakhta hoon, koi commitment nahi hai." },
  { q: "Documents ka jhanjhat hai", a: "Sirf 4-5 documents chahiye, aur main khud aake collect kar lunga." },
  { q: "Family se puchna hai", a: "Bilkul sahi approach hai. Main summary WhatsApp pe bhej deta hoon, dikhana easy ho jayega." },
  { q: "Trust nahi hai", a: "Main authorized DSA hoon — loan seedha bank se sanction hota hai, aap branch mein bhi verify kar sakte hain." },
  { q: "EMI bahut bhaari hai", a: "Isi wajah se restructuring dekhna chahiye — tenure adjust karke EMI kam ho sakti hai." },
  { q: "Documents complete nahi hain", a: "Koi baat nahi, jo hai wahi bhejo — baaki main bata dunga kya arrange karna hai." },
];

/* ============================== HELPERS ============================== */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function productCode(v) { const f = PRODUCTS.find((p) => p.v === v); return f ? f.c : (v || "—"); }
function fmtDateTime(d, t) { if (!d) return null; return new Date(`${d}T${t || "09:00"}`); }
function urgency(lead) {
  const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
  if (!dt) return "none";
  const h = (dt - new Date()) / 3600000;
  if (h < 0) return "overdue"; if (h < 24) return "today"; if (h < 72) return "soon"; return "later";
}
const U_STYLE = {
  overdue: { color: "#fb7185", label: "OVERDUE" }, today: { color: "#fbbf24", label: "AAJ" },
  soon: { color: "#34d399", label: "JALD" }, later: { color: "#64748b", label: null }, none: { color: "#475569", label: null },
};
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(""); }
function amtNum(s) { if (!s) return 0; const m = String(s).match(/[\d.]+/); if (!m) return 0; const n = parseFloat(m[0]); return /cr/i.test(s) ? n * 100 : n; }
function buyingIntentScore(lead) {
  if (lead.status === "converted") return 100; if (lead.status === "lost") return 0;
  let s = { hot: 35, warm: 20, cold: 5 }[lead.interest] || 15;
  s += { new: 8, followup: 20, callback: 26, hold: 6 }[lead.status] || 8;
  s += Math.min(((lead.history || []).length) * 3, 20);
  return Math.max(2, Math.min(98, Math.round(s)));
}
function intentColor(score) { return score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#fb7185"; }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function isToday(ts) { if (!ts) return false; return new Date(ts).toDateString() === new Date().toDateString(); }
function whatsappTemplate(lead) { const n = lead.name.split(" ")[0]; return `Namaste ${n} ji, main Raj bol raha hoon. Aapki ${productCode(lead.product)} requirement ke baare mein baat karni thi. Kab baat kar sakte hain?`; }
function smsTemplate(lead) { const n = lead.name.split(" ")[0]; return `Namaste ${n} ji, Raj (loan advisor) bol raha hoon.`; }

function quickParseDeterministic(text) {
  const out = {};
  const phoneMatch = text.match(/\b[6-9]\d{9}\b/);
  if (phoneMatch) out.phone = phoneMatch[0];
  const firstLine = text.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "";
  if (firstLine) {
    let n = phoneMatch ? firstLine.replace(phoneMatch[0], "") : firstLine;
    n = n.replace(/^[\s,\-:]+|[\s,\-:]+$/g, "").trim();
    if (n && n.length < 40) out.name = n.split(" ").map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  const reqM = text.match(/req(?:uirement)?[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i);
  if (reqM) out.loanAmount = reqM[1].trim();
  const bank = BANKS.find((b) => new RegExp(b, "i").test(text));
  if (bank) out.bank = bank;
  if (/lap/i.test(text)) out.product = /bt/i.test(text) ? "LAP Balance Transfer" : "LAP (Fresh)";
  else if (/home loan|\bhl\b/i.test(text)) out.product = /bt/i.test(text) ? "Home Loan BT" : "Home Loan (Fresh)";
  else if (/msme/i.test(text)) out.product = "MSME Loan (Fresh)";
  const lower = text.toLowerCase();
  if (/\bkal\b/.test(lower)) out.nextCallDate = addDays(1);
  else if (/\baaj\b/.test(lower)) out.nextCallDate = addDays(0);
  const baje = text.match(/\b(\d{1,2})\s*baje\b/i);
  if (baje) { let hh = parseInt(baje[1], 10); if (hh >= 1 && hh <= 7) hh += 12; out.nextCallTime = `${String(hh).padStart(2, "0")}:00`; }
  return out;
}

const emptyForm = { name: "", phone: "", product: "", bank: "", loanAmount: "", status: "new", interest: "warm", nextCallDate: "", nextCallTime: "", notes: "", history: [], convertedAt: null };

/* ============================== STORAGE ============================== */
async function loadLeads() { try { const r = await AsyncStorage.getItem("leadcc:leads"); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
async function saveLeads(leads) { try { await AsyncStorage.setItem("leadcc:leads", JSON.stringify(leads)); return true; } catch (e) { return false; } }

/* ============================== APP ============================== */
export default function App() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pipeline");
  const [showQuick, setShowQuick] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => { (async () => { setLeads(await loadLeads()); setLoading(false); })(); }, []);
  async function persist(next) { setLeads(next); await saveLeads(next); }

  function openAdd() { setForm(emptyForm); setEditingId(null); setShowForm(true); }
  function saveLead() {
    if (!form.name.trim() || !form.phone.trim()) return;
    const convertedAt = form.status === "converted" ? Date.now() : null;
    if (editingId) persist(leads.map((l) => (l.id === editingId ? { ...form, id: editingId, convertedAt } : l)));
    else persist([...leads, { ...form, id: uid(), createdAt: Date.now(), history: form.notes ? [{ date: Date.now(), note: form.notes }] : [], convertedAt }]);
    setShowForm(false); setForm(emptyForm); setEditingId(null);
  }
  function deleteLead(id) { persist(leads.filter((l) => l.id !== id)); setDetailId(null); }
  function quickStatus(id, status) { persist(leads.map((l) => (l.id === id ? { ...l, status, convertedAt: status === "converted" ? Date.now() : l.convertedAt } : l))); }
  function addNote(id, note) { if (!note.trim()) return; persist(leads.map((l) => (l.id === id ? { ...l, history: [...(l.history || []), { date: Date.now(), note }] } : l))); }
  function quickAdd() {
    if (!quickText.trim()) return;
    const parsed = quickParseDeterministic(quickText);
    setForm({ ...emptyForm, ...parsed, history: [] });
    setEditingId(null); setShowQuick(false); setShowForm(true); setQuickText("");
  }

  const stats = useMemo(() => {
    const active = leads.filter((l) => !["converted", "lost"].includes(l.status)).length;
    const overdue = leads.filter((l) => urgency(l) === "overdue" && !["converted", "lost"].includes(l.status)).length;
    const today = leads.filter((l) => urgency(l) === "today" && !["converted", "lost"].includes(l.status)).length;
    const wonToday = leads.filter((l) => l.status === "converted" && isToday(l.convertedAt));
    const earnedToday = wonToday.reduce((s, l) => s + amtNum(l.loanAmount), 0) * 0.005 * 100000;
    return { active, overdue, today, earnedToday, wonTodayCount: wonToday.length, total: leads.length };
  }, [leads]);

  const detailLead = leads.find((l) => l.id === detailId);

  if (loading) return <SafeAreaView style={s.container}><ActivityIndicator color="#a78bfa" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerLabel}>RAJ · SALES WAR ROOM</Text>
        <Text style={s.headerTitle}>Lead Command Center</Text>
        <View style={s.earnBox}>
          <Text style={s.earnLabel}>AAJ KI KAMAI</Text>
          <Text style={s.earnValue}>₹{Math.round(stats.earnedToday).toLocaleString("en-IN")}</Text>
          <Text style={s.earnSub}>{stats.wonTodayCount} deal close aaj</Text>
        </View>
        <View style={s.statRow}>
          <View style={s.statBox}><Text style={[s.statVal, { color: "#fb7185" }]}>{stats.overdue}</Text><Text style={s.statLabel}>Overdue</Text></View>
          <View style={s.statBox}><Text style={[s.statVal, { color: "#fbbf24" }]}>{stats.today}</Text><Text style={s.statLabel}>Aaj</Text></View>
          <View style={s.statBox}><Text style={[s.statVal, { color: "#38bdf8" }]}>{stats.active}</Text><Text style={s.statLabel}>Active</Text></View>
        </View>
      </View>

      <View style={s.tabRow}>
        {["pipeline", "list"].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab === t && s.tabBtnActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === "pipeline" ? "Pipeline" : "List"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "pipeline" && (
        <ScrollView horizontal style={{ marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {STATUS_ORDER.map((key) => {
            const col = leads.filter((l) => l.status === key);
            return (
              <View key={key} style={{ width: 200 }}>
                <View style={s.colHeader}>
                  <View style={[s.dot, { backgroundColor: STATUS[key].color }]} />
                  <Text style={s.colTitle}>{STATUS[key].label}</Text>
                  <Text style={s.colCount}>{col.length}</Text>
                </View>
                {col.length === 0 && <View style={s.emptyCol}><Text style={s.emptyColText}>Khaali</Text></View>}
                {col.map((lead) => {
                  const score = buyingIntentScore(lead);
                  return (
                    <TouchableOpacity key={lead.id} onPress={() => setDetailId(lead.id)} style={s.card}>
                      <Text style={s.cardName} numberOfLines={1}>{lead.name}</Text>
                      <Text style={s.cardSub}>{productCode(lead.product)} · {lead.bank || "—"}</Text>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                        {lead.loanAmount ? <Text style={{ color: "#34d399", fontSize: 10.5 }}>₹{lead.loanAmount}</Text> : <View />}
                        <Text style={{ color: intentColor(score), fontSize: 10, fontWeight: "700" }}>{score}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {tab === "list" && (
        <ScrollView style={{ paddingHorizontal: 16, marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingBottom: 100 }}>
          {leads.length === 0 && <Text style={s.emptyText}>Koi lead nahi hai. + dabao ya Quick Add use karo.</Text>}
          {leads.map((lead) => {
            const u = urgency(lead), dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime), score = buyingIntentScore(lead);
            return (
              <TouchableOpacity key={lead.id} onPress={() => setDetailId(lead.id)} style={s.listRow}>
                <View style={[s.avatar]}><Text style={s.avatarText}>{initials(lead.name)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{lead.name}</Text>
                  <Text style={s.cardSub}>{productCode(lead.product)} · {lead.bank || "—"}{lead.loanAmount ? ` · ₹${lead.loanAmount}` : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: intentColor(score), fontSize: 11, fontWeight: "700" }}>{score}</Text>
                  <Text style={[s.badge, { color: STATUS[lead.status].color }]}>{STATUS[lead.status].label}</Text>
                  {dt && <Text style={{ color: U_STYLE[u].color, fontSize: 10 }}>{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity onPress={() => setShowQuick(true)} style={s.quickBtn}><Text style={s.quickBtnText}>✨ Quick Add</Text></TouchableOpacity>
      <TouchableOpacity onPress={openAdd} style={s.fab}><Text style={{ color: "#fff", fontSize: 26 }}>+</Text></TouchableOpacity>

      {/* Quick Add Modal */}
      <Modal visible={showQuick} transparent animationType="slide" onRequestClose={() => setShowQuick(false)}>
        <View style={s.modalWrap}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Jaldi Add Karo</Text>
            <TextInput value={quickText} onChangeText={setQuickText} multiline placeholder="Rampal Goyal 9013427441 Req 1cr lap kal 4 baje..." placeholderTextColor="#475569" style={[s.input, { minHeight: 100, textAlignVertical: "top" }]} />
            <TouchableOpacity onPress={quickAdd} style={s.primaryBtn}><Text style={s.primaryBtnText}>Auto-fill karo</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQuick(false)} style={{ marginTop: 10, alignItems: "center" }}><Text style={{ color: "#64748b" }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lead Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={s.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView style={s.sheetTall}>
              <Text style={s.sheetTitle}>{editingId ? "Edit Karo" : "Naya Lead"}</Text>
              <Text style={s.label}>Naam *</Text>
              <TextInput value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} style={s.input} placeholderTextColor="#475569" />
              <Text style={s.label}>Phone *</Text>
              <TextInput value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" style={s.input} placeholderTextColor="#475569" />
              <Text style={s.label}>Product</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {PRODUCTS.map((p) => (
                  <TouchableOpacity key={p.v} onPress={() => setForm((f) => ({ ...f, product: p.v }))} style={[s.chip, form.product === p.v && s.chipActive]}>
                    <Text style={[s.chipText, form.product === p.v && s.chipTextActive]}>{p.c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Bank</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {BANKS.map((b) => (
                  <TouchableOpacity key={b} onPress={() => setForm((f) => ({ ...f, bank: b }))} style={[s.chip, form.bank === b && s.chipActive]}>
                    <Text style={[s.chipText, form.bank === b && s.chipTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Requirement (amount)</Text>
              <TextInput value={form.loanAmount} onChangeText={(v) => setForm((f) => ({ ...f, loanAmount: v }))} placeholder="e.g. 1 Cr" placeholderTextColor="#475569" style={s.input} />
              <Text style={s.label}>Status</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {STATUS_ORDER.map((k) => (
                  <TouchableOpacity key={k} onPress={() => setForm((f) => ({ ...f, status: k }))} style={[s.chip, form.status === k && s.chipActive]}>
                    <Text style={[s.chipText, form.status === k && s.chipTextActive]}>{STATUS[k].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Notes</Text>
              <TextInput value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} placeholderTextColor="#475569" />
              <TouchableOpacity onPress={saveLead} style={s.primaryBtn}><Text style={s.primaryBtnText}>{editingId ? "Update Karo" : "Add Karo"}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowForm(false)} style={{ marginVertical: 14, alignItems: "center" }}><Text style={{ color: "#64748b" }}>Cancel</Text></TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Detail Modal */}
      {detailLead && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setDetailId(null)}>
          <View style={s.modalWrap}>
            <ScrollView style={s.sheetTall}>
              <Text style={s.sheetTitle}>{detailLead.name}</Text>
              <Text style={s.cardSub}>{productCode(detailLead.product)} · {detailLead.bank || "—"} · {detailLead.phone}</Text>

              <ObjectionBox />

              <Text style={[s.label, { marginTop: 14 }]}>Status badlo</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {STATUS_ORDER.map((k) => (
                  <TouchableOpacity key={k} onPress={() => quickStatus(detailLead.id, k)} style={[s.chip, detailLead.status === k && s.chipActive]}>
                    <Text style={[s.chipText, detailLead.status === k && s.chipTextActive]}>{STATUS[k].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${detailLead.phone}`)} style={[s.actionBtn, { backgroundColor: "#7c3aed" }]}><Text style={s.actionText}>Call</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/91${detailLead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappTemplate(detailLead))}`)} style={[s.actionBtn, { backgroundColor: "#16a34a" }]}><Text style={s.actionText}>WhatsApp</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`sms:${detailLead.phone}?body=${encodeURIComponent(smsTemplate(detailLead))}`)} style={[s.actionBtn, { backgroundColor: "#334155" }]}><Text style={s.actionText}>SMS</Text></TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => deleteLead(detailLead.id)} style={{ marginTop: 16, alignItems: "center" }}><Text style={{ color: "#fb7185" }}>Delete Lead</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setDetailId(null)} style={{ marginVertical: 14, alignItems: "center" }}><Text style={{ color: "#64748b" }}>Band Karo</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function ObjectionBox() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  return (
    <View style={s.objBox}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)}><Text style={s.objTitle}>🛡 Objection Destroyer {open ? "▲" : "▼"}</Text></TouchableOpacity>
      {open && OBJECTIONS.map((o, i) => (
        <TouchableOpacity key={i} onPress={() => setActive(active === i ? null : i)} style={[s.objRow, active === i && s.objRowActive]}>
          <Text style={{ color: active === i ? "#fecaca" : "#cbd5e1", fontSize: 11.5 }}>{o.q}</Text>
        </TouchableOpacity>
      ))}
      {active !== null && <View style={s.objAnswer}><Text style={{ color: "#f1f5f9", fontSize: 12.5, lineHeight: 18 }}>{OBJECTIONS[active].a}</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f1a" },
  header: { padding: 16, backgroundColor: "#0d1a2f", borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  headerLabel: { color: "#a78bfa", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 },
  earnBox: { marginTop: 12, backgroundColor: "#111827", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#064e3b" },
  earnLabel: { color: "#34d399", fontSize: 10, fontWeight: "700" },
  earnValue: { color: "#34d399", fontSize: 22, fontWeight: "800", marginTop: 2 },
  earnSub: { color: "#64748b", fontSize: 10, marginTop: 2 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  statBox: { flex: 1, backgroundColor: "#111827", borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "#1e293b" },
  statVal: { fontSize: 17, fontWeight: "800" },
  statLabel: { color: "#64748b", fontSize: 8.5 },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  tabBtnActive: { backgroundColor: "#2e1065", borderColor: "#6d28d9" },
  tabText: { color: "#64748b", fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: "#c4b5fd" },
  colHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  colTitle: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  colCount: { color: "#64748b", fontSize: 10, marginLeft: "auto" },
  emptyCol: { padding: 12, borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 8, alignItems: "center" },
  emptyColText: { color: "#334155", fontSize: 10 },
  card: { backgroundColor: "#111827", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#1e293b", marginBottom: 8 },
  cardName: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
  cardSub: { color: "#64748b", fontSize: 10.5, marginTop: 2 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111827", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#1e293b" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#c4b5fd", fontWeight: "700" },
  badge: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  emptyText: { color: "#475569", textAlign: "center", marginTop: 40 },
  quickBtn: { position: "absolute", bottom: 24, left: 20, backgroundColor: "#111827", borderWidth: 1, borderColor: "#6d28d9", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  quickBtnText: { color: "#c4b5fd", fontWeight: "700", fontSize: 12.5 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: { backgroundColor: "#111827", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30 },
  sheetTall: { backgroundColor: "#111827", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: "88%" },
  sheetTitle: { color: "#f1f5f9", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "600", marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: "#0b0f1a", borderWidth: 1, borderColor: "#1e293b", borderRadius: 8, padding: 10, color: "#e2e8f0", marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0b0f1a" },
  chipActive: { backgroundColor: "#2e1065", borderColor: "#6d28d9" },
  chipText: { color: "#94a3b8", fontSize: 11 },
  chipTextActive: { color: "#c4b5fd", fontWeight: "700" },
  primaryBtn: { backgroundColor: "#7c3aed", borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  objBox: { backgroundColor: "#1c1024", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#4c1d95", marginTop: 10 },
  objTitle: { color: "#fb7185", fontWeight: "700", fontSize: 12 },
  objRow: { padding: 8, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: "#1e293b" },
  objRowActive: { borderColor: "#be123c", backgroundColor: "#3f0d1a" },
  objAnswer: { marginTop: 8, backgroundColor: "#0b0f1a", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#be123c" },
});
