# Auth Gateway

學生／職員登入經 Cloudflare `hk-api`。

## Target

```text
Browser → CF /api/hk/auth/* → PB Auth collections（data API only）
```

- 禁止 log：last4、password、完整身分證、token
- 禁止 Superuser
- 目標：HttpOnly Secure SameSite Cookie（尚未硬切）

## Current honesty

| Path | Status |
| --- | --- |
| Staff `POST /api/hk/auth/staff/login` | CF → PB `hk_staff_users` auth-with-password（OK 方向） |
| Student login／register／logout | **尚未完整 CF-native**；現有實作仍可能 proxy 舊 hook 路徑 — **正式 PB 無 hooks 時不可用**，必須移植 |

詳見 `docs/PB-HOOKS-MIGRATION-MATRIX.md`。

## Browser config

```env
VITE_HK_API_BASE_URL=http://127.0.0.1:8787
VITE_POCKETBASE_URL=https://db.keson.pro
```
