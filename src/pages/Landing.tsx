import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { StatCounter } from "@/components/StatCounter";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { useGlobalStats, useAvailableListings } from "@/hooks/useSupabaseData";
import {
  ArrowRight,
  ChefHat,
  Heart,
  Bike,
  Sparkles,
  MapPin,
  Clock,
  Leaf,
  ShieldCheck,
  Users,
  TrendingUp,
} from "lucide-react";
import heroImage from "@/assets/hero-foodbridge.jpg";
import donorImg from "@/assets/donor.jpg";
import recipientsImg from "@/assets/recipients.jpg";
import partnerImg from "@/assets/partner.jpg";

const Landing = () => {
  const { data: globalStats } = useGlobalStats();
  const { data: liveListings } = useAvailableListings();
  
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-warm" />
        <div className="container relative z-10 grid items-center gap-10 py-16 md:grid-cols-2 md:py-24 lg:py-28">
          <div className="animate-float-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-secondary" />
              Now live in Hyderabad · Beta
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
              Rescue food.
              <br />
              <span className="inline-block bg-gradient-hero bg-clip-text-hero">
                Feed lives.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Every evening, restaurants discard plates of warm food while
              orphanages ration meals. FeedLoop closes the gap in real time —
              expiry-aware, location-smart, and powered by volunteers.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full shadow-glow">
                <Link to="/login/donor">
                  <ChefHat className="mr-1 h-4 w-4" /> I have surplus food
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-full"
              >
                <Link to="/login/recipient">
                  <Heart className="mr-1 h-4 w-4" /> We need meals
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full">
                <Link to="/login/partner">
                  <Bike className="mr-1 h-4 w-4" /> I can deliver
                </Link>
              </Button>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> FSSAI-aware
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Expiry-priority
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-primary" /> CO₂ tracked
              </div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative animate-float-up">
            <div className="relative overflow-hidden rounded-[2rem] shadow-warm ring-1 ring-border">
              <img
                src={heroImage}
                alt="Volunteers packing fresh Indian meals into steel tiffin containers for delivery"
                width={1920}
                height={1080}
                className="h-[420px] w-full object-cover md:h-[520px]"
              />
              <div className="absolute inset-0 bg-gradient-overlay" />

              {/* Floating cards */}
              {liveListings && liveListings.length > 0 ? (
                <>
                  <div className="absolute left-5 top-5 flex items-center gap-2 rounded-2xl bg-background/95 px-3 py-2 shadow-soft backdrop-blur">
                    <UrgencyBadge urgency={liveListings[0].urgency} timeLeft="Active" pulse={liveListings[0].urgency === "critical"} />
                    <span className="text-xs font-medium">{liveListings[0].meals_count} meals · {liveListings[0].address?.split(',')[0]}</span>
                  </div>

                  <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-background/95 p-4 shadow-warm backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div className="overflow-hidden pr-4">
                        <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                          Live Match
                        </p>
                        <p className="mt-0.5 font-display text-sm md:text-base font-semibold truncate">
                          {liveListings[0].donor?.org_name || liveListings[0].donor?.name || "Donor"} → Finding recipient...
                        </p>
                      </div>
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-1/3 rounded-full bg-gradient-hero animate-pulse" />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-secondary" /> Matching nearest partner
                    </p>
                  </div>
                </>
              ) : (
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-background/95 p-4 shadow-warm backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Live Network
                      </p>
                      <p className="mt-0.5 font-display text-base font-semibold text-muted-foreground">
                        Awaiting today's first donation
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Decorative blobs */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Impact strip */}
      <section className="border-y border-border/60 bg-card">
        <div className="container grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          {[
            { label: "Meals rescued", value: globalStats?.mealsRescued || 0, icon: Heart },
            { label: "Active donors", value: globalStats?.activeDonors || 0, icon: ChefHat },
            { label: "Partner deliveries", value: globalStats?.deliveries || 0, icon: Bike },
            { label: "kg CO₂ avoided", value: globalStats?.co2Saved || 0, icon: Leaf },
          ].map((s) => (
            <div key={s.label}>
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-3xl font-semibold md:text-4xl">
                <StatCounter to={s.value} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            How FeedLoop works
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Three roles. One mission.
          </h2>
          <p className="mt-4 text-muted-foreground">
            A coordinated marketplace that matches surplus food to nearby need,
            then routes a volunteer to deliver — usually in under 45 minutes.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              tag: "01 · Donor",
              title: "List your surplus",
              body: "Restaurants, caterers and homes log surplus food in seconds. Cook time auto-calculates the safe-to-eat window.",
              img: donorImg,
              to: "/donor",
              cta: "Open donor dashboard",
            },
            {
              tag: "02 · Recipient",
              title: "Claim what's nearby",
              body: "Orphanages and shelters see expiry-priority listings within their radius and request with one tap.",
              img: recipientsImg,
              to: "/recipient",
              cta: "Open recipient dashboard",
            },
            {
              tag: "03 · Partner",
              title: "Deliver with purpose",
              body: "Volunteers accept nearby missions, get an optimized route, and broadcast live ETA to both sides.",
              img: partnerImg,
              to: "/partner",
              cta: "Open partner dashboard",
            },
          ].map((c, i) => (
            <Link
              key={c.tag}
              to={c.to}
              className="group relative overflow-hidden rounded-3xl bg-gradient-card p-1 shadow-soft transition-smooth hover:shadow-warm"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="overflow-hidden rounded-[1.4rem]">
                <img
                  src={c.img}
                  alt={c.title}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="h-56 w-full object-cover transition-smooth group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  {c.tag}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  {c.cta}
                  <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Live activity preview */}
      <section className="container pb-20">
        <div className="overflow-hidden rounded-3xl bg-gradient-hero p-1 shadow-warm">
          <div className="grid items-center gap-8 rounded-[1.4rem] bg-background p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-primary">
                Live activity
              </p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
                Every minute matters when food is hot.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Listings are scored by an expiry-priority algorithm. Critical
                items are pinned to every nearby recipient's feed and
                push-notified instantly.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <UrgencyBadge urgency="critical" timeLeft="1h 12m" pulse />
                <UrgencyBadge urgency="high" timeLeft="2h 40m" />
                <UrgencyBadge urgency="medium" timeLeft="4h 05m" />
                <UrgencyBadge urgency="low" timeLeft="5h 50m" />
              </div>
            </div>

            <div className="space-y-3">
              {liveListings && liveListings.length > 0 ? (
                liveListings.slice(0, 3).map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-primary" />
                      </span>
                      <div>
                        <p className="font-semibold truncate max-w-[200px]">
                          {listing.donor?.org_name || listing.donor?.name || "Donor"} → Nearby recipient
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {listing.address?.split(',')[0]} · {listing.meals_count} meals
                        </p>
                      </div>
                    </div>
                    <UrgencyBadge urgency={listing.urgency} pulse={listing.urgency === "critical"} />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
                  <Sparkles className="h-8 w-8 text-primary/30" />
                  <p className="text-sm text-muted-foreground">No active transfers right now.<br />Be the first donor today!</p>
                  <Button asChild size="sm" className="rounded-full mt-1">
                    <Link to="/login/donor">List surplus food</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="bg-muted/40 py-20 md:py-28">
        <div className="container grid gap-10 md:grid-cols-3">
          {[
            {
              icon: TrendingUp,
              title: "68 million tonnes",
              body: "of food wasted in India every year, while 194 million go undernourished. FeedLoop attacks the logistics gap.",
            },
            {
              icon: Users,
              title: "Three-sided network",
              body: "Donors, recipients and partners coordinate from one shared real-time data layer — no WhatsApp chaos.",
            },
            {
              icon: ShieldCheck,
              title: "Trust by design",
              body: "Verified NGOs, FSSAI-aware donor profiles, food safety scoring and rated delivery partners.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-3xl bg-card p-8 shadow-soft">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold">
                {c.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 md:py-28">
        <div className="overflow-hidden rounded-[2rem] bg-gradient-hero p-10 text-center shadow-warm md:p-16">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold leading-tight text-primary-foreground md:text-5xl">
            Hyderabad has surplus. Hyderabad has hunger.
            <br /> Be the bridge.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="rounded-full">
              <Link to="/login/donor">Start donating</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              <Link to="/impact">View live impact</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Landing;
