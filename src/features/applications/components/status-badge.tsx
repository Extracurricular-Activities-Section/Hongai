import { cn } from '@/lib/utils'
import {
  applicationStatusBadgeClass,
  applicationStatusLabel,
  eligibilityStatusBadgeClass,
  eligibilityStatusLabel,
} from '../utils/status-labels'

export function StatusBadge({
  status,
  kind = 'application',
  label,
  className,
}: {
  status: string | null | undefined
  kind?: 'application' | 'eligibility'
  label?: string
  className?: string
}) {
  const text =
    label ||
    (kind === 'eligibility' ? eligibilityStatusLabel(status) : applicationStatusLabel(status))
  const tone =
    kind === 'eligibility'
      ? eligibilityStatusBadgeClass(status)
      : applicationStatusBadgeClass(status)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
    >
      {text}
    </span>
  )
}
