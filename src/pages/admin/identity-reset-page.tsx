import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listIdentityResets,
  unlockStudent,
  updateIdentityResetStatus,
} from '@/features/auth/backoffice/api'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import type { IdentityResetRequest } from '@/types'

const STATUSES = ['pending', 'processing', 'approved', 'rejected', 'closed'] as const

export function AdminIdentityResetPage() {
  const { isAdmin } = useBackofficeAuth()
  const [items, setItems] = useState<IdentityResetRequest[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [unlockId, setUnlockId] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(status?: string) {
    setError(null)
    try {
      const data = await listIdentityResets(status || undefined)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleStatus(id: string, status: string) {
    setBusy(true)
    setError(null)
    try {
      await updateIdentityResetStatus(id, status, notes[id] ?? '')
      await load(filter)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    if (!unlockId.trim()) return
    setBusy(true)
    setError(null)
    try {
      await unlockStudent(unlockId.trim())
      setUnlockId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除鎖定失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">身分重設申請</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Collection：had_identity_reset_requests。Staff/Admin 可處理狀態與備註。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={filter === '' ? 'default' : 'outline'}
          size="sm"
          disabled={busy}
          onClick={() => {
            setFilter('')
            void load()
          }}
        >
          全部
        </Button>
        {STATUSES.map((status) => (
          <Button
            key={status}
            type="button"
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            disabled={busy}
            onClick={() => {
              setFilter(status)
              void load(status)
            }}
          >
            {status}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="space-y-4">
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">目前沒有申請。</CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {item.name}（{item.student_no}）· {item.status}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Email：{item.email}</p>
                <p>電話：{item.phone}</p>
                <p>原因：{item.reason}</p>
                <div className="space-y-2">
                  <Label>處理備註</Label>
                  <Input
                    value={notes[item.id] ?? item.resolution_note ?? ''}
                    disabled={busy}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleStatus(item.id, status)}
                    >
                      設為 {status}
                    </Button>
                  ))}
                </div>
                {isAdmin && item.created_student ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setUnlockId(item.created_student ?? '')
                      void (async () => {
                        setBusy(true)
                        try {
                          await unlockStudent(item.created_student!)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : '解除鎖定失敗')
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }}
                  >
                    解除此學生登入鎖定
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">解除登入鎖定（Admin）</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>學生 Record ID</Label>
              <Input
                value={unlockId}
                disabled={busy}
                onChange={(event) => setUnlockId(event.target.value)}
                placeholder="had_students record id"
              />
            </div>
            <Button type="button" disabled={busy || !unlockId.trim()} onClick={() => void handleUnlock()}>
              解除鎖定
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
