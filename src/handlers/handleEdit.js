
import { clearEditingFlag, getSessionObject, getSessionData } from "../services/sessionManager.js";
import askNextQuestion from "./askNextQuestion.js";
import sendSummaryAndConfirm from "./sendSummary.js";

export default async function handleEditFlow(from, step, input) {
  if (step === "paymentMode" && input.toLowerCase() === "online") {
    const session = getSessionObject(from);
    session.stepIndex = 5; // advancePaid index in your steps
    session.editing = true;
    await askNextQuestion(from, "advancePaid");
    return "waiting";
  }

  if (step === "advancePaid") {
    clearEditingFlag(from);
    const data = getSessionData(from);
    await sendSummaryAndConfirm(from, data);
    return "done";
  }

  clearEditingFlag(from);
  const data = getSessionData(from);
  await sendSummaryAndConfirm(from, data);
  return "done";
}

