const sessions = new Map();

const steps = [
  "trekName",
  "trekDate",
  "groupSize",
  "ratePerPerson",
  "advancePaid",
  "sharingType",
  "paymentMode",
  "specialNotes"
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

// 🆕 Editing support
export function setEditStep(userId, stepKey) {
  const session = sessions.get(userId);
  const stepIndex = steps.indexOf(stepKey);
  if (stepIndex !== -1) {
    session.stepIndex = stepIndex;
    session.editing = true;
  }
}

export function isEditingSession(userId) {
  const session = sessions.get(userId);
  return session?.editing || false;
}

export function clearEditingFlag(userId) {
  const session = sessions.get(userId);
  if (session) delete session.editing;
}
