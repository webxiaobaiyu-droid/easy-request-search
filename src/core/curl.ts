import type { CapturedRequest } from '../types/network'

/** Headers that only make sense browser-side or that curl flags would duplicate. */
const SKIPPED_HEADERS = ['content-length', 'host']

function relevantHeaders(request: CapturedRequest): { name: string; value: string }[] {
  return request.requestHeaders.filter(({ name }) => !SKIPPED_HEADERS.includes(name.toLowerCase()))
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

export function requestToCurl(request: CapturedRequest): string {
  const parts = [`curl ${shellQuote(request.url)}`]
  if (request.method !== 'GET') parts.push(`  -X ${request.method}`)

  relevantHeaders(request).forEach(({ name, value }) => parts.push(`  -H ${shellQuote(`${name}: ${value}`)}`))

  if (request.requestBody) parts.push(`  --data-raw ${shellQuote(request.requestBody)}`)
  return parts.join(' \\\n')
}

export function requestToFetch(request: CapturedRequest): string {
  const init: string[] = []
  if (request.method !== 'GET') init.push(`  method: '${request.method}',`)

  const headers = relevantHeaders(request)
  if (headers.length > 0) {
    const lines = headers.map(({ name, value }) => `    '${name}': '${value.replace(/'/g, "\\'")}',`)
    init.push(`  headers: {\n${lines.join('\n')}\n  },`)
  }

  if (request.requestBody) {
    const escaped = request.requestBody.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
    init.push(`  body: '${escaped}',`)
  }

  if (init.length === 0) return `fetch('${request.url}')`
  return `fetch('${request.url}', {\n${init.join('\n').replace(/,$/, '')}\n})`
}

export function requestToNodeAxios(request: CapturedRequest): string {
  const headers = relevantHeaders(request)
  const lines: string[] = [`const response = await axios({`]
  lines.push(`  url: ${JSON.stringify(request.url)},`)
  if (request.method !== 'GET') lines.push(`  method: '${request.method.toLowerCase()}',`)
  if (headers.length > 0) {
    lines.push('  headers: {')
    headers.forEach(({ name, value }) => lines.push(`    ${JSON.stringify(name)}: ${JSON.stringify(value)},`))
    lines.push('  },')
  }
  if (request.requestBody) {
    lines.push(`  data: ${JSON.stringify(request.requestBody)},`)
  }
  lines.push('})')
  return lines.join('\n')
}
