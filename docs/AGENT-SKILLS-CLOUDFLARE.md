# Agent Skills — Cloudflare Architecture Wave

**Date:** 2026-09-10  
**Trigger:** 全系統需求統整 + Cloudflare 架構遷移（非 UI-only）

## Model

| Item | Result |
| --- | --- |
| Fit | Audit／Plan：目前 Auto／Composer 可勝任 |
| Recommendation | 實作 Workers／Auth Gateway 大波次時，建議切換高推理模型（Quality > Speed） |
| Auto-switch | 無法保證自動切換 |

## Search

Actual search: GitHub `cloudflare/skills`、Cloudflare Agent Setup docs、Workers skill candidates.

## Install decisions

| Skill | Quality | Security | Compatibility | Conflict | Decision |
| --- | --- | --- | --- | --- | --- |
| cloudflare | PASS | PASS（官方） | PASS | NONE | Installed `.cursor/skills/cloudflare/` |
| wrangler | PASS | PASS | PASS | NONE | Installed `.cursor/skills/wrangler/` |
| workers-best-practices | PASS | PASS | PASS | NONE | Installed `.cursor/skills/workers-best-practices/` |
| agents-sdk | PASS content | PASS | FAIL（AI Agents 非本系統） | — | Not installed |
| Third-party mirrors | — | Reject uncertain | — | — | Rejected |

**Method:** `gh api` → write `SKILL.md` only. No curl|bash, no secret installers.

## Existing skills still in force

UI redesign skills remain for **UI adaptation only**（禁止整站重設計）。  
`.cursor/rules/had-ui-ux.mdc` 須在實作波次修訂，以允許本次架構遷移。
