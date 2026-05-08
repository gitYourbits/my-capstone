# Platform Technical Guide (Project + Viva Prep)

This document mixes **project-specific** backend/API detail with **broader** frontend and AI concepts for academic answers. Backend frameworks (Django/DRF) are assumed familiar; only how this project uses them is spelled out here.

---

## 1. Platform snapshot (this project)

| Layer | Stack |
|-------|--------|
| UI | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix primitives), React Router, TanStack Query (present), Lucide icons |
| API | Django REST Framework, JWT (SimpleJWT) |
| DB | SQLite dev; schema portable to PostgreSQL |
| Media | Disk (`MEDIA_ROOT`); thumbnail generation via Pillow |
| Moderation | OpenAI Chat Completions over HTTPS for spam scoring at issue creation |

**Roles:** citizens (post, vote, comment, profile), anonymous readers (read feed/detail), staff (admin dashboard, grievances, workflow, assignment config, spam queue).

---

## 2. Backend & API (project-specific)

### 2.1 Core models (mental map)

- **Location:** `State` → `District` → `City`.
- **Taxonomy:** `Category` (linked to `AssignmentCategory` for routing), `Tag` (many-to-many with issues; normalised names/slugs).
- **`Issue`:** author, title/description, anonymity flag, location FKs, scope, category, tags, `assigned_to`, `workflow_stage`, `status`, engagement counters (`upvotes_count`, `downvotes_count`, `comments_count`, `views_count`), `submission_token` + unique constraint per author, spam fields (`spam_status`, `spam_reason`, `spam_score`, `spam_checked_at`), timestamps.
- **`Media`:** file per issue; types image/video/audio; optional thumbnail for images.
- **`Comment`:** issue, author, content, anonymity, parent for threading, vote counts, soft-delete `is_deleted`.
- **`Vote`:** user + issue xor user + comment.
- **`IssueView`:** deduped views for `views_count`.
- **`IssueAdminNote`:** internal vs public_response types (admin UI).
- **`WorkflowTransition`:** audit trail of stage moves with performer, assignee, notes (public timeline shows recent transitions + notes).

### 2.2 Comment counter

Denormalised `Issue.comments_count` is updated via **Django signals** on `Comment` (`post_save`, `post_delete`) so every create/soft-delete/hard-delete stays consistent. A migration backfilled historical rows.

### 2.3 Major API surface (`/api/`)

| Area | Behaviour |
|------|-----------|
| Auth | Register, login (username or email), refresh, `GET /auth/me/` |
| Locations / categories / tags | Read-only lists + search where applicable |
| Issues `GET` list | Filters: category, state, district, city, scope, status; sort: trending (ORM expression + recency buckets), recent, votes, comments; **excludes** `spam_status=flagged` from public list |
| Issues `GET` detail | Full payload; **404 for flagged** unless owner or staff |
| Issues `POST` create | Multipart; validates media types/extensions and **25 MB per file**; runs spam assessment; **atomic** transaction for issue + media; idempotent via `submission_token`; auto-assigns initiator from category unless flagged |
| Issues responses | `201` normal; `200` + `duplicate_submission` or `spam_blocked`; flagged issues skip auto-assignment |
| Issues PATCH/DELETE | Author-only (`IsAuthorOrReadOnly`) |
| Issues `mine` | Authenticated user’s issues (includes flagged for profile) |
| Vote / view / comments sub-actions | Standard REST-style actions on issue resource |
| Comments CRUD + vote | Creates bump issue counter via signals |
| Search | Issues + tags by query string |
| Admin `/admin/stats/` | Totals, status breakdown, pending, recent counts, **spam_total**, **spam_recent_7_days** |
| Admin grievances | List/filter/patch status-featured-verified; notes; workflow advance |
| Admin spam | List flagged with author snapshot; **unflag** restores public visibility and can trigger deferred auto-assignment |

### 2.4 Reliability patterns in this codebase

- **Trending:** Pure ORM (no SQLite-only SQL); on `DatabaseError` for trending sort, list falls back to **recent** instead of 500.
- **Create idempotency:** Same `(author, submission_token)` returns existing issue with flag in payload.
- **Media atomicity:** Invalid files → validation error before/with transaction; no orphan issues without intended media.
- **Spam fail-open:** If AI call fails or key missing, issue gets `spam_status=skipped` and behaves like a normal post.

---

## 3. Frontend tech stack (broader + short project tie-in)

### 3.1 React (conceptual)

- **Declarative UI:** You describe state → UI; React reconciles the DOM (Virtual DOM diffing) on updates.
- **Components:** Reusable pieces with props in, events/DOM out; composition over inheritance.
- **Hooks:** `useState` / `useReducer` for local state, `useEffect` for sync with external systems (fetch, subscriptions), `useMemo`/`useCallback` for stable references and perf, `useRef` for mutable boxes without re-render.
- **Unidirectional data:** Props flow down; callbacks or context lift state up.
- **Strict Mode (dev):** Double-invokes some lifecycles to surface unsafe side effects.

**This project:** Page-level components (`Feed`, `IssueDetail`, `CreateIssue`, `Profile`, admin pages); shared UI (`IssueCard`, `Navbar`, layout wrappers).

### 3.2 TypeScript (conceptual)

- **Static types** on variables, props, API shapes catch mistakes before runtime.
- **Structural typing:** Types match by shape, not nominal class names.
- **Generics:** e.g. `Promise<T>`, reusable list wrappers.
- **Union / narrowing:** `status === 'loading'` narrows branches safely.
- **`strict` options:** `strictNullChecks` forces handling `null`/`undefined`.

**This project:** `.tsx` for JSX; interfaces for issue/card props; `any` still appears in places for speed—production code often tightens these gradually.

### 3.3 Vite (conceptual)

- **Dev server:** Native ESM, fast HMR (patch modules without full reload).
- **Build:** Rollup-based production bundle; tree-shaking removes unused exports.
- **Env:** `import.meta.env.VITE_*` exposes build-time variables to the client (never put secrets in `VITE_`—they ship to the browser).

**This project:** `VITE_API_BASE_URL` points the SPA at the Django API.

### 3.4 Tailwind CSS (conceptual)

- **Utility-first:** Small classes (`flex`, `p-4`, `text-muted-foreground`) compose layouts without writing bespoke CSS files for every screen.
- **Design tokens:** Often mapped to CSS variables (`bg-background`, `text-foreground`) so **theme switching** changes one layer (`dark` class on `html`).
- **Responsive:** Prefixes `sm:`, `md:`, `lg:` for breakpoints.

**This project:** shadcn components + Tailwind; dark/light via tokens and `next-themes`.

### 3.5 React Router (conceptual)

- **Declarative routes:** `<Routes>` / `<Route path="..." element={...} />`.
- **Hooks:** `useNavigate`, `useParams`, `useSearchParams` for navigation and URL state (e.g. feed filters, profile tab).
- **Layouts:** Nested routes with `<Outlet />` (admin shell).

### 3.6 TanStack Query (React Query) (conceptual)

- **Server state cache:** Keys identify queries; automatic background refetch, stale times, deduping in-flight requests.
- **Mutations:** `useMutation` with `onSuccess` invalidate queries.

**This project:** Provider present; many flows still use direct `fetch` + local state—valid pattern for smaller surfaces.

### 3.7 shadcn/ui + Radix (conceptual)

- **Radix:** Accessible primitives (dialogs, dropdowns, focus trap, keyboard)—behavior without imposing visual design.
- **shadcn:** Copy-paste components built on Radix + Tailwind; you own the source in `components/ui`.

### 3.8 SPA + REST integration pattern

- **JWT in memory/storage:** Attach `Authorization: Bearer …` on requests; on **401**, refresh token once then retry or logout.
- **FormData** for multipart uploads (files); omit manual `Content-Type` so the browser sets boundary.
- **CORS:** Browser enforces; Django `django-cors-headers` allows the SPA origin.

---

## 4. AI / LLM part (broader + this project)

### 4.1 What “calling an LLM API” means

- **HTTP POST** to vendor endpoint with JSON body: model id, messages (roles `system` / `user` / `assistant`), optional temperature and response format.
- **Tokens:** Text is chunked into tokens; pricing and limits depend on model and context window size.
- **Structured output:** Some APIs support `response_format: json_object` to bias JSON; if unsupported or rejected (HTTP 400), fallback is plain text + prompt instructions (“reply JSON only”).

### 4.2 Roles of prompts

- **System prompt:** Stable instructions (policy, format, safety stance).
- **User prompt:** Per-request payload (here: issue title, description, category, tags, minimal user-history statistics).

### 4.3 Classification vs generation

- This project uses the model as a **binary classifier with explanation**: legitimate civic issue vs spam/noise, plus confidence and short reason—not open-ended creative generation.

### 4.4 Failure modes (exam answers)

- Network timeouts, rate limits (429), auth errors (401), bad requests (400), quota/billing.
- **Design choice:** Fail-open for UX—if the model cannot be reached, **do not block** legitimate users; mark moderation as skipped and continue.

### 4.5 Privacy & ops notes

- **PII in prompts:** Usernames/emails and post text leave your server for the provider unless you redact—mention data-processing policy in viva if asked.
- **Secrets:** API keys live in **environment** on the server only; never in frontend bundles.

### 4.6 This project’s spam pipeline (concrete)

- Implemented in **`core/spam_filter.py`**, invoked from **`IssueViewSet.perform_create`** before DB commit.
- Builds user signal (account age, post counts, prior flagged count); staff skip classification.
- Parses JSON response defensively; on parse/API failure → treat as legitimate (`skipped` or implicit pass-through logic).
- Outcomes: **`clean`** | **`flagged`** | **`skipped`** stored on `Issue`; flagged posts hidden from public list/detail for non-owners; profile + admin spam UI surface them; admin can **unflag** and optionally trigger deferred assignment.

---

## 5. One-minute flows (viva sound bites)

1. **Post issue:** Login → form + optional media → client validation & token → POST multipart → spam check → atomic save → redirect or profile-flagged path.
2. **Engage:** JWT on vote/comment → counters updated server-side; UI optionally optimistic.
3. **Admin:** Staff routes → list/filter grievance → patch visibility/status → workflow POST writes transition → citizen sees timeline updates (without internal notes).

---

## 6. File map (quick orientation)

| Concern | Typical location |
|---------|------------------|
| Django settings / uploads / env-backed AI vars | `vox_backend/settings.py` |
| Models, signals | `core/models.py` |
| Serializers | `core/serializers.py` |
| Viewsets, admin views, spam endpoints | `core/views.py` |
| Spam OpenAI client logic | `core/spam_filter.py` |
| API wiring | `core/urls.py` |
| SPA routes | `frontend/src/App.tsx` |
| HTTP client & endpoints | `frontend/src/lib/api.ts` |

---

*End of guide.*
