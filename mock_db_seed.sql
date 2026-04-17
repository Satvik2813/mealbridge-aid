-- =========================================================================
-- FeedLoop Realistic Mock Data Seed Script
-- INSTRUCTIONS: Run this entire script in your Supabase SQL Editor.
-- It will insert mock users, listings, requests, deliveries, and impact logs
-- into your public tables and light up your home page dashboards.
-- =========================================================================

-- Enable uuidosspj if not already (Supabase usually has this)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
  donor1_id uuid := uuid_generate_v4();
  donor2_id uuid := uuid_generate_v4();
  recipient1_id uuid := uuid_generate_v4();
  recipient2_id uuid := uuid_generate_v4();
  partner1_id uuid := uuid_generate_v4();
  partner2_id uuid := uuid_generate_v4();
  
  listing1_id uuid := uuid_generate_v4(); -- Delivered past
  listing2_id uuid := uuid_generate_v4(); -- Live critical
  listing3_id uuid := uuid_generate_v4(); -- Live medium
  listing4_id uuid := uuid_generate_v4(); -- Request need (recipient broadcasting)
  
  request1_id uuid := uuid_generate_v4();
  request2_id uuid := uuid_generate_v4();
  
  delivery1_id uuid := uuid_generate_v4();
  delivery2_id uuid := uuid_generate_v4();
BEGIN

  -- 1. Create Mock Users (Bypassing auth.users FK constraint by inserting into auth.users first, IF accessible.
  -- Otherwise, we temporarily disable the constraint, insert public users, then re-enable. Let's do the standard approach:)
  
  BEGIN
    -- This works locally / if auth is accessible
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES 
      (donor1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spice.garden@feedloop.local'),
      (donor2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'karachi.bakery@feedloop.local'),
      (recipient1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sunshine@feedloop.local'),
      (recipient2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ashraya@feedloop.local'),
      (partner1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya.delivery@feedloop.local'),
      (partner2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rahul.delivery@feedloop.local')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- If auth.users insertion fails due to permissions in cloud Supabase, we skip.
    -- You may need to create users via the dashboard first.
    RAISE NOTICE 'Could not insert into auth.users. You might hit fkey errors if run on cloud DB directly.';
  END;

  INSERT INTO public.users (id, name, email, roles, org_name, donor_category, city, location_lat, location_lng, avatar_url, verified)
  VALUES
    (donor1_id, 'Spice Garden Manager', 'spice.garden@feedloop.local', ARRAY['donor'::user_role], 'Spice Garden', 'restaurant', 'Hyderabad', 17.4326, 78.4071, 'https://api.dicebear.com/7.x/initials/svg?seed=SG', true),
    (donor2_id, 'Karachi Bakery Owner', 'karachi.bakery@feedloop.local', ARRAY['donor'::user_role], 'Karachi Bakery', 'restaurant', 'Hyderabad', 17.3850, 78.4867, 'https://api.dicebear.com/7.x/initials/svg?seed=KB', true),
    (recipient1_id, 'Sister Maria', 'sunshine@feedloop.local', ARRAY['recipient'::user_role], 'Sunshine Childrens Home', NULL, 'Hyderabad', 17.4200, 78.4500, 'https://api.dicebear.com/7.x/initials/svg?seed=SH', true),
    (recipient2_id, 'Ashraya Admin', 'ashraya@feedloop.local', ARRAY['recipient'::user_role], 'Ashraya Night Shelter', NULL, 'Hyderabad', 17.3900, 78.4700, 'https://api.dicebear.com/7.x/initials/svg?seed=AS', true),
    (partner1_id, 'Priya Singh', 'priya.delivery@feedloop.local', ARRAY['partner'::user_role], NULL, NULL, 'Hyderabad', 17.4100, 78.4300, 'https://api.dicebear.com/7.x/initials/svg?seed=PS', true),
    (partner2_id, 'Rahul Kumar', 'rahul.delivery@feedloop.local', ARRAY['partner'::user_role], NULL, NULL, 'Hyderabad', 17.4000, 78.4600, 'https://api.dicebear.com/7.x/initials/svg?seed=RK', true)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Insert Recipient Profiles
  INSERT INTO public.recipients (user_id, org_name, capacity, daily_need, verified)
  VALUES
    (recipient1_id, 'Sunshine Childrens Home', 150, 450, true),
    (recipient2_id, 'Ashraya Night Shelter', 80, 160, true)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Insert Food Listings
  INSERT INTO public.food_listings (
    id, donor_id, title, items, meals_count, food_type, category, 
    cooked_at, expires_at, urgency, status, lat, lng, address, safety_score
  ) VALUES
    -- Historical completed run
    (listing1_id, donor1_id, 'Buffet Leftovers', 
     '[{"name": "Paneer Butter Masala", "qty": "5", "unit": "kg"}, {"name": "Jeera Rice", "qty": "10", "unit": "kg"}]'::jsonb, 
     80, 'veg', 'restaurant', 
     now() - interval '2 days', now() - interval '1 day', 'low', 'delivered', 
     17.4326, 78.4071, 'Spice Garden, Banjara Hills, Hyderabad', 95),
     
    -- Active Live Run (Critical)
    (listing2_id, donor1_id, 'Corporate Lunch Surplus', 
     '[{"name": "Chicken Biryani", "qty": "15", "unit": "kg"}, {"name": "Dal Makhani", "qty": "5", "unit": "kg"}]'::jsonb, 
     120, 'veg', 'event', 
     now() - interval '2 hours', now() + interval '1 hour', 'critical', 'available', 
     17.4326, 78.4071, 'Spice Garden, Banjara Hills, Hyderabad', 82),
     
    -- Active Live Run (Medium)
    (listing3_id, donor2_id, 'Bakery End of Day', 
     '[{"name": "Fruit Buns", "qty": "50", "unit": "pieces"}, {"name": "Vegetable Puffs", "qty": "30", "unit": "pieces"}]'::jsonb, 
     40, 'veg', 'bakery', 
     now() - interval '30 mins', now() + interval '5 hours', 'medium', 'available', 
     17.3850, 78.4867, 'Karachi Bakery, Mozamjahi Market, Hyderabad', 98),
     
    -- Broadcast Need from Recipient (Status: available, prefixed with [NEED])
    (listing4_id, recipient1_id, '[NEED] Dinner Meals Required', 
     '[{"name": "Any Cooked Meal", "qty": "50", "unit": "plates"}]'::jsonb, 
     50, 'veg', 'restaurant', 
     now(), now() + interval '4 hours', 'high', 'available', 
     17.4200, 78.4500, 'Sunshine Home, Kukatpally, Hyderabad', NULL);

  -- 4. Food Requests (NGO claiming food)
  INSERT INTO public.food_requests (id, listing_id, recipient_id, status, beneficiaries_count, message)
  VALUES
    (request1_id, listing2_id, recipient2_id, 'pending', 60, 'We can serve this for dinner immediately.'),
    (request2_id, listing3_id, recipient1_id, 'confirmed', 40, 'Perfect for tomorrow morning breakfast.');

  -- (Listing status is automatically managed by the UI/DB rules depending on request state)

  -- 5. Deliveries
  INSERT INTO public.deliveries (
    id, listing_id, request_id, partner_id, status, 
    pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km
  ) VALUES
    -- The delivered historical entry
    (delivery1_id, listing1_id, request1_id, partner1_id, 'delivered', 
     17.4326, 78.4071, 17.3900, 78.4700, 6.2),
     
    -- An active "in-transit" delivery for Listing 3
    (delivery2_id, listing3_id, request2_id, partner2_id, 'in_transit', 
     17.3850, 78.4867, 17.4200, 78.4500, 4.8);

  -- 6. Impact Logs
  INSERT INTO public.impact_logs (
    listing_id, delivery_id, donor_id, recipient_id, partner_id, meals_rescued, co2_saved, distance_km, logged_at
  ) VALUES
    -- Record from 2 days ago
    (listing1_id, delivery1_id, donor1_id, recipient2_id, partner1_id, 80, 42.5, 6.2, now() - interval '2 days');

  -- Extra impact records to pad the Global Stats
  INSERT INTO public.impact_logs (donor_id, meals_rescued, co2_saved, logged_at) VALUES 
    (donor1_id, 500, 250, now() - interval '10 days'),
    (donor2_id, 850, 425, now() - interval '5 days');

END $$;
