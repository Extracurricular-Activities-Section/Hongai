# 弘愛築夢整合狀態報告（架構修正後）

**Date:** 2026-09-10  
**Production：** NOT LIVE／NOT DEPLOYED  
**PB business hooks on host：** **FORBIDDEN**

## Canonical API

```text
Browser → Cloudflare /api/hk/* → PocketBase Data API (hk_*)
```

## PocketBase 主機要做什麼

只做資料層：backup → migrations → `hk_*` schema／seed → API Rules → service account → files／indexes → 驗證 CF 可存取。  
**不要**上傳 `pb_hooks/`。詳見對話／runbook。

## Cloudflare

部分 native（health、rules compute、policy／FAQ、staff login shape）。  
**絕大多數**原 hook 業務 **尚未** CF-native。誠實矩陣：`docs/PB-HOOKS-MIGRATION-MATRIX.md`。

## Frontend

多數 feature 仍 `studentPb.send('/api/hk/...')`／`staffPb.send(...)`，語意依賴舊 hooks。  
須逐步改為 Cloudflare API Client；禁止 browser 直連敏感 collections CRUD。

## 下一步（非 production）

1. 移植 Auth／Periods／Forms／Applications… 至 CF  
2. 關閉 Worker 對 PB `/api/hk/*` business proxy  
3. Frontend 切 apiClient  
4. Matrix 全綠後才刪 repo hooks
