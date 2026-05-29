import Link from 'next/link'
import { Reveal } from './_reveal'
import styles from './page.module.scss'

// ── Static data ───────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '✦', title: 'AI Financial Assistant',  desc: 'Ask Ma in plain English. Spending patterns, goal forecasts, savings analysis — powered by your real data.' },
  { icon: '⟳', title: 'Real-time Sync',           desc: 'Every transaction and balance updates live. Firebase-powered, always fresh, always yours.' },
  { icon: '▮', title: 'Budget Control',            desc: 'Set monthly limits per category. Visual progress bars warn you before you overspend.' },
  { icon: '◎', title: 'Financial Goals',           desc: 'Track savings milestones with deadlines and progress. Emergency fund, travel, property — all in view.' },
  { icon: '△', title: 'Investment Portfolio',      desc: 'Monitor allocation, gain/loss, and performance across ETFs, stocks, crypto, and bonds.' },
  { icon: '↑↓', title: 'Import & Export',          desc: 'Import from any bank CSV. Export at any time. Your data is always, only, yours.' },
]

const FREE_ITEMS = ['50 transactions / month', 'Budget tracking', '3 financial goals', 'Investment portfolio', 'Analytics charts']
const PRO_ITEMS  = ['Unlimited transactions', 'AI assistant (Ask Ma)', 'Unlimited goals', 'CSV import & export', 'Recurring automations', 'Priority support']

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className={styles.page}>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navGlyph}>間</span>
          <span className={styles.navName}>Ma Finance OS</span>
        </div>
        <div className={styles.navActions}>
          <Link href="/auth" className={styles.navLink}>Sign in</Link>
          <Link href="/auth" className={styles.navCta}>Get started free</Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p   className={`${styles.eyebrow}  ${styles.d1}`}>Personal Finance OS</p>
          <h1  className={`${styles.headline} ${styles.d2}`}>
            Your finances,<br /><em>as they should be.</em>
          </h1>
          <p   className={`${styles.lead}     ${styles.d3}`}>
            A minimalist operating system for personal finance.<br />
            Real-time insights, AI-powered analysis, cinematic design.
          </p>
          <div className={`${styles.ctas}     ${styles.d4}`}>
            <Link href="/auth" className={styles.btnPrimary}>Start for free →</Link>
            <Link href="/auth" className={styles.btnGhost}>Sign in</Link>
          </div>
          <p   className={`${styles.fine}     ${styles.d5}`}>
            No credit card · Free plan · Data stays yours
          </p>
        </div>
        <a href="#features" className={styles.scrollHint} aria-label="Scroll to features">↓</a>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>What&apos;s inside</span>
          <h2   className={styles.sectionH2}>Everything you need.<br />Nothing you don&apos;t.</h2>
        </Reveal>
        <Reveal className={styles.grid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.card}>
              <span className={styles.cardIcon}>{f.icon}</span>
              <h3   className={styles.cardTitle}>{f.title}</h3>
              <p    className={styles.cardDesc}>{f.desc}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Pricing</span>
          <h2   className={styles.sectionH2}>Simple, honest pricing.</h2>
          <p    className={styles.sectionNote}>No hidden fees. Cancel anytime.</p>
        </Reveal>
        <Reveal className={styles.plans}>

          {/* Free */}
          <div className={styles.plan}>
            <div className={styles.planHeader}>
              <span className={styles.planName}>Free</span>
              <span className={styles.planPrice}>$0<span className={styles.planPer}>/mo</span></span>
            </div>
            <ul className={styles.planItems}>
              {FREE_ITEMS.map((i) => (
                <li key={i} className={styles.planItem}>
                  <span className={styles.checkmark}>✓</span>{i}
                </li>
              ))}
            </ul>
            <Link href="/auth" className={styles.planBtn}>Get started</Link>
          </div>

          {/* Pro */}
          <div className={`${styles.plan} ${styles.planPro}`}>
            <div className={styles.planBadge}>Most popular</div>
            <div className={styles.planHeader}>
              <span className={styles.planName}>Pro</span>
              <span className={styles.planPrice}>$9<span className={styles.planPer}>/mo</span></span>
            </div>
            <ul className={styles.planItems}>
              {PRO_ITEMS.map((i) => (
                <li key={i} className={styles.planItem}>
                  <span className={`${styles.checkmark} ${styles.checkPro}`}>✓</span>{i}
                </li>
              ))}
            </ul>
            <Link href="/auth" className={`${styles.planBtn} ${styles.planBtnPro}`}>
              Start free trial
            </Link>
          </div>

        </Reveal>
      </section>

      {/* ── Footer CTA ────────────────────────────────────────────────── */}
      <Reveal className={styles.footerCta}>
        <span className={styles.footerGlyph}>間</span>
        <h2   className={styles.footerCtaTitle}>Start your financial OS today.</h2>
        <Link href="/auth" className={styles.btnPrimary}>Get started free →</Link>
      </Reveal>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerBrandGlyph}>間</span>
          <span className={styles.footerBrandName}>Ma Finance OS</span>
        </div>
        <span className={styles.footerCopy}>© 2026 · Built for clarity</span>
      </footer>

    </div>
  )
}
