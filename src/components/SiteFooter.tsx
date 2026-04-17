import { Leaf, Heart } from "lucide-react";

export const SiteFooter = () => {
  return (
    <footer className="border-t border-border/60 bg-muted/40">
      <div className="container grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-semibold">FeedLoop</span>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Built to rescue food. Built to feed lives. A real-time network
            connecting surplus to need across Hyderabad — and soon, all of India.
          </p>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold">Get involved</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Become a donor</li>
            <li>Register an orphanage</li>
            <li>Volunteer to deliver</li>
            <li>Corporate CSR program</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold">Hyderabad</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Banjara Hills · Kukatpally</li>
            <li>Madhapur · Gachibowli</li>
            <li>Secunderabad · Charminar</li>
            <li>hello@feedloop.in</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} FeedLoop. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Made with <Heart className="h-3.5 w-3.5 fill-secondary text-secondary" /> in Hyderabad
          </p>
        </div>
      </div>
    </footer>
  );
};
