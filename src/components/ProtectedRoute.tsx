import { Navigate } from "react-router-dom";
import { useAuth, UserRole } from "@/context/AuthContext";
import { ReactNode } from "react";
import { Leaf } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole: UserRole;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  // Show a loader while Supabase session is hydrating
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white">
          <Leaf className="h-6 w-6" />
        </span>
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!user || role !== requiredRole) {
    return <Navigate to={`/login/${requiredRole}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
