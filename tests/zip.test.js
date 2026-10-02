import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, buildZip, readZip } from '../js/zip.js';

const enc = (s) => new TextEncoder().encode(s);
const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

test('CRC32が既知の値と一致する', () => {
  assert.equal(crc32(enc('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('日本語の名前と空ファイルを含めて往復できる', async () => {
  const zip = await buildZip([
    { name: 'records.json', data: enc('{"a":1}') },
    { name: 'attachments/x1-録音 10月2日.m4a', data: new Blob([new Uint8Array([0, 1, 2, 255])]) },
    { name: 'empty.txt', data: new Uint8Array(0) },
  ]);
  const head = await bytes(zip.slice(0, 4));
  assert.deepEqual([...head], [0x50, 0x4b, 0x03, 0x04]);

  const entries = await readZip(zip);
  assert.deepEqual(entries.map((e) => e.name), ['records.json', 'attachments/x1-録音 10月2日.m4a', 'empty.txt']);
  assert.equal(new TextDecoder().decode(await bytes(entries[0].data)), '{"a":1}');
  assert.deepEqual([...(await bytes(entries[1].data))], [0, 1, 2, 255]);
  assert.equal(entries[2].data.size, 0);
});

test('ZIPでないデータはエラーになる', async () => {
  await assert.rejects(readZip(new Blob([enc('これはZIPではありません')])));
  await assert.rejects(readZip(new Blob([])));
});

test('無圧縮以外のZIPはエラーになる', async () => {
  const zip = await buildZip([{ name: 'a.txt', data: enc('hello') }]);
  const u8 = await bytes(zip);
  // 中央ディレクトリの圧縮方式（シグネチャから10バイト目）を deflate(8) に書き換える
  const cd = u8.findIndex((_, i) => u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x01 && u8[i + 3] === 0x02);
  u8[cd + 10] = 8;
  await assert.rejects(readZip(new Blob([u8])));
});
