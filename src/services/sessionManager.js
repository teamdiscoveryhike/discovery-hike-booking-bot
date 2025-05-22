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

// Start a new session for a user
export function startSession(userId) {
  sessions.set(userId, { stepIndex: 0, data: {}, editing: false });
  return steps[0];
}

// Check if a session exists
export function isSessionActive(userId) {
  return sessions.has(userId);
}

// Get the current step the user is on
export function getCurrentStep(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return steps[session.stepIndex];
}

// Save the user’s input for the current step
export function saveResponse(userId, value) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  const key = steps[session.stepIndex];
  session.data[key] = value;
  session.stepIndex++;
}

// Check if the session has collected all inputs
export function isSessionComplete(userId) {
  const session = sessions.get(userId);
  return session?.stepIndex >= steps.length;
}

// Get all collected data for a user session
export function getSessionData(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error("Session not found for user: " + userId);
  return session.data;
}

// End and remove a session
export function endSession(userId) {
  sessions.delete(userId);
}

// Set a specific step to edit
export function setEditStep(userId, stepKey) {
  const session = sessions.get(userId);
  const stepIndex = steps.indexOf(stepKey);
  if (session && stepIndex !== -1) {
    session.stepIndex = stepIndex;
    session.editing = true;
  }
}

// Check if the session is currently in edit mode
export function isEditingSession(userId) {
  const session = sessions.get(userId);
  return !!session?.editing;
}

// Clear the editing flag
export function clearEditingFlag(userId) {
  const session = sessions.get(userId);
  if (session) session.editing = false;
}

// Utility to check if session completed (used if needed externally)
export function hasCompletedSession(userId) {
  const session = sessions.get(userId);
  return session && session.stepIndex >= steps.length;
}
