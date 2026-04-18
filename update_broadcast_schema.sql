-- =========================================================================
-- FeedLoop: High-Fidelity Broadcast & Verification Schema Update
-- INSTRUCTIONS: Run this in your Supabase SQL Editor.
-- =========================================================================

-- 1. Enhance Food Listings with Media & Details
ALTER TABLE public.food_listings 
ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notes text;

-- 2. Ensure Verification Schema matches Frontend
-- (Run this if you haven't yet updated your Recipients table)
ALTER TABLE public.recipients 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text DEFAULT 'Hyderabad',
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS daily_need integer DEFAULT 0;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text DEFAULT 'Hyderabad';

-- 3. Utility Function to Verify an Organization (Optional Admin Tool)
-- Usage: SELECT verify_organization('USER_UUID_HERE');
CREATE OR REPLACE FUNCTION verify_organization(target_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.users SET verified = true WHERE id = target_user_id;
  UPDATE public.recipients SET verified = true WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Initial Seed Update (Optional: Add mock notes/photos to existing listings)
UPDATE public.food_listings 
SET notes = 'Please pickup from the main entrance. Food is packed in spill-proof containers.',
    photos = ARRAY['https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=800']
WHERE title ILIKE '%Buffet%' AND (photos IS NULL OR photos = '{}');
