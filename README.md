# Kula Vruksham

Your family, mapped. A multi-family genealogy platform for Indian families.

## Deploy in 15 minutes

You need: a GitHub account, a browser. Nothing else.

### Step 1: Set up the database (Supabase — free)

1. Go to [supabase.com](https://supabase.com) and sign in with GitHub
2. Click **"New Project"** — pick any name, set a password, choose a region close to you
3. Wait ~2 minutes for it to spin up
4. Go to **SQL Editor** (left sidebar) → click **"New Query"**
5. Paste the entire contents of `supabase-schema.sql` from this repo
6. Click **"Run"** — you should see "Success"
7. Go to **Settings → API** (left sidebar)
8. Copy **Project URL** and **anon/public key** — you'll need these next

### Step 2: Push to GitHub

```bash
cd kulavruksham
git init
git add .
git commit -m "initial"
git remote add origin git@github.com:YOUR_USERNAME/kulavruksham.git
git push -u origin main
```

### Step 3: Deploy (Vercel — free)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"** → import your `kulavruksham` repo
3. Before deploying, add **Environment Variables**:
   - `VITE_SUPABASE_URL` → paste your Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` → paste your anon key from Step 1
4. Click **"Deploy"**
5. Done. You get a URL like `kulavruksham.vercel.app`

### Step 4: Share with family

Send the Vercel URL to your family on WhatsApp. They open it, create their branch, add people. No login needed.

## Local development

```bash
cp .env.example .env
# Fill in your Supabase URL and key in .env
npm install
npm run dev
```

Opens at `http://localhost:5173`

## How it works

- **Home screen**: Create a family or open an existing one
- **Inside a family**: Tree on left, details on right
- **Click a person** → see their info, add relatives around them
- **Three buttons**: ↑ ancestor above, ♥ spouse, ↓ child below
- **Four tabs on edit**: Basic info, Identity (gotra, languages), Work, Social profiles
- **Export**: Download JSON backup anytime

## Tech stack

- **Frontend**: React + Vite
- **Database**: Supabase (Postgres)
- **Hosting**: Vercel
- **Auth**: None (open access — anyone with the URL can contribute)

## Data model

Each person has:
- **Core**: name, clan, gender, status (living/deceased), generation
- **Kinship**: parent_id, spouse_id, sort_order
- **Identity**: gotra, native_place, languages
- **Professional**: occupation (role, company), education
- **Social**: profiles (LinkedIn, Facebook, Instagram, WhatsApp)
- **Contact**: phone, address
- **Meta**: notes, verified, role

All stored in Supabase Postgres. Families are isolated by `family_id`. Cross-family marriage links planned for future.
