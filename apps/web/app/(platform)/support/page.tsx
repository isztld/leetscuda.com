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
          <span className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-200 text-slate-400 text-sm font-medium cursor-not-allowed">
            Coming soon
          </span>
        </div>

        {/* Bitcoin */}
        <div className="border border-slate-200 rounded-xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
              Bitcoin
            </p>
            <h2 className="text-lg font-semibold text-slate-900">One-time, no account needed</h2>
            {/* TODO: replace with your Bitcoin address */}
            <p className="mt-2 text-sm text-slate-400 italic">Bitcoin address coming soon</p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        No pressure. The platform is free and will stay free. Thank you for using it.
      </p>
    </div>
  )
}
