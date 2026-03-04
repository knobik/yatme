/**
 * Fetch a URL as ArrayBuffer with byte-level progress tracking.
 * Uses XMLHttpRequest because its `progress` event correctly reports
 * decompressed loaded/total bytes even for gzipped responses,
 * unlike fetch+ReadableStream where Content-Length reflects compressed size.
 */
export function fetchWithProgress(
  url: string,
  onProgress?: (fraction: number) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url)
    xhr.responseType = 'arraybuffer'

    if (onProgress) {
      xhr.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress(Math.min(e.loaded / e.total, 0.99))
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve(xhr.response as ArrayBuffer)
      } else {
        reject(new Error(`Failed to fetch ${url}: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error(`Network error fetching ${url}`))
    xhr.send()
  })
}

/**
 * Fetch a URL as text with byte-level progress tracking.
 */
export async function fetchTextWithProgress(
  url: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const buffer = await fetchWithProgress(url, onProgress)
  return new TextDecoder().decode(buffer)
}
