import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DatabaseListing {
  id: string;
  donor_id: string;
  title: string;
  items: string[]; // Simplification of JSONB structure "[]"
  meals_count: number;
  food_type: "veg" | "non-veg" | "vegan" | "mixed";
  category: "restaurant" | "event" | "home" | "bakery" | "catering";
  cooked_at: string;
  expires_at: string;
  urgency: "low" | "medium" | "high" | "critical";
  status: "available" | "requested" | "assigned" | "delivered" | "expired";
  address: string;
  lat: number;
  lng: number;
  created_at: string;
  // joined from users
  donor?: { name: string; org_name: string; donor_category: string };
}

// 1. Fetch live available listings (Surplus food only)
export function useAvailableListings() {
  return useQuery<DatabaseListing[]>({
    queryKey: ["listings", "available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_listings")
        .select(`
          *,
          donor:users!donor_id (
            name, org_name, donor_category
          )
        `)
        .eq("status", "available")
        .not("title", "ilike", "[NEED]%") // Exclude broadcasted needs
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any as DatabaseListing[];
    },
  });
}

// 1b. Fetch active recipient needs (Broadcasts)
export function useAvailableNeeds() {
  return useQuery<DatabaseListing[]>({
    queryKey: ["listings", "needs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_listings")
        .select(`
          *,
          donor:users!donor_id (
            name, org_name, donor_category
          )
        `)
        .eq("status", "available")
        .ilike("title", "[NEED]%") // Only broadcasted needs
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any as DatabaseListing[];
    },
  });
}

// 1c. Recipient: Broadcast a new food need
export function useCreateNeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (need: {
      recipient_id: string;
      meals_count: number;
      food_type: string;
      items: string[];
      address: string;
      lat: number;
      lng: number;
      notes: string;
    }) => {
      const { data, error } = await supabase
        .from("food_listings")
        .insert([{
          donor_id: need.recipient_id, // For a "Need", the recipient is the "owner"
          title: `[NEED] ${typeof need.items[0] === 'object' ? need.items[0].name : (need.items[0] || 'Food Needed')}`,
          items: need.items,
          meals_count: need.meals_count,
          food_type: need.food_type,
          category: "restaurant", // Using a valid enum value from schema
          status: "available",
          address: need.address,
          lat: need.lat,
          lng: need.lng,
          notes: need.notes,
          cooked_at: new Date().toISOString(), // Irrelevant for needs but keep schema happy
          expires_at: new Date(Date.now() + 4 * 3600000).toISOString(), // 4h window
          urgency: "high"
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

// 2. Fetch listings for a specific donor
export function useDonorListings(donorId: string | undefined) {
  return useQuery<DatabaseListing[]>({
    queryKey: ["listings", "donor", donorId],
    queryFn: async () => {
      if (!donorId) return [];
      const { data, error } = await supabase
        .from("food_listings")
        .select("*")
        .eq("donor_id", donorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DatabaseListing[];
    },
    enabled: !!donorId,
  });
}

// 3. Post a new listing
export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newListing: Partial<DatabaseListing>) => {
      const { data, error } = await supabase
        .from("food_listings")
        .insert([newListing])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

// 4. Partner: Fetch active deliveries or assignments
export function useActiveDelivery(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["delivery", "active", partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      // Fetch deliveries for this partner that are assigned or in transit
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          *,
          food_listings ( * ),
          food_requests (
            *,
            recipient:users!recipient_id ( name, org_name )
          )
        `)
        .eq("partner_id", partnerId)
        .in("status", ["assigned", "picked_up"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 is "no rows found" single() error
      return data;
    },
    enabled: !!partnerId,
  });
}

// 5. Partner: Mark delivery status
export function useUpdateDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from("deliveries")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // also update the underlying listing if it's delivered
      if (status === "delivered" && data.listing_id) {
        await supabase
          .from("food_listings")
          .update({ status: "delivered" })
          .eq("id", data.listing_id);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery"] });
    },
  });
}

// 5b. Recipient: Fetch active tracking delivery
export function useActiveRecipientRequest(recipientId: string | undefined) {
  return useQuery({
    queryKey: ["requests", "active", "recipient", recipientId],
    queryFn: async () => {
      if (!recipientId) return null;
      const { data, error } = await supabase
        .from("food_requests")
        .select(`
          *,
          listing:food_listings ( * ),
          deliveries ( * )
        `)
        .eq("recipient_id", recipientId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
        
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!recipientId,
  });
}

// 5c. Recipient: Fetch all requests for history/list
export function useRecipientRequests(recipientId: string | undefined) {
  return useQuery({
    queryKey: ["requests", "recipient", recipientId],
    queryFn: async () => {
      if (!recipientId) return [];
      const { data, error } = await supabase
        .from("food_requests")
        .select(`
          *,
          listing:food_listings ( * )
        `)
        .eq("recipient_id", recipientId)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!recipientId,
  });
}

// 6. Recipient: Request food
export function useRequestFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: { listing_id: string; recipient_id: string; beneficiaries_count: number; pickup_preference?: string }) => {
      // Check for existing request first to avoid duplicate key error
      const { data: existing } = await supabase
        .from("food_requests")
        .select("id, status")
        .eq("listing_id", req.listing_id)
        .eq("recipient_id", req.recipient_id)
        .maybeSingle();

      if (existing) {
        // Already requested - update pickup_preference if changed
        const { data, error } = await supabase
          .from("food_requests")
          .update({ beneficiaries_count: req.beneficiaries_count, pickup_preference: req.pickup_preference })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("food_requests")
        .insert([{
          listing_id: req.listing_id,
          recipient_id: req.recipient_id,
          beneficiaries_count: req.beneficiaries_count,
          pickup_preference: req.pickup_preference,
          status: "pending"
        }])
        .select()
        .single();
      if (error) throw error;
      
      // Update listing to requested
      await supabase
        .from("food_listings")
        .update({ status: "requested" })
        .eq("id", req.listing_id);
        
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

// 7. Get user stats
export function useUserStats(userId: string | undefined) {
   return useQuery({
    queryKey: ["stats", userId],
    queryFn: async () => {
      if (!userId) return { mealsRescued: 0, deliveries: 0, todayDeliveries: 0 };
      
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("total_deliveries")
        .eq("id", userId)
        .single();
      
      if (profileError && profileError.code !== "PGRST116") throw profileError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayCount, error: deliveryError } = await supabase
        .from("deliveries")
        .select("*", { count: 'exact', head: true })
        .eq("partner_id", userId)
        .gte("created_at", today.toISOString());

      if (deliveryError) throw deliveryError;

      const total = userProfile?.total_deliveries || 0;
      
      return { 
        mealsRescued: total * 14, // derived impact
        deliveries: total,
        todayDeliveries: todayCount || 0
      };
    },
    enabled: !!userId,
  });
}

// 9. All recipient organisations for donor directory
export interface RecipientOrg {
  id: string;
  name: string;
  org_name: string;
  org_type: string; // ngo | orphanage | old_age_home | shelter | school | hospital | community_kitchen | other
  address: string;
  lat: number;
  lng: number;
  beneficiaries_count: number;
  is_verified: boolean;
  created_at: string;
}

export function useAllRecipients() {
  return useQuery<RecipientOrg[]>({
    queryKey: ["recipients", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, org_name, address, location_lat, location_lng, verified, donor_category")
        .contains("roles", ["recipient"]);
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        org_name: u.org_name || u.name,
        org_type: u.org_type || "other",
        address: u.address || "",
        lat: u.location_lat || 17.385,
        lng: u.location_lng || 78.4867,
        beneficiaries_count: u.beneficiaries_count || 0,
        is_verified: u.verified || false,
        email: u.email || "",
        created_at: u.created_at || "",
      })) as unknown as RecipientOrg[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// 11. Fetch online delivery partners from DB
export function useAvailablePartners() {
  return useQuery({
    queryKey: ["partners", "available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, avg_rating, total_deliveries, vehicle_type, availability, partner_lat, partner_lng")
        .contains("roles", ["partner"])
        .eq("availability", "online");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // refresh every 30s
  });
}

// 10. Donor: Send food directly to a specific recipient
export function useSendDirectOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      donor_id: string;
      recipient_id: string;
      items: string[];
      meals_count: number;
      food_type: string;
      category: string;
      cooked_at: string;
      expires_at: string;
      address: string;
      lat: number;
      lng: number;
      notes?: string;
    }) => {
      // Step 1: Create the listing marked as "requested" (skip open broadcast)
      const { data: listing, error: listingErr } = await supabase
        .from("food_listings")
        .insert([{
          donor_id: payload.donor_id,
          title: "Direct Offer",
          items: payload.items,
          meals_count: payload.meals_count,
          food_type: payload.food_type,
          category: payload.category,
          cooked_at: payload.cooked_at,
          expires_at: payload.expires_at,
          urgency: "high",
          status: "requested",
          address: payload.address,
          lat: payload.lat,
          lng: payload.lng,
        }])
        .select()
        .single();
      if (listingErr) throw listingErr;

      // Step 2: Create the direct food request linking listing → recipient
      const { data: request, error: reqErr } = await supabase
        .from("food_requests")
        .insert([{
          listing_id: listing.id,
          recipient_id: payload.recipient_id,
          beneficiaries_count: payload.meals_count,
          pickup_preference: JSON.stringify({ notes: payload.notes || "" }),
          status: "confirmed", // directly confirmed since donor initiated
        }])
        .select()
        .single();
      if (reqErr) throw reqErr;

      return { listing, request };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

// 8. Global Stats for Landing
export function useGlobalStats() {
  return useQuery({
    queryKey: ["stats", "global"],
    queryFn: async () => {
      // Total meals from delivered listings
      const { data: listings } = await supabase
        .from("food_listings")
        .select("meals_count")
        .eq("status", "delivered");
      const meals = (listings || []).reduce((acc, l) => acc + (l.meals_count || 0), 0);

      // Total deliveries count
      const { count: deliveriesCount } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("status", "delivered");

      // Active donors (users with 'donor' in their roles array)
      const { count: donors } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .contains("roles", ["donor"]);

      return {
        mealsRescued: meals,
        activeDonors: donors || 0,
        deliveries: deliveriesCount || 0,
        co2Saved: Math.round(meals * 0.5), // ~0.5 kg CO₂ per meal saved (FSSAI estimate)
      };
    },
    refetchInterval: 60000,
  });
}
// 11. Notifications
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;          // DB column name is 'body'
  message?: string;      // alias kept for call-site compat, mapped on insert
  type: "info" | "success" | "warning" | "error";
  read: boolean;         // DB column name is 'read'
  is_read?: boolean;     // alias kept for SiteHeader compat
  metadata?: any;
  created_at: string;
}

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          queryClient.setQueryData(["notifications", userId], (old: Notification[] = []) => [
            payload.new as Notification,
            ...old,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return useQuery<Notification[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
  });
}

export function useSendNotification() {
  return useMutation({
    mutationFn: async (notification: {
      user_id: string;
      title: string;
      message?: string;  // callers use 'message', we map it to 'body'
      body?: string;
      type: "info" | "success" | "warning" | "error";
      metadata?: any;
    }) => {
      const { data, error } = await supabase
        .from("notifications")
        .insert([{
          user_id: notification.user_id,
          title: notification.title,
          body: notification.body || notification.message || "", // map message→body
          type: notification.type,
          read: false,
        }])
        .select()
        .single();

      if (error) {
        console.warn("Silent notification failure:", error.message);
        return null;
      }
      return data;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })  // correct DB column
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
