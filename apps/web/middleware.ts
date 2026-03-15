import { auth } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// Routes accessible without authentication
function isPublic(pathname: string): boolean {
  if (
    pathname === '/' ||
    pathname === '/signin' ||
    pathname === '/setup-username' ||
    pathname === '/roadmap' ||
    pathname === '/problems' ||
    pathname === '/learn'
  ) {
    return true
  }
  if (
    pathname.startsWith('/problems/') ||
    pathname.startsWith('/learn/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/trpc/')
  ) {
    return true
  }
  return false
}

export default auth((req: NextRequest & { auth: { user?: unknown } | null }) => {
  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return

  if (!req.auth?.user) {
    const signInUrl = new URL('/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return Response.redirect(signInUrl)
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
