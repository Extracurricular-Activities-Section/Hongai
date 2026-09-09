# Migration: had → hk

**Date:** 2026-09-10  
**Decision input:** User approved Implementation Plan option **1**. Presence of `hk_*` on `db.keson.pro`: **UNKNOWN** (not confirmed).

## Decision

| Field | Value |
| --- | --- |
| Strategy | **GREENFIELD_HK**（**已確認**：`db.keson.pro` 尚無資料、尚未建立 collections） |
| Meaning | Treat repo migrations as **not yet applied** to a verified runtime. Rewrite undeployed schema / hooks / client constants to `hk_*` and `/api/hk/*`. |
| Forward `had→hk` data migration | **Deferred** until an environment is proven to contain `hk_*` records. |
| Production apply | **Forbidden** in this wave unless user explicitly orders it. |

## If later detection finds `hk_*`

1. Stop GREENFIELD-only assumption for that host.  
2. Take full `pb_data` backup.  
3. Author a **forward** migration that copies / renames collections preserving IDs, relations, files, history.  
4. Do **not** delete `hk_*` until dual-read verification passes.

## Detection checklist（手動）

在目標 PocketBase Admin → Collections：

- [ ] 是否存在任何 `hk_` 開頭 collection？  
- [ ] 是否已有 `hk_` 開頭 collection？  
- [ ] 列數／抽樣 record 是否為空？

結果記入本檔「Detection log」。

## Detection log

| When | Host | Result | By |
| --- | --- | --- | --- |
| 2026-09-10 | db.keson.pro | **無資料／尚未建立 collections**（使用者確認）→ 維持 **GREENFIELD_HK** | user |
| 2026-09-10 | db.keson.pro | UNKNOWN（使用者未確認） | plan start |
