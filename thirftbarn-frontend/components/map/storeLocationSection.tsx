'use client';

import dynamic from 'next/dynamic';
import './storeLocationSection.css';

// Dynamically import Map with no SSR (Leaflet requires window object)
const Map = dynamic(() => import('../map/map'), {
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
  hours: {
    days: string;
    time: string;
  }[];
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface StoreLocationSectionProps {
  storeInfo?: StoreInfo;
  logoUrl?: string;
}

const defaultStoreInfo: StoreInfo = {
  name: 'Your Store Name',
  address: '123 Main Street',
  city: 'New York, NY 10001',
  phone: '(555) 123-4567',
  email: 'hello@yourstore.com',
  hours: [
    { days: 'Monday - Friday', time: '9:00 AM - 8:00 PM' },
    { days: 'Saturday', time: '10:00 AM - 6:00 PM' },
    { days: 'Sunday', time: '12:00 PM - 5:00 PM' },
  ],
  coordinates: {
    lat: 40.7128, // New York City coordinates as default
    lng: -74.006,
  },
};

const StoreLocationSection: React.FC<StoreLocationSectionProps> = ({
  storeInfo = defaultStoreInfo,
  logoUrl = '/images/logo-pin.png', // Default logo path
}) => {
  const fullAddress = `${storeInfo.address}, ${storeInfo.city}`;

  return (
    <section className="store-location-section" id="location">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header">
          <h2 className="section-title">Visit Our Store</h2>
          <p className="section-subtitle">
            Come see us in person! We&apos;d love to help you find exactly what you&apos;re looking
            for.
          </p>
        </div>

        {/* Content Grid */}
        <div className="location-grid">
          {/* Map */}
          <div className="map-wrapper">
            <Map
              latitude={storeInfo.coordinates.lat}
              longitude={storeInfo.coordinates.lng}
              logoUrl={logoUrl}
              storeName={storeInfo.name}
              storeAddress={fullAddress}
              markerStyle="circular" // Options: 'image', 'custom', 'circular'
              zoom={15}
            />
          </div>

          {/* Store Info Card */}
          <div className="store-info-card">
            <h3 className="store-name">{storeInfo.name}</h3>

            {/* Address */}
            <div className="info-block">
              <div className="info-icon">📍</div>
              <div className="info-content">
                <h4>Address</h4>
                <p>{storeInfo.address}</p>
                <p>{storeInfo.city}</p>
              </div>
            </div>

            {/* Contact */}
            <div className="info-block">
              <div className="info-icon">📞</div>
              <div className="info-content">
                <h4>Contact</h4>
                <p>
                  <a href={`tel:${storeInfo.phone}`}>{storeInfo.phone}</a>
                </p>
                <p>
                  <a href={`mailto:${storeInfo.email}`}>{storeInfo.email}</a>
                </p>
              </div>
            </div>

            {/* Hours */}
            <div className="info-block">
              <div className="info-icon">🕐</div>
              <div className="info-content">
                <h4>Store Hours</h4>
                {storeInfo.hours.map((schedule, index) => (
                  <div key={index} className="hours-row">
                    <span className="days">{schedule.days}</span>
                    <span className="time">{schedule.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${storeInfo.coordinates.lat},${storeInfo.coordinates.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="directions-button"
            >
              Get Directions
              <span className="button-icon">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StoreLocationSection;