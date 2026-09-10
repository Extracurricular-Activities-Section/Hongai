# PocketBase Data Layer

弘愛築夢正式架構下，PocketBase **只做資料層**。

## 做

- `hk_*` collections／records／files／relations
- required fields、unique constraints、indexes
- API Rules（deny-by-default；僅授權角色／service account）
- Auth records：`hk_students`、`hk_staff_users`
- Protected file storage
- `pb_migrations/` 套用與 seed

## 不做

- **不部署** `pb_hooks/` business hooks
- **不**提供弘愛築夢 `/api/hk/*` custom routes
- **不**執行申請／表單／通知／PDF orchestration 等業務邏輯
- Cloudflare **不得**使用 `_superusers`；僅受限 service account，且只碰 `hk_*`

## 正確呼叫鏈

```text
Browser → Cloudflare /api/hk/* → PocketBase /api/collections/hk_* (+ /api/files/*)
```

Browser **不應**直接對敏感 collections 做 CRUD。

## Service account

Collection：`hk_staff_users`  
Role：`service`  
Secrets：僅存在 Worker（`.dev.vars`／wrangler secrets），永不 `VITE_*`。

## Active collections

- `hk_students`
- `hk_staff_users`
- `hk_forms`
- `hk_applications`
- `hk_settings`
- `hk_events`

## Legacy hooks

Repo 內 `pb_hooks/` = 移植來源。狀態矩陣：`docs/PB-HOOKS-MIGRATION-MATRIX.md`。
