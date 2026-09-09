# Data Inventory（Technical）

技術觀點的資料盤點，供工程／維運使用。

> **本文件不做法律合規主張**（非個資法評估、非 DPIA、非「已合規」宣告）。  
> 實際法遵請由權責單位另案評估。

## Auth & identity

| Store | Key fields / notes | Sensitivity |
| --- | --- | --- |
| `had_students` | Auth 帳號；內部 random password | High（帳密機制） |
| `had_student_profiles` | 姓名、學號、**完整 `identity_number`**、聯絡方式、部別科系等 | **Critical** |
| `had_staff_users` | Staff/Admin；`is_staff`／`is_admin` | High |

## Period & application domain

| Store | Notes | Sensitivity |
| --- | --- | --- |
| `had_application_periods` | 梯次時窗與狀態 | Low–Med |
| `had_period_student_profiles` | 年級、特殊身分 codes、障礙／弱勢級距、銀行相關、資格說明 snapshot | High |
| `had_application_categories` | 9 大項目主檔 | Low |
| `had_student_category_entries` | 學生各項目入口狀態 | Med |
| `had_applications` + reviews／funding／supplements | 案件狀態機與核定 | High |
| Follow-up templates／tasks／reviews | 後續繳交與審核 | Med–High |

## Forms & PDF

| Store | Notes | Sensitivity |
| --- | --- | --- |
| `had_forms`／versions／sections／fields／options／rules | Schema；published immutable | Low–Med |
| `had_form_submissions`／answers／submission_versions | 答案與 snapshot（snapshot 可含完整身分證） | **Critical** |
| `had_pdf_documents` | PDF metadata、SHA-256、verification_token、file | **Critical**（檔案） |
| `had_attachments` | 上傳檔與 metadata | **Critical**（檔案） |

## Notifications

| Store | Notes | Sensitivity |
| --- | --- | --- |
| `had_notification_templates` | 範本 | Low |
| `had_notifications` | 站內通知 | Med（可能含業務上下文） |
| `had_notification_deliveries` | 寄送狀態；**不應**存 SMTP 密碼 | Med |
| `had_notification_preferences` | 學生偏好 | Low–Med |
| `had_reminder_rules`／`had_scheduled_notifications` | 排程與 dedupe | Low–Med |

## Audit & ops

| Store | Notes | Sensitivity |
| --- | --- | --- |
| Audit logs（hooks 寫入） | 行為追蹤；禁止完整身分證／credential／答案全文 | Med |
| Server env secrets | Mail／PDF／scheduler | **Critical** |
| Backups of `pb_data` + storage | 等同全集敏感資料 | **Critical** |

## Processing locations（technical）

| Location | Data |
| --- | --- |
| Browser sessionStorage | Auth tokens（分學生／後台） |
| Cloudflare Pages | 靜態資產；無 DB |
| PocketBase host | 權威資料與檔案 |
| PDF sidecar | 暫存繪製請求／產出（經 trusted channel） |
| Mail provider（若啟用） | 收件者與信件內容 |

## At-rest note

`identity_number` 目前模型為資料庫欄位明文存取控制（API 遮罩／權限）。  
Volume／應用層加密選項見 `IDENTITY-AT-REST.md`（**NOT CONFIGURED**）。
