/* ------------------------------------------------------------------ */
/*  Starter templates — complete sitemaps with real inner pages         */
/*  Every page (home + inner pages) gets a full set of blocks.          */
/*  Each template exposes nodes() returning a fresh node array.         */
/* ------------------------------------------------------------------ */
import { uid } from './projectStore';

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
];
