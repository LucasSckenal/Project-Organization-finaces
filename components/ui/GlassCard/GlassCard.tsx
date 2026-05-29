import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { clsx } from 'clsx'
import styles from './GlassCard.module.scss'

type Size    = 'sm' | 'md' | 'lg' | 'auto'
type Variant = 'default' | 'elevated' | 'accent' | 'gold'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  size?:        Size
  variant?:     Variant
  interactive?: boolean
  loading?:     boolean
  className?:   string
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      size = 'md',
      variant = 'default',
      interactive = false,
      loading = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const sizeMap: Record<Size, string> = {
      sm:   styles.sizeSm,
      md:   styles.sizeMd,
      lg:   styles.sizeLg,
      auto: styles.sizeAuto,
    }

    const variantMap: Record<Variant, string> = {
      default:  styles.variantDefault,
      elevated: styles.variantElevated,
      accent:   styles.variantAccent,
      gold:     styles.variantGold,
    }

    return (
      <motion.div
        ref={ref}
        className={clsx(
          styles.card,
          sizeMap[size],
          variantMap[variant],
          interactive && styles.interactive,
          loading && styles.loading,
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

GlassCard.displayName = 'GlassCard'
