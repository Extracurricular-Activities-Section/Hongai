# Agent Skills Research — HAD UI/UX Redesign Prep

**Date:** 2026-09-10  
**Repo:** `hong-ai-dream-system`  
**Purpose:** Mandatory GitHub Skill Research before HAD UI/UX Redesign.  
**Status:** Research complete. Redesign **not** started in this step.

## Model Assessment (precondition)

| Item | Result |
| --- | --- |
| Task type | Frontend UI/UX redesign of existing Vite SPA |
| Stack | React 19, TypeScript, Vite, React Router, Tailwind, shadcn/ui, lucide, RHF, Zod, TanStack Query, PocketBase, dnd-kit (Form Builder) |
| Constraints | No business-logic / security / PB architecture change; no prod deploy; Traditional Chinese UI |
| Agent capability | Sufficient for research + rule authoring + later redesign under project rules |
| External skills | Required search/evaluate; install only if all gates pass |

## Search Scope

Actual GitHub / web searches performed (not memory-only):

1. Cursor Agent Skills (`cursor skills`, `cursor agent skills`, `SKILL.md`)
2. Cursor Rules / `.cursor/rules` / `awesome-cursorrules` / `awesome-cursor-rules-mdc`
3. React + TypeScript engineering rules
4. Frontend architecture / large-repo agent rules
5. UI / UX / Design System skills & rules
6. Tailwind CSS skills / rules
7. shadcn/ui (`shadcn-ui/ui` skills, `Sciontut/shadcn-cursor-rules`)
8. WCAG / Accessibility skills
9. Playwright skills / rules
10. Visual regression / visual QA skills
11. dnd-kit (library + community skills)
12. Security-conscious frontend skills
13. Code review / regression-prevention workflows
14. Design token / component system rules
15. Official collections: `anthropics/skills`, `vercel-labs/agent-skills`, `spencerpauly/awesome-cursor-skills`

Indexes / orgs inspected: PatrickJS/awesome-cursorrules, spencerpauly/awesome-cursor-skills, vercel-labs/agent-skills, anthropics/skills, shadcn-ui/ui, carmahhawwari/ui-design-brain, agents-inc/skills, clauderic/dnd-kit, eristic/design-system-cursor-rulesets, blefnk mirrors, RealBulbaBot mirrors.

## Candidate Skills

Serious candidates (entered evaluation; not every search hit):

| # | Name | Repository | Type |
| --- | --- | --- | --- |
| C1 | ui-design-brain | carmahhawwari/ui-design-brain | Skill |
| C2 | web-design-guidelines | vercel-labs/agent-skills | Skill |
| C3 | vercel-composition-patterns | vercel-labs/agent-skills | Skill |
| C4 | vercel-react-best-practices | vercel-labs/agent-skills | Skill |
| C5 | shadcn (official) | shadcn-ui/ui `skills/shadcn` | Skill |
| C6 | shadcn-cursor-rules | Sciontut/shadcn-cursor-rules | Rule pack |
| C7 | accessibility-auditing | spencerpauly/awesome-cursor-skills | Skill |
| C8 | visual-qa-testing | spencerpauly/awesome-cursor-skills | Skill |
| C9 | adding-e2e-tests | spencerpauly/awesome-cursor-skills | Skill |
| C10 | frontend-design | anthropics/skills | Skill |
| C11 | webapp-testing | anthropics/skills | Skill |
| C12 | React+TS+shadcn rule | PatrickJS/awesome-cursorrules | Rule |
| C13 | Tailwind+shadcn rule | PatrickJS/awesome-cursorrules | Rule |
| C14 | Toss-style design system | PatrickJS/awesome-cursorrules | Rule |
| C15 | Playwright a11y testing | PatrickJS/awesome-cursorrules | Rule |
| C16 | React Query rule | PatrickJS/awesome-cursorrules | Rule |
| C17 | React components → v0 | PatrickJS/awesome-cursorrules | Rule |
| C18 | web-dnd-dnd-kit | agents-inc/skills | Skill |
| C19 | design-system-cursor-rulesets | eristic/… | Next.js sample |
| C20 | react-best-practices mirror | RealBulbaBot/react-best-practices | Skill mirror |
| C21 | blefnk/awesome-cursor-rules | blefnk | Next-heavy rules + CLI |
| C22 | deploy-to-vercel / vercel-cli-with-tokens | vercel-labs/agent-skills | Skill |
| — | impeccable (already present) | local `~/.codex/skills/impeccable` | Personal skill |

## Quality Review

| ID | Quality | Notes |
| --- | --- | --- |
| C1 | PASS | Concrete 60+ component practices; anti-generic-AI; MIT markdown |
| C2 | PASS | Official Vercel UI/a11y audit workflow |
| C3 | PASS | Clear React composition patterns; React 19 section matches stack |
| C4 | FAIL for HAD install | Strong content but Next/RSC/SWR-heavy; wrong primary audience for Vite SPA |
| C5 | FAIL for HAD install | Excellent upstream; Form `FieldGroup`/`InputGroup` API diverges from current `src/components/ui` |
| C6 | FAIL | Unofficial conversion; 0 stars; same API mismatch as C5 |
| C7 | PASS | Actionable a11y audit via Cursor browser |
| C8 | PASS | Visual QA workflow; port note needed (5173) |
| C9 | FAIL | Would push Playwright install; project Playwright **NOT CONFIGURED** by design for now |
| C10 | FAIL for project install | Distinctive marketing bias; overlaps personal `impeccable`; may fight CRM workspace brief |
| C11 | FAIL | Python Playwright helpers / scripts — higher install risk for this prep |
| C12–C17 | FAIL | Next.js / v0.dev / invented folder layout / premature Playwright / aesthetic lock-in |
| C18 | FAIL for install | Useful DnD knowledge but community pack; risk of changing Form Builder behavior during UI-only redesign |
| C19–C21 | FAIL | Next.js, low relevance, or CLI-driven install |
| C22 | FAIL | Deploy / token workflows — out of scope and high risk |

## Security Review

| ID | Security | Notes |
| --- | --- | --- |
| C1 | PASS | Markdown + LICENSE only; no scripts/binaries; install via `gh api` file copy |
| C2 | PASS | Markdown; fetches public guidelines URL (no secrets) |
| C3 | PASS | Markdown rule files only |
| C4 | PASS content / REJECT install | Content safe; rejected on compatibility |
| C5 | FAIL for install here | Encourages recurring `npx shadcn@latest *`; plus API migration pressure |
| C7–C8 | PASS | Markdown; use local Cursor browser tools |
| C9 | FAIL | `npm init playwright@latest` dependency churn |
| C11 | FAIL | Bundled Python scripts + Chromium |
| C17 | FAIL | External v0.dev prompt/link workflow |
| C22 | FAIL | Tokens / production deploy |
| Default | Reject when uncertain | Applied |

**Install method used:** `gh api` → write files locally. No `curl | bash`, no global CLI, no `package.json` / `.env` / git config changes for skills.

## Compatibility Review

Must fit: React + TS + Vite SPA + React Router + Tailwind + shadcn (existing) + PocketBase + TanStack Query + dnd-kit.

| ID | Compatibility | Notes |
| --- | --- | --- |
| C1 | PASS | React + Tailwind defaults; no framework rewrite |
| C2 | PASS | Framework-agnostic review |
| C3 | PASS | React 19 composition; no Next requirement |
| C4 | FAIL | Next.js App Router / RSC / `next/dynamic` / SWR emphasis |
| C5–C6 | FAIL | Newer shadcn form primitives not present in HAD UI kit |
| C12–C13 | FAIL | Explicit Next.js |
| C14 | FAIL aesthetic | Toss look may override Behance + user attachments |
| C16 | FAIL | Invents `hooks/useQueries` layout vs `src/features/*` |
| C18 | CONDITIONAL | Compatible library, but UI-only redesign should not retune DnD logic |

## Conflict Review

Existing project context before install:

- No `.cursor/rules/` (created by this research)
- No `AGENTS.md` / `CLAUDE.md` in repo root
- Security/architecture docs under `docs/` + CONTRIBUTING constraints
- Personal skill already available: `impeccable`

Conflicts found:

- Next.js-centric rules vs Vite SPA → **REJECT**
- Official shadcn skill form APIs vs current Label/Input components → **REJECT install** (principles noted in project rule)
- Toss-style lock-in vs Behance / user images → **REJECT**
- Frontend-only auth sufficiency vs server-side PocketBase authorization → any such rule **REJECT**
- DnD skill temptation vs “do not change business logic” → **REJECT install**; use official docs if DnD bugfix requested later

## Decision Table

### Name: ui-design-brain
- **Repository:** https://github.com/carmahhawwari/ui-design-brain
- **Purpose:** Component-pattern knowledge for production UI
- **Source / Maintainer:** Community (carmahhawwari); MIT
- **Last Maintained:** 2026-09 (active)
- **License:** MIT
- **Relevant to HAD:** HIGH
- **Quality:** PASS | **Security:** PASS | **Compatibility:** PASS | **Conflict:** NONE
- **Decision:** INSTALL
- **Reason:** High-signal UI patterns; markdown-only; aligns with SaaS/CRM redesign without forcing Next.js

### Name: web-design-guidelines
- **Repository:** https://github.com/vercel-labs/agent-skills (skills/web-design-guidelines)
- **Purpose:** UI / a11y / UX guideline audit
- **Source / Maintainer:** Vercel Labs (official)
- **Last Maintained:** 2026-09
- **License:** (collection; skill metadata author vercel)
- **Relevant to HAD:** HIGH
- **Quality:** PASS | **Security:** PASS | **Compatibility:** PASS | **Conflict:** NONE
- **Decision:** INSTALL
- **Reason:** Official audit skill; useful post-redesign QA

### Name: vercel-composition-patterns
- **Repository:** https://github.com/vercel-labs/agent-skills (skills/composition-patterns)
- **Purpose:** Scalable React composition / compound components
- **Source / Maintainer:** Vercel Labs
- **Last Maintained:** 2026-09
- **License:** MIT (skill frontmatter)
- **Relevant to HAD:** MEDIUM–HIGH
- **Quality:** PASS | **Security:** PASS | **Compatibility:** PASS | **Conflict:** NONE
- **Decision:** INSTALL
- **Reason:** Helps reusable UI without changing backend; React 19 compatible

### Name: accessibility-auditing
- **Repository:** https://github.com/spencerpauly/awesome-cursor-skills
- **Purpose:** Aria-tree a11y audit via Cursor browser
- **Source / Maintainer:** Community curated list
- **Last Maintained:** 2026-09
- **License:** (repo curated skills; markdown)
- **Relevant to HAD:** HIGH
- **Quality:** PASS | **Security:** PASS | **Compatibility:** PASS | **Conflict:** NONE
- **Decision:** INSTALL

### Name: visual-qa-testing
- **Repository:** https://github.com/spencerpauly/awesome-cursor-skills
- **Purpose:** Screenshot / console / network visual QA
- **Source / Maintainer:** Community curated list
- **Last Maintained:** 2026-09
- **License:** markdown skill
- **Relevant to HAD:** HIGH
- **Quality:** PASS | **Security:** PASS | **Compatibility:** PASS | **Conflict:** NONE
- **Decision:** INSTALL
- **Note:** Examples mention `:3000`; HAD Vite default is `:5173` — see `HAD-NOTE.md`

### Rejected (summary)

| Name | Decision | Reason |
| --- | --- | --- |
| vercel-react-best-practices | REJECT | Next.js/RSC/SWR-centric; conflicts with Vite SPA + TanStack Query |
| shadcn official skill / Sciontut pack | REJECT | Form primitive API mismatch; CLI churn risk for UI-only redesign |
| anthropics frontend-design | REJECT | Overlaps personal impeccable; marketing-distinctiveness bias |
| anthropics webapp-testing | REJECT | Python Playwright scripts |
| PatrickJS React+TS+shadcn / Tailwind+shadcn | REJECT | Next.js App Router |
| PatrickJS Toss-style | REJECT | Aesthetic conflict with Behance + user attachments |
| PatrickJS Playwright a11y / adding-e2e-tests | REJECT | Premature Playwright dependency |
| PatrickJS React Query | REJECT | Folder-structure conflict with `src/features` |
| PatrickJS React→v0 | REJECT | External codegen workflow |
| agents-inc web-dnd-dnd-kit | REJECT | Avoid DnD behavior changes during UI-only scope; use official docs if needed |
| eristic design-system rulesets | REJECT | Next.js sample app; low relevance |
| RealBulbaBot react-best-practices | REJECT | Unofficial 0★ mirror |
| blefnk awesome-cursor-rules | REJECT | Next 15 stack + CLI installer |
| vercel deploy / CLI tokens skills | REJECT | Security: deploy & tokens |
| Generic “make pretty UI” packs | REJECT | Vague; no durable value |

## Installed Skills

Installed under `.cursor/skills/` (project-scoped, markdown copy via `gh api`):

| Skill folder | Source |
| --- | --- |
| `ui-design-brain/` | carmahhawwari/ui-design-brain (`SKILL.md`, `components.md`, `LICENSE.txt`) |
| `web-design-guidelines/` | vercel-labs/agent-skills |
| `vercel-composition-patterns/` | vercel-labs/agent-skills (+ `rules/*`, `AGENTS.md`, `README.md`) |
| `accessibility-auditing/` | spencerpauly/awesome-cursor-skills |
| `visual-qa-testing/` | spencerpauly/awesome-cursor-skills (+ `HAD-NOTE.md` for port 5173) |

**External Skill Installation Count:** 5

**Already available (not newly installed):** personal `impeccable` skill.

## Post-install verification

| Check | Result |
| --- | --- |
| Skill folders readable | PASS |
| `name` matches folder | PASS (all 5) |
| No `.ps1`/`.sh`/`.exe`/`.js` skill scripts added | PASS |
| `package.json` unchanged by skill install | PASS |
| `.env` not modified by skill install | PASS |
| Git config not touched | PASS |
| No overwrite of prior `.cursor/rules` | PASS (directory was empty; added `had-ui-ux.mdc`) |
| Duplicate Next.js instructions installed | NONE |
| Risk rollback needed | No |

## Project Rule Created

- `.cursor/rules/had-ui-ux.mdc` — primary HAD UI/UX development rule (alwaysApply for `src/**/*.{tsx,ts,css}`)

## Final Decision

- GitHub search + multi-gate evaluation **completed**.
- Installed **5** approved external skills.
- Rejected all Next.js-locked, deploy/token, premature Playwright, and form-API-migrating candidates.
- Project HAD UI/UX rule created and takes precedence over external skills.
- Ready for **UI/UX Execution Plan** then formal Redesign prompt — **not** claiming production LIVE.

**External Skill Installation Count:** 5
