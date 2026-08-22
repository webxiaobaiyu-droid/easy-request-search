interface DevToolsNetworkRequest {
  request: {
    method?: string
    url?: string
    headers?: Array<{ name: string; value: string }>
    postData?: { mimeType?: string; text?: string }
  }
  response: {
    status?: number
    statusText?: string
    headers?: Array<{ name: string; value: string }>
    content?: { mimeType?: string; size?: number }
    bodySize?: number
  }
  startedDateTime?: string
  time?: number
  type?: string
  _resourceType?: string
  getContent: (callback: (content: string, encoding: string) => void) => void
}

declare namespace chrome {
  namespace devtools {
    namespace network {
      const onRequestFinished: { addListener: (callback: (request: DevToolsNetworkRequest) => void) => void }
      const onNavigated: { addListener: (callback: (url: string) => void) => void }
      type Request = DevToolsNetworkRequest
    }
    namespace panels {
      interface PanelWindow extends Window {
        easyRequestSearchBridge?: import('./network').EasyRequestSearchBridge
      }
      interface Panel {
        onShown: { addListener: (callback: (window: PanelWindow) => void) => void }
      }
      const create: (
        title: string,
        iconPath: string,
        pagePath: string,
        callback: (panel: Panel) => void,
      ) => void
    }
  }
  namespace runtime {
    const lastError: { message?: string } | undefined
  }
  namespace storage {
    namespace local {
      const get: (keys?: Record<string, unknown>) => Promise<Record<string, any>>
      const set: (items: Record<string, unknown>) => Promise<void>
    }
  }
}
