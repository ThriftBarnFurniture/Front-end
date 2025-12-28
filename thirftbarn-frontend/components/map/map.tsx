'use client';

import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './map.css';

type StoreHours = { days: string; time: string };

interface MapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  logoUrl: string;
  storeName: string;
  addressLine1: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  hours?: StoreHours[];
}

const Map: React.FC<MapProps> = ({
  latitude,
  longitude,
  zoom = 9,
  logoUrl,
  storeName,
  addressLine1,
  addressLine2,
  phone,
  email,
  hours = [],
}) => {
  const markerIcon = useMemo(
    () =>
      L.icon({
        iconUrl: '/Icon-MapPin.svg',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
      }),
    []
  );
  const hqPinIcon = L.divIcon({
    className: '',
    html: `
      <div class="emoji-pin hq">
        <span>🏢</span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });

  const distPinIcon = L.divIcon({
    className: '',
    html: `
      <div class="emoji-pin dist">
        <span>📦</span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });




  const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  const secondaryLocations = [
    {
      name: 'Orléans',
      role: 'Headquarters',
      position: [45.4765, -75.5150],
      icon: hqPinIcon,
    },
    {
      name: 'Rockland',
      role: 'Head of Distribution',
      position: [45.5501, -75.2911],
      icon: distPinIcon,
    },
    {
      name: 'Carleton Place',
      role: 'Head of Distribution',
      position: [45.1334, -76.1405],
      icon: distPinIcon,
    },
    {
      name: 'Brockville',
      role: 'Head of Distribution',
      position: [44.5890, -75.6843],
      icon: distPinIcon,
    },
  ];

  function FitToMarkers({ points }: { points: [number, number][] }) {
    const map = useMap();

    useEffect(() => {
      if (!points.length) return;

      const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));

      map.fitBounds(bounds, {
        padding: [60, 60],     // space around edges
        maxZoom: 11,           // prevents zooming in too far
        animate: true,
      });
    }, [map, points]);

    return null;
  }

  const allPoints: [number, number][] = [
    [latitude, longitude], // main store
    ...secondaryLocations.map((l) => l.position as [number, number]),
  ];


  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={9}
      scrollWheelZoom={true}
      className="map-container"
      style={{ height: '100%', width: '100%' }}
    >
      <FitToMarkers points={allPoints} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <Marker position={[latitude, longitude]} icon={markerIcon}>
        <Popup maxWidth={300}>
          <div className="popup-content">
            <div className="popup-header">
              <img src={logoUrl} alt={`${storeName} logo`} className="popup-logo" />
              <h3>{storeName}</h3>
            </div>

            <div className="popup-section">
              <p className="popup-label">Address</p>
              <p className="popup-text">{addressLine1}, {addressLine2}</p>
            </div>
            {hours.length > 0 && (
              <div className="popup-section">
                <p className="popup-label">Hours</p>
                {hours.map((h, idx) => (
                  <div key={idx} className="popup-hours-row">
                    <span className="popup-hours-days">{h.days}</span>
                    <span className="popup-hours-time">{h.time}</span>
                  </div>
                ))}
              </div>
            )} 

            <a
              href={googleDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="directions-link"
            >
              Get Directions →
            </a>
          </div>
        </Popup>
      </Marker>
      {secondaryLocations.map((loc, idx) => (
        <Marker
          key={idx}
          position={loc.position as [number, number]}
          icon={loc.icon}
        >
          <Popup>
            <div className="popup-content">
              <h3>{loc.name}</h3>
              <p className="popup-text">{loc.role}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default Map;