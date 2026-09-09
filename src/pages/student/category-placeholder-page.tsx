import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchStudentMe } from '@/features/auth/student/api'
import { fetchCurrentCategories, startCategory } from '@/features/periods/api'
import type { ApplicationCategory, StudentMeResponse } from '@/types'

export function StudentCategoryPlaceholderPage() {
  const { categoryCode = '' } = useParams()
  const [me, setMe] = useState<StudentMeResponse | null>(null)
  const [category, setCategory] = useState<ApplicationCategory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [meData, categories] = await Promise.all([
          fetchStudentMe(),
          fetchCurrentCategories(),
        ])
        if (cancelled) return
        setMe(meData)
        const found = categories.items.find((item) => item.category.code === categoryCode)
        if (!found) {
          await startCategory(categoryCode)
          const refreshed = await fetchCurrentCategories()
          const again = refreshed.items.find((item) => item.category.code === categoryCode)
          setCategory(again?.category ?? null)
        } else {
          setCategory(found.category)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [categoryCode])

  if (error) return <p className="text-sm font-medium text-danger">{error}</p>
  if (!me || !category) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page font-semibold text-foreground">{category.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          申請內容將於下一階段（表單引擎）建立。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">申請人摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{me.profile.name}</p>
          <p>{me.student.student_no}</p>
          <p>{me.profile.department_name}</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/student/profile">查看共用資料</Link>
          </Button>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/student/current">返回申請項目</Link>
      </Button>
    </div>
  )
}
