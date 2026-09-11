# PDF Worker Evaluation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Cloudflare **Containers** + `pdf-engine` | 全在 CF 帳號；Node + 中文字型可行 | 需 Docker 建置；冷啟動 | **Default — use**（見 `docs/PDF-CONTAINER.md`） |
| 獨立 Node sidecar（非 CF） | 記憶體充足、單純 | 多一個非 CF 主機 | 備援 |
| Cloudflare Worker 內產 PDF | 少一台服務 | Worker 記憶體／字型包過大風險 | **不做** |

Orchestration：`hk-api` → `HK_PDF_SERVICE_URL`（`hk-pdf` Worker）→ Container `/render` → 寫回 PocketBase。  
Private `/doc/:token`（需登入）≠ public `/verify/:token`。
