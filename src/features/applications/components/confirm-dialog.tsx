import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '確認',
  cancelLabel = '取消',
  confirmVariant = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'default' | 'outline' | 'destructive'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle id="confirm-dialog-title" className="text-base">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {description ? <p className="text-muted-foreground">{description}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmVariant === 'destructive' ? 'outline' : confirmVariant}
              className={
                confirmVariant === 'destructive'
                  ? 'border-red-300 text-red-800 hover:bg-red-50'
                  : undefined
              }
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? '處理中…' : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
