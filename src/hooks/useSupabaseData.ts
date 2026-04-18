import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// High-Precision Distance Utility (Haversine Formula)
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Internal Helper for Automation
async function insertPlatformNotification(user_id: string, title: string, body: string, type: "success" | "warning" | "error") {
  const { error } = await supabase
    .from("notifications")
    .insert([{ user_id, title, body, type, read: false }]);
}

// Utility to notify users within a radius
async function notifyNearbyUsers(
  lat: number, 
  lng: number, 
  radiusKm: number, 
  role: 'donor' | 'recipient', 
  title: string, 
  body: string
) {
  // Fetch users with the target role
  const { data: users } = await supabase
    .from("users")
    .select("id, location_lat, location_lng")
    .contains("roles", [role]);
  
  if (!users) return;

  const nearby = users.filter(u => {
    if (!u.location_lat || !u.location_lng) return false;
    const dist = calculateHaversineDistance(lat, lng, u.location_lat, u.location_lng);
    return dist <= radiusKm;
  });

  // Batch insert notifications
  const notificationRows = nearby.map(u => ({
    user_id: u.id,
    title,
    body,
    type: "success" as const,
    read: false
  }));

  if (notificationRows.length > 0) {
    await supabase.from("notifications").insert(notificationRows);
  }
}

// Native Browser Push Utility
export function triggerNativePush(title: string, body?: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { 
      body, 
      icon: "https://vjigpuyzivqjuyvjgkqu.supabase.co/storage/v1/object/public/assets/logo.png" // Placeholder logo or your own
    });
  }
}

// Audio Feedback Utility
export function playSuccessSound() {
  const sound = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  sound.play().catch(e => console.warn("Audio blocked:", e));
}

export interface DatabaseListing {
  id: string;
  donor_id: string;
  title: string;
  items: string[]; // Simplification of JSONB structure "[]"
  meals_count: number;
  food_type: "veg" | "non_veg" | "vegan" | "mixed";
  category: "restaurant" | "event" | "home" | "bakery" | "catering";
  cooked_at: string;
  expires_at: string;
  urgency: "low" | "medium" | "high" | "critical";
  status: "available" | "requested" | "assigned" | "delivered" | "expired";
  address: string;
  lat: number;
  lng: number;
  created_at: string;
  photos?: string[];
  notes?: string;
  safety_score?: number;
  ai_report?: any; // Stores full Forensic report from Gemini
  required_vehicle?: 'bike' | 'auto' | 'truck';
  // joined from users
  donor?: { name: string; org_name: string; donor_category: string };
}

// 1. Fetch live available listings (Surplus food only)
export function useAvailableListings(userLocation?: { lat: number; lng: number }) {
  return useQuery<DatabaseListing[]>({
    queryKey: ["listings", "available", userLocation],
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
      
      const results = (data || []) as any as DatabaseListing[];
      
      if (!userLocation) return results;

      // Enforce 10km Rescue Radius
      return results.filter(l => {
        const dist = calculateHaversineDistance(userLocation.lat, userLocation.lng, l.lat, l.lng);
        return dist <= 10;
      });
    },
  });
}

// 1b. Fetch active recipient needs (Broadcasts)
export function useAvailableNeeds(userLocation?: { lat: number; lng: number }) {
  return useQuery<DatabaseListing[]>({
    queryKey: ["listings", "needs", userLocation],
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
      const results = (data || []) as any as DatabaseListing[];

      if (!userLocation) return results;

      // Enforce 10km Rescue Radius
      return results.filter(l => {
        const dist = calculateHaversineDistance(userLocation.lat, userLocation.lng, l.lat, l.lng);
        return dist <= 10;
      });
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

      // Automation: Notify nearby donors about the new broadcasted need
      notifyNearbyUsers(need.lat, need.lng, 10, 'donor', "Local Food Need Broadcasted", `A recipient needs ${need.meals_count} meals nearby.`);

      playSuccessSound();
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

// Logic to determine vehicle size based on meal quantity
export const calculateRequiredVehicle = (mealsCount: number): 'bike' | 'auto' | 'truck' => {
  if (mealsCount <= 40) return 'bike';
  if (mealsCount <= 150) return 'auto';
  return 'truck';
};

// 3. Post a new listing
export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newListing: Partial<DatabaseListing>) => {
      // Robustness: Map 'other' category to a valid DB enum
      const processedListing = { 
        ...newListing,
        category: (newListing.category === 'other' || !newListing.category) ? 'restaurant' : newListing.category
      };

      const { data, error } = await supabase
        .from("food_listings")
        .insert([processedListing])
        .select()
        .single();

      if (error) throw error;

      // Automation: Notify nearby recipients about the new broadcast
      if (data.lat && data.lng) {
        notifyNearbyUsers(data.lat, data.lng, 10, 'recipient', "Fresh Food Surplus Nearby", `${data.meals_count} meals available at ${data.address}`);
      }

      playSuccessSound();
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
          listing:food_listings ( * ),
          request:food_requests (
            *,
            recipient:users ( name, org_name, address, location_lat, location_lng )
          )
        `)
        .eq("partner_id", partnerId)
        .in("status", ["assigned", "picked_up", "en_route"])
        .order("assigned_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 is "no rows found" single() error
      return data;
    },
    enabled: !!partnerId,
    staleTime: 1000 * 30, // 30s cache for active mission
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

      // Automation: Notify relevant parties based on status
      const { data: details } = await supabase
        .from("deliveries")
        .select("*, listing:food_listings!listing_id(donor_id, title), request:food_requests!request_id(recipient_id)")
        .eq("id", id)
        .single();
      
      if (details) {
        const donorId = details.listing?.donor_id;
        const recipientId = details.request?.recipient_id;

        if (status === 'assigned') {
          if (donorId) insertPlatformNotification(donorId, "Partner Accepted", `A volunteer is coming for: ${details.listing?.title}`, "success");
          if (recipientId) insertPlatformNotification(recipientId, "Partner Accepted", "A volunteer has accepted your food request!", "success");
        } else if (status === 'picked_up') {
          if (recipientId) insertPlatformNotification(recipientId, "Food En-Route", "Your food has been collected and is on the way!", "success");
        } else if (status === 'delivered') {
          if (donorId) insertPlatformNotification(donorId, "Delivery Complete", `Mission successful: ${details.listing?.title}`, "success");
          if (recipientId) insertPlatformNotification(recipientId, "Delivered", "Enjoy your meal! The mission was completed successfully.", "success");
        }
      }

      playSuccessSound();
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
          listing:food_listings!listing_id ( * )
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

// 5b-i. Fetch active delivery for a specific request ID (fixes 406 join error)
export function useActiveDeliveryForRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ["delivery", "active", "request", requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, partner:users!partner_id(vehicle_type)")
        .eq("request_id", requestId)
        .in("status", ["assigned", "picked_up", "en_route"])
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });
}

// 5c-ii. Partner: Fetch historical deliveries
export function usePartnerHistory(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["deliveries", "history", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          *,
          listing:food_listings ( * ),
          request:food_requests (
            *,
            recipient:users ( name, org_name, address, location_lat, location_lng )
          )
        `)
        .eq("partner_id", partnerId)
        .eq("status", "delivered")
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

// 5c. Recipient: Fetch all requests (Current & History)
export function useRecipientRequests(recipientId: string | undefined) {
  return useQuery({
    queryKey: ["requests", "recipient", recipientId],
    queryFn: async () => {
      if (!recipientId) return [];
      const { data, error } = await supabase
        .from("food_requests")
        .select(`
          *,
          listing:food_listings!listing_id ( * )
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
    mutationFn: async (req: { 
      listing_id: string; 
      recipient_id: string; 
      beneficiaries_count: number; 
      delivery_method: 'self' | 'partner';
      pickup_preference?: string;
    }) => {
      // Preserve recipient's location data (lat/lng) from pickup_preference
      let parsedPref: any = {};
      try {
        parsedPref = req.pickup_preference ? JSON.parse(req.pickup_preference) : {};
      } catch { parsedPref = { notes: req.pickup_preference || "" }; }
      
      const metadata = JSON.stringify({
        method: req.delivery_method,
        ...parsedPref  // Spread lat, lng, address, requirements directly
      });
      
      // Check for existing request first to avoid duplicate key error
      const { data: existing } = await supabase
        .from("food_requests")
        .select("id, status")
        .eq("listing_id", req.listing_id)
        .eq("recipient_id", req.recipient_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("food_requests")
          .update({ 
            beneficiaries_count: req.beneficiaries_count, 
            pickup_preference: metadata 
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        playSuccessSound();
        return data;
      }

      const { data, error } = await supabase
        .from("food_requests")
        .insert([{
          listing_id: req.listing_id,
          recipient_id: req.recipient_id,
          beneficiaries_count: req.beneficiaries_count,
          pickup_preference: metadata,
          status: "pending"
        }])
        .select()
        .single();
      if (error) throw error;
      
      playSuccessSound();
      
      // Automation: Notify the Donor
      const { data: listing } = await supabase
        .from("food_listings")
        .select("donor_id, title")
        .eq("id", req.listing_id)
        .single();
      
      if (listing?.donor_id) {
        insertPlatformNotification(listing.donor_id, "New Food Request", `Someone requested your listing: ${listing.title}`, "success");
      }
        
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

// 7. Get high-precision user stats from real-time DB records
export function useUserStats(userId: string | undefined) {
   return useQuery({
    queryKey: ["stats", userId],
    queryFn: async () => {
      if (!userId) return { mealsRescued: 0, deliveries: 0, todayDeliveries: 0, impactPoints: 0 };
      
      // 1. Get Donor Identity Impact (Sum of meals from delivered listings)
      const { data: donorListings } = await supabase
        .from("food_listings")
        .select("meals_count")
        .eq("donor_id", userId)
        .eq("status", "delivered");
      
      const donorMeals = (donorListings || []).reduce((acc, l) => acc + (l.meals_count || 0), 0);

      // 2. Get Partner Impact (Actual count of completed deliveries)
      const { count: deliveriesCount } = await supabase
        .from("deliveries")
        .select("*", { count: 'exact', head: true })
        .eq("partner_id", userId)
        .eq("status", "delivered");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayCount } = await supabase
        .from("deliveries")
        .select("*", { count: 'exact', head: true })
        .eq("partner_id", userId)
        .gte("assigned_at", today.toISOString());

      // 3. Get Recipient Impact (Sum of meals received)
      const { data: recipientRequests } = await supabase
        .from("food_requests")
        .select("beneficiaries_count, listing:food_listings(status)")
        .eq("recipient_id", userId);
      
      const receivedMeals = (recipientRequests || [])
        .filter((r: any) => r.listing?.status === "delivered")
        .reduce((acc, r) => acc + (r.beneficiaries_count || 0), 0);

      const totalMeals = donorMeals + receivedMeals;
      
      return { 
        mealsRescued: totalMeals,
        deliveries: deliveriesCount || 0,
        todayDeliveries: todayCount || 0,
        impactPoints: (totalMeals * 10) + ((deliveriesCount || 0) * 50)
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
      // Query STRICTLY from the recipients table as requested
      const { data, error } = await supabase
        .from("recipients")
        .select(`
          org_name, org_type, capacity, address,
          user:users!user_id ( id, name, email, location_lat, location_lng, verified )
        `);

      if (error) throw error;
      
      return (data || []).map((r: any) => {
        const u = r.user || {};
        return {
          id: u.id,
          name: u.name,
          org_name: r.org_name || u.name,
          org_type: r.org_type || "other",
          address: r.address || "",
          lat: u.location_lat || 17.385,
          lng: u.location_lng || 78.4867,
          beneficiaries_count: r.capacity || 0,
          is_verified: u.verified || false,
          email: u.email || "",
          created_at: "", // optional
        };
      }) as unknown as RecipientOrg[];
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
    refetchInterval: 30000,
  });
}

// 12. Partner: Update vehicle type
export function useUpdatePartnerVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, vehicleType }: { userId: string; vehicleType: string }) => {
      const { data, error } = await supabase
        .from("users")
        .update({ vehicle_type: vehicleType })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stats", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["partner-profile", variables.userId] });
    },
  });
}

export function usePendingMissions(partnerVehicle: string | undefined, partnerLocation?: { lat: number; lng: number }) {
  return useQuery({
    queryKey: ["requests", "pending", partnerVehicle, partnerLocation],
    queryFn: async () => {
      let query = supabase
        .from("food_requests")
        .select(`
          *,
          listing:food_listings!listing_id (
            *,
            donor:users!donor_id ( name, org_name, address )
          ),
          recipient:users!recipient_id ( name, org_name, address, location_lat, location_lng )
        `)
        .in("status", ["pending", "confirmed"]);
      
      const { data, error } = await query;
      if (error) throw error;
      
      const results = (data || []).filter((r: any) => 
        ["available", "requested"].includes(r.listing?.status)
      );

      let filtered = results;

      if (partnerVehicle) {
        filtered = filtered.filter((r: any) => {
          const reqVehicle = r.listing?.required_vehicle || 'bike';
          if (partnerVehicle === 'truck') return true; 
          if (partnerVehicle === 'auto') return reqVehicle === 'auto' || reqVehicle === 'bike';
          return reqVehicle === 'bike';
        });
      }

      // Enforce 10km Rescue Radius for Partners
      if (partnerLocation) {
        filtered = filtered.filter((r: any) => {
          const distToDonor = calculateHaversineDistance(partnerLocation.lat, partnerLocation.lng, r.listing?.lat, r.listing?.lng);
          return distToDonor <= 10;
        });
      }

      return filtered;
    },
    staleTime: 1000 * 20,
  });
}

// 10. Donor: Send food directly to a specific recipient
export function useSendDirectOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      donor_id: string;
      recipient_id: string | null;
      target_name?: string;
      target_lat?: number;
      target_lng?: number;
      target_address?: string;
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
      photos?: string[];
    }) => {
      // Robustness: Map 'other' category to a valid DB enum if needed
      const validCategory = (payload.category === 'other' || !payload.category) ? 'restaurant' : payload.category;
      const reqVehicle = calculateRequiredVehicle(payload.meals_count);

      // Step 1: Create the listing marked as "requested" (skip open broadcast)
      const { data: listing, error: listingErr } = await supabase
        .from("food_listings")
        .insert([{
          donor_id: payload.donor_id,
          title: "Direct Offer to " + (payload.target_name || "Recipient"),
          items: payload.items,
          meals_count: payload.meals_count,
          food_type: payload.food_type,
          category: validCategory,
          cooked_at: payload.cooked_at,
          expires_at: payload.expires_at,
          urgency: "high",
          status: "requested",
          address: payload.address,
          lat: payload.lat,
          lng: payload.lng,
          photos: payload.photos,
          notes: payload.notes,
          required_vehicle: reqVehicle
        }])
        .select()
        .single();
      if (listingErr) throw listingErr;

      // Step 2: Create the direct food request linking listing → recipient (ONLY if not a Google/External target)
      let request = null;
      if (payload.recipient_id) {
        const { data: requestData, error: reqErr } = await supabase
          .from("food_requests")
          .insert([{
            listing_id: listing.id,
            recipient_id: payload.recipient_id,
            beneficiaries_count: payload.meals_count,
            pickup_preference: JSON.stringify({
              name: payload.target_name,
              address: payload.target_address,
              lat: payload.target_lat,
              lng: payload.target_lng,
              notes: payload.notes || ""
            }),
            status: "confirmed", // directly confirmed since donor initiated
          }])
          .select()
          .single();
        if (reqErr) {
          console.error("Link request failed:", reqErr);
          // We don't throw here so the listing creation is still considered a success for the donor
        }
        request = requestData;
      }

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

      // Top Donors (Calculated from delivered listings)
      const { data: donorData } = await supabase
        .from("food_listings")
        .select("meals_count, donor:users!donor_id(name, org_name, city)")
        .eq("status", "delivered");

      const donorMap: Record<string, { name: string; area: string; meals: number }> = {};
      (donorData || []).forEach((row: any) => {
        const name = row.donor?.org_name || row.donor?.name || "Anonymous Donor";
        const area = row.donor?.city || "Hyderabad";
        if (!donorMap[name]) donorMap[name] = { name, area, meals: 0 };
        donorMap[name].meals += (row.meals_count || 0);
      });
      const topDonors = Object.values(donorMap)
        .sort((a, b) => b.meals - a.meals)
        .slice(0, 5);

      // Top Communities (Calculated from confirmed requests for delivered listings)
      const { data: recipientData } = await supabase
        .from("food_requests")
        .select("beneficiaries_count, recipient:users!recipient_id(name, org_name, city), listing:food_listings!listing_id(status)")
        .filter("listing.status", "eq", "delivered");

      const recipientMap: Record<string, { name: string; area: string; meals: number }> = {};
      (recipientData || []).forEach((row: any) => {
        const name = row.recipient?.org_name || row.recipient?.name || "Community Partner";
        const area = row.recipient?.city || "Hyderabad";
        if (!recipientMap[name]) recipientMap[name] = { name, area, meals: 0 };
        recipientMap[name].meals += (row.beneficiaries_count || 0);
      });
      const topRecipients = Object.values(recipientMap)
        .sort((a, b) => b.meals - a.meals)
        .slice(0, 5);

      return {
        mealsRescued: meals,
        activeDonors: donors || 0,
        deliveries: deliveriesCount || 0,
        co2Saved: Math.round(meals * 0.5),
        topDonors,
        topRecipients,
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

// 12. Recipient: Fetch detailed profile including verification
export function useRecipientProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["recipient", "profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("recipients")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// 13. Recipient: Submit verification form
export function useUpdateRecipientProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      user_id: string;
      org_name: string;
      capacity: number;
      reg_doc_url?: string;
      verified?: boolean;
      address?: string;
      city?: string;
      org_type?: string;
      daily_need?: number;
    }) => {
      // 1. Update/Insert in recipients table
      const { data: existing } = await supabase
        .from("recipients")
        .select("id")
        .eq("user_id", payload.user_id)
        .maybeSingle();

      const recipientData = {
        org_name: payload.org_name,
        capacity: payload.capacity,
        reg_doc_url: payload.reg_doc_url,
        verified: payload.verified ?? false, // Default to false for moderated review
        org_type: payload.org_type || 'orphanage',
        daily_need: payload.daily_need || payload.capacity * 3,
      };

      if (existing) {
        const { error } = await supabase
          .from("recipients")
          .update(recipientData)
          .eq("user_id", payload.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recipients").insert([{
          user_id: payload.user_id,
          ...recipientData
        }]);
        if (error) throw error;
      }

      // 2. Sync verified status to users table
      const { error: userError } = await supabase
        .from("users")
        .update({ 
          verified: payload.verified ?? false, // Sync the "Pending" state
          org_name: payload.org_name,
          address: payload.address,
          city: payload.city || 'Hyderabad'
        })
        .eq("id", payload.user_id);
      
      if (userError) throw userError;

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recipient", "profile", variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Preload notification sound
    const notificationSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");

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
          const newNotif = payload.new as Notification;
          // Play sound alert
          notificationSound.play().catch(e => console.warn("Audio play blocked by browser:", e));
          
          // Trigger native push
          triggerNativePush(newNotif.title, newNotif.body || newNotif.message);

          // Haptic Feedback for mobile
          if ("vibrate" in navigator) {
            navigator.vibrate([100, 30, 100]);
          }
          
          queryClient.setQueryData(["notifications", userId], (old: Notification[] = []) => [
            newNotif,
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
      type: "success" | "warning" | "error";
      metadata?: any;
    }) => {
      const { data, error } = await supabase
        .from("notifications")
        .insert([{
          user_id: notification.user_id,
          title: notification.title,
          body: notification.body || notification.message || "", // map message→body
          type: notification.type === ("info" as any) ? "success" : notification.type,
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
    onSuccess: (_, id) => {
      // Optimistic update handled at component layer but invalidate for safety
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
