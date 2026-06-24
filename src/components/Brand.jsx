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

/* Two-line wordmark: "UPQODE" (bold) with "design" beneath it (small, grey). */
export function BrandWordmark({ className = '' }) {
  return (
    <span className={`flex flex-col ${className}`}>
      <span className="font-bold text-gray-900 text-[15px] leading-none tracking-tight">UPQODE</span>
      <span className="text-[12px] font-normal text-gray-400 tracking-wide leading-none mt-px">design</span>
    </span>
  );
}
