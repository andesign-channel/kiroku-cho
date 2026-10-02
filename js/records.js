export const TYPES = [
  { id: 'words', label: '言葉・態度', color: '#8273d9' },
  { id: 'body', label: '身体', color: '#e0637a' },
  { id: 'money', label: 'お金', color: '#d99a2b' },
  { id: 'affair', label: '不貞', color: '#3aa39b' },
  { id: 'child', label: '子ども', color: '#5a96de' },
];

// 修正履歴に写す項目。ここにない項目（id・記録日時など）は修正で変わらない
export const CONTENT_FIELDS = [
  'occurredAt',
  'timeUnknown',
  'types',
  'body',
  'quote',
  'place',
  'witnesses',
  'impact',
  'sawDoctor',
  'hasCertificate',
  'amount',
  'attachmentIds',
];

const OCCURRED_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const text = (value) => String(value ?? '').trim();
const hasAmount = (value) => value !== '' && value !== null && value !== undefined;

export function pickContent(record) {
  return Object.fromEntries(CONTENT_FIELDS.map((key) => [key, record[key]]));
}

export function validateInput(input) {
  const errors = [];
  if (!OCCURRED_PATTERN.test(text(input.occurredAt))) errors.push('起きた日時を入れてください');
  if (!(input.types ?? []).some((id) => TYPES.some((t) => t.id === id))) errors.push('種類を1つ以上選んでください');
  if (!text(input.body)) errors.push('何があったかを書いてください');
  if ((input.types ?? []).includes('money') && hasAmount(input.amount)) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push('金額は0以上の数字で入れてください');
  }
  return errors;
}

function normalize(input) {
  const types = TYPES.map((t) => t.id).filter((id) => (input.types ?? []).includes(id));
  const timeUnknown = Boolean(input.timeUnknown);
  const occurredAt = text(input.occurredAt);
  const isBody = types.includes('body');
  const isMoney = types.includes('money');
  return {
    occurredAt: timeUnknown ? occurredAt.slice(0, 10) : occurredAt,
    timeUnknown,
    types,
    body: text(input.body),
    quote: text(input.quote),
    place: text(input.place),
    witnesses: text(input.witnesses),
    impact: text(input.impact),
    sawDoctor: isBody && Boolean(input.sawDoctor),
    hasCertificate: isBody && Boolean(input.hasCertificate),
    amount: isMoney && hasAmount(input.amount) ? Number(input.amount) : null,
    attachmentIds: [...(input.attachmentIds ?? [])],
  };
}

export function createRecord(input, { now, id }) {
  const stamp = now.toISOString();
  return { id, ...normalize(input), createdAt: stamp, updatedAt: stamp, canceledAt: null, revisions: [] };
}

export function reviseRecord(record, input, { now }) {
  const next = normalize(input);
  // 添付は証拠なので外せない。追加分だけ足す
  next.attachmentIds = [...new Set([...record.attachmentIds, ...next.attachmentIds])];
  const before = pickContent(record);
  if (JSON.stringify(before) === JSON.stringify(pickContent(next))) return record;
  const stamp = now.toISOString();
  return { ...record, ...next, updatedAt: stamp, revisions: [...record.revisions, { revisedAt: stamp, before }] };
}

export function cancelRecord(record, { now }) {
  return { ...record, canceledAt: now.toISOString() };
}
