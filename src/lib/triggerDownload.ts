/** Extract a standalone ArrayBuffer from a Uint8Array (workaround for TS strictness with BlobPart/BodyInit). */
export function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

/**
 * Trigger a browser file download from in-memory data.
 */
export function triggerDownload(data: ArrayBuffer | Uint8Array | string, filename: string, mimeType = 'application/octet-stream'): void {
  const part = data instanceof Uint8Array ? toArrayBuffer(data) : data
  const blob = new Blob([part], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
