import axios from "axios";

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

export async function sendText(to, text) {
  try {
    await axios.post(WHATSAPP_API_URL, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    }, { headers });
  } catch (err) {
    console.error("❌ sendText error:", err.response?.data || err.message);
  }
}

export async function sendButtons(to, bodyText, buttons) {
  try {
    await axios.post(WHATSAPP_API_URL, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: { buttons }
      }
    }, { headers });
  } catch (err) {
    console.error("❌ sendButtons error:", err.response?.data || err.message);
  }
}

export async function sendList(to, bodyText, sections, headerText = "Select Option") {
  try {
    await axios.post(WHATSAPP_API_URL, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: headerText },
        body: { text: bodyText },
        footer: { text: "Discovery Hike" },
        action: { button: "Choose", sections }
      }
    }, { headers });
  } catch (err) {
    console.error("❌ sendList error:", err.response?.data || err.message);
  }
}
