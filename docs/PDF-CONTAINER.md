# PDF on Cloudflare Containers

正式產 PDF：**Node `pdf-engine` 跑在 Cloudflare Container**；`hk-api` 之後以 secret 呼叫。

## 架構

```text
hk-api（調度／存 PB）
    → HTTPS + X-HK-PDF-SECRET
    → Worker `hk-pdf`（Durable Object）
        → Container（Node pdf-lib + 中文字型）
```

| 元件 | 路徑 |
| --- | --- |
| 繪製引擎 | `pdf-engine/`（Dockerfile、service.mjs） |
| CF 入口 | `workers/hk-pdf/` |

---

## 推薦：Workers Builds（本機不必裝 Docker）

雲端建映像＋部署，效果與本機 Docker 相同。

### A. 先把程式推上 GitHub

確認 `workers/hk-pdf/`、`pdf-engine/Dockerfile` 等已在 repo（本專案 remote：`Extracurricular-Activities-Section/Hongai`）。

### B. Cloudflare Dashboard 連接 Builds

1. 開啟 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Import a repository**（或既有 Worker `hk-pdf` → Settings → Builds → Connect）
3. 選 GitHub repo **Hongai**
4. 設定：

| 欄位 | 建議值 |
| --- | --- |
| Worker name | **`hk-pdf`**（必須與 `workers/hk-pdf/wrangler.jsonc` 的 `name` 一致） |
| Production branch | `master`（或你的正式分支） |
| Root directory | **倉庫根目錄**（留空／`.`，不要只選 `workers/hk-pdf`，否則找不到 `pdf-engine/`） |
| Build command | `npm --prefix workers/hk-pdf ci` |
| Deploy command | **`npx wrangler deploy -c workers/hk-pdf/wrangler.jsonc`** |

5. Save and Deploy（首次可能要數分鐘等 Container 就緒）

### C. 設定 Secret

Dashboard → Worker `hk-pdf` → Settings → Variables → **Encrypt** `HK_PDF_SERVICE_SECRET`  
（或本機已 `wrangler login` 後：`npx wrangler secret put HK_PDF_SERVICE_SECRET -c workers/hk-pdf/wrangler.jsonc`）

### D. 驗收

- `GET https://hk-pdf.<你的子網域>.workers.dev/health` → `{ ok: true }`
- `POST /render` + `X-HK-PDF-SECRET` → PDF  
  首次冷啟動可能較慢；若 5xx 等幾分鐘再試

之後每次 **push 到 production 分支** 會自動重建映像並部署。

---

## 備援：本機 Docker 部署

需 Docker Desktop + `wrangler login`：

```bash
npm run pdf:container:install
npm run pdf:container:deploy
```

---

## 與 hk-api 接線（再下一步）

- `HK_PDF_SERVICE_URL` = `https://hk-pdf.<subdomain>.workers.dev`
- `HK_PDF_SERVICE_SECRET` = 與上面相同  
然後實作產檔 API（讀申請 → `/render` → 寫回 `hk_applications.files`）。

## 字型／版型

- 規則：中文標楷體、英文／數字 Times New Roman
- GitHub 公開 repo **不要** commit 專有字型；Builds 預設用開源近似（AR PL KaitiM + Liberation Serif）
- 要完全一致：日後用私有字型來源或私有 registry 映像覆寫 `PDF_FONT_*_PATH`

## 注意

- 不要把產 PDF 塞進 `hk-api` Worker 本體
- 不要把 PocketBase Superuser 放進任何 Worker
- 非 production 分支預設 `versions upload` **不會**更新 Container 映像；正式請用 production + `wrangler deploy`
