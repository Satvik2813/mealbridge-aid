import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Leaf, Bell, Check, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useNotifications, useMarkNotificationRead, type Notification } from "@/hooks/useSupabaseData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

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
  const { data: notifications } = useNotifications(user?.id);
  const markReadMutation = useMarkNotificationRead();

  const unreadCount = notifications?.filter(n => !n.read).length || 0;
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
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative rounded-full">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-urgent-high animate-pulse" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 rounded-2xl" align="end">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {unreadCount} New
                      </span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-[300px]">
                    {notifications && notifications.length > 0 ? (
                      notifications.map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className={cn(
                            "flex flex-col items-start gap-1 p-4 cursor-pointer transition-colors",
                            !n.read && "bg-primary/5"
                          )}
                          onClick={() => !n.read && markReadMutation.mutate(n.id)}
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <span className={cn("text-xs font-semibold", !n.read ? "text-primary" : "text-foreground")}>
                              {n.title}
                            </span>
                            {!n.read && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary mt-1" />}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {n.body || n.message}
                          </p>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="flex h-32 flex-col items-center justify-center text-center p-4">
                        <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">All caught up!</p>
                      </div>
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" className="rounded-full" onClick={logout}>
                Log out
              </Button>
            </>
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
