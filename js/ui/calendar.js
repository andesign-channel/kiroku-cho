import * as store from '../store.js';
import { TYPES } from '../records.js';
import { monthGrid, summarizeMonth } from '../calendar.js';
import { filterRecords } from '../search.js';
import { toLocalInput } from '../fmt.js';
import { escapeHtml as e } from '../util.js';
import { h } from './dom.js';
import { recordItem } from './list.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const colorOf = Object.fromEntries(TYPES.map((t) => [t.id, t.color]));
// 別の画面から戻った時に同じ月・同じ日を開く
const state = { year: 0, month: 0, selected: '' };

export function renderCalendar(root, params, app) {
  const today = toLocalInput(new Date()).slice(0, 10);
  if (!state.year) {
    state.year = Number(today.slice(0, 4));
    state.month = Number(today.slice(5, 7));
    state.selected = today;
  }
  const page = h('<section class="calendar"></section>');

  function move(delta) {
    const date = new Date(state.year, state.month - 1 + delta, 1);
    state.year = date.getFullYear();
    state.month = date.getMonth() + 1;
    state.selected = '';
    draw();
  }

  function draw() {
    const summary = summarizeMonth(store.all(), state.year, state.month);
    const breakdown = TYPES.filter((t) => summary.byType[t.id])
      .map((t) => `<span class="tag" style="--c:${t.color}">${e(t.label)} ${summary.byType[t.id]}</span>`)
      .join('');
    const cells = monthGrid(state.year, state.month)
      .flat()
      .map((cell) => {
        if (!cell) return '<span class="cell empty"></span>';
        const entry = summary.byDate[cell.date];
        const classes = ['cell', cell.date === today ? 'today' : '', cell.date === state.selected ? 'selected' : ''].join(' ');
        const dots = (entry?.types ?? []).map((id) => `<i style="background:${colorOf[id]}"></i>`).join('');
        const label = `${cell.day}日${entry ? ` 記録${entry.count}件` : ''}`;
        return `<button type="button" class="${classes}" data-date="${cell.date}" aria-label="${label}">
          <span class="day">${cell.day}</span><span class="dots">${dots}</span>
        </button>`;
      })
      .join('');
    const dayRecords = state.selected ? filterRecords(store.all(), { from: state.selected, to: state.selected }).reverse() : [];

    page.innerHTML = `<div class="card">
        <div class="month">
          <button type="button" class="link" data-move="-1" aria-label="前の月">‹</button>
          <h1>${state.year}年${state.month}月</h1>
          <button type="button" class="link" data-move="1" aria-label="次の月">›</button>
        </div>
        <p class="summary">この月の記録 <strong>${summary.total}件</strong> ${breakdown}</p>
        <div class="grid">${WEEKDAYS.map((w) => `<span class="weekday">${w}</span>`).join('')}${cells}</div>
      </div>
      ${
        state.selected
          ? `<div class="day-panel">
              <h2>${Number(state.selected.slice(5, 7))}月${Number(state.selected.slice(8, 10))}日の記録（${dayRecords.length}件）</h2>
              <ul class="records"></ul>
              ${state.selected <= today ? '<button type="button" class="secondary" data-add>この日に記録する</button>' : ''}
            </div>`
          : ''
      }`;
    page.querySelector('.records')?.replaceChildren(...dayRecords.map(recordItem));
  }

  page.addEventListener('click', (event) => {
    const moveButton = event.target.closest('[data-move]');
    if (moveButton) return move(Number(moveButton.dataset.move));
    const cell = event.target.closest('[data-date]');
    if (cell) {
      state.selected = cell.dataset.date;
      return draw();
    }
    const item = event.target.closest('[data-id]');
    if (item) return app.nav('detail', { id: item.dataset.id });
    if (event.target.closest('[data-add]')) app.nav('form', { date: state.selected });
  });

  draw();
  root.append(page);
}
