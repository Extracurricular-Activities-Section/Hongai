# Form Engine Test Plan

**狀態：NOT RUNTIME VERIFIED**（需套用 migration + hooks 後實測）

## Schema

| # | 案例 | 預期 |
| --- | --- | --- |
| 1 | 9 Forms 載入 | Admin `/admin/forms` 顯示 9 筆 |
| 2 | published version | current_published_version 指向 V1 |
| 3 | section order | 依 sort_order |
| 4 | field order | 依 sort_order |
| 5 | options | select/radio 有選項 |
| 6 | rules | has_advisor 等條件顯示 |

## Draft

| # | 案例 | 預期 |
| --- | --- | --- |
| 7 | 建立 submission | workspace 自動建立 |
| 8 | autosave | debounce 後 last_saved_at 更新 |
| 9 | refresh | 答案還在 |
| 10 | continue | 可繼續編輯 |
| 11 | required 空白 | 仍可 draft |

## Complete

| # | 案例 | 預期 |
| --- | --- | --- |
| 12 | required missing | 400 |
| 13 | conditional required | advisor 等 |
| 14 | computed totals | sum / date diff |
| 15 | date invalid | start > end 拒絕 |
| 16 | complete success | status=completed + snapshot |

## Security

| # | 案例 | 預期 |
| --- | --- | --- |
| 17 | A 讀 B submission | 拒絕 |
| 18 | A 改 B answer | 拒絕 |
| 19 | historical period write | 拒絕 |
| 20 | expired period autosave | 拒絕 |
| 21 | mass assignment status | 忽略／無效 |

## Copy

| # | 案例 | 預期 |
| --- | --- | --- |
| 22 | same version | 複製成功 |
| 23 | different version | 依 code 相容複製 |
| 24 | removed field | 略過 |
| 25 | new field | 空／default |
| 26 | incompatible type | 不硬塞 |

## History

| # | 案例 | 預期 |
| --- | --- | --- |
| 27 | readonly | 無編輯控件 |
| 28 | latest version | 顯示最新 snapshot |
| 29 | profile snapshot | 含 period/student 摘要 |
