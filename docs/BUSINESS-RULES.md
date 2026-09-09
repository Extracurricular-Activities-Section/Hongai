# Business Rules

Canonical rule engines live in:

- Cloudflare Worker: `workers/hk-api/src/rules/*`
- Shared browser helpers: `src/shared/rules/academic-funding.ts`

| Engine | Endpoint / helper | Notes |
| --- | --- | --- |
| Academic year | `POST /api/hk/rules/academic-year/progress` | 最少 2 項；單學期不 hard-block |
| Annual funding | `POST /api/hk/rules/funding/annual-summary` | 預設 150,000 |
| Eligibility | `POST /api/hk/rules/eligibility/evaluate` | `needs_policy_confirmation` → 不自動判定 |
| Living allowance | `POST /api/hk/rules/living-allowance/lookup` | 未知級距 → open question |
| Disbursement gate | `POST /api/hk/rules/disbursement/gate` | `auto_paid_on_review: false` |
| Reward validate | `POST /api/hk/rules/rewards/validate` | Grant ≠ Reward |

Policy open questions: `docs/POLICY-OPEN-QUESTIONS.md`.
