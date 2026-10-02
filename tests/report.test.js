import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportHtml } from '../js/report.js';

const T1 = '2026-10-02T13:00:00.000Z';
const T2 = '2026-10-03T13:00:00.000Z';
const rec = (id, occurredAt, over = {}) => ({
  id,
  occurredAt,
  timeUnknown: occurredAt.length === 10,
  types: ['words'],
  body: `本文${id}`,
  quote: '',
  place: '',
  witnesses: '',
  impact: '',
  sawDoctor: false,
  hasCertificate: false,
  amount: null,
  attachmentIds: [],
  createdAt: T1,
  updatedAt: T1,
  canceledAt: null,
  revisions: [],
  ...over,
});

const records = [
  rec('B', '2026-10-02T21:30', { types: ['words', 'money'], amount: 30000, quote: '<script>alert(1)</script>', attachmentIds: ['p1', 'v1'] }),
  rec('A', '2026-09-15', {
    body: '直した後の文面',
    updatedAt: T2,
    revisions: [{ revisedAt: T2, before: { body: '直す前の文面', quote: '', place: '', witnesses: '', impact: '', types: ['words'], occurredAt: '2026-09-15', timeUnknown: true } }],
  }),
  rec('C', '2026-10-05T08:00', { types: ['body'], sawDoctor: true, hasCertificate: true, canceledAt: T2 }),
  rec('D', '2026-08-01T08:00'),
];
const attachments = [
  { id: 'p1', recordId: 'B', name: 'あざ.jpg', mime: 'image/jpeg', size: 2048, addedAt: T1, fileModifiedAt: T1, sha256: 'aaa111' },
  { id: 'v1', recordId: 'B', name: '録音.m4a', mime: 'audio/mp4', size: 1258291, addedAt: T1, fileModifiedAt: T1, sha256: 'bbb222' },
];
const build = (over = {}) =>
  buildReportHtml({
    records,
    attachments,
    imageDataUrls: { p1: 'data:image/jpeg;base64,AAAA' },
    from: '2026-09-01',
    to: '2026-10-31',
    generatedAt: T2,
    includeCanceled: false,
    ...over,
  });

test('期間内の記録だけが古い順に並ぶ', () => {
  const html = build();
  assert.ok(html.indexOf('直した後の文面') < html.indexOf('本文B'));
  assert.ok(!html.includes('本文D'), '期間外は含まない');
});

test('表紙に件数・種類別・月別の件数が出る', () => {
  const html = build();
  assert.ok(html.includes('全2件'));
  assert.ok(html.includes('言葉・態度 2件'));
  assert.ok(html.includes('お金 1件'));
  assert.ok(html.includes('2026年9月 1件'));
  assert.ok(html.includes('2026年10月 1件'));
});

test('本文のHTMLはエスケープされる', () => {
  const html = build();
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('金額と修正履歴が出る', () => {
  const html = build();
  assert.ok(html.includes('30,000円'));
  assert.ok(html.includes('直す前の文面'));
  assert.ok(html.includes('修正'));
});

test('取り消し済みは指定した時だけ出る', () => {
  assert.ok(!build().includes('本文C'));
  const html = build({ includeCanceled: true });
  assert.ok(html.includes('本文C'));
  assert.ok(html.includes('取り消し済み'));
  assert.ok(html.includes('診断書あり'));
});

test('画像は埋め込み、添付はファイル名・サイズ・ハッシュ値が出る', () => {
  const html = build();
  assert.ok(html.includes('<img src="data:image/jpeg;base64,AAAA"'));
  assert.ok(html.includes('録音.m4a'));
  assert.ok(html.includes('1.2MB'));
  assert.ok(html.includes('bbb222'));
  assert.ok(html.includes('aaa111'));
});

test('外部への参照を含まない', () => {
  assert.ok(!/https?:\/\//.test(build()));
});
