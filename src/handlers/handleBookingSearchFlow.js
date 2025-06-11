import supabase from "../services/supabase.js";
import { sendText, sendButtons } from "../services/whatsapp.js";

export async function handleBookingSearchFlow(input, from) {
  // Step 1: Prompt user to enter a search term
  if (input === "booking_manage_search") {
    await sendText(from, "🔍 Please enter *Booking Code*, *Phone*, or *Email* to search:");
    return true;
  }

  // Step 2: Detect likely search term
  const isSearch = /^[A-Z0-9\-]{4,}$/.test(input) || input.includes("@") || input.startsWith("+91");
  if (!isSearch) return false;

  // Step 3: Determine search field
  let field = "booking_code";
  if (input.includes("@")) field = "client_email";
  else if (input.startsWith("+")) field = "client_phone";

  // Step 4: Fetch booking from Supabase
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .ilike(field, `%${input.trim()}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!bookings?.length) {
    await sendText(from, "❌ No bookings found.");
    return true;
  }

  const booking = bookings[0];

  // Step 5: Fetch voucher info if any
  let voucherLine = "";
  if (booking.voucher_used) {
    const { data: voucher } = await supabase
      .from("vouchers")
      .select("*")
      .eq("code", booking.voucher_used)
      .maybeSingle();

    if (voucher) {
      voucherLine = `\n🎟️ *Voucher Used:* ₹${voucher.amount} (${voucher.code})`;
    }
  }

  // Step 6: Build summary
  const summary = `📘 *Booking Summary*\n\n` +
    `🆔 *Code:* ${booking.booking_code}\n` +
    `👤 *Name:* ${booking.client_name}\n` +
    `📞 *Phone:* ${booking.client_phone}\n` +
    `📧 *Email:* ${booking.client_email || "N/A"}\n\n` +
    `🥾 *Trek:* ${booking.trek_name} (${booking.trek_category})\n` +
    `🗓️ *Date:* ${booking.trek_date}\n` +
    `👥 *Group:* ${booking.group_size} x ₹${booking.rate_per_person}\n` +
    `💰 *Total:* ₹${booking.total}\n` +
    `💸 *Advance Paid:* ₹${booking.advance_paid}\n` +
    `💳 *Payment Mode:* ${booking.payment_mode}\n` +
    `📌 *Sharing:* ${booking.sharing_type || "N/A"}\n` +
    `📝 *Notes:* ${booking.special_notes || "-"}\n` +
    `📦 *Status:* ${booking.status || "confirmed"}` +
    voucherLine;

  await sendText(from, summary);

  // Step 7: Present options
  await sendButtons(from, `What do you want to do with *${booking.booking_code}*?`, [
    { type: "reply", reply: { id: `edit_${booking.booking_code}`, title: "✏️ Edit" } },
    { type: "reply", reply: { id: `cancel_${booking.booking_code}`, title: "❌ Cancel" } },
    { type: "reply", reply: { id: "booking_manage", title: "🔙 Back" } }
  ]);

  return true;
}
