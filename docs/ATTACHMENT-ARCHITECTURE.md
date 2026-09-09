# Attachment Architecture

弘愛築夢 — 附件與已簽文件（Phase 8）。

## Principles

- 所有附件可能含敏感個資；**禁止**公開 URL、靜態 assets、依 original filename 建 path。
- Collections deny-by-default；上傳／下載僅 trusted `/api/hk/*`。
- `original_filename` 僅顯示；`stored_filename` 為 server random。
- Answer 只存 attachment record IDs，不存 bytes／公開 URL。

## Collection

`hk_attachments`：統一 metadata（owner、context relations、mime、sha256、status、scan_status）。

`hk_signed_documents`：綁定 `source_pdf`（須為目前 valid PDF）+ attachment；版本 supersede。

## Validation

Server（`hk_attachment_security.js`）：

1. Extension allowlist（依 context）
2. Forbidden list（exe/js/html/svg…）
3. Reported MIME
4. Magic bytes（PDF／JPEG／PNG；DOCX 至少 ZIP PK）
5. Size：`min(HK_MAX_UPLOAD_SIZE_MB, field/task max)` 預設 10MB
6. Filename sanitize（path traversal／control chars）
7. SHA-256（非 MD5／SHA-1）

Frontend 檢查僅 UX。

## Malware Scan

`scanAttachment()` → `{ status: 'not_configured' }`  

**Production malware scanning 尚未配置。** 勿宣稱已受 Malware 防護。

## Signature Upload Mode

`disabled`｜`optional`｜`required`（category PDF／funding config）

- required：無對應 latest valid PDF 的 active signed document 不可送件
- 舊 PDF 版本不可作為 required 簽核來源

## Download

`GET /api/hk/attachments/:id/download`

- Student：自己的
- Staff：Scope 內 Application 相關
- Admin：全部
- Public：禁止
- disposition：`attachment` 或安全格式 `inline`（PDF／JPG／PNG）
- `safeContentDispositionFilename` 防 Header Injection

## Backup TODO

部署必須備份 `pb_data`（含 file storage）：signed documents、補件、成果證據。

## Out of scope

Email／催收（Phase 9）。
