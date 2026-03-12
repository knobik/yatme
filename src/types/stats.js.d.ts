declare module 'stats.js' {
  class Stats {
    dom: HTMLDivElement
    begin(): void
    end(): void
    update(): void
    showPanel(id: number): void
  }
  export default Stats
}
