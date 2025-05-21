const sessions = new Map();

const steps = [
  "trekName",
  "trekDate",
  "pickupLocation",
  "groupSize",
  "sharingType",
  "paymentMode",
  "paymentRef",
  "specialNotes",
  "confirmation"
];

function startSession(userId) {
  sessions.set(userId, { stepIndex: 0, data: {} });
  return "trekName";
}

function isSessionActive(userId) {
  return sessions.has(userId);
}

function getCurrentStep(userId) {
  const session = sessions.get(userId);
  return steps[session.stepIndex];
}

function saveResponse(userId, value) {
  const session = sessions.get(userId);
  const key = steps[session.stepIndex];
  session.data[key] = value;
  session.stepIndex++;
}

function isSessionComplete(userId) {
  const session = sessions.get(userId);
  return session.stepIndex >= steps.length;
}

function getSessionData(userId) {
  const session = sessions.get(userId);
  return session.data;
}

function endSession(userId) {
  sessions.delete(userId);
}

module.exports = {
  startSession,
  isSessionActive,
  getCurrentStep,
  saveResponse,
  isSessionComplete,
  getSessionData,
  endSession
};
