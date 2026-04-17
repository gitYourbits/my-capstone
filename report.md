# VoiceUp Platform Workflow Walkthrough

## 1. Theme Toggle Workflow

### Entry points
- Theme toggle is available in the top navigation on main pages.
- Theme toggle is also present in the top-right corner on Login and Signup screens.

### Step-by-step
1. User clicks the theme toggle icon.
2. UI switches between dark mode and light mode.
3. Icon and tooltip text update based on active mode.
4. User navigates to another route; theme remains consistent.

### Image placeholder
![Theme Toggle Before/After](./images/theme-toggle-before-after.png)

---

## 2. Landing Page Workflow (`/`)

### Main purpose
The landing page introduces the platform and routes users to the two primary actions:
- Explore existing issues.
- Report a new issue.

### Step-by-step
1. User opens the homepage.
2. User sees:
   - Hero section with primary CTA buttons.
   - Feature cards explaining platform capabilities.
   - Secondary CTA section.
   - Footer.
3. User clicks:
   - **Explore Issues** → navigates to `/feed`.
   - **Report an Issue** → navigates to `/create`.

### Image placeholders
![Landing Hero](./images/landing-hero.png)
![Landing Features](./images/landing-features.png)
![Landing CTA](./images/landing-cta.png)

---

## 3. Account Creation Workflow (`/signup`)

### Input fields
- Full Name
- Email
- Password
- Confirm Password
- Terms acceptance checkbox

### Validation sequence
1. User submits form.
2. Validation checks:
   - All fields are filled.
   - Password and confirm password match.
   - Password meets minimum length.
   - Password is not numeric-only.
   - Password is not too similar to email prefix.
   - Terms checkbox is checked.
3. If any check fails, user gets an inline toast error and remains on the same form.

### Success path
1. User passes validation.
2. Account is created.
3. Auth tokens are stored.
4. Success toast appears.
5. User is redirected to `/feed`.

### Failure path
1. Backend rejects request.
2. User sees error toast with the most relevant available message.
3. User remains on form for correction/retry.

### Image placeholders
![Signup Form](./images/signup-form.png)
![Signup Validation Error](./images/signup-validation-error.png)
![Signup Success Redirect](./images/signup-success-redirect.png)

---

## 4. Login Workflow (`/login`)

### Input fields and controls
- Username or Email
- Password
- Show/Hide password toggle
- Remember me checkbox (UI state)

### Step-by-step
1. User enters credentials.
2. User optionally toggles password visibility.
3. User submits form.
4. Required field validation runs.
5. If valid:
   - Login request succeeds.
   - Tokens are stored.
   - Success toast appears.
   - User is redirected to `/feed`.
6. If invalid:
   - Error toast appears.
   - User remains on login page.

### Image placeholders
![Login Form](./images/login-form.png)
![Login Error State](./images/login-error-state.png)
![Login Success](./images/login-success.png)

---

## 5. Logout Workflow

### Step-by-step
1. Authenticated user opens profile dropdown in navbar.
2. User clicks **Logout**.
3. Stored auth tokens are removed.
4. User is redirected to `/`.

### Image placeholder
![Logout From Navbar](./images/logout-navbar.png)

---

## 6. Navbar and Global Search Workflow

### Navigation links and actions
- Explore → `/feed`
- Trending → `/feed?sort_by=trending`
- Post Issue → `/create`
- My Issues (authenticated) → `/profile`

### Search flow
1. User enters search text in navbar search input.
2. User submits search form.
3. App navigates to `/feed?search=<query>`.
4. Feed uses query param for result loading.

### Image placeholders
![Navbar Authenticated](./images/navbar-authenticated.png)
![Navbar Unauthenticated](./images/navbar-unauthenticated.png)
![Navbar Search To Feed](./images/navbar-search-to-feed.png)

---

## 7. Explore Feed Workflow (`/feed`)

### Feed loading sequence
1. Feed initializes with default sort (Trending unless URL says otherwise).
2. URL params are parsed (`search`, `sort_by`).
3. Issues load based on active filters and query.
4. One of three states is shown:
   - Loading spinner
   - Empty result state
   - Issue card list

### Filter workflow
Filters include:
- Sort type
- Category
- State / District / City
- Scope

Desktop:
- Sidebar is visible.

Mobile:
- Sidebar is toggled via filter button.

### Issue card information in feed
- Vote controls and score
- Category, location, relative time
- Title and description preview
- Optional right thumbnail image
- Top comments preview under description (compact)
- Tags
- Posted by info
- Assignment/workflow badge (if present)
- Comments count and share button

### Image placeholders
![Feed Loading](./images/feed-loading.png)
![Feed With Filters](./images/feed-with-filters.png)
![Feed Empty State](./images/feed-empty-state.png)
![Feed Issue Card Anatomy](./images/feed-issue-card-anatomy.png)

---

## 8. Create Issue Workflow (`/create`)

### Access behavior
1. User opens create route.
2. If not logged in:
   - Error toast is shown.
   - User is redirected to `/login`.
3. If logged in:
   - Create form and dropdown data initialize.

### Form sections
- Issue title
- Detailed description
- Category
- Location: state, district, city
- Scope
- Tags (comma-separated)
- Evidence uploads (image, video, audio)
- Anonymous toggle

### Evidence upload behavior
1. User selects files by type.
2. Client validates format and size per media type.
3. Valid files are added to list.
4. Invalid files are rejected with clear error toast.
5. User can remove any selected file before submit.
6. Mobile camera shortcut appears in supported mobile contexts.

### Submission behavior
1. User clicks **Post Issue**.
2. Form sends request with a submission token to prevent accidental duplicate posts.
3. Success outcomes:
   - New post created -> success toast -> redirect to `/issue/:id`.
   - Duplicate retry detected -> informative toast -> redirect to previously created `/issue/:id`.
4. Failure outcome:
   - Error toast shown.
   - User remains on create form.

### Admin workflow impact
- New issues follow assignment configuration used in admin assignment setup.
- If the category is mapped to an initiator, assignment and initial workflow state become visible on public cards/detail.

### Image placeholders
![Create Issue Form](./images/create-issue-form.png)
![Evidence Upload List](./images/create-evidence-upload-list.png)
![Create Validation Error](./images/create-validation-error.png)
![Create Success Redirect](./images/create-success-redirect.png)

---

## 9. Public Issue Detail Workflow (`/issue/:id`)

### Initial load
1. Issue details load by issue id.
2. Comments load.
3. View tracking is attempted.
4. If issue fetch fails:
   - Error toast appears.
   - User is redirected to `/feed`.

### Sections rendered
- Full issue card
- Evidence gallery (images/videos/audio)
- Processing status timeline:
   - Current stage and assignment
   - Stage transitions
   - Workflow transition notes
- Discussion section:
   - Comment composer (if logged in)
   - Login prompt (if not logged in)
   - Full comment list with nested replies

### Linked admin updates reflected here
- Workflow/stage/assignee updates from admin grievance detail appear in the public processing section.
- Transition notes entered during admin workflow updates are shown in the public timeline.

### Owner controls
Visible only if current user is the owner:
- **Edit** button -> `/issue/:id/edit`
- **Delete** button with confirmation prompt

Delete success path:
1. User confirms deletion.
2. Delete request succeeds.
3. Success toast appears.
4. User is redirected to `/profile`.

### Image placeholders
![Issue Detail Main](./images/issue-detail-main.png)
![Issue Detail Evidence](./images/issue-detail-evidence.png)
![Issue Detail Workflow Notes](./images/issue-detail-workflow-notes.png)
![Issue Detail Owner Controls](./images/issue-detail-owner-controls.png)

---

## 10. Commenting and Voting Workflow

### Issue voting (from card/detail)
1. User clicks upvote or downvote.
2. Vote state toggles based on prior vote:
   - Add vote
   - Change vote
   - Remove same vote
3. UI updates score state.
4. On request error, destructive toast appears.

### Comment posting
1. User types comment.
2. User optionally enables anonymous mode.
3. User clicks **Post Comment**.
4. On success:
   - Comment box clears.
   - Comments reload.
   - Issue reloads for updated comment count.
   - Success toast appears.
5. On failure:
   - Error toast appears.

### Comment voting
1. User clicks upvote/downvote on a comment.
2. Local vote state updates.
3. Comments reload for consistency.

### Replies
- Nested replies are displayed below parent comment in threaded style.

### Linked admin usage
- The same issue comments and replies are visible in admin grievance detail for moderation and decision context.

### Image placeholders
![Discussion Composer](./images/discussion-composer.png)
![Discussion List With Replies](./images/discussion-list-with-replies.png)
![Comment Voting States](./images/comment-voting-states.png)

---

## 11. Share Issue Link Workflow

### Step-by-step
1. User clicks share icon on issue card.
2. Public issue URL is copied to clipboard.
3. Success toast confirms copy.

### Image placeholder
![Share Link Toast](./images/share-link-toast.png)

---

## 12. Profile Workflow (`/profile`)

### Access behavior
1. User opens profile route.
2. If not authenticated -> redirect to `/login`.
3. If authenticated:
   - User summary loads.
   - User-owned issues list loads.

### States
- Loading state
- Empty state with create CTA
- Populated own-issues list

### Actions per issue
- **Edit** -> opens `/issue/:id/edit`
- **Delete** -> confirmation prompt -> removes issue from list on success

### Linked admin visibility
- Deleted issues are removed from both public and admin issue management views.

### Image placeholders
![Profile Header](./images/profile-header.png)
![Profile Empty State](./images/profile-empty-state.png)
![Profile Owned Issues](./images/profile-owned-issues.png)

---

## 13. Edit Issue Workflow (`/issue/:id/edit`)

### Access and authorization flow
1. User opens edit route.
2. If not authenticated -> redirect to `/login`.
3. Issue loads and ownership is checked.
4. If not owner:
   - Error toast appears.
   - Redirect to `/issue/:id`.

### Edit form behavior
1. Form is pre-filled with current issue values:
   - title
   - description
   - category
   - state/district/city
   - scope
   - tags
   - anonymous toggle
2. User edits fields.
3. User clicks **Save Changes**.
4. On success:
   - Success toast appears.
   - Redirect to issue detail page.
5. On failure:
   - Error toast appears.
   - User remains in edit form.

### Image placeholders
![Edit Issue Prefilled](./images/edit-issue-prefilled.png)
![Edit Issue Save Success](./images/edit-issue-save-success.png)

---

## 14. Admin Access Workflow (In-App)

### Entry path
1. Staff user logs in through standard login flow.
2. Navbar profile dropdown shows **Admin** option for staff users.
3. User clicks **Admin** and enters the admin panel at `/admin`.

### Access control behavior
1. Admin layout checks authentication and staff role.
2. If user is not logged in -> redirect to `/login`.
3. If user is logged in but not staff -> redirect to `/`.
4. If user is staff -> admin panel is rendered.

### Admin panel shell
- Top bar includes:
  - Back to site link
  - Admin label
  - Internal navigation tabs:
    - Dashboard
    - Grievances
    - Assignment

### Public workflow linkage
- Staff users access admin features using the same platform account used for public workflows.
- Non-staff users continue with public-only navigation and do not see admin entry.

### Image placeholders
![Admin Entry From Navbar](./images/admin-entry-from-navbar.png)
![Admin Layout Shell](./images/admin-layout-shell.png)

---

## 15. Admin Dashboard Workflow (`/admin`)

### Purpose
Provide high-level operational visibility and quick drill-down.

### Step-by-step
1. Dashboard loads summary cards:
   - Total grievances
   - Pending review count
   - Last 7 days new submissions
   - Resolved count
2. Status breakdown card displays counts by stage.
3. User clicks:
   - Pending "View all" -> opens filtered grievances list.
   - "Manage all grievances" -> opens full grievances table.

### Public workflow linkage
- Counts and statuses shown here are derived from issues created through the public posting flow.

### Image placeholders
![Admin Dashboard Metrics](./images/admin-dashboard-metrics.png)
![Admin Dashboard Status Breakdown](./images/admin-dashboard-status-breakdown.png)

---

## 16. Admin Grievances List Workflow (`/admin/grievances`)

### Purpose
Browse and filter all submitted issues.

### Step-by-step
1. Page loads grievance table with key columns:
   - Title
   - Category
   - Assigned to
   - Workflow stage
   - Location
   - Status
   - Score
   - Created time
2. User filters by:
   - Search (title/description)
   - Status dropdown
3. URL query params update as filters change.
4. Table updates to show filtered records.
5. User clicks row action icon to open grievance detail.

### Public workflow linkage
- Every row represents a public issue that can also be opened from `/feed` or `/issue/:id`.

### Image placeholders
![Admin Grievances List](./images/admin-grievances-list.png)
![Admin Grievances Filtered](./images/admin-grievances-filtered.png)

---

## 17. Admin Grievance Detail Workflow (`/admin/grievances/:id`)

### Left-side investigation area
- Full grievance details:
  - category, title, author, location, stats
  - description
  - media evidence
  - tags
- Issue comments section shown below details:
  - all available comments
  - nested replies where present

### Right-side action area

#### A) Status and visibility actions
1. Update grievance status.
2. Toggle featured flag.
3. Toggle verified flag.
4. Open public issue page in new tab.

#### B) Workflow management
1. Review current workflow stage and assignee.
2. Select next stage.
3. Optionally change assignee.
4. Add optional transition note.
5. Submit workflow update.
6. Review workflow history log.

#### C) Admin notes
1. Choose note type:
   - Internal note
   - Public response
2. Enter note text.
3. Click **Add note**.
4. Notes list updates with author, type badge, and timestamp.

### Public workflow linkage
- Workflow stage/assignee changes in this screen are reflected in public issue status/timeline.
- Workflow transition notes added here are visible in public issue processing updates.
- Internal admin notes remain in admin context; they are not rendered in public issue detail.

### Image placeholders
![Admin Grievance Detail Full](./images/admin-grievance-detail-full.png)
![Admin Grievance Workflow Update](./images/admin-grievance-workflow-update.png)
![Admin Grievance Notes](./images/admin-grievance-notes.png)
![Admin Grievance Comments Panel](./images/admin-grievance-comments-panel.png)

---

## 18. Admin Assignment Workflow (`/admin/assignment`)

### Purpose
Configure category-to-initiator mapping used for automatic assignment of new issues.

### Step-by-step
1. Page loads:
   - Assignment categories
   - Staff list
2. For each assignment category, admin reviews linked issue categories.
3. Admin selects initiator from dropdown.
4. System saves mapping and updates UI state.
5. Updated mapping is used when new issues are created.

### Public workflow linkage
- This mapping directly controls automatic assignment behavior immediately after public issue creation.

### Image placeholders
![Admin Assignment Overview](./images/admin-assignment-overview.png)
![Admin Assignment Save Success](./images/admin-assignment-save-success.png)

---

## 19. Practical Screenshot Placement Order

Recommended insertion sequence for final documentation:
1. Theme toggle (dark/light)
2. Landing page (hero/features/CTA)
3. Signup flow
4. Login flow
5. Navbar + search flow
6. Feed with filters
7. Issue card details in feed
8. Create issue form and upload behavior
9. Issue detail page with evidence
10. Workflow status and notes
11. Discussion and replies
12. Share action confirmation
13. Profile page states
14. Edit issue flow
15. Admin entry from navbar
16. Admin dashboard
17. Admin grievances list and filtering
18. Admin grievance detail actions
19. Admin assignment configuration

