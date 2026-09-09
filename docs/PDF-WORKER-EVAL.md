# PDF Worker Evaluation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep `pdf-engine` sidecar | 既有中文字型路徑；記憶體充足 | 需獨立 process | **Default — keep** |
| Cloudflare Worker PDF | 少一台服務 | Worker 記憶體／字型包過大風險 | 暫不遷移 |

Orchestration 仍可由 CF proxy `/api/hk/...` → PB hooks → `HK_PDF_SERVICE_URL`。
Private `/doc/:token`（需登入）≠ public `/verify/:token`。
