'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'

export function Navbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
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

        {/* Nav links */}
        <div className="flex items-center gap-1 flex-1">
          <Link
            href="/problems"
            className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Problems
          </Link>
          <Link
            href="/roadmap"
            className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Roadmap
          </Link>
        </div>

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
      </div>
    </nav>
  )
}
