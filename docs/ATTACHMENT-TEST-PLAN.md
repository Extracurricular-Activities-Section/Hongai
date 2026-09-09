# Attachment Test Plan

Phase 8 — **NOT RUNTIME VERIFIED**（未對正式 PocketBase 端到端執行前勿宣稱通過）。

靜態：`npm run attachment:smoke`（magic bytes）。

| # | Case | Expected |
| --- | --- | --- |
| 1 | valid PDF | accept |
| 2 | fake PDF (wrong magic) | reject |
| 3 | exe renamed .pdf | reject |
| 4 | oversized | reject |
| 5 | Student A/B download | 403 |
| 6 | Staff out of scope | 403 |
| 7 | unauthenticated download | 401 |
| 8 | path traversal filename | sanitized |
| 9 | header injection filename | sanitized |
| 10 | deleted attachment download | deny |
| 11 | superseded still downloadable by owner/staff | allow metadata; policy as implemented |
| 12 | required file field empty on complete | reject |
| 13 | signed vs current valid PDF | OK |
| 14 | signed vs superseded PDF | reject (required) |
| 15–17 | optional / required / disabled modes | per config |
| 18–22 | supplement submit + attachments + accept/needs_more | per workflow |
