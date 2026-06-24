/* ------------------------------------------------------------------ */
/*  Starter templates — complete sitemaps with real inner pages         */
/*  Every page (home + inner pages) gets a full set of blocks.          */
/*  Each template exposes nodes() returning a fresh node array.         */
/* ------------------------------------------------------------------ */
import { uid } from '../projectStore';

const mkBlocks = (list) =>
  list.map(([name, color, frame]) => ({ id: uid(), name, color, frame: frame || 'bar', done: false, arrowTargets: [] }));

// every page is wrapped with a Header (top) and Footer (bottom)
const HEADER = ['Header', 'teal', 'text'];
const FOOTER = ['Footer', 'purple', 'cols4'];
const wrap = (content) => mkBlocks([HEADER, ...content, FOOTER]);

/*
 * build(root, sections)
 *  root     = { label, content?, children? }   (recursive page tree)
 *  sections = array of { label, content? }      (standalone SECTION pages)
 *  content  = array of [name, color, frame] block tuples (Header/Footer added automatically)
 */
function build(root, sections = []) {
  const nodes = [];
  const make = (item, parentId) => {
    const n = {
      id: uid(), label: item.label, parentId, group: 'main', color: 'blue', link: '', pageFrame: 'window',
      blocks: wrap(item.content || [['Content', 'blue', 'text']]),
    };
    nodes.push(n);
    (item.children || []).forEach((c) => make(c, n.id));
    return n;
  };
  make(root, null);
  sections.forEach((s) => nodes.push({
    id: uid(), label: s.label, parentId: null, group: 'section', color: 'blue', link: '', pageFrame: 'window',
    blocks: mkBlocks([['Content', 'slate', 'text'], ...(s.content || [])]),
  }));
  return nodes;
}

const COMMON_SECTIONS = [{ label: 'Cookies' }, { label: 'Privacy Policy' }, { label: '404 Error' }];

export const TEMPLATES = [
  /* 1 — Corporate Website */
  {
    id: 'corporate', name: 'Corporate Website',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Our services', 'blue', 'cols3'], ['Who we are', 'blue', 'media-text'], ['Stats', 'orange', 'cols4'], ['Latest news', 'blue', 'cards3'], ['CTA', 'red', 'banner']],
      children: [
        { label: 'About', content: [['Company story', 'blue', 'media-text'], ['Mission & values', 'blue', 'cols3'], ['Leadership', 'blue', 'cards3']], children: [
          { label: 'Team', content: [['Team grid', 'blue', 'cards3'], ['Open roles', 'blue', 'list']] },
          { label: 'History', content: [['Timeline', 'blue', 'text']] },
        ] },
        { label: 'Services', content: [['Services overview', 'blue', 'cols3'], ['Why us', 'blue', 'text-media']], children: [
          { label: 'Consulting', content: [['Intro', 'blue', 'media-text'], ['Process', 'blue', 'cols4']] },
          { label: 'Support', content: [['Plans', 'blue', 'cols3'], ['FAQ', 'blue', 'list']] },
        ] },
        { label: 'Case Studies', content: [['Featured cases', 'blue', 'cards3']], children: [{ label: 'Case study', content: [['Overview', 'blue', 'media-text'], ['Results', 'orange', 'cols3']] }] },
        { label: 'Blog', content: [['Featured post', 'blue', 'media-text'], ['Recent posts', 'blue', 'cards3']], children: [{ label: 'Article', content: [['Article body', 'blue', 'text'], ['Related', 'blue', 'cards3']] }] },
        { label: 'Careers', content: [['Open positions', 'blue', 'list'], ['Benefits', 'blue', 'cols3']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 2 — eCommerce Store */
  {
    id: 'ecommerce', name: 'eCommerce Store',
    nodes: () => build({
      label: 'Home',
      content: [['Hero image', 'red', 'banner'], ['Featured products', 'blue', 'cards3'], ['Shop by category', 'blue', 'cols4'], ['Best sellers', 'blue', 'cards3'], ['Newsletter', 'orange', 'banner']],
      children: [
        { label: 'Shop', content: [['Filters', 'blue', 'list'], ['Product grid', 'blue', 'cards3']], children: [
          { label: 'Category', content: [['Category banner', 'blue', 'banner'], ['Products', 'blue', 'cards3']], children: [
            { label: 'Product', content: [['Gallery', 'blue', 'media-text'], ['Description', 'blue', 'text'], ['Reviews', 'blue', 'list'], ['Related', 'blue', 'cards3']] },
          ] },
        ] },
        { label: 'Cart', content: [['Cart items', 'blue', 'list'], ['Order summary', 'orange', 'text']] },
        { label: 'Checkout', content: [['Shipping', 'blue', 'media-text'], ['Payment', 'blue', 'text'], ['Confirm', 'red', 'banner']] },
        { label: 'Account', content: [['Profile', 'blue', 'media-text']], children: [
          { label: 'Orders', content: [['Order history', 'blue', 'list']] },
          { label: 'Wishlist', content: [['Saved items', 'blue', 'cards3']] },
        ] },
        { label: 'About', content: [['Brand story', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Support form', 'blue', 'media-text']] },
      ],
    }, [{ label: 'Cookies' }, { label: 'Terms' }, { label: 'Shipping & Returns' }, { label: '404 Error' }]),
  },

  /* 3 — SaaS Website */
  {
    id: 'saas', name: 'SaaS Website',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Logos', 'blue', 'cols4'], ['Features', 'blue', 'cols3'], ['How it works', 'blue', 'media-text'], ['Pricing teaser', 'blue', 'cols3'], ['Testimonials', 'blue', 'cards3'], ['CTA', 'red', 'banner']],
      children: [
        { label: 'Features', content: [['Feature list', 'blue', 'cols3'], ['Deep dive', 'blue', 'text-media']] },
        { label: 'Pricing', content: [['Plans', 'blue', 'cols3'], ['Compare', 'blue', 'table'], ['FAQ', 'blue', 'list']] },
        { label: 'Integrations', content: [['Integration grid', 'blue', 'cards3']] },
        { label: 'Docs', content: [['Search', 'blue', 'banner'], ['Categories', 'blue', 'cols3']], children: [
          { label: 'Getting started', content: [['Guide', 'blue', 'text']] },
          { label: 'API reference', content: [['Endpoints', 'blue', 'list']] },
        ] },
        { label: 'Blog', content: [['Posts', 'blue', 'cards3']], children: [{ label: 'Article', content: [['Body', 'blue', 'text']] }] },
        { label: 'Login', content: [['Sign in form', 'blue', 'media-text']] },
        { label: 'Sign up', content: [['Register form', 'blue', 'media-text']] },
      ],
    }, [{ label: 'Cookies' }, { label: '404 Error' }]),
  },

  /* 4 — Personal Blog */
  {
    id: 'blog', name: 'Personal Blog',
    nodes: () => build({
      label: 'Home',
      content: [['Featured post', 'blue', 'media-text'], ['Recent posts', 'blue', 'cards3'], ['Categories', 'blue', 'cols4'], ['Newsletter', 'orange', 'banner']],
      children: [
        { label: 'Articles', content: [['Article list', 'blue', 'cards3']], children: [{ label: 'Article', content: [['Article body', 'blue', 'text'], ['Comments', 'blue', 'list'], ['Related', 'blue', 'cards3']] }] },
        { label: 'Categories', content: [['Category grid', 'blue', 'cols3']] },
        { label: 'About', content: [['Bio', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 5 — Online Courses */
  {
    id: 'courses', name: 'Online Courses',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Popular courses', 'blue', 'cards3'], ['Categories', 'blue', 'cols4'], ['How it works', 'blue', 'media-text'], ['Instructors', 'blue', 'cards3'], ['Testimonials', 'blue', 'text3']],
      children: [
        { label: 'Courses', content: [['Filters', 'blue', 'list'], ['Course grid', 'blue', 'cards3']], children: [
          { label: 'Course', content: [['Overview', 'blue', 'media-text'], ['Curriculum', 'blue', 'list'], ['Reviews', 'blue', 'list']], children: [{ label: 'Lesson', content: [['Video', 'blue', 'video'], ['Notes', 'blue', 'text']] }] },
        ] },
        { label: 'Instructors', content: [['Instructor grid', 'blue', 'cards3']] },
        { label: 'Pricing', content: [['Plans', 'blue', 'cols3']] },
        { label: 'Login', content: [['Sign in', 'blue', 'media-text']] },
        { label: 'Dashboard', content: [['My courses', 'blue', 'cards3'], ['Progress', 'orange', 'cols3']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 6 — Landing Page */
  {
    id: 'landing', name: 'Landing Page',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Benefits', 'blue', 'cols3'], ['Features', 'blue', 'media-text'], ['Social proof', 'blue', 'cards3'], ['Pricing', 'blue', 'cols3'], ['FAQ', 'blue', 'list'], ['Final CTA', 'red', 'banner']],
      children: [
        { label: 'Thank you', content: [['Confirmation', 'green', 'banner']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 7 — Creative Portfolio */
  {
    id: 'portfolio', name: 'Creative Portfolio',
    nodes: () => build({
      label: 'Home',
      content: [['Intro', 'orange', 'media-text'], ['Selected work', 'blue', 'cards3'], ['Services', 'blue', 'cols3'], ['Clients', 'blue', 'cols4']],
      children: [
        { label: 'Work', content: [['Project grid', 'blue', 'cards3']], children: [{ label: 'Project', content: [['Hero image', 'blue', 'banner'], ['Case study', 'blue', 'text'], ['Gallery', 'blue', 'cards3']] }] },
        { label: 'About', content: [['Bio', 'blue', 'media-text'], ['Skills', 'blue', 'cols3']] },
        { label: 'Services', content: [['Offerings', 'blue', 'cols3'], ['Process', 'blue', 'cols4']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 8 — Non-profit Organization */
  {
    id: 'nonprofit', name: 'Non-profit Organization',
    nodes: () => build({
      label: 'Home',
      content: [['Mission', 'orange', 'media-text'], ['Our programs', 'blue', 'cols3'], ['Impact', 'blue', 'cols4'], ['Donate', 'red', 'banner'], ['Stories', 'blue', 'cards3']],
      children: [
        { label: 'About', content: [['Story', 'blue', 'media-text'], ['Team', 'blue', 'cards3']] },
        { label: 'Programs', content: [['Programs list', 'blue', 'cols3']], children: [{ label: 'Program', content: [['Details', 'blue', 'media-text'], ['Results', 'orange', 'cols3']] }] },
        { label: 'Donate', content: [['Donation form', 'red', 'media-text'], ['Where it goes', 'blue', 'cols3']] },
        { label: 'Events', content: [['Upcoming events', 'blue', 'cards3']], children: [{ label: 'Event', content: [['Details', 'blue', 'media-text']] }] },
        { label: 'Volunteer', content: [['Opportunities', 'blue', 'list']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 9 — Event / Conference */
  {
    id: 'event', name: 'Event / Conference',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['About the event', 'blue', 'media-text'], ['Schedule', 'blue', 'text3'], ['Speakers', 'blue', 'cards3'], ['Sponsors', 'blue', 'cols4'], ['Tickets', 'orange', 'banner']],
      children: [
        { label: 'About', content: [['Overview', 'blue', 'media-text']] },
        { label: 'Schedule', content: [['Day 1', 'blue', 'list'], ['Day 2', 'blue', 'list']] },
        { label: 'Speakers', content: [['Speaker grid', 'blue', 'cards3']], children: [{ label: 'Speaker', content: [['Bio', 'blue', 'media-text']] }] },
        { label: 'Tickets', content: [['Ticket tiers', 'blue', 'cols3']] },
        { label: 'Venue', content: [['Location', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 10 — Medical / Clinic */
  {
    id: 'medical', name: 'Medical Clinic',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Our services', 'blue', 'cols3'], ['Why choose us', 'blue', 'media-text'], ['Our doctors', 'blue', 'cards3'], ['Book appointment', 'orange', 'banner']],
      children: [
        { label: 'About', content: [['Clinic story', 'blue', 'media-text'], ['Facilities', 'blue', 'cards3']] },
        { label: 'Services', content: [['Services list', 'blue', 'cols3']], children: [{ label: 'Service', content: [['Details', 'blue', 'media-text'], ['FAQ', 'blue', 'list']] }] },
        { label: 'Doctors', content: [['Doctor grid', 'blue', 'cards3']], children: [{ label: 'Doctor', content: [['Profile', 'blue', 'media-text']] }] },
        { label: 'Book Appointment', content: [['Booking form', 'orange', 'media-text']] },
        { label: 'Blog', content: [['Health tips', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 11 — Restaurant */
  {
    id: 'restaurant', name: 'Restaurant',
    nodes: () => build({
      label: 'Home',
      content: [['Hero image', 'red', 'banner'], ['About us', 'blue', 'media-text'], ['Signature dishes', 'blue', 'cards3'], ['Reservations', 'orange', 'banner'], ['Gallery', 'blue', 'cols4']],
      children: [
        { label: 'Menu', content: [['Starters', 'blue', 'list'], ['Mains', 'blue', 'list'], ['Desserts', 'blue', 'list'], ['Drinks', 'blue', 'list']] },
        { label: 'About', content: [['Our story', 'blue', 'media-text'], ['The chef', 'blue', 'text-media']] },
        { label: 'Reservations', content: [['Booking form', 'orange', 'media-text']] },
        { label: 'Gallery', content: [['Photo grid', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Find us', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 12 — Real Estate Agency */
  {
    id: 'realestate', name: 'Real Estate Agency',
    nodes: () => build({
      label: 'Home',
      content: [['Search hero', 'blue', 'banner'], ['Featured listings', 'blue', 'cards3'], ['Why us', 'blue', 'cols3'], ['Neighborhoods', 'blue', 'cols4'], ['Agents', 'blue', 'cards3']],
      children: [
        { label: 'Listings', content: [['Filters', 'blue', 'list'], ['Property grid', 'blue', 'cards3']], children: [{ label: 'Property', content: [['Gallery', 'blue', 'media-text'], ['Details', 'blue', 'table'], ['Map', 'blue', 'banner'], ['Contact agent', 'orange', 'media-text']] }] },
        { label: 'Agents', content: [['Agent grid', 'blue', 'cards3']], children: [{ label: 'Agent', content: [['Profile', 'blue', 'media-text'], ['Listings', 'blue', 'cards3']] }] },
        { label: 'About', content: [['Company', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 13 — Travel Agency */
  {
    id: 'travel', name: 'Travel Agency',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Popular destinations', 'blue', 'cards3'], ['Featured tours', 'blue', 'cols3'], ['Why book with us', 'blue', 'media-text'], ['Reviews', 'blue', 'text3']],
      children: [
        { label: 'Destinations', content: [['Destination grid', 'blue', 'cards3']], children: [{ label: 'Destination', content: [['Overview', 'blue', 'media-text'], ['Things to do', 'blue', 'cols3']] }] },
        { label: 'Tours', content: [['Tour list', 'blue', 'cards3']], children: [{ label: 'Tour', content: [['Itinerary', 'blue', 'list'], ['Pricing', 'orange', 'cols3'], ['Book now', 'red', 'banner']] }] },
        { label: 'About', content: [['Our story', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 14 — Fitness / Gym */
  {
    id: 'fitness', name: 'Fitness & Gym',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'red', 'banner'], ['Classes', 'blue', 'cols3'], ['Membership', 'blue', 'cols3'], ['Trainers', 'blue', 'cards3'], ['Join now', 'orange', 'banner']],
      children: [
        { label: 'Classes', content: [['Class schedule', 'blue', 'table']], children: [{ label: 'Class', content: [['Details', 'blue', 'media-text']] }] },
        { label: 'Membership', content: [['Plans', 'blue', 'cols3'], ['FAQ', 'blue', 'list']] },
        { label: 'Trainers', content: [['Trainer grid', 'blue', 'cards3']] },
        { label: 'About', content: [['Our gym', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 15 — Photography Studio */
  {
    id: 'photography', name: 'Photography Studio',
    nodes: () => build({
      label: 'Home',
      content: [['Hero gallery', 'blue', 'banner'], ['Portfolio', 'blue', 'cards3'], ['Services', 'blue', 'cols3'], ['About', 'orange', 'text-media']],
      children: [
        { label: 'Portfolio', content: [['Photo grid', 'blue', 'cards3']], children: [{ label: 'Album', content: [['Gallery', 'blue', 'banner']] }] },
        { label: 'Services', content: [['Packages', 'blue', 'cols3']] },
        { label: 'Pricing', content: [['Price list', 'blue', 'table']] },
        { label: 'About', content: [['Bio', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Booking form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 16 — Mobile App */
  {
    id: 'app', name: 'Mobile App',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Key features', 'blue', 'cols3'], ['How it works', 'blue', 'media-text'], ['Screenshots', 'blue', 'cards3'], ['Download', 'orange', 'banner'], ['Reviews', 'blue', 'text3']],
      children: [
        { label: 'Features', content: [['Feature list', 'blue', 'cols3']] },
        { label: 'Pricing', content: [['Plans', 'blue', 'cols3']] },
        { label: 'Support', content: [['Help center', 'blue', 'cols3'], ['FAQ', 'blue', 'list']] },
        { label: 'Blog', content: [['Posts', 'blue', 'cards3']] },
        { label: 'Download', content: [['App stores', 'orange', 'cols2']] },
      ],
    }, [{ label: 'Cookies' }, { label: '404 Error' }]),
  },

  /* 17 — News / Magazine */
  {
    id: 'news', name: 'News / Magazine',
    nodes: () => build({
      label: 'Home',
      content: [['Breaking', 'red', 'banner'], ['Top stories', 'blue', 'cards3'], ['Categories', 'blue', 'cols4'], ['Editor picks', 'blue', 'media-text'], ['Most read', 'blue', 'list']],
      children: [
        { label: 'World', content: [['Articles', 'blue', 'cards3']] },
        { label: 'Business', content: [['Articles', 'blue', 'cards3']] },
        { label: 'Technology', content: [['Articles', 'blue', 'cards3']], children: [{ label: 'Article', content: [['Body', 'blue', 'text'], ['Related', 'blue', 'cards3']] }] },
        { label: 'Sports', content: [['Articles', 'blue', 'cards3']] },
        { label: 'About', content: [['About us', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: 'Cookies' }, { label: 'Terms' }, { label: '404 Error' }]),
  },

  /* 18 — Careers / Job Board */
  {
    id: 'jobboard', name: 'Job Board',
    nodes: () => build({
      label: 'Home',
      content: [['Search hero', 'blue', 'banner'], ['Featured jobs', 'blue', 'cards3'], ['Categories', 'blue', 'cols4'], ['Top companies', 'blue', 'cards3'], ['For employers', 'orange', 'media-text']],
      children: [
        { label: 'Jobs', content: [['Filters', 'blue', 'list'], ['Job list', 'blue', 'list']], children: [{ label: 'Job', content: [['Description', 'blue', 'text'], ['Apply', 'orange', 'media-text']] }] },
        { label: 'Companies', content: [['Company grid', 'blue', 'cards3']], children: [{ label: 'Company', content: [['Profile', 'blue', 'media-text'], ['Open roles', 'blue', 'list']] }] },
        { label: 'For Employers', content: [['Pricing', 'blue', 'cols3'], ['Post a job', 'orange', 'banner']] },
        { label: 'About', content: [['About us', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 19 — Marketing Agency */
  {
    id: 'agency', name: 'Marketing Agency', tags: 'agency marketing branding advertising digital seo ads creative',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Services', 'blue', 'cols3'], ['Results', 'orange', 'cols4'], ['Case studies', 'blue', 'cards3'], ['Clients', 'blue', 'cols4'], ['CTA', 'red', 'banner']],
      children: [
        { label: 'Services', content: [['Service list', 'blue', 'cols3'], ['Process', 'blue', 'cols4']], children: [
          { label: 'SEO', content: [['Overview', 'blue', 'media-text'], ['Packages', 'blue', 'cols3']] },
          { label: 'Paid Ads', content: [['Overview', 'blue', 'media-text']] },
          { label: 'Branding', content: [['Overview', 'blue', 'media-text']] },
        ] },
        { label: 'Work', content: [['Case studies', 'blue', 'cards3']], children: [{ label: 'Case study', content: [['Challenge', 'blue', 'media-text'], ['Results', 'orange', 'cols3']] }] },
        { label: 'About', content: [['Story', 'blue', 'media-text'], ['Team', 'blue', 'cards3']] },
        { label: 'Blog', content: [['Posts', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 20 — Tech Startup */
  {
    id: 'startup', name: 'Tech Startup', tags: 'startup tech product launch investors venture innovation',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Problem', 'blue', 'media-text'], ['Solution', 'blue', 'text-media'], ['Features', 'blue', 'cols3'], ['Traction', 'orange', 'cols4'], ['CTA', 'red', 'banner']],
      children: [
        { label: 'Product', content: [['Overview', 'blue', 'media-text'], ['Features', 'blue', 'cols3']] },
        { label: 'Pricing', content: [['Plans', 'blue', 'cols3'], ['FAQ', 'blue', 'list']] },
        { label: 'About', content: [['Mission', 'blue', 'media-text'], ['Team', 'blue', 'cards3']] },
        { label: 'Investors', content: [['Pitch', 'blue', 'media-text'], ['Metrics', 'orange', 'cols4']] },
        { label: 'Careers', content: [['Open roles', 'blue', 'list']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: 'Cookies' }, { label: '404 Error' }]),
  },

  /* 21 — Podcast */
  {
    id: 'podcast', name: 'Podcast', tags: 'podcast audio episodes show host interview media',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Latest episodes', 'blue', 'cards3'], ['Subscribe', 'orange', 'cols4'], ['About the show', 'blue', 'media-text'], ['Reviews', 'blue', 'text3']],
      children: [
        { label: 'Episodes', content: [['Episode list', 'blue', 'list']], children: [{ label: 'Episode', content: [['Player', 'blue', 'video-center'], ['Show notes', 'blue', 'text'], ['Transcript', 'blue', 'text']] }] },
        { label: 'About', content: [['Hosts', 'blue', 'cards3'], ['Story', 'blue', 'media-text']] },
        { label: 'Guests', content: [['Guest grid', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Be a guest', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 22 — Coffee Shop */
  {
    id: 'cafe', name: 'Coffee Shop', tags: 'cafe coffee shop bakery food drinks local',
    nodes: () => build({
      label: 'Home',
      content: [['Hero image', 'orange', 'banner'], ['Our story', 'blue', 'media-text'], ['Menu highlights', 'blue', 'cards3'], ['Visit us', 'blue', 'media-text'], ['Gallery', 'blue', 'cols4']],
      children: [
        { label: 'Menu', content: [['Coffee', 'blue', 'list'], ['Food', 'blue', 'list'], ['Specials', 'orange', 'cards3']] },
        { label: 'About', content: [['Our story', 'blue', 'media-text'], ['The team', 'blue', 'cards3']] },
        { label: 'Locations', content: [['Find us', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 23 — Law Firm */
  {
    id: 'law', name: 'Law Firm', tags: 'law legal attorney lawyer firm practice justice',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'slate', 'banner'], ['Practice areas', 'blue', 'cols3'], ['Why us', 'blue', 'media-text'], ['Attorneys', 'blue', 'cards3'], ['Consultation', 'orange', 'banner']],
      children: [
        { label: 'Practice Areas', content: [['Areas list', 'blue', 'cols3']], children: [{ label: 'Practice area', content: [['Overview', 'blue', 'media-text'], ['FAQ', 'blue', 'list']] }] },
        { label: 'Attorneys', content: [['Attorney grid', 'blue', 'cards3']], children: [{ label: 'Attorney', content: [['Profile', 'blue', 'media-text']] }] },
        { label: 'Case Results', content: [['Results', 'orange', 'list']] },
        { label: 'About', content: [['Firm history', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 24 — Wedding */
  {
    id: 'wedding', name: 'Wedding', tags: 'wedding marriage event couple invitation rsvp celebration',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'pink', 'banner'], ['Our story', 'blue', 'media-text'], ['The big day', 'blue', 'cols3'], ['Gallery', 'blue', 'cols4'], ['RSVP', 'orange', 'banner']],
      children: [
        { label: 'Our Story', content: [['How we met', 'blue', 'media-text'], ['Timeline', 'blue', 'text']] },
        { label: 'Details', content: [['Ceremony', 'blue', 'media-text'], ['Reception', 'blue', 'media-text'], ['Schedule', 'blue', 'list']] },
        { label: 'Gallery', content: [['Photo grid', 'blue', 'cards3']] },
        { label: 'RSVP', content: [['RSVP form', 'pink', 'media-text']] },
        { label: 'Registry', content: [['Gift registry', 'blue', 'cards3']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 25 — Music / Band */
  {
    id: 'band', name: 'Music & Band', tags: 'music band artist musician album tour concert',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'fuchsia', 'banner'], ['Latest release', 'blue', 'media-text'], ['Tour dates', 'blue', 'list'], ['Videos', 'blue', 'cards3'], ['Newsletter', 'orange', 'banner']],
      children: [
        { label: 'Music', content: [['Discography', 'blue', 'cards3']], children: [{ label: 'Album', content: [['Tracklist', 'blue', 'list'], ['Player', 'blue', 'video-center']] }] },
        { label: 'Tour', content: [['Upcoming shows', 'blue', 'list']] },
        { label: 'Videos', content: [['Video grid', 'blue', 'cards3']] },
        { label: 'About', content: [['Bio', 'blue', 'media-text']] },
        { label: 'Store', content: [['Merch', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Booking', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 26 — Crypto / Web3 */
  {
    id: 'crypto', name: 'Crypto / Web3', tags: 'crypto web3 blockchain token nft defi wallet',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'indigo', 'banner'], ['How it works', 'blue', 'cols3'], ['Tokenomics', 'orange', 'cols4'], ['Roadmap', 'blue', 'text'], ['Partners', 'blue', 'cols4'], ['CTA', 'red', 'banner']],
      children: [
        { label: 'Product', content: [['Overview', 'blue', 'media-text'], ['Features', 'blue', 'cols3']] },
        { label: 'Tokenomics', content: [['Distribution', 'orange', 'cols4'], ['Utility', 'blue', 'cols3']] },
        { label: 'Roadmap', content: [['Milestones', 'blue', 'text']] },
        { label: 'Docs', content: [['Whitepaper', 'blue', 'text'], ['Guides', 'blue', 'cols3']] },
        { label: 'Community', content: [['Channels', 'blue', 'cols4']] },
      ],
    }, [{ label: 'Cookies' }, { label: 'Terms' }, { label: '404 Error' }]),
  },

  /* 27 — Hotel & Resort */
  {
    id: 'hotel', name: 'Hotel & Resort', tags: 'hotel resort booking rooms hospitality travel stay',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Check availability', 'orange', 'banner'], ['Rooms', 'blue', 'cards3'], ['Amenities', 'blue', 'cols4'], ['Gallery', 'blue', 'cols4'], ['Reviews', 'blue', 'text3']],
      children: [
        { label: 'Rooms', content: [['Room types', 'blue', 'cards3']], children: [{ label: 'Room', content: [['Gallery', 'blue', 'media-text'], ['Amenities', 'blue', 'cols3'], ['Book now', 'orange', 'banner']] }] },
        { label: 'Dining', content: [['Restaurants', 'blue', 'cards3']] },
        { label: 'Experiences', content: [['Activities', 'blue', 'cols3']] },
        { label: 'Offers', content: [['Special offers', 'orange', 'cards3']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 28 — Coaching / Consultant */
  {
    id: 'coaching', name: 'Coaching & Consultant', tags: 'coach coaching consultant mentor personal business advisor',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['How I help', 'blue', 'cols3'], ['About me', 'orange', 'media-text'], ['Programs', 'blue', 'cols3'], ['Testimonials', 'blue', 'cards3'], ['Book a call', 'red', 'banner']],
      children: [
        { label: 'About', content: [['My story', 'blue', 'media-text'], ['Approach', 'blue', 'cols3']] },
        { label: 'Services', content: [['Programs', 'blue', 'cols3']], children: [{ label: 'Program', content: [['Details', 'blue', 'media-text'], ['Pricing', 'orange', 'cols3']] }] },
        { label: 'Testimonials', content: [['Results', 'blue', 'cards3']] },
        { label: 'Blog', content: [['Posts', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Book a call', 'orange', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 29 — Veterinary Clinic */
  {
    id: 'vet', name: 'Veterinary Clinic', tags: 'vet veterinary pet animal clinic health care',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'green', 'banner'], ['Services', 'blue', 'cols3'], ['Why us', 'blue', 'media-text'], ['Our vets', 'blue', 'cards3'], ['Book a visit', 'orange', 'banner']],
      children: [
        { label: 'Services', content: [['Service list', 'blue', 'cols3']], children: [{ label: 'Service', content: [['Details', 'blue', 'media-text']] }] },
        { label: 'Our Team', content: [['Vet grid', 'blue', 'cards3']] },
        { label: 'Book Appointment', content: [['Booking form', 'orange', 'media-text']] },
        { label: 'Resources', content: [['Pet care tips', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 30 — Interior Design */
  {
    id: 'interior', name: 'Interior Design', tags: 'interior design home decor architecture studio furniture',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'orange', 'banner'], ['Featured projects', 'blue', 'cards3'], ['Services', 'blue', 'cols3'], ['About', 'blue', 'text-media'], ['Press', 'blue', 'cols4']],
      children: [
        { label: 'Projects', content: [['Project grid', 'blue', 'cards3']], children: [{ label: 'Project', content: [['Hero image', 'blue', 'banner'], ['Story', 'blue', 'text'], ['Gallery', 'blue', 'cards3']] }] },
        { label: 'Services', content: [['Offerings', 'blue', 'cols3'], ['Process', 'blue', 'cols4']] },
        { label: 'About', content: [['Studio', 'blue', 'media-text'], ['Team', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Start a project', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 31 — Construction Company */
  {
    id: 'construction', name: 'Construction Company', tags: 'construction building contractor architecture engineering renovation',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'orange', 'banner'], ['Services', 'blue', 'cols3'], ['Projects', 'blue', 'cards3'], ['Why us', 'blue', 'media-text'], ['Stats', 'orange', 'cols4'], ['Get a quote', 'red', 'banner']],
      children: [
        { label: 'Services', content: [['Service list', 'blue', 'cols3']], children: [{ label: 'Service', content: [['Details', 'blue', 'media-text']] }] },
        { label: 'Projects', content: [['Portfolio', 'blue', 'cards3']], children: [{ label: 'Project', content: [['Overview', 'blue', 'media-text'], ['Gallery', 'blue', 'cards3']] }] },
        { label: 'About', content: [['Company', 'blue', 'media-text'], ['Team', 'blue', 'cards3']] },
        { label: 'Contact', content: [['Request a quote', 'orange', 'media-text']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 32 — University / School */
  {
    id: 'school', name: 'University / School', tags: 'school university education college academic students campus',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Programs', 'blue', 'cols3'], ['Why study here', 'blue', 'media-text'], ['Campus life', 'blue', 'cards3'], ['Apply now', 'orange', 'banner']],
      children: [
        { label: 'Programs', content: [['Program list', 'blue', 'cols3']], children: [
          { label: 'Undergraduate', content: [['Courses', 'blue', 'list']] },
          { label: 'Graduate', content: [['Courses', 'blue', 'list']] },
        ] },
        { label: 'Admissions', content: [['How to apply', 'blue', 'cols3'], ['Tuition', 'blue', 'table'], ['FAQ', 'blue', 'list']] },
        { label: 'Campus Life', content: [['Housing', 'blue', 'media-text'], ['Clubs', 'blue', 'cards3']] },
        { label: 'About', content: [['About us', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 33 — Food Delivery */
  {
    id: 'fooddelivery', name: 'Food Delivery', tags: 'food delivery restaurant order takeout meals app',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'red', 'banner'], ['How it works', 'blue', 'cols3'], ['Popular restaurants', 'blue', 'cards3'], ['Cuisines', 'blue', 'cols4'], ['Get the app', 'orange', 'banner']],
      children: [
        { label: 'Restaurants', content: [['Filters', 'blue', 'list'], ['Restaurant grid', 'blue', 'cards3']], children: [{ label: 'Restaurant', content: [['Menu', 'blue', 'list'], ['Reviews', 'blue', 'list']] }] },
        { label: 'How It Works', content: [['Steps', 'blue', 'cols3']] },
        { label: 'For Restaurants', content: [['Partner with us', 'orange', 'media-text']] },
        { label: 'About', content: [['About us', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Support', 'blue', 'media-text']] },
      ],
    }, [{ label: 'Cookies' }, { label: '404 Error' }]),
  },

  /* 34 — Car Dealership */
  {
    id: 'car', name: 'Car Dealership', tags: 'car auto dealership vehicles sale automotive motors',
    nodes: () => build({
      label: 'Home',
      content: [['Search hero', 'blue', 'banner'], ['Featured cars', 'blue', 'cards3'], ['Browse by brand', 'blue', 'cols4'], ['Why us', 'blue', 'media-text'], ['Financing', 'orange', 'banner']],
      children: [
        { label: 'Inventory', content: [['Filters', 'blue', 'list'], ['Car grid', 'blue', 'cards3']], children: [{ label: 'Vehicle', content: [['Gallery', 'blue', 'media-text'], ['Specs', 'blue', 'table'], ['Contact dealer', 'orange', 'media-text']] }] },
        { label: 'Financing', content: [['Calculator', 'blue', 'media-text'], ['Apply', 'orange', 'banner']] },
        { label: 'Services', content: [['Service center', 'blue', 'cols3']] },
        { label: 'About', content: [['Dealership', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text'], ['Map', 'blue', 'banner']] },
      ],
    }, COMMON_SECTIONS),
  },

  /* 35 — Beauty Salon & Spa */
  {
    id: 'salon', name: 'Beauty Salon & Spa', tags: 'beauty salon spa hair nails wellness massage booking',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'pink', 'banner'], ['Services', 'blue', 'cols3'], ['About', 'blue', 'media-text'], ['Gallery', 'blue', 'cols4'], ['Book now', 'orange', 'banner']],
      children: [
        { label: 'Services', content: [['Service menu', 'blue', 'list'], ['Pricing', 'blue', 'table']], children: [{ label: 'Service', content: [['Details', 'blue', 'media-text']] }] },
        { label: 'Team', content: [['Stylists', 'blue', 'cards3']] },
        { label: 'Gallery', content: [['Photo grid', 'blue', 'cards3']] },
        { label: 'Book', content: [['Booking form', 'orange', 'media-text']] },
        { label: 'Contact', content: [['Find us', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 36 — Architecture Firm */
  {
    id: 'architecture', name: 'Architecture Firm', tags: 'architecture firm design buildings studio projects',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'slate', 'banner'], ['Selected works', 'blue', 'cards3'], ['Expertise', 'blue', 'cols3'], ['About', 'blue', 'text-media'], ['Awards', 'blue', 'cols4']],
      children: [
        { label: 'Projects', content: [['Project grid', 'blue', 'cards3']], children: [{ label: 'Project', content: [['Hero image', 'blue', 'banner'], ['Concept', 'blue', 'text'], ['Gallery', 'blue', 'cards3']] }] },
        { label: 'Studio', content: [['About', 'blue', 'media-text'], ['Team', 'blue', 'cards3']] },
        { label: 'Services', content: [['Services', 'blue', 'cols3']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: '404 Error' }]),
  },

  /* 37 — Pet Shop */
  {
    id: 'petshop', name: 'Pet Shop', tags: 'pet shop store animals supplies dogs cats ecommerce',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'green', 'banner'], ['Shop by pet', 'blue', 'cols4'], ['Featured products', 'blue', 'cards3'], ['Best sellers', 'blue', 'cards3'], ['Newsletter', 'orange', 'banner']],
      children: [
        { label: 'Shop', content: [['Filters', 'blue', 'list'], ['Product grid', 'blue', 'cards3']], children: [{ label: 'Product', content: [['Gallery', 'blue', 'media-text'], ['Description', 'blue', 'text'], ['Reviews', 'blue', 'list']] }] },
        { label: 'Cart', content: [['Cart items', 'blue', 'list'], ['Summary', 'orange', 'text']] },
        { label: 'Services', content: [['Grooming', 'blue', 'media-text'], ['Vet', 'blue', 'media-text']] },
        { label: 'About', content: [['About us', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, [{ label: 'Cookies' }, { label: 'Shipping & Returns' }, { label: '404 Error' }]),
  },

  /* 38 — Insurance Company */
  {
    id: 'insurance', name: 'Insurance Company', tags: 'insurance finance coverage policy claims protection quotes',
    nodes: () => build({
      label: 'Home',
      content: [['Hero', 'blue', 'banner'], ['Get a quote', 'orange', 'banner'], ['Coverage types', 'blue', 'cols3'], ['Why us', 'blue', 'media-text'], ['Trust', 'blue', 'cols4'], ['Testimonials', 'blue', 'text3']],
      children: [
        { label: 'Coverage', content: [['Coverage list', 'blue', 'cols3']], children: [
          { label: 'Auto', content: [['Overview', 'blue', 'media-text'], ['Get a quote', 'orange', 'banner']] },
          { label: 'Home', content: [['Overview', 'blue', 'media-text']] },
          { label: 'Life', content: [['Overview', 'blue', 'media-text']] },
        ] },
        { label: 'Claims', content: [['File a claim', 'blue', 'media-text'], ['FAQ', 'blue', 'list']] },
        { label: 'About', content: [['About us', 'blue', 'media-text']] },
        { label: 'Contact', content: [['Contact form', 'blue', 'media-text']] },
      ],
    }, COMMON_SECTIONS),
  },
];
