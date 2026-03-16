import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact — leetscuda.com',
}

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Get in touch</h1>

      <div className="mt-10 space-y-8">
        <div className="border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            Bug reports and problem corrections
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            GitHub Issues is the best place for bugs, incorrect test cases, or editorial errors.
          </p>
          <a
            href="https://github.com/[YOUR_USERNAME]/leetscuda/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            github.com/[YOUR_USERNAME]/leetscuda/issues ↗
          </a>
        </div>

        <div className="border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            Data requests (GDPR)
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            Requests for access, deletion, or portability of your personal data under GDPR.
          </p>
          <a
            href="mailto:[YOUR EMAIL ADDRESS]"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            [YOUR EMAIL ADDRESS]
          </a>
        </div>

        <div className="border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-2">Everything else</h2>
          <p className="text-sm text-slate-600 mb-3">
            Questions, feedback, partnership enquiries, or anything else.
          </p>
          <a
            href="mailto:[YOUR EMAIL ADDRESS]"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            [YOUR EMAIL ADDRESS]
          </a>
        </div>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Response time: best effort, usually within a few days.
      </p>
    </div>
  )
}
