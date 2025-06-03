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
  setEditPage,
  getEditPage
} from "../services/sessionManager.js";
import { cancelVoucherSession } from "../services/voucherSessionManager.js";

import {
  sendText,
  sendButtons,
  sendList,
  checkWhatsappNumber,
  sendBookingTemplate
} from "../services/whatsapp.js";
import supabase from "../services/supabase.js";
import { handleVoucherFlow } from "../handlers/voucherWebhookHandler.js";
import { 
  getBookingVoucher, 
  setBookingVoucher, 
  updateCoverageFlag, 
  isVoucherSkipped, 
  voucherCoversTotal,
  markVoucherAsSkipped, 
  clearBookingVoucher } from "../services/bookingVoucherContext.js";
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
      await sendText(from, "⛔ You are not authorized to use this System bot.");
      return res.sendStatus(200);
    }

    let input = buttonReply || listReply || text;
    const lowerInput = input.toLowerCase();

       // 🔐 Emergency Session Kill Trigger
if (["xxx", "kill"].includes(lowerInput)) {
  endSession?.(from);              // Kills booking session
  cancelVoucherSession?.(from);    // Kills voucher session
  clearBookingVoucher(from);
  await sendText(from, "🛑 Session forcefully reset. Type *menu* to start again.");
  return res.sendStatus(200);
}

// 🧠 Check if this input is part of the manual voucher flow
const handled = await handleVoucherFlow(input, from);
if (handled) return res.sendStatus(200);

    
 if (input.startsWith("voucher__")) {
  if (input === "voucher__none") {
    markVoucherAsSkipped(from);
    await sendText(from, "🚫 No voucher will be applied.");
  } else {
    const code = input.replace("voucher__", "").trim();
    const { data: voucher, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("code", code)
      .eq("used", false)
      .gte("expiry_date", new Date().toISOString().split("T")[0])
      .maybeSingle();

   if (voucher && !error) {
  const alreadyApplied = getBookingVoucher(from);
  if (alreadyApplied?.code === voucher.code) {
    await sendText(from, `🎟️ Voucher *${voucher.code}* is already applied.`);
    return res.sendStatus(200);
  }

  setBookingVoucher(from, {
    code: voucher.code,
    amount: voucher.amount,
    source:
      voucher.phone && voucher.email
        ? "shared"
        : voucher.phone === getSessionData(from).clientPhone
        ? "phone"
        : "email",
  }); // ✅ this closing parenthesis was missing
} else {
  await sendText(from, "⚠️ Could not apply the selected voucher. Please try again from the list.");
  return res.sendStatus(200);
}

  }
  // Proceed to next question
  if (isEditingSession(from)) {
    clearEditingFlag(from);
    const data = getSessionData(from);
    await sendSummaryAndConfirm(from, data);
  } else {
    await askNextQuestion(from, getCurrentStep(from));
  }

  return res.sendStatus(200);
}
 


    // 🔄 Handle pagination navigation for edit menu
    if (input === "edit_page_next") {
      const current = getEditPage(from);
      setEditPage(from, current + 1);
      await sendText(from, "➡️ Showing next fields...");
      input = "edit_booking";
    }

    if (input === "edit_page_prev") {
      const current = getEditPage(from);
      setEditPage(from, Math.max(current - 1, 0));
      await sendText(from, "⬅️ Going back to previous fields...");
      input = "edit_booking";
    }


    if (!isSessionActive(from)) {
      if (["hi", "hello", "menu"].includes(lowerInput)) {
        await sendButtons(from, " *Discovery Hike Booking Bot*", [
          { type: "reply", reply: { id: "start_booking", title: "✍️ New Booking" } },
          { type: "reply", reply: { id: "manual_voucher", title: "🎟️ Manual Voucher" } }
        ]);
        return res.sendStatus(200);
      }
      if (input === "start_booking") {
        startSession(from);
        await askNextQuestion(from, getCurrentStep(from));
        return res.sendStatus(200);
      }
    }

    // ✅ PAGINATED EDIT MENU
    if (input === "edit_booking") {
      try {
        const data = getSessionData(from);
        const allFields = Object.keys(data);
        const currentPage = getEditPage(from);
        const pageSize = 5;
        const start = currentPage * pageSize;
        const end = start + pageSize;
        const fieldsOnPage = allFields.slice(start, end);

        const rows = fieldsOnPage.map(key => {
          let title = key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());
          if (title.length > 24) title = title.slice(0, 21) + "...";
          return { id: `edit__${key}`, title };
        });

        if (end < allFields.length) rows.push({ id: "edit_page_next", title: "➡️ Next Page" });
        if (start > 0) rows.push({ id: "edit_page_prev", title: "⬅️ Previous Page" });

        await sendList(from, "Which field do you want to edit?", [{ title: "Fields", rows }]);
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
  const data = getSessionData(from);
  const groupSize = parseInt(data.groupSize || 0);
  const rate = parseInt(data.ratePerPerson || 0);
  const total = groupSize * rate;
  const voucher = getBookingVoucher(from);
updateCoverageFlag(from, total);

let advance = parseInt(data.advancePaid || 0);
let balance = total - advance;
let paymentMode = data.paymentMode;

// 🔁 Voucher adjustment
if (voucher?.code) {
  if (voucher.amount >= total) {
    advance = 0;
    balance = 0;
    paymentMode = "voucher";
  } else {
    const maxAdvance = total - voucher.amount;
    if (advance > maxAdvance) {
      advance = maxAdvance;
    }
    balance = total - voucher.amount - advance;
  }
}


  const bookingData = {
    client_name: data.clientName,
    client_phone: data.clientPhone,
    client_email: data.clientEmail,
    trek_category: data.trekCategory,
    trek_name: data.trekName,
    trek_date: data.trekDate,
    group_size: groupSize,
    rate_per_person: rate,
    total: total,
    advance_paid: advance,
    balance: balance,
    payment_mode: paymentMode,
    sharing_type: data.sharingType,
    special_notes: data.specialNotes || "-",
    voucher_used: voucher?.code || null,
    status: "confirmed"
  };

  try {
    const bookingCode = await insertBookingWithCode(bookingData);

    // ✅ Keep internal team message the same
    await sendText(from, `✅ Booking confirmed!\n🆔 Booking ID: ${bookingCode}`);

    // ✅ Send template confirmation to client
    await sendBookingTemplate(data.clientPhone, [
      data.clientName,
      bookingCode,
      data.trekName,
      data.trekDate,
      String(groupSize),
      String(advance),
      String(balance)
    ]);
    if (voucher?.code) {
  // ✅ Mark voucher as used
  await supabase.from("vouchers").update({
    used: true,
    used_at: new Date().toISOString(),
    used_by_booking: bookingCode
  }).eq("code", voucher.code);

  // ✅ Send extra WhatsApp messages
  await sendText(data.clientPhone, `🎟️ Your voucher *${voucher.code}* worth ₹${voucher.amount} has been redeemed for this booking.`);

  await sendText(from, `ℹ️ Voucher *${voucher.code}* (₹${voucher.amount}) was redeemed for this booking and marked as used.`);
}


  } catch (error) {
    console.error("❌ Booking insert failed:", error.message);
    await sendText(from, "❌ Booking failed to save. Please try again or contact admin.");
  }

  endSession(from);
  clearBookingVoucher(from);
  return res.sendStatus(200);
}



    if (input === "confirm_no") {
      endSession(from);
      await sendText(from, "❌ Booking canceled. Type *menu* to restart.");
      return res.sendStatus(200);
    }

    let step;
    try {
      step = getCurrentStep(from);
    } catch (e) {
      await sendText(from, "⚠️ Session expired. Please type *menu* to start over.");
      return res.sendStatus(200);
    }

    const isEditing = isEditingSession(from);

    // ✅ TREK DATE OPTIONS
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
    await sendText(from, "📅 Please enter the date in *YYYY-MM-DD* format.");
    return res.sendStatus(200);
  } else {
    const [year, month, day] = input.split("-").map(Number);
    const currentYear = new Date().getFullYear();

    const isValidDate = (y, m, d) => {
      const date = new Date(y, m - 1, d);
      return (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      );
    };

    if (year < currentYear || month > 12 || day > 31 || !isValidDate(year, month, day)) {
      await sendText(from, "⚠️ Please enter a *valid date* in format YYYY-MM-DD. Example: 2024-12-25");
      return res.sendStatus(200);
    }
  }
}


    // ✅ VALIDATIONS
    if (step === "clientName") {
      if (!input.trim()) {
        await sendText(from, "⚠️ Client name cannot be empty. Please enter a valid name.");
        return res.sendStatus(200);
      }
    }

if (step === "clientPhone") {
  const cleaned = input.replace(/[\s-]/g, '');
  const isValidPhone = /^\+\d{10,15}$/.test(cleaned);

  if (!isValidPhone) {
    await sendText(from, "⚠️ Please enter a valid phone number *starting with country code*. Example: +91 98765 43210");
    clearBookingVoucher(from);
    return res.sendStatus(200);
  }

  saveResponse(from, cleaned, !isEditing);
  clearBookingVoucher(from); // 🧹 Important: Clear any stale voucher tied to previous phone/email

  if (isEditing) {
    clearEditingFlag(from);
    const data = getSessionData(from);
    await sendSummaryAndConfirm(from, data);
  } else {
    await askNextQuestion(from, getCurrentStep(from));
  }

  return res.sendStatus(200);
}


if (step === "clientEmail") {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input)) {
    await sendText(from, "⚠️ Please enter a valid email address (e.g. example@mail.com).");
    clearBookingVoucher(from);
    return res.sendStatus(200);
  }

  saveResponse(from, input, !isEditing);

  const data = getSessionData(from);
  const phone = data.clientPhone;
  const email = data.clientEmail;

  const existing = getBookingVoucher(from);
  if (!existing && !isVoucherSkipped(from)) {
    const { data: vouchers, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("used", false)
      .gte("expiry_date", new Date().toISOString().split("T")[0])
      .or(`phone.eq.${phone},email.eq.${email}`);  // ✅ This includes shared too

    if (!error && vouchers?.length > 0) {
      const shared = vouchers.filter(v => v.phone === phone && v.email === email);
      const fromPhone = vouchers.filter(v => v.phone === phone && v.email !== email);
      const fromEmail = vouchers.filter(v => v.email === email && v.phone !== phone);

      const allVouchers = [
        ...shared.map(v => ({ v, source: 'shared' })),
        ...fromPhone.map(v => ({ v, source: 'phone' })),
        ...fromEmail.map(v => ({ v, source: 'email' }))
      ];

      if (allVouchers.length > 0) {
  const rows = allVouchers.map(({ v, source }, i) => ({
    id: `voucher__${v.code}`,
    title: `${i + 1}. ${v.code} - ₹${v.amount}`,
    description: `From ${source === "shared" ? "Phone+Email" : source}`
  }));

  rows.push({
    id: "voucher__none",
    title: "🚫 Don’t use any voucher",
    description: "Continue without applying one"
  });

  await sendList(from, `🎟️ Voucher Options (${allVouchers.length})`, [
    { title: "Available Vouchers", rows }
  ]);

  return res.sendStatus(200); // ⛔ Important: Pause until selection
}

    }
  }

  if (isEditing) {
    clearEditingFlag(from);
    const updated = getSessionData(from);
    await sendSummaryAndConfirm(from, updated);
  } else {
    await askNextQuestion(from, getCurrentStep(from));
  }

  return res.sendStatus(200);
}

    if (step === "trekCategory") {
      if (!["trek", "expedition"].includes(input.toLowerCase())) {
        await sendText(from, "⚠️ Please choose either *Trek* or *Expedition*.");
        return res.sendStatus(200);
      }
    }

    if (step === "groupSize") {
      if (!/^\d+$/.test(input.trim())) {
        await sendText(from, "👥 Please enter a valid group size (number only).");
        return res.sendStatus(200);
      }
    }

    if (step === "ratePerPerson") {
      if (!/^\d+$/.test(input.trim())) {
        await sendText(from, "💰 Please enter a valid rate per person (number only).");
        return res.sendStatus(200);
      }
    }

    if (step === "paymentMode") {
const voucher = getBookingVoucher(from);
const session = getSessionObject(from);
const groupSize = parseInt(session.data.groupSize || 0);
const rate = parseInt(session.data.ratePerPerson || 0);
const total = groupSize * rate;
updateCoverageFlag(from, total);

if (voucher?.code && voucher.amount >= total) {
  await sendText(from, `⚠️ Voucher already covers full amount. You don't need to edit this field.`);
  return res.sendStatus(200);
}

      if (!["online", "onspot"].includes(input.toLowerCase())) {
        await sendText(from, "⚠️ Please choose *Online* or *On-spot* using buttons.");
        return res.sendStatus(200);
      }
    }

   if (step === "advancePaid") {
  const session = getSessionObject(from);
  const voucher = getBookingVoucher(from);
  const groupSize = parseInt(session.data.groupSize || 0);
  const rate = parseInt(session.data.ratePerPerson || 0);
  const total = groupSize * rate;
  updateCoverageFlag(from, total);

  if (voucher?.code && voucher.amount >= total) {
    await sendText(from, `⚠️ Voucher already covers full amount. You don't need to enter advance payment.`);
    return res.sendStatus(200);
  }

  if (!/^\d+$/.test(input.trim())) {
    await sendText(from, "💵 Please enter a valid advance amount (number only).");
    return res.sendStatus(200);
  }

  const advance = parseInt(input);

  if (advance > total) {
    await sendText(from, `⚠️ Advance cannot exceed total (₹${total}). Please re-enter.`);
    return res.sendStatus(200);
  }

  // 🛠 Fix: Handle Onspot edge case
  if (session.data.paymentMode === 'onspot') {
    if (advance > 0) {
      session.data.paymentMode = 'online';
      await sendText(from, "ℹ️ Payment mode has been automatically changed to *Online* because advance was entered.");
    } else {
      await sendText(from, "ℹ️ You selected *Onspot* earlier. Advance will be kept as ₹0.");
    }
  }
}



    if (step === "sharingType") {
      if (!["single", "double", "triple"].includes(input.toLowerCase())) {
        await sendText(from, "⚠️ Please select *Single*, *Double*, or *Triple* from the options.");
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

      // 🛠 Special case: if trekCategory was edited, ask trekName next
      if (step === "trekCategory") {
        const session = getSessionObject(from);
        session.stepIndex = Object.keys(data).indexOf("trekName");
        session.editing = true;
        await askNextQuestion(from, "trekName");
        return res.sendStatus(200);
      }

      // 🛠 Payment mode special case
      if (step === "paymentMode" && input.toLowerCase() === "online") {
        const session = getSessionObject(from);
        const steps = [
          "clientName", "clientPhone", "clientEmail", "trekCategory",
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
        const voucher = getBookingVoucher(from);
const session = getSessionObject(from);
const groupSize = parseInt(session.data.groupSize || 0);
const rate = parseInt(session.data.ratePerPerson || 0);
const total = groupSize * rate;
updateCoverageFlag(from, total);

if (voucher?.code && voucher.amount >= total) {
  await sendText(from, `⚠️ Voucher already covers full amount. You don't need to enter advance payment.`);
  return res.sendStatus(200);
}

        clearEditingFlag(from);
        await sendSummaryAndConfirm(from, data);
        return res.sendStatus(200);
      }
      const voucher = getBookingVoucher(from);
if (voucher?.code) {
  const session = getSessionObject(from);
  const groupSize = parseInt(session.data.groupSize || 0);
  const rate = parseInt(session.data.ratePerPerson || 0);
  const newTotal = groupSize * rate;

  if (voucher.amount >= newTotal) {
    session.data.paymentMode = "voucher";
    session.data.advancePaid = 0;
    session.data.balance = 0;
    await sendText(from, "ℹ️ Updated booking total is now fully covered by voucher. Payment fields have been reset.");
  } else {
    const advance = parseInt(session.data.advancePaid || 0);
    const balance = newTotal - advance - voucher.amount;
    session.data.balance = balance;
  }
}


      // 🧼 Default: finish edit and return to summary
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
  const session = getSessionObject(userId);
  const steps = [
    "clientName",
    "clientPhone",
    "clientEmail",
    "trekCategory",
    "trekName",
    "trekDate",
    "groupSize",
    "ratePerPerson",
    "paymentMode",
    "advancePaid",
    "sharingType",
    "specialNotes"
  ];

  let currentIndex = session.stepIndex;

  const groupSize = parseInt(session.data.groupSize || 0);
  const rate = parseInt(session.data.ratePerPerson || 0);
  const total = groupSize * rate;
  const voucher = getBookingVoucher(userId);

  while (currentIndex < steps.length) {
    const currentStep = steps[currentIndex];

    // 🧠 Skip payment steps if voucher covers total
    if (
      (currentStep === "paymentMode" || currentStep === "advancePaid") &&
      voucher?.amount >= total
    ) {
      console.log(`[FLOW] Skipping '${currentStep}' because voucher covers total.`);
      currentIndex++;
      continue;
    }

    // ✅ Ask this step
    session.stepIndex = currentIndex;

    if (currentStep === "clientName")
      return sendText(userId, "👤 Enter *Client Name*:");

    if (currentStep === "clientPhone")
      return sendText(userId, "📞 Enter *Client Phone Number*:");

    if (currentStep === "clientEmail")
      return sendText(userId, "📧 Enter *Client Email Address*:");

    if (currentStep === "trekCategory")
      return sendButtons(userId, "🏔 Select *Trek Category*:", [
        { type: "reply", reply: { id: "Trek", title: "Trek" } },
        { type: "reply", reply: { id: "Expedition", title: "Expedition" } }
      ]);

    if (currentStep === "trekName")
      return sendTrekList(userId);

    if (currentStep === "trekDate")
      return sendButtons(userId, "📅 Choose a date:", [
        { type: "reply", reply: { id: "today", title: "Today" } },
        { type: "reply", reply: { id: "tomorrow", title: "Tomorrow" } },
        { type: "reply", reply: { id: "manual", title: "Enter Manually" } }
      ]);

    if (currentStep === "sharingType")
      return sendButtons(userId, "🏠 Select *Sharing Type*:", [
        { type: "reply", reply: { id: "Single", title: "Single" } },
        { type: "reply", reply: { id: "Double", title: "Double" } },
        { type: "reply", reply: { id: "Triple", title: "Triple" } }
      ]);

    if (currentStep === "paymentMode")
      return sendButtons(userId, "💳 Payment mode?", [
        { type: "reply", reply: { id: "Online", title: "Online" } },
        { type: "reply", reply: { id: "onspot", title: "On-spot" } }
      ]);

    // ✍️ Fallback for text-based questions
    return sendText(
      userId,
      `✍️ Please enter *${currentStep.replace(/([A-Z])/g, " $1").toLowerCase()}*:`
    );
  }

  // 🧾 If all steps done, send summary
  await sendSummaryAndConfirm(userId, session.data);
}

async function sendTrekList(userId) {
  const session = getSessionObject(userId);
  const category = (session.data.trekCategory || "").toLowerCase();

  const treks = {
    trek: [
      { id: "Kedarkantha", title: "Kedarkantha" },
      { id: "Brahmatal", title: "Brahmatal" },
      { id: "BaliPass", title: "Bali Pass" },
      { id: "BorasuPass", title: "Borasu Pass" },
      { id: "HarKiDun", title: "Har Ki Dun" }
    ],
    expedition: [
      { id: "BlackPeak", title: "Black Peak" },
      { id: "DumdarkandiPass", title: "Dumdarkandi Pass" }
    ]
  };

  const listToShow = treks[category] || [];
  const sections = [
    {
      title: `Available ${category.charAt(0).toUpperCase() + category.slice(1)}s`,
      rows: listToShow
    }
  ];

  return sendList(userId, `🌄 Select a ${category === "expedition" ? "Expedition" : "Trek"}:`, sections);
}

async function sendSummaryAndConfirm(from, data) {
  const groupSize = parseInt(data.groupSize || 0);
  const ratePerPerson = parseInt(data.ratePerPerson || 0);
    const voucher = getBookingVoucher(from);
  let total = groupSize * ratePerPerson;
  let advancePaid = parseInt(data.advancePaid || 0);
  let balance = total - advancePaid;

  if (voucher?.code) {
    if (voucher.amount >= total) {
      advancePaid = 0;
      balance = 0;
    } else {
      const maxAdvance = total - voucher.amount;
      if (advancePaid > maxAdvance) {
        advancePaid = maxAdvance;
      }
      balance = total - voucher.amount - advancePaid;
    }
  }


  let summary = `🧾 *Booking Summary:*
• *Client Name:* ${data.clientName}
• *Phone:* ${data.clientPhone}
• *Email:* ${data.clientEmail}
• *Trek Category:* ${data.trekCategory}
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
if (voucher?.code) {
  summary += `

🎟️ *Voucher Applied:*
• Code: ${voucher.code}
• Amount: ₹${voucher.amount}
• Covered Fully: ${voucher.amount >= total ? "Yes" : "No"}
• Adjusted Advance: ₹${advancePaid}
• Adjusted Balance: ₹${balance}`;
}



  await sendText(from, summary);
  await sendButtons(from, "✅ Confirm booking?", [
    { type: "reply", reply: { id: "confirm_yes", title: "Yes" } },
    { type: "reply", reply: { id: "confirm_no", title: "No" } },
    { type: "reply", reply: { id: "edit_booking", title: "✏️ Edit Something" } }
  ]);
}


function generateBookingCode() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // last 2 digits
  const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
  const day = String(now.getDate()).padStart(2, '0'); // DD
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `DH${year}${randomPart}${month}${day}`;
}
async function insertBookingWithCode(data) {
  let retries = 0;
  while (retries < 5) {
    const bookingCode = generateBookingCode();
    const { error } = await supabase.from("bookings").insert([
      { booking_code: bookingCode, ...data }
    ]);
    if (!error) return bookingCode;
    if (error.code === '23505') {
      retries++;
    } else {
      throw error;
    }
  }
  throw new Error("❌ Failed to generate a unique booking code.");
}

export default router;
