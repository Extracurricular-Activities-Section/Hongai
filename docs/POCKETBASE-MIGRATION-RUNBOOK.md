# PocketBase Migration Runbook

人工套用 `had_*` migrations 的作業手冊。

> **Default status：READY_FOR_MANUAL_MIGRATION**  
> Preflight 通過 ≠ 已套用。本 runbook **不會**自動對 production 寫入。

## Principles

1. 只操作 `had_*` collections；禁止動 `students`／`users`／`teachers`。
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
# optional: HAD_PREFLIGHT_PB_URL=https://your-pb-host
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

- [ ] 閱讀 `pb_migrations/` 新增檔（含 `1736500008_phase10_adjustments.js` 等）
- [ ] 確認僅 `had_*`
- [ ] 對照 `docs/DATABASE-SCHEMA.md`
- [ ] 部署對應 `pb_hooks/` 版本（Form Builder、notifications、PDF…）

## 3. Manual apply（controlled environment first）

依組織 PocketBase 作業方式擇一（範例，**以實際主機程序為準**）：

1. 將新 migrations／hooks 同步到主機。
2. 重啟或讓 PocketBase 載入 hooks。
3. 依官方／既有維運流程套用 migrations（或首次啟動自動 migrate — **僅在已 backup 後**）。
4. 驗證：

   - Admin UI／API 可見新／更新的 `had_*` 欄位
   - Form Builder draft／publish 抽樣
   - Notification delivery status 含 `skipped_provider_disabled`（若套用 phase10 patch）
   - 非 `had_*` collections 未被改動

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
