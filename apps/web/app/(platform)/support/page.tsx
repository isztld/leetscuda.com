import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support — leetscuda.com',
}

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Support leetscuda.com</h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        leetscuda is free and open source. If it helped you land a role or level up your
        understanding, consider supporting the project. 100% of donations go toward GPU server costs
        for running the judge.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* GitHub Sponsors */}
        <div className="border border-slate-200 rounded-xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
              GitHub Sponsors
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Recurring or one-time</h2>
            <p className="mt-2 text-sm text-slate-600">
              Support via GitHub Sponsors. Monthly or one-time, whatever works for you.
            </p>
          </div>
          <a
            href="https://github.com/sponsors/[YOUR_USERNAME]"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            GitHub Sponsors ↗
          </a>
          <p className="text-xs text-slate-400">[PLACEHOLDER — add your GitHub Sponsors link]</p>
        </div>

        {/* Bitcoin */}
        <div className="border border-slate-200 rounded-xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
              Bitcoin
            </p>
            <h2 className="text-lg font-semibold text-slate-900">One-time, no account needed</h2>
            <p className="mt-2 text-sm text-slate-600 font-mono break-all">
              bc1q[YOUR_BTC_ADDRESS]
            </p>
            <p className="mt-1 text-xs text-slate-400">[PLACEHOLDER — add your Bitcoin address]</p>
          </div>
          {/* QR code placeholder */}
          <div className="w-32 h-32 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center">
            <p className="text-xs text-slate-400 text-center px-2 leading-snug">
              QR code — add Bitcoin address
            </p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        No pressure. The platform is free and will stay free. Thank you for using it.
      </p>
    </div>
  )
}
