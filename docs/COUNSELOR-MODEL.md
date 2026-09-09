# Counselor Model

- `hk_counselors`：姓名、學術單位、email、分機、有效期間。
- `hk_department_counselors`：學術單位 → 輔導老師指派。
- 與審核單位 `hk_departments`／`hk_category_department_assignments` 分離：輔導老師≠承辦單位。
- 紙本簽名／表單欄位中的「老師」不對應系統登入角色；**不要**修改共用 `teachers` collection。
