# HAD UI/UX Execution Plan

**Status:** Prepared — redesign not executed in this document.  
**Depends on:** `docs/AGENT-SKILLS-RESEARCH.md`, `.cursor/rules/had-ui-ux.mdc`

## Goals

- Modern SaaS / CRM workspace visual language (Behance + user attachments first).
- Design-token-first, reusable components, responsive, WCAG-aware Traditional Chinese UI.
- Preserve business logic, security model, PocketBase architecture, and existing feature behavior.

## Non-goals

- Production deploy / migration / secret handling
- Next.js or stack rewrites
- Unnecessary dependency adds
- Form Builder DnD behavior changes (unless explicitly requested later)

## Phases

### Phase A — Inventory (read-only)

1. Map layouts: `public-layout`, `student-layout`, `admin-layout`
2. Map shared UI: `src/components/ui/*`, tokens in `src/index.css`
3. List high-traffic pages (login, student home/current/forms, admin dashboard/applications)
4. Note existing patterns to preserve (status badges, cards that are interaction containers, Sheet/Dialog)

### Phase B — Token & shell

1. Define / refine CSS variables (color, type scale, spacing, elevation)
2. Restyle app shells and navigation first (global consistency)
3. Keep route structure and guards unchanged

### Phase C — Surfaces by priority

1. Auth / public pages
2. Student workspace
3. Admin workspace
4. Form renderer + Form Builder chrome (visual only)
5. Notifications / tasks / empty & error states

### Phase D — Verification

1. `npm.cmd run typecheck && npm.cmd run lint`
2. Manual smoke on key routes at `http://localhost:5173/`
3. Invoke `visual-qa-testing` + `accessibility-auditing` on changed surfaces
4. Optional: `web-design-guidelines` audit on touched files

### Phase E — Stop conditions

Stop and ask before:

- Adding npm dependencies
- Changing PocketBase hooks/rules/collections
- Changing application status transitions or validation rules
- Any production action

## Skills to use during redesign

| When | Skill |
| --- | --- |
| Building / restyling UI | `ui-design-brain` + project rule `had-ui-ux` |
| Component API shape | `vercel-composition-patterns` |
| After visual edits | `visual-qa-testing` |
| A11y pass | `accessibility-auditing` |
| Guideline audit | `web-design-guidelines` |
| Deep craft critique | personal `impeccable` (already available) |

## Exit criteria for “Redesign execution may start”

- [x] Model assessment recorded
- [x] GitHub skill research documented
- [x] Gates completed; only approved skills installed
- [x] `had-ui-ux` project rule present
- [x] This execution plan present
- [ ] User issues the formal HAD UI/UX Redesign prompt / approval to start Phase A+
