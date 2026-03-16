'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

function navClass(pathname: string, href: string) {
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
  return [
    'text-sm px-3 py-1.5 rounded-lg transition-colors',
    active
      ? 'text-slate-900 font-medium bg-slate-100'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
  ].join(' ')
}

function mobileNavClass(pathname: string, href: string) {
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
  return [
    'block px-4 py-2.5 text-sm rounded-lg transition-colors',
    active
      ? 'text-slate-900 font-medium bg-slate-100'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
  ].join(' ')
}

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const user = session?.user

  return (
    <nav className="border-b border-slate-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-slate-900 font-bold text-lg tracking-tight hover:text-slate-700 transition-colors shrink-0"
        >
          leetscuda
        </Link>

        {/* Nav links — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1 flex-1">
          <Link href="/problems" className={navClass(pathname, '/problems')}>
            Problems
          </Link>
          <Link href="/roadmap" className={navClass(pathname, '/roadmap')}>
            Roadmap
          </Link>
          <Link href="/learn" className={navClass(pathname, '/learn')}>
            Learn
          </Link>
        </div>

        {/* Spacer on mobile so auth stays right-aligned */}
        <div className="flex-1 sm:hidden" />

        {/* Auth */}
        {user ? (
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              aria-expanded={open}
              aria-haspopup="true"
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.username ?? 'avatar'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                  {(user.username ?? user.email ?? '?')[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-slate-600 hidden sm:block">
                {user.username}
              </span>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
                <Link
                  href={user.username ? `/profile/${user.username}` : '/profile'}
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    setOpen(false)
                    signOut({ callbackUrl: '/' })
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/signin"
            className="shrink-0 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign in
          </Link>
        )}

        {/* Hamburger — mobile only */}
        <button
          className="sm:hidden shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
          <Link href="/problems" className={mobileNavClass(pathname, '/problems')}>
            Problems
          </Link>
          <Link href="/roadmap" className={mobileNavClass(pathname, '/roadmap')}>
            Roadmap
          </Link>
          <Link href="/learn" className={mobileNavClass(pathname, '/learn')}>
            Learn
          </Link>
        </div>
      )}
    </nav>
  )
}
