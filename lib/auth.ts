'use server'

import { jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(
  process.env.GENUKA_CLIENT_SECRET!.trim(),
)

export const verifyJwt = async (token: string): Promise<JWTPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, secret)

    return payload
  } catch (error) {
    console.error('Error verifying JWT:', error)
    return null
  }
}

export const getCompanyIdFromJWT = async (): Promise<string | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) return null

  const payload = await verifyJwt(token)

  if (!payload) return null

  return payload.companyId as string
}

export const signOut = async () => {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
