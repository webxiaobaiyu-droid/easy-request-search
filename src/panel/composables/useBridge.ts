import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { applyEventBatch } from '../../core/events'
import type { BridgeEvent, CapturedRequest, EasyRequestSearchBridge } from '../../types/network'

const MAX_BUFFERED = 200

/** Panel-side retention cap; oldest entries are dropped once the list grows past it. */
export const MAX_PANEL_REQUESTS = 5000

export function useBridge(requests: Ref<CapturedRequest[]>, onCleared: () => void) {
  const isRecording = ref(true)
  const preserveLog = ref(true)
  const bridgeConnected = ref(false)

  let bridge: EasyRequestSearchBridge | undefined
  let unsubscribe: (() => void) | undefined
  let retryTimer: number | undefined
  let pending: BridgeEvent[] = []
  let rafId: number | undefined
  let working: CapturedRequest[] | null = null

  /** Applies buffered events as a single reactive write, once per animation frame. */
  function flush(): void {
    rafId = undefined
    if (pending.length === 0) return
    const events = pending
    pending = []
    if (working === null) working = [...requests.value]
    const { requests: updated, cleared } = applyEventBatch(working, events, MAX_PANEL_REQUESTS)
    working = null
    requests.value = updated
    if (cleared) onCleared()
  }

  function schedule(): void {
    // rAF is throttled while the DevTools panel page is hidden; the cap bounds the buffer.
    if (pending.length >= MAX_BUFFERED) flush()
    else if (rafId === undefined) rafId = requestAnimationFrame(flush)
  }

  function push(event: BridgeEvent): void {
    if (event.type === 'state-changed') {
      isRecording.value = event.state.isRecording
      preserveLog.value = event.state.preserveLog
      return
    }
    pending.push(event)
    schedule()
  }

  function connect(): boolean {
    if (window.easyRequestSearchBridge && bridge !== window.easyRequestSearchBridge) {
      bridge = window.easyRequestSearchBridge
      const snapshot = bridge.getSnapshot()
      requests.value =
        snapshot.requests.length > MAX_PANEL_REQUESTS
          ? snapshot.requests.slice(snapshot.requests.length - MAX_PANEL_REQUESTS)
          : snapshot.requests
      isRecording.value = snapshot.isRecording
      preserveLog.value = snapshot.preserveLog
      bridgeConnected.value = true
      unsubscribe?.()
      unsubscribe = bridge.subscribe(push)
      if (retryTimer !== undefined) {
        window.clearInterval(retryTimer)
        retryTimer = undefined
      }
    }
    // The DevTools page injects the bridge in panel.onShown, which may run after
    // this module evaluated (the bridge-ready event can be missed). Poll briefly.
    if (!bridge && retryTimer === undefined) {
      retryTimer = window.setInterval(() => {
        if (connect()) window.clearInterval(retryTimer)
      }, 100)
    }
    return Boolean(bridge)
  }

  function toggleRecording(): void {
    const next = !isRecording.value
    if (bridge) bridge.setRecording(next)
    else isRecording.value = next
  }

  function togglePreserveLog(): void {
    const next = !preserveLog.value
    if (bridge) bridge.setPreserveLog(next)
    else preserveLog.value = next
  }

  function clear(): void {
    if (bridge) bridge.clear()
    else {
      requests.value = []
      onCleared()
    }
  }

  /** Reads a response body lazily and applies the update synchronously — the user is waiting. */
  async function loadResponse(id: string): Promise<void> {
    if (!bridge) return
    const updated = await bridge.loadResponse(id)
    push({ type: 'request-updated', request: updated })
    flush()
  }

  onMounted(() => {
    window.addEventListener('easyrequestsearch:bridge-ready', connect)
  })

  onBeforeUnmount(() => {
    if (retryTimer !== undefined) window.clearInterval(retryTimer)
    unsubscribe?.()
    window.removeEventListener('easyrequestsearch:bridge-ready', connect)
    flush()
  })

  return { connect, toggleRecording, togglePreserveLog, clear, loadResponse, isRecording, preserveLog, bridgeConnected }
}
