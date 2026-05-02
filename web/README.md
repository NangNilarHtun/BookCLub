# Books & Friends Web

React + Vite web client for Books & Friends v1.

## Features implemented

- Email/password sign up and sign in (Supabase Auth)
- Public reading sessions (one book per session)
- Join session
- Chapter-based progress updates with progress bar
- Flat discussion thread per session
- Multiple emoji reactions per comment
- Responsive layout for desktop/tablet/mobile

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Confirm `.env.local` has:

   ```bash
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

3. In Supabase SQL editor, run:

   - `supabase/schema.sql`
   - `supabase/seed.sql` (optional demo data)

4. Start app:

   ```bash
   npm run dev
   ```

## Notes

- v1 intentionally excludes notifications, search, and private sessions.
- This app assumes authenticated users can read public session data.

