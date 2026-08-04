import { Linking, Alert } from 'react-native';

// Meta WhatsApp Business API Details (Replace credentials when live)
const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages";
const ACCESS_TOKEN = "YOUR_META_WHATSAPP_TOKEN";

export const sendAutomatedWhatsApp = async (phone, clientName, loanType, templateType = 'DEFAULT') => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  // Message Script Templates
  let messageText = ``;

  if (templateType === 'DOC_PICKUP') {
    messageText = `Hello ${clientName} ji, Bank of India / HSBC DSA desk se Raj baat kar raha hu. Aapke ${loanType} approval ke liye required documents list:\n1. Pan & Aadhar Card\n2. 6 Months Bank Statement\n3. Latest 3 Months Salary Slip / GST Returns.\n\nDocument collection ke liye convenient time bataen.`;
  } else if (templateType === 'HOT_BT') {
    messageText = `Hello ${clientName} ji, Raj here from DSA Desk. Aapke existing loan par 0.5% se 1.2% tak ka Rate Interest drop aur Top-up offer calculate kar liya hai. Comparison chart dekhne ke liye Ha/Yes reply karein.`;
  } else {
    messageText = `Hello ${clientName} ji, Raj here from Bank of India / HSBC DSA Desk. Aapke ${loanType} requirement par call connect nahi ho paya. Convenient time drop kar dijiye, I will call back.`;
  }

  // Fallback to Direct Deep Link (If Meta API token is not yet configured)
  if (!ACCESS_TOKEN || ACCESS_TOKEN === "YOUR_META_WHATSAPP_TOKEN") {
    const directUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(messageText)}`;
    try {
      const supported = await Linking.canOpenURL(directUrl);
      if (supported) {
        await Linking.openURL(directUrl);
      } else {
        Alert.alert("Error", "WhatsApp app installed nahi hai.");
      }
    } catch (err) {
      console.error("WhatsApp Link Error:", err);
    }
    return;
  }

  // Production Meta Webhook API Request
  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: { body: messageText },
      }),
    });

    const data = await response.json();
    if (data.messages) {
      console.log("WhatsApp Auto-Message Sent Successfully");
    }
  } catch (error) {
    console.error("WhatsApp API Error:", error);
  }
};