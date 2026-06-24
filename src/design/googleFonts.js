/* ------------------------------------------------------------------ *
 *  Google Fonts — a curated list of families + a tiny on-demand loader.
 *  We don't hit the Google Fonts Developer API (needs a key); instead we
 *  ship a popular subset and lazily inject the css2 <link> for a family
 *  only when it's previewed or used. Unknown families simply no-op.
 * ------------------------------------------------------------------ */

export const GOOGLE_FONTS = [
  'Abel', 'Abril Fatface', 'Alegreya', 'Alegreya Sans', 'Anton', 'Archivo', 'Archivo Black', 'Archivo Narrow',
  'Arimo', 'Arvo', 'Asap', 'Assistant', 'Barlow', 'Barlow Condensed', 'Barlow Semi Condensed', 'Be Vietnam Pro',
  'Bebas Neue', 'Bitter', 'Bricolage Grotesque', 'Cabin', 'Cairo', 'Caveat', 'Chivo', 'Cinzel', 'Comfortaa',
  'Cormorant', 'Cormorant Garamond', 'Crimson Pro', 'Crimson Text', 'DM Mono', 'DM Sans', 'DM Serif Display',
  'DM Serif Text', 'Dancing Script', 'Dosis', 'EB Garamond', 'Epilogue', 'Exo', 'Exo 2', 'Figtree', 'Fira Code',
  'Fira Sans', 'Fjalla One', 'Frank Ruhl Libre', 'Gantari', 'Gasoek One', 'Gayathri', 'Geologica', 'Gelasio',
  'Geist', 'Geist Mono', 'General Sans', 'Genos', 'Gemunu Libre', 'Gloock', 'Golos Text', 'Gothic A1',
  'Hanken Grotesk', 'Heebo', 'Hind', 'Hind Madurai', 'Hind Siliguri', 'IBM Plex Mono', 'IBM Plex Sans',
  'IBM Plex Serif', 'Inconsolata', 'Instrument Sans', 'Instrument Serif', 'Inter', 'Inter Tight', 'JetBrains Mono',
  'Josefin Sans', 'Jost', 'Kanit', 'Karla', 'Kumbh Sans', 'Lato', 'League Spartan', 'Lexend', 'Libre Baskerville',
  'Libre Franklin', 'Lobster', 'Lora', 'Manrope', 'Marcellus', 'Martian Mono', 'Merriweather', 'Merriweather Sans',
  'Montserrat', 'Montserrat Alternates', 'Mukta', 'Mulish', 'Nanum Gothic', 'Newsreader', 'Noto Sans', 'Noto Serif',
  'Nunito', 'Nunito Sans', 'Old Standard TT', 'Onest', 'Open Sans', 'Oswald', 'Outfit', 'Overpass', 'Oxygen',
  'PT Sans', 'PT Serif', 'Pacifico', 'Petrona', 'Plus Jakarta Sans', 'Poppins', 'Prompt', 'Public Sans', 'Quicksand',
  'Raleway', 'Readex Pro', 'Recursive', 'Red Hat Display', 'Red Hat Text', 'Roboto', 'Roboto Condensed', 'Roboto Flex',
  'Roboto Mono', 'Roboto Serif', 'Roboto Slab', 'Rubik', 'Sora', 'Source Code Pro', 'Source Sans 3', 'Source Serif 4',
  'Space Grotesk', 'Space Mono', 'Spectral', 'Spline Sans', 'Syne', 'Tajawal', 'Teko', 'Titillium Web', 'Unbounded',
  'Urbanist', 'Varela Round', 'Vollkorn', 'Work Sans', 'Yantramanav', 'Yeseva One', 'Zilla Slab',
];

export const GOOGLE_FONTS_SET = new Set(GOOGLE_FONTS);

const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
export const firstFamily = (stack) => String(stack || '').split(',')[0].replace(/['"]/g, '').trim();

// Inject (once) the css2 stylesheet for a family into the given document. Only
// loads families we know are on Google Fonts; everything else is a safe no-op.
export function loadGoogleFont(family, targetDoc) {
  const fam = firstFamily(family);
  if (!fam || !GOOGLE_FONTS_SET.has(fam)) return;
  const d = targetDoc || (typeof document !== 'undefined' ? document : null);
  if (!d || !d.head) return;
  const id = 'dzgf-' + slug(fam);
  if (d.getElementById(id)) return;
  const link = d.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(fam).replace(/%20/g, '+') + ':ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap';
  d.head.appendChild(link);
}

// Ensure every Google font referenced by the style library is loaded in a doc.
export function ensureFontsLoaded(styles, targetDoc) {
  const fams = new Set();
  (styles?.text || []).forEach((s) => s.font && fams.add(firstFamily(s.font)));
  (styles?.link || []).forEach((s) => s.font && fams.add(firstFamily(s.font)));
  fams.forEach((f) => loadGoogleFont(f, targetDoc));
}
