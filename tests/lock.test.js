import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../js/hash.js';
import { validPin, makeLock, verifyPin, verifyAnswer } from '../js/lock.js';

test('SHA-256が既知の値と一致する', async () => {
  const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assert.equal(await sha256Hex('abc'), expected);
  assert.equal(await sha256Hex(new Blob(['abc'])), expected);
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), expected);
});

test('暗証番号は数字4〜8桁だけ', () => {
  assert.equal(validPin('1234'), true);
  assert.equal(validPin('12345678'), true);
  assert.equal(validPin('123'), false);
  assert.equal(validPin('123456789'), false);
  assert.equal(validPin('12a4'), false);
});

test('正しい暗証番号だけ通る', async () => {
  const lock = await makeLock({ pin: '4826', question: '最初に飼った犬の名前', answer: 'ポチ' });
  assert.equal(await verifyPin(lock, '4826'), true);
  assert.equal(await verifyPin(lock, '4827'), false);
  assert.equal(lock.question, '最初に飼った犬の名前');
  assert.ok(!JSON.stringify(lock).includes('4826'), '暗証番号そのものは保存しない');
  assert.ok(!JSON.stringify(lock).includes('ポチ'), '合言葉の答えそのものは保存しない');
});

test('同じ暗証番号でもソルトが違えばハッシュが違う', async () => {
  const a = await makeLock({ pin: '4826', question: 'q', answer: 'a' });
  const b = await makeLock({ pin: '4826', question: 'q', answer: 'a' });
  assert.notEqual(a.pinSalt, b.pinSalt);
  assert.notEqual(a.pinHash, b.pinHash);
});

test('合言葉は空白・全角半角・大文字小文字の違いを無視する', async () => {
  const lock = await makeLock({ pin: '4826', question: 'q', answer: 'Tokyo 2020' });
  assert.equal(await verifyAnswer(lock, '  tokyo 2020 '), true);
  assert.equal(await verifyAnswer(lock, 'ＴＯＫＹＯ　２０２０'), true);
  assert.equal(await verifyAnswer(lock, 'osaka'), false);
});
