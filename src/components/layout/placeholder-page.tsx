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
    <div className={cn('mx-auto w-full max-w-3xl', className)}>
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
