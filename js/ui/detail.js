import * as db from '../db.js';
import * as store from '../store.js';
import { cancelRecord } from '../records.js';
import { formatOccurred, formatIso, formatYen, formatSize } from '../fmt.js';
import { escapeHtml as e } from '../util.js';
import { h, toast, typeTags, saveFile } from './dom.js';

function row(label, value, className = '') {
  if (value === '' || value === null || value === undefined) return '';
  return `<dt>${e(label)}</dt><dd${className ? ` class="${className}"` : ''}>${e(value)}</dd>`;
}

function contentRows(content) {
  const medical = [content.sawDoctor ? '病院を受診した' : '', content.hasCertificate ? '診断書がある' : ''].filter(Boolean).join('・');
  return [
    row('何があったか', content.body),
    row('言われた言葉（そのまま）', content.quote, 'quote'),
    row('場所', content.place),
    row('その場にいた人', content.witnesses),
    row('心身への影響', content.impact),
    row('受診', medical),
    row('金額', content.amount === null || content.amount === undefined ? '' : formatYen(content.amount)),
  ].join('');
}

function attachmentItem(attachment, app) {
  const url = URL.createObjectURL(attachment.blob);
  app.onLeave(() => URL.revokeObjectURL(url));
  let preview = '';
  // 「ファイル」から選んだ録音は種類が空で届くことがあるので、拡張子でも判定する
  const isAudio = attachment.mime.startsWith('audio/') || /\.(m4a|mp3|wav|aac|caf)$/i.test(attachment.name);
  if (attachment.mime.startsWith('image/')) preview = `<img src="${url}" alt="${e(attachment.name)}">`;
  else if (isAudio) preview = `<audio controls preload="metadata" src="${url}"></audio>`;
  const item = h(`<li class="attachment">
    ${preview}
    <div class="file">${e(attachment.name)}（${e(formatSize(attachment.size))}）</div>
    <div class="hint">登録 ${e(formatIso(attachment.addedAt))}</div>
    <details><summary>照合用の値</summary><code>${e(attachment.sha256)}</code></details>
    <button type="button" class="secondary small">このファイルを保存・共有する</button>
  </li>`);
  item.querySelector('button').addEventListener('click', () => saveFile(attachment.blob, attachment.name));
  return item;
}

export function renderDetail(root, params, app) {
  const record = store.get(params.id);
  if (!record) return app.nav('list');

  const page = h(`<article class="card detail${record.canceledAt ? ' canceled' : ''}">
    <button type="button" class="link" data-back>‹ 一覧へもどる</button>
    <h1>${e(formatOccurred(record))}</h1>
    ${record.canceledAt ? `<p class="note">この記録は ${e(formatIso(record.canceledAt))} に取り消されました。</p>` : ''}
    <div class="tags">${typeTags(record.types)}</div>
    <dl>${contentRows(record)}</dl>
    <ul class="attachments"></ul>
    <p class="hint">記録した日時: ${e(formatIso(record.createdAt))}</p>
    ${record.revisions
      .map(
        (revision) => `<details class="revision">
          <summary>${e(formatIso(revision.revisedAt))} に修正（修正前を見る）</summary>
          <dl>${row('起きた日時', revision.before.occurredAt ? formatOccurred(revision.before) : '')}${contentRows(revision.before)}</dl>
        </details>`,
      )
      .join('')}
    ${
      record.canceledAt
        ? ''
        : `<div class="actions">
            <button type="button" class="primary" data-edit>修正する</button>
            <button type="button" class="secondary danger" data-cancel>この記録を取り消す</button>
          </div>`
    }
  </article>`);

  page.querySelector('[data-back]').addEventListener('click', () => app.nav('list'));
  page.querySelector('[data-edit]')?.addEventListener('click', () => app.nav('form', { editId: record.id }));
  page.querySelector('[data-cancel]')?.addEventListener('click', async () => {
    if (!confirm('この記録を取り消しますか？\n一覧やカレンダーには出なくなりますが、内容は残ります（元には戻せません）。')) return;
    await store.saveRecord(cancelRecord(record, { now: new Date() }));
    toast('取り消しました');
    app.nav('list');
  });

  const list = page.querySelector('.attachments');
  Promise.all(record.attachmentIds.map((id) => db.getAttachment(id))).then((attachments) => {
    list.replaceChildren(...attachments.filter(Boolean).map((attachment) => attachmentItem(attachment, app)));
  });

  root.append(page);
}
