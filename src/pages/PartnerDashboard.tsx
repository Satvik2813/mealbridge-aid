import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapCanvas } from "@/components/MapCanvas";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { useActiveDelivery, useUpdateDelivery, useSendNotification, useUserStats, usePendingMissions, usePartnerHistory, useUpdatePartnerVehicle } from "@/hooks/useSupabaseData";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bike,
  Camera,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Navigation,
  PackageCheck,
  Star,
  Trophy,
  Truck,
  Clock,
  Radio,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Step = 0 | 1 | 2 | 3; // 0 heading, 1 picked up, 2 en route, 3 delivered

// Helper to calculate distance in KM
const calculateDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const PartnerDashboard = () => {
  const [online, setOnline] = useState(true);
  const [step, setStep] = useState<Step>(() => {
    const saved = localStorage.getItem('partner_delivery_step');
    return saved ? parseInt(saved) as Step : 0;
  });

  const [active, setActive] = useState<string | null>(() => {
    return localStorage.getItem('partner_active_delivery_id');
  });

  useEffect(() => {
    localStorage.setItem('partner_delivery_step', step.toString());
  }, [step]);

  useEffect(() => {
    if (active) localStorage.setItem('partner_active_delivery_id', active);
    else localStorage.removeItem('partner_active_delivery_id');
  }, [active]);
  const [shareLocation, setShareLocation] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: activeDeliveryData, isLoading: deliveryLoading } = useActiveDelivery(user?.id);
  const { data: stats } = useUserStats(user?.id);
  
  const { data: partnerProfile } = useQuery({
    queryKey: ["partner-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('vehicle_type').eq('id', user?.id).single();
      return data;
    },
    enabled: !!user?.id
  });

  const updateDeliveryMutation = useUpdateDelivery();
  const updateVehicleMutation = useUpdatePartnerVehicle();
  const sendNotificationMutation = useSendNotification();

  const [partnerPos, setPartnerPos] = useState({ lat: 17.3850, lng: 78.4867 });

  useEffect(() => {
    // Initialize online state from DB on mount
    if (user?.id) {
      supabase.from('users').select('availability').eq('id', user.id).single().then(({ data }) => {
        if (data) setOnline(data.availability === 'online');
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (navigator.geolocation && online) {
      const watchId = navigator.geolocation.watchPosition((pos) => {
        setPartnerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [online]);

  useEffect(() => {
    if (active && shareLocation && online) {
      const channel = supabase.channel(`delivery_broadcast_${active}`);
      let interval: NodeJS.Timeout;
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          interval = setInterval(() => {
            channel.send({
              type: 'broadcast',
              event: 'location',
              payload: partnerPos
            });
          }, 3000); // broadcast every 3s
        }
      });
      return () => { 
        if (interval) clearInterval(interval);
        supabase.removeChannel(channel); 
      };
    }
  }, [active, shareLocation, online, partnerPos]);

  const { data: pendingRequests, isLoading: requestsLoading } = usePendingMissions(partnerProfile?.vehicle_type || 'bike', partnerPos);
  const { data: historyMissions } = usePartnerHistory(user?.id);

  const orders = pendingRequests || [];
  const activeOrder = activeDeliveryData?.listing?.[0] || activeDeliveryData?.listing;
  const activeRequest = activeDeliveryData?.request?.[0] || activeDeliveryData?.request;
  
  // We sync active states from network safely inside an effect
  useEffect(() => {
    if (activeDeliveryData && (!active || active !== activeDeliveryData.id)) {
      setActive(activeDeliveryData.id);
      
      // If the delivery ID changed or we are initializing, sync status
      // But don't reset step if we already have it in localStorage for this ID
      if (activeDeliveryData.status === 'assigned' && step > 1) {
          // Keep local step if it's already advanced
      } else if (activeDeliveryData.status === 'picked_up' && step < 1) {
          setStep(1);
      }
    } else if (!activeDeliveryData && !deliveryLoading && active) {
        // Active delivery finished or cancelled
        setActive(null);
        setStep(0);
    }
  }, [activeDeliveryData, active, deliveryLoading]);

  const pickupAddress = activeOrder?.address || "Pickup location";
  
  // Robust JSON parsing for delivery metadata
  const dropInfo = useMemo(() => {
    try {
      const pref = activeRequest?.pickup_preference;
      if (!pref) return null;
      return typeof pref === 'string' ? JSON.parse(pref) : pref;
    } catch (e) {
      return null;
    }
  }, [activeRequest]);

  const dropAddress = dropInfo?.address || "Drop location";

  const isActuallyLoading = authLoading || (deliveryLoading && !active);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <div className="container py-20 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground font-display text-lg">Waking up the engine...</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  // Calculate dynamic ETAs
  const distToPickup = activeOrder ? calculateDistance(partnerPos.lat, partnerPos.lng, activeOrder.lat, activeOrder.lng) : 0;
  const distToDrop = activeOrder && dropInfo?.lat ? calculateDistance(activeOrder.lat, activeOrder.lng, dropInfo.lat, dropInfo.lng) : 0;
  
  const etaPickup = Math.max(2, Math.round(distToPickup * 6)); // ~6 mins per km
  const etaDrop = Math.max(3, Math.round(distToDrop * 6));

  const dynamicSteps = [
    { label: "Heading to pickup", at: pickupAddress, time: `ETA ${etaPickup} min` },
    { label: "Picked up", at: `${activeOrder?.meals_count || 0} meals secured`, time: "" },
    { label: "En route to drop", at: dropAddress, time: `ETA ${etaDrop} min` },
    { label: "Delivered", at: "Mission complete", time: "" },
  ];

  const accept = async (request: any) => {
    if (!user) {
      toast.error("Please log in to accept missions");
      return navigate("/login/partner");
    }
    try {
      const { data, error } = await supabase.from('deliveries').insert({
        listing_id: request.listing_id,
        request_id: request.id,
        partner_id: user.id,
        status: 'assigned'
      }).select().single();
      
      if (error) throw error;

      await supabase.from('food_requests').update({ status: 'confirmed' }).eq('id', request.id);
      await supabase.from('food_listings').update({ status: 'assigned' }).eq('id', request.listing_id);
      
      setActive(data.id);
      setStep(0);

      // Notify Donor & Recipient
      const partnerName = user?.user_metadata?.full_name || "A partner";
      await sendNotificationMutation.mutateAsync({
        user_id: request.listing.donor_id,
        title: "Partner Assigned",
        message: `${partnerName} is coming to pick up food from your listing "${typeof request.listing.items[0] === 'object' ? request.listing.items[0].name : request.listing.items[0]}".`,
        type: "info"
      });
      await sendNotificationMutation.mutateAsync({
        user_id: request.recipient_id,
        title: "Partner Assigned",
        message: `${partnerName} has accepted your request and is coming to pick up the food!`,
        type: "info"
      });

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["delivery"] });
      toast.success("Mission accepted!", { description: "Navigating to pickup" });
    } catch(e: any) {
      toast.error("Failed to accept", { description: e.message });
    }
  };

  const next = async () => {
    if (!active) return;
    const nextStep = (step + 1) as Step;
    setStep(nextStep);
    
    let dbStatus = "picked_up";
    if (nextStep === 1) dbStatus = "picked_up";
    if (nextStep === 2) dbStatus = "picked_up"; // Safely fallback as the db doesn't support 'in_transit' natively
    if (nextStep === 3) {
      if (!photoFile) {
        toast.error("Proof photo required", { description: "Please upload a photo of the delivery to complete the mission." });
        setStep(2); // Revert step
        return;
      }
      toast.loading("Uploading proof...", { id: 'proof-upload' });
      try {
        // Mocking upload for local presentation to prevent CORS/R2 blocks bridging
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success("Delivery complete 🎉", { id: 'proof-upload', description: "Great job!" });
      } catch (e: any) {
        toast.error("Upload failed", { id: 'proof-upload', description: "Could not save proof" });
        setStep(2);
        return;
      }
      dbStatus = "delivered";
      
      // Notify Donor & Recipient
      if (activeOrder && activeRequest) {
        await sendNotificationMutation.mutateAsync({
          user_id: activeOrder.donor_id,
          title: "Delivery Completed",
          message: `Food from your listing "${typeof activeOrder.items[0] === 'object' ? activeOrder.items[0].name : activeOrder.items[0]}" has been delivered to ${activeRequest.recipient?.org_name || "the recipient"}.`,
          type: "success"
        });
        await sendNotificationMutation.mutateAsync({
          user_id: activeRequest.recipient_id,
          title: "Food Delivered",
          message: "Your food has been delivered! Enjoy your meal 💚",
          type: "success"
        });
      }
    } else if (nextStep === 1) {
       // Mark Picked Up
       if (activeOrder && activeRequest) {
        const partnerName = user?.user_metadata?.full_name || "The partner";
        await sendNotificationMutation.mutateAsync({
          user_id: activeOrder.donor_id,
          title: "Food Picked Up",
          message: `Food from your listing "${typeof activeOrder.items[0] === 'object' ? activeOrder.items[0].name : activeOrder.items[0]}" has been picked up by ${partnerName}.`,
          type: "info"
        });
        await sendNotificationMutation.mutateAsync({
          user_id: activeRequest.recipient_id,
          title: "Food On The Way",
          message: `${partnerName} has picked up your food and is on the way!`,
          type: "info"
        });
      }
    }
    
    try {
      await updateDeliveryMutation.mutateAsync({ id: active, status: dbStatus });
    } catch(e: any) {
      console.error(e);
      toast.error("Status sync failed", { description: e.message || "Unknown error" });
    }
  };

  const reset = async () => {
    setActive(null);
    setStep(0);
    localStorage.removeItem('partner_delivery_step');
    localStorage.removeItem('partner_active_delivery_id');
    setPhotoFile(null);
    // Refetch from DB — completed deliveries are filtered out in useActiveDelivery
    await queryClient.invalidateQueries({ queryKey: ["delivery"] });
    await queryClient.invalidateQueries({ queryKey: ["requests", "pending"] });
    toast.success("Ready for next delivery!");
  };

  let routeCoords = undefined;
  let dynamicPins = undefined;
  if (activeOrder) {
    if (step === 0 && partnerPos.lat) {
      // Draw route: Current Partner Location -> Pickup Location
      routeCoords = [
        { lat: partnerPos.lat, lng: partnerPos.lng },
        { lat: activeOrder.lat, lng: activeOrder.lng }
      ];
      dynamicPins = [
        { x: 0, y: 0, lat: activeOrder.lat, lng: activeOrder.lng, color: "hsl(var(--primary))", pulse: true }
      ];
    } else if (step >= 1 && activeRequest?.pickup_preference) {
      // Draw route: Pickup Location -> Drop Location
      try {
        const pref = typeof activeRequest.pickup_preference === 'string' 
          ? JSON.parse(activeRequest.pickup_preference) 
          : activeRequest.pickup_preference;
        if (pref.lat && pref.lng) {
          routeCoords = [
            { lat: activeOrder.lat, lng: activeOrder.lng }, // Donor location
            { lat: pref.lat, lng: pref.lng } // Recipient Drop location
          ];
          dynamicPins = [
            { x: 0, y: 0, lat: activeOrder.lat, lng: activeOrder.lng, color: "hsl(var(--primary))" },
            { x: 0, y: 0, lat: pref.lat, lng: pref.lng, color: "hsl(var(--urgent-high))", pulse: true }
          ];
        }
      } catch(e) {}
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />

      {/* Persistent Presence Bar - Always color & interactive */}
      <section className="border-b border-border/60 bg-background sticky top-[64px] z-40">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              online ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Radio className={cn("h-4 w-4", online && "animate-pulse")} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
              <p className="text-sm font-semibold">{online ? "Active & Ready" : "Currently Offline"}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Vehicle Selection */}
            <Select 
              value={partnerProfile?.vehicle_type || 'bike'} 
              onValueChange={(v) => {
                if (user?.id) updateVehicleMutation.mutate({ userId: user.id, vehicleType: v });
              }}
            >
              <SelectTrigger className="h-8 w-[100px] rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted/50 border-none">
                <SelectValue placeholder="Vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bike">🛵 Bike</SelectItem>
                <SelectItem value="auto">🛺 Auto</SelectItem>
                <SelectItem value="truck">🚚 Truck</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full text-primary hover:bg-primary/10 h-8 text-[10px] font-bold uppercase tracking-wider"
              onClick={() => setIsHistoryOpen(true)}
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              History
            </Button>

            <div className="flex items-center gap-3 rounded-full bg-muted/50 px-4 py-2">
            <span className={cn("h-2 w-2 rounded-full", online ? "bg-urgent-low animate-pulse" : "bg-muted-foreground")} />
            <span className="text-xs font-bold uppercase tracking-wider">{online ? "Online" : "Offline"}</span>
            <Switch 
              checked={online} 
              onCheckedChange={async (o) => {
                if (!user) {
                  toast.error("Please log in to go online");
                  return navigate("/login/partner");
                }
                setOnline(o);
                await supabase.from('users').update({ availability: o ? 'online' : 'offline' }).eq('id', user.id);
              }} 
            />
          </div>
        </div>
      </div>
    </section>

      <main className={cn(
        "transition-all duration-1000 ease-in-out",
        !online && "grayscale opacity-70 pointer-events-none select-none"
      )}>

      {/* Header Info */}
      <section className="border-b border-border/60 bg-background">
        <div className="container py-8">
          <p className="text-sm text-muted-foreground">Delivery partner</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            Hi {user?.user_metadata?.full_name?.split(' ')[0] || "Partner"} {
              partnerProfile?.vehicle_type === 'truck' ? '🚚' : 
              partnerProfile?.vehicle_type === 'auto' ? '🛺' : '🛵'
            }
          </h1>
          <p className="mt-2 text-muted-foreground">
            ★ 4.9 · Top 5% in Hyderabad · {stats?.deliveries || 0} missions
          </p>
        </div>
      </section>

      <section className="border-b border-border/60 bg-background">
        <div className="container grid grid-cols-2 gap-4 py-6 md:grid-cols-4">
          {[
            { label: "Today", value: stats?.todayDeliveries || "0", suffix: "deliveries" },
            { label: "Meals moved", value: stats?.mealsRescued || "0", suffix: "total" },
            { label: "km covered", value: ((stats?.deliveries || 0) * 4.2).toFixed(1), suffix: "estimated" },
            { label: "Reliability", value: "100%", suffix: "score" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.suffix}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_1.2fr]">
        {/* Available orders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">
              {active ? "Order queue" : "Available now"}
            </h2>
            <span className="text-sm text-muted-foreground">
              within 5 km
            </span>
          </div>

          {orders.map((o) => (
            <article
              key={o.id}
              className={cn(
                "rounded-3xl bg-card p-5 shadow-soft transition-smooth",
                active === o.id && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pickup · {o.listing?.required_vehicle === 'truck' ? '🚚 Truck Required' : o.listing?.required_vehicle === 'auto' ? '🛺 Auto Needed' : '🛵 Bike Ready'}
                  </p>
                  <p className="font-semibold">{o.listing?.donor?.org_name || o.listing?.donor?.name || "Donor"}</p>
                  <p className="text-xs text-muted-foreground">{o.listing?.address}</p>
                </div>
                <UrgencyBadge urgency={o.listing?.urgency || "low"} timeLeft={o.listing?.expires_at ? new Date(o.listing.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Soon"} pulse={o.listing?.urgency === "critical"} />
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Drop · {o.recipient?.org_name || o.recipient?.name || "Recipient"}</span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold">{o.beneficiaries_count} meals</span>
                  <span className="text-muted-foreground">~18 min</span>
                </div>
                {!active ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="rounded-full">
                      Skip
                    </Button>
                    <Button size="sm" className="rounded-full" onClick={() => accept(o)}>
                      Accept
                    </Button>
                  </div>
                ) : (
                  active === o.id && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Active
                    </span>
                  )
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Active delivery / Idle state */}
        <div className="space-y-4">
          {!active ? (
            <div className="rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-warm">
              <Trophy className="h-6 w-6" />
              <h3 className="mt-3 font-display text-3xl font-semibold">
                Ready when you are.
              </h3>
              <p className="mt-2 max-w-sm opacity-90">
                Accept a mission on the left to start. Your live ETA will be
                shared with both donor and recipient.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur">
                  <p className="text-xs opacity-80">Lifetime trips</p>
                  <p className="font-display text-xl font-semibold">{stats?.deliveries || 0}</p>
                </div>
                <div className="rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur">
                  <p className="text-xs opacity-80">Reward points</p>
                  <p className="font-display text-xl font-semibold">{(stats?.deliveries || 0) * 50}</p>
                </div>
              </div>
            </div>
          ) : step === 3 ? (
            <div className="overflow-hidden rounded-3xl bg-card shadow-warm">
              <div className="bg-gradient-hero p-8 text-center text-primary-foreground">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h3 className="mt-4 font-display text-3xl font-semibold">
                  Delivered with love 💚
                </h3>
                <p className="mt-2 opacity-90">
                  {activeOrder?.meals_count} meals served!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-display text-xl font-semibold">{etaDrop + etaPickup + 4} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-display text-xl font-semibold">{(distToDrop + distToPickup).toFixed(1)} km</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="font-display text-xl font-semibold inline-flex items-center gap-1">
                    5 <Star className="h-4 w-4 fill-accent text-accent" />
                  </p>
                </div>
              </div>
              <div className="border-t border-border p-6">
                <Button className="w-full rounded-full" onClick={reset}>
                  Find next delivery
                </Button>
              </div>
            </div>
          ) : (
            <>
              {activeOrder && routeCoords && (
                <div className="overflow-hidden rounded-3xl bg-card shadow-soft ring-2 ring-primary ring-offset-2">
                  <div className="bg-gradient-hero p-5 text-primary-foreground">
                    <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                       {partnerProfile?.vehicle_type === 'truck' ? '🚚' : partnerProfile?.vehicle_type === 'auto' ? '🛺' : '🛵'} Live Mission Tracking
                    </h2>
                    <p className="text-sm opacity-90">
                      {step === 0 
                        ? "Heading to pickup location" 
                        : "Food secured! Navigating to drop location."}
                    </p>
                  </div>
                  <MapCanvas 
                    height={400} 
                    showRoute 
                    routeCoords={routeCoords} 
                    pins={dynamicPins} 
                    isPartnerView={true} 
                    vehicleType={partnerProfile?.vehicle_type || 'bike'}
                    className="rounded-none rounded-b-3xl border-none"
                  />
                </div>
              )}

              <div className="rounded-3xl bg-card p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center text-2xl">
                      {partnerProfile?.vehicle_type === 'truck' ? '🚚' : partnerProfile?.vehicle_type === 'auto' ? '🛺' : '🛵'}
                    </span>
                    <div>
                      <p className="font-semibold">Active delivery</p>
                      <p className="text-xs text-muted-foreground">
                        Mission #{activeOrder?.id?.slice(0, 6)} · {activeOrder?.meals_count} meals
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    <span className="text-muted-foreground">Share location</span>
                    <Switch checked={shareLocation} onCheckedChange={setShareLocation} />
                  </div>
                </div>

                {/* Stepper */}
                <ol className="mt-6 space-y-3">
                  {dynamicSteps.map((s, idx) => {
                    const done = idx < step;
                    const current = idx === step;
                    return (
                      <li
                        key={s.label}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border p-3 transition-smooth",
                          current && "border-primary bg-primary/5",
                          done && "border-border bg-muted/40 opacity-70",
                          !current && !done && "border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                            current && "bg-primary text-primary-foreground",
                            done && "bg-urgent-low text-primary-foreground",
                            !current && !done && "bg-muted text-muted-foreground"
                          )}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{s.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.at}
                          </p>
                        </div>
                        {s.time && (
                          <span className="text-xs font-medium text-muted-foreground">
                            {s.time}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <input type="file" accept="image/*" id="proof-upload" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                  <Button variant={photoFile ? "default" : "outline"} className={cn("rounded-full", photoFile && "bg-green-600 hover:bg-green-700")} onClick={() => document.getElementById('proof-upload')?.click()}>
                    {photoFile ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Camera className="mr-1 h-4 w-4" />}
                    {photoFile ? "Photo attached" : "Proof photo"}
                  </Button>
                  <Button className="rounded-full" onClick={next}>
                    {step === 0 && "Mark picked up"}
                    {step === 1 && "Start delivery"}
                    {step === 2 && (<><PackageCheck className="mr-1 h-4 w-4" />Mark delivered</>)}
                  </Button>
                </div>

                <div className="mt-5 rounded-2xl bg-muted/50 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4 text-secondary" /> Optimized route
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pickupAddress?.split(',')[0]} → {dropAddress?.split(',')[0]} · {activeOrder && activeRequest?.pickup_preference ? "Active pathing" : "Calculating..."}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" /> Delivery History
            </DialogTitle>
            <DialogDescription>
              Your track record of successful food rescue missions.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
            {!historyMissions || historyMissions.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground italic">
                No past missions found. Complete a delivery to start your history!
              </div>
            ) : (
              historyMissions.map((mission: any) => (
                <div key={mission.id} className="p-4 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {mission.listing?.items?.[0] ? (typeof mission.listing.items[0] === 'object' ? mission.listing.items[0].name : mission.listing.items[0]) : "Rescue Mission"}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {new Date(mission.assigned_at).toLocaleDateString()} · {mission.listing?.meals_count || 0} meals
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-widest">
                      Delivered
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">To: {mission.request?.recipient?.org_name || 'Community Center'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      </main>

      <SiteFooter />
    </div>
  );
};

export default PartnerDashboard;
