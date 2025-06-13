// src/services/bookingFields.js

export const bookingFields = [
  { key: "clientName", ask: "👤 Enter *Client Name*:" },
  { key: "clientPhone", ask: "📞 Enter *Client Phone Number* (with +91):" },
  { key: "clientEmail", ask: "📧 Enter *Client Email Address* (optional):" },
  { key: "trekCategory", ask: "🏔 Select *Trek Category*:" },  // uses button
  { key: "trekName", ask: "🥾 Select *Trek Name*:" },         // uses dynamic trek list
  { key: "trekDate", ask: "📅 Choose a trek date:" },         // uses date buttons + fallback
  { key: "groupSize", ask: "👥 Enter *Group Size* (number):" },
  { key: "ratePerPerson", ask: "💵 Enter *Rate per Person* (₹):" },
  { key: "paymentMode", ask: "💳 Select *Payment Mode*:" },   // skipped if voucher covers total
  { key: "advancePaid", ask: "💰 Enter *Advance Paid* (₹):" },
  { key: "sharingType", ask: "🏕️ Select *Sharing Type* (Single/Double/Triple):" },
  { key: "specialNotes", ask: "📝 Any *Special Notes*?" }
];
