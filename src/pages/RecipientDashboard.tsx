import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapCanvas } from "@/components/MapCanvas";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { useAvailableListings, useRequestFood, useActiveRecipientRequest, useRecipientRequests, type DatabaseListing as Listing } from "@/hooks/useSupabaseData";
import { useAuth } from "@/context/AuthContext";
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
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  const [beneficiaries, setBeneficiaries] = useState("80");
  const [requirements, setRequirements] = useState("");
  
  // Location
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(17.3850);
  const [lng, setLng] = useState(78.4867);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: rawListings } = useAvailableListings();
  const { data: activeRequestData } = useActiveRecipientRequest(user?.id);
  const { data: myRequests } = useRecipientRequests(user?.id);
  const requestFoodMutation = useRequestFood();

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
    
    let filtered = withDistance.filter((x) => x.pseudoDistance <= radius || sort === "Expiring");

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
  }, [sort, radius, type, rawListings]);

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
    
    try {
      await requestFoodMutation.mutateAsync({
        listing_id: selected.id,
        recipient_id: user.id,
        beneficiaries_count: parseInt(beneficiaries) || 1,
        pickup_preference: JSON.stringify({ address, lat, lng, requirements })
      });
      const donorName = selected.donor?.org_name || selected.donor?.name || "Donor";
      toast.success(`Request sent to ${donorName}`, {
        description: `${beneficiaries} beneficiaries · awaiting confirmation`,
      });
      setSelected(null);
    } catch (e: any) {
      toast.error("Failed to submit request", { description: e.message });
    }
  };

  const activeDelivery = activeRequestData?.deliveries?.[0] || activeRequestData?.deliveries;
  let trackingRouteCoords = undefined;
  let dynamicPins = undefined;
  
  if (activeRequestData && activeDelivery && ['picked_up', 'in_transit'].includes(activeDelivery.status)) {
     if (activeRequestData.pickup_preference) {
        try {
          const pref = JSON.parse(activeRequestData.pickup_preference);
          if (pref.lat) {
            trackingRouteCoords = [
              { lat: activeRequestData.listing.lat, lng: activeRequestData.listing.lng },
              { lat: pref.lat, lng: pref.lng }
            ];
            dynamicPins = [
              { x: 0, y: 0, lat: activeRequestData.listing.lat, lng: activeRequestData.listing.lng, color: "hsl(var(--primary))" },
              { x: 0, y: 0, lat: pref.lat, lng: pref.lng, color: "hsl(var(--urgent-high))", pulse: true }
            ];
          }
        } catch(e) {}
     }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />

      {/* Greeting */}
      <section className="border-b border-border/60 bg-background">
        <div className="container py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Recipient dashboard</p>
              <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
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
            <Button variant="outline" className="rounded-full">
              <Bell className="mr-1 h-4 w-4" /> 
              {activeRequestData ? "Order active" : "Ready for deliveries"}
            </Button>
          </div>
        </div>
      </section>

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
               <div className="bg-gradient-hero p-5 text-primary-foreground">
                 <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                   <Truck className="h-5 w-5" /> Live Tracking
                 </h2>
                 <p className="text-sm opacity-90">Partner is en route with {activeRequestData?.beneficiaries_count} meals!</p>
               </div>
               <MapCanvas 
                 height={440} 
                 showRoute 
                 routeCoords={trackingRouteCoords} 
                 pins={dynamicPins} 
                 isPartnerView={false}
                 className="rounded-none rounded-b-3xl"
               />
             </div>
          ) : (
             <MapCanvas 
               height={520} 
               pins={listings.map(l => ({ 
                 x: 0, y: 0, lat: l.lat, lng: l.lng, 
                 color: l.urgency === 'critical' ? 'hsl(var(--urgent-critical))' : 
                        l.urgency === 'high' ? 'hsl(var(--urgent-high))' : 
                        l.urgency === 'medium' ? 'hsl(var(--urgent-medium))' : 'hsl(var(--urgent-low))',
                 pulse: l.urgency === 'critical' 
               }))} 
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
                        {req.listing?.items?.[0] || "Food items"}
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
              {myRequests && myRequests.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-primary">View history</Button>
              )}
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {listings.map((l, i) => {
            const Icon = donorCategoryIcon[l.category] || Utensils;
            const donorName = l.donor?.org_name || l.donor?.name || "Unknown Donor";
            return (
              <article
                key={l.id}
                className="group animate-float-up rounded-3xl bg-card p-5 shadow-soft transition-smooth hover:shadow-warm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-warm">
                      <Icon className="h-5 w-5 text-secondary" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {l.category}
                      </p>
                      <h3 className="font-display text-xl font-semibold">
                        {donorName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {l.address} · {l.pseudoDistance.toFixed(1)} km away
                      </p>
                    </div>
                  </div>
                  <UrgencyBadge urgency={l.urgency} timeLeft={l.expires_at ? new Date(l.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Soon"} pulse={l.urgency === "critical"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {l.items.slice(0, 3).map((it) => (
                    <span
                      key={it}
                      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground max-w-[200px] truncate"
                    >
                      {it}
                    </span>
                  ))}
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
                  <Button
                    onClick={() => {
                      if (!user) {
                        toast.error("Please log in to claim a listing");
                        return navigate("/login/recipient");
                      }
                      setSelected(l);
                    }}
                    className="rounded-full"
                    disabled={l.status !== "available"}
                  >
                    {l.status === "available" ? "Request food" : l.status}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Request modal */}
      <Dialog open={!!selected} onOpenChange={(o) => (!o || requestFoodMutation.isPending) && !requestFoodMutation.isPending && setSelected(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Request from {selected?.donor?.org_name || selected?.donor?.name || 'Donor'}
            </DialogTitle>
            <DialogDescription>
              Confirm pickup details. Donor will be notified instantly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="text-sm font-semibold truncate">{selected?.items.join(", ")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected?.meals_count} meals · {selected && (selected as any).pseudoDistance?.toFixed(1)} km
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Number of beneficiaries
              </label>
              <Input
                type="number"
                value={beneficiaries}
                onChange={(e) => setBeneficiaries(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Drop Location
              </label>
              {isLoaded ? (
                <Autocomplete 
                  onLoad={(autoC) => setAutocomplete(autoC)} 
                  onPlaceChanged={() => {
                    if (autocomplete !== null) {
                      const place = autocomplete.getPlace();
                      if (place.formatted_address) setAddress(place.formatted_address);
                      else if (place.name) setAddress(place.name);
                      if (place.geometry?.location) {
                        setLat(place.geometry.location.lat());
                        setLng(place.geometry.location.lng());
                      }
                    }
                  }}
                >
                  <Input
                    className="mt-2"
                    placeholder="Search for an address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </Autocomplete>
              ) : (
                <Input
                  className="mt-2"
                  placeholder="Loading map suggestions..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled
                />
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Additional requirements
              </label>
              <Textarea
                placeholder="e.g. Please use the north entrance, need extra napkins if possible..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="mt-2 h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={requestFoodMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitRequest} className="rounded-full" disabled={requestFoodMutation.isPending}>
              {requestFoodMutation.isPending ? "Submitting..." : "Confirm request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
};

export default RecipientDashboard;
