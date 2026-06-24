import React, { useState, useEffect } from 'react';
import BrandStar from '../components/Brand';
import { getPublicStyleGuide } from './styleguideStore';

/* Public, read-only view of a style guide (share link: #/styleguides/view/<id>).
   Renders the design-system document as-is in an iframe — no editor, no auth. */
export default function StyleGuideView({ id }) {
  const [guide, setGuide] = useState(null); // null = loading, false = not found

  useEffect(() => {
    let active = true;
    getPublicStyleGuide(id).then((g) => { if (active) setGuide(g || false); });
    return () => { active = false; };
  }, [id]);

  if (guide === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#FBFCFE]">
        <div style={{ animation: 'qpulse 1.1s ease-in-out infinite' }}><BrandStar size={42} /></div>
        <style>{`@keyframes qpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.7}}`}</style>
      </div>
    );
  }
  if (guide === false) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FBFCFE] text-gray-500 gap-3">
        <BrandStar size={40} />
        <div className="text-sm">This shared style guide doesn’t exist or was removed.</div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 bg-white">
      <iframe title={guide.name || 'Style guide'} srcDoc={guide.content || ''}
              className="w-full h-full border-0" sandbox="allow-same-origin allow-scripts" />
    </div>
  );
}
