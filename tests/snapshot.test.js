import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildZip } from '../js/zip.js';
import {
  buildBackup,
  parseBackup,
  mergeRecord,
  mergeRecords,
  selectForRange,
  needsBackupReminder,
} from '../js/snapshot.js';

const enc = (s) => new TextEncoder().encode(s);
const content = {
  occurredAt: '2026-10-02T21:30',
  timeUnknown: false,
  types: ['words'],
  body: '最初の文面',
  quote: '',
  place: '',
  witnesses: '',
  impact: '',
  sawDoctor: false,
  hasCertificate: false,
  amount: null,
  attachmentIds: ['a1'],
};
const T1 = '2026-10-02T13:00:00.000Z';
const T2 = '2026-10-03T13:00:00.000Z';
const T3 = '2026-10-04T13:00:00.000Z';
const rec = (over = {}) => ({ id: 'r1', ...content, createdAt: T1, updatedAt: T1, canceledAt: null, revisions: [], ...over });
const att = (over = {}) => ({
  id: 'a1',
  recordId: 'r1',
  name: '録音/10月2日.m4a',
  mime: 'audio/mp4',
  size: 4,
  fileModifiedAt: T1,
  addedAt: T1,
  sha256: 'abc',
  blob: new Blob([new Uint8Array([9, 8, 7, 6])], { type: 'audio/mp4' }),
  ...over,
});

test('記録と添付をバックアップして元に戻せる', async () => {
  const zip = await buildBackup({ records: [rec()], attachments: [att()], exportedAt: T2 });
  const back = await parseBackup(zip);
  assert.deepEqual(back.records, [rec()]);
  assert.equal(back.attachments.length, 1);
  const { blob, ...meta } = back.attachments[0];
  const { blob: _b, ...expected } = att();
  assert.deepEqual(meta, expected);
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [9, 8, 7, 6]);
  assert.equal(blob.type, 'audio/mp4');
});

test('別のアプリのZIPや形式違いは受け付けない', async () => {
  const other = await buildZip([{ name: 'records.json', data: enc(JSON.stringify({ app: 'other', records: [] })) }]);
  await assert.rejects(parseBackup(other));
  const noManifest = await buildZip([{ name: 'x.txt', data: enc('x') }]);
  await assert.rejects(parseBackup(noManifest));
  const broken = await buildZip([{ name: 'records.json', data: enc('{こわれたJSON') }]);
  await assert.rejects(parseBackup(broken));
});

test('添付ファイルが欠けているバックアップは受け付けない', async () => {
  const manifest = {
    app: 'kiroku-cho',
    version: 1,
    exportedAt: T2,
    records: [rec()],
    attachments: [{ id: 'a1', recordId: 'r1', name: 'x.m4a', mime: 'audio/mp4', size: 4, path: 'attachments/a1-x.m4a' }],
  };
  const zip = await buildZip([{ name: 'records.json', data: enc(JSON.stringify(manifest)) }]);
  await assert.rejects(parseBackup(zip));
});

test('突き合わせは新しい方の内容を採り、履歴は両方を合わせる', () => {
  const older = rec();
  const newer = rec({
    body: '直した文面',
    updatedAt: T2,
    revisions: [{ revisedAt: T2, before: { ...content } }],
  });
  for (const merged of [mergeRecord(older, newer), mergeRecord(newer, older)]) {
    assert.equal(merged.body, '直した文面');
    assert.equal(merged.updatedAt, T2);
    assert.equal(merged.revisions.length, 1, '同じ履歴は重複させない');
  }
});

test('別々に修正された記録は、負けた側の文面も履歴に残す', () => {
  const a = rec({ body: 'Aで直した', updatedAt: T2, revisions: [{ revisedAt: T2, before: { ...content } }] });
  const b = rec({ body: 'Bで直した', updatedAt: T3, revisions: [{ revisedAt: T3, before: { ...content } }] });
  const merged = mergeRecord(a, b);
  assert.equal(merged.body, 'Bで直した');
  const befores = merged.revisions.map((v) => v.before.body);
  assert.ok(befores.includes('最初の文面'));
  assert.ok(befores.includes('Aで直した'));
  const times = merged.revisions.map((v) => v.revisedAt);
  assert.deepEqual(times, [...times].sort());
});

test('取り消しと添付はどちらかにあれば残す', () => {
  const a = rec({ canceledAt: T2, attachmentIds: ['a1'] });
  const b = rec({ updatedAt: T3, attachmentIds: ['a2'], body: '直した', revisions: [{ revisedAt: T3, before: { ...content } }] });
  const merged = mergeRecord(a, b);
  assert.equal(merged.canceledAt, T2);
  assert.deepEqual([...merged.attachmentIds].sort(), ['a1', 'a2']);
});

test('片方にしかない記録はそのまま残る', () => {
  const merged = mergeRecords([rec({ id: 'r1' }), rec({ id: 'r2' })], [rec({ id: 'r2' }), rec({ id: 'r3' })]);
  assert.deepEqual(merged.map((r) => r.id).sort(), ['r1', 'r2', 'r3']);
});

test('期間指定は取り消し済みも含め、その記録の添付だけ選ぶ', () => {
  const records = [
    rec({ id: 'r1', occurredAt: '2026-09-10T10:00' }),
    rec({ id: 'r2', occurredAt: '2026-10-02T10:00', canceledAt: T3 }),
  ];
  const attachments = [att({ id: 'a1', recordId: 'r1' }), att({ id: 'a2', recordId: 'r2' })];
  const picked = selectForRange(records, attachments, { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(picked.records.map((r) => r.id), ['r2']);
  assert.deepEqual(picked.attachments.map((a) => a.id), ['a2']);
});

test('バックアップの催促', () => {
  const now = new Date('2026-10-20T00:00:00.000Z');
  const day = (n) => new Date(now.getTime() - n * 86400000).toISOString();
  assert.equal(needsBackupReminder({ lastBackupAt: day(30), changesSinceBackup: 0, firstRecordAt: day(40), now }), false, '変更がなければ出さない');
  assert.equal(needsBackupReminder({ lastBackupAt: day(6), changesSinceBackup: 3, firstRecordAt: day(40), now }), false);
  assert.equal(needsBackupReminder({ lastBackupAt: day(7), changesSinceBackup: 1, firstRecordAt: day(40), now }), true);
  assert.equal(needsBackupReminder({ lastBackupAt: day(1), changesSinceBackup: 10, firstRecordAt: day(40), now }), true, '10件で即');
  assert.equal(needsBackupReminder({ lastBackupAt: null, changesSinceBackup: 2, firstRecordAt: day(8), now }), true, '未バックアップは最初の記録日から数える');
  assert.equal(needsBackupReminder({ lastBackupAt: null, changesSinceBackup: 2, firstRecordAt: day(2), now }), false);
  assert.equal(needsBackupReminder({ lastBackupAt: null, changesSinceBackup: 0, firstRecordAt: null, now }), false);
});
