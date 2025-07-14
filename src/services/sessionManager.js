// ✅ STEP 1: Update sessionManager.js to support pagination state

const sessions = new Map();

const steps = [
  "clientName",
  "clientPhone",
  "clientEmail",
  "trekCategory",
  "trekName",
  "trekDate",
  "groupSize",
  "ratePerPerson",
  "paymentMode",
  "advancePaid",
  "sharingType",
  "specialNotes"
];

export function startSession(userId) {
  sessions.set(userId, { stepIndex: 0, data: {}, editing: false, editPage: 0 });
  return steps[0];
}

// 🔄 Add pagination state management for edit list
export function setEditPage(userId, page = 0) {
  const session = sessions.get(userId);
  if (session) session.editPage = page;
}

export function getEditPage(userId) {
  const session = sessions.get(userId);
  return session?.editPage || 0;
}

export function isSessionActive(userId) {
  return sessions.has(userId);
}

export function getCurrentStep(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return steps[session.stepIndex];
}

export function saveResponse(userId, value, advanceStep = true) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  const key = steps[session.stepIndex];
  session.data[key] = value;
  if (advanceStep) session.stepIndex++;
}

export function isSessionComplete(userId) {
  const session = sessions.get(userId);
  return session?.stepIndex >= steps.length;
}

export function getSessionData(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return session.data;
}

export function getSessionObject(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return session;
}

export function endSession(userId) {
  sessions.delete(userId);
}

export function setEditStep(userId, stepKey) {
  const session = sessions.get(userId);
  const stepIndex = steps.indexOf(stepKey);
  if (session && stepIndex !== -1) {
    session.stepIndex = stepIndex;
    session.editing = true;
  }
}

export function isEditingSession(userId) {
  const session = sessions.get(userId);
  return !!session?.editing;
}

export function clearEditingFlag(userId) {
  const session = sessions.get(userId);
  if (session) session.editing = false;
}

export function hasCompletedSession(userId) {
  const session = sessions.get(userId);
  return session && session.stepIndex >= steps.length;
}
