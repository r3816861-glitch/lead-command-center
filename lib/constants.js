// Pure data module — no React, no components. Safe to import anywhere.

export const STATUS_ORDER = ["new", "followup", "callback", "hold", "converted", "lost"];

export const STATUS = {
  new: { label: "Naya", color: "#06B6D4" },
  followup: { label: "Follow-up", color: "#FBBF24" },
  callback: { label: "Callback", color: "#6366F1" },
  hold: { label: "Hold", color: "#94A3B8" },
  converted: { label: "Won", color: "#10B981" },
  lost: { label: "Lost", color: "#EF4444" },
};

export const INTEREST = {
  hot: { label: "Hot", color: "#EF4444" },
  warm: { label: "Warm", color: "#FBBF24" },
  cold: { label: "Cold", color: "#06B6D4" },
};

export const PRODUCTS = [
  { v: "Home Loan (HL)", c: "HL" },
  { v: "HL Balance Transfer (HL BT)", c: "HL BT" },
  { v: "Loan Against Property (LAP)", c: "LAP" },
  { v: "LAP Balance Transfer (LAP BT)", c: "LAP BT" },
  { v: "Business Loan (BL - Unsecured)", c: "BL" },
  { v: "MSME Working Capital", c: "MSME" },
  { v: "Personal Loan (PL)", c: "PL" },
];

export const BANKS = [
  "HDFC", "ICICI", "Axis Bank", "Kotak Mahindra", "IIFL", "IDFC First",
  "Federal Bank", "SBI", "IDBI", "Punjab National Bank", "Canara Bank",
  "Bajaj Finserv", "Tata Capital", "L&T Finance", "Other",
];

export const EMPLOYMENT = [
  "Salaried",
  "Self-Employed Business",
  "Self-Employed Professional",
];

export const ENTITY_CONSTITUTION = [
  "Proprietorship",
  "Partnership",
  "Pvt Ltd",
  "LLP",
  "Individual",
];

export const NATURE_OF_BUSINESS = [
  "Construction / Contractor",
  "Retail / Kirana",
  "Manufacturing",
  "IT / Software",
  "Trading / Wholesale",
  "Services",
  "Restaurant / F&B",
  "Transport / Logistics",
  "Agriculture",
  "Real Estate",
  "Other",
];

export const ADDITIONAL_INCOME_SOURCES = [
  "None",
  "Rental Income",
  "Side Business",
  "Other",
];

export const PROPERTY_TYPES = [
  "Residential Flat",
  "Residential House",
  "Commercial Shop",
  "Commercial Office",
  "Industrial",
  "Plot / Land",
];

export const TURNOVER_BANDS = [
  "Below 50L",
  "50L - 1Cr",
  "1Cr - 5Cr",
  "5Cr+",
];

export const BANKING_TYPES = [
  "Pure Bank",
  "Cash Mix",
  "Heavy Cash",
];

export const RENTAL_INCOME_TYPES = [
  "None",
  "Bank Transfer (Pakka)",
  "Cash (Kacha)",
  "Mix",
];

export const COMPANY_CATEGORIES = ["CAT A", "CAT B", "CAT C"];

export const HOLD_LOST_REASONS = [
  "Not interested after home visit",
  "Rate too high",
  "Went with another DSA / bank",
  "Documents pending",
  "Eligibility issue / CIBIL low",
  "Just exploring / not serious",
  "Budget mismatch",
];

export const TIME_TAGS = [
  { label: "Kal", days: 1 },
  { label: "2 din", days: 2 },
  { label: "3 din", days: 3 },
  { label: "Aglay hafte", days: 7 },
];

export const OUTCOME_TAGS = [
  { label: "Call uthaya", note: "Call utha liya, baat hui", color: "#10B981" },
  { label: "No answer", note: "Call nahi uthaya", color: "#FBBF24", status: "callback" },
  { label: "Docs maange", note: "Documents maange", color: "#06B6D4", status: "hold", reason: "Documents pending" },
  { label: "Not interested", note: "Not interested", color: "#EF4444", status: "lost", reason: "Not interested after home visit" },
  { label: "Meeting fix", note: "Meeting fix ki", color: "#6366F1" },
  { label: "File login", note: "File login ho gayi", color: "#10B981" },
  { label: "Won", note: "Deal close / disbursed", color: "#10B981", status: "converted" },
];

export const OBJECTIONS = [
  { q: "Interest rate zyada hai", a: "Sirf rate mat dekho — total processing cost aur top-up flexibility dekho. Main aapko exact comparison bana ke doon dono banks ka." },
  { q: "Pehle se dusre bank se loan hai", a: "Bilkul, isiliye toh Balance Transfer hai — aapki EMI kam ho sakti hai aur upar se top-up bhi mil sakta hai." },
  { q: "Sochna hai / abhi busy hoon", a: "Bilkul soch lijiye — main sirf documents ke basis pe ek pre-approval nikaal ke rakhta hoon, koi commitment nahi hai." },
  { q: "Documents ka jhanjhat hai", a: "Sirf 4-5 documents chahiye, aur main khud aake collect kar lunga." },
  { q: "Family se puchna hai", a: "Bilkul sahi approach hai. Main summary WhatsApp pe bhej deta hoon, dikhana easy ho jayega." },
  { q: "Trust nahi hai", a: "Main authorized DSA hoon — loan seedha bank se sanction hota hai, aap branch mein bhi verify kar sakte hain." },
  { q: "EMI bahut bhaari hai", a: "Isi wajah se restructuring dekhna chahiye — tenure adjust karke EMI kam ho sakti hai." },
  { q: "Documents complete nahi hain", a: "Koi baat nahi, jo hai wahi bhejo — baaki main bata dunga kya arrange karna hai." },
];

export const DEFAULT_SETTINGS = {
  commissionPct: 0.5,
  geminiApiKey: "",
};

export const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";

export const GEMINI_MODEL = "gemini-1.5-flash";

// Dynamic document checklist based on employment type + entity constitution
export function getDocumentChecklist(lead) {
  const list = [];
  const isSalaried = /salaried/i.test(lead.employment || "");
  const isSelfEmployed = /self-employed/i.test(lead.employment || "");
  const constitution = lead.entityConstitution || "";
  const product = lead.product || "";

  // KYC — universal
  list.push("PAN Card");
  list.push("Aadhaar Card");
  list.push("Address Proof (Electricity Bill / Rent Agreement)");
  list.push("2 Passport Photos");

  if (isSalaried) {
    list.push("3 Months Salary Slips");
    list.push("Form 16 / Annual Salary Certificate");
    list.push("6 Months Bank Statements (Salary Account)");
    list.push("Appointment Letter / Employee ID");
  } else if (isSelfEmployed) {
    list.push("6 Months Bank Statements (Current Account)");
    list.push("GST Returns (Last 6 Months)");
    list.push("ITR — Last 2 Years");

    if (/partnership/i.test(constitution)) {
      list.push("Partnership Deed");
      list.push("Audit Report (if turnover > 1Cr)");
    } else if (/pvt ltd/i.test(constitution)) {
      list.push("Certificate of Incorporation");
      list.push("MOA & AOA");
      list.push("Board Resolution (authorising loan)");
      list.push("Statutory Audit Report");
    } else if (/llp/i.test(constitution)) {
      list.push("LLP Agreement");
      list.push("Certificate of Incorporation");
    } else if (/proprietorship/i.test(constitution)) {
      list.push("Shop Act / Gumasta License");
      list.push("Proprietorship Declaration / Affidavit");
    }
  }

  // Property documents for LAP / HL
  if (/LAP|HL/i.test(product) && !/BT/i.test(product)) {
    list.push("Property Title Deed (Chain of Documents)");
    list.push("Latest Property Tax Receipt");
    list.push("Approved Building Plan / Sanction");
    list.push("NOC from Society / Builder");
  }

  // Balance transfer extras
  if (/BT/i.test(product)) {
    list.push("Existing Loan Sanction Letter");
    list.push("Repayment Track Record (12 Months)");
    list.push("Foreclosure Statement from Current Bank");
  }

  return list;
}

// Smart Follow-up Engine — rule-based best call time recommendation
export function recommendCallTime(lead) {
  const isSalaried = /salaried/i.test(lead.employment || "");
  const isSelfEmployed = /self-employed/i.test(lead.employment || "");
  const nob = (lead.natureOfBusiness || "").toLowerCase();

  if (isSalaried) {
    return {
      time: "19:00",
      label: "7:00 PM",
      reason: "Salaried log office ke baad 7 PM pe free hote hain. Tab call uthane ki guarantee zyada.",
    };
  }
  if (isSelfEmployed) {
    if (/construction|contractor|builder|infrastructure/i.test(nob)) {
      return {
        time: "11:30",
        label: "11:30 AM",
        reason: "Construction business wale subah site visit pe jaate hain. 11:30 AM pe wapas aake free hote hain.",
      };
    }
    if (/retail|kirana|rashan|shop/i.test(nob)) {
      return {
        time: "14:00",
        label: "2:00 PM",
        reason: "Retail shop wale dopahar 2 PM pe relatively free hote hain — subah aur shaam rush hai.",
      };
    }
    if (/restaurant|food|f&b|catering|hotel/i.test(nob)) {
      return {
        time: "15:00",
        label: "3:00 PM",
        reason: "Restaurant wale lunch rush ke baad 3 PM pe free hote hain.",
      };
    }
    if (/it|software|tech|services/i.test(nob)) {
      return {
        time: "13:00",
        label: "1:00 PM",
        reason: "IT/Services log lunch break 1 PM pe lete hain — tab call pick karne ke chances.",
      };
    }
    if (/transport|logistics/i.test(nob)) {
      return {
        time: "10:00",
        label: "10:00 AM",
        reason: "Transport business wale subah 10 AM pe dispatch ke baad free hote hain.",
      };
    }
    return {
      time: "12:00",
      label: "12:00 PM",
      reason: "Self-employed log din mein 12 PM ke aas-paas free hote hain — general best time.",
    };
  }
  return {
    time: "11:00",
    label: "11:00 AM",
    reason: "Late morning 11 AM ek safe default hai — zyada log tab call uthate hain.",
  };
}

// Mock fallback for the AI Copilot when no API key is set.
export function mockCopilot(lead) {
  const p = lead.product || "loan";
  const callTime = recommendCallTime(lead);
  return `1) Leverage: ${lead.name || "Customer"} ki urgency aur existing banking relationship pe focus karo.
2) Hook: "Namaste ${lead.name ? lead.name.split(" ")[0] : "ji"}, main Raj bol raha hoon — aapki ${p} requirement ke liye ek behtar option hai jo EMI kam kar sakta hai. 2 minute mein samjhaun?"
3) Objection Destroyer: "Rate ek factor hai, lekin total saving aur top-up flexibility zyada important hai — main exact comparison bana ke deta hoon."
4) Cross-sell: Agar ${p} mein eligibility issue ho toh PL se BL/LAP shift karwa do, ya reverse — property value achhi hai toh LAP pe better rate milega.
5) Best Call Time: ${callTime.label} — ${callTime.reason}`;
}
