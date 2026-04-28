declare global {
  interface Window {
    pannellum?: {
      viewer: (container: HTMLElement, config: Record<string, unknown>) => {
        destroy?: () => void
      }
    }
  }
}

export {}

