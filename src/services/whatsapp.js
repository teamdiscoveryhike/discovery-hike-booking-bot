import axios from "axios";

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

// ✅ 1. Send plain text
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

// ✅ 2. Send buttons (for confirmation, service menu, etc.)
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

// ✅ 3. Send list (for trek selection, etc.)
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

// ✅ 4. Reusable: Unauthorized access response
export async function sendUnauthorized(to) {
  return sendText(to, "⛔ You are not authorized to use this booking bot.");
}

// ✅ 5. Reusable: Admin menu
export async function sendAdminMenu(to) {
  return sendButtons(to, "👋 Welcome to *Discovery Hike Admin Panel*.\nChoose a service:", [
    { type: "reply", reply: { id: "start_booking", title: "📄 New Booking" } },
    { type: "reply", reply: { id: "view_upcoming", title: "📅 Upcoming Treks" } },
    { type: "reply", reply: { id: "assign_vehicle", title: "🚐 Assign Vehicle" } }
  ]);
}

// ✅ 6. Check if number is on WhatsApp
export async function checkWhatsappNumber(phone) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/contacts`,
      {
        blocking: "wait",
        contacts: [phone]
      },
      { headers }
    );

    return response.data?.contacts?.[0]?.wa_id ? true : false;
  } catch (err) {
    console.error("❌ WhatsApp number check failed:", err.response?.data || err.message);
    return false;
  }
}
export async function sendBookingTemplate(to, variables) {
  try {
    await axios.post(WHATSAPP_API_URL, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: "booking_confirmation", // ensure this template has an image header
        language: { code: "en" },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://raw.githubusercontent.com/teamdiscoveryhike/discovery-hike-booking-bot/master/Assets/logo.png"
                }
              }
            ]
          },
          {
            type: "body",
            parameters: variables.map(text => ({
              type: "text",
              text
            }))
          }
        ]
      }
    }, { headers });
  } catch (err) {
    console.error("❌ sendBookingTemplate error:", err.response?.data || err.message);
  }
}