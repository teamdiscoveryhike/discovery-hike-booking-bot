import steps from "../utils/steps.js";

const sessions = new Map();

export function startSession(userId) {
  sessions.set(userId, {
    stepIndex: 0,
    data: {},
    editing: false,
    editingField: null,
    awaitingFieldSelection: false
  });
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

export function getEditingField(userId) {
  return sessions.get(userId)?.editingField || null;
}

export function setEditingField(userId, fieldName) {
  const session = sessions.get(userId);
  if (session) session.editingField = fieldName;
}

export function isAwaitingField(userId) {
  return sessions.get(userId)?.awaitingFieldSelection || false;
}

export function setAwaitingField(userId, state) {
  const session = sessions.get(userId);
  if (session) session.awaitingFieldSelection = state;
}

export function logSession(userId) {
  const session = sessions.get(userId);
  console.log("Session", userId, JSON.stringify(session, null, 2));
}
