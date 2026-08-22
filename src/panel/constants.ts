import type { FilterCondition, FilterField, FilterOperator } from '../types/network'
import type { TranslationKey } from './i18n'

export type DetailTab = 'overview' | 'params' | 'payload' | 'headers' | 'response'

export const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export const defaultTypeOptions = ['fetch', 'xhr', 'document', 'script', 'stylesheet', 'font', 'websocket', 'other']

export const statusOptions: { value: string; label: TranslationKey }[] = [
  { value: 'all', label: 'statusAll' },
  { value: 'pending', label: 'statusPending' },
  { value: 'failed', label: 'statusFailed' },
  { value: '200', label: 'status2xx' },
  { value: '300', label: 'status3xx' },
  { value: '400', label: 'status4xx' },
  { value: '500', label: 'status5xx' },
]

export const fieldOptions: { value: FilterField; label: TranslationKey }[] = [
  { value: 'any', label: 'fieldAny' },
  { value: 'url', label: 'fieldUrl' },
  { value: 'method', label: 'fieldMethod' },
  { value: 'type', label: 'fieldType' },
  { value: 'status', label: 'fieldStatus' },
  { value: 'mime', label: 'fieldMime' },
  { value: 'param', label: 'fieldParam' },
  { value: 'paramKey', label: 'fieldParamKey' },
  { value: 'paramValue', label: 'fieldParamValue' },
  { value: 'query', label: 'fieldQuery' },
  { value: 'body', label: 'fieldBody' },
  { value: 'header', label: 'fieldHeader' },
  { value: 'response', label: 'fieldResponse' },
]

export const operatorOptions: { value: FilterOperator; label: TranslationKey }[] = [
  { value: 'contains', label: 'opContains' },
  { value: 'equals', label: 'opEquals' },
  { value: 'notEquals', label: 'opNotEquals' },
  { value: 'exists', label: 'opExists' },
  { value: 'regex', label: 'opRegex' },
  { value: 'gt', label: 'opGt' },
  { value: 'gte', label: 'opGte' },
  { value: 'lt', label: 'opLt' },
  { value: 'lte', label: 'opLte' },
]

export const detailTabs: { value: DetailTab; label: TranslationKey }[] = [
  { value: 'overview', label: 'tabOverview' },
  { value: 'params', label: 'tabParams' },
  { value: 'payload', label: 'tabPayload' },
  { value: 'headers', label: 'tabHeaders' },
  { value: 'response', label: 'tabResponse' },
]

export const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization'])

export function createConditionId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createEmptyCondition(): FilterCondition {
  return { id: createConditionId(), field: 'param', operator: 'contains', value: '' }
}
