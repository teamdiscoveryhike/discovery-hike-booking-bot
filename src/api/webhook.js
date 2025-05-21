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

router.post("/", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = message?.from;
  const text = message?.text?.body;
  const buttonReply = message?.interactive?.button_reply?.id;
  const listReply = message?.interactive?.list_reply?.id;

  if (!text && !buttonReply && !listReply) return res.sendStatus(200);

  if (text?.toLowerCase() === "book trek") {
    startSession(from);
    return await sendTrekList(from), res.sendStatus(200);
  }

  if (!isSessionActive(from)) return res.sendStatus(200);

  const step = getCurrentStep(from);
  const input = buttonReply || listReply || text;

  saveResponse(from, input);

  if (isSessionComplete(from)) {
    const data = getSessionData(from);
    endSession(from);

    const summary = `🧾 *Booking Summary:*\n${Object.entries(data)
      .map(([k, v]) => `• *${k}*: ${v}`)
      .join("\n")}`;

    await sendText(from, summary);
    return await sendButtons(from, "✅ Confirm booking?", [
      { type: "reply", reply: { id: "confirm_yes", title: "Yes" } },
      { type: "reply", reply: { id: "confirm_no", title: "No" } }
    ]);
  }

  const nextStep = getCurrentStep(from);
  await askNextQuestion(from, nextStep);
  res.sendStatus(200);
});

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
