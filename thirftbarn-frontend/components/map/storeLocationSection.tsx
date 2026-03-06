'use client';

import dynamic from 'next/dynamic';
import './storeLocationSection.css';
import Reveal from '../ui/Reveal';

const Map = dynamic(() => import('./map'), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">
      <p>Loading map...</p>
    </div>
  ),
});

interface StoreInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  hours: { days: string; time: string }[];
  coordinates: { lat: number; lng: number };
}

interface StoreLocationSectionProps {
  storeInfo: StoreInfo;
  logoUrl?: string;
}

const StoreLocationSection: React.FC<StoreLocationSectionProps> = ({
  storeInfo,
  logoUrl = '/Icon-MapPin.svg',
}) => {
  return (
    <section className="store-location-section" id="location">
      <div className="section-container">
        <div className="section-header">
          <Reveal>
          <h2 className="section-title">Visit Our Store.</h2>
          </Reveal>
          <Reveal delayMs={80}>
          <p className="section-subtitle">
            Come see us in person! We&apos;d love to help you find exactly what you&apos;re looking for.
          </p>
          </Reveal>
        </div>
        <Reveal delayMs={160}>
        <div className="map-wrapper">
          <Map
            latitude={storeInfo.coordinates.lat}
            longitude={storeInfo.coordinates.lng}
            zoom={15}
            logoUrl={logoUrl}
            storeName={storeInfo.name}
            addressLine1={storeInfo.address}
            addressLine2={storeInfo.city}
            phone={storeInfo.phone}
            email={storeInfo.email}
            hours={storeInfo.hours}
          />
        </div>
        </Reveal>
      </div>
    </section>
  );
};

export default StoreLocationSection;