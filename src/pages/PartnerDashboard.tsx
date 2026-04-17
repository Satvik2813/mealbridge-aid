import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapCanvas } from "@/components/MapCanvas";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { sampleListings } from "@/data/sampleData";
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
import { useState } from "react";
import { toast } from "sonner";
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

  const orders = sampleListings.filter((l) => l.status === "Available");

  const accept = (id: string) => {
    setActive(id);
    setStep(0);
    toast.success("Mission accepted!", { description: "Navigating to pickup" });
  };

  const next = () => {
    if (step < 3) setStep((s) => (s + 1) as Step);
    if (step === 2) {
      toast.success("Delivery complete · 42 meals served 🎉");
    }
  };

  const reset = () => {
    setActive(null);
    setStep(0);
  };

  const activeOrder = sampleListings.find((l) => l.id === active);

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />

      {/* Header */}
      <section className="border-b border-border/60 bg-background">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-8">
          <div>
            <p className="text-sm text-muted-foreground">Delivery partner</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              Hi Priya 🛵
            </h1>
            <p className="mt-2 text-muted-foreground">
              ★ 4.9 · 142 deliveries · Top 5% in Hyderabad
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-soft">
            <span className={cn("h-2.5 w-2.5 rounded-full", online ? "bg-urgent-low animate-pulse" : "bg-muted-foreground")} />
            <span className="text-sm font-semibold">{online ? "Online" : "Offline"}</span>
            <Switch checked={online} onCheckedChange={setOnline} />
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
                  <p className="font-semibold">{o.donor}</p>
                  <p className="text-xs text-muted-foreground">{o.address}</p>
                </div>
                <UrgencyBadge urgency={o.urgency} timeLeft={o.timeLeft} pulse={o.urgency === "critical"} />
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Drop · Sunshine Children's Home, Kukatpally</span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold">{o.meals} meals</span>
                  <span className="text-muted-foreground">{o.distanceKm} km · ~18 min</span>
                </div>
                {!active ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="rounded-full">
                      Skip
                    </Button>
                    <Button size="sm" className="rounded-full" onClick={() => accept(o.id)}>
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
                  {activeOrder?.meals} meals served at Sunshine Children's Home
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 p-6 text-center">
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
              <MapCanvas height={360} showRoute />

              <div className="rounded-3xl bg-card p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bike className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold">Active delivery</p>
                      <p className="text-xs text-muted-foreground">
                        Mission #{activeOrder?.id} · {activeOrder?.meals} meals
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
                  {steps.map((s, idx) => {
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
                    Banjara Hills → Jubilee Hills → Kukatpally · 3.2 km · ~18 min
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
