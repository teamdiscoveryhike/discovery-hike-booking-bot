
import { saveResponse, clearEditingFlag, getSessionData } from "../services/sessionManager.js";
import { sendText } from "../services/whatsapp.js";
import askNextQuestion from "./askNextQuestion.js";
import sendSummaryAndConfirm from "./sendSummary.js";

export default async function handleDateInput(from, input, isEditing) {
  let dateToSave = null;

  if (input === "today") {
    const today = new Date().toISOString().split("T")[0];
    dateToSave = today;
  } else if (input === "tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateToSave = tomorrow.toISOString().split("T")[0];
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    dateToSave = input;
  } else {
    await sendText(from, "📅 Please enter the date in YYYY-MM-DD format.");
    return true;
  }

  saveResponse(from, dateToSave, !isEditing);

  if (isEditing) {
    clearEditingFlag(from);
    const data = getSessionData(from);
    await sendSummaryAndConfirm(from, data);
  } else {
    await askNextQuestion(from, "groupSize");
  }

  return true;
}

