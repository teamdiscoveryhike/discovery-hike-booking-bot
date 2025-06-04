// services/voucherSessionManager.js

const voucherSessions = {}; // In-memory store

export function startVoucherSession(userId, type = "generate") {
  let step;
  if (type === "generate") step = "contact_type";
  else if (type === "search") step = "lookup";
  else step = "holder_contact";

  voucherSessions[userId] = {
    type,
    step,
    data: {},
    startedAt: Date.now()
  };
}


export function isVoucherSession(userId) {
  return Boolean(voucherSessions[userId]);
}

export function getVoucherType(userId) {
  return voucherSessions[userId]?.type;
}

export function getVoucherStep(userId) {
  return voucherSessions[userId]?.step;
}

export function getVoucherData(userId) {
  return voucherSessions[userId]?.data || {};
}

export function saveVoucherStep(userId, field, value) {
  if (!voucherSessions[userId]) return;
  voucherSessions[userId].data[field] = value;
}

export function saveOtp(userId, otp, forWhom = "holder") {
  if (!voucherSessions[userId]) return;
  voucherSessions[userId].data[`${forWhom}_otp`] = otp;
}

export function getOtp(userId, forWhom = "holder") {
  return voucherSessions[userId]?.data[`${forWhom}_otp`] || null;
}

export function setVoucherStep(userId, step) {
  if (voucherSessions[userId]) voucherSessions[userId].step = step;
}

export function endVoucherSession(userId) {
  delete voucherSessions[userId];
}

export function cancelVoucherSession(userId) {
  delete voucherSessions[userId];
}
export function isSessionExpired(userId, timeoutMinutes = 10) {
  const session = voucherSessions[userId];
  if (!session) return true;
  const now = Date.now();
  return now - session.startedAt > timeoutMinutes * 60 * 1000;
}

export function incrementOtpAttempts(userId, forWhom = "holder") {
  if (!voucherSessions[userId]) return;
  const key = `${forWhom}_attempts`;
  const attempts = voucherSessions[userId].data[key] || 0;
  voucherSessions[userId].data[key] = attempts + 1;
  return voucherSessions[userId].data[key];
}

export function resetOtpAttempts(userId, forWhom = "holder") {
  if (voucherSessions[userId]) {
    voucherSessions[userId].data[`${forWhom}_attempts`] = 0;
  }
}
