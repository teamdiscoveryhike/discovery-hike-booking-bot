
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
} from "../services/sessionManager.js";

import {
  sendText,
  sendButtons,
  sendList
} from "../services/whatsapp.js";

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
    const lowerInput = input.toLowerCase();

    if (!isSessionActive(from)) {
      if (["hi", "hello", "menu"].includes(lowerInput)) {
        await sendButtons(from, "👋 Welcome to *Discovery Hike Admin Panel*.", [
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
        const editFields = Object.keys(data).map(key => ({
          id: `edit__${key}`,
          title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        }));
        await sendList(from, "Which field to edit?", [{ title: "Fields", rows: editFields }]);
      } catch (e) {
        await sendText(from, "⚠️ No active session. Please start a new booking.");
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
      await sendText(from, "✅ Booking confirmed and saved successfully. Client will receive confirmation message and Email shortly on WhatsApp and Email respectively.");
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
      await sendText(from, "❗ Please enter a valid phone number with country code (e.g. +919458118063)");
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

    if (step === "trekDate") {
      if (input === "today") {
        const today = new Date().toISOString().split("T")[0];
        saveResponse(from, today, !isEditing);
        if (isEditing) {
          clearEditingFlag(from);
          const data = getSessionData(from);
          await sendSummaryAndConfirm(from, data);
        } else {
          await askNextQuestion(from, getCurrentStep(from));
        }
        return res.sendStatus(200);
      } else if (input === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formatted = tomorrow.toISOString().split("T")[0];
        saveResponse(from, formatted, !isEditing);
        if (isEditing) {
          clearEditingFlag(from);
          const data = getSessionData(from);
          await sendSummaryAndConfirm(from, data);
        } else {
          await askNextQuestion(from, getCurrentStep(from));
        }
        return res.sendStatus(200);
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        await sendText(from, "📅 Please enter the date in YYYY-MM-DD format.");
        return res.sendStatus(200);
      }
    }

    saveResponse(from, input, !isEditing);

    if (step === "paymentMode" && input.toLowerCase() === "onspot") {
      const session = getSessionObject(from);
      session.data.advancePaid = 0;
      if (!isEditing) session.stepIndex++;
    }

    if (isEditing) {
      const data = getSessionData(from);

      if (step === "paymentMode" && input.toLowerCase() === "online") {
        const session = getSessionObject(from);
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
  if (step === "clientName") return sendText(userId, "👤 Enter Client's Full Name:");
  if (step === "clientPhone") return sendText(userId, "📞 Enter Client's WhatsApp number (10 digits):");
  if (step === "clientEmail") return sendText(userId, "📧 Enter Client's Email ID:");
  if (step === "trekName") return sendTrekList(userId);
  if (step === "trekDate") return sendButtons(userId, "📅 Choose a date:", [
    { type: "reply", reply: { id: "today", title: "Today" } },
    { type: "reply", reply: { id: "tomorrow", title: "Tomorrow" } },
    { type: "reply", reply: { id: "manual", title: "Enter Manually" } }
  ]);
  if (step === "sharingType") return sendButtons(userId, "Select Sharing type:", [
    { type: "reply", reply: { id: "Single", title: "Single" } },
    { type: "reply", reply: { id: "Double", title: "Double" } },
    { type: "reply", reply: { id: "Triple", title: "Triple" } }
  ]);
  if (step === "paymentMode") return sendButtons(userId, "💳 Payment mode?", [
    { type: "reply", reply: { id: "Online", title: "Online" } },
    { type: "reply", reply: { id: "onspot", title: "On-spot" } }
  ]);
  return sendText(userId, `Please enter ${step.replace(/([A-Z])/g, " $1").toLowerCase()}:`);
}

async function sendTrekList(userId) {
  return sendList(userId, "Choose Trek/Expedition:", [
    {
      title: "Popular Treks",
      rows: [
        { id: "Kedarkantha", title: "Kedarkantha Trek" },
        { id: "Brahmatal", title: "Brahmatal Trek" },
        { id: "BaliPass", title: "Bali Pass Trek" },
        { id: "BlackPeak", title: "Black Peak Expedition" },
        { id: "BorasuPass", title: "Borasu Pass Trek" },
        { id: "DumdarkandiPass", title: "Dumdarkandi Pass Trek" },
        { id: "HarKiDun", title: "Har Ki Dun Trek" }
      ]
    }
  ], "🌄 Select a Trek/Expedition");
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
• *Stay Type:* ${data.sharingType}
• *Payment Mode:* ${data.paymentMode}
• *Notes:* ${data.specialNotes || '-'}`;

  await sendText(from, summary);
  await sendButtons(from, "✅ Confirm booking?", [
    { type: "reply", reply: { id: "confirm_yes", title: "Yes" } },
    { type: "reply", reply: { id: "confirm_no", title: "No" } },
    { type: "reply", reply: { id: "edit_booking", title: "✏️ Edit Something" } }
  ]);
}

export default router;
