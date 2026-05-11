const API_BASE = 'https://fapi.deephealth.net'

export function getImageUrl(path: string | undefined | null): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return API_BASE + path
}

export function fixContentImageUrls(html: string): string {
  return html.replace(/src="(\/uploads\/[^"]+)"/g, `src="${API_BASE}$1"`)
}
