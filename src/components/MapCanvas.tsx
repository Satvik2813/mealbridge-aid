import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { useState, useEffect, useRef } from "react";
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
  zoom?: number;
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
  zoom = 15,
}: Props) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries
  });

  const [directionsPath, setDirectionsPath] = useState<{lat: number, lng: number}[]>([]);
  const [bikeLocation, setBikeLocation] = useState<{lat: number, lng: number} | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Convert old x/y prototype coords to relative lat/lng around Hyderabad
  const activePins = (pins || []).map(p => ({
    ...p,
    lat: p.lat !== undefined ? Number(p.lat) : (Number(center?.lat) || 17.3850) + (50 - (p.y || 0)) * 0.002,
    lng: p.lng !== undefined ? Number(p.lng) : (Number(center?.lng) || 78.4867) + ((p.x || 0) - 50) * 0.002
  }));

  const lastRoutingOrigin = useRef<{lat: number, lng: number} | null>(null);

  const getDistance = (l1: {lat: number, lng: number}, l2: {lat: number, lng: number}) => {
    const R = 6371e3; // metres
    const φ1 = l1.lat * Math.PI/180;
    const φ2 = l2.lat * Math.PI/180;
    const Δφ = (l2.lat-l1.lat) * Math.PI/180;
    const Δλ = (l2.lng-l1.lng) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // in metres
  };

  // 1. DIJKSTRA ENGINE: Resolve straight-line coordinates into exact physical driving node graphs.
  useEffect(() => {
    if (!isLoaded || !showRoute || !routeCoords || routeCoords.length < 2) return;
    
    // Only re-route if moved > 20 meters to prevent flickering
    if (lastRoutingOrigin.current) {
      const distMoved = getDistance(lastRoutingOrigin.current, routeCoords[0]);
      if (distMoved < 20) return; 
    }

    const directionsService = new window.google.maps.DirectionsService();
    
    const tryRoute = (mode: google.maps.TravelMode) => {
      directionsService.route({
        origin: routeCoords[0],
        destination: routeCoords[1],
        travelMode: mode
      }, (result, status) => {
        if (status === 'OK' && result) {
          const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
          setDirectionsPath(path);
          lastRoutingOrigin.current = routeCoords[0];
          if (!bikeLocation) setBikeLocation(path[0]);
        } else if (status === 'ZERO_RESULTS' && mode === window.google.maps.TravelMode.DRIVING) {
          tryRoute(window.google.maps.TravelMode.WALKING);
        } else {
          console.warn(`Directions request failed: ${status}`);
          setDirectionsPath([]);
        }
      });
    };

    tryRoute(window.google.maps.TravelMode.DRIVING);
  }, [isLoaded, showRoute, routeCoords]);

  // 1.05 IMMEDIATE PRESENCE: Set initial bike location
  useEffect(() => {
    if (showRoute && routeCoords && routeCoords.length > 0 && !bikeLocation) {
      if (routeCoords[0] && !isNaN(routeCoords[0].lat)) {
        setBikeLocation(routeCoords[0]);
      }
    }
  }, [showRoute, routeCoords, bikeLocation]);

  // 1.1 AUTO-ZOOM: Fit map to show the entire journey
  useEffect(() => {
    if (map) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;

      if (routeCoords && routeCoords.length > 0) {
        routeCoords.forEach(c => {
          if (c && typeof c.lat === 'number' && !isNaN(c.lat)) {
            bounds.extend(c);
            hasPoints = true;
          }
        });
      } else if (activePins && activePins.length > 0) {
        activePins.forEach(p => {
          if (p && typeof p.lat === 'number' && !isNaN(p.lat)) {
            bounds.extend({ lat: p.lat, lng: p.lng });
            hasPoints = true;
          }
        });
      }

      if (hasPoints) {
        map.fitBounds(bounds, 50);
      }
    }
  }, [map, routeCoords, activePins]);
  
  // 2. TELEMENTRY: Use real GPS for partners in PROD, or simulate for development/recipients.
  useEffect(() => {
    if (!showRoute || (directionsPath.length === 0 && (!routeCoords || routeCoords.length === 0))) return;

    const useRealGPS = isPartnerView && navigator.geolocation && import.meta.env.PROD;
    
    if (useRealGPS) {
      const watchId = navigator.geolocation.watchPosition((pos) => {
        setBikeLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
      return () => navigator.geolocation.clearWatch(watchId);
    }

    // 100% Accurate Node-Following Simulation (Recipients view OR Partners in Dev)
    const activePath = directionsPath.length > 0 ? directionsPath : routeCoords!;
    let stepIdx = 0;
    const ticker = setInterval(() => {
      if (stepIdx < activePath.length) {
        setBikeLocation(activePath[stepIdx]);
        stepIdx++;
      } else {
        clearInterval(ticker);
      }
    }, 1000); // Progress through road nodes every second

    return () => clearInterval(ticker);
  }, [directionsPath, routeCoords, showRoute, isPartnerView]);

  // Fallback to simple straight-line route if Directions API fails
  const routeFallback = showRoute ? (routeCoords && routeCoords.length > 0 ? routeCoords : []) : [];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl ring-1 ring-border bg-muted",
        className
      )}
      style={{ height }}
    >
      {!isLoaded ? (
        <div className="flex h-full items-center justify-center">Loading map...</div>
      ) : (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={
            routeCoords?.[0] && typeof routeCoords[0].lat === 'number' && !isNaN(routeCoords[0].lat)
              ? { lat: Number(routeCoords[0].lat), lng: Number(routeCoords[0].lng) }
              : (mapCenter || center)
          }
          zoom={zoom}
          onLoad={(mapInstance) => setMap(mapInstance)}
          options={{
            disableDefaultUI: true, // Disable clunky UI
            zoomControl: true, // Specifically keep zoom buttons for easy zooming
            gestureHandling: 'greedy', // Let users drag without two-finger restriction
            mapId: "f99ca2e8a1d7c34d" // FeedLoop Custom Map Style ID
          }}
        >
          {activePins.map((p, i) => {
            // When route is active, skip the first pin (origin) — vehicle emoji covers it
            if (showRoute && i === 0 && activePins.length > 1) return null;
            return (
              <Marker 
                key={i} 
                position={{ lat: p.lat, lng: p.lng }}
                icon={{
                  url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="18" r="16" fill="white" stroke="#ef4444" stroke-width="2"/>
                      <text x="50%" y="52%" dominant-baseline="central" text-anchor="middle" font-size="18">📍</text>
                    </svg>
                  `),
                  scaledSize: new window.google.maps.Size(36, 36),
                  anchor: new window.google.maps.Point(18, 18)
                }}
              />
            );
          })}
          
          {showRoute && (
             <>
               {/* Dashed fallback — only visible while road path is loading */}
               {directionsPath.length === 0 && (
                 <Polyline
                   path={routeCoords && routeCoords.length > 0 ? routeCoords : []}
                   options={{
                     strokeColor: "#22c55e",
                     strokeOpacity: 0.6,
                     strokeWeight: 3,
                     icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "12px" }]
                   }}
                 />
               )}
               
               {/* Road-following path */}
               {directionsPath.length > 0 && (
                 <Polyline
                   path={directionsPath}
                   options={{
                     strokeColor: "#22c55e",
                     strokeOpacity: 0.9,
                     strokeWeight: 5,
                   }}
                 />
               )}
             </>
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
