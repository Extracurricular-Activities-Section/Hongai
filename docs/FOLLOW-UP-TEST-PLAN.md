# Follow-up Test Plan

Phase 8 — **NOT RUNTIME VERIFIED**。

| # | Case | Expected |
| --- | --- | --- |
| 23 | auto create after funding | tasks created |
| 24 | duplicate auto create | no duplicate |
| 25 | manual task | created in scope |
| 26 | submit no review | approved |
| 27 | submit review required | under_review |
| 28 | approve | approved + completed_at |
| 29 | supplement_required | student can resubmit V2 |
| 30 | reject + allow_resubmit | per flag |
| 31 | resubmit versions | V1 superseded keep |
| 32 | overdue display | is_overdue true；仍可繳 |
| 33 | waive | reason + audit；unblocks close |
| 34 | close blocking | required incomplete → reject close |
| S | Staff other dept task | 403 |
| St | Student delete task | no API |
