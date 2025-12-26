'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

  const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={9}
      scrollWheelZoom={true}
      className="map-container" // Matches CSS now
      style={{ height: '100%', width: '100%' }} // Inline backup
    >
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

            {(phone || email) && (
              <div className="popup-section">
                <p className="popup-label">Contact</p>
                {phone && (
                  <p className="popup-text">
                    <a className="popup-link" href={`tel:${phone}`}>
                      {phone}
                    </a>
                  </p>
                )}
                {email && (
                  <p className="popup-text">
                    <a className="popup-link" href={`mailto:${email}`}>
                      {email}
                    </a>
                  </p>
                )}
              </div>
            )}

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
    </MapContainer>
  );
};

export default Map;