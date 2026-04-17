import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatCounter } from "@/components/StatCounter";
import { Heart, ChefHat, Bike, Leaf, Trophy, Building2 } from "lucide-react";

const Impact = () => {
  return (
    <div className="min-h-screen bg-background">
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
            { label: "Meals rescued", value: 184523, icon: Heart, hue: "primary" },
            { label: "Active donors", value: 1042, icon: ChefHat, hue: "secondary" },
            { label: "Partner deliveries", value: 28710, icon: Bike, hue: "accent" },
            { label: "kg CO₂ avoided", value: 92450, icon: Leaf, hue: "primary" },
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
              {[
                ["Spice Garden", "Banjara Hills", 1284],
                ["Paradise Catering", "Secunderabad", 982],
                ["Oberoi Wedding Hall", "Madhapur", 870],
                ["Karachi Bakery", "Mozamjahi", 612],
                ["Sharma Household", "Jubilee Hills", 240],
              ].map(([name, area, meals], i) => (
                <li
                  key={name as string}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-display text-base font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{area}</p>
                  </div>
                  <span className="font-display text-lg font-semibold">
                    {meals}
                  </span>
                  <span className="text-xs text-muted-foreground">meals</span>
                </li>
              ))}
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
              {[
                ["Sunshine Children's Home", "Kukatpally", 4820],
                ["Ashraya Night Shelter", "Charminar", 3640],
                ["Anand Old Age Home", "Begumpet", 2210],
                ["Hope Community Kitchen", "Gachibowli", 1985],
                ["Ananda Bal Sadan", "Secunderabad", 1402],
              ].map(([name, area, meals], i) => (
                <li
                  key={name as string}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 font-display text-base font-semibold text-secondary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{area}</p>
                  </div>
                  <span className="font-display text-lg font-semibold">
                    {meals.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground">meals</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Impact;
