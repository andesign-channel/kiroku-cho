import { TYPES } from './records.js';
import { filterRecords } from './search.js';
import { formatOccurred, formatIso, formatYen, formatSize } from './fmt.js';
import { escapeHtml as e } from './util.js';

const typeLabel = (id) => TYPES.find((t) => t.id === id)?.label ?? id;
const typeLabels = (ids) => (ids ?? []).map(typeLabel).join('／');
const dayLabel = (day) => (day ? formatOccurred({ occurredAt: day, timeUnknown: true }).replace(' 時刻不明', '') : '');

const STYLE = `
  body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; color: #222; line-height: 1.7; margin: 24px; font-size: 14px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  .cover { border-bottom: 2px solid #222; padding-bottom: 16px; margin-bottom: 24px; }
  .cover ul { margin: 4px 0 12px; padding-left: 20px; }
  .record { border: 1px solid #999; border-radius: 6px; padding: 14px 16px; margin-bottom: 16px; break-inside: avoid; }
  .record.canceled { background: #f3f3f3; }
  .tags { color: #555; font-size: 13px; }
  dl { margin: 8px 0 0; }
  dt { font-weight: bold; font-size: 12px; color: #555; margin-top: 8px; }
  dd { margin: 0; white-space: pre-wrap; word-break: break-word; }
  .quote { border-left: 4px solid #999; padding-left: 10px; }
  .meta { font-size: 12px; color: #555; margin-top: 10px; }
  .revisions { font-size: 12px; background: #fafafa; border: 1px dashed #aaa; padding: 8px 10px; margin-top: 10px; }
  .photo { max-width: 100%; max-height: 420px; display: block; margin: 8px 0 2px; }
  .file { font-size: 12px; word-break: break-all; margin-top: 6px; }
  @media print { body { margin: 0; } }
`;

function field(label, value, className = '') {
  if (value === '' || value === null || value === undefined) return '';
  return `<dt>${e(label)}</dt><dd${className ? ` class="${className}"` : ''}>${e(value)}</dd>`;
}

function contentFields(content) {
  const medical = [content.sawDoctor ? '受診した' : '', content.hasCertificate ? '診断書あり' : ''].filter(Boolean).join('・');
  return [
    field('何があったか', content.body),
    field('言われた言葉（そのまま）', content.quote, 'quote'),
    field('場所', content.place),
    field('その場にいた人', content.witnesses),
    field('心身への影響', content.impact),
    field('受診', medical),
    field('金額', content.amount === null || content.amount === undefined ? '' : formatYen(content.amount)),
  ].join('');
}

function revisionBlock(revision) {
  const before = revision.before;
  return `<div class="revisions"><strong>${e(formatIso(revision.revisedAt))} に修正</strong>（修正前の内容）
    <dl>${field('起きた日時', before.occurredAt ? formatOccurred(before) : '')}${field('種類', typeLabels(before.types))}${contentFields(before)}</dl></div>`;
}

function attachmentBlock(attachment, imageDataUrls) {
  const image = attachment.mime?.startsWith('image/') && imageDataUrls[attachment.id];
  return `${image ? `<img src="${e(image)}" class="photo" alt="${e(attachment.name)}">` : ''}
    <div class="file">添付: ${e(attachment.name)}（${e(formatSize(attachment.size))}）／登録 ${e(formatIso(attachment.addedAt))}／SHA-256 ${e(attachment.sha256)}</div>`;
}

function recordBlock(record, index, attachmentsById, imageDataUrls) {
  const attachments = record.attachmentIds.map((id) => attachmentsById.get(id)).filter(Boolean);
  return `<section class="record${record.canceledAt ? ' canceled' : ''}">
    <h2>${index + 1}. ${e(formatOccurred(record))}${record.canceledAt ? '（取り消し済み）' : ''}</h2>
    <div class="tags">種類: ${e(typeLabels(record.types))}</div>
    <dl>${contentFields(record)}</dl>
    ${attachments.map((attachment) => attachmentBlock(attachment, imageDataUrls)).join('')}
    <div class="meta">記録した日時: ${e(formatIso(record.createdAt))}${record.canceledAt ? `／取り消した日時: ${e(formatIso(record.canceledAt))}` : ''}</div>
    ${record.revisions.map(revisionBlock).join('')}
  </section>`;
}

export function buildReportHtml({ records, attachments, imageDataUrls = {}, from = '', to = '', generatedAt, includeCanceled = false }) {
  const picked = filterRecords(records, { from, to, includeCanceled }).reverse();
  const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]));

  const byType = TYPES.map((t) => [t.label, picked.filter((record) => record.types.includes(t.id)).length]).filter(([, n]) => n);
  const byMonth = new Map();
  for (const record of picked) {
    const [y, m] = record.occurredAt.split('-').map(Number);
    const key = `${y}年${m}月`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const period = from || to ? `${dayLabel(from) || '最初'} 〜 ${dayLabel(to) || '最新'}` : '全期間';

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>記録レポート</title>
<style>${STYLE}</style>
</head>
<body>
<header class="cover">
  <h1>記録レポート</h1>
  <div>対象期間: ${e(period)}</div>
  <div>作成日時: ${e(formatIso(generatedAt))}</div>
  <p><strong>全${picked.length}件</strong>${includeCanceled ? '（取り消し済みを含む）' : ''}</p>
  <div>種類別</div>
  <ul>${byType.map(([label, n]) => `<li>${e(label)} ${n}件</li>`).join('')}</ul>
  <div>月別</div>
  <ul>${[...byMonth].map(([label, n]) => `<li>${e(label)} ${n}件</li>`).join('')}</ul>
  <div class="meta">各記録には「起きた日時」と「記録した日時」を分けて記載しています。修正した記録は、修正前の内容と修正日時を残しています。添付ファイルのSHA-256は登録時点の値です。</div>
</header>
${picked.map((record, i) => recordBlock(record, i, attachmentsById, imageDataUrls)).join('\n')}
</body>
</html>`;
}
