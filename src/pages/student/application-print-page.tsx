import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplicationPrintDocument } from '@/features/application-print/components/application-print-document'
import { fetchFormWorkspace, type FormWorkspaceResponse } from '@/features/forms/api'

export function StudentApplicationPrintPage() {
  const { categoryCode = '' } = useParams()
  const [workspace, setWorkspace] = useState<FormWorkspaceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFormWorkspace(categoryCode)
      .then((data) => {
        if (!cancelled) setWorkspace(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      })
    return () => {
      cancelled = true
    }
  }, [categoryCode])

  const backTo = `/student/current/category/${categoryCode}`
  const notCompleted = workspace ? workspace.submission.status !== 'completed' : false

  return (
    <div className="min-h-screen bg-surface-muted py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to={backTo}>
            <ArrowLeft />
            返回申請項目
          </Link>
        </Button>
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <p className="max-w-xs text-right text-sm text-subtle sm:max-w-none sm:text-left">
            此頁即為正式申請表。請用瀏覽器列印，或直接截圖整頁後簽名。
          </p>
          <Button
            type="button"
            variant="brand"
            disabled={!workspace || notCompleted}
            onClick={() => window.print()}
          >
            <Printer />
            列印正式申請表
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mx-auto max-w-[210mm] px-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {notCompleted ? (
        <div className="mx-auto max-w-[210mm] px-4">
          <ErrorState title="尚未完成填寫" message="請先完成申請內容填寫，再列印申請表。" />
        </div>
      ) : null}

      {!workspace && !error ? (
        <div className="mx-auto max-w-[210mm] px-4">
          <Skeleton className="h-[60rem]" />
        </div>
      ) : null}

      {workspace && !notCompleted ? (
        <div className="px-4 print:px-0">
          <div className="mx-auto max-w-[210mm] shadow-sm print:shadow-none">
            <ApplicationPrintDocument workspace={workspace} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
