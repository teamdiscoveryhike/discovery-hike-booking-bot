// handlers/voucherWebhookHandler.js
import {
  startVoucherSession,
  isVoucherSession,
  saveVoucherStep,
  getVoucherData,
  getVoucherStep,
  endVoucherSession
} from "../services/voucherSessionManager.js";

import { sendText } from "../services/whatsapp.js";
import supabase from "../services/supabase.js";

function generateVoucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DHV${code}`;
}

export async function handleVoucherFlow(input, from) {
  if (input === "manual_voucher") {
    startVoucherSession(from);
    await sendText(from, "🎟️ Let's create a manual voucher.");
    await sendText(from, "📱 Enter phone number (with +91):");

    return true;
  }

  if (!isVoucherSession(from)) return false;

  const step = getVoucherStep(from);
  const data = getVoucherData(from);

  if (step === "phone") {
    const cleaned = input.replace(/[\s-]/g, '');
    const isValidPhone = /^\+\d{10,15}$/.test(cleaned);
    if (!isValidPhone) {
      await sendText(from, "⚠️ Invalid phone. Format: +91 98765 43210");
      return true;
    }
    saveVoucherStep(from, "phone", cleaned);
    await sendText(from, "📧 Enter email address (or type *skip*):");
    return true;
  }

  if (step === "email") {
    if (input.toLowerCase() !== "skip") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        await sendText(from, "⚠️ Invalid email format. Try again.");
        return true;
      }
      saveVoucherStep(from, "email", input);
    }
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
    await sendText(from, "📆 Enter expiry date (YYYY-MM-DD):");
    return true;
  }

  if (step === "expiry_date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      await sendText(from, "⚠️ Invalid date format. Use YYYY-MM-DD.");
      return true;
    }

    const code = generateVoucherCode();
    const voucher = {
      phone: data.phone,
      email: data.email || null,
      amount: data.amount,
      expiry_date: input,
      code,
    };

    const { error } = await supabase.from("vouchers").insert([voucher]);

    if (error) {
      console.error("❌ Failed to insert voucher:", error.message);
      await sendText(from, "❌ Error saving voucher. Try again.");
    } else {
      await sendText(from, `✅ Voucher created!\n\n🎟️ Code: *${code}*\n💰 Amount: ₹${voucher.amount}\n📅 Expiry: ${voucher.expiry_date}`);
    }

    endVoucherSession(from);
    return true;
  }

  return false; // fallback
}

