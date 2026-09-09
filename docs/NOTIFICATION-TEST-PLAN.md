# Notification Test Plan

Phase 9 — **NOT RUNTIME VERIFIED**（production mail **NOT CONFIGURED**）。

靜態：`npm run notification:smoke`

| # | Case | Expected |
| --- | --- | --- |
| 1–6 | Student own / A-B / unread / read / read-all / staff scope | ownership |
| 7–10 | render / missing var / sanitize / no eval | smoke |
| 11–14 | funding notify / queue / idempotency / revise | no dup |
| 15–16 | supplement / deadline schedule | |
| 17–23 | follow-up reminders / skip completed / overdue | |
| 24–25 | event reminder / timezone | |
| 26–32 | queue success / fail / retry / max / resend / lease | |
| 33–37 | secret leak / scheduler auth / PII / scope | |

區分：notification logic / test provider / **production provider NOT CONFIGURED**。
