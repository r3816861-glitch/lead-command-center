export const STATUS_ORDER = ["new", "followup", "callback", "hold", "converted", "lost"];

export const STATUS = {
  new: { label: "Naya", color: "#38bdf8" },
  followup: { label: "Follow-up", color: "#fbbf24" },
  callback: { label: "Callback", color: "#a78bfa" },
  hold: { label: "Hold", color: "#94a3b8" },
  converted: { label: "Won", color: "#34d399" },
  lost: { label: "Lost", color: "#fb7185" },
};

export const INTEREST = {
  hot: { label: "High ROI", color: "#fb7185" },
  warm: { label: "Warm", color: "#fbbf24" },
  cold: { label: "Cold", color: "#38bdf8" },
};

export const PRODUCTS = [
  { v: "Home Loan (Fresh)", c: "HL" },
  { v: "Home Loan BT", c: "HL BT" },
  { v: "Home Loan OD", c: "HL-OD" },
  { v: "LAP (Fresh)", c: "LAP" },
  { v: "LAP Balance Transfer", c: "LAP BT" },
  { v: "LAP OD", c: "LAP-OD" },
  { v: "MSME Loan (Fresh)", c: "MSME" },
  { v: "MSME Balance Transfer", c: "MSME BT" },
  { v: "Top-up Loan", c: "Top-up" },
];

export const BANKS = [
  "HDFC", "ICICI", "Axis Bank", "Kotak Mahindra", "IIFL", "Federal Bank",
  "Bank of India", "PNB", "SBI", "Yes Bank", "Bajaj Finserv", "Tata Capital",
  "L&T Finance", "PNB Housing Finance", "LIC Housing Finance", "Other",
];

export const EMPLOYMENT = ["Salaried", "Self-Employed Business", "Self-Employed Professional"];
export const PROPERTY_TYPES = ["Residential", "Commercial", "Industrial", "Mixed Use"];

export const HOLD_LOST_REASONS = [
  "Rate/ROI issue", "Documents pending", "Went with other bank/DSA",
  "Not interested after home visit", "Not reachable", "Property/legal issue",
  "Budget mismatch", "Customer postponed", "Other",
];

export const TIME_TAGS = [
  { label: "Kal", days: 1 },
  { label: "2 Din Baad", days: 2 },
  { label: "1 Hafte Baad", days: 7 },
];

export const OUTCOME_TAGS = [
  { label: "Interested", status: "followup", reason: "", note: "Interested laga, follow-up mein rakha.", color: "#34d399" },
  { label: "Documents Pending", status: "hold", reason: "Documents pending", note: "Documents ka wait hai.", color: "#94a3b8" },
  { label: "Rate Issue", status: "hold", reason: "Rate/ROI issue", note: "ROI ko lekar hesitant hai.", color: "#94a3b8" },
  { label: "Not Reachable", status: null, reason: "Not reachable", note: "Call nahi utha / not reachable.", color: "#fbbf24" },
  { label: "Not Interested", status: "lost", reason: "Not interested after home visit", note: "Customer ne mana kar diya.", color: "#fb7185" },
  { label: "Ready to Close", status: "converted", reason: "", note: "Ready to close — documents collect karne hain.", color: "#34d399" },
];

// Deterministic — no AI/network dependency, so it's instant and never fails.
export const OBJECTIONS = [
  { q: "Interest rate zyada hai", a: "Sirf rate mat dekho — total processing cost aur top-up flexibility dekho. Main aapko exact comparison bana ke doon dono banks ka, 2 min mein clear ho jayega kaun sasta pad raha hai." },
  { q: "Pehle se dusre bank se loan hai", a: "Bilkul, isiliye toh Balance Transfer hai — aapki EMI kam ho sakti hai aur upar se top-up bhi mil sakta hai. Sirf paperwork switch hota hai, loan chalu rehta hai." },
  { q: "Sochna hai / abhi busy hoon", a: "Bilkul soch lijiye — main sirf itna karta hoon ki aapke documents ke basis pe ek pre-approval nikaal ke rakhta hoon, taaki jab ready ho tab time waste na ho. Koi commitment nahi hai." },
  { q: "Documents ka jhanjhat hai", a: "Sirf 4-5 documents chahiye, aur main khud aake collect kar lunga — aapko branch tak jaane ki zarurat nahi. Poora process main handle karta hoon." },
  { q: "Family/partner se puchna hai", a: "Bilkul sahi approach hai. Main aapko ek chhota sa summary bhej deta hoon WhatsApp pe — rate, EMI, sab kuch — taaki unhe dikhana easy ho. Kal isi time baat kar lete hain?" },
  { q: "Trust nahi hai / naya lag raha hai", a: "Main {{BANK}} ka authorized DSA hoon — loan seedha bank se sanction hota hai, main bas process fast karta hoon. Aap bank branch mein bhi verify kar sakte hain, koi dikkat nahi." },
  { q: "EMI already bahut bhaari hai", a: "Isi wajah se restructuring ya balance transfer dekhna chahiye — tenure adjust karke EMI kam ho sakti hai. Ek baar numbers dikhata hoon, decide aap karenge." },
  { q: "Property/business documents complete nahi hain", a: "Koi baat nahi, jo hai wahi bhejo — main dekh ke bata dunga kya aur chahiye aur kaise arrange karna hai. Case ko hold pe daal ke chalte hain, ready hote hi restart karenge." },
];

export const DEFAULT_SETTINGS = { commissionPct: 0.5, apiKey: "", aiProvider: "anthropic" };

export const AI_PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)", endpoint: "https://api.anthropic.com/v1/messages", model: "claude-sonnet-5" },
  { id: "openai", label: "OpenAI (GPT)", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
];

// Deterministic fallback hooks — used when no API key is set, so the Hook
// Generator never crashes and always returns something usable instantly.
export const MOCK_HOOKS = {
  "LAP (Fresh)": "{name} ji, jo property khaali padi hai usse aap {loanAmount} tak turant unlock kar sakte hain — 2 min mein bataun kaise?",
  "LAP Balance Transfer": "{name} ji, {bank} wale se zyada rate de rahe hain kya? Main aapki EMI kam karke top-up bhi dila sakta hoon.",
  "LAP OD": "{name} ji, paisa jab chahiye tab nikaalo, jab nahi chahiye tab interest hi mat do — LAP Overdraft isi ke liye bana hai.",
  "Home Loan (Fresh)": "{name} ji, ghar ka sapna ab sirf 24 ghante ke documentation door hai — main poora process sambhal lunga.",
  "Home Loan BT": "{name} ji, sirf 10 min mein bata sakta hoon aap {bank} se switch karke kitna bachayenge — sun lijiye ek baar.",
  "Home Loan OD": "{name} ji, apni savings ko EMI ke against use karke interest bachana chahenge?",
  "MSME Loan (Fresh)": "{name} ji, business grow karne ka mauka haath se nikal na jaye — working capital 48 ghante mein ready ho sakta hai.",
  "MSME Balance Transfer": "{name} ji, business loan ka rate zyada lag raha hai? Switch karne mein sirf paperwork lagta hai, business nahi rukta.",
  "Top-up Loan": "{name} ji, jo loan chal raha hai usi ke upar extra funding chahiye? Naya loan process nahi, sirf top-up.",
  default: "{name} ji, aapki {product} requirement ke liye 2 min hain kya — ek cheez turant clear kar deta hoon jo shayad kisi ne nahi batayi.",
};

export const MOCK_COACH = {
  new: "Abhi customer thanda hai — pehli call mein sirf trust banao, pitch mat maaro. Product ke bare mein poochho, unki asli need samjho, phir agla step suggest karo. Avoid: turant rate/EMI discuss karna pehli call mein.",
  followup: "Customer interested hai lekin decide nahi kar paa raha — usse ek chhota commitment do (documents bhejna, ek call schedule karna), bada decision mat maango. Avoid: baar-baar wahi pitch repeat karna.",
  callback: "Callback fix hai matlab customer serious hai — is call mein specific numbers (EMI, processing fee) leke jao, generic baat mat karo. Avoid: call ko delay karna, jaldi follow-up karo.",
  hold: "Kuch blocker hai (documents/rate/dusra bank) — pehle blocker identify karo phir specific solution do, generic follow-up se kaam nahi chalega. Avoid: bina blocker pooche baar baar call karna.",
  converted: "Deal ho gaya — ab documentation fast track karo aur turant referral maango, warm lead hai abhi.",
  lost: "Ye case abhi ke liye band hai — 60-90 din baad ek soft touch-point rakho (naya scheme/rate change), turant follow-up mat karo.",
};

