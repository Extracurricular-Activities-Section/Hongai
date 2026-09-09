import { Construction } from 'lucide-react'

import { EmptyState } from '@/components/common/states'
import { cn } from '@/lib/utils'

interface PlaceholderPageProps {
  title: string
  description?: string
  className?: string
}

export function PlaceholderPage({
  title,
  description = '此功能將於後續階段建立。',
  className,
}: PlaceholderPageProps) {
  return (
    <div className={cn('mx-auto w-full max-w-2xl', className)}>
      <EmptyState icon={Construction} title={title} description={description} />
    </div>
  )
}
