// メモリ上の記録一覧。画面はここを読み、保存はここを通す

import * as db from './db.js';

let records = [];
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export async function load() {
  records = await db.getAllRecords();
}

export const all = () => records;
export const get = (id) => records.find((record) => record.id === id);
export const onChange = (fn) => listeners.add(fn);

export async function saveRecord(record, attachments = []) {
  await db.putAll([record], attachments);
  records = [...records.filter((r) => r.id !== record.id), record];
  await db.setMeta('changesSinceBackup', ((await db.getMeta('changesSinceBackup')) ?? 0) + 1);
  notify();
}

// 復元用。突き合わせ済みの記録と、足りなかった添付をまとめて書く
export async function importAll(mergedRecords, newAttachments) {
  await db.putAll(mergedRecords, newAttachments);
  await load();
  notify();
}

export async function backupState() {
  const created = records.map((record) => record.createdAt).sort();
  return {
    lastBackupAt: (await db.getMeta('lastBackupAt')) ?? null,
    changesSinceBackup: (await db.getMeta('changesSinceBackup')) ?? 0,
    firstRecordAt: created[0] ?? null,
  };
}

export async function markBackedUp(now) {
  await db.setMeta('lastBackupAt', now.toISOString());
  await db.setMeta('changesSinceBackup', 0);
  notify();
}
