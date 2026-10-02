import * as db from '../db.js';
import { h } from './dom.js';

export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

// 初回案内。ホーム画面への追加と、消える条件を必ず伝える
export function showOnboarding() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('overlay');
    const panel = h(`<div class="sheet onboarding">
      <h1>きろく帳へようこそ</h1>
      <p>あったことを、日時といっしょに残しておくための帳面です。記録はこのスマホの中だけに保存され、どこにも送信されません。</p>

      <h2>1. ホーム画面に追加して使ってください</h2>
      <ol>
        <li>Safariの下にある共有ボタン（四角から矢印が出ているマーク）を押します</li>
        <li>「ホーム画面に追加」を選びます</li>
        <li>ホーム画面にできた「きろく帳」から開きます</li>
      </ol>
      <p class="note">Safariのまま使うと、しばらく開かない間に記録が自動で消えることがあります。記録を始める前に、必ずホーム画面に追加してください。</p>

      <h2>2. 記録が消える場合があります</h2>
      <ul>
        <li>ホーム画面の「きろく帳」を消すと、記録もすべて消えます</li>
        <li>スマホの故障・紛失・機種変更でも消えます</li>
      </ul>
      <p class="note">消えた時の保険はバックアップだけです。「書き出し・設定」から、こまめにバックアップを取ってください。</p>

      <h2>3. 安全のために</h2>
      <ul>
        <li>相手にスマホを見られる可能性がある時は、「書き出し・設定」で暗証番号を設定してください</li>
        <li>身の危険を感じる時は、記録よりも避難と相談を優先してください（DV相談ナビ #8008／警察 110）</li>
      </ul>

      <button class="primary" type="button">はじめる</button>
    </div>`);
    panel.querySelector('button').addEventListener('click', async () => {
      await db.setMeta('onboarded', true);
      overlay.hidden = true;
      overlay.replaceChildren();
      resolve();
    });
    overlay.replaceChildren(panel);
    overlay.hidden = false;
    overlay.scrollTop = 0;
  });
}
