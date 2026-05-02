# Books & Friends — Product Specification (v1)

## 1) Product Overview

**Product name:** Books & Friends  
**Description:** A social reading app where members create book reading sessions, join others, track chapter progress with a progress bar, and discuss in one flat thread with emoji reactions.  
**Platforms:** Web App, Mobile App  
**Backend:** Supabase

---

## 2) Product Goals

- Make it easy for anyone to register and join reading sessions.
- Enable clear, chapter-based progress tracking.
- Encourage discussion around a shared book in each session.
- Keep v1 simple and social-first.

---

## 3) Scope

### In Scope (v1)

- Member registration and login
- Create session for one book (title, author, chapter count)
- Public sessions only
- Join session
- Update reading progress by chapter
- Visual progress bar per member based on chapters completed
- Flat discussion thread per session
- Multiple emoji reactions on comments/discussion posts

### Out of Scope (v1)

- Notifications
- Search
- Private sessions
- Extra host permissions/moderation controls
- Multi-book sessions

---

## 4) Roles and Permissions

### Roles

- **Guest:** Unauthenticated visitor
- **Member:** Authenticated user

### Permission Model (v1)

- No special host permissions beyond creating session settings at creation time.
- All authenticated members in a session can:
  - Submit progress updates
  - Post in discussion
  - React with multiple emoji

---

## 5) Functional Requirements

### FR-1 Authentication

- Users can register and log in.
- Only authenticated members can create/join sessions and participate.

### FR-2 Session Creation

- A member can create a session with:
  - Book title
  - Book author
  - Total chapter count (integer)
  - Visibility: public
- Each session must reference exactly one book.

### FR-3 Session Visibility

- Sessions in v1 are public and visible/joinable by authenticated members.

### FR-4 Session Joining

- Members can join eligible sessions.
- Membership is required for progress and discussion participation.

### FR-5 Progress Tracking

- Progress is chapter-based, not page-based.
- Member submits current chapter progress.
- System renders a progress bar:
  - Formula: `current_chapter / total_chapters`
  - Display as percentage and chapter count (for example, 6/20).
- Progress value cannot exceed total chapters and cannot be less than 0.

### FR-6 Discussion

- Each session has exactly one **flat** discussion thread.
- Members can post comments in chronological order.
- Nested replies are not included in v1.

### FR-7 Reactions

- Members can react to comments/discussion posts with multiple emoji.
- A member may add multiple different emoji reactions to the same comment.
- Members can remove their own reactions.
- Reaction counts are displayed per emoji.

---

## 6) Non-Functional Requirements

- **Platform parity:** Core v1 features available on web and mobile.
- **Security:** Supabase Auth + Row Level Security (RLS) on all user/session data.
- **Performance target:** Session detail page and discussion load quickly under normal mobile network conditions.
- **Data integrity:** Chapter progress and reaction constraints enforced at API/DB level.

---

## 7) Suggested Data Model (Supabase/Postgres)

### `profiles`

- `id` (uuid, references `auth.users.id`)
- `display_name`
- `avatar_url` (optional)
- `created_at`, `updated_at`

### `reading_sessions`

- `id` (uuid)
- `host_user_id` (uuid)
- `book_title` (text)
- `book_author` (text)
- `total_chapters` (int, > 0)
- `visibility` (enum: `public`) for v1
- `created_at`, `updated_at`

### `session_members`

- `id` (uuid)
- `session_id` (uuid)
- `user_id` (uuid)
- `joined_at`
- Unique: (`session_id`, `user_id`)

### `progress_updates`

- `id` (uuid)
- `session_id` (uuid)
- `user_id` (uuid)
- `current_chapter` (int, >= 0)
- `created_at`

### `discussion_comments`

- `id` (uuid)
- `session_id` (uuid)
- `user_id` (uuid)
- `content` (text)
- `created_at`, `updated_at`

### `comment_reactions`

- `id` (uuid)
- `comment_id` (uuid)
- `user_id` (uuid)
- `emoji` (text)
- `created_at`
- Unique: (`comment_id`, `user_id`, `emoji`)

---

## 8) Key User Flows (v1)

### Flow A: Register and Join

1. User registers/logs in.
2. User views joinable public sessions.
3. User joins session.

### Flow B: Create Session

1. Member creates session with one book and total chapters.
2. Session is saved and shown in public listings.

### Flow C: Update Progress

1. Member enters current chapter.
2. System validates value against total chapters.
3. Progress bar updates in session view.

### Flow D: Discuss and React

1. Member posts comment in flat thread.
2. Other members react with one or more emoji.
3. Reaction counters update.

---

## 9) API/Backend Behavior (High-Level)

- Supabase Auth handles authentication.
- RLS policies ensure only authorized access:
  - Members can read/write their own profile and reactions.
  - Session members can read/write progress and comments for that session.
- Realtime subscriptions can be used for live updates (discussion/progress/reactions), optional for first implementation pass.

---

## 10) Acceptance Criteria (v1)

- User can create a public session with one book.
- User can join a session and submit chapter progress.
- Progress bar renders correct percentage from chapter counts.
- Session discussion is flat (no nested replies).
- User can add multiple emoji reactions to a comment.
- No notification system exists in v1.
- No search functionality exists in v1.

---

## 11) Future Enhancements (Post-v1)

- Notifications (in-app, push)
- Search and discovery
- Private sessions and invitation controls
- Session host moderation controls
- Rich comment features (mentions, replies, pinning)
- Reading analytics and streaks

---

## 12) Current Supabase Setup (Project Context)

### Project

- **Supabase project URL:** `https://awcgikcvasunjabihgug.supabase.co`
- **Auth mode in use:** Email/password
- **Current v1 session mode:** Public only

### Web App Environment

- Frontend reads Supabase config from:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` (publishable key)
- Local env file path:
  - `web/.env.local`

### Applied SQL Files

- Schema and RLS policies:
  - `web/supabase/schema.sql`
  - Includes `profiles` RLS policies (`read profiles`, `insert own profile`, `update own profile`)
- Seed/demo data:
  - `web/supabase/seed.sql`
  - Idempotent seed script for reruns

### Seeded Test Context

- Known users with explicit display names in seed:
  - `nilar@gmail.com` -> `Nilar`
  - `saline@gmail.com` -> `Saline`
- Seed data includes:
  - Profiles upsert
  - Public sessions
  - Session members
  - Progress updates
  - Flat discussion comments
  - Emoji reactions

### Dashboard Configuration Notes

- Site URL for local development: `http://localhost:5173`
- Email provider enabled in Supabase Auth
- If signup testing is blocked, disable email confirmation for local testing

### Current Web Routes (for Supabase/Auth Context)

- Login page: `http://localhost:5173/auth`
- Sessions page: `http://localhost:5173/session`
- Session detail page: `http://localhost:5173/session/:sessionId`
- Redirect behavior:
  - Unauthenticated users are redirected to `/auth`
  - Authenticated users are redirected to `/session` from `/` and `/auth`

