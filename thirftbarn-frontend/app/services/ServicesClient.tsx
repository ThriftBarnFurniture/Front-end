// app/services/ServicesClient.tsx
"use client";

import { useMemo, useState } from "react";
import styles from "./services.module.css";
import { SERVICES, type ServiceId } from "./services";

import ServiceForm from "./components/ServiceForm";

// Forms
import MovingForm from "./components/forms/MovingForm";
import JunkForm from "./components/forms/JunkForm";
import AssemblyForm from "./components/forms/AssemblyForm";
import MarketplaceForm from "./components/forms/MarketplaceForm";
import DonationForm from "./components/forms/DonationForm";

export default function ServicesClient() {
  const [selected, setSelected] = useState<ServiceId>("moving");

  const ActiveInnerForm = useMemo(() => {
    switch (selected) {
      case "moving":
        return MovingForm;
      case "junk_removal":
        return JunkForm;
      case "furniture_assembly":
        return AssemblyForm;
      case "marketplace_pickup_delivery":
        return MarketplaceForm;
      case "donation_pickup":
        return DonationForm;
      default:
        return MovingForm;
    }
  }, [selected]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.h1}>Services</h1>
          <p className={styles.subhead}>
            Choose a service below and fill out the form to get started.
          </p>
        </header>

        {/* Horizontal service bar */}
        <section className={styles.serviceBar}>
          {SERVICES.map((service) => {
            const isActive = service.id === selected;

            return (
              <button
                key={service.id}
                type="button"
                className={`${styles.serviceCard} ${
                  isActive ? styles.serviceCardActive : ""
                }`}
                onClick={() => setSelected(service.id)}
                aria-selected={isActive}
              >
                <div className={styles.serviceImageWrap}>
                  <img
                    src={`/services/${service.id}.jpg`}
                    alt={service.title}
                    className={styles.serviceImage}
                    loading="lazy"
                  />
                </div>

                <div className={styles.serviceTitle}>{service.title}</div>
              </button>
            );
          })}
        </section>

        {/* Form */}
        <section className={styles.panel}>
          <div className={styles.panelCard}>
            <ServiceForm serviceId={selected}>
              <ActiveInnerForm serviceId={selected} />
            </ServiceForm>
          </div>
        </section>
      </div>
    </main>
  );
}
