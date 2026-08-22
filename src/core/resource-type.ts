/**
 * Maps a resource type to the label shown in the type column and matched by
 * the `type:` search alias. Mirrors Chrome DevTools: images show their mime
 * subtype (`image/png` → `png`), XHR shows `xhr`, anything else keeps its name.
 */
export function formatResourceType(resourceType: string, mimeType = ''): string {
  const type = resourceType.toLowerCase()
  if (type === 'xmlhttprequest') return 'xhr'
  if (type === 'image' && mimeType.startsWith('image/')) {
    return mimeType.slice('image/'.length).split(/[;+]/, 1)[0] || 'image'
  }
  return type || 'other'
}
