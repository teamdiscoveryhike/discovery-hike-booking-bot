
import express from "express";
import {
  startSession,
  isSessionActive,
  getCurrentStep,
  saveResponse,
  isSessionComplete,
  getSessionData,
  endSession,
  setEditStep,
  isEditingSession,
  clearEditingFlag,
  getSessionObject,
  getStepIndex,
} from "../services/sessionManager.js";

import {
  sendText,
  sendButtons,
  sendList
} from "../services/whatsapp.js";
const TREK_LIST = {
  Trek: [
    { id: "Kedarkantha", title: "Kedarkantha Trek" },
    { id: "Brahmatal", title: "Brahmatal Trek" },
    { id: "BaliPass", title: "Bali Pass Trek" },
    { id: "BorasuPass", title: "Borasu Pass Trek" },
    { id: "HarKiDun", title: "Har Ki Dun Trek" }
  ],
  Expedition: [
    { id: "BlackPeak", title: "Black Peak Expedition" },
    { id: "DumdarkandiPass", title: "Dumdarkandi Pass Trek" }
  ]
};


const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body;
    const buttonReply = message?.interactive?.button_reply?.id;
    const listReply = message?.interactive?.list_reply?.id;

    if (!text && !buttonReply && !listReply) return res.sendStatus(200);

    const allowedNumbers = process.env.ALLOWED_TEAM_NUMBERS?.split(",") || [];
    if (!allowedNumbers.includes(from)) {
      await sendText(from, "⛔ You are not authorized to use this booking bot.");
      return res.sendStatus(200);
    }

    const input = buttonReply || listReply || text;
    if (!input || input.trim() === "") {
      await sendText(from, "⚠️ Please enter a valid response.");
      return res.sendStatus(200);
    }

    const session = getSessionObject(from);
    if (session.lastInput === input) {
      return res.sendStatus(200);
    }
    session.lastInput = input;

    if (input === "category_trek" || input === "category_expedition") {
      if (!isSessionActive(from)) {
        await sendText(from, "⚠️ Session expired. Please type *Menu* to start a new booking.");
        return res.sendStatus(200);
      }

      const category = input === "category_trek" ? "Trek" : "Expedition";
      const isEditing = isEditingSession(from);

      saveResponse(from, category, !isEditing);

      if (isEditing) {
        session.data.trekName = null;
        session.stepIndex = getStepIndex("trekName");
        return await askNextQuestion(from, "trekName");
      }

      return await askNextQuestion(from, getCurrentStep(from));
    }

    const lowerInput = input.toLowerCase();

    if (!isSessionActive(from)) {
      if (["hi", "hello", "menu"].includes(lowerInput)) {
        await sendButtons(from, "🙏 Welcome to *Discovery Hike Admin Panel*.", [
          { type: "reply", reply: { id: "start_booking", title: "📌 New Booking" } }
        ]);
        return res.sendStatus(200);
      }
      if (input === "start_booking") {
        startSession(from);
        await askNextQuestion(from, "clientName");
        return res.sendStatus(200);
      }
    }

    if (input === "edit_booking") {
      try {
        const data = getSessionData(from);
        const keys = Object.keys(data);

        const firstBatch = keys.slice(0, 9).map(key => ({
          id: `edit__${key}`,
          title: key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())
        }));

        firstBatch.push({
          id: "edit_more",
          title: "➡️ More Options"
        });

        await sendList(from, "Which field to edit?", [
          { title: "Editable Fields", rows: firstBatch }
        ]);
      } catch (e) {
        await sendText(from, "⚠️ No active session. Please start a new booking.");
      }
      return res.sendStatus(200);
    }

    if (input === "edit_more") {
      try {
        const data = getSessionData(from);
        const keys = Object.keys(data);

        const secondBatch = keys.slice(9).map(key => ({
          id: `edit__${key}`,
          title: key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())
        }));

        await sendList(from, "More fields to edit:", [
          { title: "More Fields", rows: secondBatch }
        ]);
      } catch (e) {
        await sendText(from, "⚠️ Unable to show more fields.");
      }
      return res.sendStatus(200);
    }

    if (input.startsWith("edit__")) {
      const field = input.replace("edit__", "");
      setEditStep(from, field);
      await askNextQuestion(from, field);
      return res.sendStatus(200);
    }

    if (input === "confirm_yes") {
      endSession(from);
      await sendText(from, "✅ Booking confirmed. Client will receive WhatsApp and Email Confirmation shortly.");
      return res.sendStatus(200);
    }

    if (input === "confirm_no") {
      endSession(from);
      await sendText(from, "❌ Booking canceled. Type *Menu* to restart.");
      return res.sendStatus(200);
    }

    let step;
    try {
      step = getCurrentStep(from);
    } catch (e) {
      await sendText(from, "⚠️ Session expired. Please type *Menu* to start over.");
      return res.sendStatus(200);
    }

    const isEditing = isEditingSession(from);

    // 🔒 Validation
    if (step === "clientPhone" && !/^\+\d{8,15}$/.test(input)) {
      await sendText(from, "❗ Please enter a valid phone number with country code. Format: +919458118063");
      return res.sendStatus(200);
    }
    if (step === "clientEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
      await sendText(from, "❗ Please enter a valid email address.");
      return res.sendStatus(200);
    }
    if (step === "clientName" && !/^[a-zA-Z\s]{2,}$/.test(input)) {
      await sendText(from, "❗ Please enter a valid name (letters only).");
      return res.sendStatus(200);
    }
    if (step === "groupSize" && isNaN(parseInt(input))) {
      await sendText(from, "❗ Please enter a numeric group size.");
      return res.sendStatus(200);
    }
    if (step === "ratePerPerson" && isNaN(parseInt(input))) {
      await sendText(from, "❗ Please enter a numeric rate.");
      return res.sendStatus(200);
    }
    if (step === "advancePaid" && isNaN(parseInt(input))) {
      await sendText(from, "❗ Please enter a valid number for advance paid.");
      return res.sendStatus(200);
    }

    saveResponse(from, input, !isEditing);

    if (step === "paymentMode" && input.toLowerCase() === "onspot") {
      session.data.advancePaid = 0;
      if (!isEditing) session.stepIndex++;
    }

    if (isEditing) {
      const data = getSessionData(from);

      if (step === "paymentMode" && input.toLowerCase() === "online") {
        const steps = [
          "clientName", "clientPhone", "clientEmail",
          "trekName", "trekDate", "groupSize", "ratePerPerson",
          "paymentMode", "advancePaid", "sharingType", "specialNotes"
        ];
        const advanceIndex = steps.indexOf("advancePaid");
        session.stepIndex = advanceIndex;
        session.editing = true;
        await askNextQuestion(from, "advancePaid");
        return res.sendStatus(200);
      }

      if (step === "advancePaid") {
        clearEditingFlag(from);
        await sendSummaryAndConfirm(from, data);
        return res.sendStatus(200);
      }

      clearEditingFlag(from);
      await sendSummaryAndConfirm(from, data);
      return res.sendStatus(200);
    }

    if (isSessionComplete(from)) {
      const data = getSessionData(from);
      clearEditingFlag(from);
      await sendSummaryAndConfirm(from, data);
      return res.sendStatus(200);
    }

    await askNextQuestion(from, getCurrentStep(from));
    res.sendStatus(200);
  } catch (error) {
    console.error("❌ webhook error:", error.message);
    await sendText(req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from, "❌ Internal error. Please try again.");
    res.sendStatus(500);
  }
});




async function askNextQuestion(userId, step) {
  if (!step) {
  await sendText(userId, "⚠️ Step is missing or session is invalid. Please type *Menu* to restart.");
  return;
}
  if (step === "clientName") return sendText(userId, "👤 Enter Client's Full Name:");
  if (step === "clientPhone") return sendText(userId, "📞 Enter Client's WhatsApp number with country code (e.g +919458118063):");
  if (step === "clientEmail") return sendText(userId, "📧 Enter Client's Email ID:");
  if (step === "trekCategory") {
  return sendButtons(userId, "🧭 Choose Trek/Expedition:", [
    { type: "reply", reply: { id: "category_trek", title: "🥾 Trek" } },
    { type: "reply", reply: { id: "category_expedition", title: "🏔️ Expedition" } }]);}

  if (step === "trekName") {
  const session = getSessionObject(userId);
  const category = session.data.trekCategory || "Trek";
  return sendTrekList(userId, 1, category);
}

  if (step === "trekDate") return sendButtons(userId, "📅 Choose a date:", [
    { type: "reply", reply: { id: "today", title: "Today" } },
    { type: "reply", reply: { id: "tomorrow", title: "Tomorrow" } },
    { type: "reply", reply: { id: "manual", title: "Enter" } }
  ]);
  if (step === "sharingType") return sendButtons(userId, "Select Sharing type:", [
    { type: "reply", reply: { id: "Single", title: "Single" } },
    { type: "reply", reply: { id: "Double", title: "Double" } },
    { type: "reply", reply: { id: "Triple", title: "Triple" } }
  ]);
  if (step === "paymentMode") return sendButtons(userId, "💳 Payment mode?", [
    { type: "reply", reply: { id: "Online", title: "Online" } },
    { type: "reply", reply: { id: "Onspot", title: "On-spot" } }
  ]);

return sendText(userId, `✏️ Enter ${step.replace(/([A-Z])/g, " $1").toLowerCase()}`);
}

async function sendTrekList(userId, page = 1, category = "Trek") {
  const list = TREK_LIST[category] || [];
  const rows = list.map(trek => ({
    id: trek.id,
    title: trek.title
  }));

  await sendList(userId, `Choose a ${category}:`, [
    { title: `${category} Options`, rows }
  ]);
}


async function sendSummaryAndConfirm(from, data) {
  const groupSize = parseInt(data.groupSize || 0);
  const ratePerPerson = parseInt(data.ratePerPerson || 0);
  const advancePaid = parseInt(data.advancePaid || 0);
  const total = groupSize * ratePerPerson;
  const balance = total - advancePaid;

  const summary = `🧾 *Booking Summary:*
• *Client Name:* ${data.clientName}
• *Client WhatsApp:* ${data.clientPhone}
• *Client Email:* ${data.clientEmail}
• *Trek:* ${data.trekName}
• *Date:* ${data.trekDate}
• *Group Size:* ${groupSize}
• *Rate/Person:* ₹${ratePerPerson}
• *Total:* ₹${total}
• *Advance Paid:* ₹${advancePaid}
• *Balance:* ₹${balance}
• *Sharing:* ${data.sharingType}
• *Payment Mode:* ${data.paymentMode}
• *Notes:* ${data.specialNotes || '-'}`;

  await sendText(from, summary);
  await sendButtons(from, "👍 Confirm booking?", [
    { type: "reply", reply: { id: "confirm_yes", title: "✅ Yes" } },
    { type: "reply", reply: { id: "confirm_no", title: "❌ No" } },
    { type: "reply", reply: { id: "edit_booking", title: "✏️ Edit" } }
  ]);
}

export default router;