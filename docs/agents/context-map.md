# Context map

Read only what your task needs. Always start with [`current-state.md`](current-state.md) and your issue.

| Task type | Read | Skim if needed |
|---|---|---|
| **Any task** | `AGENTS.md`, `current-state.md`, the issue | `docs/README.md` |
| **Map / board** | ADR-0003, `design/design-system.md` (responsive + a11y), `architecture/domain-model.md` (Trip Planning, Geo) | Handoff README "Board" + "Map pin" + "Route" sections, `atlas/map.js` |
| **Itinerary / checklists** | `product/business-rules.md` (Trips, Readiness), `architecture/domain-model.md` | Handoff "Itinerary" / "Checklists" sections |
| **Budget / savings / currency** | `product/business-rules.md` (Locale & currency, Budget, Savings), `architecture/money.md`, ADR-0004 | `atlas/app-core.js` (totals, plan) |
| **i18n / copy** | `architecture/i18n.md`, ADR-0008 | — |
| **Design system / UI component** | `design/design-system.md`, `design/design-audit.md` | Handoff README tokens and components, `atlas/globetrot.css` |
| **Landing page** | `design/design-audit.md`, `integrations/stripe.md` (mock pricing), `architecture/i18n.md` | `Globetrot - Landing.html` |
| **Auth / accounts / preferences** | ADR-0005, `product/business-rules.md` (Locale), `architecture/domain-model.md` (Identity, Profile) | — |
| **API / application layer** | ADR-0006, `architecture/overview.md`, `architecture/domain-model.md` (conventions) | — |
| **Pip / AI** | ADR-0007, `product/business-rules.md` (AI) | Handoff "Pip" section, `atlas/app-core.js` (change lists), `atlas/pip.js` |
| **Passport / stamps / ranks** | `product/business-rules.md` (Readiness, Passport, Progression) | — |
| **Stripe / billing** | `integrations/stripe.md`, `product/business-rules.md` | — |
| **MCP** | `integrations/mcp.md`, ADR-0006, ADR-0007, ADR-0005 | — |
| **Repo / CI / workflow** | `engineering/git-workflow.md`, `engineering/project-structure.md`, ADR-0009 | `turbo.json`, `eslint.config.mjs` |
| **Adding a package or app** | `engineering/project-structure.md`, `architecture/overview.md` | ADR-0002, ADR-0006 |
| **Local environment / services** | `engineering/local-development.md` | `compose.yaml`, `.env.example` |
| **Infra / deployment** | `architecture/overview.md` (Deployment shape) | Future `infrastructure/*` docs |

All paths are relative to `docs/`. "Handoff" means [`design/reference/claude-design-v1/README.md`](../../design/reference/claude-design-v1/README.md), and the `atlas/*` files live in the same folder.
