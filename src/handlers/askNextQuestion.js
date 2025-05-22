
import { sendButtons, sendText } from "../services/whatsapp.js";
import sendTrekList from "../utils/sendTrekList.js";

export default async function askNextQuestion(userId, step) {
  if (step === "trekName") return sendTrekList(userId);

  if (step === "trekDate") {
    return sendButtons(userId, "📅 Choose a date:", [
      { type: "reply", reply: { id: "today", title: "Today" } },
      { type: "reply", reply: { id: "tomorrow", title: "Tomorrow" } },
      { type: "reply", reply: { id: "manual", title: "Enter Manually" } }
    ]);
  }

  if (step === "sharingType") {
    return sendButtons(userId, "Select Sharing type:", [
      { type: "reply", reply: { id: "Single", title: "Single" } },
      { type: "reply", reply: { id: "Double", title: "Double" } },
      { type: "reply", reply: { id: "Triple", title: "Triple" } }
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
