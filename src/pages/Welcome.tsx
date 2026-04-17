import { Link } from "react-router-dom";
import { Leaf, ChefHat, Heart, Bike, ArrowRight, Sparkles } from "lucide-react";

const roles = [
  {
    id: "donor",
    icon: ChefHat,
    label: "I'm a Donor",
    description:
      "I have surplus food — from my restaurant, catering event, or home — and want to rescure it.",
    to: "/donor",
    accent: "from-orange-400 to-amber-500",
    glow: "shadow-[0_8px_40px_hsl(35_90%_55%/0.35)]",
    hoverRing: "hover:ring-amber-400/60",
    pill: "Restaurants · Caterers · Homes",
  },
  {
    id: "recipient",
    icon: Heart,
    label: "I'm a Recipient",
    description:
      "We're an orphanage, shelter, or community kitchen that needs nourishing meals for our people.",
    to: "/recipient",
    accent: "from-rose-400 to-pink-500",
    glow: "shadow-[0_8px_40px_hsl(345_85%_58%/0.35)]",
    hoverRing: "hover:ring-rose-400/60",
    pill: "Orphanages · Shelters · NGOs",
  },
  {
    id: "partner",
    icon: Bike,
    label: "I'm a Delivery Agent",
    description:
      "I can volunteer or deliver on my route, connecting donors to recipients across the city.",
    to: "/partner",
    accent: "from-emerald-400 to-teal-500",
    glow: "shadow-[0_8px_40px_hsl(160_70%_48%/0.35)]",
    hoverRing: "hover:ring-emerald-400/60",
    pill: "Volunteers · Partners · Couriers",
  },
];

const Welcome = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-10 h-56 w-56 rounded-full bg-secondary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-48 w-48 rounded-full bg-rose-400/10 blur-3xl" />

      {/* Logo */}
      <Link
        to="/"
        className="group mb-12 flex items-center gap-3 transition-opacity hover:opacity-80"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow">
          <Leaf className="h-6 w-6" />
        </span>
        <span className="font-display text-2xl font-semibold tracking-tight">
          FeedLoop
        </span>
      </Link>

      {/* Heading */}
      <div className="mb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
          <Sparkles className="h-3.5 w-3.5 text-secondary" />
          Now live in Hyderabad · Beta
        </span>
        <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl">
          Who are you joining as?
        </h1>
        <p className="mt-3 text-muted-foreground md:text-lg">
          Pick your role and we'll take you to the right place instantly.
        </p>
      </div>

      {/* Role cards */}
      <div className="grid w-full max-w-4xl gap-5 md:grid-cols-3">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <Link
              key={role.id}
              to={role.to}
              className={[
                "group relative flex flex-col rounded-3xl border border-border bg-card p-7 transition-all duration-300",
                "hover:-translate-y-1 hover:border-transparent",
                "ring-2 ring-transparent",
                role.hoverRing,
                role.glow.replace("shadow-", "hover:shadow-"),
              ].join(" ")}
            >
              {/* Icon bubble */}
              <span
                className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${role.accent} text-white shadow-sm`}
              >
                <Icon className="h-7 w-7" />
              </span>

              {/* Pill */}
              <span className="mb-3 inline-block rounded-full bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {role.pill}
              </span>

              <h2 className="font-display text-2xl font-semibold">
                {role.label}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {role.description}
              </p>

              {/* CTA arrow */}
              <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-primary">
                Get started
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>

              {/* Decorative gradient corner */}
              <div
                className={`pointer-events-none absolute right-5 top-5 h-20 w-20 rounded-full bg-gradient-to-br ${role.accent} opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-20`}
              />
            </Link>
          );
        })}
      </div>

      {/* Skip link */}
      <p className="mt-10 text-sm text-muted-foreground">
        Just browsing?{" "}
        <Link
          to="/landing"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Explore FeedLoop →
        </Link>
      </p>
    </div>
  );
};

export default Welcome;
