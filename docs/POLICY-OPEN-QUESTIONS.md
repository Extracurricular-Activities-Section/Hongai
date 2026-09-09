# Policy Open Questions

說明會／簡報中**無法從現有資料確認**、或存在歧義的規則。  
**禁止**在確認前寫死實作行為；對應資料列標 `needs_policy_confirmation=true`。

| ID | Topic | Ambiguity | Default until confirmed |
| --- | --- | --- | --- |
| P-01 | 弱勢助學「第六級」／特殊需求補助金額 | 簡報版面解析不確定 | Admin 可設定；系統不猜金額 |
| P-02 | 學年度「至少兩項」期末是否 hard block | 政策語氣 vs 系統強制 | 單學期不 block；學年末行為待確認 |
| P-03 | 海外研修「國際交流相關期限與額度」精確數字 | 需求指向外部規則 | category rule 可設定；無預設硬數字 |
| P-04 | 生活補助是否與項目補助互斥／加總規則細節 | 簡報未完整展開 | 先分開顯示；核定由承辦 |
| P-05 | 成績獎勵（課業）是否完全無申請、僅次學期批次 | 「通常」用語 | Reward 流程獨立；觸發方式待確認 |
| P-06 | 正式網域名稱 | 僅示例 subdomain | 全走 env：`HK_STUDENT_APP_URL`／`HK_MANAGE_APP_URL` |
| P-07 | `db.keson.pro` 是否已有 `hk_*` 資料 | Runtime NOT VERIFIED | 遷移前必須探測 |
| P-08 | PDF 是否必須上 Workers | 相容性未知 | 預設獨立 sidecar；benchmark 後再決定 |
| P-09 | Cookie session 跨 apply／manage 子網域 | 資安與登入 UX 權衡 | 先相容方案；再切 HttpOnly |
| P-10 | Staff 預設可否自 Publish 表單 | 需求給預設 Admin publish | 實作 `can_publish_forms`；預設 false |

更新時註明日期與確認來源（會議／公文／承辦回覆）。
