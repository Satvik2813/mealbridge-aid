import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { sampleListings, samplePartners } from "@/data/sampleData";
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

const categories = [
  { id: "restaurant", label: "Restaurant", icon: Utensils },
  { id: "event", label: "Event", icon: Sparkles },
  { id: "home", label: "Home", icon: ChefHat },
  { id: "bakery", label: "Bakery", icon: Award },
  { id: "catering", label: "Catering", icon: Truck },
];

interface Item { name: string; qty: string; unit: string; type: string; }

const DonorDashboard = () => {
  const [category, setCategory] = useState("restaurant");
  const [items, setItems] = useState<Item[]>([
    { name: "Vegetable Biryani", qty: "20", unit: "plates", type: "veg" },
  ]);
  const [notes, setNotes] = useState("");

  const myListings = sampleListings.slice(0, 3);

  const addItem = () =>
    setItems((p) => [...p, { name: "", qty: "", unit: "plates", type: "veg" }]);
  const removeItem = (i: number) =>
    setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: keyof Item, val: string) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));

  const submit = () => {
    toast.success("Listing posted! 23 nearby recipients notified.", {
      description: "Critical urgency · expires in 1h 45m",
    });
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
                Good evening, Spice Garden 👋
              </h1>
              <p className="mt-2 text-muted-foreground">
                You've rescued{" "}
                <span className="font-semibold text-foreground">1,284 meals</span>{" "}
                this month — a 6-week donation streak.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-full">
                <Trophy className="mr-1 h-4 w-4" /> Impact card
              </Button>
              <Button className="rounded-full">
                <Plus className="mr-1 h-4 w-4" /> New listing
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-8 py-10 lg:grid-cols-3">
        {/* Listing form */}
        <div className="lg:col-span-2">
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
              <div className="rounded-2xl border border-dashed border-border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-primary" /> Pickup location
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-detected · Banjara Hills, Road No. 12
                </p>
                <Button variant="ghost" size="sm" className="mt-2 h-8 px-2 text-primary">
                  Edit pin on map
                </Button>
              </div>
              <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-center">
                <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-1 text-sm font-medium">Drop photos (max 3)</p>
                <p className="text-xs text-muted-foreground">
                  Helps AI estimate servings
                </p>
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
            >
              <Send className="mr-2 h-4 w-4" />
              Post listing & notify nearby recipients
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
                      <p className="font-semibold">{l.items.slice(0, 2).join(", ")}{l.items.length > 2 ? ` +${l.items.length - 2}` : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.meals} meals · {l.address} · {l.status}
                      </p>
                    </div>
                  </div>
                  <UrgencyBadge urgency={l.urgency} timeLeft={l.timeLeft} pulse={l.urgency === "critical"} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side: impact + partners */}
        <aside className="space-y-6">
          <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-warm">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
              Your impact this month
            </p>
            <p className="mt-3 font-display text-5xl font-semibold">1,284</p>
            <p className="text-sm opacity-90">meals rescued</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur">
                <p className="text-xs opacity-80">Waste prevented</p>
                <p className="font-display text-xl font-semibold">449 kg</p>
              </div>
              <div className="rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur">
                <p className="text-xs opacity-80">CO₂ avoided</p>
                <p className="font-display text-xl font-semibold">1.1 t</p>
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
              Sorted by proximity to your kitchen
            </p>
            <div className="mt-4 space-y-3">
              {samplePartners.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 font-semibold text-secondary">
                      {p.name.charAt(0)}
                    </span>
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.vehicle} · ★ {p.rating} · {p.distanceKm} km
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-full">
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">
                Recipient thank-yous
              </h3>
            </div>
            <blockquote className="mt-3 rounded-2xl bg-muted/60 p-4 text-sm italic">
              "Children loved the biryani. We had enough for dinner and tomorrow's
              breakfast too. God bless." <br />
              <span className="not-italic text-xs font-semibold text-muted-foreground">
                — Sister Anitha, Sunshine Children's Home
              </span>
            </blockquote>
          </div>
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
};

export default DonorDashboard;
