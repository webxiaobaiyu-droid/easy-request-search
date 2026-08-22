import { describe, expect, it } from 'vitest'
import { parseBodyParameters, parseQueryParameters } from '../src/core/body-parser'

describe('request parameter parsing', () => {
  it('flattens JSON objects and arrays into searchable paths', () => {
    const parameters = parseBodyParameters(
      '{"user":{"id":42,"roles":["admin","reviewer"]},"enabled":true}',
      'application/json',
    )
    expect(parameters.map((item) => item.path)).toEqual(['user.id', 'user.roles[0]', 'user.roles[1]', 'enabled'])
    expect(parameters.find((item) => item.path === 'user.roles[1]')?.value).toBe('reviewer')
  })

  it('parses urlencoded body and query strings', () => {
    const body = parseBodyParameters('q=scope&q=network&empty=', 'application/x-www-form-urlencoded')
    expect(body.map((item) => item.path)).toEqual(['q', 'q[1]', 'empty'])
    const query = parseQueryParameters('https://api.test/search?q=scope&tenantId=3107')
    expect(query.map((item) => `${item.key}=${item.value}`)).toEqual(['q=scope', 'tenantId=3107'])
  })

  it('keeps plain text payload searchable', () => {
    const parameters = parseBodyParameters('raw payload', 'text/plain')
    expect(parameters).toHaveLength(1)
    expect(parameters[0].value).toBe('raw payload')
  })
})
