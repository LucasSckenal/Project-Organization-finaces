import type { CSSProperties } from 'react'
import styles from './Skeleton.module.scss'

// ── Base shimmer block ────────────────────────────────────────────────────────
interface SkeletonProps {
  width?:    string
  height?:   string
  style?:    CSSProperties
  className?: string
  rounded?:  boolean
}

export function Skeleton({
  width = '100%',
  height = '14px',
  style,
  className,
  rounded,
}: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className ?? ''}`}
      style={{ width, height, borderRadius: rounded ? '99px' : undefined, ...style }}
    />
  )
}

// ── Pre-built table row skeleton ──────────────────────────────────────────────
export function SkeletonTableRow() {
  return (
    <div className={styles.row}>
      {/* Merchant cell */}
      <div className={styles.merchantCell}>
        <div className={styles.icon} />
        <div className={styles.merchantText}>
          <Skeleton width="120px" height="13px" />
          <Skeleton width="72px"  height="10px" style={{ marginTop: '4px' }} />
        </div>
      </div>
      {/* Badge */}
      <Skeleton width="64px" height="20px" rounded style={{ flex: '0 0 auto' }} />
      {/* Date */}
      <Skeleton width="38px" height="11px" style={{ flex: '0 0 auto' }} />
      {/* Amount */}
      <Skeleton width="64px" height="13px" style={{ flex: '0 0 auto', marginLeft: 'auto' }} />
    </div>
  )
}
