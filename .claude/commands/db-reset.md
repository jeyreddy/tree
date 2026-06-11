Reset or re-apply the Supabase database schema.

The schema lives in `supabase-schema.sql`. To apply it:

1. Open your Supabase project → **SQL Editor** → **New Query**
2. Paste the contents of `supabase-schema.sql`
3. Click **Run**

> Warning: Re-running will fail on existing tables. To reset cleanly, drop the tables first:
> ```sql
> drop table if exists persons cascade;
> drop table if exists families cascade;
> ```
> Then re-run `supabase-schema.sql`.
