import { buildZip, readZip } from './zip.js';
import { filterRecords } from './search.js';
import { pickContent } from './records.js';

const APP_ID = 'kiroku-cho';
const BACKUP_VERSION = 1;
const MANIFEST_NAME = 'records.json';
const INVALID = 'きろく帳のバックアップファイルではありません';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const REMIND_AFTER_CHANGES = 10;

const safeName = (name) => String(name).replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_');

export async function buildBackup({ records, attachments, exportedAt }) {
  const metas = attachments.map(({ blob, ...meta }) => ({ ...meta, path: `attachments/${meta.id}-${safeName(meta.name)}` }));
  const manifest = { app: APP_ID, version: BACKUP_VERSION, exportedAt, records, attachments: metas };
  return buildZip([
    { name: MANIFEST_NAME, data: new TextEncoder().encode(JSON.stringify(manifest)) },
    ...attachments.map((attachment, i) => ({ name: metas[i].path, data: attachment.blob })),
  ]);
}

export async function parseBackup(zipBlob) {
  const entries = await readZip(zipBlob);
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  if (!byName.has(MANIFEST_NAME)) throw new Error(INVALID);

  let manifest;
  try {
    manifest = JSON.parse(await byName.get(MANIFEST_NAME).text());
  } catch {
    throw new Error(INVALID);
  }
  if (manifest?.app !== APP_ID || !Array.isArray(manifest.records) || !Array.isArray(manifest.attachments)) {
    throw new Error(INVALID);
  }

  const attachments = manifest.attachments.map(({ path, ...meta }) => {
    const data = byName.get(path);
    if (!data) throw new Error(`バックアップの中に添付ファイルが見つかりません（${meta.name}）`);
    return { ...meta, blob: data.slice(0, data.size, meta.mime || '') };
  });
  return { records: manifest.records, attachments };
}

const contentKey = (record) => JSON.stringify(pickContent(record));

export function mergeRecord(a, b) {
  const [winner, loser] = b.updatedAt > a.updatedAt ? [b, a] : [a, b];
  const seen = new Set();
  const revisions = [...a.revisions, ...b.revisions].filter((revision) => {
    const key = JSON.stringify(revision);
    return seen.has(key) ? false : seen.add(key);
  });

  // 別々に修正されていた時、負けた側の文面が履歴から漏れないようにする
  const loserContent = contentKey(loser);
  const kept = loserContent === contentKey(winner) || revisions.some((revision) => contentKey(revision.before) === loserContent);
  if (!kept) revisions.push({ revisedAt: winner.updatedAt, before: pickContent(loser) });
  revisions.sort((x, y) => (x.revisedAt < y.revisedAt ? -1 : x.revisedAt > y.revisedAt ? 1 : 0));

  const canceled = [a.canceledAt, b.canceledAt].filter(Boolean).sort();
  return {
    ...winner,
    attachmentIds: [...new Set([...winner.attachmentIds, ...loser.attachmentIds])],
    canceledAt: canceled[0] ?? null,
    revisions,
  };
}

export function mergeRecords(existing, incoming) {
  const byId = new Map(existing.map((record) => [record.id, record]));
  for (const record of incoming) {
    byId.set(record.id, byId.has(record.id) ? mergeRecord(byId.get(record.id), record) : record);
  }
  return [...byId.values()];
}

export function selectForRange(records, attachments, { from = '', to = '' } = {}) {
  const picked = filterRecords(records, { from, to, includeCanceled: true });
  const ids = new Set(picked.map((record) => record.id));
  return { records: picked, attachments: attachments.filter((attachment) => ids.has(attachment.recordId)) };
}

export function needsBackupReminder({ lastBackupAt, changesSinceBackup, firstRecordAt, now }) {
  if (!changesSinceBackup) return false;
  if (changesSinceBackup >= REMIND_AFTER_CHANGES) return true;
  const since = lastBackupAt ?? firstRecordAt;
  if (!since) return false;
  return now.getTime() - new Date(since).getTime() >= WEEK_MS;
}
