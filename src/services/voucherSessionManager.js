// services/voucherSessionManager.js

const voucherSessions = {}; // session memory

const steps = ["phone", "email", "amount", "expiry_date"];

export function startVoucherSession(userId) {
  voucherSessions[userId] = {
    step: "phone",
    data: {},
    startedAt: Date.now()
  };
}

export function isVoucherSession(userId) {
  return Boolean(voucherSessions[userId]);
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

  const currentIndex = steps.indexOf(field);
  const nextStep = steps[currentIndex + 1];
  voucherSessions[userId].step = nextStep;
}

export function endVoucherSession(userId) {
  delete voucherSessions[userId];
}

export function cancelVoucherSession(userId) {
  delete voucherSessions[userId];
}
