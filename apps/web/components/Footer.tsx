import Link from 'next/link'

const columns = [
  {
    heading: 'Platform',
    links: [
      { label: 'Problems', href: '/problems' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Learn', href: '/learn' },
      { label: 'Support ♥', href: '/support' },
    ],
  },
  {
    heading: 'Community',
    links: [
      { label: 'Contributing', href: '/contributing' },
      { label: 'FAQ', href: '/faq' },
      { label: 'GitHub ↗', href: 'https://github.com/isztld/leetscuda.com', external: true },
      { label: 'Discord ↗', href: '#', external: true },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: "What's Coming", href: '/whats-coming' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Impressum', href: '/impressum' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top: brand + columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <p className="text-slate-200 font-semibold text-base">leetscuda.com</p>
            <p className="mt-2 text-sm leading-relaxed">
              The interview prep platform for AI infrastructure engineers
            </p>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="text-slate-200 font-medium text-sm mb-3">{col.heading}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-8 border-t border-slate-800 text-sm text-slate-500">
          © 2026 leetscuda.com · Built for the interview nobody warns you about · Germany
        </div>
      </div>
    </footer>
  )
}
