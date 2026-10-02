import * as db from './db.js';
import * as store from './store.js';
import { needsBackupReminder } from './snapshot.js';
import { h } from './ui/dom.js';
import { showLock } from './ui/lock.js';
import { showOnboarding, isStandalone } from './ui/onboarding.js';
import { renderForm } from './ui/form.js';
import { renderList } from './ui/list.js';
import { renderDetail } from './ui/detail.js';
import { renderCalendar } from './ui/calendar.js';
import { renderExport } from './ui/export.js';

const VIEWS = { form: renderForm, list: renderList, detail: renderDetail, calendar: renderCalendar, export: renderExport };
const TAB_OF = { form: 'form', list: 'list', detail: 'list', calendar: 'calendar', export: 'export' };
const RELOCK_AFTER_MS = 60 * 1000;

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
const bars = document.getElementById('bars');
let cleanups = [];
let guard = null;

const app = {
  nav,
  refreshBars,
  // 画面を離れる時に呼ぶ後始末（オブジェクトURLの解放など）
  onLeave: (fn) => cleanups.push(fn),
  // 入力中の画面が、離れてよいかを答える関数を登録する
  setGuard: (fn) => (guard = fn),
};

function nav(name, params = {}) {
  if (guard && guard() && !confirm('入力中の内容は保存されていません。このまま移動しますか？')) return;
  guard = null;
  cleanups.forEach((fn) => fn());
  cleanups = [];
  view.replaceChildren();
  for (const button of tabs.querySelectorAll('button')) {
    button.setAttribute('aria-current', button.dataset.tab === TAB_OF[name] ? 'page' : 'false');
  }
  VIEWS[name](view, params, app);
  window.scrollTo(0, 0);
}

async function refreshBars() {
  bars.replaceChildren();
  if (!isStandalone()) {
    const bar = h('<button class="bar" type="button">ホーム画面に追加して使ってください（やり方を見る）</button>');
    bar.addEventListener('click', () => showOnboarding());
    bars.append(bar);
  }
  if (needsBackupReminder({ ...(await store.backupState()), now: new Date() })) {
    const bar = h('<button class="bar warn" type="button">バックアップを取りましょう（書き出し・設定へ）</button>');
    bar.addEventListener('click', () => nav('export'));
    bars.append(bar);
  }
}

function watchRelock() {
  let hiddenAt = 0;
  let locking = false;
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (locking || !hiddenAt || Date.now() - hiddenAt < RELOCK_AFTER_MS) return;
    const lock = await db.getMeta('lock');
    if (!lock) return;
    locking = true;
    await showLock(lock);
    locking = false;
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // 開発中はキャッシュが邪魔になるので、手元では ?sw=1 を付けた時だけ登録する
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !location.search.includes('sw=1')) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function boot() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // 永続化を断られても動作は続ける（バックアップの催促で補う）
  }
  const lock = await db.getMeta('lock');
  if (lock) await showLock(lock);
  await store.load();
  if (!(await db.getMeta('onboarded'))) await showOnboarding();

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (button) nav(button.dataset.tab);
  });
  store.onChange(refreshBars);
  await refreshBars();
  nav('form');
  watchRelock();
  registerServiceWorker();
}

boot().catch((err) => {
  view.replaceChildren(h(`<p class="error">起動できませんでした。アプリを開き直してください。</p>`));
  console.error(err);
});
