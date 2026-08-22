export type ParameterSource = 'query' | 'body'

export interface HeaderEntry {
  name: string
  value: string
}

export interface ParameterEntry {
  source: ParameterSource
  path: string
  key: string
  value: string
  rawValue: unknown
}

export interface ResponseContent {
  content: string
  encoding: string
}

export interface CapturedRequest {
  id: string
  sequence: number
  startedAt: string
  timestamp: number
  method: string
  url: string
  displayUrl: string
  host: string
  pathname: string
  status: number
  statusText: string
  resourceType: string
  mimeType: string
  duration: number
  size: number
  requestHeaders: HeaderEntry[]
  responseHeaders: HeaderEntry[]
  requestBody: string
  requestBodyMime: string
  parameters: ParameterEntry[]
  queryParameters: ParameterEntry[]
  bodyParameters: ParameterEntry[]
  responseBody?: ResponseContent
  responseError?: string
}

export interface BridgeSnapshot {
  requests: CapturedRequest[]
  isRecording: boolean
  preserveLog: boolean
  maxEntries: number
}

export type BridgeEvent =
  | { type: 'request-added'; request: CapturedRequest }
  | { type: 'request-updated'; request: CapturedRequest }
  | { type: 'requests-cleared' }
  | { type: 'state-changed'; state: Pick<BridgeSnapshot, 'isRecording' | 'preserveLog'> }

export interface EasyRequestSearchBridge {
  getSnapshot: () => BridgeSnapshot
  subscribe: (listener: (event: BridgeEvent) => void) => () => void
  clear: () => void
  setRecording: (recording: boolean) => void
  setPreserveLog: (preserve: boolean) => void
  loadResponse: (id: string) => Promise<CapturedRequest>
}

export type FilterField =
  | 'any'
  | 'url'
  | 'method'
  | 'type'
  | 'status'
  | 'mime'
  | 'param'
  | 'paramKey'
  | 'paramValue'
  | 'query'
  | 'body'
  | 'header'
  | 'response'

export type FilterOperator = 'contains' | 'equals' | 'notEquals' | 'exists' | 'regex' | 'gt' | 'gte' | 'lt' | 'lte'

export interface FilterCondition {
  id: string
  field: FilterField
  operator: FilterOperator
  value: string
}

export interface FilterState {
  search: string
  /** Multi-line keyword list for batch (OR) search; empty when unused. */
  batchSearch?: string
  methods: string[]
  resourceTypes: string[]
  statusGroup: string
  conditions: FilterCondition[]
  conditionMode: 'all' | 'any'
}

declare global {
  interface Window {
    easyRequestSearchBridge?: EasyRequestSearchBridge
  }
}
