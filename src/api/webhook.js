// ✅ FINAL: webhook.js with session resume fallback and flowId tracking

import express from "express";
const router = express.Router();

import { sendText, sendButtons, sendList } from "../services/whatsapp.js";
import {
  getSessionObject,
  isSessionActive,
  startSession,
  endSession
} from "../services/sessionManager.js";
import { clearBookingVoucher, getBookingVoucher } from "../services/bookingVoucherContext.js";
import { sendLetterMenu } from "../services/sendLetterMenu.js";
import { bookingFields } from "../services/bookingFields.js";
import { resolveFlow } from "../handlers/flowRouter.js";
import {
  confirmBooking,
  askNextQuestion
} from "../handlers/bookingMainFlow.js";

router.post("/", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message?.from;
    const input =
      message?.text?.body?.trim() ||
      message?.interactive?.button_reply?.id?.trim() ||
      message?.interactive?.list_reply?.id?.trim() ||
      "";

    if (!from || !input) return res.sendStatus(200);

    const lowerInput = input.toLowerCase();

    // 🔥 Emergency reset
    if (["xxx", "kill"].includes(lowerInput)) {
      endSession(from);
      clearBookingVoucher(from);
      await sendText(from, "❌ Session cleared.");
      return res.sendStatus(200);
    }

    // 🔌 Plugin-based flow routing (e.g. booking_new, voucher_manual)
    const flowHandler = resolveFlow(input);
    if (flowHandler) {
      const sessionFlows = ["booking_new"];
      if (sessionFlows.includes(input) && !isSessionActive(from)) {
        startSession(from, input); // 🔒 now stores flowId
      }
      await flowHandler(input, from);
      return res.sendStatus(200);
    }

    // ✅ Booking confirmation
    if (lowerInput === "yes") {
      await confirmBooking(from);
      return res.sendStatus(200);
    }

    // 🔠 Edit flow via letter menu
    let session;
    try {
      session = getSessionObject(from);
    } catch (e) {
      session = null;
    }

    if (session?.editLetterMap) {
      const letter = input.toUpperCase();
      const selectedKey = session.editLetterMap[letter];

      if (selectedKey) {
        session.editing = true;
        session.editStep = selectedKey;
        await askNextQuestion(from, selectedKey);
        return res.sendStatus(200);
      }
    }

    // 📋 Main menu
    if (["hi", "hello", "menu"].includes(lowerInput)) {
      await sendButtons(from, "🏔 Welcome to Discovery Hike", [
        { type: "reply", reply: { id: "booking_main", title: "📘 Booking" } },
        { type: "reply", reply: { id: "services_main", title: "🛠️ Services" } }
      ]);
      return res.sendStatus(200);
    }

    // 📘 Booking submenu
    if (input === "booking_main") {
      await sendButtons(from, "📘 *Booking Menu*", [
        { type: "reply", reply: { id: "booking_new", title: "📄 New Booking" } },
        { type: "reply", reply: { id: "booking_manage", title: "📁 Manage Booking" } },
        { type: "reply", reply: { id: "view_upcoming", title: "📅 View Upcoming" } }
      ]);
      return res.sendStatus(200);
    }

    // 🛠️ Services submenu
    if (input === "services_main") {
      await sendButtons(from, "🛠️ *Services*", [
        { type: "reply", reply: { id: "voucher_manual", title: "🎟️ Manual Voucher" } },
        { type: "reply", reply: { id: "vehicle_assign", title: "🚐 Vehicle Manager" } }
      ]);
      return res.sendStatus(200);
    }

    // ✏️ Edit booking letter-based menu
    if (input === "edit") {
      const session = getSessionObject(from);
      const data = session.data || {};
      const voucher = session.voucher;
      const total = (parseInt(data.groupSize || 0) * parseInt(data.ratePerPerson || 0)) || 0;
      const skipFields = voucher?.amount >= total ? ["advancePaid", "paymentMode"] : [];

      const editableFields = bookingFields
        .map(f => f.key)
        .filter(k => k !== "balance" && !skipFields.includes(k));

      const fields = editableFields.map(k => ({
        id: k,
        title: k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())
      }));

      const map = await sendLetterMenu(from, "✏️ What do you want to edit?", fields);
      session.editLetterMap = map;

      return res.sendStatus(200);
    }

    // 📁 Manage booking submenu
    if (input === "booking_manage") {
      await sendList(from, "📁 *Manage Booking*", [
        {
          title: "Booking Actions",
          rows: [
            { id: "booking_search", title: "🔍 Search" },
            { id: "edit_booking", title: "✏️ Edit" },
            { id: "booking_cancel", title: "❌ Cancel" }
          ]
        }
      ]);
      return res.sendStatus(200);
    }

    // 📅 Upcoming submenu
    if (input === "view_upcoming") {
      await sendButtons(from, "📅 *Upcoming Panel*", [
        { type: "reply", reply: { id: "upcoming_batches", title: "📆 Upcoming Batches" } },
        { type: "reply", reply: { id: "upcoming_actions", title: "⏰ Upcoming Actions" } }
      ]);
      return res.sendStatus(200);
    }

    // 🔁 Resume flow if session active and flowId known
    if (isSessionActive(from)) {
      const session = getSessionObject(from);
      const handler = resolveFlow(session.flowId);
      if (handler) {
        await handler(input, from);
        return res.sendStatus(200);
      }
    }

    // ❓ Fallback
    await sendText(from, "⚠️ I didn’t understand that. Type *menu* to begin.");
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ webhook.js failed:", err.message);
    await sendText(req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from, "⚠️ Something went wrong. Try again or type *menu*.");
    return res.sendStatus(500);
  }
});

export default router;
