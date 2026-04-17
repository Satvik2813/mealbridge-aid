import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth, UserRole } from "@/context/AuthContext";
import { upsertUserProfile } from "@/lib/userProfile";
import { Leaf } from "lucide-react";

const DASHBOARD_MAP: Record<UserRole, string> = {
  donor: "/donor",
  recipient: "/recipient",
  partner: "/partner",
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setRole } = useAuth();

  useEffect(() => {
    // Listen for the SIGNED_IN event — fires once Supabase has parsed the
    // #access_token hash (detectSessionFromUrl does the heavy lifting).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session) return;

      const pendingRole =
        (localStorage.getItem("pendingRole") as UserRole) || "donor";
      const { user } = session;

      // Upsert the user profile with their chosen role
      await upsertUserProfile(
        user.id,
        user.user_metadata?.full_name || user.email || "User",
        user.email || "",
        user.user_metadata?.avatar_url || "",
        pendingRole
      );

      // Persist role and clean up
      setRole(pendingRole);
      localStorage.removeItem("pendingRole");

      // Strip the token hash from the URL so it isn't left in the address bar
      window.history.replaceState(null, "", window.location.pathname);

      // Navigate to the correct dashboard
      navigate(DASHBOARD_MAP[pendingRole] || "/", { replace: true });
    });

    // Fallback: if session already exists (e.g. user refreshed this page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const pendingRole =
        (localStorage.getItem("pendingRole") as UserRole) || null;
      if (pendingRole) {
        // Still need to upsert + redirect
        upsertUserProfile(
          session.user.id,
          session.user.user_metadata?.full_name || session.user.email || "User",
          session.user.email || "",
          session.user.user_metadata?.avatar_url || "",
          pendingRole
        ).then(() => {
          setRole(pendingRole);
          localStorage.removeItem("pendingRole");
          navigate(DASHBOARD_MAP[pendingRole] || "/", { replace: true });
        });
      } else if (session.user) {
        // Already processed — just redirect using stored role
        const storedRole = (localStorage.getItem("userRole") as UserRole) || "donor";
        navigate(DASHBOARD_MAP[storedRole] || "/", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, setRole]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

      <div className="flex flex-col items-center gap-5">
        {/* Logo */}
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-[0_4px_20px_hsl(35_90%_55%/0.4)]">
          <Leaf className="h-7 w-7" />
        </span>

        {/* Spinner */}
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />

        <div className="text-center">
          <p className="font-display text-lg font-semibold">Signing you in…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Setting up your FeedLoop account
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;

