import {
  PRODUCTS,
  BANKS,
  PROPERTY_TYPES,
  TURNOVER_BANDS,
  BANKING_TYPES,
  RENTAL_INCOME_TYPES,
  ENTITY_CONSTITUTION,
  NATURE_OF_BUSINESS,
  ADDITIONAL_INCOME_SOURCES,
  recommendCallTime,
} from "./constants";

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
  overdue: { color: "#EF4444", label: "OVERDUE" },
  today: { color: "#FBBF24", label: "AAJ" },
  soon: { color: "#06B6D4", label: "JALD" },
  later: { color: "#64748b", label: null },
  none: { color: "#475569", label: null },
};

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function toTitleCase(s) {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function daysSince(lead) {
  const times = [
    ...(lead.history || []).map((h) => h.date),
    lead.createdAt || 0,
  ].flat();
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

export function toRupees(amtStr) {
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
  const formatted =
    rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `${isNeg ? "-" : ""}₹${formatted}`;
}

// Compact Indian Cr / Lakh notation for large loan numbers and pipeline totals.
// e.g. 49000000 -> "₹4.9 Cr", 1500000 -> "₹15 L", 50000 -> "₹50,000"
export function formatINRShort(rupees) {
  if (!rupees && rupees !== 0) return "—";
  const n = Math.round(rupees);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10000000) {
    const cr = abs / 10000000;
    const str = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return `${sign}₹${str} Cr`;
  }
  if (abs >= 100000) {
    const l = abs / 100000;
    const str = l % 1 === 0 ? l.toFixed(0) : l.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return `${sign}₹${str} L`;
  }
  return formatINR(abs);
}

// Format a raw amount string (e.g. "1 Cr", "15L", "49000000") into compact notation.
export function formatAmountShort(amtStr) {
  if (!amtStr) return "—";
  // If it already looks like Cr/Lakh shorthand, normalize and return as-is.
  if (/cr|crore|lakh|lac|\bl\b/i.test(amtStr)) {
    const num = parseFloat(String(amtStr).match(/[\d.]+/)?.[0] || "0");
    if (!num) return amtStr;
    if (/cr|crore/i.test(amtStr)) return `₹${num % 1 === 0 ? num : num.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} Cr`;
    return `₹${num % 1 === 0 ? num : num.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} L`;
  }
  const rupees = toRupees(amtStr);
  if (!rupees) return amtStr;
  return formatINRShort(rupees);
}

// Returns day of week for a YYYY-MM-DD string, e.g. "2026-08-03" -> "Monday".
export function dayOfWeek(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "long" });
}

// Rule-based "buying intent" score, 0-100. Transparent scoring — not a black-box ML claim.
export function buyingIntentScore(lead) {
  if (lead.status === "disbursed" || lead.status === "converted") return 100;
  if (lead.status === "lost") return 0;
  let score = 0;
  score += { hot: 35, warm: 20, cold: 5 }[lead.interest] || 15;
  score += { new: 8, callback: 18, warm: 22, docspending: 14, login: 28, sanctioned: 34 }[lead.status] || 8;
  const ds = daysSince(lead);
  if (ds !== null) {
    if (ds <= 1) score += 20;
    else if (ds <= 3) score += 12;
    else if (ds <= 7) score += 4;
    else score -= 10;
  }
  const fields = [
    lead.itr, lead.propertyType, lead.marketValue, lead.coApplicant,
    lead.turnover, lead.bankingType, lead.rentalIncome, lead.monthlySalary,
    lead.companyCategory, lead.cibilScore, lead.currentROI,
    lead.entityConstitution, lead.natureOfBusiness, lead.additionalIncome,
  ].filter(Boolean).length;
  score += fields * 2;
  score += Math.min((lead.history || []).length * 2, 12);
  return Math.max(2, Math.min(98, Math.round(score)));
}

export function intentBand(score) {
  if (score >= 70) return { label: "High", color: "#10B981" };
  if (score >= 40) return { label: "Medium", color: "#FBBF24" };
  return { label: "Low", color: "#EF4444" };
}

export function intentColor(score) {
  return score >= 70 ? "#10B981" : score >= 40 ? "#FBBF24" : "#EF4444";
}

// ---- Focus Radar Priority ----
// Sorts leads so high-commission deals get maximum attention.
// Factors: high loan amount, high CIBIL (>750), upcoming call timing, hot interest.
export function focusRadarPriority(lead) {
  let priority = 0;
  const loanRupees = toRupees(lead.loanAmount);
  // Loan amount weight (log scale so 10Cr isn't 100x a 10L)
  if (loanRupees > 0) {
    priority += Math.log10(loanRupees) * 8;
  }
  // CIBIL weight
  const cibil = parseInt(lead.cibilScore, 10);
  if (cibil > 750) priority += 20;
  else if (cibil >= 700) priority += 12;
  else if (cibil >= 650) priority += 6;
  // Interest
  priority += { hot: 25, warm: 10, cold: 0 }[lead.interest] || 5;
  // Upcoming call timing
  const u = urgency(lead);
  priority += { overdue: 18, today: 25, soon: 12, later: 4, none: 0 }[u] || 0;
  // Status penalty for dead leads
  if (["lost", "disbursed", "converted"].includes(lead.status)) priority -= 50;
  return priority;
}

export function focusRadarBadge(lead) {
  const p = focusRadarPriority(lead);
  if (p >= 50) return { label: "HOT", color: "#EF4444" };
  if (p >= 35) return { label: "WARM", color: "#FBBF24" };
  if (p >= 20) return { label: "WATCH", color: "#06B6D4" };
  return null;
}

// Enhanced smart-paste parser. Extracts ALL parameters from raw Hinglish text
// including ITR, Top-Up amounts, custom banks, net salary, and CIBIL score.
// Unparsed text is dumped into Notes.
export function quickParseDeterministic(text) {
  const out = {};
  const consumed = [];
  const mark = (str) => { if (str) consumed.push(str); };

  // ---- Phone (10 digits, starts 6-9) ----
  const phoneMatch = text.match(/\b[6-9]\d{9}\b/);
  if (phoneMatch) {
    out.phone = phoneMatch[0];
    mark(phoneMatch[0]);
  }

  // ---- Name (first line, minus phone) ----
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || "";
  if (firstLine && !/req|property|m\.?v|n\.?o\.?b|itr|co-?applicant|remarks|cibil|roi|bank|salary|turnover|top-?up/i.test(firstLine)) {
    let nameLine = phoneMatch ? firstLine.replace(phoneMatch[0], "") : firstLine;
    nameLine = nameLine.replace(/^[\s,\-:]+|[\s,\-:]+$/g, "").trim();
    if (nameLine && nameLine.length < 40) {
      out.name = toTitleCase(nameLine);
      mark(nameLine);
    }
  }

  // ---- Product ----
  const isBT = /\bbt\b|balance transfer/i.test(text);
  if (/\blap\b/i.test(text)) {
    out.product = isBT ? "LAP Balance Transfer (LAP BT)" : "Loan Against Property (LAP)";
    mark(text.match(/\blap\b[^,\n]*/i)?.[0] || "");
  } else if (/home loan|\bhl\b/i.test(text)) {
    out.product = isBT ? "HL Balance Transfer (HL BT)" : "Home Loan (HL)";
    mark(text.match(/home loan|\bhl\b/i)?.[0] || "");
  } else if (/msme/i.test(text)) {
    out.product = "MSME Working Capital";
    mark(text.match(/msme[^,\n]*/i)?.[0] || "");
  } else if (/\bbl\b|business loan/i.test(text)) {
    out.product = "Business Loan (BL - Unsecured)";
    mark(text.match(/\bbl\b|business loan/i)?.[0] || "");
  } else if (/\bpl\b|personal loan/i.test(text)) {
    out.product = "Personal Loan (PL)";
    mark(text.match(/\bpl\b|personal loan/i)?.[0] || "");
  } else if (/top[\s-]?up/i.test(text)) {
    out.product = "Top-Up Loan";
    mark(text.match(/top[\s-]?up[^,\n]*/i)?.[0] || "");
  }

  // ---- Loan Amount / Requirement ----
  const reqMatch = text.match(/req(?:uirement)?[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)\b)/i)
    || text.match(/req(?:uirement)?[\s.\-:]*([\d.]+)/i);
  if (reqMatch) {
    out.loanAmount = reqMatch[1].trim();
    mark(reqMatch[0]);
  }

  // ---- Existing Loan Amount ----
  const existLoanMatch = text.match(/existing\s*loan[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i)
    || text.match(/existing\s*loan[\s.\-:]*([^\n,]+)/i);
  if (existLoanMatch) {
    out.existingLoanAmount = existLoanMatch[1].trim();
    mark(existLoanMatch[0]);
  }

  // ---- Top-Up Requested ----
  const topUpMatch = text.match(/top[\s-]?up[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i);
  if (topUpMatch) {
    out.topUpRequested = topUpMatch[1].trim();
    mark(topUpMatch[0]);
  }

  // ---- Bank ----
  const foundBank = BANKS.find((b) =>
    new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)
  );
  if (foundBank) {
    out.bank = foundBank;
    if (foundBank === "Other") {
      // try to find a custom bank name after "other"
      const otherMatch = text.match(/other[\s.\-:]*([A-Za-z][A-Za-z\s]{2,20})/i);
      if (otherMatch) {
        out.customBank = toTitleCase(otherMatch[1].trim());
        mark(otherMatch[0]);
      }
    }
    mark(foundBank);
  }

  // ---- Property Type & Location ----
  const propMatch = text.match(/propert(?:y)?(?:\s*type)?[\s.\-:]*([^\n,]+)/i);
  if (propMatch) {
    const raw = propMatch[1].trim();
    out.propertyLocation = raw;
    const t = raw.toLowerCase();
    const found = PROPERTY_TYPES.find((p) => t.includes(p.toLowerCase().split(" ")[0]));
    if (found) out.propertyType = found;
    mark(propMatch[0]);
  }

  // ---- Market Value ----
  const mvMatch = text.match(/m\.?\s?v\.?[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i);
  if (mvMatch) {
    out.marketValue = mvMatch[1].trim();
    mark(mvMatch[0]);
  }

  // ---- Employment ----
  if (/\bsalaried\b|salaried job/i.test(text)) {
    out.employment = "Salaried";
    mark(text.match(/salaried[^,\n]*/i)?.[0] || "");
  } else if (/self[\s-]?employ|business|shop|trade|rashan|kirana|contractor|manufacturer|wholesale|retail|restaurant|transport|it\s*company|software/i.test(text)) {
    out.employment = "Self-Employed Business";
    mark(text.match(/self[\s-]?employ[^\n,]*/i)?.[0] || "");
  } else if (/profession|doctor|ca\b|advocate|architect|consultant/i.test(text)) {
    out.employment = "Self-Employed Professional";
    mark(text.match(/profession[^\n,]*/i)?.[0] || "");
  }

  // ---- Nature of Business / Industry ----
  const nobMatch = text.match(/(?:n\.?\s?o\.?\s?b\.?|nature of business|industry)[\s.\-:]*([^\n,]+)/i);
  if (nobMatch) {
    const raw = nobMatch[1].trim();
    const found = NATURE_OF_BUSINESS.find((n) =>
      raw.toLowerCase().includes(n.toLowerCase().split(" ")[0])
    );
    out.natureOfBusiness = found || raw;
    mark(nobMatch[0]);
  } else {
    const lower = text.toLowerCase();
    if (/construction|contractor|builder/i.test(lower)) out.natureOfBusiness = "Construction / Contractor";
    else if (/retail|kirana|rashan|shop/i.test(lower)) out.natureOfBusiness = "Retail / Kirana";
    else if (/manufacturing|factory/i.test(lower)) out.natureOfBusiness = "Manufacturing";
    else if (/it\s|software|tech company/i.test(lower)) out.natureOfBusiness = "IT / Software";
    else if (/wholesale|trading/i.test(lower)) out.natureOfBusiness = "Trading / Wholesale";
    else if (/restaurant|food|catering|hotel|f&b/i.test(lower)) out.natureOfBusiness = "Restaurant / F&B";
    else if (/transport|logistics|truck/i.test(lower)) out.natureOfBusiness = "Transport / Logistics";
    else if (/agriculture|farm/i.test(lower)) out.natureOfBusiness = "Agriculture";
    else if (/real estate|property dealer/i.test(lower)) out.natureOfBusiness = "Real Estate";
  }

  // ---- Entity Constitution ----
  const foundEntity = ENTITY_CONSTITUTION.find((e) =>
    new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)
  );
  if (foundEntity) {
    out.entityConstitution = foundEntity;
    mark(foundEntity);
  }

  // ---- CIBIL Score ----
  const cibilMatch = text.match(/cibil[\s.\-:]*(\d{3})/i)
    || text.match(/cibil[\s.\-:]*([\d.]+)/i)
    || text.match(/\bscore\b[\s.\-:]*(\d{3})/i);
  if (cibilMatch) {
    out.cibilScore = cibilMatch[1].trim();
    mark(cibilMatch[0]);
  }

  // ---- Current ROI ----
  const roiMatch = text.match(/roi[\s.\-:]*([\d.]+)\s*%?/i)
    || text.match(/rate\s*of\s*interest[\s.\-:]*([\d.]+)\s*%?/i)
    || text.match(/rate[\s.\-:]*([\d.]+)\s*%?/i);
  if (roiMatch) {
    out.currentROI = roiMatch[1].trim();
    mark(roiMatch[0]);
  }

  // ---- ITR (Latest 2 Years) ----
  const itrMatch = text.match(/itr[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i);
  if (itrMatch) {
    out.itr = itrMatch[1].trim();
    mark(itrMatch[0]);
  }

  // ---- Turnover ----
  const turnoverMatch = text.match(/turnover[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i)
    || text.match(/\bt\.?\s?o\.?\b[\s.\-:]*([\d.]+\s*(?:cr|crore|lakh|lac|l)?)/i);
  if (turnoverMatch) {
    const raw = turnoverMatch[1].trim().toLowerCase();
    const found = TURNOVER_BANDS.find((b) => raw.includes(b.toLowerCase()));
    out.turnover = found || raw;
    mark(turnoverMatch[0]);
  }

  // ---- Banking Type ----
  if (/heavy cash|cash heavy/i.test(text)) {
    out.bankingType = "Heavy Cash";
    mark(text.match(/heavy cash[^,\n]*/i)?.[0] || "");
  } else if (/cash mix|mixed banking/i.test(text)) {
    out.bankingType = "Cash Mix";
    mark(text.match(/cash mix[^,\n]*/i)?.[0] || "");
  } else if (/pure bank/i.test(text)) {
    out.bankingType = "Pure Bank";
    mark(text.match(/pure bank[^,\n]*/i)?.[0] || "");
  }

  // ---- Rental Income Type ----
  if (/pakka|bank transfer.*rental|rental.*bank transfer/i.test(text)) {
    out.rentalIncome = "Bank Transfer (Pakka)";
    mark(text.match(/pakka[^,\n]*/i)?.[0] || "");
  } else if (/kacha|cash.*rental|rental.*cash/i.test(text)) {
    out.rentalIncome = "Cash (Kacha)";
    mark(text.match(/kacha[^,\n]*/i)?.[0] || "");
  } else if (/rental.*mix|mix.*rental/i.test(text)) {
    out.rentalIncome = "Mix";
    mark(text.match(/rental.*mix|mix.*rental/i)?.[0] || "");
  }

  // ---- Monthly Salary ----
  const salaryMatch = text.match(/salary[\s.\-:]*([\d.]+)/i)
    || text.match(/monthly\s*(?:net\s*)?income[\s.\-:]*([\d.]+)/i)
    || text.match(/net\s*salary[\s.\-:]*([\d.]+)/i);
  if (salaryMatch) {
    out.monthlySalary = salaryMatch[1].trim();
    mark(salaryMatch[0]);
  }

  // ---- Co-Applicant ----
  const coMatch = text.match(/co[\s-]?applicant[\s.\-:]*([^\n,]+)/i);
  if (coMatch) {
    out.coApplicant = coMatch[1].trim();
    mark(coMatch[0]);
  }

  // ---- Next Call Date ----
  const lower = text.toLowerCase();
  if (/\bparso\b/.test(lower)) { out.nextCallDate = addDays(2); mark("parso"); }
  else if (/\bkal\b/.test(lower)) { out.nextCallDate = addDays(1); mark("kal"); }
  else if (/\baaj\b/.test(lower)) { out.nextCallDate = addDays(0); mark("aaj"); }

  // ---- Next Call Time ----
  const bajeMatch = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*baje\b/i);
  const ampmMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (bajeMatch) {
    let hh = parseInt(bajeMatch[1], 10);
    let mm = bajeMatch[2] ? parseInt(bajeMatch[2], 10) : 0;
    const hasSubah = /subah|morning/i.test(text);
    const hasShaam = /shaam|evening|dopahar|afternoon/i.test(text);
    if (!hasSubah && (hasShaam || (hh >= 1 && hh <= 7)) && hh < 12) hh += 12;
    out.nextCallTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    mark(bajeMatch[0]);
  } else if (ampmMatch) {
    let hh = parseInt(ampmMatch[1], 10);
    const mm = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPM = /pm/i.test(ampmMatch[3]);
    if (isPM && hh < 12) hh += 12;
    if (!isPM && hh === 12) hh = 0;
    out.nextCallTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    mark(ampmMatch[0]);
  }

  // ---- Status inference ----
  if (/not interested|reject/i.test(text)) {
    out.status = "lost";
    out.reason = "Not interested after home visit";
    mark(text.match(/not interested|reject/i)?.[0] || "");
  } else if (/documents?\s*(pending|wait|chahiye)/i.test(text)) {
    out.status = "hold";
    out.reason = "Documents pending";
    mark(text.match(/documents?\s*(pending|wait|chahiye)/i)?.[0] || "");
  }

  // ---- Unparsed text -> Notes ----
  let leftover = text;
  for (const c of consumed) {
    leftover = leftover.replace(c, " ");
  }
  leftover = leftover.replace(/\s+/g, " ").trim();
  leftover = leftover.replace(/[,.\-:|]+/g, " ").replace(/\s+/g, " ").trim();
  if (leftover && leftover.length > 2) {
    out.notes = leftover.slice(0, 400);
  }

  return out;
}

export function whatsappTemplate(lead) {
  const name = lead.name.split(" ")[0];
  const p = lead.product ? productCode(lead.product) : "loan";
  return `Namaste ${name} ji, main Raj bol raha hoon. Aapki ${p} requirement ke baare mein baat karni thi${
    lead.bank ? ` (${lead.bank})` : ""
  }. Kab baat kar sakte hain?`;
}

export function smsTemplate(lead) {
  const name = lead.name.split(" ")[0];
  return `Namaste ${name} ji, Raj (loan advisor) bol raha hoon. Aapki requirement follow-up ke liye call karunga.`;
}

export function leadsToCSV(leads) {
  const cols = [
    "name", "phone", "altPhone", "product", "bank", "customBank", "loanAmount",
    "existingLoanAmount", "topUpRequested", "status", "reason", "interest",
    "location", "propertyType", "propertyLocation", "marketValue",
    "employment", "entityConstitution", "natureOfBusiness", "turnover",
    "bankingType", "itr", "cibilScore", "currentROI", "monthlySalary",
    "companyCategory", "additionalIncome", "additionalIncomeAmt",
    "rentalIncome", "coApplicant", "existingLoanBank", "existingLoanRemarks",
    "nextCallDate", "nextCallTime", "notes", "meetingsDone", "loginsDone",
    "convertedAt",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [cols.join(",")];
  leads.forEach((l) => rows.push(cols.map((c) => esc(l[c])).join(",")));
  return rows.join("\n");
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
  name: "",
  phone: "",
  altPhone: "",
  location: "",
  businessName: "",
  product: "",
  bank: "",
  customBank: "",
  loanAmount: "",
  existingLoanAmount: "",
  topUpRequested: "",
  status: "new",
  interest: "cold",
  nextCallDate: "",
  nextCallTime: "",
  notes: "",
  history: [],
  propertyType: "",
  propertyLocation: "",
  marketValue: "",
  employment: "",
  itr: "",
  coApplicant: "",
  existingLoanBank: "",
  existingLoanRemarks: "",
  reason: "",
  convertedAt: null,
  // Dynamic business fields
  turnover: "",
  bankingType: "",
  entityConstitution: "",
  natureOfBusiness: "",
  // Dynamic salary fields
  monthlySalary: "",
  companyCategory: "",
  additionalIncome: "",
  additionalIncomeAmt: "",
  // Universal financial fields
  rentalIncome: "",
  cibilScore: "",
  currentROI: "",
  // Counters
  meetingsDone: 0,
  loginsDone: 0,
};

// ---- Gemini AI Copilot ----

export function buildGeminiPrompt(lead) {
  const callTime = recommendCallTime(lead);
  const lines = [
    `Customer Name: ${lead.name || "N/A"}`,
    `Product: ${lead.product || "N/A"}`,
    `Loan Amount (Requirement): ${lead.loanAmount || "N/A"}`,
    `Existing Loan Amount: ${lead.existingLoanAmount || "N/A"}`,
    `Top-Up Requested: ${lead.topUpRequested || "N/A"}`,
    `Bank: ${lead.bank === "Other" ? lead.customBank || "Other" : lead.bank || "N/A"}`,
    `Existing Loan Bank: ${lead.existingLoanBank || "N/A"}`,
    `Employment Type: ${lead.employment || "N/A"}`,
    `Entity Constitution: ${lead.entityConstitution || "N/A"}`,
    `Nature of Business / Industry: ${lead.natureOfBusiness || "N/A"}`,
    `Annual Turnover: ${lead.turnover || "N/A"}`,
    `Latest 2 Years ITR: ${lead.itr || "N/A"}`,
    `Banking Type: ${lead.bankingType || "N/A"}`,
    `Monthly Net Salary: ${lead.monthlySalary || "N/A"}`,
    `Additional Income Source: ${lead.additionalIncome || "N/A"}`,
    `Additional Monthly Income: ${lead.additionalIncomeAmt || "N/A"}`,
    `Property Type: ${lead.propertyType || "N/A"}`,
    `Property Location: ${lead.propertyLocation || "N/A"}`,
    `Market Value: ${lead.marketValue || "N/A"}`,
    `Rental Income Type: ${lead.rentalIncome || "N/A"}`,
    `CIBIL Score: ${lead.cibilScore || "N/A"}`,
    `Current Rate of Interest (ROI): ${lead.currentROI ? lead.currentROI + "%" : "N/A"}`,
    `Company Category: ${lead.companyCategory || "N/A"}`,
    `Co-Applicant: ${lead.coApplicant || "N/A"}`,
    `Status: ${lead.status || "N/A"}`,
    `Interest Level: ${lead.interest || "N/A"}`,
    `Notes: ${lead.notes || "N/A"}`,
    `Recommended Best Call Time: ${callTime.label} (${callTime.reason})`,
  ];
  return `You are a senior Indian loan advisor (DSA) sales coach. Analyze this lead and respond ONLY in Hinglish (Hindi+English mix, roman script). Keep it practical and field-ready. Use the lead's actual financial details (CIBIL, ROI, turnover, banking mix, salary, rental, ITR, top-up, existing loan) to make the strategy specific, not generic.\n\n${lines.join("\n")}\n\nGenerate exactly 5 sections, each on a new line, with these exact labels:\n1) Leverage: <one line core psychological leverage point based on their financial profile>\n2) Hook: <5-8 second high-conversion opening hook, in quotes>\n3) Objection Destroyer: <one line comeback script addressing likely objection>\n4) Cross-sell: <one line cross-sell / product bridge strategy, e.g. PL to BL/LAP shift if eligibility fails>\n5) Best Call Time: <exact recommended time with one-line reason, e.g. "11:30 AM — Construction business wale site visit ke baad free hote hain">`;
}

export async function callGemini(apiKey, lead) {
  if (!apiKey) {
    const { mockCopilot } = await import("./constants");
    return mockCopilot(lead);
  }
  const prompt = buildGeminiPrompt(lead);
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    apiKey;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
    "";
  if (!text) throw new Error("Gemini returned empty response");
  return text.trim();
}

export function parseCopilotResponse(text) {
  const sections = { leverage: "", hook: "", objection: "", crossSell: "", callTime: "" };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+\))?\.?\s*(Leverage|Hook|Objection(?:\s*Destroyer)?|Cross[- ]?sell|Best\s*Call\s*Time)\s*[:\-]\s*(.*)/i);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key.startsWith("leverage")) sections.leverage = val;
      else if (key.startsWith("hook")) sections.hook = val;
      else if (key.startsWith("objection")) sections.objection = val;
      else if (key.startsWith("cross")) sections.crossSell = val;
      else if (key.startsWith("best")) sections.callTime = val;
    }
  }
  return sections;
}
