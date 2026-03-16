import NextAuth, { type NextAuthConfig } from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const providers: NextAuthConfig['providers'] = []
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
  providers.push(GitHub({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }))
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  providers.push(Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }))

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Runs once at sign-in; user comes from the DB via PrismaAdapter
        token.username = (user as { username?: string | null }).username ?? null
        return token
      }
      if (trigger === 'update' && session?.username !== undefined) {
        token.username = session.username as string | null
        return token
      }
      // On every subsequent token refresh, verify the user still exists in the DB.
      // Returns null to clear the session cookie if the account has been deleted.
      if (token.sub) {
        const exists = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true },
        })
        if (!exists) return null
      }
      return token
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      session.user.username = (token.username as string | null) ?? null
      return session
    },
  },
})
