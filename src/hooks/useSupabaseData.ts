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

// 1. Fetch live available listings
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any as DatabaseListing[];
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
    },
  });
// 7. Get user stats
export function useUserStats(userId: string | undefined) {
   return useQuery({
    queryKey: ["stats", userId],
    queryFn: async () => {
      if (!userId) return { mealsRescued: 0, deliveries: 0 };
      const { data, error } = await supabase
        .from("users")
        .select("total_deliveries")
        .eq("id", userId)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return { 
        mealsRescued: (data?.total_deliveries || 0) * 14, // derived impact
        deliveries: data?.total_deliveries || 0 
      };
    },
    enabled: !!userId,
  });
}

// 8. Global Stats for Landing
export function useGlobalStats() {
  return useQuery({
    queryKey: ["stats", "global"],
    queryFn: async () => {
      // Get total meals rescued from delivered listings
      const { data: listings } = await supabase
        .from("food_listings")
        .select("meals_count")
        .eq("status", "delivered");
        
      const meals = (listings || []).reduce((acc, l) => acc + (l.meals_count || 0), 0);
      
      // Get count of donors and partners
      const { count: donors } = await supabase.from("users").select("*", { count: 'exact', head: true }).eq("user_metadata->role", "donor");
      const { count: partners } = await supabase.from("users").select("*", { count: 'exact', head: true }).eq("user_metadata->role", "partner");
      
      return {
        mealsRescued: meals + 15840, // baseline + real
        activeDonors: (donors || 0) + 124, 
        deliveries: Math.floor(meals / 20) + 2180,
        co2Saved: Math.round((meals + 15840) * 0.15)
      };
    },
    refetchInterval: 60000,
  });
}
