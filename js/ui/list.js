import * as store from '../store.js';
import { filterRecords } from '../search.js';
import { formatOccurred } from '../fmt.js';
import { escapeHtml as e } from '../util.js';
import { h, typeTags, typeChips, checkedValues } from './dom.js';

// 詳細から戻った時に絞り込みが消えないよう、画面をまたいで持つ
const filters = { keyword: '', types: [], from: '', to: '', includeCanceled: false };

export function recordItem(record) {
  const excerpt = record.body.length > 60 ? `${record.body.slice(0, 60)}…` : record.body;
  return h(`<li>
    <button type="button" class="item${record.canceledAt ? ' canceled' : ''}" data-id="${e(record.id)}">
      <span class="when">${e(formatOccurred(record))}${record.canceledAt ? '（取り消し済み）' : ''}</span>
      <span class="tags">${typeTags(record.types)}${record.attachmentIds.length ? `<span class="clip">添付${record.attachmentIds.length}</span>` : ''}</span>
      <span class="excerpt">${e(excerpt)}</span>
    </button>
  </li>`);
}

export function renderList(root, params, app) {
  const page = h(`<section>
    <div class="card filters">
      <h1>一覧</h1>
      <input type="search" name="keyword" placeholder="言葉でさがす（例：出ていけ）" value="${e(filters.keyword)}" aria-label="キーワード">
      <div class="chips">${typeChips('filterTypes', filters.types)}</div>
      <details${filters.from || filters.to || filters.includeCanceled ? ' open' : ''}>
        <summary>期間でしぼる</summary>
        <div class="row">
          <label>いつから<input type="date" name="from" value="${e(filters.from)}"></label>
          <label>いつまで<input type="date" name="to" value="${e(filters.to)}"></label>
        </div>
        <label class="check"><input type="checkbox" name="includeCanceled"${filters.includeCanceled ? ' checked' : ''}><span>取り消した記録も表示する</span></label>
      </details>
    </div>
    <p class="count"></p>
    <ul class="records"></ul>
  </section>`);
  const list = page.querySelector('.records');
  const count = page.querySelector('.count');

  function update() {
    filters.keyword = page.querySelector('[name="keyword"]').value;
    filters.types = checkedValues(page, 'filterTypes');
    filters.from = page.querySelector('[name="from"]').value;
    filters.to = page.querySelector('[name="to"]').value;
    filters.includeCanceled = page.querySelector('[name="includeCanceled"]').checked;

    const found = filterRecords(store.all(), filters);
    const total = store.all().filter((record) => !record.canceledAt).length;
    count.textContent = total === 0 ? 'まだ記録がありません。「記録する」から始められます。' : `${found.length}件`;
    list.replaceChildren(...found.map(recordItem));
  }

  page.addEventListener('input', update);
  list.addEventListener('click', (event) => {
    const item = event.target.closest('[data-id]');
    if (item) app.nav('detail', { id: item.dataset.id });
  });
  update();
  root.append(page);
}
