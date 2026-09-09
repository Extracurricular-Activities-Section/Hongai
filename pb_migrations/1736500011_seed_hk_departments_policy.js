/// <reference path="../pb_data/types.d.ts" />
/**
 * Initial seed: four departments, category→department routing hints,
 * living allowance brackets, academic-year policy.
 * Idempotent: skips when code already exists. Not React hardcode.
 */
migrate(
  (app) => {
    const findByCode = (collectionName, code) => {
      try {
        return app.findFirstRecordByData(collectionName, 'code', code)
      } catch {
        return null
      }
    }

    const upsertDepartment = (row) => {
      let rec = findByCode('hk_departments', row.code)
      if (!rec) {
        const col = app.findCollectionByNameOrId('hk_departments')
        rec = new Record(col)
        rec.set('code', row.code)
      }
      rec.set('name', row.name)
      rec.set('display_name', row.display_name || row.name)
      rec.set('location', row.location || '')
      rec.set('contact_name', row.contact_name || '')
      rec.set('contact_extension', row.contact_extension || '')
      rec.set('contact_email', row.contact_email || '')
      rec.set('contact_phone', row.contact_phone || '')
      rec.set('active', true)
      rec.set('sort_order', row.sort_order || 0)
      rec.set('description', row.description || '')
      app.save(rec)
      return rec
    }

    const depts = {
      teaching_dev: upsertDepartment({
        code: 'teaching_dev',
        name: '教務處教學發展組',
        location: 'B205',
        contact_name: '曾孟涵',
        contact_extension: '1288',
        sort_order: 1,
        description: '課業學習承辦',
      }),
      career: upsertDepartment({
        code: 'career',
        name: '學務處職涯中心',
        location: 'NB110',
        contact_name: '林宜玫',
        contact_extension: '2207',
        sort_order: 2,
        description: '專業證照、就業增能承辦',
      }),
      housing: upsertDepartment({
        code: 'housing',
        name: '學務處生活住宿組',
        location: 'B107',
        contact_name: '余文明',
        contact_extension: '1427',
        sort_order: 3,
        description: '校外競賽承辦',
      }),
      extracurricular: upsertDepartment({
        code: 'extracurricular',
        name: '學務處課外活動指導組',
        location: 'H101',
        contact_name: '鄭雅純',
        contact_extension: '1502',
        sort_order: 4,
        description: '外語檢定、共通職能、跨域學習、海外研修、其他承辦',
      }),
    }

    const categoryDept = {
      academic_learning: 'teaching_dev',
      professional_certification: 'career',
      career_enhancement: 'career',
      external_competition: 'housing',
      language_certification: 'extracurricular',
      common_competency: 'extracurricular',
      cross_domain_learning: 'extracurricular',
      overseas_study: 'extracurricular',
      other: 'extracurricular',
    }

    try {
      const assignCol = app.findCollectionByNameOrId('hk_category_department_assignments')
      const catCol = app.findCollectionByNameOrId('hk_application_categories')
      void catCol
      for (const [catCode, deptKey] of Object.entries(categoryDept)) {
        let cat
        try {
          cat = app.findFirstRecordByData('hk_application_categories', 'code', catCode)
        } catch {
          console.log(`[hk] seed skip assignment — category missing: ${catCode}`)
          continue
        }
        const dept = depts[deptKey]
        // Skip if any assignment already links this category
        let hasExisting = false
        try {
          app.findFirstRecordByFilter(
            'hk_category_department_assignments',
            `category = "${cat.id}"`,
          )
          hasExisting = true
        } catch (_) {
          hasExisting = false
        }
        if (hasExisting) continue
        const rec = new Record(assignCol)
        rec.set('category', cat.id)
        rec.set('department', dept.id)
        rec.set('role', 'primary')
        rec.set('active', true)
        app.save(rec)
        console.log(`[hk] seeded assignment ${catCode} → ${deptKey}`)
      }
    } catch (err) {
      console.log(`[hk] category assignment seed deferred: ${err}`)
    }

    // Living allowance reference brackets (amount null + flag when uncertain)
    const living = [
      { code: 'low_income', label: '低收入戶', amount: 8000, sort_order: 1 },
      { code: 'disability_severe', label: '身心障礙極重度／重度', amount: 8000, sort_order: 2 },
      { code: 'disability_moderate', label: '身心障礙中度', amount: 6000, sort_order: 3 },
      { code: 'indigenous', label: '原住民學生', amount: 6000, sort_order: 4 },
      { code: 'mid_low_income', label: '中低收入戶', amount: 6000, sort_order: 5 },
      { code: 'special_circumstances', label: '特殊境遇家庭', amount: 6000, sort_order: 6 },
      { code: 'disability_mild', label: '身心障礙輕度', amount: 4000, sort_order: 7 },
      { code: 'disadvantaged_l1', label: '弱勢助學第一級', amount: 4000, sort_order: 8 },
      { code: 'disadvantaged_l2', label: '弱勢助學第二級', amount: 4000, sort_order: 9 },
      { code: 'disadvantaged_l3', label: '弱勢助學第三級', amount: 4000, sort_order: 10 },
      { code: 'disadvantaged_l4', label: '弱勢助學第四級', amount: 2000, sort_order: 11 },
      { code: 'disadvantaged_l5', label: '弱勢助學第五級', amount: 2000, sort_order: 12 },
      {
        code: 'disadvantaged_l6_or_special',
        label: '弱勢助學第六級／特殊需求（待確認）',
        amount: null,
        needs_policy_confirmation: true,
        sort_order: 13,
      },
    ]

    try {
      const livingCol = app.findCollectionByNameOrId('hk_living_allowance_rules')
      for (const row of living) {
        let rec
        try {
          rec = app.findFirstRecordByFilter(
            'hk_living_allowance_rules',
            `code = "${row.code}" && academic_year = "default"`,
          )
        } catch {
          rec = new Record(livingCol)
          rec.set('code', row.code)
          rec.set('academic_year', 'default')
        }
        rec.set('label', row.label)
        if (row.amount == null) {
          rec.set('amount', 0)
          rec.set('needs_policy_confirmation', true)
        } else {
          rec.set('amount', row.amount)
          rec.set('needs_policy_confirmation', !!row.needs_policy_confirmation)
        }
        rec.set('active', true)
        rec.set('sort_order', row.sort_order)
        app.save(rec)
      }
      console.log('[hk] seeded living allowance rules')
    } catch (err) {
      console.log(`[hk] living allowance seed deferred: ${err}`)
    }

    try {
      const polCol = app.findCollectionByNameOrId('hk_academic_year_policies')
      let pol
      try {
        pol = app.findFirstRecordByData('hk_academic_year_policies', 'academic_year', 'default')
      } catch {
        pol = new Record(polCol)
        pol.set('academic_year', 'default')
      }
      pol.set('minimum_categories', 2)
      pol.set('annual_total_limit', 150000)
      pol.set('active', true)
      pol.set('notes', '每位學生九大項目年度補助原則上限 150,000；學年度至少兩項（單學期不 hard block）')
      app.save(pol)
      console.log('[hk] seeded academic year policy')
    } catch (err) {
      console.log(`[hk] academic year policy seed deferred: ${err}`)
    }

    // Minimal FAQ stubs (Admin can edit)
    try {
      const faqCol = app.findCollectionByNameOrId('hk_faq_articles')
      const faqs = [
        {
          slug: 'how-many-categories',
          title: '可以申請幾項？',
          body: '<p>本學年度原則上至少完成兩項計畫；可上下學期各執行一項，單一學期不一定要一次送兩項。</p>',
        },
        {
          slug: 'internship',
          title: '實習生可否申請？',
          body: '<p>在外實習仍可申請，前提是能完成計畫與資料繳交；計畫內容不得是必修學分。</p>',
        },
        {
          slug: 'overseas-internship',
          title: '海外實習能否算海外研修？',
          body: '<p>海外研修不得用於出國實習並領取學分的情況。詳見該項目資格確認。</p>',
        },
      ]
      for (const f of faqs) {
        let rec
        try {
          rec = app.findFirstRecordByData('hk_faq_articles', 'slug', f.slug)
        } catch {
          rec = new Record(faqCol)
          rec.set('slug', f.slug)
        }
        rec.set('title', f.title)
        rec.set('body', f.body)
        rec.set('audience', 'student')
        rec.set('published', true)
        rec.set('sort_order', 0)
        app.save(rec)
      }
      console.log('[hk] seeded FAQ stubs')
    } catch (err) {
      console.log(`[hk] FAQ seed deferred: ${err}`)
    }
  },
  (app) => {
    void app
  },
)
