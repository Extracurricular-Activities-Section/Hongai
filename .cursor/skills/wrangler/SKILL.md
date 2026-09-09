---
name: wrangler
description: Run or troubl
eshoot Wrangler CLI commands and configure Wo
rker projects for local development, deployme
nt, and Cloudflare resource management.
---


# Wrangler CLI

Use the project's Wrangler ve
rsion and retrieve the relevant documentation
 before writing commands or configuration. CL
I flags and configuration fields change; do n
ot rely on memorized examples.

## Inspect th
e Project

- Find the package manager, instal
led Wrangler version, package scripts, framew
ork, and Wrangler config. Run commands throug
h the project's scripts or package manager so
 they use its local version. Install dependen
cies using the existing lockfile when needed;
 do not silently upgrade Wrangler to match cu
rrent docs. If Wrangler is not a dependency, 
follow the [installation guide](https://devel
opers.cloudflare.com/workers/wrangler/install
-and-update/) to add it locally.
- Identify t
he config used by the build or deploy command
, including framework-generated config. Edit 
its source rather than generated output.
- Es
tablish the target account, Worker, environme
nt, and resource before running commands that
 change them. For data operations, determine 
whether the target is local or remote.

## Re
trieve What the Task Needs

Use the Cloudflar
e MCP `docs` tool if available, or fetch the 
relevant linked page directly. Follow links t
o the specific command or product involved; a
void loading the entire reference. If a page 
moves, rediscover it through the [Wrangler co
mmand index](https://developers.cloudflare.co
m/workers/wrangler/commands/) or Cloudflare d
ocs search.

| Task | Source |
| --- | --- |

| Discover commands and flags, including reso
urce management, deployments, rollback, and d
iagnostics | Project-local `wrangler --help` 
and `wrangler <command> --help`; [command ref
erence](https://developers.cloudflare.com/wor
kers/wrangler/commands/) |
| Edit config or a
dd a binding | Installed `wrangler/config-sch
ema.json` (usually under `node_modules`); [co
nfiguration reference](https://developers.clo
udflare.com/workers/wrangler/configuration/) 
|
| Deploy a framework application | [Framewo
rk guides](https://developers.cloudflare.com/
workers/framework-guides/); follow the guide 
for the project's existing framework and adap
ter |
| Migrate an application to Workers whe
n requested | [Pages to Workers](https://deve
lopers.cloudflare.com/workers/static-assets/m
igration-guides/migrate-from-pages/); [Vercel
 to Workers](https://developers.cloudflare.co
m/workers/static-assets/migration-guides/verc
el-to-workers/) |
| Configure staging or prod
uction | [Environments](https://developers.cl
oudflare.com/workers/wrangler/environments/) 
|
| Set secrets locally, in CI, or on a deplo
yed Worker | [Secrets](https://developers.clo
udflare.com/workers/configuration/secrets/) |

| Generate binding and runtime types | [Type
Script](https://developers.cloudflare.com/wor
kers/languages/typescript/) |
| Run locally o
r choose a testing approach | [Local developm
ent](https://developers.cloudflare.com/worker
s/local-development/); [testing](https://deve
lopers.cloudflare.com/workers/testing/) |
| D
iagnose authentication or select an account |
 [General commands](https://developers.cloudf
lare.com/workers/wrangler/commands/general/),
 including `whoami`; [authentication profiles
](https://developers.cloudflare.com/workers/w
rangler/profiles/) |
| Deploy an unauthentica
ted prototype | [Claim deployments](https://d
evelopers.cloudflare.com/workers/platform/cla
im-deployments/) for eligibility, expiry, and
 claim URL handling; use a permanent account 
for production or CI |

Use installed help an
d schema to check whether documented features
 exist in the project's version. If a require
d feature needs an upgrade, make that depende
ncy explicit. If retrieval is unavailable, st
ate the gap and use available local evidence 
rather than inventing syntax.

## Apply the C
hange

- Prefer `wrangler.jsonc` for new conf
ig. Set a new project's [compatibility date](
https://developers.cloudflare.com/workers/con
figuration/compatibility-dates/) to today; re
view runtime changes and test when advancing 
an existing project's date. Preserve existing
 project conventions and avoid incidental for
mat migrations.
- Check environment inheritan
ce before adding bindings or variables. Some 
fields must be specified separately for each 
environment; a working default config does no
t establish that staging is configured.
- Wit
h the Cloudflare Vite plugin, select the envi
ronment via `CLOUDFLARE_ENV` at dev or build 
time. Deploy the resulting build; setting an 
environment at deploy time does not retarget 
its flattened config. See [Vite environments]
(https://developers.cloudflare.com/workers/vi
te-plugin/reference/cloudflare-environments/)
.
- Reconcile dashboard changes with the conf
ig before deploying: Wrangler can overwrite d
ashboard variables and routes. When binding e
xisting resources, verify their identifiers; 
omitted identifiers can trigger [automatic pr
ovisioning](https://developers.cloudflare.com
/workers/wrangler/configuration/#automatic-pr
ovisioning).
- Distinguish local simulation f
rom remote bindings during development. A loc
ally running Worker can still access real res
ources; check the selected bindings before te
sting writes.
- Keep secret values out of com
mand arguments, source code, and logs. Use th
e documented interactive input or protected f
ile/stdin mechanism for the command. Local se
cret files must be ignored by version control
 and are not automatically uploaded as deploy
ed secrets. For missing local secrets, check 
file precedence and any `secrets.required` de
claration in the secrets docs.
- Treat `wrang
ler secret put` and `secret delete` as deploy
ments: they create a version and deploy it im
mediately. Use the documented `wrangler versi
ons secret` workflow when the change must be 
staged.
- Before a rollback, check [rollback 
limitations](https://developers.cloudflare.co
m/workers/versions-and-deployments/rollbacks/
): connected resources and their data are not
 rolled back with Worker code.

## Validate


After changing config or bindings in a TypeSc
ript project, regenerate types with the proje
ct's `wrangler types` command rather than han
d-editing generated declarations. Run the rel
evant existing typecheck or tests.

For deplo
yment changes, use the project's build workfl
ow and `wrangler deploy --dry-run` where supp
orted, with the intended config and environme
nt. A successful dry run checks the build and
 packaging; it does not prove remote resource
s or runtime behavior work. Use task-specific
 local or remote checks as appropriate to the
 requested work.

Report what changed, the ta
rget environment, checks performed, and any u
nresolved validation gaps. Link the documenta
tion used when the result depends on current 
command or configuration behavior.


