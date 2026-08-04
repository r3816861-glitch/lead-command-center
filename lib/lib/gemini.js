const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Real key baad me add kar lenge

export const generateAIPitch = async (objectionText) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    // Smart Fallback Script Engine (If no API key)
    return getFallbackScript(objectionText);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Act as a 1% Sales Coach for Indian Loan Professionals (LAP, MSME, Home Loans). 
              Customer Objection: "${objectionText}"
              Give a 1-2 line (max 8 seconds) razor-sharp, brutal Hinglish counter-pitch that overcomes this objection on cold call.`
            }]
          }]
        })
      }
    );
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (e) {
    return getFallbackScript(objectionText);
  }
};

const getFallbackScript = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes("rate") || lower.includes("vyaj") || lower.includes("interest")) {
    return "Sir, rate matter karta hai par ROI aur tenure over-all payout decide karte hain. Direct Bank vs DSA me 0.5% ka jo gap aap dekh rahe ho, wo processing fee waive off hoke equal ho jata hai. Ek baar ROI sheet bheju?";
  }
  if (lower.includes("sochna") || lower.includes("think")) {
    return "Bilkul sir, sochna zaroori hai. Par aap EMI calculate kar rahe ho ya sanction time? Main bas 2 min me comparison chart WhatsApp kar raha hu, fir decide kar lena.";
  }
  return "Sir, market me 10 log call karenge, par LAP/MSME me structural approval ka experience matter karta hai. File login se pehle login eligibility check karwa lijiye, zero risk.";
};