import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Leaf, ChefHat, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

const DonorLogin = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (user) navigate("/donor");
  }, [user, navigate]);

  const handleSuccess = (credentialResponse: { credential?: string }) => {
    login(credentialResponse);
    navigate("/donor");
  };

  const handleError = () => {
    console.error("Google Sign-In failed");
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-64 w-64 rounded-full bg-orange-400/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

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
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-4 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
          <ChefHat className="h-4 w-4" />
          Donor Sign-In
        </div>

        {/* Heading */}
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          Welcome, Food Hero! 🍽️
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sign in with your Google account to start donating surplus food and
          making a difference in your community.
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
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            useOneTap
            theme="outline"
            size="large"
            shape="pill"
            text="continue_with"
            logo_alignment="left"
          />
        </div>

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

export default DonorLogin;
