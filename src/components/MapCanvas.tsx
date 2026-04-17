import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 17.385044,
  lng: 78.486671 // Hyderabad
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface Props {
  className?: string;
  height?: number;
  showRoute?: boolean;
  pins?: { x: number; y: number; lat?: number; lng?: number; color?: string; pulse?: boolean }[];
}

export const MapCanvas = ({
  className,
  height = 380,
  showRoute = false,
  pins = [
    { x: 28, y: 38, color: "hsl(var(--urgent-critical))", pulse: true },
    { x: 55, y: 30, color: "hsl(var(--urgent-high))" },
    { x: 70, y: 58, color: "hsl(var(--urgent-medium))" },
    { x: 38, y: 70, color: "hsl(var(--urgent-low))" },
    { x: 82, y: 42, color: "hsl(var(--primary))" },
  ],
}: Props) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  // Convert old x/y prototype coords to relative lat/lng around Hyderabad
  const activePins = pins.map(p => ({
    ...p,
    lat: p.lat ?? center.lat + (50 - p.y) * 0.002,
    lng: p.lng ?? center.lng + (p.x - 50) * 0.002
  }));

  // Create a mock route based on old SVG prototype path coords
  const routePath = showRoute ? [
    { lat: center.lat + (50 - 78) * 0.002, lng: center.lng + (18 - 50) * 0.002 },
    center,
    { lat: center.lat + (50 - 22) * 0.002, lng: center.lng + (82 - 50) * 0.002 }
  ] : [];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl ring-1 ring-border bg-[hsl(var(--muted))]",
        className
      )}
      style={{ height }}
    >
      {!isLoaded ? (
        <div className="flex h-full items-center justify-center">Loading map...</div>
      ) : (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={13}
          options={{
            disableDefaultUI: true,
            styles: [
              { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
              { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
              { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
              { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
              { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
              { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
              { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
              { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
              { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
              { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
              { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
              { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
              { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
              { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
              { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
              { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
            ]
          }}
        >
          {activePins.map((p, i) => (
            <Marker key={i} position={{ lat: p.lat, lng: p.lng }} />
          ))}
          {showRoute && (
            <Polyline
              path={routePath}
              options={{
                strokeColor: "#f97316", // orange-500
                strokeOpacity: 0.8,
                strokeWeight: 4,
              }}
            />
          )}
        </GoogleMap>
      )}

      {/* Attribution corner */}
      <div className="absolute bottom-2 right-3 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur text-black/60 pointer-events-none">
        FeedLoop live map · Hyderabad
      </div>
    </div>
  );
};
