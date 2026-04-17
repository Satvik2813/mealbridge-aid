import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapCanvas } from "@/components/MapCanvas";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { useActiveDelivery, useUpdateDelivery, useSendNotification } from "@/hooks/useSupabaseData";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2 | 3; // 0 heading, 1 picked up, 2 en route, 3 delivered

const steps = [
  { label: "Heading to pickup", at: "Spice Garden", time: "ETA 6 min" },
  { label: "Picked up", at: "42 meals secured", time: "12:42 pm" },
  { label: "En route to drop", at: "Sunshine Children's Home", time: "ETA 11 min" },
  { label: "Delivered", at: "Mission complete", time: "" },
];

const PartnerDashboard = () => {
  const [online, setOnline] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [shareLocation, setShareLocation] = useState(true);

  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: activeDeliveryData } = useActiveDelivery(user?.id);
  const updateDeliveryMutation = useUpdateDelivery();
  const sendNotificationMutation = useSendNotification();

  const { data: pendingRequests } = useQuery({
    queryKey: ["requests", "pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("food_requests")
        .select("*, listing:food_listings(*, donor:users!donor_id(name, org_name, address)), recipient:users!recipient_id(name, org_name, address)")
        .eq("status", "pending");
      return data || [];
    }
  });

  const orders = pendingRequests || [];
  const activeOrder = activeDeliveryData?.food_listings;
  const activeRequest = activeDeliveryData?.food_requests?.[0] || activeDeliveryData?.food_requests;
  
  // We sync active states from network safely inside an effect
  useEffect(() => {
    if (activeDeliveryData && !active) {
      setActive(activeDeliveryData.id);
      if (activeDeliveryData.status === 'assigned') setStep(0);
      if (activeDeliveryData.status === 'picked_up') setStep(1);
      if (activeDeliveryData.status === 'delivered') setStep(3);
    }
  }, [activeDeliveryData, active]);

  const pickupAddress = activeOrder?.address || "Pickup location";
  const dropAddress = activeRequest?.pickup_preference ? JSON.parse(activeRequest.pickup_preference).address : "Drop location";

  const dynamicSteps = [
    { label: "Heading to pickup", at: pickupAddress, time: "ETA 6 min" },
    { label: "Picked up", at: `${activeOrder?.meals_count || 0} meals secured`, time: "" },
    { label: "En route to drop", at: dropAddress, time: "ETA 11 min" },
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
        message: `${partnerName} is coming to pick up food from your listing "${request.listing.items[0]}".`,
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
      dbStatus = "delivered";
      toast.success("Delivery complete 🎉", { description: "Great job!" });
      
      // Notify Donor & Recipient
      if (activeOrder && activeRequest) {
        await sendNotificationMutation.mutateAsync({
          user_id: activeOrder.donor_id,
          title: "Delivery Completed",
          message: `Food from your listing "${activeOrder.items[0]}" has been delivered to ${activeRequest.recipient?.org_name || "the recipient"}.`,
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
          message: `Food from your listing "${activeOrder.items[0]}" has been picked up by ${partnerName}.`,
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

  const reset = () => {
    setActive(null);
    setStep(0);
    queryClient.invalidateQueries({ queryKey: ["delivery"] });
  };

  let routeCoords = undefined;
  let dynamicPins = undefined;
  if (step >= 1 && activeOrder && activeRequest?.pickup_preference) {
    try {
      const pref = JSON.parse(activeRequest.pickup_preference);
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

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />

      {/* Header */}
      <section className="border-b border-border/60 bg-background">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-8">
          <div>
            <p className="text-sm text-muted-foreground">Delivery partner</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              Hi {user?.user_metadata?.full_name?.split(' ')[0] || "Partner"} 🛵
            </h1>
            <p className="mt-2 text-muted-foreground">
              ★ 4.9 · Top 5% in Hyderabad
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-soft">
            <span className={cn("h-2.5 w-2.5 rounded-full", online ? "bg-urgent-low animate-pulse" : "bg-muted-foreground")} />
            <span className="text-sm font-semibold">{online ? "Online" : "Offline"}</span>
            <Switch 
              checked={online} 
              onCheckedChange={(o) => {
                if (!user) {
                  toast.error("Please log in to go online");
                  return navigate("/login/partner");
                }
                setOnline(o);
              }} 
            />
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-border/60 bg-background">
        <div className="container grid grid-cols-3 gap-4 py-6 md:grid-cols-4">
          {[
            { label: "Today", value: "3", suffix: "deliveries" },
            { label: "Meals moved", value: "184", suffix: "this week" },
            { label: "km covered", value: "62", suffix: "this week" },
            { label: "Reliability", value: "98%", suffix: "score" },
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
                    Pickup
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
                  <p className="text-xs opacity-80">This month</p>
                  <p className="font-display text-xl font-semibold">28 trips</p>
                </div>
                <div className="rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur">
                  <p className="text-xs opacity-80">Reward points</p>
                  <p className="font-display text-xl font-semibold">2,140</p>
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
                  <p className="font-display text-xl font-semibold">22 min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-display text-xl font-semibold">3.2 km</p>
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
              <MapCanvas height={360} showRoute routeCoords={routeCoords} pins={dynamicPins} isPartnerView={true} />

              <div className="rounded-3xl bg-card p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bike className="h-4 w-4" />
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
                  <Button variant="outline" className="rounded-full">
                    <Camera className="mr-1 h-4 w-4" /> Proof photo
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

      <SiteFooter />
    </div>
  );
};

export default PartnerDashboard;
