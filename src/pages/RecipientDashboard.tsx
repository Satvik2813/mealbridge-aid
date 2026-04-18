import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapCanvas } from "@/components/MapCanvas";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { useAvailableListings, useRequestFood, useActiveRecipientRequest, useActiveDeliveryForRequest, useRecipientRequests, useSendNotification, useCreateNeed, useRecipientProfile, useUpdateRecipientProfile, type DatabaseListing as Listing } from "@/hooks/useSupabaseData";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Award,
  Bell,
  Building2,
  ChefHat,
  Filter,
  Heart,
  MapPin,
  Sparkles,
  Truck,
  Utensils,
  Users,
  ShieldCheck,
  FileText,
  Phone,
  Clock,
  CheckCircle2,
  Image as ImageIcon,
  ArrowRight,
  Hand,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const sortOptions = ["Nearest", "Expiring", "Most meals", "Newest"] as const;
const radii = [2, 5, 10, 20];
const typeFilters = ["All", "Veg", "Non-Veg"] as const;
const libraries: ("places")[] = ["places"];

const donorCategoryIcon: Record<string, any> = {
  restaurant: Utensils,
  event: Sparkles,
  home: ChefHat,
  bakery: Award,
  catering: Truck,
};

function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;  
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

const RecipientDashboard = () => {
  const [sort, setSort] = useState<typeof sortOptions[number]>("Expiring");
  const [radius, setRadius] = useState(5);
  const [type, setType] = useState<typeof typeFilters[number]>("All");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState("80");
  const [requirements, setRequirements] = useState("");
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);
  const [needItems, setNeedItems] = useState("");
  const [needMeals, setNeedMeals] = useState("50");
  const [needNotes, setNeedNotes] = useState("");
  const [needFoodType, setNeedFoodType] = useState<"veg" | "non-veg">("veg");
  
  // Verification Form State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [vOrgName, setVOrgName] = useState("");
  const [vRegId, setVRegId] = useState("");
  const [vCapacity, setVCapacity] = useState("100");
  const [vPhone, setVPhone] = useState("");
  const [vAddress, setVAddress] = useState("");
  const [vCity, setVCity] = useState("Hyderabad");
  const [vOrgType, setVOrgType] = useState("orphanage");
  const [vDailyNeed, setVDailyNeed] = useState("300");
  const [vContactPerson, setVContactPerson] = useState("");
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'self' | 'partner'>('partner');
  
  // Location
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(17.3850);
  const [lng, setLng] = useState(78.4867);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [partnerTrackingPos, setPartnerTrackingPos] = useState<{lat: number, lng: number} | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: rawListings } = useAvailableListings({ lat, lng });
  const { data: activeRequestData } = useActiveRecipientRequest(user?.id);
  const { data: activeDelivery } = useActiveDeliveryForRequest(activeRequestData?.id);
  const { data: myRequests, isLoading: isLoadingRequests } = useRecipientRequests(user?.id);
  const { data: profile, isLoading: isLoadingProfile } = useRecipientProfile(user?.id);
  
  const requestFoodMutation = useRequestFood();
  const createNeedMutation = useCreateNeed();
  const sendNotificationMutation = useSendNotification();
  const updateProfileMutation = useUpdateRecipientProfile();

  const isVerified = profile?.verified || user?.user_metadata?.is_verified;
  const isPending = !!profile && !isVerified;

  // Auto-detect recipient location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {} // silently fail
      );
    }
  }, []);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        setAddress(place.formatted_address);
      } else if (place.name) {
        setAddress(place.name);
      }
      if (place.geometry?.location) {
        setLat(place.geometry.location.lat());
        setLng(place.geometry.location.lng());
      }
    }
  };

  const listings = useMemo(() => {
    let l = rawListings ? [...rawListings] : [];
    // Filter Veg vs Non-Veg
    if (type !== "All") {
      l = l.filter((x) => x.food_type === type.toLowerCase() || (type === "Veg" && x.food_type === "mixed"));
    }
    
    // Calculate real distances using Haversine formula from current modal location state
    const withDistance = l.map(listing => ({
      ...listing,
      pseudoDistance: getDistanceInKm(lat, lng, listing.lat, listing.lng)
    }));
    
    const filtered = withDistance.filter((x) => x.pseudoDistance <= radius || sort === "Expiring");

    switch (sort) {
      case "Nearest":
        filtered.sort((a, b) => a.pseudoDistance - b.pseudoDistance);
        break;
      case "Expiring":
        filtered.sort((a, b) => ["critical", "high", "medium", "low"].indexOf(a.urgency) - ["critical", "high", "medium", "low"].indexOf(b.urgency));
        break;
      case "Most meals":
        filtered.sort((a, b) => b.meals_count - a.meals_count);
        break;
    }
    return filtered;
  }, [sort, radius, type, rawListings, lat, lng]);

  const submitRequest = async () => {
    if (!selected) return;
    if (!user) {
      toast.error("Please log in to claim a listing");
      return navigate("/login/recipient");
    }
    if (!address) {
      toast.error("Please provide a delivery location");
      return;
    }
    
    if (!isVerified) {
      setIsVerifyModalOpen(true);
      toast.error("Verification Required", { description: "Please complete your organization profile to request food." });
      return;
    }

    try {
      const requestData = await requestFoodMutation.mutateAsync({
        listing_id: selected.id,
        recipient_id: user.id,
        beneficiaries_count: parseInt(beneficiaries) || 1,
        delivery_method: deliveryMethod,
        pickup_preference: JSON.stringify({ address, lat, lng, requirements })
      });

      // Notify Donor
      await sendNotificationMutation.mutateAsync({
        user_id: selected.donor_id,
        title: "New Food Request",
        message: `${user?.user_metadata?.full_name || user?.user_metadata?.org_name || "A recipient"} has requested ${beneficiaries} meals from your listing "${typeof selected.items[0] === 'object' ? selected.items[0].name : selected.items[0]}".`,
        type: "info",
        metadata: { listing_id: selected.id, request_id: requestData.id }
      });
      const donorName = selected.donor?.org_name || selected.donor?.name || "Donor";
      toast.success(`Food Offer Accepted!`, {
        description: `Successfully accepted from ${donorName} · Tracking will start soon.`,
      });
      setSelected(null); // Close modal
    } catch (e: any) {
      toast.error("Failed to submit request", { description: e.message });
    }
  };

  const submitBroadcast = async () => {
    if (!user) return navigate("/login/recipient");
    if (!needItems) return toast.error("Please specify what you need");
    
    if (!isVerified) {
      setIsVerifyModalOpen(true);
      toast.error("Verification Required", { description: "Verified partners only can broadcast needs." });
      return;
    }

    try {
      await createNeedMutation.mutateAsync({
        recipient_id: user.id,
        meals_count: parseInt(needMeals) || 50,
        food_type: needFoodType,  // always a valid DB enum: 'veg' | 'non-veg'
        items: [needItems],
        address: address || user.user_metadata?.address || "Hyderabad",
        lat,
        lng,
        notes: needNotes
      });
      toast.success("Need broadcasted! Nearby donors have been notified.");
      setIsNeedModalOpen(false);
      setNeedItems("");
    } catch (e: any) {
      toast.error("Failed to broadcast", { description: e.message });
    }
  };

  const handleVerifySubmit = async () => {
    if (!vOrgName || !vRegId || !vPhone || !vAddress || !vContactPerson) {
      toast.error("Please fill out all required fields");
      return;
    }
    
    setIsSubmittingVerify(true);
    try {
      await updateProfileMutation.mutateAsync({
        user_id: user?.id!,
        org_name: vOrgName,
        capacity: parseInt(vCapacity) || 100,
        reg_doc_url: "verified_via_form",
        address: vAddress,
        city: vCity,
        org_type: vOrgType,
        daily_need: parseInt(vDailyNeed) || 300,
      });
      
      toast.success("Application Submitted!", {
        description: "Your organization profile has been sent for review. We will verify your details shortly."
      });
      setIsVerifyModalOpen(false);
    } catch (e: any) {
      toast.error("Verification failed", { description: e.message });
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  const activeDeliveryData = activeDelivery;
  let trackingRouteCoords = undefined;
  let dynamicPins = undefined;
  if (activeRequestData && activeDeliveryData && ['picked_up', 'in_transit'].includes(activeDeliveryData.status)) {
     if (activeRequestData.pickup_preference) {
        try {
          const pref = typeof activeRequestData.pickup_preference === 'string'
            ? JSON.parse(activeRequestData.pickup_preference)
            : activeRequestData.pickup_preference;
          if (pref.lat) {
            trackingRouteCoords = [
              { lat: activeRequestData.listing.lat, lng: activeRequestData.listing.lng },
              { lat: pref.lat, lng: pref.lng }
            ];
            
            dynamicPins = [
              { 
                lat: activeRequestData.listing.lat, 
                lng: activeRequestData.listing.lng, 
                label: "Pickup Location",
                icon: "restaurant"
              },
              { 
                lat: pref.lat, 
                lng: pref.lng, 
                label: "Your Organization",
                icon: "home"
              }
            ];
          }
        } catch (e) {}
     }
  }

  useEffect(() => {
    if (activeDelivery?.id) {
      const channel = supabase.channel(`delivery_broadcast_${activeDelivery.id}`);
      channel.on('broadcast', { event: 'location' }, (payload) => {
        setPartnerTrackingPos(payload.payload);
      });
      channel.subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [activeDelivery?.id]);

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />

      {/* Greeting */}
      <section className="border-b border-border/60 bg-background">
        <div className="container py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Recipient dashboard</p>
              <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                {user?.user_metadata?.full_name || user?.user_metadata?.org_name || "Community Partner"}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" /> {user?.user_metadata?.address?.split(',')[0] || address?.split(',')[0] || "Hyderabad"}
                </span>
                
                {user?.user_metadata?.beneficiaries_count && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> {user.user_metadata.beneficiaries_count} individuals
                  </span>
                )}
                
                {user?.user_metadata?.is_verified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Verified Partner
                  </span>
                )}
              </p>
            </div>
            <Button 
                className={cn("rounded-full shadow-glow", !isVerified && "opacity-80")} 
                onClick={() => {
                    if (!user) return navigate("/login/recipient");
                    if (!isVerified) {
                      setIsVerifyModalOpen(true);
                    } else {
                      setIsNeedModalOpen(true);
                    }
                }}
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> 
              {isVerified ? "Broadcast Need" : isPending ? "Review Pending" : "Verify to Broadcast"}
            </Button>
          </div>
        </div>
      </section>

      {!isVerified && !isLoadingProfile && (
        <section className={cn(
          "border-b py-3 transition-colors",
          isPending ? "bg-blue-500/10 border-blue-500/20" : "bg-amber-500/10 border-amber-500/20"
        )}>
          <div className="container flex items-center justify-between gap-4">
            <div className={cn(
              "flex items-center gap-2 text-sm font-medium",
              isPending ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
            )}>
              {isPending ? (
                <>
                  <Bell className="h-4 w-4 animate-pulse" />
                  Application Under Review: Your organization profile was submitted and is awaiting official verification.
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Complete your verification to start requesting surplus food.
                </>
              )}
            </div>
            {!isPending && (
              <Button size="sm" variant="outline" className="rounded-full border-amber-500/30 hover:bg-amber-500/20" onClick={() => setIsVerifyModalOpen(true)}>
                Verify Now
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="border-b border-border/60 bg-background">
        <div className="container flex flex-wrap items-center gap-3 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Sort
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortOptions.map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-smooth ${
                  sort === s
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="ml-2 hidden h-5 w-px bg-border md:block" />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> Radius
          </div>
          <div className="flex flex-wrap gap-1.5">
            {radii.map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-smooth ${
                  radius === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>

          <div className="ml-2 hidden h-5 w-px bg-border md:block" />

          <div className="flex flex-wrap gap-1.5">
            {typeFilters.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-smooth ${
                  type === t
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Map */}
        <div className="space-y-4">
          {trackingRouteCoords ? (
             <div className="overflow-hidden rounded-3xl bg-card shadow-soft ring-2 ring-primary ring-offset-2">
               <div className="bg-gradient-hero p-5 text-primary-foreground flex items-center justify-between gap-4">
                 <div>
                   <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                     <Truck className="h-5 w-5" /> Live Tracking
                   </h2>
                   <p className="text-sm opacity-90">Partner is en route with {activeRequestData?.beneficiaries_count} meals!</p>
                 </div>
                 {activeRequestData?.listing?.photos?.[0] && (
                   <div className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/20 overflow-hidden shadow-lg bg-black/20">
                     <img 
                       src={activeRequestData.listing.photos[0]} 
                       alt="Food preview" 
                       className="h-full w-full object-cover"
                       onError={(e) => {
                         (e.target as HTMLImageElement).parentElement!.innerText = "🍽️";
                         (e.target as HTMLImageElement).parentElement!.className = "h-16 w-16 shrink-0 rounded-2xl border-2 border-white/20 flex items-center justify-center text-3xl opacity-50";
                       }}
                     />
                   </div>
                 )}
               </div>
               <MapCanvas 
                 height={440} 
                 showRoute 
                 routeCoords={trackingRouteCoords} 
                 pins={dynamicPins} 
                 isPartnerView={false}
                 vehicleType={activeDelivery?.partner?.vehicle_type || 'bike'}
                 className="rounded-none rounded-b-3xl"
               />
             </div>
          ) : (
             <MapCanvas 
               height={520} 
               center={{ lat, lng }} 
               pins={[
                 ...listings.map(l => ({ 
                   x: 0, y: 0, lat: l.lat, lng: l.lng, 
                   color: l.urgency === 'critical' ? 'hsl(var(--urgent-critical))' : 
                          l.urgency === 'high' ? 'hsl(var(--urgent-high))' : 
                          l.urgency === 'medium' ? 'hsl(var(--urgent-medium))' : 'hsl(var(--urgent-low))',
                   pulse: l.urgency === 'critical' 
                 })),
                 { x: 0, y: 0, lat, lng, color: 'blue', pulse: true } // My Location Pin
               ]} 
             />
          )}
          
          {/* My Requests History section */}
          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <h3 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> My Requests
            </h3>
            <div className="space-y-3">
              {(myRequests || []).length > 0 ? (
                myRequests?.slice(0, 3).map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/40">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold truncate max-w-[140px]">
                        {req.listing?.items?.[0] ? (typeof req.listing.items[0] === 'object' ? req.listing.items[0].name : req.listing.items[0]) : "Food items"}
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                      req.status === 'confirmed' ? "bg-green-100 text-green-700" : 
                      req.status === 'pending' ? "bg-yellow-100 text-yellow-700" : 
                      "bg-gray-100 text-gray-700"
                    )}>
                      {req.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No past requests yet.</p>
              )}
              {myRequests && myRequests.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-primary" onClick={() => setIsHistoryOpen(true)}>
                  <Clock className="mr-1.5 h-3 w-3" /> View history
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {rawListings === undefined ? (
            // Loading Skeletons
            Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-44 w-full animate-pulse rounded-3xl bg-card border border-border/40" />
            ))
          ) : listings.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center gap-6 rounded-3xl bg-card/50 border-2 border-dashed border-border py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Utensils className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="max-w-xs space-y-2">
                    <h3 className="font-display text-xl font-semibold text-foreground">No surplus food nearby</h3>
                    <p className="text-sm text-muted-foreground text-pretty">
                        There are currently no available donations in your radius. You can broadcast your need so donors can find you!
                    </p>
                </div>
                <Button variant="secondary" className="rounded-full" onClick={() => setIsNeedModalOpen(true)}>
                    <Sparkles className="mr-1.5 h-4 w-4" /> 
                    Ask for food
                </Button>
            </div>
          ) : (
            listings.map((l, i) => {
              const Icon = donorCategoryIcon[l.category] || Utensils;
              const donorName = l.donor?.org_name || l.donor?.name || "Unknown Donor";
              return (
                <article
                  key={l.id}
                  className="group animate-float-up overflow-hidden rounded-3xl bg-card shadow-soft transition-smooth hover:shadow-warm"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {l.photos && l.photos.length > 0 ? (
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      <img 
                        src={l.photos[0]} 
                        alt={l.title} 
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          const failedUrl = (e.target as HTMLImageElement).src;
                          console.error("[Media Debug] Failed to load photo:", failedUrl);
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement?.classList.add('bg-gradient-warm');
                          const placeholderNode = document.createElement('div');
                          placeholderNode.className = "flex items-center justify-center h-full w-full";
                          placeholderNode.innerHTML = '<svg class="h-10 w-10 text-secondary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M12 12v9m-4-4l4 4 4-4"/></svg>';
                          (e.target as HTMLImageElement).parentElement?.appendChild(placeholderNode);
                        }}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <UrgencyBadge urgency={l.urgency} timeLeft={l.expires_at ? new Date(l.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Soon"} pulse={l.urgency === "critical"} />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-warm flex items-center justify-center h-48 w-full">
                      <Icon className="h-10 w-10 text-secondary/40" />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {!l.photos?.[0] && (
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-warm">
                            <Icon className="h-5 w-5 text-secondary" />
                          </span>
                        )}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {l.category}
                          </p>
                          <h3 className="font-display text-xl font-semibold">
                            {donorName}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {l.address.split(',')[0]} · {l.pseudoDistance.toFixed(1)} km
                          </p>
                        </div>
                      </div>
                      {!l.photos?.[0] && <UrgencyBadge urgency={l.urgency} timeLeft={l.expires_at ? new Date(l.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Soon"} pulse={l.urgency === "critical"} />}
                    </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {l.items.slice(0, 3).map((it: any, idx: number) => {
                      const nameStr = typeof it === 'object' ? it.name : it;
                      return (
                        <span
                          key={idx}
                          className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground max-w-[200px] truncate"
                        >
                          {nameStr}
                        </span>
                      );
                    })}
                    {l.items.length > 3 && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        +{l.items.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-3xl font-semibold">
                        {l.meals_count}
                      </span>
                      <span className="text-sm text-muted-foreground">meals</span>
                      <span className="ml-3 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                        {l.food_type}
                      </span>
                    </div>
                    {(() => {
                      const hasRequested = myRequests?.some((req: any) => req.listing_id === l.id);
                      return (
                        <Button
                          onClick={() => {
                            if (!user) {
                              toast.error("Please log in to claim a listing");
                              return navigate("/login/recipient");
                            }
                            setSelected(l);
                          }}
                          className="rounded-full"
                          disabled={l.status !== "available" || hasRequested}
                        >
                          {hasRequested ? "Requested" : l.status === "available" ? "Request food" : l.status}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              </article>
              );
            })
          )}
        </div>
      </div>

      {/* Broadcast Need Modal */}
      <Dialog open={isNeedModalOpen} onOpenChange={setIsNeedModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Broadcast Food Need</DialogTitle>
            <DialogDescription>
              Local donors will see your request and can fulfill it if they have surplus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What are you looking for?</label>
              <Input 
                placeholder="e.g. 50 plates of Rice & Dal, any cooked meals..." 
                value={needItems}
                onChange={(e) => setNeedItems(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Approx meals</label>
                  <Input 
                    type="number" 
                    value={needMeals}
                    onChange={(e) => setNeedMeals(e.target.value)}
                    className="mt-2"
                  />
               </div>
               <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Food Type</label>
                  <select 
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={needFoodType}
                    onChange={(e) => setNeedFoodType(e.target.value as "veg" | "non-veg")}
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                  </select>
               </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional Notes</label>
              <Textarea 
                placeholder="e.g. For dinner service, need by 7 PM..."
                value={needNotes}
                onChange={(e) => setNeedNotes(e.target.value)}
                className="mt-2 h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsNeedModalOpen(false)}>Cancel</Button>
            <Button className="rounded-full" onClick={submitBroadcast} disabled={createNeedMutation.isPending}>
              {createNeedMutation.isPending ? "Broadcasting..." : "Post Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selected} onOpenChange={(o) => (!o || requestFoodMutation.isPending) && !requestFoodMutation.isPending && setSelected(null)}>
        <DialogContent className="rounded-3xl max-w-lg overflow-hidden p-0 border-none shadow-warm max-h-[90vh] flex flex-col">
          <div className="sr-only">
            <h2>Accept Food Offer</h2>
            <p>Review the details and accept this food donation.</p>
          </div>
          <div className="flex-1 overflow-y-auto">
          {selected?.photos && selected.photos.length > 0 ? (
            <div className="w-full h-56 relative group bg-muted">
              <img 
                src={selected.photos[0]} 
                alt="Food preview" 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement?.classList.add('bg-gradient-warm');
                  const placeholderNode = document.createElement('div');
                  placeholderNode.className = "flex items-center justify-center h-full w-full";
                  placeholderNode.innerHTML = '<svg class="h-10 w-10 text-secondary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M12 12v9m-4-4l4 4 4-4"/></svg>';
                  (e.target as HTMLImageElement).parentElement?.appendChild(placeholderNode);
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4" />
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                <div>
                  <h3 className="text-white text-2xl font-display font-bold">{selected.donor?.org_name || 'Donor Offer'}</h3>
                  <p className="text-white/80 text-sm flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3.5 w-3.5" /> {selected.address}
                  </p>
                </div>
                <UrgencyBadge urgency={selected.urgency} timeLeft="..." />
              </div>
            </div>
          ) : (
            <div className="bg-gradient-hero p-8 text-white relative">
               <h3 className="text-white text-2xl font-display font-bold">Accept Food Offer</h3>
               <p className="text-white/80 text-sm mt-1">{selected?.donor?.org_name || 'Premium donor offer'}</p>
            </div>
          )}

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-2">
               <div className="p-3 rounded-2xl bg-muted/40 text-center border border-border/10">
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Type</span>
                  <span className="text-sm font-semibold capitalize flex items-center justify-center gap-1.5 mt-0.5">
                    {selected?.food_type === 'veg' ? '🥗 Veg' : '🍗 Non-Veg'}
                  </span>
               </div>
               <div className="p-3 rounded-2xl bg-muted/40 text-center border border-border/10">
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Cooked</span>
                  <span className="text-sm font-semibold flex items-center justify-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {new Date(selected?.cooked_at || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </span>
               </div>
               <div className="p-3 rounded-2xl bg-muted/40 text-center border border-border/10">
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Meals</span>
                  <span className="text-sm font-semibold mt-0.5 block">{selected?.meals_count}</span>
               </div>
            </div>

            <div className="space-y-4">
              {selected?.notes && (
                <div className="p-3 rounded-2xl bg-primary/5 text-primary border border-primary/10">
                   <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70">Donor Notes</p>
                   <p className="text-sm leading-relaxed italic">"{selected.notes}"</p>
                </div>
              )}

              <div className="rounded-2xl border border-border/40 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items included</p>
                <div className="flex flex-wrap gap-2">
                  {selected?.items.map((it: any, idx: number) => (
                    <span key={idx} className="px-2 py-1 rounded-lg bg-background border border-border/60 text-xs font-medium">
                      {typeof it === 'object' ? it.name : it}
                    </span>
                  ))}
                </div>
              </div>

              {/* AI Safety Report Card */}
              {selected?.ai_report && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Safety Audit</span>
                    </div>
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2",
                      selected.safety_score! >= 75 ? "ring-green-400 bg-green-50 text-green-600" :
                      selected.safety_score! >= 50 ? "ring-amber-400 bg-amber-50 text-amber-600" :
                      "ring-red-400 bg-red-50 text-red-600"
                    )}>
                      {selected.safety_score}
                    </div>
                  </div>
                  
                  <p className="text-xs text-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3">
                    {selected.ai_report.reasoning}
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {selected.ai_report.storage_advice && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground/80">Storage Tip</p>
                        <p className="text-[11px] text-foreground leading-tight">{selected.ai_report.storage_advice}</p>
                      </div>
                    )}
                    {selected.ai_report.risks && selected.ai_report.risks.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-amber-600/80">Risk Factors</p>
                        <p className="text-[11px] text-amber-700 leading-tight">
                          {selected.ai_report.risks[0]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Delivery Method Selection */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Choose collection method</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDeliveryMethod('self')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left group",
                    deliveryMethod === 'self' 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border/40 hover:border-border hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                    deliveryMethod === 'self' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                  )}>
                    <Hand className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">Self Pickup</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">I will come and collect</p>
                  </div>
                </button>

                <button
                  onClick={() => setDeliveryMethod('partner')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left group",
                    deliveryMethod === 'partner' 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border/40 hover:border-border hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                    deliveryMethod === 'partner' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                  )}>
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">Assign Partner</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Assign to delivery hero</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-border/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beneficiaries</label>
                  <Input
                    type="number"
                    value={beneficiaries}
                    onChange={(e) => setBeneficiaries(e.target.value)}
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Drop Location</label>
                  {isLoaded ? (
                    <Autocomplete onLoad={(autoC) => setAutocomplete(autoC)} onPlaceChanged={onPlaceChanged}>
                      <Input
                        className="mt-2 rounded-xl"
                        placeholder="Confirm address..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </Autocomplete>
                  ) : <Input disabled className="mt-2" placeholder="..." />}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acceptance Notes</label>
                <Textarea
                  placeholder="e.g. Please call +91... upon arrival"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="mt-2 h-16 rounded-xl"
                />
              </div>
            </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t border-border/10">
            <Button variant="ghost" className="rounded-full" onClick={() => setSelected(null)} disabled={requestFoodMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitRequest} className="rounded-full px-8 shadow-glow" disabled={requestFoodMutation.isPending}>
              {requestFoodMutation.isPending ? "Processing..." : "Accept Food Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl overflow-hidden p-0 border-none shadow-warm">
          <div className="bg-gradient-hero p-8 text-primary-foreground relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
               <ShieldCheck className="h-24 w-24" />
            </div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-bold font-display tracking-tight">
                Verify Organization
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80 mt-2">
                Complete your profile to join our community of verified partners.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-5 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Organization Name</label>
                <div className="relative group text-left">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input 
                    placeholder="E.g. Sunshine Orphanage" 
                    className="pl-10 rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                    value={vOrgName}
                    onChange={(e) => setVOrgName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Organization Type</label>
                <Select value={vOrgType} onValueChange={setVOrgType}>
                  <SelectTrigger className="rounded-xl bg-muted/30 border-muted-foreground/10 h-10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orphanage">Orphanage</SelectItem>
                    <SelectItem value="ngo">NGO</SelectItem>
                    <SelectItem value="shelter">Shelter</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="community_kitchen">Community Kitchen</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Contact Person Name</label>
                <div className="relative group text-left">
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input 
                    placeholder="Enter full name" 
                    className="pl-10 rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                    value={vContactPerson}
                    onChange={(e) => setVContactPerson(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Registration ID</label>
                <div className="relative group text-left">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input 
                    placeholder="NGO-12345-HYD" 
                    className="pl-10 rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                    value={vRegId}
                    onChange={(e) => setVRegId(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-left text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Physical Address</label>
                <div className="relative group text-left">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Textarea 
                    placeholder="Full organization address..." 
                    className="pl-10 h-20 rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                    value={vAddress}
                    onChange={(e) => setVAddress(e.target.value)}
                  />
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">City</label>
                <Input 
                  placeholder="Hyderabad" 
                  className="rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                  value={vCity}
                  onChange={(e) => setVCity(e.target.value)}
                />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Contact Phone</label>
                <div className="relative group text-left">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input 
                    placeholder="+91 XXXXX XXXXX" 
                    className="pl-10 rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                    value={vPhone}
                    onChange={(e) => setVPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 text-left text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Total Capacity</label>
                <Input 
                  type="number"
                  className="rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                  value={vCapacity}
                  onChange={(e) => setVCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2 text-left text-left">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Daily Meals Need</label>
                <Input 
                  type="number"
                  className="rounded-xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                  value={vDailyNeed}
                  onChange={(e) => setVDailyNeed(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4">
              <Button 
                onClick={handleVerifySubmit} 
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white shadow-glow hover:scale-[1.02] transition-transform active:scale-[0.98]"
                disabled={isSubmittingVerify}
              >
                {isSubmittingVerify ? "Saving Profile..." : "Submit Verification Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <Clock className="h-6 w-6" /> Request History
            </DialogTitle>
            <DialogDescription>
              A log of all the food donations you've received and requested.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
            {!myRequests || myRequests.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground italic">
                No past requests found.
              </div>
            ) : (
              myRequests.map((req: any) => (
                <div key={req.id} className="p-4 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-background border flex items-center justify-center text-xl">
                      {req.listing?.food_type === 'veg' ? '🥗' : '🍗'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {req.listing?.items?.[0] ? (typeof req.listing.items[0] === 'object' ? req.listing.items[0].name : req.listing.items[0]) : "Meal Batch"}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {new Date(req.created_at).toLocaleDateString()} · {req.beneficiaries_count} meals
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                      req.status === 'confirmed' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    )}>
                      {req.status}
                    </span>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => { setIsHistoryOpen(false); setSelected(req.listing); }}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
};

export default RecipientDashboard;
