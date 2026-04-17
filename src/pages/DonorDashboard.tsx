import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { useDonorListings, useCreateListing, useUserStats } from "@/hooks/useSupabaseData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  Camera,
  ChefHat,
  Clock,
  Leaf,
  MapPin,
  Plus,
  Send,
  Trash2,
  Trophy,
  TrendingUp,
  Truck,
  Utensils,
  Award,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { uploadPhotoToR2 } from "@/lib/r2";

const categories = [
  { id: "restaurant", label: "Restaurant", icon: Utensils },
  { id: "event", label: "Event", icon: Sparkles },
  { id: "home", label: "Home", icon: ChefHat },
  { id: "bakery", label: "Bakery", icon: Award },
  { id: "catering", label: "Catering", icon: Truck },
];

interface Item { name: string; qty: string; unit: string; type: string; }

const libraries: ("places")[] = ["places"];

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

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

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
        setLat(place.geometry.location.lat());
        setLng(place.geometry.location.lng());
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
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // 6 hr window

      // Upload photos sequentially or in parallel
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
        urgency: "high",
        status: "available",
        address: address,
        lat: lat,
        lng: lng,
        photos: validPhotoUrls
      });

      toast.success("Listing posted!", {
        description: "Nearby recipients have been notified.",
      });
      
      // Reset form
      setItems([{ name: "", qty: "", unit: "plates", type: "veg" }]);
      setNotes("");
      setFiles([]);
    } catch (e: any) {
      toast.error("Failed to post listing", { description: e.message });
    } finally {
      setIsUploading(false);
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
              <Button className="rounded-full" onClick={() => document.getElementById('new-listing')?.scrollIntoView({ behavior: 'smooth' })}>
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
              <div className="rounded-2xl bg-gradient-warm p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Auto urgency
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <UrgencyBadge urgency="medium" timeLeft="3h safe" />
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cooked {"<"} 2h ago — safe-to-eat window: 6 hours
                </p>
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
                      )
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

            <Button
              size="lg"
              className="mt-6 w-full rounded-full shadow-glow"
              onClick={submit}
              disabled={createListingMutation.isPending || isUploading}
            >
              <Send className="mr-2 h-4 w-4" />
              {isUploading ? "Uploading photos..." : createListingMutation.isPending ? "Posting..." : "Post listing & notify nearby recipients"}
            </Button>
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
        </div>

        {/* Side: impact + partners */}
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
                          " {requirements} "
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

      <SiteFooter />
    </div>
  );
};

export default DonorDashboard;
