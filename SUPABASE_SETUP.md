# Supabase Setup Guide

This guide will help you set up your own Supabase instance for this healthcare application.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details and create the project
4. Wait for the project to be provisioned

## Step 2: Get Your Credentials

1. Go to Project Settings → API
2. Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy your **anon/public key**
4. Create a `.env` file in your project root and add:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

## Step 3: Run Database Migrations

This app requires several database tables. Go to SQL Editor in your Supabase dashboard and run the migrations from the `supabase/migrations/` folder in order.

## Step 4: Set Up Authentication

1. Go to Authentication → Providers in your Supabase dashboard
2. Enable Email authentication
3. Configure redirect URLs:
   - Add your development URL (e.g., `http://localhost:5173`)
   - Add your production URL when deployed
4. Go to Authentication → URL Configuration:
   - Set **Site URL** to your app's URL
   - Add redirect URLs for auth callbacks

## Step 5: Configure Storage (Optional)

If you need file storage:
1. Go to Storage in your Supabase dashboard
2. Create necessary buckets (e.g., `avatars`, `medical-records`)
3. Set up RLS policies for secure access

## Step 6: Set Up Edge Functions (Optional)

If you're using edge functions:
1. Install Supabase CLI: `npm install -g supabase`
2. Link your project: `supabase link --project-ref your-project-ref`
3. Deploy functions: `supabase functions deploy function-name`

## Required Tables

Your Supabase project needs these tables:
- `profiles` - User profiles
- `user_roles` - User role assignments
- `appointments` - Appointment bookings
- `notifications` - System notifications
- `appointment_feedback` - Feedback and ratings
- `medical_records` - Patient medical records
- `medications` - Medication tracking
- `notification_preferences` - User notification settings

All migrations are in the `supabase/migrations/` folder.

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure your `.env` file is in the root directory
- Restart your development server after adding environment variables

### Authentication not working
- Check that redirect URLs are properly configured in Supabase dashboard
- Verify Site URL matches your app's URL

### Can't see data
- Check Row Level Security (RLS) policies in Supabase dashboard
- Make sure policies allow the authenticated user to access their data

## Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
