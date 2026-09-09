/**
 * Phase 5 — 9 form V1 definitions (category-specific fields only).
 * Used by migration seed (via pb_hooks/hk_form_seed.js).
 * React must NOT hardcode these; runtime loads schema from DB/API.
 */
module.exports = {
  FIELD_TYPES: [
    'text',
    'textarea',
    'number',
    'currency',
    'date',
    'date_range',
    'select',
    'radio',
    'checkbox',
    'multiselect',
    'repeat_group',
    'monthly_plan',
    'computed',
    'display',
    'url',
    'email',
    'file',
  ],

  /** @returns {Array<object>} */
  getFormDefinitions() {
    return [
      languageCertification(),
      commonCompetency(),
      otherForm(),
      externalCompetition(),
      overseasStudy(),
      professionalCertification(),
      careerEnhancement(),
      crossDomainLearning(),
      academicLearning(),
    ]
  },
}

function f(partial) {
  return Object.assign(
    {
      required: false,
      help_text: '',
      placeholder: '',
      default_value: null,
      validation: null,
      config: null,
      pdf_visible: true,
      copy_previous: true,
      active: true,
      options: [],
    },
    partial,
  )
}

function rule(partial) {
  return Object.assign({ sort_order: 0, config: null }, partial)
}

function languageCertification() {
  return {
    category_code: 'language_certification',
    name: '弘愛築夢外語檢定',
    description: '外語檢定專屬申請內容（不含共用基本資料）',
    sections: [
      {
        code: 'language_plan',
        title: '外語檢定規劃內容',
        description: '',
        sort_order: 1,
        fields: [
          f({ code: 'goal', label: '目標', field_type: 'textarea', required: true, sort_order: 1 }),
          f({
            code: 'exam_item',
            label: '報考考試項目',
            field_type: 'text',
            required: true,
            sort_order: 2,
          }),
          f({
            code: 'requested_items',
            label: '希望補助項目',
            field_type: 'repeat_group',
            required: false,
            sort_order: 3,
            config: {
              max_rows: 20,
              columns: [
                { code: 'item_name', label: '項目名稱', field_type: 'text', required: true },
                { code: 'amount', label: '金額', field_type: 'currency', required: true },
              ],
            },
          }),
        ],
      },
      {
        code: 'execution',
        title: '執行期程與補助金額',
        sort_order: 2,
        fields: [
          f({ code: 'exam_date', label: '考試日期', field_type: 'date', required: false, sort_order: 1 }),
          f({
            code: 'training_start',
            label: '培訓期間（起日）',
            field_type: 'date',
            required: false,
            sort_order: 2,
          }),
          f({
            code: 'training_end',
            label: '培訓期間（迄日）',
            field_type: 'date',
            required: false,
            sort_order: 3,
          }),
          f({
            code: 'training_months',
            label: '共計月數',
            field_type: 'computed',
            required: false,
            sort_order: 4,
            copy_previous: false,
            config: { operation: 'date_diff_months', start: 'training_start', end: 'training_end' },
          }),
          f({
            code: 'living_expense',
            label: '生活補助費用',
            field_type: 'currency',
            required: false,
            sort_order: 5,
          }),
          f({
            code: 'exam_registration_fee',
            label: '外語檢定考試－報名費用',
            field_type: 'currency',
            required: false,
            sort_order: 6,
          }),
          f({
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'computed',
            required: false,
            sort_order: 7,
            copy_previous: false,
            config: {
              operation: 'sum',
              fields: ['living_expense', 'exam_registration_fee', 'requested_items.amount'],
            },
          }),
        ],
      },
      {
        code: 'monthly',
        title: '月份安排',
        sort_order: 3,
        fields: [
          f({
            code: 'monthly_plan',
            label: '1～12 月規劃內容',
            field_type: 'monthly_plan',
            required: false,
            sort_order: 1,
            config: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
          }),
        ],
      },
    ],
    rules: [],
  }
}

function commonCompetency() {
  return {
    category_code: 'common_competency',
    name: '弘愛築夢共通職能',
    description: '共通職能專屬申請內容',
    sections: [
      {
        code: 'plan',
        title: '學習規劃',
        sort_order: 1,
        fields: [
          f({ code: 'goal', label: '目標', field_type: 'textarea', required: true, sort_order: 1 }),
          f({
            code: 'learning_plan',
            label: '學習計畫',
            field_type: 'textarea',
            required: true,
            sort_order: 2,
          }),
          f({ code: 'club_name', label: '社團名稱', field_type: 'text', required: false, sort_order: 3 }),
          f({
            code: 'volunteer_organization',
            label: '參與志工服務機構名稱',
            field_type: 'text',
            required: false,
            sort_order: 4,
          }),
          f({
            code: 'position_title',
            label: '幹部職稱',
            field_type: 'text',
            required: false,
            sort_order: 5,
          }),
          f({
            code: 'other_description',
            label: '其他說明',
            field_type: 'textarea',
            required: false,
            sort_order: 6,
          }),
          f({
            code: 'term_start',
            label: '學期期程起日',
            field_type: 'date',
            required: false,
            sort_order: 7,
          }),
          f({
            code: 'term_end',
            label: '學期期程迄日',
            field_type: 'date',
            required: false,
            sort_order: 8,
          }),
          f({
            code: 'activity_plan',
            label: '活動規劃',
            field_type: 'textarea',
            required: false,
            sort_order: 9,
          }),
        ],
      },
      {
        code: 'funding',
        title: '補助金額',
        sort_order: 2,
        fields: [
          f({
            code: 'living_expense',
            label: '生活補助費用',
            field_type: 'currency',
            required: false,
            sort_order: 1,
          }),
          f({
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'currency',
            required: false,
            sort_order: 2,
          }),
        ],
      },
      {
        code: 'monthly',
        title: '月份安排',
        sort_order: 3,
        fields: [
          f({
            code: 'monthly_plan',
            label: '1～12 月份安排',
            field_type: 'monthly_plan',
            required: false,
            sort_order: 1,
            config: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
          }),
        ],
      },
    ],
    rules: [],
  }
}

function otherForm() {
  return {
    category_code: 'other',
    name: '弘愛築夢其他',
    description: '其他類專屬申請內容',
    sections: [
      {
        code: 'plan',
        title: '計畫內容',
        sort_order: 1,
        fields: [
          f({ code: 'goal', label: '目標', field_type: 'textarea', required: true, sort_order: 1 }),
          f({
            code: 'execution_start',
            label: '執行起日',
            field_type: 'date',
            required: false,
            sort_order: 2,
          }),
          f({
            code: 'execution_end',
            label: '執行迄日',
            field_type: 'date',
            required: false,
            sort_order: 3,
          }),
          f({
            code: 'duration_months',
            label: '共計月數',
            field_type: 'computed',
            sort_order: 4,
            copy_previous: false,
            config: { operation: 'date_diff_months', start: 'execution_start', end: 'execution_end' },
          }),
          f({ code: 'plan_name', label: '計畫名稱', field_type: 'text', required: true, sort_order: 5 }),
          f({
            code: 'plan_summary',
            label: '計畫摘要',
            field_type: 'textarea',
            required: true,
            sort_order: 6,
          }),
          f({
            code: 'expected_outcome',
            label: '預期成果',
            field_type: 'textarea',
            required: false,
            sort_order: 7,
          }),
          f({
            code: 'activity_plan',
            label: '活動規劃',
            field_type: 'textarea',
            required: false,
            sort_order: 8,
          }),
        ],
      },
      {
        code: 'advisor',
        title: '指導老師',
        sort_order: 2,
        fields: [
          f({
            code: 'has_advisor',
            label: '是否有指導老師',
            field_type: 'radio',
            required: true,
            sort_order: 1,
            options: [
              { value: 'true', label: '是', sort_order: 1 },
              { value: 'false', label: '否', sort_order: 2 },
            ],
          }),
          f({ code: 'advisor_name', label: '指導老師姓名', field_type: 'text', sort_order: 2 }),
          f({
            code: 'advisor_department',
            label: '指導老師單位',
            field_type: 'text',
            sort_order: 3,
          }),
          f({ code: 'advisor_title', label: '指導老師職稱', field_type: 'text', sort_order: 4 }),
          f({ code: 'advisor_phone', label: '指導老師電話', field_type: 'text', sort_order: 5 }),
          f({ code: 'advisor_email', label: '指導老師 Email', field_type: 'email', sort_order: 6 }),
          f({
            code: 'advisor_guidance',
            label: '指導內容說明',
            field_type: 'textarea',
            sort_order: 7,
          }),
        ],
      },
      {
        code: 'funding',
        title: '補助金額',
        sort_order: 3,
        fields: [
          f({
            code: 'requested_items',
            label: '希望補助項目',
            field_type: 'repeat_group',
            sort_order: 1,
            config: {
              max_rows: 20,
              columns: [
                { code: 'item_name', label: '項目名稱', field_type: 'text', required: true },
                { code: 'amount', label: '金額', field_type: 'currency', required: true },
              ],
            },
          }),
          f({
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'computed',
            sort_order: 2,
            copy_previous: false,
            config: { operation: 'sum', fields: ['requested_items.amount'] },
          }),
        ],
      },
      {
        code: 'monthly',
        title: '月份安排',
        sort_order: 4,
        fields: [
          f({
            code: 'monthly_plan',
            label: '1～12 月規劃',
            field_type: 'monthly_plan',
            sort_order: 1,
            config: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
          }),
        ],
      },
    ],
    rules: [
      rule({
        field_code: 'advisor_name',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_name',
        rule_type: 'require_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_department',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_title',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_phone',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_email',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_guidance',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
    ],
  }
}

function externalCompetition() {
  return {
    category_code: 'external_competition',
    name: '弘愛築夢校外競賽',
    description: '校外競賽專屬申請內容',
    sections: [
      {
        code: 'competition',
        title: '競賽規劃',
        sort_order: 1,
        fields: [
          f({ code: 'goal', label: '目標', field_type: 'textarea', required: true, sort_order: 1 }),
          f({
            code: 'training_type',
            label: '培訓類別',
            field_type: 'text',
            required: false,
            sort_order: 2,
          }),
          f({
            code: 'competition_name',
            label: '競賽名稱',
            field_type: 'text',
            required: true,
            sort_order: 3,
          }),
          f({
            code: 'competition_region',
            label: '競賽區域',
            field_type: 'select',
            required: false,
            sort_order: 4,
            options: [
              { value: 'national', label: '全國', sort_order: 1 },
              { value: 'regional', label: '區域', sort_order: 2 },
              { value: 'international', label: '國際', sort_order: 3 },
              { value: 'other', label: '其他', sort_order: 4 },
            ],
          }),
          f({
            code: 'competition_region_other',
            label: '其他競賽區域',
            field_type: 'text',
            sort_order: 5,
          }),
          f({
            code: 'competition_type_other',
            label: '其他競賽類別',
            field_type: 'text',
            sort_order: 6,
          }),
          f({
            code: 'competition_date',
            label: '競賽日期',
            field_type: 'date',
            sort_order: 7,
          }),
          f({ code: 'training_start', label: '培訓起日', field_type: 'date', sort_order: 8 }),
          f({ code: 'training_end', label: '培訓迄日', field_type: 'date', sort_order: 9 }),
          f({
            code: 'duration_months',
            label: '共計月數',
            field_type: 'computed',
            sort_order: 10,
            copy_previous: false,
            config: { operation: 'date_diff_months', start: 'training_start', end: 'training_end' },
          }),
          f({
            code: 'schedule_plan',
            label: '時程規劃',
            field_type: 'textarea',
            sort_order: 11,
          }),
          f({
            code: 'competition_registration_proof',
            label: '參與競賽報名表或活動資訊',
            field_type: 'file',
            required: true,
            sort_order: 12,
            copy_previous: false,
            config: {
              allowed_extensions: ['pdf', 'jpg', 'jpeg', 'png'],
              max_files: 3,
              max_file_size_mb: 10,
            },
          }),
        ],
      },
      {
        code: 'advisor',
        title: '指導老師',
        sort_order: 2,
        fields: [
          f({
            code: 'has_advisor',
            label: '是否有指導老師',
            field_type: 'radio',
            required: true,
            sort_order: 1,
            options: [
              { value: 'true', label: '是', sort_order: 1 },
              { value: 'false', label: '否', sort_order: 2 },
            ],
          }),
          f({ code: 'advisor_name', label: '指導老師姓名', field_type: 'text', sort_order: 2 }),
          f({
            code: 'advisor_department',
            label: '指導老師單位',
            field_type: 'text',
            sort_order: 3,
          }),
          f({ code: 'advisor_title', label: '指導老師職稱', field_type: 'text', sort_order: 4 }),
          f({ code: 'advisor_phone', label: '指導老師電話', field_type: 'text', sort_order: 5 }),
          f({ code: 'advisor_email', label: '指導老師 Email', field_type: 'email', sort_order: 6 }),
        ],
      },
      {
        code: 'funding',
        title: '經費',
        sort_order: 3,
        fields: [
          f({
            code: 'applied_other_funding',
            label: '是否申請其他計畫經費',
            field_type: 'radio',
            required: true,
            sort_order: 1,
            options: [
              { value: 'true', label: '是', sort_order: 1 },
              { value: 'false', label: '否', sort_order: 2 },
            ],
          }),
          f({
            code: 'other_funding_description',
            label: '其他計畫經費說明',
            field_type: 'textarea',
            sort_order: 2,
          }),
          f({
            code: 'living_expense',
            label: '生活補助費用',
            field_type: 'currency',
            sort_order: 3,
          }),
          f({
            code: 'competition_registration_fee',
            label: '競賽報名費',
            field_type: 'currency',
            sort_order: 4,
          }),
          f({
            code: 'transportation_fee',
            label: '交通費',
            field_type: 'currency',
            sort_order: 5,
          }),
          f({
            code: 'other_expenses',
            label: '其他費用',
            field_type: 'repeat_group',
            sort_order: 6,
            config: {
              max_rows: 20,
              columns: [
                { code: 'item_name', label: '項目名稱', field_type: 'text', required: true },
                { code: 'amount', label: '金額', field_type: 'currency', required: true },
              ],
            },
          }),
          f({
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'computed',
            sort_order: 7,
            copy_previous: false,
            config: {
              operation: 'sum',
              fields: [
                'living_expense',
                'competition_registration_fee',
                'transportation_fee',
                'other_expenses.amount',
              ],
            },
          }),
        ],
      },
    ],
    rules: [
      rule({
        field_code: 'competition_region_other',
        rule_type: 'show_if',
        source_field_code: 'competition_region',
        operator: 'equals',
        value: 'other',
      }),
      rule({
        field_code: 'advisor_name',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_department',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_title',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_phone',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'advisor_email',
        rule_type: 'show_if',
        source_field_code: 'has_advisor',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'other_funding_description',
        rule_type: 'show_if',
        source_field_code: 'applied_other_funding',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'other_funding_description',
        rule_type: 'require_if',
        source_field_code: 'applied_other_funding',
        operator: 'equals',
        value: true,
      }),
    ],
  }
}

function overseasStudy() {
  return {
    category_code: 'overseas_study',
    name: '弘愛築夢海外研修',
    description: '海外研修專屬申請內容',
    sections: [
      {
        code: 'overseas',
        title: '出國規劃',
        sort_order: 1,
        fields: [
          f({
            code: 'overseas_goal',
            label: '目標（出國目的）',
            field_type: 'textarea',
            required: true,
            sort_order: 1,
          }),
          f({
            code: 'international_activity_detail',
            label: '其他國際交流活動',
            field_type: 'textarea',
            sort_order: 2,
          }),
          f({ code: 'departure_date', label: '出國日期', field_type: 'date', sort_order: 3 }),
          f({ code: 'return_date', label: '返國日期', field_type: 'date', sort_order: 4 }),
          f({
            code: 'total_days',
            label: '共計天數',
            field_type: 'computed',
            sort_order: 5,
            copy_previous: false,
            config: { operation: 'date_diff_days', start: 'departure_date', end: 'return_date' },
          }),
          f({
            code: 'destination_country_city',
            label: '國家／城市',
            field_type: 'text',
            required: true,
            sort_order: 6,
          }),
          f({
            code: 'institution_name',
            label: '機構名稱',
            field_type: 'text',
            required: true,
            sort_order: 7,
          }),
          f({
            code: 'institution_address',
            label: '機構地址',
            field_type: 'text',
            sort_order: 8,
          }),
          f({ code: 'institution_url', label: '機構網址', field_type: 'url', sort_order: 9 }),
          f({
            code: 'institution_allowance',
            label: '是否提供津貼',
            field_type: 'radio',
            required: true,
            sort_order: 10,
            options: [
              { value: 'true', label: '是', sort_order: 1 },
              { value: 'false', label: '否', sort_order: 2 },
            ],
          }),
          f({
            code: 'allowance_detail',
            label: '津貼說明',
            field_type: 'textarea',
            sort_order: 11,
          }),
          f({
            code: 'applied_other_funding',
            label: '是否申請其他計畫經費',
            field_type: 'radio',
            required: true,
            sort_order: 12,
            options: [
              { value: 'true', label: '是', sort_order: 1 },
              { value: 'false', label: '否', sort_order: 2 },
            ],
          }),
          f({
            code: 'other_funding_detail',
            label: '其他計畫經費說明',
            field_type: 'textarea',
            sort_order: 13,
          }),
          f({
            code: 'activity_plan',
            label: '活動規劃',
            field_type: 'textarea',
            sort_order: 14,
          }),
        ],
      },
      {
        code: 'funding',
        title: '補助經費',
        sort_order: 2,
        fields: [
          f({ code: 'living_expense', label: '生活補助費用', field_type: 'currency', sort_order: 1 }),
          f({ code: 'outbound_flight', label: '機票（去）', field_type: 'currency', sort_order: 2 }),
          f({ code: 'return_flight', label: '機票（回）', field_type: 'currency', sort_order: 3 }),
          f({
            code: 'conference_registration_fee',
            label: '會議／活動報名費',
            field_type: 'currency',
            sort_order: 4,
          }),
          f({
            code: 'other_requested_items',
            label: '其他補助項目',
            field_type: 'repeat_group',
            sort_order: 5,
            config: {
              max_rows: 20,
              columns: [
                { code: 'item_name', label: '項目名稱', field_type: 'text', required: true },
                { code: 'amount', label: '金額', field_type: 'currency', required: true },
              ],
            },
          }),
          f({
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'computed',
            sort_order: 6,
            copy_previous: false,
            config: {
              operation: 'sum',
              fields: [
                'living_expense',
                'outbound_flight',
                'return_flight',
                'conference_registration_fee',
                'other_requested_items.amount',
              ],
            },
          }),
        ],
      },
      {
        code: 'monthly',
        title: '月份安排',
        sort_order: 3,
        fields: [
          f({
            code: 'monthly_plan',
            label: '1～12 月規劃',
            field_type: 'monthly_plan',
            sort_order: 1,
            config: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
          }),
        ],
      },
    ],
    rules: [
      rule({
        field_code: 'allowance_detail',
        rule_type: 'show_if',
        source_field_code: 'institution_allowance',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'other_funding_detail',
        rule_type: 'show_if',
        source_field_code: 'applied_other_funding',
        operator: 'equals',
        value: true,
      }),
      rule({
        field_code: 'other_funding_detail',
        rule_type: 'require_if',
        source_field_code: 'applied_other_funding',
        operator: 'equals',
        value: true,
      }),
    ],
  }
}

function professionalCertification() {
  return {
    category_code: 'professional_certification',
    name: '弘愛築夢專業證照',
    description: '專業證照專屬申請內容（不含簽核欄位）',
    sections: [
      {
        code: 'certification_plan',
        title: '專業證照規劃',
        sort_order: 1,
        fields: [
          f({
            code: 'study_plan_type',
            label: '專業證照自主學習規劃',
            field_type: 'radio',
            required: true,
            sort_order: 1,
            options: [
              { value: 'self_study', label: '自主學習', sort_order: 1 },
              { value: 'guided_course', label: '證照輔導班', sort_order: 2 },
            ],
          }),
          f({
            code: 'course_name',
            label: '參與證照輔導班名稱',
            field_type: 'text',
            sort_order: 2,
          }),
          f({
            code: 'course_time',
            label: '證照輔導班上課時間',
            field_type: 'text',
            sort_order: 3,
          }),
          f({
            code: 'certificate_name',
            label: '自主規劃考取專業證照名稱',
            field_type: 'text',
            required: true,
            sort_order: 4,
          }),
          f({
            code: 'issuing_organization',
            label: '發照單位',
            field_type: 'text',
            required: true,
            sort_order: 5,
          }),
          f({
            code: 'certificate_benefit',
            label: '考取此證照對您的幫助',
            field_type: 'textarea',
            required: true,
            sort_order: 6,
          }),
          f({
            code: 'goal_description',
            label: '預計完成目標說明',
            field_type: 'textarea',
            required: true,
            sort_order: 7,
          }),
          f({ code: 'exam_date', label: '考試日期', field_type: 'date', sort_order: 8 }),
          f({
            code: 'registration_proof_acknowledgement',
            label: '我了解需檢附報名相關證明（紙本簽核階段）',
            field_type: 'checkbox',
            required: true,
            sort_order: 9,
            copy_previous: false,
          }),
        ],
      },
      {
        code: 'funding',
        title: '補助金額',
        sort_order: 2,
        fields: [
          f({
            code: 'requested_total',
            label: '希望補助助學金金額',
            field_type: 'currency',
            required: true,
            sort_order: 1,
          }),
        ],
      },
      {
        code: 'confirmation',
        title: '月份規劃',
        sort_order: 3,
        fields: [
          f({ code: 'monthly_9', label: '9 月份規劃', field_type: 'textarea', sort_order: 1 }),
          f({ code: 'monthly_10', label: '10 月份規劃', field_type: 'textarea', sort_order: 2 }),
          f({ code: 'monthly_11', label: '11 月份規劃', field_type: 'textarea', sort_order: 3 }),
          f({ code: 'monthly_other', label: '其他', field_type: 'textarea', sort_order: 4 }),
        ],
      },
    ],
    rules: [
      rule({
        field_code: 'course_name',
        rule_type: 'show_if',
        source_field_code: 'study_plan_type',
        operator: 'equals',
        value: 'guided_course',
      }),
      rule({
        field_code: 'course_time',
        rule_type: 'show_if',
        source_field_code: 'study_plan_type',
        operator: 'equals',
        value: 'guided_course',
      }),
    ],
  }
}

function careerEnhancement() {
  return {
    category_code: 'career_enhancement',
    name: '弘愛築夢就業增能',
    description: '就業增能專屬申請內容（方案選項由 schema 管理）',
    sections: [
      {
        code: 'career',
        title: '就業增能方案',
        sort_order: 1,
        fields: [
          f({
            code: 'career_plan',
            label: '就業增能執行方案',
            field_type: 'select',
            required: true,
            sort_order: 1,
            options: [
              {
                value: 'plan_a',
                label: '方案 A：職涯藍圖探索工作坊 + 生涯/職涯規劃書',
                sort_order: 1,
              },
              {
                value: 'plan_b',
                label: '方案 B：履歷自傳 + 面試技巧 + 履歷健診',
                sort_order: 2,
              },
              {
                value: 'plan_c',
                label: '方案 C：職能提升講座 + 學習單',
                sort_order: 3,
              },
            ],
          }),
          f({
            code: 'activity_selection',
            label: '活動選擇說明',
            field_type: 'textarea',
            sort_order: 2,
            help_text: '請依所選方案說明欲參加之活動（選項可由後續 Admin 調整）',
          }),
          f({
            code: 'october_plan',
            label: '10 月規劃',
            field_type: 'textarea',
            sort_order: 3,
          }),
          f({
            code: 'november_plan',
            label: '11 月規劃',
            field_type: 'textarea',
            sort_order: 4,
          }),
          f({ code: 'other_plan', label: '其他規劃', field_type: 'textarea', sort_order: 5 }),
          f({
            code: 'requested_amount',
            label: '補助金額',
            field_type: 'currency',
            required: true,
            sort_order: 6,
          }),
        ],
      },
    ],
    rules: [],
  }
}

function crossDomainLearning() {
  return {
    category_code: 'cross_domain_learning',
    name: '弘愛築夢跨域學習',
    description: '跨域學習專屬申請內容',
    sections: [
      {
        code: 'plan',
        title: '跨域學習規劃',
        sort_order: 1,
        fields: [
          f({ code: 'goal', label: '目標', field_type: 'textarea', required: true, sort_order: 1 }),
          f({ code: 'execution_start', label: '執行起日', field_type: 'date', sort_order: 2 }),
          f({ code: 'execution_end', label: '執行迄日', field_type: 'date', sort_order: 3 }),
          f({
            code: 'duration_months',
            label: '共計月數',
            field_type: 'computed',
            sort_order: 4,
            copy_previous: false,
            config: { operation: 'date_diff_months', start: 'execution_start', end: 'execution_end' },
          }),
          f({
            code: 'learning_plan',
            label: '學習計畫',
            field_type: 'textarea',
            required: true,
            sort_order: 5,
          }),
          f({
            code: 'plan_summary',
            label: '計畫摘要',
            field_type: 'textarea',
            required: true,
            sort_order: 6,
          }),
          f({
            code: 'expected_outcome',
            label: '預期成果',
            field_type: 'textarea',
            sort_order: 7,
          }),
          f({
            code: 'activity_plan',
            label: '活動規劃',
            field_type: 'textarea',
            sort_order: 8,
          }),
        ],
      },
      {
        code: 'funding',
        title: '補助金額',
        sort_order: 2,
        fields: [
          f({ code: 'living_expense', label: '生活補助費用', field_type: 'currency', sort_order: 1 }),
          f({
            code: 'requested_items',
            label: '希望補助項目',
            field_type: 'repeat_group',
            sort_order: 2,
            config: {
              max_rows: 20,
              columns: [
                { code: 'item_name', label: '項目名稱', field_type: 'text', required: true },
                { code: 'amount', label: '金額', field_type: 'currency', required: true },
              ],
            },
          }),
          f({
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'computed',
            sort_order: 3,
            copy_previous: false,
            config: {
              operation: 'sum',
              fields: ['living_expense', 'requested_items.amount'],
            },
          }),
        ],
      },
      {
        code: 'monthly',
        title: '月份安排',
        sort_order: 3,
        fields: [
          f({
            code: 'monthly_plan',
            label: '1～12 月規劃',
            field_type: 'monthly_plan',
            sort_order: 1,
            config: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
          }),
        ],
      },
    ],
    rules: [],
  }
}

function academicLearning() {
  return {
    category_code: 'academic_learning',
    name: '弘愛築夢課業學習',
    description: '課業學習專屬申請內容（24 小時為 warning）',
    sections: [
      {
        code: 'hours',
        title: '學習時數規劃',
        sort_order: 1,
        fields: [
          f({
            code: 'learning_goal',
            label: '學習目標',
            field_type: 'textarea',
            required: true,
            sort_order: 1,
          }),
          f({
            code: 'physical_lecture_hours',
            label: '實體講座總時數',
            field_type: 'number',
            sort_order: 2,
            default_value: 0,
          }),
          f({
            code: 'online_course_hours',
            label: '線上課程總時數',
            field_type: 'number',
            sort_order: 3,
            default_value: 0,
          }),
          f({
            code: 'peer_learning_hours',
            label: '同儕共學總時數',
            field_type: 'number',
            sort_order: 4,
            default_value: 0,
          }),
          f({
            code: 'teacher_guidance_hours',
            label: '教師輔導總時數',
            field_type: 'number',
            sort_order: 5,
            default_value: 0,
          }),
          f({
            code: 'total_planned_hours',
            label: '總規劃學習時數',
            field_type: 'computed',
            sort_order: 6,
            copy_previous: false,
            config: {
              operation: 'sum',
              fields: [
                'physical_lecture_hours',
                'online_course_hours',
                'peer_learning_hours',
                'teacher_guidance_hours',
              ],
            },
            validation: {
              warnings: [{ type: 'min_number', value: 24, message: '依目前規劃，學習總時數未達 24 小時，請再次確認。' }],
            },
          }),
          f({
            code: 'september_hours',
            label: '9 月學習總時數',
            field_type: 'number',
            sort_order: 7,
            default_value: 0,
          }),
          f({
            code: 'october_hours',
            label: '10 月學習總時數',
            field_type: 'number',
            sort_order: 8,
            default_value: 0,
          }),
          f({
            code: 'november_hours',
            label: '11 月學習總時數',
            field_type: 'number',
            sort_order: 9,
            default_value: 0,
          }),
          f({
            code: 'total_monthly_hours',
            label: '9～11 月總時數',
            field_type: 'computed',
            sort_order: 10,
            copy_previous: false,
            config: {
              operation: 'sum',
              fields: ['september_hours', 'october_hours', 'november_hours'],
            },
          }),
          f({
            code: 'september_content',
            label: '9 月學習內容',
            field_type: 'textarea',
            sort_order: 11,
          }),
          f({
            code: 'october_content',
            label: '10 月學習內容',
            field_type: 'textarea',
            sort_order: 12,
          }),
          f({
            code: 'november_content',
            label: '11 月學習內容',
            field_type: 'textarea',
            sort_order: 13,
          }),
          f({
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'currency',
            required: true,
            sort_order: 14,
          }),
        ],
      },
    ],
    rules: [],
  }
}
