import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-display font-semibold text-foreground tabular">404</p>
      <h1 className="mt-3 text-section font-semibold text-foreground">找不到這個頁面</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-subtle">
        您造訪的網址不存在或已移除。可以回到登入頁重新開始。
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Button asChild variant="brand">
          <Link to="/">學生登入</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/login">後台登入</Link>
        </Button>
      </div>
    </div>
  )
}
