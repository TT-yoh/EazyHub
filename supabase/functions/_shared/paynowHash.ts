/** Validates Paynow inbound messages (form fields in received order, excluding hash). */
export async function validatePaynowInboundHash(
  entries: [string, string][],
  integrationKey: string,
  receivedHash: string,
): Promise<boolean> {
  let payload = ''
  for (const [key, value] of entries) {
    if (key.toLowerCase() === 'hash') continue
    payload += decodeURIComponent(value.replace(/\+/g, ' '))
  }
  payload += integrationKey

  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(payload))
  const computed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

  return computed === receivedHash.toUpperCase()
}

export function parsePaynowFormBody(raw: string): [string, string][] {
  const entries: [string, string][] = []
  for (const part of raw.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    if (eq === -1) {
      entries.push([part, ''])
    } else {
      entries.push([part.slice(0, eq), part.slice(eq + 1)])
    }
  }
  return entries
}
