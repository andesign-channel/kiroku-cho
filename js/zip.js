// 無圧縮（stored）だけを扱う最小限のZIP。写真や音声は元から圧縮済みなので縮める意味がなく、
// Blobを連結するだけにすれば、大きな添付を丸ごとメモリに複製せずに済む。

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const FLAG_UTF8 = 0x0800;
const MAX_SIZE = 0xffffffff;
const MAX_ENTRIES = 0xffff;
const INVALID = 'ZIPファイルとして読めません';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(u8) {
  let crc = 0xffffffff;
  for (let i = 0; i < u8.length; i++) crc = CRC_TABLE[(crc ^ u8[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export async function buildZip(entries, { date = new Date() } = {}) {
  if (entries.length > MAX_ENTRIES) throw new Error('ファイル数が多すぎます。期間を分けて書き出してください');
  const { time, day } = dosDateTime(date);
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const blob = entry.data instanceof Blob ? entry.data : new Blob([entry.data]);
    const size = blob.size;
    // CRCの計算のために1ファイルずつ読む（読み終えた分は解放される）
    const crc = crc32(new Uint8Array(await blob.arrayBuffer()));

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, SIG_LOCAL, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, FLAG_UTF8, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, SIG_CENTRAL, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 20, true);
    head.setUint16(8, FLAG_UTF8, true);
    head.setUint16(10, 0, true);
    head.setUint16(12, time, true);
    head.setUint16(14, day, true);
    head.setUint32(16, crc, true);
    head.setUint32(20, size, true);
    head.setUint32(24, size, true);
    head.setUint16(28, name.length, true);
    head.setUint32(42, offset, true);
    central.push(head.buffer, name);

    parts.push(local.buffer, name, blob);
    offset += 30 + name.length + size;
    if (offset > MAX_SIZE) throw new Error('全体が大きすぎます。期間を分けて書き出してください');
  }

  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
  if (offset + centralSize > MAX_SIZE) throw new Error('全体が大きすぎます。期間を分けて書き出してください');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, SIG_END, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

export async function readZip(blob) {
  if (blob.size < 22) throw new Error(INVALID);
  const tailStart = Math.max(0, blob.size - 65557);
  const tail = new DataView(await blob.slice(tailStart).arrayBuffer());
  let endAt = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_END) {
      endAt = i;
      break;
    }
  }
  if (endAt < 0) throw new Error(INVALID);

  const count = tail.getUint16(endAt + 10, true);
  const centralSize = tail.getUint32(endAt + 12, true);
  const centralOffset = tail.getUint32(endAt + 16, true);
  if (centralOffset + centralSize > blob.size) throw new Error(INVALID);

  const central = new DataView(await blob.slice(centralOffset, centralOffset + centralSize).arrayBuffer());
  const decoder = new TextDecoder();
  const entries = [];
  let pos = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > central.byteLength || central.getUint32(pos, true) !== SIG_CENTRAL) throw new Error(INVALID);
    if (central.getUint16(pos + 10, true) !== 0) throw new Error('圧縮されたZIPには対応していません');
    const size = central.getUint32(pos + 24, true);
    const nameLength = central.getUint16(pos + 28, true);
    const extraLength = central.getUint16(pos + 30, true);
    const commentLength = central.getUint16(pos + 32, true);
    const localOffset = central.getUint32(pos + 42, true);
    const name = decoder.decode(new Uint8Array(central.buffer, pos + 46, nameLength));

    if (localOffset + 30 > blob.size) throw new Error(INVALID);
    const local = new DataView(await blob.slice(localOffset, localOffset + 30).arrayBuffer());
    if (local.getUint32(0, true) !== SIG_LOCAL) throw new Error(INVALID);
    const dataStart = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    if (dataStart + size > blob.size) throw new Error(INVALID);

    entries.push({ name, data: blob.slice(dataStart, dataStart + size) });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
