import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy — leetscuda.com',
}

export default function CookiesPage() {
  return (
    <article className="max-w-2xl mx-auto py-16 px-6 prose prose-slate">
      <h1>Cookie Policy</h1>
      <p>
        leetscuda.com uses only essential cookies required for the platform to function. We do not
        use tracking cookies, analytics cookies, or advertising cookies.
      </p>

      <h2>Cookies we set</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left p-3 border border-slate-200 font-medium">Cookie Name</th>
              <th className="text-left p-3 border border-slate-200 font-medium">Purpose</th>
              <th className="text-left p-3 border border-slate-200 font-medium">Duration</th>
              <th className="text-left p-3 border border-slate-200 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-3 border border-slate-200 font-mono text-xs">
                next-auth.session-token
              </td>
              <td className="p-3 border border-slate-200">Authentication</td>
              <td className="p-3 border border-slate-200">Session</td>
              <td className="p-3 border border-slate-200">Essential</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="p-3 border border-slate-200 font-mono text-xs">
                next-auth.csrf-token
              </td>
              <td className="p-3 border border-slate-200">CSRF protection</td>
              <td className="p-3 border border-slate-200">Session</td>
              <td className="p-3 border border-slate-200">Essential</td>
            </tr>
            <tr>
              <td className="p-3 border border-slate-200 font-mono text-xs">
                leetscuda-cookie-consent
              </td>
              <td className="p-3 border border-slate-200">Records your acknowledgement</td>
              <td className="p-3 border border-slate-200">1 year</td>
              <td className="p-3 border border-slate-200">Essential</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Do we need your consent?</h2>
      <p>
        Under the revDSG (Swiss Data Protection Act) and, for EU users, the GDPR and the ePrivacy
        Directive, strictly necessary cookies do not require consent because they are essential to
        deliver the service you have requested. We inform you as a matter of transparency, not
        because we are legally required to ask permission for these particular cookies.
      </p>
      <p>
        Questions or complaints may be directed to the Swiss Federal Data Protection and Information
        Commissioner (FDPIC / EDÖB):{' '}
        <a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener noreferrer">
          https://www.edoeb.admin.ch
        </a>
      </p>

      <h2>Third-party cookies</h2>
      <p>
        We do not set any third-party cookies. When you sign in via GitHub or Google, you interact
        directly with those providers' own cookie policies.
      </p>

      <h2>Questions</h2>
      <p>
        For questions about our cookie use, contact{' '}
        {/* TODO: replace support@leetscuda.com with your contact email */}
        <a href="mailto:support@leetscuda.com">support@leetscuda.com</a>.
      </p>
    </article>
  )
}
