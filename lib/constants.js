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
  "HDFC", "ICICI", "Axis Bank", "Kotak Mahindra", "IIFL",
  "Federal Bank", "SBI", "Bajaj Finserv", "Tata Capital", "Other",
];

export const EMPLOYMENT = [
  "Salaried",
  "Self-Employed Business",
  "Self-Employed Professional",
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
  "Pakka - Bank Transfer",
  "Kacha - Cash",
  "Cash + Bank Mix",
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

// Mock fallback for the AI Copilot when no API key is set.
export function mockCopilot(lead) {
  const p = lead.product || "loan";
  return `1) Leverage: ${lead.name || "Customer"} ki urgency aur existing banking relationship pe focus karo.
2) Hook: "Namaste ${lead.name ? lead.name.split(" ")[0] : "ji"}, main Raj bol raha hoon — aapki ${p} requirement ke liye ek behtar option hai jo EMI kam kar sakta hai. 2 minute mein samjhaun?"
3) Objection Destroyer: "Rate ek factor hai, lekin total saving aur top-up flexibility zyada important hai — main exact comparison bana ke deta hoon."
4) Cross-sell: Agar ${p} mein eligibility issue ho toh PL se BL/LAP shift karwa do, ya reverse — property value achhi hai toh LAP pe better rate milega.`;
}
