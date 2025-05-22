import express from "express";
import {
  startSession,
  isSessionActive,
  getCurrentStep,
  saveResponse,
  isSessionComplete,
  getSessionData,
  endSession
} from "../services/sessionManager.js";

import {
  sendText,
  sendButtons,
  sendList
} from "../services/whatsapp.js";

const router = express.Router();

// ✅ 1. GET /webhook — Meta verification
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta!");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ✅ 2. POST /webhook — Message handler
router.post("/", async (req, res) => {
  console.log("📥 Incoming webhook payload:", JSON.stringify(req.body, null, 2));

  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = message?.from;
  const text = message?.text?.body;
  const buttonReply = message?.interactive?.button_reply?.id;
  const listReply = message?.interactive?.list_reply?.id;

  if (!text && !buttonReply && !listReply) return res.sendStatus(200);

  // ✅ Authorization check
  const allowedNumbers = process.env.ALLOWED_TEAM_NUMBERS?.split(",") || [];
  if (!allowedNumbers.includes(from)) {
    console.log(`🚫 Unauthorized access attempt from: ${from}`);
    await sendText(from, "⛔ You are not authorized to use this booking bot.");
    return res.sendStatus(200);
  }

  const input = buttonReply || listReply || text;

  // ✅ Admin menu entry point
  if (!isSessionActive(from)) {
    if (input.toLowerCase().includes("book") || input === "start_booking") {
      startSession(from);
      await sendTrekList(from);
    } else {
      await sendButtons(from, "📋 Admin Menu:", [
        { type: "reply", reply: { id: "start_booking", title: "📌 New Booking" } },
        { type: "reply", reply: { id: "view_upcoming", title: "📅 Upcoming Treks" } },
        { type: "reply", reply: { id: "assign_vehicle", title: "🚐 Assign Vehicle" } },
        { type: "reply", reply: { id: "log_payment", title: "💰 Log Payment" } }
      ]);
    }
    return res.sendStatus(200);
  }

  const step = getCurrentStep(from);
  saveResponse(from, input);

  if (isSessionComplete(from)) {
    const data = getSessionData(from);
    endSession(from);

    const groupSize = parseInt(data.groupSize || 0);
    const ratePerPerson = parseInt(data.ratePerPerson || 0);
    const advancePaid = parseInt(data.advancePaid || 0);
    const total = groupSize * ratePerPerson;
    const balance = total - advancePaid;

    const summary = `🧾 *Booking Summary:*
• *Trek:* ${data.trekName}
• *Date:* ${data.trekDate}
• *Pickup:* ${data.pickupLocation}
• *Group Size:* ${groupSize}
• *Rate/Person:* ₹${ratePerPerson}
• *Total Amount:* ₹${total}
• *Advance Paid:* ₹${advancePaid}
• *Balance:* ₹${balance}
• *Stay Type:* ${data.sharingType}
• *Payment Mode:* ${data.paymentMode}
• *Reference ID:* ${data.paymentRef}
• *Notes:* ${data.specialNotes || "-"}`;

    await sendText(from, summary);
    await sendButtons(from, "✅ Confirm booking?", [
      { type: "reply", reply: { id: "confirm_yes", title: "Yes" } },
      { type: "reply", reply: { id: "confirm_no", title: "No" } }
    ]);

    return res.sendStatus(200);
  }

  const nextStep = getCurrentStep(from);
  await askNextQuestion(from, nextStep);
  res.sendStatus(200);
});

// ✅ 3. Ask next input based on current step
async function askNextQuestion(userId, step) {
  if (step === "trekName") {
    return sendTrekList(userId);
  }
  if (step === "trekDate") {
    return sendButtons(userId, "📅 Choose a date:", [
      { type: "reply", reply: { id: "today", title: "Today" } },
      { type: "reply", reply: { id: "tomorrow", title: "Tomorrow" } },
      { type: "reply", reply: { id: "manual", title: "Enter Manually" } }
    ]);
  }
  if (step === "sharingType") {
    return sendButtons(userId, "How would the group prefer to stay?", [
      { type: "reply", reply: { id: "private", title: "Private" } },
      { type: "reply", reply: { id: "sharing", title: "Sharing" } }
    ]);
  }
  if (step === "paymentMode") {
    return sendButtons(userId, "💳 Payment mode?", [
      { type: "reply", reply: { id: "full", title: "Full" } },
      { type: "reply", reply: { id: "advance", title: "Advance" } },
      { type: "reply", reply: { id: "onspot", title: "On-spot" } }
    ]);
  }

  return sendText(userId, `Please enter ${step.replace(/([A-Z])/g, " $1").toLowerCase()}:`);
}

// ✅ 4. Trek selection list
async function sendTrekList(userId) {
  return sendList(userId, "Choose trek:", [
    {
      title: "Popular Treks",
      rows: [
        { id: "kedarkantha", title: "Kedarkantha Trek" },
        { id: "brahmatal", title: "Brahmatal Trek" },
        { id: "harkidun", title: "Har Ki Dun" }
      ]
    }
  ], "🌄 Select a Trek");
}

export default router;

  sendText,
  sendButtons,
  sendList
} from "../services/whatsapp.js";

const router = express.Router();

// ✅ 1. GET /webhook — Meta verification
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta!");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ✅ 2. POST /webhook — Message handler
router.post("/", async (req, res) => {
  console.log("📥 Incoming webhook payload:", JSON.stringify(req.body, null, 2));

  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = message?.from;
  const text = message?.text?.body;
  const buttonReply = message?.interactive?.button_reply?.id;
  const listReply = message?.interactive?.list_reply?.id;

  if (!text && !buttonReply && !listReply) return res.sendStatus(200);

  if (text?.toLowerCase() === "book trek") {
    startSession(from);
    await sendTrekList(from);
    return res.sendStatus(200);
  }

  if (!isSessionActive(from)) return res.sendStatus(200);

  const step = getCurrentStep(from);
  const input = buttonReply || listReply || text;

  saveResponse(from, input);

  if (isSessionComplete(from)) {
    const data = getSessionData(from);
    endSession(from);

    // 🧠 Parse numeric fields
    const groupSize = parseInt(data.groupSize || 0);
    const ratePerPerson = parseInt(data.ratePerPerson || 0);
    const advancePaid = parseInt(data.advancePaid || 0);

    const total = groupSize * ratePerPerson;
    const balance = total - advancePaid;

    // 🧾 Booking summary
    const summary = `🧾 *Booking Summary:*\n
• *Trek:* ${data.trekName}
• *Date:* ${data.trekDate}
• *Pickup:* ${data.pickupLocation}
• *Group Size:* ${groupSize}
• *Rate/Person:* ₹${ratePerPerson}
• *Total Amount:* ₹${total}
• *Advance Paid:* ₹${advancePaid}
• *Balance:* ₹${balance}
• *Stay Type:* ${data.sharingType}
• *Payment Mode:* ${data.paymentMode}
• *Reference ID:* ${data.paymentRef}
• *Notes:* ${data.specialNotes || "-"}
`;

    await sendText(from, summary);
    await sendButtons(from, "✅ Confirm booking?", [
      { type: "reply", reply: { id: "confirm_yes", title: "Yes" } },
      { type: "reply", reply: { id: "confirm_no", title: "No" } }
    ]);

    return res.sendStatus(200);
  }

  const nextStep = getCurrentStep(from);
  await askNextQuestion(from, nextStep);
  res.sendStatus(200);
});

// ✅ 3. Ask next input based on current step
async function askNextQuestion(userId, step) {
  if (step === "trekName") {
    return sendTrekList(userId);
  }
  if (step === "trekDate") {
    return sendButtons(userId, "📅 Choose a date:", [
      { type: "reply", reply: { id: "today", title: "Today" } },
      { type: "reply", reply: { id: "tomorrow", title: "Tomorrow" } },
      { type: "reply", reply: { id: "manual", title: "Enter Manually" } }
    ]);
  }
  if (step === "sharingType") {
    return sendButtons(userId, "How would the group prefer to stay?", [
      { type: "reply", reply: { id: "private", title: "Private" } },
      { type: "reply", reply: { id: "sharing", title: "Sharing" } }
    ]);
  }
  if (step === "paymentMode") {
    return sendButtons(userId, "💳 Payment mode?", [
      { type: "reply", reply: { id: "full", title: "Full" } },
      { type: "reply", reply: { id: "advance", title: "Advance" } },
      { type: "reply", reply: { id: "onspot", title: "On-spot" } }
    ]);
  }

  // 🧠 Fallback to simple input
  return sendText(userId, `Please enter ${step.replace(/([A-Z])/g, " $1").toLowerCase()}:`);
}

// ✅ 4. Trek selection list
async function sendTrekList(userId) {
  return sendList(userId, "Choose trek:", [
    {
      title: "Popular Treks",
      rows: [
        { id: "kedarkantha", title: "Kedarkantha Trek" },
        { id: "brahmatal", title: "Brahmatal Trek" },
        { id: "harkidun", title: "Har Ki Dun" }
      ]
    }
  ], "🌄 Select a Trek");
}

export default router;
