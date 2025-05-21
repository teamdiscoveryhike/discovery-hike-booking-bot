// src/api/webhook.js
import express from 'express';
import { sendWhatsAppMessage } from '../services/whatsapp.js';

const router = express.Router();

// 1️⃣ Verification endpoint (GET)
router.get('/', (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;   // must match .env
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// 2️⃣ Message handler (POST)
router.post('/', async (req, res) => {
  try {
    const entry   = req.body.entry?.[0];
    const change  = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return res.sendStatus(200);  // ignore non-text
    }

    const from = message.from;
    const msg  = message.text.body;

    console.log(`📩 Received message from ${from}: ${msg}`);

    const reply = `👋 Hello! We received your message: "${msg}". A team member will assist you shortly.`;
    await sendWhatsAppMessage(from, reply);

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

export default router;
