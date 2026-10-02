import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, summarizeMonth } from '../js/calendar.js';

test('2026年10月は木曜始まりで先頭に空きが4つ', () => {
  const grid = monthGrid(2026, 10);
  assert.deepEqual(grid[0].slice(0, 4), [null, null, null, null]);
  assert.deepEqual(grid[0][4], { date: '2026-10-01', day: 1 });
  assert.ok(grid.every((week) => week.length === 7));
  const days = grid.flat().filter(Boolean);
  assert.equal(days.length, 31);
  assert.equal(days.at(-1).date, '2026-10-31');
});

test('うるう年の2月は29日まで', () => {
  assert.equal(monthGrid(2028, 2).flat().filter(Boolean).length, 29);
  assert.equal(monthGrid(2026, 2).flat().filter(Boolean).length, 28);
});

const rec = (occurredAt, types, canceledAt = null) => ({ occurredAt, types, canceledAt });

test('月の件数を日別・種類別に数える', () => {
  const s = summarizeMonth(
    [
      rec('2026-10-01T08:00', ['words']),
      rec('2026-10-01', ['child', 'words']),
      rec('2026-10-15T20:00', ['money']),
      rec('2026-10-15T21:00', ['body'], '2026-10-16T00:00:00.000Z'),
      rec('2026-09-30T23:59', ['affair']),
      rec('2026-11-01T00:00', ['affair']),
    ],
    2026,
    10,
  );
  assert.equal(s.total, 3);
  assert.deepEqual(s.byType, { words: 2, body: 0, money: 1, affair: 0, child: 1 });
  assert.deepEqual(s.byDate['2026-10-01'], { count: 2, types: ['words', 'child'] });
  assert.deepEqual(s.byDate['2026-10-15'], { count: 1, types: ['money'] });
  assert.equal(Object.keys(s.byDate).length, 2);
});
