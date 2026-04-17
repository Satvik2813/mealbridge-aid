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
    const handleCallback = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        console.error("Auth callback error:", error);
        navigate("/");
        return;
      }

      const pendingRole =
        (localStorage.getItem("pendingRole") as UserRole) || "donor";
      const { user } = session;

      // Upsert user into public.users with their selected role
      await upsertUserProfile(
        user.id,
        user.user_metadata?.full_name || user.email || "User",
        user.email || "",
        user.user_metadata?.avatar_url || "",
        pendingRole
      );

      // Persist role
      setRole(pendingRole);
      localStorage.removeItem("pendingRole");

      // Navigate to the correct dashboard
      navigate(DASHBOARD_MAP[pendingRole] || "/");
    };

    handleCallback();
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
