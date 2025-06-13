// services/bookingVoucherContext.js
import supabase from "./supabase.js";
const bookingVoucherMap = new Map(); // userId → voucher data

export function setBookingVoucher(userId, voucher) {
  bookingVoucherMap.set(userId, {
    code: voucher.code,
    amount: voucher.amount,
    source: voucher.source || "email", // email or phone
    coveredFully: false,
    status: "applied"
  });
}

export function getBookingVoucher(userId) {
  return bookingVoucherMap.get(userId) || null;
}

export function updateCoverageFlag(userId, totalAmount) {
  const voucher = bookingVoucherMap.get(userId);
  if (!voucher) return;
  voucher.coveredFully = voucher.amount >= totalAmount;
}

export function voucherCoversTotal(userId, totalAmount) {
  const voucher = getBookingVoucher(userId);
  return voucher && voucher.amount >= totalAmount;
}

export function clearBookingVoucher(userId) {
  bookingVoucherMap.delete(userId);
}

export function markVoucherAsSkipped(userId) {
  bookingVoucherMap.set(userId, { status: "skipped" });
}

export function isVoucherSkipped(userId) {
  const entry = bookingVoucherMap.get(userId);
  return entry?.status === "skipped";
}
export async function fetchMatchingVoucher(phone, email) {
  const { data, error } = await supabase
    .from("vouchers")
    .select("*")
    .eq("used", false)
    .or(`email.eq.${email},phone.eq.${phone}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("❌ Failed to fetch voucher:", error.message);
    return null;
  }

  return data?.[0] || null;
}