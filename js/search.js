const SEARCH_FIELDS = ['body', 'quote', 'place', 'witnesses', 'impact'];

export function filterRecords(records, { keyword = '', types = [], from = '', to = '', includeCanceled = false } = {}) {
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  return records
    .filter((record) => {
      if (!includeCanceled && record.canceledAt) return false;
      const day = record.occurredAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (types.length && !types.some((id) => record.types.includes(id))) return false;
      if (!words.length) return true;
      const haystack = SEARCH_FIELDS.map((key) => record[key] ?? '').join('\n').toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => {
      if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
      return (a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1;
    });
}
