import { TYPES } from './records.js';
import { pad2 } from './fmt.js';

// 日曜始まりの月の升目。月の外の升は null
export function monthGrid(year, month) {
  const lead = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let day = 1; day <= days; day++) {
    cells.push({ date: `${year}-${pad2(month)}-${pad2(day)}`, day });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function summarizeMonth(records, year, month) {
  const prefix = `${year}-${pad2(month)}`;
  const byType = Object.fromEntries(TYPES.map((t) => [t.id, 0]));
  const byDate = {};
  let total = 0;
  for (const record of records) {
    if (record.canceledAt || !record.occurredAt.startsWith(prefix)) continue;
    total++;
    const date = record.occurredAt.slice(0, 10);
    const entry = (byDate[date] ??= { count: 0, types: new Set() });
    entry.count++;
    for (const id of record.types) {
      byType[id]++;
      entry.types.add(id);
    }
  }
  for (const entry of Object.values(byDate)) {
    entry.types = TYPES.map((t) => t.id).filter((id) => entry.types.has(id));
  }
  return { total, byType, byDate };
}
