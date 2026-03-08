/** Yield to the browser event loop, allowing UI updates and input processing. */
export function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}
