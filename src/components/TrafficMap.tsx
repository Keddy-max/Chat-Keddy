import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon as unknown as string,
    shadowUrl: iconShadow as unknown as string,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// The key provided by the user
const TOMTOM_API_KEY = (import.meta as any).env.VITE_TOMTOM_API_KEY || 'YhgzE0CFK6JmTRe7rcd1613y9K9Rtlv0';

// Component to update map center when location changes
function MapUpdater({ center }: { center: { lat: number, lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, map]);
  return null;
}

export default function TrafficMap({ center }: { center: { lat: number, lng: number } }) {
  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-zinc-800">
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={12} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* Base Map - TomTom */}
        <TileLayer
          attribution='&copy; <a href="https://www.tomtom.com/">TomTom</a>'
          url={`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`}
        />
        {/* Traffic Flow Layer - TomTom */}
        <TileLayer
          url={`https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`}
        />
        <MapUpdater center={center} />
        <Marker position={[center.lat, center.lng]}>
          <Popup>
            Current Location
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
