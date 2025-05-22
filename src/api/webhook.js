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
  const lowerInput = input.toLowerCase();

  // ✅ Admin menu and session logic
  if (!isSessionActive(from)) {
    const greetingInputs = ["Hi", "Hello", "Hey", "Menu"];
    if (greetingInputs.includes(lowerInput)) {
      await sendButtons(from, "👋 Welcome to *Discovery Hike Admin Panel*.\nChoose a service:", [
        { type: "reply", reply: { id: "start_booking", title: "📌 New Booking" } },
        { type: "reply", reply: { id: "view_upcoming", title: "📅 Upcoming Treks" } },
        { type: "reply", reply: { id: "assign_vehicle", title: "🚐 Assign Vehicle" } }
      ]);
      return res.sendStatus(200);
    }

    if (lowerInput.includes("book") || input === "start_booking") {
      startSession(from);
      await sendTrekList(from);
    } else {
      await sendButtons(from, "📋 Admin Menu:", [
        { type: "reply", reply: { id: "start_booking", title: "📌 New Booking" } },
        { type: "reply", reply: { id: "view_upcoming", title: "📅 Upcoming Treks" } },
        { type: "reply", reply: { id: "assign_vehicle", title: "🚐 Assign Vehicle" } }
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
• *Group Size:* ${groupSize}
• *Rate/Person:* ₹${ratePerPerson}
• *Total Amount:* ₹${total}
• *Advance Paid:* ₹${advancePaid}
• *Balance:* ₹${balance}
• *Stay Type:* ${data.sharingType}
• *Payment Mode:* ${data.paymentMode}
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
      { type: "reply", reply: { id: "Single", title: "Single" } },
      { type: "reply", reply: { id: "Double", title: "Double" } },
      { type: "reply", reply: { id: "Triple", title: "Triple" } },
      { type: "reply", reply: { id: "Quad", title: "Quad" } }
    ]);
  }
  if (step === "paymentMode") {
    return sendButtons(userId, "💳 Payment mode?", [
      { type: "reply", reply: { id: "Online", title: "Online" } },
      { type: "reply", reply: { id: "onspot", title: "On-spot" } }
    ]);
  }

  return sendText(userId, `Please enter ${step.replace(/([A-Z])/g, " $1").toLowerCase()}:`);
}

// ✅ 4. Trek selection list
async function sendTrekList(userId) {
  return sendList(userId, "Choose Trek/Expedition:", [
    {
      title: "Popular Treks",
      rows: [
        { id: "Kedarkantha", title: "Kedarkantha Trek" },
         { id: "Brahmatal", title: "Brahmatal Trek" },
         { id: "BaliPass ", title: "Bali Pass Trek" },
         { id: "BlackPeak", title: "Black Peak Expedition" },
         { id: "BorasuPass", title: "Borasu Pass Trek" },
        { id: "DumdarkandiPass", title: "Dumdarkandi Pass Trek" },
        { id: "HarKiDun", title: "Har Ki Dun Trek" }
      ]
    }
  ], "🌄 Select a Trek/Expedition");
}

export default router;
