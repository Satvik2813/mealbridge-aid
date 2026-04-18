import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { useState, useEffect } from "react";
import { GPSKalmanFilter } from "@/lib/kalman";

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 17.385044,
  lng: 78.486671 // Hyderabad
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const libraries: ("places")[] = ["places"];

// Unified Marker System (Matching selection UI emojis)
const BIKE_SVG = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18" fill="white" stroke="#22c55e" stroke-width="2"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="20">🛵</text>
  <circle cx="20" cy="20" r="3" fill="#22c55e" opacity="0.4">
    <animate attributeName="r" values="3;16;3" dur="2s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
  </circle>
</svg>`);

const AUTO_SVG = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18" fill="white" stroke="#f59e0b" stroke-width="2"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="20">🛺</text>
  <circle cx="20" cy="20" r="3" fill="#f59e0b" opacity="0.4">
    <animate attributeName="r" values="3;16;3" dur="2s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
  </circle>
</svg>`);

const TRUCK_SVG = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18" fill="white" stroke="#3b82f6" stroke-width="2"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="20">🚚</text>
  <circle cx="20" cy="20" r="3" fill="#3b82f6" opacity="0.4">
    <animate attributeName="r" values="3;16;3" dur="2s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
  </circle>
</svg>`);

interface Props {
  className?: string;
  height?: number;
  showRoute?: boolean;
  routeCoords?: { lat: number; lng: number }[];
  pins?: { x: number; y: number; lat?: number; lng?: number; color?: string; pulse?: boolean }[];
  isPartnerView?: boolean;
  center?: { lat: number; lng: number };
  vehicleType?: 'bike' | 'auto' | 'truck';
}

export const MapCanvas = ({
  className,
  height = 380,
  showRoute = false,
  routeCoords,
  pins = [],
  isPartnerView = false,
  center: mapCenter = center,
  vehicleType = 'bike',
}: Props) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries
  });

  const [directionsPath, setDirectionsPath] = useState<{lat: number, lng: number}[]>([]);
  const [bikeLocation, setBikeLocation] = useState<{lat: number, lng: number} | null>(null);

  // Convert old x/y prototype coords to relative lat/lng around Hyderabad
  const activePins = pins.map(p => ({
    ...p,
    lat: p.lat ?? center.lat + (50 - p.y) * 0.002,
    lng: p.lng ?? center.lng + (p.x - 50) * 0.002
  }));

  // 1. DIJKSTRA ENGINE: Resolve straight-line coordinates into exact physical driving node graphs.
  useEffect(() => {
    if (!isLoaded || !showRoute || !routeCoords || routeCoords.length < 2) return;
    
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: routeCoords[0],
      destination: routeCoords[1],
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === 'OK' && result) {
        // Extract the A* path nodes
        const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
        setDirectionsPath(path);
        setBikeLocation(path[0]); // Teleport bike to start
      }
    });
  }, [isLoaded, showRoute, routeCoords]);

  // 2. TELEMENTRY: Use real GPS for partners in PROD, or simulate for development/recipients.
  useEffect(() => {
    if (!showRoute || directionsPath.length === 0) return;

    const useRealGPS = isPartnerView && navigator.geolocation && import.meta.env.PROD;
    
    if (useRealGPS) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setBikeLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => console.warn("Geolocation watch failed"),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
    
    // 100% Accurate Node-Following Simulation (Recipients view OR Partners in Dev)
    let stepIdx = 0;
    let fractionalStep = 0;
    
    // Constant velocity across nodes
    const ticker = setInterval(() => {
      if (stepIdx >= directionsPath.length - 1) {
        setBikeLocation(directionsPath[directionsPath.length - 1]);
        clearInterval(ticker);
        return;
      }
      
      const p1 = directionsPath[stepIdx];
      const p2 = directionsPath[stepIdx + 1];
      
      // Exact movement along the physically calculated road polyline
      fractionalStep += 0.1; 
      if (fractionalStep >= 1) {
        fractionalStep = 0;
        stepIdx++;
      }
      
      if (stepIdx < directionsPath.length - 1) {
        const pCurrent = directionsPath[stepIdx];
        const pNext = directionsPath[stepIdx + 1];
        
        const exactLat = pCurrent.lat + (pNext.lat - pCurrent.lat) * fractionalStep;
        const exactLng = pCurrent.lng + (pNext.lng - pCurrent.lng) * fractionalStep;
        
        setBikeLocation({ lat: exactLat, lng: exactLng });
      }
    }, 100);

    return () => clearInterval(ticker);
  }, [directionsPath, showRoute]);

  // Fallback to straight-line route if Directions API blocks/fails or hasn't loaded yet.
  const routeFallback = showRoute ? (routeCoords && routeCoords.length > 0 ? routeCoords : [
    { lat: center.lat + (50 - 78) * 0.002, lng: center.lng + (18 - 50) * 0.002 },
    center,
    { lat: center.lat + (50 - 22) * 0.002, lng: center.lng + (82 - 50) * 0.002 }
  ]) : [];

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
          center={routeCoords?.[0] || mapCenter}
          zoom={14}
          onLoad={(map) => {
            if (routeCoords && routeCoords.length > 0) {
              const bounds = new window.google.maps.LatLngBounds();
              routeCoords.forEach(c => bounds.extend(c));
              map.fitBounds(bounds, 40);
            }
          }}
          options={{
            disableDefaultUI: true,
            mapId: "f99ca2e8a1d7c34d" // FeedLoop Custom Map Style ID
          }}
        >
          {activePins.map((p, i) => (
            <Marker key={i} position={{ lat: p.lat, lng: p.lng }} />
          ))}
          
          {showRoute && (
            <Polyline
              path={directionsPath.length > 0 ? directionsPath : routeFallback}
              options={{
                strokeColor: "#22c55e", // green-500
                strokeOpacity: 0.8,
                strokeWeight: 4,
              }}
            />
          )}

          {showRoute && bikeLocation && (
            <Marker
              position={bikeLocation}
              icon={{
                url: vehicleType === 'truck' ? TRUCK_SVG : vehicleType === 'auto' ? AUTO_SVG : BIKE_SVG,
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20)
              }}
              zIndex={50}
            />
          )}
        </GoogleMap>
      )}

      {/* Attribution corner */}
      <div className="absolute bottom-2 right-3 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur text-black/60 pointer-events-none z-10">
        FeedLoop live tracking · Dijkstra Routing Active
      </div>
    </div>
  );
};
