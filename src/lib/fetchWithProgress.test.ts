// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithProgress, fetchTextWithProgress } from './fetchWithProgress'

class MockXHR {
  static instances: MockXHR[] = []

  method = ''
  url = ''
  responseType = ''
  status = 200
  response: ArrayBuffer | null = null

  onprogress: ((e: Partial<ProgressEvent>) => void) | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  send() {
    MockXHR.instances.push(this)
  }

  // Test helpers
  simulateProgress(loaded: number, total: number, lengthComputable = true) {
    this.onprogress?.({ loaded, total, lengthComputable } as Partial<ProgressEvent>)
  }

  simulateSuccess(data: ArrayBuffer) {
    this.status = 200
    this.response = data
    this.onload?.()
  }

  simulateError() {
    this.onerror?.()
  }

  simulateHttpError(status: number) {
    this.status = status
    this.response = null
    this.onload?.()
  }
}

beforeEach(() => {
  MockXHR.instances = []
  vi.stubGlobal('XMLHttpRequest', MockXHR)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchWithProgress', () => {
  it('successful fetch returns ArrayBuffer', async () => {
    const data = new ArrayBuffer(8)
    const promise = fetchWithProgress('http://example.com/file')
    const xhr = MockXHR.instances[0]
    xhr.simulateSuccess(data)

    const result = await promise
    expect(result).toBe(data)
  })

  it('HTTP error rejects with message containing URL and status', async () => {
    const promise = fetchWithProgress('http://example.com/missing')
    const xhr = MockXHR.instances[0]
    xhr.simulateHttpError(404)

    await expect(promise).rejects.toThrow('Failed to fetch http://example.com/missing: 404')
  })

  it('network error rejects with "Network error" message', async () => {
    const promise = fetchWithProgress('http://example.com/file')
    const xhr = MockXHR.instances[0]
    xhr.simulateError()

    await expect(promise).rejects.toThrow('Network error fetching http://example.com/file')
  })

  it('progress callback invoked with fraction', async () => {
    const onProgress = vi.fn()
    const promise = fetchWithProgress('http://example.com/file', onProgress)
    const xhr = MockXHR.instances[0]

    xhr.simulateProgress(50, 100)
    expect(onProgress).toHaveBeenCalledWith(0.5)

    xhr.simulateProgress(75, 100)
    expect(onProgress).toHaveBeenCalledWith(0.75)

    xhr.simulateSuccess(new ArrayBuffer(0))
    await promise
  })

  it('progress is capped at 0.99 before completion', async () => {
    const onProgress = vi.fn()
    const promise = fetchWithProgress('http://example.com/file', onProgress)
    const xhr = MockXHR.instances[0]

    xhr.simulateProgress(100, 100)
    expect(onProgress).toHaveBeenCalledWith(0.99)

    xhr.simulateSuccess(new ArrayBuffer(0))
    await promise
  })

  it('progress reports 1.0 on successful completion', async () => {
    const onProgress = vi.fn()
    const promise = fetchWithProgress('http://example.com/file', onProgress)
    const xhr = MockXHR.instances[0]

    xhr.simulateSuccess(new ArrayBuffer(0))
    await promise

    expect(onProgress).toHaveBeenCalledWith(1)
  })

  it('works without progress callback', async () => {
    const promise = fetchWithProgress('http://example.com/file')
    const xhr = MockXHR.instances[0]
    xhr.simulateSuccess(new ArrayBuffer(4))

    await expect(promise).resolves.toBeInstanceOf(ArrayBuffer)
  })

  it('sets responseType to arraybuffer', () => {
    fetchWithProgress('http://example.com/file')
    const xhr = MockXHR.instances[0]
    expect(xhr.responseType).toBe('arraybuffer')
  })

  it('progress not reported when lengthComputable is false', async () => {
    const onProgress = vi.fn()
    const promise = fetchWithProgress('http://example.com/file', onProgress)
    const xhr = MockXHR.instances[0]

    xhr.simulateProgress(50, 100, false)
    expect(onProgress).not.toHaveBeenCalled()

    xhr.simulateSuccess(new ArrayBuffer(0))
    await promise
    // Only the completion call (1.0) should have been made
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(1)
  })
})

describe('fetchTextWithProgress', () => {
  it('returns decoded string from ArrayBuffer', async () => {
    const text = 'Hello, world!'
    const encoded = new TextEncoder().encode(text).buffer
    const promise = fetchTextWithProgress('http://example.com/text')
    const xhr = MockXHR.instances[0]
    xhr.simulateSuccess(encoded as ArrayBuffer)

    const result = await promise
    expect(result).toBe(text)
  })
})
