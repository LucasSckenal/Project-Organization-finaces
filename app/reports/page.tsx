import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell/AppShell'
import { ReportsView } from '@/components/reports/ReportsView/ReportsView'

export default function ReportsPage() {
  return (
    <AuthGuard>
      <AppShell staticSection="reports">
        <ReportsView />
      </AppShell>
    </AuthGuard>
  )
}
