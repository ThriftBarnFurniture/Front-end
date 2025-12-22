'use client';

import { Icon, DivIcon } from 'leaflet';

export const createImageIcon = (logoUrl: string, size: [number, number] = [50, 50]) => {
  return new Icon({
    iconUrl: "/Icon-MapPin.svg",
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]], // Center bottom of the icon
    popupAnchor: [0, -size[1]], // Popup appears above the icon
  });
};

  // Option 2: Using HTML/CSS for more customization
export const createCustomDivIcon = (logoUrl: string) => {
return new DivIcon({
    className: 'custom-map-marker',
    html: `
    <div class="marker-container">
        <div class="marker-pin">
        <img src="${logoUrl}" alt="Store Location" class="marker-logo" />
        </div>
        <div class="marker-shadow"></div>
    </div>
    `,
    iconSize: [60, 75],
    iconAnchor: [30, 75],
    popupAnchor: [0, -75],
});
};

// Option 3: Circular logo with pin pointer
export const createCircularPinIcon = (logoUrl: string) => {
return new DivIcon({
    className: 'custom-circular-marker',
    html: `
    <div class="circular-marker-container">
        <div class="circular-pin">
        <img src="${logoUrl}" alt="Store Location" />
        </div>
        <div class="pin-pointer"></div>
    </div>
    `,
    iconSize: [56, 70],
    iconAnchor: [28, 70],
    popupAnchor: [0, -70],
});
};
