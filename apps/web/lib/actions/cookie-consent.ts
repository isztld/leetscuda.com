'use server'

import { cookies } from 'next/headers'

export async function acceptCookies() {
  const cookieStore = await cookies()
  cookieStore.set('leetscuda-cookie-consent', '1', {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    httpOnly: false, // must be readable client-side to avoid flash
    path: '/',
  })
}
