# Threat Model

弘愛築夢申請管理系統威脅模型（更新至 Phase 9）。

## Assets

- `had_students` / `had_student_profiles`（含 identity_number）
- `had_period_student_profiles`（梯次資格 snapshot）
- `had_student_category_entries`（申請入口狀態）
- Staff/Admin 帳號與單位授權
- Auth tokens（sessionStorage）
- Identity reset requests / audit logs
- Schema migrations / hooks

## Entry Points

- `/` 學生登入、`/register`、`/help`
- `/student/*`（current / confirm / category / history）
- `/admin/login`、`/admin/periods`、`/admin/students`
- `/api/had/*` custom routes
- PocketBase Auth endpoints（staff）

## Key Threats

1. 猜測學號+後四碼 → lockout + 統一錯誤 + Cloudflare rate limit TODO
2. IDOR 讀他人 profile / history / period profile → session student id + ownership
3. Mass assignment 改 identity_number → profile update allowlist
4. 使用既有 production `students` → `had_` namespace isolation
5. Secret / Superuser 進前端 → 禁止；Admin ≠ Superuser
6. Identity reset enumeration → 統一回應
7. Audit 竄改 → deny client write
8. Session XSS → sessionStorage 風險文件化
9. Migration 破壞外部 Collection → migrate:check 拒絕非 had_
10. Staff 無角色仍登入 → authRule + onRecordAuthRequest
11. **竄改 client time 以延長申請** → server time 判定 open window
12. **直接 POST 歷史 period id** → `assertCurrentEditablePeriod` / open period check
13. **Overlapping open periods** → Admin API 阻止
14. **套用上一期卻改到舊資料** → Copy-on-create snapshot，非 relation
16. Form answer mass assignment / 竄改 status → allowlist + server fields
17. XSS via textarea → plain text only
18. Copy previous 竄改他人 submission id → server 自找歷史
20. PDF 公開 URL / 可猜測 token → high-entropy token + protected download
21. Verification 頁 PII 洩漏 → 僅狀態與非個資 metadata
22. PDF HTML/SSRF → 純文字、不 fetch URL field
23. 舊 PDF 先作廢再生成失敗 → 先建新檔成功後再 supersede
24. Staff 瀏覽全校案件 → assignment / department scope
25. 搜尋學號繞過 scope → server filter within scope
26. Client 直接寫 status / approved_amount → action + server calculate
27. Internal note 洩給學生 → student-safe endpoints
28. 送件後偷改表單 → freeze + guards
29. 非法狀態跳轉 → state machine
30. 公開附件 URL／猜 ID 下載 → trusted download + ownership/scope
31. 偽 PDF／惡意副檔名 → magic bytes + allowlist
32. Path traversal／Header injection filename → sanitize
33. Follow-up IDOR → parent Application scope
34. Mail secret 進前端 → 禁止 VITE_；server-only
35. 公開排程端點 → HAD_SCHEDULER_SECRET
36. Template injection → 僅 {{var}}，無 eval
37. 重複核定 Email → idempotency_key
38. Email 含完整身分證 → 模板禁止；PII 最小化

## Residual Risks

- Hooks/migration/upload/email **尚未** runtime 驗證於 production（NOT RUNTIME VERIFIED）
- **Production Mail Provider NOT CONFIGURED**
- IP Rate Limit 未完成
- Malware scanning not_configured
- File storage backup 須納入部署
