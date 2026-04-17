import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import {
  useDonorListings,
  useCreateListing,
  useUserStats,
  useAllRecipients,
  useAvailableNeeds,
  useSendDirectOffer,
  useSendNotification,
  type RecipientOrg,
} from "@/hooks/useSupabaseData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  BadgeCheck,
  Building2,
  Camera,
  ChefHat,
  Clock,
  Heart,
  Leaf,
  MapPin,
  Plus,
  Search,
  Send,
  Trash2,
  Trophy,
  Truck,
  Utensils,
  Award,
  Radio,
  ArrowRight,
  School,
  Home,
  Hospital,
  Sparkles,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { uploadPhotoToR2 } from "@/lib/r2";
import { useAIUrgency } from "@/hooks/useAIUrgency";

const categories = [
  { id: "restaurant", label: "Restaurant", icon: Utensils },
  { id: "event", label: "Event", icon: Sparkles },
  { id: "home", label: "Home", icon: ChefHat },
  { id: "bakery", label: "Bakery", icon: Award },
  { id: "catering", label: "Catering", icon: Truck },
];

interface Item { name: string; qty: string; unit: string; type: string; }

const libraries: ("places")[] = ["places"];

// Haversine distance calculation (km)
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Map org_type to human-readable label + color
const orgTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
  ngo:                { label: "NGO",              color: "bg-emerald-100 text-emerald-700",  icon: Heart },
  orphanage:          { label: "Orphanage",        color: "bg-pink-100 text-pink-700",        icon: Home },
  old_age_home:       { label: "Old-Age Home",     color: "bg-purple-100 text-purple-700",    icon: Home },
  shelter:            { label: "Shelter",          color: "bg-blue-100 text-blue-700",        icon: Building2 },
  school:             { label: "School",           color: "bg-amber-100 text-amber-700",      icon: School },
  hospital:           { label: "Hospital",         color: "bg-red-100 text-red-700",          icon: Hospital },
  community_kitchen:  { label: "Community Kitchen",color: "bg-orange-100 text-orange-700",   icon: Utensils },
  other:              { label: "Community",        color: "bg-gray-100 text-gray-600",        icon: Users },
};

function OrgTypeBadge({ type }: { type: string }) {
  const cfg = orgTypeConfig[type] || orgTypeConfig["other"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

const DonorDashboard = () => {
  const [category, setCategory] = useState("restaurant");
  const [items, setItems] = useState<Item[]>([
    { name: "Vegetable Biryani", qty: "20", unit: "plates", type: "veg" },
  ]);
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("Banjara Hills, Road No. 12");
  const [lat, setLat] = useState(17.3850);
  const [lng, setLng] = useState(78.4867);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // Google Places discovery state
  const [googleRecipients, setGoogleRecipients] = useState<any[]>([]);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Direct offer dialog state
  const [directTarget, setDirectTarget] = useState<RecipientOrg | null>(null);
  const [directNotes, setDirectNotes] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState<string>("all");

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  const findNearbyNGOs = (latitude: number, longitude: number) => {
    if (!latitude || !longitude || !isLoaded) return;
    
    setIsSearchingNearby(true);
    // Use a dummy div for PlacesService if no map is visible yet
    const dummyDiv = document.createElement('div');
    if (!placesServiceRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
    }

    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(latitude, longitude),
      radius: 5000, // 5km
      keyword: "ngo shelter orphanage food bank charity foundation",
      type: "establishment"
    };

    placesServiceRef.current.nearbySearch(request, (results, status) => {
      setIsSearchingNearby(false);
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const mapped = results.map((place): any => ({
          id: `google_${place.place_id}`,
          name: place.name || "Unknown Org",
          org_name: place.name || "Unknown Org",
          org_type: "other",
          address: place.vicinity || "Unknown Address",
          lat: place.geometry?.location?.lat() || latitude,
          lng: place.geometry?.location?.lng() || longitude,
          beneficiaries_count: 0,
          is_verified: false,
          created_at: new Date().toISOString(),
          is_google_result: true
        }));
        setGoogleRecipients(mapped);
      } else {
        setGoogleRecipients([]);
      }
    });
  };

  const onLoad = (autoC: google.maps.places.Autocomplete) => {
    setAutocomplete(autoC);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        setAddress(place.formatted_address);
      } else if (place.name) {
        setAddress(place.name);
      }
      if (place.geometry?.location) {
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();
        setLat(newLat);
        setLng(newLng);
        findNearbyNGOs(newLat, newLng);
      }
    }
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          setLat(newLat);
          setLng(newLng);
          findNearbyNGOs(newLat, newLng);
          if (isLoaded) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
              if (status === "OK" && results && results[0]) {
                setAddress(results[0].formatted_address);
              } else {
                toast.error("Could not determine address from location");
              }
            });
          }
        },

        () => toast.error("Location permission denied or unavailable.")
      );
    } else {
      toast.error("Geolocation not supported by this browser.");
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setLat(newLat);
      setLng(newLng);
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          setAddress(results[0].formatted_address);
        }
      });
    }
  };

  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: listings } = useDonorListings(user?.id);
  const { data: stats } = useUserStats(user?.id);
  const createListingMutation = useCreateListing();
  const sendDirectOfferMutation = useSendDirectOffer();
  const sendNotificationMutation = useSendNotification();
  const { data: allRecipients, isLoading: recipientsLoading } = useAllRecipients();
  const { data: activeNeeds, isLoading: needsLoading } = useAvailableNeeds();
  const { calculateUrgency, loading: aiLoading, reasoningText, result: aiResult } = useAIUrgency();

  const currentCoords = { lat, lng };

  const nearbyNeeds = useMemo(() => {
    if (!activeNeeds) return [];
    return activeNeeds.map(need => ({
        ...need,
        pseudoDistance: getDistanceInKm(lat, lng, need.lat, need.lng)
    })).sort((a, b) => a.pseudoDistance - b.pseudoDistance);
  }, [activeNeeds, lat, lng]);

  // Auto-run AI check when items or category changes
  useEffect(() => {
    if (items.length > 0 && items[0].name) {
      const cookInput = document.getElementById('cook') as HTMLInputElement;
      const cookedAt = cookInput?.value || new Date().toISOString();
      calculateUrgency({
        items: items.map(it => it.name),
        category,
        cookedAt
      });
    }
  }, [category, items.length]);

  const { data: incomingRequests } = useQuery({
    queryKey: ["requests", "donor", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("food_requests")
        .select("*, recipient:users!recipient_id(name, org_name, address), listing:food_listings!listing_id(*)")
        .eq("listing.donor_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const myListings = listings || [];

  // Filter recipients based on search + type filter + role check + google results
  const filteredRecipients = useMemo(() => {
    let internalRecs = (allRecipients || []).filter((r: any) => {
      const isRecipient = 
        r.role === 'recipient' || 
        (Array.isArray(r.roles) && r.roles.includes('recipient')) ||
        (r.user_metadata?.role === 'recipient');
      return isRecipient;
    });

    // Merge internal and google results
    let recs = [...internalRecs, ...googleRecipients];

    // Remove duplicates based on name/address similarity
    recs = recs.filter((v, i, a) => 
      a.findIndex(t => (t.id === v.id || (t.name === v.name && t.address === v.address))) === i
    );

    if (orgTypeFilter !== "all") {
      recs = recs.filter(r => (r.org_type || "other") === orgTypeFilter);
    }
    if (recipientSearch.trim()) {
      const q = recipientSearch.toLowerCase();
      recs = recs.filter(r =>
        (r.org_name || r.name || "").toLowerCase().includes(q) ||
        (r.address || "").toLowerCase().includes(q)
      );
    }
    return recs;
  }, [allRecipients, googleRecipients, orgTypeFilter, recipientSearch]);

  const addItem = () =>
    setItems((p) => [...p, { name: "", qty: "", unit: "plates", type: "veg" }]);
  const removeItem = (i: number) =>
    setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: keyof Item, val: string) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));

  const submit = async () => {
    if (!user) {
      toast.error("Please log in to post a listing");
      return navigate("/login/donor");
    }
    if (!address) {
      return toast.error("Pickup location address is required");
    }
    setIsUploading(true);
    try {
      const meals = items.reduce((acc, it) => acc + (parseInt(it.qty) || 0), 0);
      const foodType = items.some(it => it.type === 'non-veg') ? 'non-veg' : 'veg';
      const cookInput = document.getElementById('cook') as HTMLInputElement;
      const cookedAt = cookInput?.value ? new Date(cookInput.value).toISOString() : new Date().toISOString();
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

      const uploadedPhotos = await Promise.all(
        files.map((file) => uploadPhotoToR2(file, "donor").catch((e) => {
          console.error("Photo upload failed:", e);
          return null;
        }))
      );
      const validPhotoUrls = uploadedPhotos.filter(Boolean) as string[];

      await createListingMutation.mutateAsync({
        donor_id: user.id,
        title: "Surplus Food",
        items: items.map(it => `${it.qty} ${it.unit} ${it.name}`),
        meals_count: Math.max(1, meals),
        food_type: foodType as "veg" | "non-veg",
        category: category as any,
        cooked_at: cookedAt,
        expires_at: expiresAt,
        urgency: aiResult?.urgency || "high",
        status: "available",
        address: address,
        lat: lat,
        lng: lng,
        photos: validPhotoUrls
      });

      toast.success("Listing posted!", {
        description: "Nearby recipients have been notified.",
      });
      setItems([{ name: "", qty: "", unit: "plates", type: "veg" }]);
      setNotes("");
      setFiles([]);
    } catch (e: any) {
      toast.error("Failed to post listing", { description: e.message });
    } finally {
      setIsUploading(false);
    }
  };

  const submitDirectOffer = async () => {
    if (!user || !directTarget) return;
    if (!address) return toast.error("Pickup location is required");
    const meals = items.reduce((acc, it) => acc + (parseInt(it.qty) || 0), 0);
    const foodType = items.some(it => it.type === 'non-veg') ? 'non-veg' : 'veg';
    const cookInput = document.getElementById('cook') as HTMLInputElement;
    const cookedAt = cookInput?.value ? new Date(cookInput.value).toISOString() : new Date().toISOString();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    try {
      await sendDirectOfferMutation.mutateAsync({
        donor_id: user.id,
        recipient_id: directTarget.id,
        items: items.map(it => `${it.qty} ${it.unit} ${it.name}`),
        meals_count: Math.max(1, meals),
        food_type: foodType,
        category,
        cooked_at: cookedAt,
        expires_at: expiresAt,
        urgency: aiResult?.urgency || "high",
        address,
        lat,
        lng,
        notes: directNotes,
      });

      // Notify Recipient
      await sendNotificationMutation.mutateAsync({
        user_id: directTarget.id,
        title: "Direct Food Offer",
        message: `${user?.user_metadata?.full_name || user?.user_metadata?.org_name || "A donor"} has sent a direct food offer of ${meals} meals to you!`,
        type: "success",
        metadata: { donor_id: user?.id }
      });

      toast.success(`Direct offer sent to ${directTarget.org_name || directTarget.name}!`, {
        description: `${Math.max(1, meals)} meals headed their way.`,
      });
      setDirectTarget(null);
      setDirectNotes("");
    } catch (e: any) {
      toast.error("Failed to send direct offer", { description: e.message });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />

      {/* Greeting */}
      <section className="border-b border-border/60 bg-background">
        <div className="container py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Donor dashboard</p>
              <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
                Good evening, {user?.user_metadata?.full_name || "Food Hero"} 👋
              </h1>
              <p className="mt-2 text-muted-foreground">
                You've rescued{" "}
                <span className="font-semibold text-foreground">{stats?.mealsRescued || 0} meals</span>{" "}
                overall — keep it up!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => document.getElementById('impact-card')?.scrollIntoView({ behavior: 'smooth' })}>
                <Trophy className="mr-1 h-4 w-4" /> Impact card
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => document.getElementById('recipients-section')?.scrollIntoView({ behavior: 'smooth' })}>
                <Users className="mr-1 h-4 w-4" /> Recipients
              </Button>
              <Button variant="outline" className="rounded-full bg-secondary/10 text-secondary border-secondary/20" onClick={() => document.getElementById('community-needs')?.scrollIntoView({ behavior: 'smooth' })}>
                <Sparkles className="mr-1 h-4 w-4" /> Needs
              </Button>
              <Button className="rounded-full shadow-glow" onClick={() => document.getElementById('new-listing')?.scrollIntoView({ behavior: 'smooth' })}>
                <Plus className="mr-1 h-4 w-4" /> New listing
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-8 py-10 lg:grid-cols-3">
        {/* Listing form */}
        <div className="lg:col-span-2" id="new-listing">
          <div className="rounded-3xl bg-card p-6 shadow-soft md:p-8">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ChefHat className="h-5 w-5" />
              </span>
              <h2 className="font-display text-2xl font-semibold">
                List surplus food
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll auto-calculate the safe-to-eat window and notify recipients
              within 10 km.
            </p>

            {/* Category */}
            <div className="mt-6">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Source category
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => {
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-smooth ${
                        active
                          ? "bg-primary text-primary-foreground ring-primary shadow-glow"
                          : "bg-background text-foreground ring-border hover:ring-primary/50"
                      }`}
                    >
                      <c.icon className="h-4 w-4" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Food items
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                  className="h-8 rounded-full text-primary"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {items.map((it, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 rounded-2xl border border-border bg-background p-3"
                  >
                    <Input
                      className="col-span-12 md:col-span-5"
                      placeholder="e.g. Paneer butter masala"
                      value={it.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                    />
                    <Input
                      type="number"
                      className="col-span-4 md:col-span-2"
                      placeholder="Qty"
                      value={it.qty}
                      onChange={(e) => updateItem(i, "qty", e.target.value)}
                    />
                    <select
                      className="col-span-4 md:col-span-2 rounded-md border border-border bg-background px-3 text-sm"
                      value={it.unit}
                      onChange={(e) => updateItem(i, "unit", e.target.value)}
                    >
                      <option value="plates">Plates</option>
                      <option value="kg">kg</option>
                      <option value="liters">Liters</option>
                      <option value="pieces">Pieces</option>
                    </select>
                    <select
                      className="col-span-3 md:col-span-2 rounded-md border border-border bg-background px-3 text-sm"
                      value={it.type}
                      onChange={(e) => updateItem(i, "type", e.target.value)}
                    >
                      <option value="veg">Veg</option>
                      <option value="non-veg">Non-Veg</option>
                      <option value="vegan">Vegan</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="col-span-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cook time + auto urgency */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="cook" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cooked at
                </Label>
                <Input id="cook" type="datetime-local" className="mt-2" defaultValue={new Date(Date.now() - 30 * 60000).toISOString().slice(0, 16)} />
              </div>
              <div className={cn(
                "rounded-2xl p-4 transition-all duration-500",
                aiLoading ? "bg-muted/50 animate-pulse" : "bg-gradient-warm shadow-sm border border-orange-100"
              )}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                    AI Safety Check
                  </p>
                  {aiLoading ? (
                    <Clock className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  )}
                </div>
                
                <div className="mt-3 flex items-center justify-between">
                  <UrgencyBadge 
                    urgency={aiResult?.urgency || "medium"} 
                    timeLeft={aiResult?.window || "Calculating..."} 
                  />
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
                    {aiResult?.urgency || "Pending"}
                  </span>
                </div>

                <div className="mt-3 relative min-h-[40px]">
                  <p className="text-[11px] leading-relaxed text-muted-foreground italic">
                    {reasoningText || (aiLoading ? "Analyzing ingredients and age..." : "Add items to start safety analysis.")}
                  </p>
                  {!aiLoading && aiResult && (
                    <div className="absolute -bottom-1 -right-1 opacity-20">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Location + photos */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-primary" /> Pickup location
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={handleLocate} className="h-7 text-xs px-2 text-muted-foreground" type="button">Use Location</Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsMapModalOpen(true)} className="h-7 text-xs px-2 text-primary" type="button">Edit Pin</Button>
                    </div>
                  </div>
                  {isLoaded ? (
                    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                      <Input
                        className="mt-3 h-9 bg-muted/50 text-sm"
                        placeholder="Search for a place or address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </Autocomplete>
                  ) : (
                    <Input
                      className="mt-3 h-9 bg-muted/50 text-sm"
                      placeholder="Loading suggestions..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-col rounded-2xl border border-dashed border-border bg-background p-4 text-center transition-colors">
                <div className="relative flex cursor-pointer flex-col items-center justify-center p-2 hover:bg-muted/30">
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    className="absolute inset-0 z-10 w-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files) {
                        setFiles(Array.from(e.target.files).slice(0, 3));
                      }
                    }}
                  />
                  <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
                  <p className="mt-1 text-sm font-medium">Drop photos (max 3)</p>
                </div>
                {files.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 justify-center">
                    {files.map((f, idx) => {
                      const url = URL.createObjectURL(f);
                      return (
                        <div key={idx} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border shadow-sm ring-offset-1 hover:ring-2 hover:ring-primary/50" onClick={() => setPreviewPhoto(url)}>
                          <img src={url} alt="preview" className="h-full w-full object-cover cursor-pointer transition-opacity" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pickup notes
              </Label>
              <Textarea
                id="notes"
                className="mt-2"
                placeholder="Use the back gate · Ask for chef Ravi"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Two posting modes */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-primary/40 hover:bg-primary/5 text-primary"
                onClick={() => {
                  if (!user) { toast.error("Please log in"); return navigate("/login/donor"); }
                  document.getElementById('recipients-section')?.scrollIntoView({ behavior: 'smooth' });
                  toast.info("Select a recipient below to send directly", { duration: 3000 });
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send to specific NGO/org
              </Button>
              <Button
                size="lg"
                className="rounded-full shadow-glow"
                onClick={submit}
                disabled={createListingMutation.isPending || isUploading}
              >
                <Radio className="mr-2 h-4 w-4" />
                {isUploading ? "Uploading photos..." : createListingMutation.isPending ? "Posting..." : "Open broadcast to all"}
              </Button>
            </div>
          </div>

          {/* Active listings */}
          <div className="mt-8 rounded-3xl bg-card p-6 shadow-soft md:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">
                Active listings
              </h2>
              <span className="text-sm text-muted-foreground">
                {myListings.length} live
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {myListings.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                      <Utensils className="h-5 w-5 text-primary" />
                    </span>
                    <div>
                      <p className="font-semibold max-w-[200px] truncate">
                        {l.items.slice(0, 2).join(", ")}
                        {l.items.length > 2 ? ` +${l.items.length - 2}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.meals_count} meals · {l.status}
                      </p>
                    </div>
                  </div>
                  <UrgencyBadge urgency={l.urgency} timeLeft={l.expires_at ? new Date(l.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Soon"} pulse={l.urgency === "critical"} />
                </div>
              ))}
              {myListings.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
                  No active listings at the moment.
                </div>
              )}
            </div>
      </div>

      {/* Community Needs Section */}
      <section className="bg-background py-16" id="community-needs">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl font-semibold">Community Needs</h2>
              <p className="text-muted-foreground mt-1">Recipients in your area who have broadcasted a need for food.</p>
            </div>
            <div className="flex h-10 items-center gap-2 rounded-full bg-muted/50 px-4 text-sm font-medium">
                <Radio className="h-4 w-4 text-secondary animate-pulse" />
                Live Broadcasts
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {needsLoading ? (
                 Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-48 animate-pulse rounded-3xl bg-muted/50" />
                 ))
             ) : (nearbyNeeds || []).length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-border">
                    <Heart className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No active needs broadcasted in this area yet.</p>
                </div>
             ) : (
                nearbyNeeds.map((need) => (
                    <article key={need.id} className="group overflow-hidden rounded-3xl bg-card border border-border/40 p-6 transition-smooth hover:shadow-warm">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                                    <Sparkles className="h-5 w-5" />
                                </span>
                                <div>
                                    <h3 className="font-semibold">{need.donor?.org_name || need.donor?.name || "Recipient"}</h3>
                                    <p className="text-xs text-muted-foreground">{need.pseudoDistance.toFixed(1)} km away</p>
                                </div>
                            </div>
                            <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                                Need
                            </span>
                        </div>
                        
                        <div className="mt-4">
                            <p className="text-sm font-medium">{need.items[0]}</p>
                            {need.notes && <p className="mt-1 text-xs text-muted-foreground line-clamp-2 italic">"{need.notes}"</p>}
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">{need.meals_count}</span>
                                <span className="text-xs text-muted-foreground uppercase font-semibold">meals</span>
                            </div>
                            <Button 
                                size="sm" 
                                className="rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                onClick={() => {
                                    setDirectTarget({
                                        id: need.donor_id,
                                        name: need.donor?.name || "",
                                        org_name: need.donor?.org_name || "",
                                        org_type: "other",
                                        address: need.address,
                                        lat: need.lat,
                                        lng: need.lng,
                                        beneficiaries_count: need.meals_count,
                                        is_verified: true,
                                        created_at: need.created_at
                                    });
                                    document.getElementById('new-listing')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                Fulfill
                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </article>
                ))
             )}
          </div>
        </div>
      </section>

      {/* Direct recipients section */}
          <div className="mt-8 rounded-3xl bg-card p-6 shadow-soft md:p-8" id="recipients-section">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-semibold">Recipients directory</h2>
                <p className="text-sm text-muted-foreground">NGOs, orphanages, shelters & more — send food directly or broadcast openly</p>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-5 flex flex-wrap gap-2">
              {["all", "ngo", "orphanage", "old_age_home", "shelter", "school", "hospital", "community_kitchen", "other"].map((t) => {
                const label = t === "all" ? "All" : (orgTypeConfig[t]?.label || t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrgTypeFilter(t)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-smooth ${
                      orgTypeFilter === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or location..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
              />
            </div>

            {/* Cards */}
            <div className="mt-4 space-y-3">
              {recipientsLoading && (
                <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">Loading registered organisations…</div>
              )}
              {!recipientsLoading && filteredRecipients.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No organisations match your filter.</p>
                  <p className="text-xs text-muted-foreground mt-1">Try broadening your search or selecting "All".</p>
                </div>
              )}
              {filteredRecipients.map((org) => {
                const cfg = orgTypeConfig[org.org_type || "other"] || orgTypeConfig["other"];
                const OrgIcon = cfg.icon;
                const displayName = org.org_name || org.name || "Community Partner";
                const isGoogle = (org as any).is_google_result;

                return (
                  <div
                    key={org.id}
                    className={cn(
                      "group flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 transition-smooth hover:shadow-md",
                      isGoogle 
                        ? "border-dashed border-muted-foreground/30 bg-muted/5 hover:border-primary/40" 
                        : "border-border bg-background hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        isGoogle ? "bg-muted text-muted-foreground" : cfg.color.split(' ')[0]
                      )}>
                        <OrgIcon className={cn(
                          "h-5 w-5",
                          isGoogle ? "" : cfg.color.split(' ')[1]
                        )} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate max-w-[200px]">{displayName}</p>
                          {isGoogle ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              <MapPin className="h-2.5 w-2.5" /> Google Maps
                            </span>
                          ) : (
                            <>
                              {org.is_verified && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  <BadgeCheck className="h-2.5 w-2.5" /> Verified
                                </span>
                              )}
                              <OrgTypeBadge type={org.org_type || "other"} />
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">{org.address || "Location not set"}</p>
                        {org.beneficiaries_count > 0 && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {org.beneficiaries_count.toLocaleString()} beneficiaries
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant={isGoogle ? "outline" : "default"}
                        className="rounded-full"
                        onClick={() => {
                          if (!user) { toast.error("Please log in"); return navigate("/login/donor"); }
                          setDirectTarget(org);
                          setDirectNotes("");
                        }}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {isGoogle ? "Direct offer" : "Send directly"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {isSearchingNearby && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground animate-pulse">
                  <Search className="h-3.5 w-3.5 animate-spin" />
                  Searching nearby NGOs & shelters from Google Maps...
                </div>
              )}
            </div>

            {/* Open broadcast CTA at bottom of directory */}
            <div className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-primary flex items-center gap-2">
                    <Radio className="h-4 w-4" /> Open broadcast
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Don't see the right org? Broadcast to all nearby recipients — whoever is available will respond.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-primary/40 text-primary"
                  onClick={submit}
                  disabled={createListingMutation.isPending || isUploading}
                >
                  <ArrowRight className="mr-1 h-3.5 w-3.5" />
                  {createListingMutation.isPending ? "Posting…" : "Post open listing"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Side: impact + incoming requests */}
        <aside className="space-y-6">
          <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-warm" id="impact-card">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
              Your impact this month
            </p>
            <p className="mt-3 font-display text-5xl font-semibold">{stats?.mealsRescued || 0}</p>
            <p className="text-sm opacity-90">meals rescued</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur">
                <p className="text-xs opacity-80">Waste prevented</p>
                <p className="font-display text-xl font-semibold">{((stats?.mealsRescued || 0) * 0.35).toFixed(1)} kg</p>
              </div>
              <div className="rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur">
                <p className="text-xs opacity-80">Completed deliveries</p>
                <p className="font-display text-xl font-semibold">{stats?.deliveries || 0}</p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-sm opacity-90">
              <Leaf className="h-4 w-4" /> 6-week streak · Food Hero badge
            </div>
          </div>

          {/* Quick stats about recipients */}
          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" /> Recipient network
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Object.entries(orgTypeConfig).slice(0, 6).map(([type, cfg]) => {
                const count = (allRecipients || []).filter(r => (r.org_type || "other") === type).length;
                const Icon = cfg.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setOrgTypeFilter(type);
                      document.getElementById('recipients-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex flex-col rounded-2xl border border-border bg-muted/30 p-3 text-left transition-smooth hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className={`text-xs font-bold ${cfg.color.split(' ')[1]}`}>{count}</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground leading-tight">{cfg.label}s</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg font-semibold">
              Available partners
            </h3>
            <p className="text-xs text-muted-foreground">
              Delivery assigns automatically when a recipient requests food.
            </p>
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Partners are on-call 💚
            </div>
          </div>

          {/* Incoming Requests for Donors */}
          {(incomingRequests || []).length > 0 && (
            <div className="rounded-3xl bg-card p-6 shadow-soft">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="font-display text-lg font-semibold">
                  Incoming requests
                </h3>
              </div>
              <div className="mt-4 space-y-3">
                {incomingRequests?.map((req) => {
                  let requirements = "";
                  try {
                    requirements = JSON.parse(req.pickup_preference || "{}").requirements;
                  } catch(e) {}

                  return (
                    <div key={req.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{req.recipient?.org_name || req.recipient?.name || "Community Partner"}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-full">
                          {req.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested {req.beneficiaries_count} meals from "{req.listing?.title}"
                      </p>
                      {requirements && (
                        <div className="mt-2 p-2 rounded-xl bg-muted/40 border border-border/50 text-[11px] italic text-muted-foreground">
                          "{requirements}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Map Modal */}
      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Select Pickup Location</DialogTitle>
          </DialogHeader>
          <div className="h-[400px] w-full rounded-xl overflow-hidden border border-border">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={{ lat, lng }}
                zoom={14}
                onClick={handleMapClick}
              >
                <Marker position={{ lat, lng }} />
              </GoogleMap>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">Loading Map...</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsMapModalOpen(false)} className="rounded-full">Save Location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Preview Modal */}
      <Dialog open={!!previewPhoto} onOpenChange={(o) => (!o) && setPreviewPhoto(null)}>
        <DialogContent className="sm:max-w-2xl bg-transparent border-none shadow-none p-0">
          {previewPhoto && <img src={previewPhoto} className="w-full h-auto rounded-3xl" alt="Full Preview" />}
        </DialogContent>
      </Dialog>

      {/* Direct Offer Dialog */}
      <Dialog open={!!directTarget} onOpenChange={(o) => !o && !sendDirectOfferMutation.isPending && setDirectTarget(null)}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send directly to {directTarget?.org_name || directTarget?.name}
            </DialogTitle>
            <DialogDescription>
              This food offer will be sent directly and confirmed immediately — no open broadcast needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Recipient info summary */}
            {directTarget && (
              <div className="rounded-2xl bg-muted/50 border border-border p-4 flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${(orgTypeConfig[directTarget.org_type || "other"] || orgTypeConfig["other"]).color.split(' ')[0]}`}>
                  {(() => { const Icon = (orgTypeConfig[directTarget.org_type || "other"] || orgTypeConfig["other"]).icon; return <Icon className={`h-5 w-5 ${(orgTypeConfig[directTarget.org_type || "other"] || orgTypeConfig["other"]).color.split(' ')[1]}`} />; })()}
                </span>
                <div>
                  <p className="font-semibold">{directTarget.org_name || directTarget.name}</p>
                  <p className="text-xs text-muted-foreground">{directTarget.address || "—"}</p>
                  {directTarget.beneficiaries_count > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> {directTarget.beneficiaries_count} beneficiaries served here
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Food summary from current form state */}
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Food being sent</p>
              <div className="flex flex-wrap gap-1.5">
                {items.filter(it => it.name).map((it, i) => (
                  <span key={i} className="rounded-full bg-background px-3 py-1 text-xs font-medium border border-border">
                    {it.qty} {it.unit} {it.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                From: <span className="font-medium">{address || "—"}</span>
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Direct message / notes for them
              </Label>
              <Textarea
                className="mt-2"
                placeholder="e.g. Food is ready at the front entrance, please pick up by 6 PM…"
                value={directNotes}
                onChange={(e) => setDirectNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDirectTarget(null)}
              disabled={sendDirectOfferMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={submitDirectOffer}
              disabled={sendDirectOfferMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendDirectOfferMutation.isPending ? "Sending…" : `Send to ${directTarget?.org_name || directTarget?.name || "org"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
};

export default DonorDashboard;
