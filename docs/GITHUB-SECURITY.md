# GitHub Security Recommendations

本文件記錄在 GitHub（或相容托管）建立 Private Repository 後，建議啟用的安全設定。

> 注意：以下項目僅為建議清單。**不要假裝已啟用**，除非 Organization 設定可證。  
> 狀態預設：**NOT CONFIGURED**（見 `RUNTIME-VERIFICATION-MATRIX.md`）。

## Required Direction

- Private Repository
- Branch Protection（至少保護 `main`）
- Pull Request Review（合併前需審查）
- Dependabot Alerts
- Dependabot Security Updates
- Secret Scanning
- Push Protection
- CodeQL / Code Scanning
- Restrict Force Push
- Required Status Checks（至少 build / typecheck / lint）

## Branch Protection（建議規則）

保護分支：`main`（必要時含 `release/*`）

1. **Restrict direct pushes** — 禁止直接 push 到受保護分支
2. **Require a pull request before merging**
3. **Require approvals** — 至少 1 位 reviewer（依組織人力調整）
4. **Require status checks to pass** — 例如 `typecheck`、`lint`、`build`（CI 就緒後勾選）
5. **Require branches to be up to date**（建議）
6. **Do not allow force pushes**
7. **Do not allow deletions** of the protected branch
8. （可選）Require conversation resolution before merging
9. （可選）Restrict who can push／bypass — 僅限維運角色

## Secrets Hygiene

- 不要將 `.env`、PocketBase Superuser Token、Admin Password、`HAD_*_SECRET`、SMTP／API keys 提交到 Git
- 僅提交 `.env.example` 與 `docs/PRODUCTION-ENV.md` 占位符
- 前端只允許公開設定（如 `VITE_POCKETBASE_URL`）
- CI secrets 使用 GitHub Actions secrets／OIDC；masked logs

## After Repository Creation Checklist

- [ ] 建立 Private Repository：`hong-ai-dream-system`
- [ ] 啟用 Branch Protection（依上節）
- [ ] 啟用 Dependabot Alerts / Security Updates
- [ ] 啟用 Secret Scanning + Push Protection
- [ ] 啟用 Code Scanning（CodeQL）
- [ ] 設定 Required Status Checks
- [ ] 確認 `.env`／`pb_data`／備份檔未被追蹤
- [ ] 對照 `CONTRIBUTING.md` 更新 PR 範本（可選）

## Phase 10 note

上線準備文件已完成，但 GitHub 防護與 production 部署仍為人工配置項。  
未啟用 branch protection 前，不應宣稱「供應鏈／合併流程已 hardening 完成」。
