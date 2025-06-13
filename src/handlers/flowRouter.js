// src/handlers/flowRouter.js

import { handleMainBookingFlow} from "./bookingMainFlow.js";
import { handleVoucherFlow } from "./voucherWebhookHandler.js";
// Future: import handleDummyBookingFlow from './dummyBookingFlow.js';

const flowMap = new Map();

// 🔌 Register your flows here
flowMap.set("booking_new", handleMainBookingFlow);
flowMap.set("voucher_manual", handleVoucherFlow);

/** 
 * Main plugin router to resolve flow ID to handler
 * @param {string} input - WhatsApp button ID or text
 * @returns {Function|null} the handler function
 */
export function resolveFlow(input) {
  const normalized = input?.toLowerCase();
  if (flowMap.has(normalized)) return flowMap.get(normalized);
  return null;
}
