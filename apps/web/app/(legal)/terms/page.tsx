import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use — leetscuda.com',
}

export default function TermsPage() {
  return (
    <article className="max-w-2xl mx-auto py-16 px-6 prose prose-slate">
      <h1>Terms of Use</h1>
      <p>
        <em>Last updated: 2026</em>
      </p>

      <h2>1. Service description</h2>
      <p>
        leetscuda.com is an interview preparation platform for AI infrastructure engineers. It
        provides coding problems, theory content, and an automated judge for C++, CUDA, and
        Kubernetes exercises.
      </p>

      <h2>2. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Automate or scrape the platform in bulk without prior written permission</li>
        <li>
          Abuse or intentionally overload the judge system (e.g., submitting code designed to
          exhaust resources or escape the sandbox)
        </li>
        <li>Submit malicious code intended to harm other users or the platform infrastructure</li>
        <li>Use the platform for any unlawful purpose</li>
        <li>
          Attempt to access other users' submissions, accounts, or private data
        </li>
      </ul>

      <h2>3. User content</h2>
      <p>
        Code you submit for problem solutions remains your own. By submitting, you grant
        leetscuda.com a non-exclusive, royalty-free licence to store, display, and use your
        submissions solely to operate the service (e.g., to show you your submission history).
      </p>

      <h2>4. Community contributions</h2>
      <p>
        Problems and theory articles contributed via GitHub pull request are submitted under the MIT
        licence, consistent with the repository licence. By opening a PR, you confirm you have the
        right to contribute the content under those terms.
      </p>

      <h2>5. Account termination</h2>
      <p>
        leetscuda.com may suspend or terminate accounts that violate these terms, abuse the judge
        system, or engage in conduct harmful to the community, without prior notice.
      </p>

      <h2>6. Disclaimer of warranties</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; without warranty of any kind, express or
        implied. We do not warrant that the service will be uninterrupted, error-free, or that judge
        results are free from bugs.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by applicable law, leetscuda.com shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages arising from your use of
        or inability to use the service.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These terms are governed by Swiss law (Schweizer Recht). Any disputes shall be subject to
        the exclusive jurisdiction of the competent courts of Zurich, Switzerland.
      </p>
      <p>
        Operator: {/* [YOUR FULL NAME], */}Zürich, Switzerland.
      </p>

      <h2>9. Contact</h2>
      <p>
        For questions about these terms:{' '}
        {/* TODO: replace support@leetscuda.com with your contact email */}
        <a href="mailto:support@leetscuda.com">support@leetscuda.com</a>
      </p>
    </article>
  )
}
