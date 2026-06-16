import React from 'react';

/* Qoders brand mark — a red 6-point asterisk star inside a soft circle */
export default function BrandStar({ size = 22, color = '#EF3B2D', bg = '#FDE7E4' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill={bg} />
      {[0, 60, 120].map((a) => (
        <rect key={a} x="10.8" y="4" width="2.4" height="16" rx="1.2" fill={color} transform={`rotate(${a} 12 12)`} />
      ))}
    </svg>
  );
}
