import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatCounter } from "@/components/StatCounter";
import { Heart, ChefHat, Bike, Leaf, Trophy, Building2 } from "lucide-react";
import { useGlobalStats } from "@/hooks/useSupabaseData";

const Impact = () => {
  const { data: globalStats } = useGlobalStats();

  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteHeader />

      <section className="container py-16 md:py-24">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">
          Live · Hyderabad
        </p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight md:text-6xl">
          The bridge, in numbers.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Every meal counts. Every kilometre matters. These figures update as
          donors, recipients and partners coordinate across the city.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            { label: "Meals rescued", value: globalStats?.mealsRescued || 0, icon: Heart, hue: "primary" },
            { label: "Active donors", value: globalStats?.activeDonors || 0, icon: ChefHat, hue: "secondary" },
            { label: "Partner deliveries", value: globalStats?.deliveries || 0, icon: Bike, hue: "accent" },
            { label: "kg CO₂ avoided", value: globalStats?.co2Saved || 0, icon: Leaf, hue: "primary" },
          ].map((s, i) => (
            <div
              key={s.label}
              className="rounded-3xl bg-gradient-card p-6 shadow-soft animate-float-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <s.icon className="h-6 w-6 text-primary" />
              <p className="mt-4 font-display text-4xl font-semibold md:text-5xl">
                <StatCounter to={s.value} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/30 py-16">
        <div className="container grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl bg-card p-8 shadow-soft">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-secondary" />
              <h2 className="font-display text-2xl font-semibold">
                Top donors this month
              </h2>
            </div>
            <ol className="mt-6 space-y-3">
              {!globalStats?.topDonors || globalStats.topDonors.length === 0 ? (
                <li className="py-10 text-center text-sm text-muted-foreground italic bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  No donor data available yet.
                </li>
              ) : (
                globalStats.topDonors.map((donor: any, i: number) => (
                  <li
                    key={donor.name}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 animate-float-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-display text-base font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{donor.name}</p>
                      <p className="text-xs text-muted-foreground">{donor.area}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-semibold leading-none">{donor.meals.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">meals</p>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </div>

          <div className="rounded-3xl bg-card p-8 shadow-soft">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl font-semibold">
                Communities served
              </h2>
            </div>
            <ol className="mt-6 space-y-3">
              {!globalStats?.topRecipients || globalStats.topRecipients.length === 0 ? (
                <li className="py-10 text-center text-sm text-muted-foreground italic bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  Counting community impact...
                </li>
              ) : (
                globalStats.topRecipients.map((org: any, i: number) => (
                  <li
                    key={org.name}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 animate-float-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 font-display text-base font-semibold text-secondary">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.area}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-semibold leading-none">{org.meals.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">received</p>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Impact;
