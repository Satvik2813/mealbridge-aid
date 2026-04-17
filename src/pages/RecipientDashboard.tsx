import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { MapCanvas } from "@/components/MapCanvas";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { useAvailableListings, useRequestFood, type DatabaseListing as Listing } from "@/hooks/useSupabaseData";
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

const donorCategoryIcon: Record<string, any> = {
  restaurant: Utensils,
  event: Sparkles,
  home: ChefHat,
  bakery: Award,
  catering: Truck,
};

const RecipientDashboard = () => {
  const [sort, setSort] = useState<typeof sortOptions[number]>("Expiring");
  const [radius, setRadius] = useState(5);
  const [type, setType] = useState<typeof typeFilters[number]>("All");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [beneficiaries, setBeneficiaries] = useState("80");

  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: rawListings } = useAvailableListings();
  const requestFoodMutation = useRequestFood();

  const listings = useMemo(() => {
    let l = rawListings ? [...rawListings] : [];
    // Filter Veg vs Non-Veg
    if (type !== "All") {
      l = l.filter((x) => x.food_type === type.toLowerCase() || (type === "Veg" && x.food_type === "mixed"));
    }
    
    // Assign pseudo distances for UI since we aren't doing heavy PostGIS queries yet
    const withDistance = l.map(listing => ({
      ...listing,
      pseudoDistance: (listing.id.charCodeAt(0) % 15) + (Math.random() * 2) // consistent pseudo-random 
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
    try {
      await requestFoodMutation.mutateAsync({
        listing_id: selected.id,
        recipient_id: user.id,
        beneficiaries_count: parseInt(beneficiaries) || 1
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
                  <Building2 className="h-4 w-4" /> Kukatpally
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> 120 children
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Verified NGO
                </span>
              </p>
            </div>
            <Button variant="outline" className="rounded-full">
              <Bell className="mr-1 h-4 w-4" /> Today's need: 100 meals
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
          <div className="rounded-3xl bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-secondary" />
              <p className="font-semibold">Tip</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Listings flagged{" "}
              <span className="font-semibold text-urgent-critical">Critical</span>{" "}
              expire in under 90 minutes — request first to lock pickup.
            </p>
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
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-2xl border border-primary bg-primary/5 p-3 text-left text-sm font-semibold text-primary">
                Platform partner
                <span className="block text-xs font-normal text-muted-foreground">
                  We'll assign a volunteer
                </span>
              </button>
              <button className="rounded-2xl border border-border p-3 text-left text-sm font-semibold">
                Self pickup
                <span className="block text-xs font-normal text-muted-foreground">
                  Our team will collect
                </span>
              </button>
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
