// src/services/whatsapp.js
import axios from 'axios';

export async function sendWhatsAppMessage(recipientPhone, messageText) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
  const payload = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'text',
    text: { body: messageText }
  };

  try {
    const response = await axios.post(url, payload, { headers });
    console.log('✅ Message sent:', response.data);
  } catch (err) {
    console.error('❌ Failed to send message:', err.response?.data || err.message);
  }
}
