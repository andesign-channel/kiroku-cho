import { sha256Hex } from './hash.js';

export function validPin(pin) {
  return /^\d{4,8}$/.test(String(pin));
}

function randomSaltHex() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const normalizeAnswer = (answer) => String(answer).normalize('NFKC').trim().toLowerCase();
const hashSecret = (secret, salt) => sha256Hex(`${salt}:${secret}`);

export async function makeLock({ pin, question, answer }) {
  const pinSalt = randomSaltHex();
  const answerSalt = randomSaltHex();
  return {
    pinSalt,
    pinHash: await hashSecret(String(pin), pinSalt),
    question: String(question).trim(),
    answerSalt,
    answerHash: await hashSecret(normalizeAnswer(answer), answerSalt),
  };
}

export async function verifyPin(lock, pin) {
  return (await hashSecret(String(pin), lock.pinSalt)) === lock.pinHash;
}

export async function verifyAnswer(lock, answer) {
  return (await hashSecret(normalizeAnswer(answer), lock.answerSalt)) === lock.answerHash;
}
