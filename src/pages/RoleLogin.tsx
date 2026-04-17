import { useNavigate, useParams } from "react-router-dom";
import { Leaf, ChefHat, Heart, Bike, ShieldCheck } from "lucide-react";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const roleConfig = {
  donor: {
    icon: ChefHat,
    label: "Donor Sign-In",
    heading: "Welcome, Food Hero! 🍽️",
    description:
      "Sign in with Google to start donating surplus food and making a difference in your community.",
    badgeBg: "bg-amber-400/10",
    badgeText: "text-amber-600 dark:text-amber-400",
    accent: "from-orange-400 to-amber-500",
    redirectTo: "/donor",
  },
  recipient: {
    icon: Heart,
    label: "Recipient Sign-In",
    heading: "Welcome, Community Partner! 🤝",
    description:
      "Sign in with Google to request nourishing meals for your shelter, orphanage, or community kitchen.",
    badgeBg: "bg-rose-400/10",
    badgeText: "text-rose-600 dark:text-rose-400",
    accent: "from-rose-400 to-pink-500",
    redirectTo: "/recipient",
  },
  partner: {
    icon: Bike,
    label: "Delivery Agent Sign-In",
    heading: "Welcome, Road Warrior! 🚴",
    description:
      "Sign in with Google to start volunteering deliveries and connecting donors to those in need.",
    badgeBg: "bg-emerald-400/10",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-400 to-teal-500",
    redirectTo: "/partner",
  },
};

const RoleLogin = () => {
  const { role } = useParams<{ role: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const config =
    roleConfig[role as UserRole] ?? roleConfig.donor;
  const Icon = config.icon;

  // Already logged in → go straight to dashboard
  useEffect(() => {
    if (user) navigate(config.redirectTo, { replace: true });
  }, [user, navigate, config.redirectTo]);

  const handleGoogleLogin = async () => {
    // Store role so AuthCallback can pick it up after redirect
    localStorage.setItem("pendingRole", role ?? "donor");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) console.error("Google OAuth error:", error);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-0 h-48 w-48 rounded-full bg-rose-400/10 blur-3xl" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card p-10 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-[0_4px_20px_hsl(35_90%_55%/0.4)]">
            <Leaf className="h-6 w-6" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
            FeedLoop
          </span>
        </div>

        {/* Role Badge */}
        <div
          className={`mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${config.badgeBg} ${config.badgeText}`}
        >
          <Icon className="h-4 w-4" />
          {config.label}
        </div>

        {/* Heading */}
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          {config.heading}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {config.description}
        </p>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap gap-2">
          {["Secure & Private", "Takes 10 secs", "No passwords"].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground"
            >
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              {t}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">
            Continue with Google
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold shadow-sm transition-all hover:bg-muted hover:shadow-md active:scale-[0.98]"
        >
          {/* Google Logo SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing, you agree to FeedLoop's{" "}
          <span className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline">
            Terms of Service
          </span>{" "}
          &{" "}
          <span className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </span>
          .
        </p>
      </div>

      {/* Back link */}
      <button
        onClick={() => navigate("/")}
        className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
      >
        ← Back to role selection
      </button>
    </div>
  );
};

export default RoleLogin;
