import { PRODUCTS, BANKS, PROPERTY_TYPES } from "./constants";

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function productCode(v) {
  if (!v) return "—";
  const found = PRODUCTS.find((p) => p.v === v);
  return found ? found.c : v;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isToday(ts) {
  if (!ts) return false;
  return new Date(ts).toDateString() === new Date().toDateString();
}

export function fmtDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T${timeStr || "09:00"}`);
}

export function urgency(lead) {
  const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
  if (!dt) return "none";
  const diffHrs = (dt - new Date()) / 3600000;
  if (diffHrs < 0) return "overdue";
  if (diffHrs < 24) return "today";
  if (diffHrs < 72) return "soon";
  return "later";
}

export const U_STYLE = {
  overdue: { color: "#fb7185", label: "OVERDUE" },
  today: { color: "#fbbf24", label: "AAJ" },
  soon: { color: "#34d399", label: "JALD" },
  later: { color: "#64748b", label: null },
  none: { color: "#475569", label: null },
};

export function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export function toTitleCase(s) {
  return s.replace(/\s+/g, " ").trim().split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
}

export function daysSince(lead) {
  const times = [(lead.history || []).map((h) => h.date), [lead.createdAt || 0]].flat();
  const last = Math.max(...times, 0);
  if (!last) return null;
  return Math.floor((Date.now() - last) / 86400000);
}

export function amtNum(s) {
  if (!s) return 0;
  const m = String(s).match(/[\d.]+/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return /cr/i.test(s) ? n * 100 : n;
}

// Rule-based "buying intent" score, 0-100. Transparent scoring — not a black-box ML claim.
export function buyingIntentScore(lead) {
  if (lead.status === "converted") return 100;
  if (lead.status === "lost") return 0;
  let score = 0;
  score += { hot: 35, warm: 20, cold: 5 }[lead.interest] || 15;
  score += { new: 8, followup: 20, callback: 26, hold: 6 }[lead.status] || 8;
  const ds = daysSince(lead);
  if (ds !== null) {
    if (ds <= 1) score += 20;
    else if (ds <= 3) score += 12;
    else if (ds <= 7) score += 4;
    else score -= 10;
  }
  const fields = [lead.itr, lead.propertyType, lead.marketValue, lead.coApplicant].filter(Boolean).length;
  score += fields * 3;
  score += Math.min((lead.history || []).length * 2, 12);
  return Math.max(2, Math.min(98, Math.round(score)));
}

export function intentBand(score) {
  if (score >= 70) return { label: "High", color: "#34d399" };
  if (score >= 40) return { label: "Medium", color: "#fbbf24" };
  return { label: "Low", color: "#fb7185" };
}

// Fast, deterministic parser for the field-labeled Hinglish format
// ("Req-", "Property-", "M.V-", "N.O.B-", "ITR-", "kal 4 baje" etc).
// Runs instantly, no network call, never "fails".
export function quickParseDeterministic(text) {
  const out = {};
  const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : ""; };

  const phoneMatch = text.match(/\b[6-9]\d{9}\b/);
  if (phoneMatch) out.phone = phoneMatch[0];

  const firstLine = text.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "";
  if (firstLine && !/req|property|m\.?v|n\.?o\.?b|itr|co-?applicant|remarks?/i.test(firstLine)) {
    let nameLine = phoneMatch ? firstLine.replace(phoneMatch[0], "") : firstLine;
    nameLine = nameLine.replace(/^[\s,\-:]+|[\s,\-:]+$/g, "").trim();
    if (nameLine && nameLine.length < 40) out.name = toTitleCase(nameLine);
  }

  out.loanAmount = grab(/req(?:uirement)?[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)\b)/i) || grab(/req(?:uirement)?[\s.\-:]*([\d.]+)/i);
  const propMatch = text.match(/propert(?:y)?(?:\s*type)?[\s.\-:]*([^\n]+)/i);
  if (propMatch) {
    out.propertyLocation = propMatch[1].trim();
    const t = propMatch[1].toLowerCase();
    out.propertyType = PROPERTY_TYPES.find((p) => t.includes(p.toLowerCase())) || "";
  }
  out.marketValue = grab(/m\.?\s?v\.?[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i);
  const nobMatch = text.match(/n\.?\s?o\.?\s?b\.?[\s.\-:]*([^\n]+)/i);
  if (nobMatch) {
    const t = nobMatch[1].toLowerCase();
    out.employment = /salar/i.test(t) ? "Salaried" : /business|shop|trade|rashan|kirana/i.test(t) ? "Self-Employed Business" : /profession|doctor|ca\b|architect/i.test(t) ? "Self-Employed Professional" : "";
    if (!/salar/i.test(t)) out.businessName = nobMatch[1].trim();
  }
  if (/\bsalaried\b/i.test(text)) out.employment = "Salaried";
  out.itr = grab(/itr[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i);
  const coMatch = text.match(/co[\s-]?applicant[\s.\-:]*([^\n]+)/i);
  if (coMatch) out.coApplicant = coMatch[1].trim();
  const remarksMatch = text.match(/remarks?[\s.\-:]*([\s\S]+)/i);
  if (remarksMatch) out.notes = remarksMatch[1].trim().slice(0, 400);

  const foundBank = BANKS.find((b) => new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text));
  if (foundBank) { out.existingLoanBank = foundBank; out.bank = foundBank; }

  if (/\blap\b/i.test(text)) out.product = /\bbt\b|balance transfer/i.test(text) ? "LAP Balance Transfer" : /\bod\b/i.test(text) ? "LAP OD" : "LAP (Fresh)";
  else if (/home loan|\bhl\b/i.test(text)) out.product = /\bbt\b|balance transfer/i.test(text) ? "Home Loan BT" : /\bod\b/i.test(text) ? "Home Loan OD" : "Home Loan (Fresh)";
  else if (/msme/i.test(text)) out.product = /\bbt\b|balance transfer/i.test(text) ? "MSME Balance Transfer" : "MSME Loan (Fresh)";

  const lower = text.toLowerCase();
  if (/\bparso\b/.test(lower)) out.nextCallDate = addDays(2);
  else if (/\bkal\b/.test(lower)) out.nextCallDate = addDays(1);
  else if (/\baaj\b/.test(lower)) out.nextCallDate = addDays(0);

  const bajeMatch = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*baje\b/i);
  const ampmMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (bajeMatch) {
    let hh = parseInt(bajeMatch[1], 10), mm = bajeMatch[2] ? parseInt(bajeMatch[2], 10) : 0;
    const hasSubah = /subah|morning/i.test(text), hasShaam = /shaam|evening|dopahar|afternoon/i.test(text);
    if (!hasSubah && (hasShaam || (hh >= 1 && hh <= 7)) && hh < 12) hh += 12;
    out.nextCallTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  } else if (ampmMatch) {
    let hh = parseInt(ampmMatch[1], 10);
    const mm = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPM = /pm/i.test(ampmMatch[3]);
    if (isPM && hh < 12) hh += 12;
    if (!isPM && hh === 12) hh = 0;
    out.nextCallTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  if (/not interested/i.test(text)) { out.status = "lost"; out.reason = "Not interested after home visit"; }
  else if (/documents?\s*(pending|wait|chahiye)/i.test(text)) { out.status = "hold"; out.reason = "Documents pending"; }

  return out;
}

export function whatsappTemplate(lead) {
  const name = lead.name.split(" ")[0];
  const p = lead.product ? productCode(lead.product) : "loan";
  return `Namaste ${name} ji, main Raj bol raha hoon. Aapki ${p} requirement ke baare mein baat karni thi${lead.bank ? ` (${lead.bank})` : ""}. Kab baat kar sakte hain?`;
}

export function smsTemplate(lead) {
  const name = lead.name.split(" ")[0];
  return `Namaste ${name} ji, Raj (loan advisor) bol raha hoon. Aapki requirement follow-up ke liye call karunga.`;
}

export function leadsToCSV(leads) {
  const cols = ["name", "phone", "altPhone", "product", "bank", "loanAmount", "status", "reason", "interest", "location", "propertyType", "propertyLocation", "marketValue", "employment", "itr", "coApplicant", "existingLoanBank", "nextCallDate", "nextCallTime", "notes"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [cols.join(",")];
  leads.forEach((l) => rows.push(cols.map((c) => esc(l[c])).join(",")));
  return rows.join("\n");
}

export function toRupees(amtStr) {
  // amtNum() returns a value in "lakh units" (e.g. "1 Cr" -> 100, "50L" -> 50).
  // Multiplying by 100000 converts lakh-units to actual rupees.
  return Math.round(amtNum(amtStr) * 100000);
}

export function formatINR(rupees) {
  if (!rupees && rupees !== 0) return "—";
  const n = Math.round(rupees);
  const isNeg = n < 0;
  const abs = Math.abs(n).toString();
  let lastThree = abs.substring(abs.length - 3);
  const rest = abs.substring(0, abs.length - 3);
  if (rest !== "") lastThree = "," + lastThree;
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `${isNeg ? "-" : ""}₹${formatted}`;
}

export function fillTemplate(str, lead) {
  return str
    .replace(/\{name\}/g, lead.name ? lead.name.split(" ")[0] : "Sir/Ma'am")
    .replace(/\{product\}/g, lead.product || "loan")
    .replace(/\{bank\}/g, lead.bank || "existing bank")
    .replace(/\{loanAmount\}/g, lead.loanAmount || "requirement")
    .replace(/\{marketValue\}/g, lead.marketValue || "property value");
}

export const emptyForm = {
  name: "", phone: "", altPhone: "", location: "", businessName: "",
  product: "", bank: "", loanAmount: "", status: "new", interest: "warm",
  nextCallDate: "", nextCallTime: "", notes: "", history: [],
  propertyType: "", propertyLocation: "", marketValue: "", employment: "", itr: "", coApplicant: "",
  existingLoanBank: "", existingLoanRemarks: "", reason: "", convertedAt: null,
};
