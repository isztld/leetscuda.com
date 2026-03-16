import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "What's Coming — leetscuda.com",
}

const board = [
  {
    status: 'Live now',
    color: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
    items: [
      'CUDA, ML Systems, Kubernetes for AI, and Foundations tracks',
      'Automated judge with Docker sandbox',
      'C++, CUDA, and YAML (Kubernetes) support',
      'Visual dependency roadmap',
      'XP, streaks, and progress tracking',
      'GitHub and Google OAuth',
      'Problem editorials',
      'Open-source MDX curriculum',
    ],
  },
  {
    status: 'In progress',
    color: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
    items: [
      'More problems across all tracks',
      'Improved judge feedback and error messages',
      'Community problem contributions workflow',
    ],
  },
  {
    status: 'Planned',
    color: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
    items: [
      'GPU execution tier — real CUDA execution on GPU hardware',
      'Performance benchmarking — rank solutions by runtime',
      'Company interview guides — track-specific prep paths per company',
      'Quiz system — theory quizzes with auto-grading',
      'Paid tier — unlimited submissions, priority judge queue',
    ],
  },
  {
    status: 'Considering',
    color: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    items: [
      'Mobile app',
      'Interview simulation mode',
      'Collaborative problem solving',
      'Team / company accounts',
    ],
  },
]

export default function WhatsComingPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">What&apos;s coming</h1>
      <p className="mt-4 text-slate-600">
        No fake dates. This is an honest view of where the platform is and what is being built.
        Community suggestions welcome — open a{' '}
        <a
          href="https://github.com/isztld/leetscuda.com/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700"
        >
          GitHub issue
        </a>
        .
      </p>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {board.map((col) => (
          <div key={col.status} className="border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.color}`}>
                {col.status}
              </span>
            </div>
            <ul className="space-y-2">
              {col.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-slate-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
