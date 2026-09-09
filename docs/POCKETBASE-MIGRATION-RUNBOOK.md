# PocketBase Migration Runbook

人工套用 `hk_*` migrations 的作業手冊。

> **Default status：READY_FOR_MANUAL_MIGRATION**  
> Preflight 通過 ≠ 已套用。本 runbook **不會**自動對 production 寫入。

## Principles

1. 只操作 `hk_*` collections；禁止動 `students`／`users`／`teachers`。
2. **Backup gate 優先於一切**。
3. Rollback = **restore backup**，不以「空 down migration」當資料救星。
4. 先 staging／複本，再 production。

## 0. Backup gate（BLOCKER）

- [ ] 完整備份 `pb_data` + storage（見 `BACKUP-RESTORE.md`）
- [ ] 確認備份可讀／checksum
- [ ] 寫下備份路徑與時間

未完成 → **停止**，狀態維持未遷移。

## 1. Preflight（唯讀）

於 repo：

```bash
npm run preflight
# optional: HK_PREFLIGHT_PB_URL=https://your-pb-host
```

預期：

- `status: "READY_FOR_MANUAL_MIGRATION"`（無 blockers）
- 腳本**不**執行 migration、不寫入 PB

另建議：

```bash
npm run migrate:check
npm run typecheck && npm run lint && npm run build
npm run security:secrets
```

## 2. Review

- [ ] 閱讀 `pb_migrations/`（含 policy／finance／service accounts）
- [ ] 確認僅 `hk_*`
- [ ] 對照 `docs/DATABASE-SCHEMA.md`／`docs/POCKETBASE-DATA-LAYER.md`
- [ ] **不要**部署 `pb_hooks/` 到 PocketBase 主機（業務在 Cloudflare；見 `docs/PB-HOOKS-MIGRATION-MATRIX.md`）

## 3. Manual apply（controlled environment first）

依組織 PocketBase 作業方式擇一（範例，**以實際主機程序為準**）：

1. 將 **`pb_migrations/`** 同步到主機（**不要**同步 `pb_hooks/`）。
2. 重啟或依維運流程讓 PocketBase **套用 migrations**（建立 `hk_*` schema／seed）。
3. 驗證：Admin UI 可見 `hk_*`；API Rules／indexes 符合預期；非 `hk_*` 未被改動。
4. 建立受限 **service account**；用 Cloudflare Worker secrets 驗證可讀 `hk_*`。
5. `/api/hk/*` **不會**因 PB 重啟而出現 — 該路徑由 Cloudflare Worker 提供。

## 4. Production apply

僅在 staging 成功 + backup gate 簽署後：

- [ ] 維護公告（如需要）
- [ ] Backup gate 再做一次（production）
- [ ] Apply
- [ ] Smoke（登入、表單、送件、通知、PDF — 依範圍）
- [ ] 觀察錯誤 log／cron

失敗 → 進入 Rollback。

## 5. Rollback

1. 停止寫入。
2. **Restore** 備份的 `pb_data` + files。
3. 還原 hooks／前端至相容版本（Git tag）。
4. 驗證資料與檔案。
5. 事後檢討；修正 migration 後重新走 gate。

> 空的 `down` function（例如僅 patch options）**不能**保證資料回到遷移前狀態。

## Status vocabulary

| Label | Meaning |
| --- | --- |
| `READY_FOR_MANUAL_MIGRATION` | 程式與 preflight 就緒，待人工 backup + apply |
| `BLOCKED` | preflight／backup／相依未滿足 |
| `APPLIED` | 僅在人工確認後使用 |
| `ROLLED_BACK` | 已 restore |

**不要**把 `READY_FOR_MANUAL_MIGRATION` 說成「production 已遷移完成」。
