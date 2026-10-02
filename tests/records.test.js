import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, validateInput, createRecord, reviseRecord, cancelRecord } from '../js/records.js';

const base = {
  occurredAt: '2026-10-02T21:30',
  timeUnknown: false,
  types: ['words'],
  body: '夕食の席で怒鳴られた',
  quote: '誰のおかげで飯が食えてると思ってるんだ',
  place: '自宅リビング',
  witnesses: '長女',
  impact: '眠れなかった',
  sawDoctor: true,
  hasCertificate: true,
  amount: 5000,
  attachmentIds: ['a1'],
};
const t1 = new Date('2026-10-02T13:00:00.000Z');
const t2 = new Date('2026-10-03T01:00:00.000Z');
const t3 = new Date('2026-10-04T01:00:00.000Z');

test('種類は5つで決まった順に並ぶ', () => {
  assert.deepEqual(TYPES.map((t) => t.id), ['words', 'body', 'money', 'affair', 'child']);
});

test('必須項目が欠けるとエラーになる', () => {
  assert.deepEqual(validateInput(base), []);
  assert.equal(validateInput({ ...base, occurredAt: '' }).length, 1);
  assert.equal(validateInput({ ...base, types: [] }).length, 1);
  assert.equal(validateInput({ ...base, body: '   ' }).length, 1);
  assert.equal(validateInput({ ...base, occurredAt: '', types: [], body: '' }).length, 3);
});

test('お金を選んだ時の金額は0以上の数字だけ通す', () => {
  assert.equal(validateInput({ ...base, types: ['money'], amount: 'abc' }).length, 1);
  assert.equal(validateInput({ ...base, types: ['money'], amount: -1 }).length, 1);
  assert.deepEqual(validateInput({ ...base, types: ['money'], amount: '' }), []);
});

test('作成時に記録日時と空の履歴が付く', () => {
  const r = createRecord(base, { now: t1, id: 'r1' });
  assert.equal(r.id, 'r1');
  assert.equal(r.createdAt, t1.toISOString());
  assert.equal(r.updatedAt, t1.toISOString());
  assert.equal(r.canceledAt, null);
  assert.deepEqual(r.revisions, []);
  assert.equal(r.body, '夕食の席で怒鳴られた');
});

test('選んでいない種類の専用項目は保存しない', () => {
  const r = createRecord(base, { now: t1, id: 'r1' });
  assert.equal(r.sawDoctor, false);
  assert.equal(r.hasCertificate, false);
  assert.equal(r.amount, null);
  const r2 = createRecord({ ...base, types: ['money', 'body'], amount: '5000' }, { now: t1, id: 'r2' });
  assert.equal(r2.sawDoctor, true);
  assert.equal(r2.amount, 5000);
  assert.deepEqual(r2.types, ['body', 'money']);
});

test('時刻不明の時は日付だけを持つ', () => {
  const r = createRecord({ ...base, timeUnknown: true }, { now: t1, id: 'r1' });
  assert.equal(r.occurredAt, '2026-10-02');
});

test('修正すると修正前の内容が履歴に残る', () => {
  const r = createRecord(base, { now: t1, id: 'r1' });
  const r2 = reviseRecord(r, { ...base, body: '夕食の席で怒鳴られ、皿を投げられた' }, { now: t2 });
  assert.equal(r2.body, '夕食の席で怒鳴られ、皿を投げられた');
  assert.equal(r2.createdAt, t1.toISOString());
  assert.equal(r2.updatedAt, t2.toISOString());
  assert.equal(r2.revisions.length, 1);
  assert.equal(r2.revisions[0].revisedAt, t2.toISOString());
  assert.equal(r2.revisions[0].before.body, '夕食の席で怒鳴られた');
  assert.equal(r2.revisions[0].before.quote, base.quote);
  assert.equal(r.revisions.length, 0, '元のオブジェクトは変えない');
});

test('内容が同じなら履歴は増えない', () => {
  const r = createRecord(base, { now: t1, id: 'r1' });
  assert.equal(reviseRecord(r, base, { now: t2 }), r);
});

test('2回修正すると履歴は2件になる', () => {
  const r = createRecord(base, { now: t1, id: 'r1' });
  const r2 = reviseRecord(r, { ...base, place: '台所' }, { now: t2 });
  const r3 = reviseRecord(r2, { ...base, place: '玄関' }, { now: t3 });
  assert.deepEqual(r3.revisions.map((v) => v.before.place), ['自宅リビング', '台所']);
});

test('添付は追加だけで、減らす入力は無視する', () => {
  const r = createRecord(base, { now: t1, id: 'r1' });
  const r2 = reviseRecord(r, { ...base, attachmentIds: ['a2'] }, { now: t2 });
  assert.deepEqual(r2.attachmentIds, ['a1', 'a2']);
  assert.deepEqual(r2.revisions[0].before.attachmentIds, ['a1']);
});

test('取り消しは日時を付けるだけで元を変えない', () => {
  const r = createRecord(base, { now: t1, id: 'r1' });
  const c = cancelRecord(r, { now: t2 });
  assert.equal(c.canceledAt, t2.toISOString());
  assert.equal(c.body, r.body);
  assert.equal(r.canceledAt, null);
});
