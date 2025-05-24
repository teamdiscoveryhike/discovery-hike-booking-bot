// Refactored sessionManager.js with stronger flag handling and recalculation helpers

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
  const session = {
    stepIndex: 0,
    data: {},
    editing: false,
    awaitingConfirmation: false,
    lastInput: null
  };
  sessions.set(userId, session);
  return steps[0];
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
    session.awaitingConfirmation = false;
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

export function setAwaitingConfirmation(userId, flag = true) {
  const session = sessions.get(userId);
  if (session) session.awaitingConfirmation = flag;
}

export function hasCompletedSession(userId) {
  const session = sessions.get(userId);
  return session && session.stepIndex >= steps.length;
}

export function getStepIndex(stepKey) {
  return steps.indexOf(stepKey);
}

export function resetLastInput(userId) {
  const session = sessions.get(userId);
  if (session) session.lastInput = null;
}

export function recalculateTotals(userId) {
  const session = sessions.get(userId);
  if (session) {
    const groupSize = parseInt(session.data.groupSize || 0);
    const rate = parseInt(session.data.ratePerPerson || 0);
    const advance = parseInt(session.data.advancePaid || 0);
    session.data.total = groupSize * rate;
    session.data.balance = session.data.total - advance;
  }
}
