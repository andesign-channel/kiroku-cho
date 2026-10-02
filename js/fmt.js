const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

// <input type="datetime-local"> にそのまま入れられる現地時刻
export function toLocalInput(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDatePart(y, m, d) {
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}年${m}月${d}日(${weekday})`;
}

export function formatOccurred({ occurredAt, timeUnknown }) {
  const [y, m, d] = occurredAt.slice(0, 10).split('-').map(Number);
  const time = occurredAt.slice(11, 16);
  return `${formatDatePart(y, m, d)} ${timeUnknown || !time ? '時刻不明' : time}`;
}

export function formatIso(iso) {
  const date = new Date(iso);
  return `${formatDatePart(date.getFullYear(), date.getMonth() + 1, date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatYen(amount) {
  return `${Number(amount).toLocaleString('ja-JP')}円`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
