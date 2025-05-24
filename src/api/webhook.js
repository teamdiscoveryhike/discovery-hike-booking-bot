// Refactored webhook.js matching the exact flow described

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
  resetLastInput,
  recalculateTotals,
  setAwaitingConfirmation
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

    const input = buttonReply || listReply || text;
    if (!input) return res.sendStatus(200);

    const allowedNumbers = process.env.ALLOWED_TEAM_NUMBERS?.split(",") || [];
    if (!allowedNumbers.includes(from)) {
      await sendText(from, "⛔ You are not authorized to use this booking bot.");
      return res.sendStatus(200);
    }

    const session = isSessionActive(from) ? getSessionObject(from) : startSession(from);
    if (session.lastInput === input) return res.sendStatus(200);
    session.lastInput = input;

    // Confirmation phase strictly locked
    if (session.awaitingConfirmation) {
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
      if (input === "edit_booking") {
        return await sendEditMenu(from);
      }
    }

    // Edit handler
    if (input.startsWith("edit__")) {
      const field = input.replace("edit__", "");
      setEditStep(from, field);
      return await askNextQuestion(from, field);
    }

    const step = getCurrentStep(from);
    const isEditing = isEditingSession(from);

    switch (step) {
      case "clientName":
        if (!/^[a-zA-Z\s]{2,}$/.test(input)) return await invalidInput(from, "valid name (letters only)", res);
        break;
      case "clientPhone":
        if (!/^\+?[\d\s]{8,20}$/.test(input)) return await invalidInput(from, "valid phone (e.g. +91 94581 18063)", res);
        break;
      case "clientEmail":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return await invalidInput(from, "valid email address", res);
        break;
      case "groupSize":
      case "ratePerPerson":
      case "advancePaid":
        if (isNaN(parseInt(input))) return await invalidInput(from, "numeric value", res);
        break;
      case "trekDate":
        if (input === "manual") return await sendText(from, "✏️ Enter date (YYYY-MM-DD):");
        if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
          const [yyyy, mm, dd] = input.split("-").map(Number);
          const today = new Date();
          if (yyyy < today.getFullYear() || mm > 12 || dd > 31) return await invalidInput(from, "valid date (YYYY-MM-DD)", res);
        }
        break;
      case "paymentMode":
        if (input.toLowerCase() === "onspot") session.data.advancePaid = 0;
        break;
    }

    // Save response
    if (isEditing) {
      session.data[step] = input;
      clearEditingFlag(from);
      recalculateTotals(from);
      setAwaitingConfirmation(from);
      await sendSummaryAndConfirm(from, session.data);
      return res.sendStatus(200);
    } else {
      saveResponse(from, input);
    }

    if (isSessionComplete(from)) {
      setAwaitingConfirmation(from);
      recalculateTotals(from);
      await sendSummaryAndConfirm(from, session.data);
    } else {
      await askNextQuestion(from, getCurrentStep(from));
    }

    resetLastInput(from);
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ webhook error:", err);
    await sendText(req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from, "❌ Internal error. Please try again.");
    return res.sendStatus(500);
  }
});

async function invalidInput(userId, hint, res) {
  await sendText(userId, `❗ Please enter a ${hint}.`);
  return res.sendStatus(200);
}

async function sendEditMenu(userId) {
  const data = getSessionData(userId);
  const keys = Object.keys(data);
  const fields = keys.map(key => ({
    id: `edit__${key}`,
    title: key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())
  }));
  await sendList(userId, "Which field to edit?", [{ title: "Editable Fields", rows: fields }]);
}

async function sendSummaryAndConfirm(userId, data) {
  const summary = `🧾 *Booking Summary:*\n• *Client Name:* ${data.clientName}\n• *Client WhatsApp:* ${data.clientPhone}\n• *Client Email:* ${data.clientEmail}\n• *Trek:* ${data.trekName}\n• *Date:* ${data.trekDate}\n• *Group Size:* ${data.groupSize}\n• *Rate/Person:* ₹${data.ratePerPerson}\n• *Total:* ₹${data.total}\n• *Advance Paid:* ₹${data.advancePaid}\n• *Balance:* ₹${data.balance}\n• *Sharing:* ${data.sharingType}\n• *Payment Mode:* ${data.paymentMode}\n• *Notes:* ${data.specialNotes || '-'}`;

  await sendText(userId, summary);
  await sendButtons(userId, "👍 Confirm booking?", [
    { type: "reply", reply: { id: "confirm_yes", title: "✅ Yes" } },
    { type: "reply", reply: { id: "confirm_no", title: "❌ No" } },
    { type: "reply", reply: { id: "edit_booking", title: "✏️ Edit" } }
  ]);
}

async function askNextQuestion(userId, step) {
  if (step === "clientName") return sendText(userId, "👤 Enter Client's Full Name:");
  if (step === "clientPhone") return sendText(userId, "📞 Enter Client's WhatsApp number (e.g. +91 94581 18063):");
  if (step === "clientEmail") return sendText(userId, "📧 Enter Client's Email ID:");
  if (step === "trekCategory") return sendButtons(userId, "🧭 Choose Trek/Expedition:", [
    { type: "reply", reply: { id: "category_trek", title: "🥾 Trek" } },
    { type: "reply", reply: { id: "category_expedition", title: "🏔️ Expedition" } }
  ]);
  if (step === "trekName") return sendText(userId, "🏔️ Enter Trek Name:");
  if (step === "trekDate") return sendButtons(userId, "📅 Choose a date:", [
    { type: "reply", reply: { id: "today", title: "Today" } },
    { type: "reply", reply: { id: "tomorrow", title: "Tomorrow" } },
    { type: "reply", reply: { id: "manual", title: "Enter" } }
  ]);
  if (step === "groupSize") return sendText(userId, "👥 Enter Group Size:");
  if (step === "ratePerPerson") return sendText(userId, "💰 Enter Rate per Person:");
  if (step === "paymentMode") return sendButtons(userId, "💳 Payment mode?", [
    { type: "reply", reply: { id: "online", title: "Online" } },
    { type: "reply", reply: { id: "onspot", title: "On-spot" } }
  ]);
  if (step === "advancePaid") return sendText(userId, "💸 Enter Advance Paid:");
  if (step === "sharingType") return sendButtons(userId, "🏕️ Select Sharing Type:", [
    { type: "reply", reply: { id: "single", title: "Single" } },
    { type: "reply", reply: { id: "double", title: "Double" } },
    { type: "reply", reply: { id: "triple", title: "Triple" } }
  ]);
  if (step === "specialNotes") return sendText(userId, "📝 Any Special Notes? (optional):");
  return sendText(userId, `✏️ Enter ${step.replace(/([A-Z])/g, " $1").toLowerCase()}`);
}

export default router;
