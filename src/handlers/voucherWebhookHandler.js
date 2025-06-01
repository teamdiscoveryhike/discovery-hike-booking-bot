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
  cancelVoucherSession
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
    await sendButtons(from, "🎟️ Manual Voucher – Choose an action", [
      { type: "reply", reply: { id: "voucher_generate", title: "📄 Generate" } },
      { type: "reply", reply: { id: "voucher_search", title: "🔍 Search" } },
      { type: "reply", reply: { id: "voucher_share", title: "🔁 Share" } }
    ]);
    return true;
  }

  if (input === "voucher_generate") {
    startVoucherSession(from, "generate");
    await sendText(from, "📄 Let's generate a new voucher.\n📱 Enter *Phone Number* (with +91):");
    return true;
  }

  if (input === "voucher_search") {
    startVoucherSession(from, "search");
    await sendText(from, "🔍 Enter phone number or email to search:");
    return true;
  }

  if (input === "voucher_share") {
    startVoucherSession(from, "share");
    await sendText(from, "🔁 Enter current holder's phone or email:");
    return true;
  }

  if (!isVoucherSession(from)) return false;

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
      const v = vouchers[0];
      await sendText(from, `🎟️ *Voucher Found*:\nCode: ${v.code}\nAmount: ₹${v.amount}\nExpires: ${v.expiry_date}`);
    } else {
      await sendText(from, "❌ No voucher found for this contact.");
    }

    endVoucherSession(from);
    return true;
  }

  // === GENERATE FLOW ===
  if (type === "generate") {
    if (step === "phone") {
      const cleaned = input.replace(/[\s-]/g, '');
      if (!/^\+\d{10,15}$/.test(cleaned)) {
        await sendText(from, "⚠️ Invalid phone. Format: +91 98765 43210");
        return true;
      }
      saveVoucherStep(from, "phone", cleaned);
      setVoucherStep(from, "email");
      await sendText(from, "📧 Enter email address (or type *skip*):");
      return true;
    }

    if (step === "email") {
      if (lowerInput === "skip") {
        saveVoucherStep(from, "email", null);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
        await sendText(from, "⚠️ Invalid email format. Try again.");
        return true;
      } else {
        saveVoucherStep(from, "email", input);
      }
      setVoucherStep(from, "amount");
      await sendText(from, "💰 Enter flat discount amount (₹):");
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
      await sendText(from, "📆 Enter expiry date (YYYY-MM-DD):");
      return true;
    }

    if (step === "expiry_date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        await sendText(from, "⚠️ Invalid date format. Use YYYY-MM-DD.");
        return true;
      }

      const voucher = {
        phone: data.phone,
        email: data.email || null,
        amount: data.amount,
        expiry_date: input,
        code: generateVoucherCode(),
        created_by: from
      };

      const { error } = await supabase.from("vouchers").insert([voucher]);
      if (error) {
        await sendText(from, "❌ Error saving voucher. Try again.");
      } else {
        await sendText(from, `✅ Voucher created!\n\n🎟️ Code: *${voucher.code}*\n💰 Amount: ₹${voucher.amount}\n📅 Expiry: ${voucher.expiry_date}`);
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
        .lt("expiry_date", "2999-12-31")
        .order("created_at", { ascending: false });

      const voucher = vouchers?.[0];
      if (!voucher || new Date(voucher.expiry_date) < new Date()) {
        await sendText(from, "❌ No valid voucher found for this holder.");
        endVoucherSession(from);
        return true;
      }

      saveVoucherStep(from, "voucher_id", voucher.id);
      const otp = generateOtp();
      saveOtp(from, otp, "holder");
      setVoucherStep(from, "verify_holder_otp");

      await sendText(input, `🔐 Your OTP is: *${otp}*`);
      await sendText(from, "📨 OTP sent to holder. Please enter it here:");
      return true;
    }

    if (step === "verify_holder_otp") {
      if (input.trim() !== getOtp(from, "holder")) {
        await sendText(from, "❌ Incorrect OTP. Try again.");
        return true;
      }

      setVoucherStep(from, "recipient_contact");
      await sendText(from, "✅ Holder verified.\n📱 Now enter recipient's WhatsApp No:");
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
        await sendText(from, "❌ Incorrect OTP. Try again.");
        return true;
      }

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
