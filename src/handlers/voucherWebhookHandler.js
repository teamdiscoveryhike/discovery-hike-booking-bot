// handlers/voucherWebhookHandler.js

import {
  startVoucherSession,
  isVoucherSession,
  getVoucherStep,
  getVoucherType,
  getVoucherData,
  saveVoucherStep,
  setVoucherStep,
  saveOtp,
  getOtp,
  endVoucherSession,
  cancelVoucherSession,
  isSessionExpired, 
  incrementOtpAttempts, 
  resetOtpAttempts
} from "../services/voucherSessionManager.js";

import { sendText, sendButtons } from "../services/whatsapp.js";
import supabase from "../services/supabase.js";

function generateVoucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DHV${code}`;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function handleVoucherFlow(input, from) {
  const lowerInput = input.toLowerCase();

  if (lowerInput === "manual_voucher") {
    cancelVoucherSession(from);
    await sendButtons(from, "🎟️ *Manual Voucher*", [
      { type: "reply", reply: { id: "voucher_generate", title: "📄 Generate" } },
      { type: "reply", reply: { id: "voucher_search", title: "🔍 Search" } },
      { type: "reply", reply: { id: "voucher_share", title: "🔁 Share" } }
    ]);
    return true;
  }

 if (input === "voucher_generate") {
  startVoucherSession(from, "generate");
  setVoucherStep(from, "contact_type");
  await sendButtons(from, "📄 Select to Enter:", [
    { type: "reply", reply: { id: "voucher_for_both", title: "Both" } },
    { type: "reply", reply: { id: "voucher_for_phone", title: "WhatsApp" } },
    { type: "reply", reply: { id: "voucher_for_email", title: "Email" } }
  ]);
  return true;
}


  if (input === "voucher_search") {
    startVoucherSession(from, "search");
    await sendText(from, "🔍 Enter phone number or email to search:");
    return true;
  }

  if (input === "voucher_share") {
    startVoucherSession(from, "share");
    await sendText(from, "🔁 Enter current holder's WhatsApp No:");
    return true;
  }

  if (!isVoucherSession(from)) return false;
  if (isVoucherSession(from) && isSessionExpired(from)) {
  endVoucherSession(from);
  await sendText(from, "⌛ Session expired due to inactivity. Please start again.");
  return true;
}
  const step = getVoucherStep(from);
  const type = getVoucherType(from);
  const data = getVoucherData(from);

  // === SEARCH FLOW ===
if (type === "search" && step === "lookup") {
  const isPhone = /^\+\d{10,15}$/.test(input);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

  if (!isPhone && !isEmail) {
    await sendText(from, "⚠️ Please enter a valid phone (with +) or email.");
    return true;
  }

  const field = isPhone ? "phone" : "email";
  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("*")
    .eq(field, input)
    .order("created_at", { ascending: false });

  if (vouchers?.length) {
    let message = `🎟️ *${vouchers.length} Voucher(s) Found*:\n\n`;

    for (const v of vouchers) {
      const rawDate = new Date(v.expiry_date);
      const formattedDate = rawDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });

      message += `• Code: ${v.code}\n  Amount: ₹${v.amount}\n  Expires: ${formattedDate}\n  Used: ${v.used ? "✅ Yes" : "❌ No"}\n\n`;
    }

    await sendText(from, message.trim());
  } else {
    await sendText(from, "❌ No voucher found for this contact.");
  }

  endVoucherSession(from);
  return true;
}



  // === GENERATE FLOW ===
if (type === "generate" && step === "contact_type") {
  const id = input.toLowerCase();
  if (id === "voucher_for_both") {
    saveVoucherStep(from, "contact_type", "both");
    setVoucherStep(from, "phone");
    await sendText(from, "📱 Enter phone number (with +91):");
    return true;
  } else if (id === "voucher_for_phone") {
    saveVoucherStep(from, "contact_type", "phone");
    setVoucherStep(from, "phone");
    await sendText(from, "📱 Enter phone number (with +91):");
    return true;
  } else if (id === "voucher_for_email") {
    saveVoucherStep(from, "contact_type", "email");
    setVoucherStep(from, "email");
    await sendText(from, "📧 Enter email address:");
    return true;
  } else {
    await sendText(from, "⚠️ Please select a valid option: Both, Phone, or Email.");
    return true;
  }
}


    if (step === "email") {
  const contactType = data.contact_type;

  if (contactType !== "email" && input.toLowerCase() === "skip") {
    saveVoucherStep(from, "email", null);
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
    await sendText(from, "⚠️ Invalid email format. Try again.");
    return true;
  } else {
    saveVoucherStep(from, "email", input);
  }

  setVoucherStep(from, "amount");
  await sendText(from, "💰 Enter the Voucher Amount (₹):");
  return true;
}


    if (step === "amount") {
      const amt = parseInt(input);
      if (isNaN(amt) || amt <= 0) {
        await sendText(from, "⚠️ Please enter a valid positive number.");
        return true;
      }
      saveVoucherStep(from, "amount", amt);
      setVoucherStep(from, "expiry_date");
setVoucherStep(from, "expiry_choice");
await sendButtons(from, "📆 Choose expiry duration", [
  { type: "reply", reply: { id: "expiry_1y", title: "1 Year" } },
  { type: "reply", reply: { id: "expiry_2y", title: "2 Years" } },
  { type: "reply", reply: { id: "expiry_5y", title: "5 Years" } },
  { type: "reply", reply: { id: "expiry_10y", title: "10 Years" } },
  { type: "reply", reply: { id: "expiry_lifetime", title: "Lifetime" } }
]);
return true;
    }

    if (step === "expiry_choice") {
  const today = new Date();
  let expiryDate;

  switch (input.toLowerCase()) {
    case "expiry_1y":
      expiryDate = new Date(today.setFullYear(today.getFullYear() + 1));
      break;
    case "expiry_2y":
      expiryDate = new Date(today.setFullYear(today.getFullYear() + 2));
      break;
    case "expiry_5y":
      expiryDate = new Date(today.setFullYear(today.getFullYear() + 5));
      break;
    case "expiry_10y":
      expiryDate = new Date(today.setFullYear(today.getFullYear() + 10));
      break;
    case "expiry_lifetime":
      expiryDate = new Date(today.setFullYear(today.getFullYear() + 150));
      break;
    default:
      await sendText(from, "⚠️ Invalid choice. Please select from the options.");
      return true;
  }

  const formattedDate = expiryDate.toISOString().split("T")[0]; // for DB
const formattedDisplayDate = expiryDate.toLocaleDateString("en-GB", {
  day: 'numeric', month: 'short', year: 'numeric'
});

saveVoucherStep(from, "expiry_date", formattedDate);

const voucher = {
  phone: data.phone,
  email: data.email || null,
  amount: data.amount,
  expiry_date: formattedDate,
  code: generateVoucherCode(),
  created_by: from
};

const { error } = await supabase.from("vouchers").insert([voucher]);
if (error) {
  await sendText(from, "❌ Error saving voucher. Try again.");
} else {
  await sendText(from, `✅ *Voucher created!*\n\n🎟️ Code: *${voucher.code}*\n💰 Amount: ₹${voucher.amount}\n📅 Expiry: ${formattedDisplayDate}`);
}

  endVoucherSession(from);
  return true;
}

  

  // === SHARE FLOW WITH OTP ===
 if (type === "share") {
  if (step === "holder_contact") {
    const isPhone = /^\+\d{10,15}$/.test(input);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    if (!isPhone && !isEmail) {
      await sendText(from, "⚠️ Invalid phone/email format.");
      return true;
    }

    saveVoucherStep(from, "holder", input);
    const field = isPhone ? "phone" : "email";

    const { data: vouchers } = await supabase
      .from("vouchers")
      .select("*")
      .eq(field, input)
      .eq("used", false)
      .gte("expiry_date", new Date().toISOString().split("T")[0])
      .order("created_at", { ascending: false });

    if (!vouchers?.length) {
      await sendText(from, "❌ No valid voucher found for this holder.");
      endVoucherSession(from);
      return true;
    }

    // ✅ Only one valid voucher → continue directly
    if (vouchers.length === 1) {
      saveVoucherStep(from, "voucher_id", vouchers[0].id);
      const otp = generateOtp();
      saveOtp(from, otp, "holder");
      setVoucherStep(from, "verify_holder_otp");

      await sendText(input, `🔐 Your OTP is: *${otp}*`);
      await sendText(from, "📨 OTP sent to holder. Please enter it here:");
      return true;
    }

    // ✅ Multiple vouchers → show readable list
    let summary = `🎟️ *${vouchers.length} Vouchers Found for Holder*\n\n`;
    vouchers.forEach((v, i) => {
      const date = new Date(v.expiry_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      summary += `🔹 *${i + 1}.* Code: ${v.code}\n   Amount: ₹${v.amount}\n   Expires: ${date}\n   Used: ❌ No\n\n`;
    });
    await sendText(from, summary.trim());

   saveVoucherStep(from, "voucher_choices", vouchers);
setVoucherStep(from, "select_voucher");
await sendText(from, "✏️ Please reply with the number of the voucher you want to use (e.g. 1, 2, 3...)");

    return true;
  }

  if (step === "select_voucher") {
  const choices = getVoucherData(from).voucher_choices;

const cleaned = input.trim().replace(/[^\d]/g, "");
const index = parseInt(cleaned, 10);
  if (isNaN(index) || index < 1 || index > choices.length) {
    await sendText(from, `❌ Invalid selection. Please enter a number between 1 and ${choices.length}.`);
    return true;
  }

  const selected = choices[index - 1];
  saveVoucherStep(from, "voucher_id", selected.id);

  const otp = generateOtp();
  saveOtp(from, otp, "holder");
  setVoucherStep(from, "verify_holder_otp");

  await sendText(getVoucherData(from).holder, `🔐 Your OTP is: *${otp}*`);
  await sendText(from, "📨 OTP sent to holder. Please enter it here:");
  return true;
}


  if (step === "verify_holder_otp") {
    if (input.trim() !== getOtp(from, "holder")) {
  const attempts = incrementOtpAttempts(from, "holder");
  if (attempts >= 3) {
    await sendText(from, "❌ Too many incorrect OTP attempts. Session closed for security.");
    endVoucherSession(from);
    return true;
  }
  await sendText(from, `❌ Incorrect OTP. Attempt ${attempts}/3. Try again.`);
  return true;
}

resetOtpAttempts(from, "holder");


    setVoucherStep(from, "recipient_contact");
    await sendText(from, "✅ Holder verified.\n📱 Now enter recipient's phone or email:");
    return true;
  }

  if (step === "recipient_contact") {
    const isPhone = /^\+\d{10,15}$/.test(input);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    if (!isPhone && !isEmail) {
      await sendText(from, "⚠️ Invalid phone/email format.");
      return true;
    }

    const field = isPhone ? "phone" : "email";
    const { data: existing } = await supabase
      .from("vouchers")
      .select("*")
      .eq(field, input)
      .eq("used", false);

    if (existing?.length) {
      await sendText(from, "❌ Recipient already has a valid voucher.");
      endVoucherSession(from);
      return true;
    }

    saveVoucherStep(from, "recipient", input);
    saveVoucherStep(from, "recipient_type", field);

    const otp = generateOtp();
    saveOtp(from, otp, "recipient");
    setVoucherStep(from, "verify_recipient_otp");

    await sendText(input, `🔐 Your OTP is: *${otp}*`);
    await sendText(from, "📨 OTP sent to recipient. Please enter it here:");
    return true;
  }

  if (step === "verify_recipient_otp") {
    if (input.trim() !== getOtp(from, "recipient")) {
  const attempts = incrementOtpAttempts(from, "recipient");
  if (attempts >= 3) {
    await sendText(from, "❌ Too many incorrect OTP attempts. Session closed for security.");
    endVoucherSession(from);
    return true;
  }
  await sendText(from, `❌ Incorrect OTP. Attempt ${attempts}/3. Try again.`);
  return true;
}

resetOtpAttempts(from, "recipient");


    const update = {};
    if (data.recipient_type === "phone") {
      update.phone = data.recipient;
      update.email = null;
    } else {
      update.email = data.recipient;
      update.phone = null;
    }
    update.otp_verified = true;

    const { error } = await supabase
      .from("vouchers")
      .update(update)
      .eq("id", data.voucher_id);

    if (error) {
      await sendText(from, "❌ Failed to transfer voucher.");
    } else {
      await sendText(from, `✅ Voucher successfully transferred to ${data.recipient}`);
    }

    endVoucherSession(from);
    return true;
  }
}


  return false; // fallback
}
