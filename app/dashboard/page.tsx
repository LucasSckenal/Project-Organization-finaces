import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell/AppShell'
import { HeroDashboard } from '@/components/dashboard/HeroDashboard/HeroDashboard'
import { InsightsStrip } from '@/components/dashboard/InsightsStrip/InsightsStrip'
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart/AnalyticsChart'
import { ExpenseTable } from '@/components/dashboard/ExpenseTable/ExpenseTable'
import { InvestmentsSection } from '@/components/dashboard/InvestmentsSection/InvestmentsSection'
import { AccountsSection } from '@/components/dashboard/AccountsSection/AccountsSection'
import { GoalsSection } from '@/components/dashboard/GoalsSection/GoalsSection'
import { OnboardingGuard } from '@/components/onboarding/OnboardingGuard'

export default function Dashboard() {
  return (
    <AuthGuard>
      <AppShell>
        <HeroDashboard />
        <InsightsStrip />
        <AnalyticsChart />
        <ExpenseTable />
        <AccountsSection />
        <InvestmentsSection />
        <GoalsSection />
      </AppShell>
      {/* Renders over the dashboard for new users only */}
      <OnboardingGuard />
    </AuthGuard>
  )
}
