export function getAdjustedPayment({ total, advance, voucherAmount }) {
  const cappedVoucher = Math.min(voucherAmount, total);
  const cappedAdvance = Math.min(advance, Math.max(total - cappedVoucher, 0));
  const adjustedAdvance = cappedVoucher + cappedAdvance;
  const adjustedBalance = Math.max(total - adjustedAdvance, 0);

  let paymentMode = "Online";
  if (cappedVoucher >= total) {
    paymentMode = "Voucher";
  } else if (cappedVoucher > 0) {
    paymentMode = cappedAdvance > 0 ? "Advance+Voucher" : "Voucher+Onspot";
  }

  return { cappedAdvance, adjustedAdvance, adjustedBalance, paymentMode };
}
import supabase from "../services/supabase.js";

export async function insertBookingWithCode(data) {
  let attempts = 0;
  while (attempts < 5) {
    const code = generateBookingCode();
    const { error } = await supabase.from("bookings").insert([{ booking_code: code, ...data }]);
    if (!error) return code;
    if (error.code === "23505") {
      attempts++;
    } else {
      throw error;
    }
  }
  throw new Error("❌ Failed to generate unique booking code.");
}

function generateBookingCode() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let rand = "";
  for (let i = 0; i < 5; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `DH${year}${rand}${month}${day}`;
}
