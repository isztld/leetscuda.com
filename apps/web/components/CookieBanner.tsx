'use client'

import { useState } from 'react'
import Link from 'next/link'
import { acceptCookies } from '@/lib/actions/cookie-consent'

export function CookieBanner({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show)

  if (!visible) return null

  async function handleAccept() {
    await acceptCookies()
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <p className="text-sm flex-1">
          We use essential cookies only for authentication and security. No tracking, no analytics,
          no advertising.{' '}
          <Link href="/cookies" className="underline hover:text-slate-100 transition-colors">
            Read our Cookie Policy
          </Link>
          .
        </p>
        <button
          onClick={handleAccept}
          className="shrink-0 px-4 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
