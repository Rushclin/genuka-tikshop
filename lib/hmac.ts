export const generateHmac = async (
  companyId: string,
  timestamp: string,
): Promise<string> => {
  const data = `company_id=${companyId}&timestamp=${timestamp}`
  const secret = process.env.GENUKA_CLIENT_SECRET!.trim()

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
