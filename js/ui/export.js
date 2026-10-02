import * as db from '../db.js';
import * as store from '../store.js';
import { buildBackup, parseBackup, mergeRecords, selectForRange } from '../snapshot.js';
import { buildReportHtml } from '../report.js';
import { filterRecords } from '../search.js';
import { validPin, makeLock } from '../lock.js';
import { formatIso, formatSize } from '../fmt.js';
import { escapeHtml as e } from '../util.js';
import { h, toast, saveFile, stamp } from './dom.js';

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// ファイルを作るのに時間がかかると共有シートを開けなくなるため、
// 「作る」と「保存する」を別のボタンに分ける
function offerSave(slot, blob, filename, onSaved) {
  const box = h(`<div class="ready">
    <p>${e(filename)}（${e(formatSize(blob.size))}）ができました。</p>
    <button type="button" class="primary">保存する</button>
    <p class="hint">共有の画面で「ファイルに保存」を選ぶと、スマホの中やiCloudに保存できます。</p>
  </div>`);
  box.querySelector('button').addEventListener('click', async () => {
    if (await saveFile(blob, filename)) await onSaved?.();
  });
  slot.replaceChildren(box);
}

export function renderExport(root, params, app) {
  const page = h(`<section class="export">
    <div class="card" data-backup>
      <h1>バックアップ</h1>
      <p class="status"></p>
      <p>記録と添付ファイルをすべて1つのファイルにまとめます。スマホの故障や機種変更に備えて、こまめに取ってください。</p>
      <button type="button" class="primary" data-backup-all>すべてをバックアップする</button>
      <details>
        <summary>期間を指定して書き出す</summary>
        <p class="hint">添付が多くて全体では大きすぎる時や、一部だけ渡したい時に使います。</p>
        <div class="row">
          <label>いつから<input type="date" name="backupFrom"></label>
          <label>いつまで<input type="date" name="backupTo"></label>
        </div>
        <button type="button" class="secondary" data-backup-range>この期間を書き出す</button>
      </details>
      <div class="slot" data-backup-slot></div>
    </div>

    <div class="card" data-restore>
      <h2>バックアップから復元する</h2>
      <p>バックアップのファイルを選ぶと、中の記録を取り込みます。いまある記録は消えません。</p>
      <label class="filebtn">バックアップのファイルを選ぶ
        <input type="file" accept=".zip,application/zip" data-restore-file>
      </label>
    </div>

    <div class="card" data-report>
      <h2>弁護士さんに渡すレポート</h2>
      <p>記録を日付順に並べた1つのファイルを作ります。写真は中に入ります。音声は入らないので、必要な時はバックアップのファイルもいっしょに渡してください。</p>
      <div class="row">
        <label>いつから<input type="date" name="reportFrom"></label>
        <label>いつまで<input type="date" name="reportTo"></label>
      </div>
      <label class="check"><input type="checkbox" name="reportCanceled"><span>取り消した記録も載せる</span></label>
      <button type="button" class="primary" data-report-build>レポートを作る</button>
      <div class="slot" data-report-slot></div>
      <p class="hint">保存したファイルを開き、共有から「プリント」を選ぶとPDFにできます。</p>
    </div>

    <div class="card" data-lock>
      <h2>暗証番号</h2>
      <div class="slot" data-lock-slot></div>
    </div>

    <div class="card">
      <h2>使い方と注意</h2>
      <details>
        <summary>録音を入れるには</summary>
        <ol>
          <li>iPhoneの「ボイスメモ」で録音します（画面を消しても録音は続きます）</li>
          <li>録音を選び、「…」から「ファイルに保存」を選びます</li>
          <li>きろく帳の「記録する」で「音声・PDFなど」を押し、保存した録音を選びます</li>
        </ol>
      </details>
      <details>
        <summary>入れてよいもの・いけないもの</summary>
        <ul>
          <li>自分がその場にいた会話の録音、自分が受け取ったメッセージ、自分で撮った写真は入れて大丈夫です</li>
          <li>相手のスマホやアカウントを無断で開いて取ったものは入れないでください。法律に触れることがあり、ご自身が不利になります</li>
          <li>証拠として使えるかどうかは、最終的に弁護士さんに確認してください</li>
        </ul>
      </details>
      <details>
        <summary>記録が消える場合</summary>
        <ul>
          <li>ホーム画面の「きろく帳」を消すと、記録もすべて消えます</li>
          <li>スマホの故障・紛失・機種変更でも消えます</li>
          <li>ホーム画面に追加せずSafariで使うと、開かない間に自動で消えることがあります</li>
        </ul>
      </details>
      <details>
        <summary>身の危険を感じる時</summary>
        <p>記録よりも、避難と相談を優先してください。DV相談ナビ <a href="tel:%238008">#8008</a>／警察 <a href="tel:110">110</a></p>
      </details>
      <p class="hint" data-counts></p>
    </div>
  </section>`);

  const $ = (selector) => page.querySelector(selector);

  async function refreshStatus() {
    const state = await store.backupState();
    $('.status').textContent = state.lastBackupAt
      ? `最後のバックアップ: ${formatIso(state.lastBackupAt)}${state.changesSinceBackup ? `（そのあと ${state.changesSinceBackup}件の変更があります）` : ''}`
      : 'まだバックアップを取っていません。';
    const metas = await db.getAttachmentsMeta();
    const size = metas.reduce((sum, meta) => sum + meta.size, 0);
    $('[data-counts]').textContent = `記録 ${store.all().length}件／添付 ${metas.length}件（${formatSize(size)}）`;
  }

  async function runBackup(button, range) {
    const slot = $('[data-backup-slot]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'まとめています…';
    try {
      const all = { records: store.all(), attachments: await db.getAllAttachments() };
      const target = range ? selectForRange(all.records, all.attachments, range) : all;
      if (!target.records.length) return slot.replaceChildren(h('<p class="note">書き出す記録がありません。</p>'));
      const now = new Date();
      const blob = await buildBackup({ ...target, exportedAt: now.toISOString() });
      // 全体を保存できた時だけ「バックアップ済み」にする（期間指定は一部なので数えない）
      offerSave(slot, blob, `kirokucho-backup-${stamp(now)}.zip`, async () => {
        if (!range) {
          await store.markBackedUp(now);
          await app.refreshBars();
          await refreshStatus();
        }
        toast('保存しました');
      });
    } catch (err) {
      console.error(err);
      slot.replaceChildren(h(`<p class="error">${e(err.message || 'バックアップを作れませんでした')}</p>`));
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  $('[data-backup-all]').addEventListener('click', (event) => runBackup(event.currentTarget, null));
  $('[data-backup-range]').addEventListener('click', (event) => {
    const range = { from: $('[name="backupFrom"]').value, to: $('[name="backupTo"]').value };
    if (!range.from && !range.to) return toast('期間を入れてください');
    runBackup(event.currentTarget, range);
  });

  $('[data-restore-file]').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      // 読み取りがすべて通るまで、いまあるデータには触らない
      const incoming = await parseBackup(file);
      const message = `記録 ${incoming.records.length}件・添付 ${incoming.attachments.length}件を取り込みます。\nいまある記録は消えません。よろしいですか？`;
      if (!confirm(message)) return;
      const existingIds = new Set((await db.getAttachmentsMeta()).map((meta) => meta.id));
      const merged = mergeRecords(store.all(), incoming.records);
      await store.importAll(merged, incoming.attachments.filter((attachment) => !existingIds.has(attachment.id)));
      await refreshStatus();
      toast('取り込みました');
    } catch (err) {
      console.error(err);
      alert(`取り込めませんでした。いまある記録は変わっていません。\n（${err.message}）`);
    }
  });

  $('[data-report-build]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const slot = $('[data-report-slot]');
    button.disabled = true;
    button.textContent = '作っています…';
    try {
      const options = {
        from: $('[name="reportFrom"]').value,
        to: $('[name="reportTo"]').value,
        includeCanceled: $('[name="reportCanceled"]').checked,
      };
      const records = store.all();
      const targetIds = new Set(filterRecords(records, options).flatMap((record) => record.attachmentIds));
      if (!filterRecords(records, options).length) return slot.replaceChildren(h('<p class="note">この条件に当てはまる記録がありません。</p>'));
      const attachments = (await db.getAllAttachments()).filter((attachment) => targetIds.has(attachment.id));
      const imageDataUrls = {};
      for (const attachment of attachments) {
        if (attachment.mime.startsWith('image/')) imageDataUrls[attachment.id] = await readAsDataUrl(attachment.blob);
      }
      const now = new Date();
      const html = buildReportHtml({
        records,
        attachments: attachments.map(({ blob, ...meta }) => meta),
        imageDataUrls,
        ...options,
        generatedAt: now.toISOString(),
      });
      offerSave(slot, new Blob([html], { type: 'text/html' }), `kiroku-report-${stamp(now)}.html`, () => toast('保存しました'));
    } catch (err) {
      console.error(err);
      slot.replaceChildren(h('<p class="error">レポートを作れませんでした。期間を短くしてお試しください。</p>'));
    } finally {
      button.disabled = false;
      button.textContent = 'レポートを作る';
    }
  });

  async function drawLock() {
    const slot = $('[data-lock-slot]');
    const lock = await db.getMeta('lock');
    if (lock) {
      const box = h(`<div>
        <p>暗証番号を設定しています。アプリを開く時と、1分以上離れて戻った時に聞かれます。</p>
        <button type="button" class="secondary">暗証番号を解除する</button>
      </div>`);
      box.querySelector('button').addEventListener('click', async () => {
        if (!confirm('暗証番号を解除しますか？')) return;
        await db.setMeta('lock', null);
        toast('解除しました');
        drawLock();
      });
      return slot.replaceChildren(box);
    }
    const form = h(`<form novalidate>
      <p>開く時に暗証番号を聞くようにできます。のぞき見を防ぐためのもので、記録そのものを暗号化するものではありません。</p>
      <label>暗証番号（数字4〜8桁）
        <input type="password" inputmode="numeric" maxlength="8" name="pin" autocomplete="off">
      </label>
      <label>もう一度
        <input type="password" inputmode="numeric" maxlength="8" name="pin2" autocomplete="off">
      </label>
      <label>忘れた時の合言葉（質問）
        <input type="text" name="question" placeholder="最初に飼ったペットの名前 など" autocomplete="off">
      </label>
      <label>合言葉の答え
        <input type="text" name="answer" autocomplete="off">
      </label>
      <p class="error" hidden></p>
      <button type="submit" class="secondary">暗証番号を設定する</button>
    </form>`);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = form.querySelector('.error');
      const fail = (message) => {
        error.textContent = message;
        error.hidden = false;
      };
      if (!validPin(form.pin.value)) return fail('暗証番号は数字4〜8桁で入れてください');
      if (form.pin.value !== form.pin2.value) return fail('2回の暗証番号が一致していません');
      if (!form.question.value.trim() || !form.answer.value.trim()) return fail('忘れた時のために、合言葉の質問と答えを入れてください');
      await db.setMeta('lock', await makeLock({ pin: form.pin.value, question: form.question.value, answer: form.answer.value }));
      toast('暗証番号を設定しました');
      drawLock();
    });
    slot.replaceChildren(form);
  }

  refreshStatus();
  drawLock();
  root.append(page);
}
