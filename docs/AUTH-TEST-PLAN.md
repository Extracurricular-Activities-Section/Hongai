# Auth Test Plan（Phase 3）

本文件為手動 / 部署後驗證計畫。  
目前狀態：**NOT RUNTIME VERIFIED**（hooks / migration 尚未套用至可執行 PocketBase）。

## Preconditions

- 受控 PocketBase 已套用 `hk_*` migration
- `pb_hooks/` 已掛載
- 前端 `.env` 指向該實例
- 已建立至少一筆 `hk_staff_users`（active + is_staff/is_admin）供後台測試

## Register

- [ ] 正常註冊 → 成功並導向 `/student`
- [ ] 重複學號 → 安全錯誤訊息（不暴露內部細節）
- [ ] 缺欄位 → Zod / server validation
- [ ] Invalid email → 擋下
- [ ] Double submit → button disabled，不重複建立
- [ ] 註冊後 F5 → session 仍有效（sessionStorage）

## Student Login

- [ ] 正確學號 + 後四碼 → `/student`
- [ ] 錯誤學號 → 統一「學號或身分驗證資料錯誤」
- [ ] 錯誤後四碼 → 同上（不可區分）
- [ ] 連續 5 次錯誤 → lockout 15 分鐘訊息
- [ ] lock 期間登入 → 鎖定訊息
- [ ] lock expiry 後可再登入
- [ ] inactive student → 統一錯誤
- [ ] 成功後 failed_login_count 歸零

## Ownership

- [ ] Student A 可看自己 profile
- [ ] Student A 無法以 record id 取得 Student B profile（API / UI）
- [ ] Student A 無法更新 Student B
- [ ] 前端即使送 student_id 也不被信任（endpoint 只用 `@request.auth.id`）

## Profile

- [ ] 可修改 phone / email / 科系等 allowlist 欄位
- [ ] 無法修改 identity_number（唯讀；endpoint 忽略）
- [ ] 無法修改 student relation
- [ ] 無法 list 全部 profiles

## Backoffice

- [ ] Staff login 成功
- [ ] Admin login 成功
- [ ] inactive staff 拒絕
- [ ] is_staff=false && is_admin=false 拒絕
- [ ] Student token 無法進入 `/admin`
- [ ] Staff token 無法進入 `/student` 作為學生 ownership
- [ ] Sidebar：僅 Admin 見帳號/單位/梯次

## Identity reset

- [ ] 公開送出成功，回覆統一訊息
- [ ] 不因學號是否存在而改變訊息（anti-enumeration）
- [ ] Staff 可看列表並改狀態 / 備註
- [ ] Admin 可解除鎖定

## Session

- [ ] 學生登出清除 student session，不影響 staff session
- [ ] 後台登出清除 staff session
- [ ] token 失效後 guard 導回登入，無無限 redirect

## Negative / Security

- [ ] 前端沒有呼叫 `pb.collection('students')`
- [ ] 未寫入完整 password / token / identity_number 到 audit metadata
- [ ] Admin UI 不是 PocketBase Superuser
