import { normalizeHarEntry } from '../core/normalize'
import type { CapturedRequest, ResponseContent } from '../types/network'

const now = Date.now()

const STATUS_TEXT: Record<number, string> = {
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  302: 'Found',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
}

function sample(
  sequence: number,
  options: {
    offset: number
    method: string
    url: string
    status: number
    type: string
    mime?: string
    duration: number
    size: number
    body?: unknown
    bodyText?: string
    bodyMime?: string
    responseBody?: ResponseContent
  },
): CapturedRequest {
  const body = options.bodyText ?? (options.body === undefined ? '' : JSON.stringify(options.body))
  const bodyMime = options.bodyMime || 'application/json'
  const request = normalizeHarEntry(
    {
      startedDateTime: new Date(now - options.offset).toISOString(),
      time: options.duration,
      _resourceType: options.type,
      request: {
        method: options.method,
        url: options.url,
        headers: [
          { name: 'accept', value: 'application/json' },
          { name: 'authorization', value: 'Bearer demo-token' },
          ...(body ? [{ name: 'content-type', value: bodyMime }] : []),
        ],
        postData: body ? { mimeType: bodyMime, text: body } : undefined,
      },
      response: {
        status: options.status,
        statusText:
          options.status < 0
            ? 'net::ERR_CONNECTION_REFUSED'
            : STATUS_TEXT[options.status] ?? (options.status >= 400 ? 'Request failed' : 'OK'),
        headers: [
          { name: 'content-type', value: options.mime || 'application/json; charset=utf-8' },
          { name: 'x-request-id', value: `req_demo_${sequence}` },
        ],
        content: { mimeType: options.mime || 'application/json', size: options.size },
        bodySize: options.size,
      },
    },
    sequence,
  )
  request.responseBody = options.responseBody ?? {
    content: JSON.stringify(
      options.status >= 400
        ? { code: 'VALIDATION_ERROR', message: 'tenantId is required' }
        : { code: 0, data: { requestId: `req_demo_${sequence}`, accepted: true } },
      null,
      2,
    ),
    encoding: '',
  }
  return request
}

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export function createSampleRequests(): CapturedRequest[] {
  return [
    sample(1, {
      offset: 1200,
      method: 'GET',
      url: 'https://api.acme.test/v1/orders?page=1&pageSize=20&tenantId=3107',
      status: 200,
      type: 'fetch',
      duration: 86,
      size: 18420,
    }),
    sample(2, {
      offset: 980,
      method: 'POST',
      url: 'https://api.acme.test/v1/orders',
      status: 201,
      type: 'xhr',
      duration: 143,
      size: 1280,
      body: { tenantId: 3107, sku: 'M-9082', quantity: 12, consignee: { city: 'Shenzhen' } },
    }),
    sample(3, {
      offset: 760,
      method: 'POST',
      url: 'https://api.acme.test/graphql?operation=InventoryQuery',
      status: 200,
      type: 'fetch',
      duration: 224,
      size: 9420,
      body: { operationName: 'InventoryQuery', variables: { warehouseId: 'WH-03', lowStock: true } },
    }),
    sample(4, {
      offset: 610,
      method: 'PATCH',
      url: 'https://api.acme.test/v1/users/u_2048',
      status: 422,
      type: 'xhr',
      duration: 112,
      size: 486,
      body: { displayName: 'Lin', tenantId: '' },
    }),
    sample(5, {
      offset: 440,
      method: 'GET',
      url: 'https://cdn.acme.test/assets/dashboard.css',
      status: 200,
      type: 'stylesheet',
      mime: 'text/css',
      duration: 31,
      size: 62400,
      responseBody: { content: '.dashboard { display: grid; grid-template-columns: 1fr 1fr; }\n', encoding: '' },
    }),
    sample(6, {
      offset: 300,
      method: 'DELETE',
      url: 'https://api.acme.test/v1/sessions/session_884?force=true',
      status: 204,
      type: 'fetch',
      duration: 64,
      size: 0,
      responseBody: { content: '', encoding: '' },
    }),
    sample(7, {
      offset: 250,
      method: 'GET',
      url: 'https://api.acme.test/v1/orders/ORD-2048?tenantId=3107',
      status: 302,
      type: 'document',
      mime: 'text/html; charset=utf-8',
      duration: 38,
      size: 512,
      responseBody: {
        content:
          '<html><body><h1>Found</h1><p>Redirecting to <a href="/v1/orders/ORD-2048?expand=items">/v1/orders/ORD-2048?expand=items</a></p></body></html>',
        encoding: '',
      },
    }),
    sample(8, {
      offset: 200,
      method: 'GET',
      url: 'https://api.acme.test/v1/reports/export?format=csv&range=90d',
      status: 500,
      type: 'fetch',
      duration: 1780,
      size: 348,
    }),
    sample(9, {
      offset: 165,
      method: 'GET',
      url: 'https://api.acme.test/v1/inventory/items?warehouseId=WH-03&tenantId=3107',
      status: 404,
      type: 'xhr',
      duration: 96,
      size: 890,
    }),
    sample(10, {
      offset: 130,
      method: 'GET',
      url: 'https://cdn.acme.test/assets/logo-mark.png?w=128',
      status: 200,
      type: 'image',
      mime: 'image/png',
      duration: 12,
      size: 20480,
      responseBody: { content: PNG_1PX, encoding: 'base64' },
    }),
    sample(11, {
      offset: 110,
      method: 'GET',
      url: 'https://cdn.acme.test/fonts/inter-var.woff2',
      status: 200,
      type: 'font',
      mime: 'font/woff2',
      duration: 22,
      size: 98740,
      responseBody: { content: 'd29mZjI=', encoding: 'base64' },
    }),
    sample(12, {
      offset: 90,
      method: 'GET',
      url: 'https://preview.acme.test/dashboard/workplace',
      status: 200,
      type: 'document',
      mime: 'text/html; charset=utf-8',
      duration: 610,
      size: 125400,
      responseBody: { content: '<!doctype html><html><head><title>工作台</title></head><body>…</body></html>', encoding: '' },
    }),
    sample(13, {
      offset: 70,
      method: 'GET',
      url: 'wss://api.acme.test/realtime?channel=orders',
      status: 101,
      type: 'websocket',
      mime: 'text/plain; charset=utf-8',
      duration: 0,
      size: 0,
      responseBody: { content: '', encoding: '' },
    }),
    sample(14, {
      offset: 45,
      method: 'GET',
      url: 'https://cdn.acme.test/js/vendor.9f2c.js',
      status: 200,
      type: 'script',
      mime: 'application/javascript',
      duration: 45,
      size: 182340,
      responseBody: { content: '"use strict";\n', encoding: '' },
    }),
    sample(15, {
      offset: 25,
      method: 'POST',
      url: 'https://api.acme.test/v1/orders/search?tenantId=3107',
      status: 200,
      type: 'fetch',
      duration: 158,
      size: 5210,
      bodyText: 'q=scope&q=network&tenantId=3107&empty=',
      bodyMime: 'application/x-www-form-urlencoded',
    }),
    sample(16, {
      offset: 10,
      method: 'GET',
      url: 'https://partner.acme.test/v1/ping',
      status: -1,
      type: 'xhr',
      duration: 42,
      size: 0,
      responseBody: { content: '', encoding: '' },
    }),
  ]
}
