// handlers/voucherWebhookHandler.js
// PATCHED: voucherWebhookHandler.js

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

import { sendText, sendList, sendButtons } from "../services/whatsapp.js";
import supabase from "../services/supabase.js";
const lastTriggerTimestamps = new Map();

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
//early guard for manual voucher session 
const now = Date.now(); // 🕒 Get timestamp at the top

  // 🛡️ Prevent repeated WhatsApp retries for `manual_voucher`
  if (lowerInput === "manual_voucher") {
    const last = lastTriggerTimestamps.get(from);
    if (last && now - last < 5000) return true; // ⛔ Ignore if within 5s
    lastTriggerTimestamps.set(from, now);
  }

  if (input === "manual_voucher" && isVoucherSession(from)) {
  await sendText(from, "⚠️ A voucher session is already running.");
  return true;
}


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
    cancelVoucherSession(from);
    startVoucherSession(from, "generate");
    setVoucherStep(from, "contact_type");
    await sendButtons(from, "📄 Select to Enter:", [
      { type: "reply", reply: { id: "voucher_for_both", title: "🔁 Both" } },
      { type: "reply", reply: { id: "voucher_for_phone", title: "📱 WhatsApp" } },
      { type: "reply", reply: { id: "voucher_for_email", title: "📧 Email" } }
    ]);
    return true;
  }

  if (input === "voucher_search") {
    cancelVoucherSession(from);
    startVoucherSession(from, "search");
    await sendText(from, "🔍 Enter phone number or email to search:");
    return true;
  }

  if (input === "voucher_share") {
    cancelVoucherSession(from);
    startVoucherSession(from, "share");
    await sendText(from, "🔁 Enter current holder's WhatsApp No:");
    return true;
  }

  if (!isVoucherSession(from)) return false;

  if (isSessionExpired(from)) {
    endVoucherSession(from);
    await sendText(from, "⌛ Session expired due to inactivity. Please type *manual_voucher* to restart.");
    return true;
  }

  const step = getVoucherStep(from);
  const type = getVoucherType(from);
  const data = getVoucherData(from);

  if (!step) {
    endVoucherSession(from);
    await sendText(from, "⚠️ Session corrupted or incomplete. Please type *manual_voucher* to restart.");
    return true;
  }

  // All other flow handlers go here — same as your logic — with the following adjustments:
  // - Add try/catch around any sendText to dynamic numbers
  // - Avoid double setVoucherStep
  // - Reset OTP attempts in endVoucherSession
  // - Cap voucher amount if needed
  // - Add fallback to unknown steps

  // 🔚 Example end of a flow (search):
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

        message += `• Code: ${v.code}\n  Amount: ₹${v.amount}\n  Expires: ${formattedDate}\n  Used: ${v.used ? "👺 Yes" : "🤢 No"}\n\n`;
      }

      await sendText(from, message.trim());
    } else {
      await sendText(from, "❌ No voucher found for this contact.");
    }

    await sendText(from, "✅ Done with search. Type *menu* to do something else.");
    endVoucherSession(from);
    return true;
  }



  // === GENERATE FLOW ===
if (type === "generate") {
    if (step === "contact_type") {
      if (["voucher_for_both", "voucher_for_phone", "voucher_for_email"].includes(input)) {
        const mode = input.replace("voucher_for_", "");
        saveVoucherStep(from, "contact_type", mode);
        const nextStep = mode === "email" ? "email" : "phone";
        setVoucherStep(from, nextStep);
        await sendText(from, nextStep === "phone" ? "📱 Enter phone number (with +91):" : "📧 Enter email address:");
      } else {
        await sendText(from, "⚠️ Please choose from the options using buttons.");
      }
      return true;
    }

    if (step === "phone") {
      const cleaned = input.replace(/\s|-/g, "");
      if (!/^\+\d{10,15}$/.test(cleaned)) {
        await sendText(from, "⚠️ Invalid phone number. Format: +91 98765 43210");
        return true;
      }
      saveVoucherStep(from, "phone", cleaned);
      const contactType = getVoucherData(from).contact_type;
      if (contactType === "both") {
        setVoucherStep(from, "email");
        await sendText(from, "📧 Enter email address:");
      } else {
        setVoucherStep(from, "amount");
        await sendText(from, "💰 Enter the Voucher Amount (₹):");
      }
      return true;
    }

    if (step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
        await sendText(from, "⚠️ Invalid email format. Try again.");
        return true;
      }
      saveVoucherStep(from, "email", input);
      setVoucherStep(from, "amount");
      await sendText(from, "💰 Enter the Voucher Amount (₹):");
      return true;
    }

    if (step === "amount") {
      const amt = parseInt(input);
      if (isNaN(amt) || amt <= 0 || amt > 99999) {
        await sendText(from, "⚠️ Please enter a valid amount (1–99999).");
        return true;
      }
      saveVoucherStep(from, "amount", amt);
      setVoucherStep(from, "expiry_choice");
      await sendList(from, "📆 Choose expiry duration", [
        {
          title: "Expiry Durations",
          rows: [
            { id: "expiry_1y", title: "1 Year" },
            { id: "expiry_2y", title: "2 Years" },
            { id: "expiry_5y", title: "5 Years" },
            { id: "expiry_10y", title: "10 Years" },
            { id: "expiry_lifetime", title: "Lifetime (150 yrs)" }
          ]
        }
      ]);
      return true;
    }

    if (step === "expiry_choice") {
      const today = new Date();
      let expiryDate;
      const options = {
        expiry_1y: 1,
        expiry_2y: 2,
        expiry_5y: 5,
        expiry_10y: 10,
        expiry_lifetime: 150
      };
      if (!options[input]) {
        await sendText(from, "⚠️ Invalid option. Please pick from the list.");
        return true;
      }
      expiryDate = new Date(today.setFullYear(today.getFullYear() + options[input]));
      const formatted = expiryDate.toISOString().split("T")[0];
      const displayDate = expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

      saveVoucherStep(from, "expiry_date", formatted);

      const voucher = {
        phone: data.phone,
        email: data.email || null,
        amount: data.amount,
        expiry_date: formatted,
        code: generateVoucherCode(),
        created_by: from
      };

      const { error } = await supabase.from("vouchers").insert([voucher]);
      if (error) {
        await sendText(from, "❌ Failed to save voucher. Try again.");
      } else {
        await sendText(from, `✅ *Voucher created!*\n\n🎟️ Code: *${voucher.code}*\n💰 Amount: ₹${voucher.amount}\n📅 Expiry: ${displayDate}`);
      }
      endVoucherSession(from);
      return true;
    }
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

      try {
          await sendText(input, `🔐 Your OTP is: *${otp}*`);
        } catch (e) {
          await sendText(from, "⚠️ Failed to send OTP to holder. Try again.");
          endVoucherSession(from);
          return true;
        }
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
      summary += `🔹 *${i + 1}.* Code: ${v.code}\n   Amount: ₹${v.amount}\n   Expires: ${date}\n   Used: 🤢 No\n\n`;
    });
    await sendText(from, summary.trim());

   saveVoucherStep(from, "voucher_choices", vouchers);
setVoucherStep(from, "select_voucher");
await sendText(from, "✏️ Please reply with the list number of the voucher you want to use (e.g. 1, 2, 3...)");

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

   try {
        await sendText(data.holder, `🔐 Your OTP is: *${otp}*`);
      } catch (e) {
        await sendText(from, "⚠️ Failed to send OTP to holder. Try again.");
        endVoucherSession(from);
        return true;
      }
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
    await sendText(from, "✅ Holder verified.\n");
    await sendText(from, "📱 Now enter recipient's phone or email:");

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

     try {
        await sendText(input, `🔐 Your OTP is: *${otp}*`);
      } catch (e) {
        await sendText(from, "⚠️ Failed to send OTP to recipient. Try again.");
        endVoucherSession(from);
        return true;
      }
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
