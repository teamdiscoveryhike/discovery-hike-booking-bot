
const sessions = new Map();

const steps = [
  "trekName",
  "trekDate",
  "groupSize",
  "ratePerPerson",
  "paymentMode",
  "advancePaid",
  "sharingType",
  "specialNotes"
];

function startSession(userId) {
  sessions.set(userId, { stepIndex: 0, data: {}, editing: false });
  return steps[0];
}

function isSessionActive(userId) {
  return sessions.has(userId);
}

function getCurrentStep(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return steps[session.stepIndex];
}

function saveResponse(userId, value, advanceStep = true) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  const key = steps[session.stepIndex];
  session.data[key] = value;
  if (advanceStep) session.stepIndex++;
}

function isSessionComplete(userId) {
  const session = sessions.get(userId);
  return session?.stepIndex >= steps.length;
}

function getSessionData(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return session.data;
}

function getSessionObject(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return session;
}

function endSession(userId) {
  sessions.delete(userId);
}

function setEditStep(userId, stepKey) {
  const session = sessions.get(userId);
  const stepIndex = steps.indexOf(stepKey);
  if (session && stepIndex !== -1) {
    session.stepIndex = stepIndex;
    session.editing = true;
    session.editingField = stepKey;
  }
}

function getEditingField(userId) {
  const session = sessions.get(userId);
  return session?.editingField || null;
}

function isEditingSession(userId) {
  const session = sessions.get(userId);
  return !!session?.editing;
}

function clearEditingFlag(userId) {
  const session = sessions.get(userId);
  if (session) {
    session.editing = false;
    delete session.editingField;
  }
}

function hasCompletedSession(userId) {
  const session = sessions.get(userId);
  return session && session.stepIndex >= steps.length;
}

export {
  startSession,
  isSessionActive,
  getCurrentStep,
  saveResponse,
  isSessionComplete,
  getSessionData,
  getSessionObject,
  endSession as clearSession,
  endSession,
  setEditStep,
  getEditingField,
  isEditingSession,
  clearEditingFlag,
  hasCompletedSession
};
