import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">找不到頁面</h1>
      <p className="text-sm text-muted-foreground">您造訪的網址不存在或已移除。</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/">學生登入</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/login">後台登入</Link>
        </Button>
      </div>
    </div>
  )
}
