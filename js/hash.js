export async function sha256Hex(data) {
  let buffer = data;
  if (typeof data === 'string') buffer = new TextEncoder().encode(data);
  else if (data instanceof Blob) buffer = await data.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
