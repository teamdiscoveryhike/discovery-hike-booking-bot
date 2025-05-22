const sessions = new Map();

// ✅ Updated step list with amount fields
const steps = [
  "trekName",
  "trekDate",
  "pickupLocation",
  "groupSize",
  "ratePerPerson",   // NEW
  "advancePaid",     // NEW
  "sharingType",
  "paymentMode",
  "paymentRef",
  "specialNotes",
  "confirmation"
];

export function startSession(userId) {
  sessions.set(userId, { stepIndex: 0, data: {} });
  return "trekName";
}

export function isSessionActive(userId) {
  return sessions.has(userId);
}

export function getCurrentStep(userId) {
  const session = sessions.get(userId);
  return steps[session.stepIndex];
}

export function saveResponse(userId, value) {
  const session = sessions.get(userId);
  const key = steps[session.stepIndex];
  session.data[key] = value;
  session.stepIndex++;
}

export function isSessionComplete(userId) {
  const session = sessions.get(userId);
  return session.stepIndex >= steps.length;
}

export function getSessionData(userId) {
  const session = sessions.get(userId);
  return session.data;
}

export function endSession(userId) {
  sessions.delete(userId);
}
