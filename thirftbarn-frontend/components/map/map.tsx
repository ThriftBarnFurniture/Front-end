'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { createCircularPinIcon, createCustomDivIcon, createImageIcon } from './customMarker';

interface MapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  logoUrl: string;
  storeName: string;
  storeAddress: string;
  markerStyle?: 'image' | 'custom' | 'circular';
}

const Map: React.FC<MapProps> = ({
  latitude,
  longitude,
  zoom = 15,
  logoUrl,
  storeName,
  storeAddress,
  markerStyle = 'circular',
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render on server side
  if (!isClient) {
    return (
      <div className="map-loading">
        <div className="map-loading-spinner"></div>
        <p>Loading map...</p>
      </div>
    );
  }

  // Choose marker style
  const getIcon = () => {
    switch (markerStyle) {
      case 'image':
        return createImageIcon(logoUrl, [50, 50]);
      case 'custom':
        return createCustomDivIcon(logoUrl);
      case 'circular':
      default:
        return createCircularPinIcon(logoUrl);
    }
  };

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="map-container"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={getIcon()}>
        <Popup>
          <div className="popup-content">
            <h3>{storeName}</h3>
            <p>{storeAddress}</p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="directions-link"
            >
              Get Directions
            </a>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default Map;