import axios from "axios";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0/{{PHONE_NUMBER_ID}}/messages";
const TOKEN = process.env.WHATSAPP_TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

export async function sendText(to, text) {
  return axios.post(WHATSAPP_API_URL, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text }
  }, { headers });
}

export async function sendButtons(to, bodyText, buttons) {
  return axios.post(WHATSAPP_API_URL, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: { buttons }
    }
  }, { headers });
}

export async function sendList(to, bodyText, sections, headerText = "Select Option") {
  return axios.post(WHATSAPP_API_URL, {
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
}
