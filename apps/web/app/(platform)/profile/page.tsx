import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function ProfileRedirectPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/signin')
  }
  if (!session.user.username) {
    redirect('/setup-username')
  }
  redirect(`/profile/${session.user.username}`)
}
