interface SkeletonProps {
  variant?: 'line' | 'block' | 'badge'
  className?: string
}

export function Skeleton({ variant = 'line', className = '' }: SkeletonProps) {
  const variantClass =
    variant === 'line'
      ? 'h-4 w-full'
      : variant === 'block'
        ? 'h-24 w-full'
        : 'h-5 w-16'

  return <div className={`animate-pulse bg-slate-200 rounded ${variantClass} ${className}`} />
}
