# Reward System

獎勵與補助（Grant）分模型：

| | Grant | Reward |
| --- | --- | --- |
| Collection | applications / disbursement_* | `hk_rewards` + `hk_reward_rules` |
| 觸發 | 申請核定流程 | 獨立獎勵案 |
| 驗證 | funding summary / caps | `validateRewardDraft` |

`is_grant` 在 reward validate 回應中固定為 `false`。
