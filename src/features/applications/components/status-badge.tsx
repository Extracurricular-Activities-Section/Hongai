import { Badge } from '@/components/ui/badge'
import { applicationStatusTone, eligibilityStatusTone } from '@/lib/status/tone'
import { applicationStatusLabel, eligibilityStatusLabel } from '../utils/status-labels'

/**
 * The one status chip for the product. Colour comes from the shared tone map,
 * never from the call site.
 */
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
  const tone = kind === 'eligibility' ? eligibilityStatusTone(status) : applicationStatusTone(status)

  return (
    <Badge tone={tone} className={className}>
      {text}
    </Badge>
  )
}
