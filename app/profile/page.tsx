import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell/AppShell'
import { ProfileSettings } from '@/components/profile/ProfileSettings/ProfileSettings'

export default function ProfilePage() {
  return (
    <AuthGuard>
      <AppShell staticSection="profile">
        <ProfileSettings />
      </AppShell>
    </AuthGuard>
  )
}
