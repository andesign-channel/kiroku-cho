import * as store from '../store.js';
import { validateInput, createRecord, reviseRecord } from '../records.js';
import { sha256Hex } from '../hash.js';
import { toLocalInput, formatSize } from '../fmt.js';
import { escapeHtml as e, uuid } from '../util.js';
import { h, toast, typeChips, checkedValues } from './dom.js';

export function renderForm(root, params, app) {
  const editing = params.editId ? store.get(params.editId) : null;
  const nowLocal = toLocalInput(new Date());
  const initial = editing ?? {
    occurredAt: params.date ?? nowLocal,
    types: [],
    body: '',
    quote: '',
    place: '',
    witnesses: '',
    impact: '',
    sawDoctor: false,
    hasCertificate: false,
    amount: null,
    attachmentIds: [],
  };
  let pending = [];

  const form = h(`<form class="card form" novalidate>
    <h1>${editing ? '記録を修正する' : '記録する'}</h1>
    ${editing ? '<p class="note">修正する前の内容は、修正した日時といっしょに履歴に残ります。</p>' : ''}
    <div class="errors" hidden></div>

    <div class="row">
      <label>起きた日
        <input type="date" name="date" value="${e(initial.occurredAt.slice(0, 10))}" max="${nowLocal.slice(0, 10)}" required>
      </label>
      <label>時刻
        <input type="time" name="time" value="${e(initial.occurredAt.slice(11, 16))}">
      </label>
    </div>
    <p class="hint">時刻がわからない時は、時刻を空のままにしてください。</p>

    <fieldset>
      <legend>種類（いくつでも）</legend>
      <div class="chips">${typeChips('types', initial.types)}</div>
    </fieldset>

    <label>何があったか
      <textarea name="body" rows="5" placeholder="いつ・どこで・何をされたかを、見たまま書きます">${e(initial.body)}</textarea>
    </label>
    <label>言われた言葉（そのまま）
      <textarea name="quote" rows="3" placeholder="まとめずに、言われた通りの言葉で">${e(initial.quote)}</textarea>
    </label>
    <label>場所
      <input type="text" name="place" value="${e(initial.place)}" placeholder="自宅のリビング など">
    </label>
    <label>その場にいた人
      <input type="text" name="witnesses" value="${e(initial.witnesses)}" placeholder="子ども、義母 など">
    </label>
    <label>心身への影響
      <textarea name="impact" rows="2" placeholder="眠れなかった、あざができた など">${e(initial.impact)}</textarea>
    </label>

    <div class="only-body" hidden>
      <label class="check"><input type="checkbox" name="sawDoctor"${initial.sawDoctor ? ' checked' : ''}><span>病院を受診した</span></label>
      <label class="check"><input type="checkbox" name="hasCertificate"${initial.hasCertificate ? ' checked' : ''}><span>診断書がある</span></label>
    </div>
    <div class="only-money" hidden>
      <label>金額（円）
        <input type="number" name="amount" inputmode="numeric" min="0" step="1" value="${initial.amount ?? ''}">
      </label>
    </div>

    <fieldset>
      <legend>添付</legend>
      ${editing?.attachmentIds.length ? `<p class="hint">登録済みの添付 ${editing.attachmentIds.length}件はそのまま残ります（外せません）。</p>` : ''}
      <div class="row">
        <label class="filebtn">写真・スクショ
          <input type="file" accept="image/*" multiple data-files>
        </label>
        <label class="filebtn">音声・PDFなど
          <input type="file" multiple data-files>
        </label>
      </div>
      <ul class="pending"></ul>
      <p class="hint">写真や音声は加工せず、元のまま保存します。</p>
    </fieldset>

    <button class="primary" type="submit">${editing ? '修正を保存する' : '保存する'}</button>
    ${editing ? '<button class="secondary" type="button" data-cancel>やめる</button>' : ''}
  </form>`);

  const errorsBox = form.querySelector('.errors');
  const pendingList = form.querySelector('.pending');
  const submit = form.querySelector('button[type="submit"]');

  const read = () => ({
    occurredAt: form.time.value ? `${form.date.value}T${form.time.value}` : form.date.value,
    timeUnknown: !form.time.value,
    types: checkedValues(form, 'types'),
    body: form.body.value,
    quote: form.quote.value,
    place: form.place.value,
    witnesses: form.witnesses.value,
    impact: form.impact.value,
    sawDoctor: form.sawDoctor.checked,
    hasCertificate: form.hasCertificate.checked,
    amount: form.amount.value,
  });
  const snapshot = () => JSON.stringify(read());

  function toggleTypeFields() {
    const types = checkedValues(form, 'types');
    form.querySelector('.only-body').hidden = !types.includes('body');
    form.querySelector('.only-money').hidden = !types.includes('money');
  }

  function renderPending() {
    pendingList.replaceChildren(
      ...pending.map((file, i) => {
        const item = h(`<li><span>${e(file.name)}（${e(formatSize(file.size))}）</span><button type="button" class="link">外す</button></li>`);
        item.querySelector('button').addEventListener('click', () => {
          pending = pending.filter((_, index) => index !== i);
          renderPending();
        });
        return item;
      }),
    );
  }

  function showErrors(messages) {
    errorsBox.replaceChildren(...messages.map((message) => h(`<p>${e(message)}</p>`)));
    errorsBox.hidden = !messages.length;
    if (messages.length) errorsBox.scrollIntoView({ block: 'center' });
  }

  form.addEventListener('change', (event) => {
    if (event.target.name === 'types') toggleTypeFields();
    if (event.target.matches('[data-files]')) {
      pending = [...pending, ...event.target.files];
      event.target.value = '';
      renderPending();
    }
  });
  form.querySelector('[data-cancel]')?.addEventListener('click', () => app.nav('detail', { id: editing.id }));

  toggleTypeFields();
  const initialSnapshot = snapshot();
  let saved = false;
  app.setGuard(() => !saved && (snapshot() !== initialSnapshot || pending.length > 0));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = read();
    const errors = validateInput(input);
    if (errors.length) return showErrors(errors);
    showErrors([]);
    submit.disabled = true;
    submit.textContent = '保存しています…';

    const now = new Date();
    const recordId = editing?.id ?? uuid();
    const build = (attachmentIds) =>
      editing
        ? reviseRecord(editing, { ...input, attachmentIds }, { now })
        : createRecord({ ...input, attachmentIds }, { now, id: recordId });
    const finish = (message) => {
      saved = true;
      toast(message);
      app.nav('detail', { id: recordId });
    };

    try {
      const attachments = [];
      for (const file of pending) {
        attachments.push({
          id: uuid(),
          recordId,
          blob: file,
          name: file.name,
          mime: file.type,
          size: file.size,
          fileModifiedAt: new Date(file.lastModified).toISOString(),
          addedAt: now.toISOString(),
          sha256: await sha256Hex(file),
        });
      }
      const record = build(attachments.map((attachment) => attachment.id));
      if (record === editing) return finish('変更はありませんでした');
      try {
        await store.saveRecord(record, attachments);
        return finish('保存しました');
      } catch (err) {
        if (!attachments.length) throw err;
        // 容量不足などで添付が入らない時は、書いた文面だけでも先に残す
        const textOnly = build([]);
        if (textOnly === editing) throw err;
        await store.saveRecord(textOnly, []);
        alert('添付ファイルを保存できませんでした（スマホの空き容量が足りない可能性があります）。文章だけ保存しました。');
        return finish('文章だけ保存しました');
      }
    } catch (err) {
      console.error(err);
      showErrors(['保存できませんでした。入力した内容は残っています。もう一度お試しください。']);
      submit.disabled = false;
      submit.textContent = editing ? '修正を保存する' : '保存する';
    }
  });

  root.append(form);
}
