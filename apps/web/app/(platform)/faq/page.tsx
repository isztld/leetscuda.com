import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ — leetscuda.com',
}

const faqs = [
  {
    section: 'About the platform',
    items: [
      {
        q: 'What is leetscuda.com?',
        a: 'The interview prep platform for AI infrastructure engineers. It covers CUDA, ML systems, Kubernetes for AI, and foundational algorithms — structured around the questions real companies actually ask.',
      },
      {
        q: 'Who is this for?',
        a: 'Senior and staff engineers preparing for AI infrastructure interviews at companies like Nebius, Groq, Lambda Labs, Crusoe, and AI labs. If you already know general software engineering but need depth in GPU programming, ML systems, and production AI infrastructure, this is for you.',
      },
      {
        q: 'Is it free?',
        a: 'Yes, free to use with a daily submission limit. A paid tier with unlimited submissions and priority judge queue is planned.',
      },
    ],
  },
  {
    section: 'The problems',
    items: [
      {
        q: 'What languages are supported?',
        a: 'C++ and CUDA for compute problems. YAML for Kubernetes problems.',
      },
      {
        q: 'How does the judge work?',
        a: 'Submitted code runs in an isolated Docker sandbox. C++ and CUDA problems compile with nvcc and run against test cases. Kubernetes problems are validated structurally and against kubectl dry-run.',
      },
      {
        q: 'Can I see the test cases?',
        a: 'Test inputs and expected outputs are shown after each submission.',
      },
      {
        q: 'Why is my submission stuck on PENDING?',
        a: 'The judge may be temporarily unavailable. You can cancel your submission and resubmit. If the problem persists, contact us.',
      },
    ],
  },
  {
    section: 'Contributing',
    items: [
      {
        q: 'How do I contribute a problem or theory article?',
        a: 'The entire learning curriculum is open source under the learning/ directory. Fork the repository, add your MDX file following the contribution guide, and open a PR. See the Contributing page for full instructions.',
      },
      {
        q: 'What licence is the content under?',
        a: 'MIT licence. Community contributions are welcome and credited.',
      },
      {
        q: 'I found a bug in a problem.',
        a: 'Open a GitHub issue or pull request. Links are in the footer.',
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        q: 'How do I delete my account?',
        // TODO: replace [YOUR EMAIL ADDRESS] with your contact email
        a: 'Email [YOUR EMAIL ADDRESS] with your username and we will delete your data within 30 days per GDPR Art. 17.',
      },
      {
        q: 'What data do you store about me?',
        a: 'See the Privacy Policy for a complete description.',
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Frequently asked questions
      </h1>
      <p className="mt-4 text-slate-600">
        Can&apos;t find what you&apos;re looking for? Reach out via the{' '}
        <a href="/contact" className="text-blue-600 hover:text-blue-700">
          contact page
        </a>
        .
      </p>

      <div className="mt-12 space-y-12">
        {faqs.map((section) => (
          <div key={section.section}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{section.section}</h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <details
                  key={item.q}
                  className="group border border-slate-200 rounded-lg overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none bg-white hover:bg-slate-50 transition-colors">
                    <span className="font-medium text-slate-900">{item.q}</span>
                    <span className="shrink-0 text-slate-400 group-open:rotate-180 transition-transform duration-200">
                      ↓
                    </span>
                  </summary>
                  <div className="px-5 py-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 prose prose-slate prose-sm max-w-none">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
