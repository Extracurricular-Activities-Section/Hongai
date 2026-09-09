import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { ErrorState, PageSkeleton } from '@/components/common/states'
import { listPublicFaq, type FaqArticle } from '@/features/faq/api'

export function PublicFaqPage() {
  const [items, setItems] = useState<FaqArticle[] | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listPublicFaq('student')
      .then((data) => {
        setItems(data.items ?? [])
        if (data.message) setHint(data.message)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [])

  if (error && !items) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />
  }
  if (!items) return <PageSkeleton />

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <PageHeader
        title="常見問題"
        description="申請流程、登入與文件相關說明。"
      />

      {hint && items.length === 0 ? (
        <p className="text-sm text-subtle">{hint}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-subtle">
          目前尚無公開 FAQ。若無法登入，請先至{' '}
          <Link to="/help" className="underline underline-offset-4">
            登入協助
          </Link>
          。
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="border-b border-border pb-4 last:border-0">
              <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
              <div
                className="prose-sm mt-2 text-sm leading-relaxed text-subtle"
                dangerouslySetInnerHTML={{ __html: item.body }}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm">
        <Link to="/help" className="font-medium underline underline-offset-4">
          登入協助與身分重設
        </Link>
      </p>
    </div>
  )
}
