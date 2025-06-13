// src/handlers/bookingMainFlow.js

import { sendText } from "../services/whatsapp.js";
import { bookingFields } from "../services/bookingFields.js";
import { fetchMatchingVoucher } from "../services/bookingVoucherContext.js";
import { startSession, getSessionObject, endSession } from "../services/sessionManager.js";
import { insertBookingWithCode, getAdjustedPayment } from "../utils/bookingUtils.js";
import supabase from "../services/supabase.js";
import { sendBookingConfirmationEmail } from "../services/email.js";

export async function handleMainBookingFlow(input, from) {
  let session;
  try {
    session = getSessionObject(from);
  } catch {
    startSession(from);
    return await askNextQuestion(from);
  }

  const currentStep = bookingFields[session.stepIndex];
  if (!currentStep) return;

  const cleanedInput = input?.trim();
  const key = currentStep.key;
  session.data[key] = cleanedInput;

  const validationError = await validateField(key, cleanedInput, from);
  if (validationError) return;

  session.stepIndex++;

  if (key === "advancePaid") {
    await tryApplyVoucher(session);
  }

  if (session.stepIndex >= bookingFields.length) {
    await sendSummaryAndConfirm(from);
    return;
  }

  await askNextQuestion(from);
}

export async function askNextQuestion(from, forceKey = null) {
  const session = getSessionObject(from);
  const step = forceKey
    ? bookingFields.find(f => f.key === forceKey)
    : bookingFields[session.stepIndex];

  if (!step) return;

  if (step.key === "trekCategory") {
    return await sendText(from, "🏔 Select *Trek Category*:\n• Trek\n• Expedition");
  }

  if (step.key === "trekDate") {
    return await sendText(from, "📅 Enter trek date (DD/MM/YYYY) or type *today* / *tomorrow*");
  }

  if (step.key === "sharingType") {
    return await sendText(from, "🏕️ Select Sharing: Single, Double, Triple");
  }

  if (step.key === "paymentMode") {
    const voucher = session.voucher;
    const total = session.data.total || 0;
    if (voucher?.amount >= total) {
      session.data.paymentMode = "Voucher";
      return await askNextQuestion(from);
    }
    return await sendText(from, "💳 Select Payment Mode:\n• Online\n• Onspot");
  }

  await sendText(from, step.ask);
}

async function tryApplyVoucher(session) {
  const { clientPhone, clientEmail, groupSize, ratePerPerson } = session.data;
  if (!clientPhone || !groupSize || !ratePerPerson) return;

  const total = parseInt(groupSize) * parseInt(ratePerPerson);
  session.data.total = total;

  const voucher = await fetchMatchingVoucher(clientPhone, clientEmail);
  if (voucher && voucher.amount > 0 && !voucher.used) {
    const existingAdvance = parseInt(session.data.advancePaid || 0);
    const adjustedAdvance = Math.min(total, existingAdvance + voucher.amount);

    session.voucher = voucher;
    session.data.advancePaid = adjustedAdvance;
    session.data.voucherUsed = voucher.code;
  }
}

async function validateField(key, input, from) {
  const session = getSessionObject(from);
  const phoneRegex = /^\+\d{10,15}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  switch (key) {
    case "clientName":
      if (!input) return sendText(from, "❗ Name cannot be empty.");
      break;

    case "clientPhone":
      if (!phoneRegex.test(input)) return sendText(from, "❗ Enter a valid phone number (e.g. +91XXXXXX)");
      break;

    case "clientEmail":
      if (input && !emailRegex.test(input)) return sendText(from, "❗ Invalid email format.");
      break;

    case "groupSize":
    case "ratePerPerson":
    case "advancePaid":
      if (!/^\d+$/.test(input)) return sendText(from, `❗ Enter a valid number for ${key}.`);

      if (key === "advancePaid") {
        const group = parseInt(session.data.groupSize || 0);
        const rate = parseInt(session.data.ratePerPerson || 0);
        const total = group * rate;
        const voucherAmt = session.voucher?.amount || 0;
        const advance = parseInt(input || 0);
        if (advance + voucherAmt > total) {
          return sendText(from, `⚠️ Advance + Voucher exceeds total (₹${total}).`);
        }
      }
      break;
  }

  return null;
}

async function sendSummaryAndConfirm(from) {
  const session = getSessionObject(from);
  const d = session.data;
  const voucher = session.voucher;

  const total = parseInt(d.groupSize || 0) * parseInt(d.ratePerPerson || 0);
  const advance = parseInt(d.advancePaid || 0);
  const voucherAmt = voucher?.amount || 0;

  const { adjustedAdvance, adjustedBalance, paymentMode } = getAdjustedPayment({
    total,
    advance,
    voucherAmount: voucherAmt
  });

  const summary = `
📘 *Booking Summary*

👤 *Name:* ${d.clientName}
📞 *Phone:* ${d.clientPhone}
📧 *Email:* ${d.clientEmail || "N/A"}
🥾 *Trek:* ${d.trekName} (${d.trekCategory})
📅 *Date:* ${d.trekDate}
👥 *Group Size:* ${d.groupSize} x ₹${d.ratePerPerson}
💰 *Total:* ₹${total}
💸 *Advance Paid:* ₹${adjustedAdvance}
🏕️ *Sharing:* ${d.sharingType}
💬 *Notes:* ${d.specialNotes || "-"}

${voucher?.code ? `🎟️ *Voucher Used:* ₹${voucherAmt} (${voucher.code})` : ""}
  `.trim();

  await sendText(from, summary);
  await sendButtons(from, "What next?", [
  { type: "reply", reply: { id: "yes", title: "✅ Confirm" } },
  { type: "reply", reply: { id: "no", title: "❌ Cancel" } },
  { type: "reply", reply: { id: "edit", title: "✏️ Edit" } }
]);

}

export async function confirmBooking(from) {
  const session = getSessionObject(from);
  const d = session.data;
  const voucher = session.voucher;

  const groupSize = parseInt(d.groupSize || 0);
  const rate = parseInt(d.ratePerPerson || 0);
  const total = groupSize * rate;
  const advance = parseInt(d.advancePaid || 0);
  const voucherAmount = voucher?.amount || 0;

  const { cappedAdvance, adjustedAdvance, adjustedBalance, paymentMode } = getAdjustedPayment({
    total,
    advance,
    voucherAmount
  });

  const bookingData = {
    client_name: d.clientName,
    client_phone: d.clientPhone,
    client_email: d.clientEmail,
    trek_category: d.trekCategory,
    trek_name: d.trekName,
    trek_date: d.trekDate,
    group_size: groupSize,
    rate_per_person: rate,
    total,
    advance_paid: cappedAdvance,
    balance: adjustedBalance,
    payment_mode: paymentMode,
    sharing_type: d.sharingType,
    special_notes: d.specialNotes || "-",
    voucher_used: voucher?.code || null,
    status: "confirmed"
  };

  try {
    const bookingCode = await insertBookingWithCode(bookingData);

    await sendText(from, `✅ Booking confirmed!\n🆔 Booking ID: ${bookingCode}`);
    await sendText(d.clientPhone, `🎉 Hi ${d.clientName}, your booking (${bookingCode}) for ${d.trekName} on ${d.trekDate} is confirmed!`);

    await sendBookingConfirmationEmail(d.clientEmail, bookingCode, {
      ...d,
      ratePerPerson: rate,
      advancePaid: cappedAdvance,
      balance: adjustedBalance,
      paymentMode,
      voucher: voucher?.code ? { code: voucher.code, amount: voucher.amount } : undefined,
      senderName: "Discovery Hike"
    });

    if (voucher?.code) {
      await supabase
        .from("vouchers")
        .update({
          used: true,
          used_at: new Date().toISOString(),
          used_by_booking: bookingCode
        })
        .eq("code", voucher.code);
    }

    endSession(from);
  } catch (err) {
    console.error("❌ Booking failed:", err.message);
    await sendText(from, "⚠️ Booking could not be saved. Please try again.");
  }
}
