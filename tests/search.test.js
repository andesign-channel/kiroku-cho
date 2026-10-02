import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRecords } from '../js/search.js';

const rec = (id, occurredAt, types, fields = {}) => ({
  id,
  occurredAt,
  timeUnknown: occurredAt.length === 10,
  types,
  body: '',
  quote: '',
  place: '',
  witnesses: '',
  impact: '',
  canceledAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...fields,
});

const records = [
  rec('a', '2026-09-10T08:00', ['words'], { body: '朝から無視された', quote: 'Shut up と言われた' }),
  rec('b', '2026-09-20T22:00', ['money'], { body: '生活費を渡されなかった', place: '自宅' }),
  rec('c', '2026-10-01', ['words', 'child'], { body: '子どもの前で怒鳴られた', witnesses: '長男', impact: '頭痛' }),
  rec('d', '2026-10-01T19:00', ['body'], { body: '腕をつかまれた', canceledAt: '2026-10-02T00:00:00.000Z' }),
  rec('e', '2026-10-02T07:00', ['affair'], { body: 'レシートを見つけた', place: '車の中' }),
];
const ids = (list) => list.map((r) => r.id);

test('条件なしは取り消し済みを除いて新しい順', () => {
  assert.deepEqual(ids(filterRecords(records, {})), ['e', 'c', 'b', 'a']);
});

test('取り消し済みを含める指定ができる', () => {
  assert.deepEqual(ids(filterRecords(records, { includeCanceled: true })), ['e', 'd', 'c', 'b', 'a']);
});

test('キーワードは複数の項目を対象に部分一致する', () => {
  assert.deepEqual(ids(filterRecords(records, { keyword: '無視' })), ['a']);
  assert.deepEqual(ids(filterRecords(records, { keyword: '長男' })), ['c']);
  assert.deepEqual(ids(filterRecords(records, { keyword: '頭痛' })), ['c']);
  assert.deepEqual(ids(filterRecords(records, { keyword: '車' })), ['e']);
});

test('キーワードは大文字小文字を区別しない', () => {
  assert.deepEqual(ids(filterRecords(records, { keyword: 'shut UP' })), ['a']);
});

test('空白区切りのキーワードはすべて含むものだけ', () => {
  assert.deepEqual(ids(filterRecords(records, { keyword: '子ども　怒鳴' })), ['c']);
  assert.deepEqual(ids(filterRecords(records, { keyword: '子ども 生活費' })), []);
});

test('種類はどれか1つでも当たれば残す', () => {
  assert.deepEqual(ids(filterRecords(records, { types: ['child', 'money'] })), ['c', 'b']);
  assert.deepEqual(ids(filterRecords(records, { types: [] })), ['e', 'c', 'b', 'a']);
});

test('期間は両端の日を含む', () => {
  assert.deepEqual(ids(filterRecords(records, { from: '2026-09-20', to: '2026-10-01' })), ['c', 'b']);
  assert.deepEqual(ids(filterRecords(records, { from: '2026-10-02' })), ['e']);
  assert.deepEqual(ids(filterRecords(records, { to: '2026-09-10' })), ['a']);
});

test('元の配列を並べ替えない', () => {
  const before = ids(records);
  filterRecords(records, {});
  assert.deepEqual(ids(records), before);
});
