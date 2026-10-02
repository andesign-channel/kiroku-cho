import * as db from '../db.js';
import { verifyPin, verifyAnswer } from '../lock.js';
import { escapeHtml as e } from '../util.js';
import { h, toast } from './dom.js';

// 暗証番号が合うまで画面を覆う。開いたら解決する
export function showLock(lock) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('overlay');
    const panel = h(`<div class="sheet lock">
      <h1>きろく帳</h1>
      <form class="pin-form">
        <label>暗証番号
          <input type="password" inputmode="numeric" autocomplete="off" maxlength="8" name="pin" required>
        </label>
        <p class="error" hidden>暗証番号が違います</p>
        <button class="primary" type="submit">ひらく</button>
        <button class="link" type="button" data-forgot>暗証番号を忘れた時</button>
      </form>
      <form class="answer-form" hidden>
        <p>合言葉の質問：<strong>${e(lock.question)}</strong></p>
        <label>答え
          <input type="text" autocomplete="off" name="answer" required>
        </label>
        <p class="error" hidden>答えが違います</p>
        <button class="primary" type="submit">暗証番号を解除する</button>
        <button class="link" type="button" data-back>もどる</button>
      </form>
    </div>`);
    const pinForm = panel.querySelector('.pin-form');
    const answerForm = panel.querySelector('.answer-form');
    const done = () => {
      overlay.hidden = true;
      overlay.replaceChildren();
      resolve();
    };

    pinForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (await verifyPin(lock, pinForm.pin.value)) return done();
      pinForm.querySelector('.error').hidden = false;
      pinForm.pin.value = '';
    });
    panel.querySelector('[data-forgot]').addEventListener('click', () => {
      pinForm.hidden = true;
      answerForm.hidden = false;
    });
    panel.querySelector('[data-back]').addEventListener('click', () => {
      pinForm.hidden = false;
      answerForm.hidden = true;
    });
    answerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!(await verifyAnswer(lock, answerForm.answer.value))) {
        answerForm.querySelector('.error').hidden = false;
        return;
      }
      await db.setMeta('lock', null);
      done();
      toast('暗証番号を解除しました。「書き出し・設定」から設定し直せます');
    });

    overlay.replaceChildren(panel);
    overlay.hidden = false;
    pinForm.pin.focus();
  });
}
