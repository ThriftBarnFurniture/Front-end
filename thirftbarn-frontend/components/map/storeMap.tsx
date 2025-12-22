'use client'; // Add this if using App Router

import { useEffect } from 'react';
import L from 'leaflet';
import styles from './storeMap.module.css';

// Fix for default markers not showing in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

interface StoreMapProps {
  latitude: number;
  longitude: number;
  storeName: string;
  storeAddress: string;
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  zoom?: number;
}

const StoreMap: React.FC<StoreMapProps> = ({
  latitude,
  longitude,
  storeName,
  storeAddress,
  logoUrl = '/images/company-logo.png',
  logoWidth = 40,
  logoHeight = 40,
  zoom = 15,
}) => {
  useEffect(() => {
    // Check if map is already initialized
    const container = L.DomUtil.get('store-map');
    if (container && (container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    // Initialize map
    const map = L.map('store-map').setView([latitude, longitude], zoom);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Create custom icon with company logo
    const customIcon = L.icon({
      iconUrl: logoUrl,
      iconSize: [logoWidth, logoHeight],
      iconAnchor: [logoWidth / 2, logoHeight],
      popupAnchor: [0, -logoHeight],
      className: styles.customMarker,
    });

    // Add marker with custom icon
    const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);

    // Add popup with store information
    marker.bindPopup(`
      <div style="text-align: center; padding: 10px;">
        <h3 style="margin: 0 0 8px 0; color: #333;">${storeName}</h3>
        <p style="margin: 0; color: #666; font-size: 14px;">${storeAddress}</p>
      </div>
    `);

    // Cleanup function
    return () => {
      map.remove();
    };
  }, [latitude, longitude, storeName, storeAddress, logoUrl, logoWidth, logoHeight, zoom]);

  return <div id="store-map" className={styles.mapContainer} />;
};

export default StoreMap;