'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink, httpLink, splitLink } from '@trpc/client'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        // submission.getStatus is polled every 500 ms — send it unbatched so it
        // never has to wait for slower queries in the same batch.
        splitLink({
          condition: (op) => op.path === 'submission.getStatus',
          true: httpLink({ url: '/api/trpc' }),
          false: httpBatchLink({ url: '/api/trpc' }),
        }),
      ],
    }),
  )

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  )
}
