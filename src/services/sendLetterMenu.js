// src/services/sendLetterMenu.js

import { sendText } from "./whatsapp.js";

/**
 * Generates Excel-style label: A, B, ..., Z, AA, AB, ...
 * @param {number} index
 * @returns {string}
 */
function indexToLetters(index) {
  let result = "";
  while (index >= 0) {
    result = String.fromCharCode((index % 26) + 65) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}

/**
 * Sends a letter-based menu (A, B, ..., Z, AA, AB...) to the user.
 * @param {string} userId - WhatsApp number
 * @param {string} title - Menu title
 * @param {Array} items - Array of { id: string, title: string }
 * @returns {object} Map of letter code → item.id
 */
export async function sendLetterMenu(userId, title, items) {
  const map = {};

  const formattedOptions = items.map((item, i) => {
    const letter = indexToLetters(i); // A-Z, AA-ZZ, etc.
    map[letter] = item.id;
    return `${letter}. ${item.title}`;
  });

  const fullMessage = `📋 *${title}*\n\n${formattedOptions.join("\n")}\n\n_Type your choice (e.g. A, AB, Z)_`;

  await sendText(userId, fullMessage);
  return map;
}
