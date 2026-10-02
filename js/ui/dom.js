import { TYPES } from '../records.js';
import { escapeHtml as e } from '../util.js';

export function h(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

let toastTimer = null;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// 共有シート（ファイルに保存など）を開く。使えない環境では通常のダウンロードにする。
// 保存先を選ばずに閉じた時だけ false を返す
export async function saveFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

export function typeTags(ids) {
  return TYPES.filter((t) => ids.includes(t.id))
    .map((t) => `<span class="tag" style="--c:${t.color}">${e(t.label)}</span>`)
    .join('');
}

export function typeChips(name, selected = []) {
  return TYPES.map(
    (t) => `<label class="chip" style="--c:${t.color}">
      <input type="checkbox" name="${name}" value="${t.id}"${selected.includes(t.id) ? ' checked' : ''}><span>${e(t.label)}</span>
    </label>`,
  ).join('');
}

export const checkedValues = (root, name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);

export function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}
