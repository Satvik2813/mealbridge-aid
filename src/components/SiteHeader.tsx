import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const links = [
  { to: "/landing", label: "Home" },
  { to: "/donor", label: "Donor" },
  { to: "/recipient", label: "Recipient" },
  { to: "/partner", label: "Partner" },
  { to: "/impact", label: "Impact" },
];

export const SiteHeader = () => {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            FeedLoop
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground",
                pathname === l.to && "bg-muted text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Button variant="ghost" size="sm" className="rounded-full" onClick={logout}>
              Log out
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/">Log in</Link>
            </Button>
          )}
          <Button asChild variant="default" size="sm" className="rounded-full">
            <Link to="/donor">Donate Food</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
