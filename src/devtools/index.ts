import { normalizeHarEntry } from '../core/normalize'
import type { BridgeEvent, CapturedRequest, EasyRequestSearchBridge } from '../types/network'

const MAX_ENTRIES = 1200
const requests: CapturedRequest[] = []
const rawRequests = new Map<string, chrome.devtools.network.Request>()
const listeners = new Set<(event: BridgeEvent) => void>()

let sequence = 0
let isRecording = true
let preserveLog = true

function notify(event: BridgeEvent): void {
  listeners.forEach((listener) => listener(event))
}

function clearRequests(): void {
  requests.splice(0, requests.length)
  rawRequests.clear()
  notify({ type: 'requests-cleared' })
}

function setRecording(recording: boolean): void {
  isRecording = recording
  notify({ type: 'state-changed', state: { isRecording, preserveLog } })
}

function setPreserveLog(preserve: boolean): void {
  preserveLog = preserve
  void chrome.storage.local.set({ preserveLog })
  notify({ type: 'state-changed', state: { isRecording, preserveLog } })
}

async function loadResponse(id: string): Promise<CapturedRequest> {
  const request = requests.find((item) => item.id === id)
  if (!request) throw new Error('请求记录已被清除')
  if (request.responseBody || request.responseError) return request

  const rawRequest = rawRequests.get(id)
  if (!rawRequest) {
    request.responseError = '响应正文已不可用'
    notify({ type: 'request-updated', request })
    return request
  }

  return new Promise((resolve) => {
    rawRequest.getContent((content, encoding) => {
      const runtimeError = chrome.runtime.lastError?.message
      if (runtimeError) {
        request.responseError = runtimeError
      } else {
        request.responseBody = { content: content ?? '', encoding: encoding ?? '' }
      }
      notify({ type: 'request-updated', request })
      resolve(request)
    })
  })
}

const bridge: EasyRequestSearchBridge = {
  getSnapshot: () => ({
    requests: [...requests],
    isRecording,
    preserveLog,
    maxEntries: MAX_ENTRIES,
  }),
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  clear: clearRequests,
  setRecording,
  setPreserveLog,
  loadResponse,
}

chrome.devtools.network.onRequestFinished.addListener((entry) => {
  if (!isRecording) return

  const request = normalizeHarEntry(entry, ++sequence)
  requests.push(request)
  rawRequests.set(request.id, entry)

  if (requests.length > MAX_ENTRIES) {
    const removed = requests.splice(0, requests.length - MAX_ENTRIES)
    removed.forEach((item) => rawRequests.delete(item.id))
  }

  notify({ type: 'request-added', request })
})

chrome.devtools.network.onNavigated.addListener(() => {
  if (!preserveLog) clearRequests()
})

void chrome.storage.local.get({ preserveLog: true }).then((stored) => {
  preserveLog = stored.preserveLog !== false
})

chrome.devtools.panels.create('EasyRequestSearch', 'icons/icon-32.png', 'panel.html', (panel) => {
  panel.onShown.addListener((panelWindow) => {
    panelWindow.easyRequestSearchBridge = bridge
    panelWindow.dispatchEvent(new CustomEvent('easyrequestsearch:bridge-ready'))
  })
})
