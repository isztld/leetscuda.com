import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const UNAUTHENTICATED_ALLOWED = new Set(['/', '/signin', '/roadmap', '/problems'])

export const proxy = auth((req) => {
  const session = req.auth
  const { pathname } = req.nextUrl

  if (!session?.user) {
    const allowed =
      UNAUTHENTICATED_ALLOWED.has(pathname) ||
      pathname.startsWith('/roadmap/') ||
      pathname.startsWith('/problems/')
    if (!allowed) {
      return NextResponse.redirect(new URL('/signin', req.url))
    }
    return NextResponse.next()
  }

  // Authenticated but no username → force setup (skip if already there)
  if (!session.user.username && pathname !== '/setup-username') {
    return NextResponse.redirect(new URL('/setup-username', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
}
