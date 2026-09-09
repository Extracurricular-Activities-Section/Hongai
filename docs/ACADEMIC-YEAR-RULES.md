# Academic Year Rules

- 預設：每學年度至少完成 **2** 項計畫類別。
- 進度公式：`completed = unique(completed_category_codes).length`。
- `meets_minimum` 僅供提示／儀表；**不得**因未達 2 項而硬擋單次申請送出。
- 年度補助上限預設 **150,000**（與 funding summary 共用政策列 `hk_academic_year_policies`）。
- Worker：`workers/hk-api/src/rules/academic-year.ts`
- UI：學生首頁顯示 `x / 2` 進度。
