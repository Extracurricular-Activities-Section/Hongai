# Cloudflare Architecture

```text
Browser
  ├─ apply.*  弘愛築夢申請系統
  └─ manage.* 弘愛築夢管理系統
        │
        ▼
Cloudflare Worker `hk-api`  (+ Queues / Cron)
  ├─ /api/hk/*     ← 全部業務 API（目標：CF-native）
  └─ PocketBase Data API only
        /api/collections/hk_*
        /api/files/*
        │
        ▼
PocketBase
  ├─ hk_* data + files + rules + migrations
  └─ NO 弘愛築夢 business pb_hooks on host
```

## Runtime rules

- No PocketBase Superuser in Worker.
- Service account：僅 `hk_*`。
- `/api/hk/*` **由 Cloudflare 提供**，不是 PB hooks。
- 過渡期若 Worker 仍有「proxy `/api/hk/*` → PB」程式碼，視為 **違規過渡**；正式 PB 主機無 hooks 時該路徑不可用。狀態見 `docs/PB-HOOKS-MIGRATION-MATRIX.md`。

## Local

```bash
npm run worker:dev   # http://127.0.0.1:8787
# .env
VITE_HK_API_BASE_URL=http://127.0.0.1:8787
VITE_POCKETBASE_URL=https://db.keson.pro   # 僅資料層；Browser 不應直打敏感 CRUD
```

## Status

| Layer | Status |
| --- | --- |
| Gateway + health | Implemented |
| Native rules compute／policy／FAQ | Partial |
| Full `/api/hk/*` business ports | **Mostly pending**（見 migration matrix） |
| PB host without business hooks | **Required** |
| Production deploy | NOT EXECUTED |
