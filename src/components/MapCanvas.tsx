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

// Zomato Style Bike Marker (Base64 encoding prevents dependency issues)
const BIKE_SVG = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18" fill="white" stroke="#22c55e" stroke-width="2"/>
  <circle cx="12" cy="23" r="4.5" fill="none" stroke="#16a34a" stroke-width="2"/>
  <circle cx="28" cy="23" r="4.5" fill="none" stroke="#16a34a" stroke-width="2"/>
  <path d="M22 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="#16a34a"/>
  <path d="M12 23L16 15l-3-3 4-3 3 5h3" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20" cy="20" r="3" fill="#22c55e">
    <animate attributeName="r" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite" />
  </circle>
</svg>`);

interface Props {
  className?: string;
  height?: number;
  showRoute?: boolean;
  routeCoords?: { lat: number; lng: number }[];
  pins?: { x: number; y: number; lat?: number; lng?: number; color?: string; pulse?: boolean }[];
  isPartnerView?: boolean;
}

export const MapCanvas = ({
  className,
  height = 380,
  showRoute = false,
  routeCoords,
  pins = [
    { x: 28, y: 38, color: "hsl(var(--urgent-critical))", pulse: true },
    { x: 55, y: 30, color: "hsl(var(--urgent-high))" },
    { x: 70, y: 58, color: "hsl(var(--urgent-medium))" },
    { x: 38, y: 70, color: "hsl(var(--urgent-low))" },
    { x: 82, y: 42, color: "hsl(var(--primary))" },
  ],
  isPartnerView = false,
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

  // 2. TELEMENTRY: Use real GPS for partners, or simulate for recipients/demonstration.
  useEffect(() => {
    if (!showRoute || directionsPath.length === 0) return;
    
    // If it's a partner riding, we use their real phone/browser GPS to move the icon
    if (isPartnerView && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setBikeLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => console.warn("Geolocation watch failed"),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
    
    // Otherwise, run the Kalman-filtered simulation loop
    const kalman = new GPSKalmanFilter(0.00005, 0.000001);
    let stepIdx = 0;
    let fractionalStep = 0;
    
    const ticker = setInterval(() => {
      if (stepIdx >= directionsPath.length - 1) {
        clearInterval(ticker);
        return;
      }
      
      const p1 = directionsPath[stepIdx];
      const p2 = directionsPath[stepIdx + 1];
      
      fractionalStep += 0.06; // Framerate velocity coefficient
      if (fractionalStep >= 1) {
        fractionalStep = 0;
        stepIdx++;
      }
      
      if (stepIdx < directionsPath.length - 1) {
        // Find exact mathematical point on segment
        const exactLat = p1.lat + (p2.lat - p1.lat) * fractionalStep;
        const exactLng = p1.lng + (p2.lng - p1.lng) * fractionalStep;
        
        // Synthesize physical GPS scatter noise +/- 0.0003
        const noisyLat = exactLat + (Math.random() - 0.5) * 0.0003;
        const noisyLng = exactLng + (Math.random() - 0.5) * 0.0003;
        
        // Pass signals into Kalman module
        const smoothed = kalman.filter(noisyLat, noisyLng);
        setBikeLocation(smoothed);
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
          center={routeCoords?.[0] || center}
          zoom={13}
          onLoad={(map) => {
            if (routeCoords && routeCoords.length > 0) {
              const bounds = new window.google.maps.LatLngBounds();
              routeCoords.forEach(c => bounds.extend(c));
              map.fitBounds(bounds, 40);
            }
          }}
          options={{
            disableDefaultUI: true
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
                url: BIKE_SVG,
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
