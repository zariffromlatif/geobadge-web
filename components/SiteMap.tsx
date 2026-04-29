"use client";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  Circle,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";

// Fix for default Leaflet icons in Next.js
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function SiteMap({
  onCoordsSelected,
}: {
  onCoordsSelected: (lat: number, lng: number) => void;
}) {
  const [pos, setPos] = useState<[number, number]>([23.8103, 90.4125]); // Default Dhaka

  function ClickHandler() {
    useMapEvents({
      click(e) {
        setPos([e.latlng.lat, e.latlng.lng]);
        onCoordsSelected(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  return (
    <MapContainer center={pos} zoom={13} className="h-full w-full rounded-xl">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler />
      <Marker position={pos} icon={icon} />
      <Circle
        center={pos}
        radius={100}
        pathOptions={{ color: "blue", fillColor: "blue", fillOpacity: 0.1 }}
      />
    </MapContainer>
  );
}
