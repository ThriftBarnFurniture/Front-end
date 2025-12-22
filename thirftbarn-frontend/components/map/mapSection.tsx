import dynamic from 'next/dynamic';
import styles from './mapSection.module.css';

// Dynamically import map component to avoid SSR issues
const StoreMap = dynamic(() => import('./storeMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoader}>Loading map...</div>,
});

interface MapSectionProps {
  title?: string;
  subtitle?: string;
}

const MapSection: React.FC<MapSectionProps> = ({
  title = 'Visit Our Store',
  subtitle = 'Find us at our convenient location',
}) => {
  // Store location configuration
  const storeConfig = {
    latitude: 45.575748, // Replace with your store's latitude
    longitude: -74.623574, // Replace with your store's longitude
    storeName: 'Thrift Barn Furniture',
    storeAddress: '2786 ON-34, Hawkesbury, ON K6A 2R2',
    logoUrl: '/Icon-MapPin.svg',
    logoWidth: 50,
    logoHeight: 50,
    zoom: 16,
  };

  return (
    <section className={styles.mapSection}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        
        <div className={styles.mapWrapper}>
          <StoreMap {...storeConfig} />
          
          {/* Optional: Add store information card */}
          <div className={styles.infoCard}>
            <h3>Store Information</h3>
            <div className={styles.infoItem}>
              <strong>Address:</strong>
              <p>{storeConfig.storeAddress}</p>
            </div>
            <div className={styles.infoItem}>
              <strong>Hours:</strong>
              <p>Mon-Fri: 9:00 AM - 8:00 PM</p>
              <p>Sat-Sun: 10:00 AM - 6:00 PM</p>
            </div>
            <div className={styles.infoItem}>
              <strong>Contact:</strong>
              <p>Phone: (123) 456-7890</p>
              <p>Email: info@yourcompany.com</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MapSection;