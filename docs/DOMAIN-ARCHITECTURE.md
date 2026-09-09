# Domain Architecture

| Surface | 產品名 | Entry | 預設路徑 |
| --- | --- | --- | --- |
| apply | 弘愛築夢申請系統 | `apply.html` | `/` 學生登入 |
| manage | 弘愛築夢管理系統 | `manage.html` | `/` → `/admin/login` |
| all（本機開發） | 合併 | `index.html` | 完整 router |

正式環境以 subdomain 對應不同 entry（`HK_STUDENT_APP_URL` / `HK_MANAGE_APP_URL`），同一 repository、共用 UI／types。

文件連結：

- Private doc：`/doc/{token}`（規劃；需登入）
- Public verify：`/verify/{token}`（已存在）
