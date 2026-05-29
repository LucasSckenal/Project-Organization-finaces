import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell/AppShell'
import { BudgetView } from '@/components/budget/BudgetView/BudgetView'

export default function BudgetPage() {
  return (
    <AuthGuard>
      <AppShell staticSection="budget">
        <BudgetView />
      </AppShell>
    </AuthGuard>
  )
}
