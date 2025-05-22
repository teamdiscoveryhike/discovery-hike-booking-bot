import askNextQuestion from "./flows/askNextQuestion.js";
import sendSummaryAndConfirm from "./flows/sendSummary.js";
import handleDateInput from "./flows/handleDateInput.js";
import steps from "../utils/steps.js";
import {
  getSessionObject,
  saveResponse,
  clearSession,
  getSessionData,
  setEditingField,
  getEditingField,
  isEditingSession,
  clearEditingFlag,
  isAwaitingField,
  setAwaitingField
} from "../services/sessionManager.js";
import { sendText } from "../services/whatsapp.js";

const ALLOWED_TEAM_NUMBERS = process.env.ALLOWED_TEAM_NUMBERS?.split(",") || [];

export default async function handleMessage(req, res) {
  const from = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  const input = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body?.trim();

  if (!from || !input) return res.sendStatus(200);

  if (!ALLOWED_TEAM_NUMBERS.includes(from)) {
    await sendText(from, "🚫 You're not authorized to use this bot.");
    return res.sendStatus(200);
  }

  const session = getSessionObject(from);
  const step = steps[session.stepIndex];
  const isEditing = isEditingSession(from);
  const editingField = getEditingField(from);

  if (input.toLowerCase() === "reset") {
    clearSession(from);
    await sendText(from, "🔄 Session reset.");
    return res.sendStatus(200);
  }

  if (isAwaitingField(from)) {
    const field = steps.find(f => f.toLowerCase() === input.toLowerCase());
    if (field) {
      setAwaitingField(from, false);
      setEditingField(from, field);
      await askNextQuestion(from, field);
    } else {
      await sendText(from, "❌ Invalid field name.\nTry one of: " + steps.join(", "));
    }
    return res.sendStatus(200);
  }

  if (input.toLowerCase().includes("edit")) {
    setAwaitingField(from, true);
    await sendText(from, "✏️ Which field would you like to edit?\n" + steps.join(", "));
    return res.sendStatus(200);
  }

  if (input.toLowerCase().includes("confirm")) {
    await sendText(from, "✅ Booking confirmed.");
    clearSession(from);
    return res.sendStatus(200);
  }

  if (input.toLowerCase().includes("cancel")) {
    await sendText(from, "❌ Booking cancelled.");
    clearSession(from);
    return res.sendStatus(200);
  }

  if (isEditing && editingField) {
    if (editingField === "paymentMode" && input.toLowerCase() === "online") {
      saveResponse(from, "online");
      session.stepIndex = steps.indexOf("advancePaid");
      session.editing = true;
      await askNextQuestion(from, "advancePaid");
      return res.sendStatus(200);
    }

    if (editingField === "advancePaid") {
      const value = parseInt(input);
      saveResponse(from, value);
      clearEditingFlag(from);
      const data = getSessionData(from);
      await sendSummaryAndConfirm(from, data);
      return res.sendStatus(200);
    }

    const value = ["groupSize", "ratePerPerson"].includes(editingField) ? parseInt(input) : input;
    saveResponse(from, value);
    clearEditingFlag(from);
    const data = getSessionData(from);
    await sendSummaryAndConfirm(from, data);
    return res.sendStatus(200);
  }

  if (step === "trekDate") {
    const handled = await handleDateInput(from, input, false);
    if (handled) return res.sendStatus(200);
  }

  if (step === "paymentMode" && input.toLowerCase() === "onspot") {
    saveResponse(from, "onspot");
    saveResponse(from, 0);
    session.stepIndex += 2;
    await askNextQuestion(from, steps[session.stepIndex]);
    return res.sendStatus(200);
  }

  const value = ["groupSize", "ratePerPerson", "advancePaid"].includes(step)
    ? parseInt(input)
    : input;
  saveResponse(from, value);
  session.stepIndex += 1;

  if (session.stepIndex >= steps.length) {
    const data = getSessionData(from);
    await sendSummaryAndConfirm(from, data);
  } else {
    await askNextQuestion(from, steps[session.stepIndex]);
  }

  return res.sendStatus(200);
}
