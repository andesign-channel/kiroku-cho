import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocalInput, formatOccurred, formatIso, formatYen, formatSize } from '../js/fmt.js';
import { escapeHtml } from '../js/util.js';

test('起きた日時を曜日つきで整形する', () => {
  assert.equal(formatOccurred({ occurredAt: '2026-10-02T21:30', timeUnknown: false }), '2026年10月2日(金) 21:30');
});

test('時刻不明の日は「時刻不明」と出す', () => {
  assert.equal(formatOccurred({ occurredAt: '2026-10-01', timeUnknown: true }), '2026年10月1日(木) 時刻不明');
});

test('ISO日時を端末の現地時刻で整形する', () => {
  const iso = new Date(2026, 9, 2, 9, 5).toISOString();
  assert.equal(formatIso(iso), '2026年10月2日(金) 09:05');
});

test('入力欄用の現地時刻文字列を作る', () => {
  assert.equal(toLocalInput(new Date(2026, 0, 3, 4, 5)), '2026-01-03T04:05');
});

test('金額を桁区切りにする', () => {
  assert.equal(formatYen(12000), '12,000円');
  assert.equal(formatYen(0), '0円');
});

test('サイズに単位を付ける', () => {
  assert.equal(formatSize(512), '512B');
  assert.equal(formatSize(1536), '1.5KB');
  assert.equal(formatSize(1258291), '1.2MB');
});

test('HTMLの特殊文字をエスケープする', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
});
