# Advanced Usage & Customization

Ghid pentru utilizări avansate și personalizări ale Sitemap Builder.

---

## 🎨 Personalizare Design

### Schimbă Tema de Culori

Editează `SitemapBuilder.jsx` și înlocuiește clasele Tailwind:

#### Temă Dark Mode
```javascript
// Înlocuiește în componență:
// bg-white → bg-gray-900
// text-gray-800 → text-white
// border-gray-300 → border-gray-700

<div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
  <div className="bg-gray-800 rounded-lg shadow-md p-4">
    {/* ... */}
  </div>
</div>
```

#### Temă Neon
```javascript
<div className="min-h-screen bg-black p-6">
  <button className="px-4 py-2 bg-cyan-400 text-black rounded hover:bg-pink-400">
    {/* ... */}
  </button>
</div>
```

### Schimbă Icoane

```javascript
// Vor lucra cu orice icoane din lucide-react
import { 
  TreePine,      // Înlocuiește Plus
  Zap,           // Înlocuiește Download
  Archive,       // Înlocuiește Save
  MoreVertical   // Înlocuiește Trash2
} from 'lucide-react';

<button>
  <TreePine size={18} /> Add Root Page
</button>
```

### Schimbă Layout

```javascript
// Editează grid-uri
// 3 coloane: grid-cols-3 (default)
// 2 coloane: grid-cols-2
// 4 coloane: grid-cols-4

<div className="grid grid-cols-2 gap-6">
  {/* Sidebar e mai larg */}
</div>
```

---

## 🔧 Extensii Funcționale

### 1. Adaugă Undo/Redo

```javascript
import { useState } from 'react';

const SitemapBuilder = () => {
  const [nodes, setNodes] = useState([...]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const updateNodes = (newNodes) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newNodes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setNodes(newNodes);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setNodes(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setNodes(history[historyIndex + 1]);
    }
  };

  return (
    <div>
      <button onClick={undo}>↶ Undo</button>
      <button onClick={redo}>↷ Redo</button>
      {/* ... rest of component ... */}
    </div>
  );
};
```

### 2. Import din GA4

```javascript
const importFromGA4 = async (gaData) => {
  const nodes = [
    { id: '1', label: 'Home', url: '/', parentId: null }
  ];
  
  gaData.forEach((page, index) => {
    nodes.push({
      id: (index + 2).toString(),
      label: page.pagePath.replace('/', ''),
      url: page.pagePath,
      parentId: '1'
    });
  });
  
  setNodes(nodes);
};
```

### 3. Colaborație în Timp Real (Concept)

```javascript
import WebSocket from 'ws';

const SitemapBuilder = ({ userId }) => {
  const [nodes, setNodes] = useState([...]);

  useEffect(() => {
    const ws = new WebSocket('wss://your-server.com/sitemap');
    
    ws.onmessage = (event) => {
      const { type, data, userId: actorId } = JSON.parse(event.data);
      
      if (type === 'UPDATE' && actorId !== userId) {
        setNodes(data);
      }
    };

    return () => ws.close();
  }, [userId]);

  const broadcastUpdate = (newNodes) => {
    setNodes(newNodes);
    ws.send(JSON.stringify({
      type: 'UPDATE',
      data: newNodes,
      userId
    }));
  };

  return <SitemapBuilder />;
};
```

### 4. Template Library

```javascript
const TEMPLATES = {
  ecommerce: [
    { id: '1', label: 'Home', url: '/', parentId: null },
    { id: '2', label: 'Products', url: '/products', parentId: '1' },
    { id: '3', label: 'Categories', url: '/categories', parentId: '1' },
    { id: '4', label: 'Cart', url: '/cart', parentId: '1' },
    { id: '5', label: 'Checkout', url: '/checkout', parentId: '1' }
  ],
  blog: [
    { id: '1', label: 'Home', url: '/', parentId: null },
    { id: '2', label: 'Blog', url: '/blog', parentId: '1' },
    { id: '3', label: 'Categories', url: '/blog/categories', parentId: '2' },
    { id: '4', label: 'About', url: '/about', parentId: '1' }
  ]
};

const loadTemplate = (templateName) => {
  setNodes(TEMPLATES[templateName]);
};

<button onClick={() => loadTemplate('ecommerce')}>
  Load E-Commerce Template
</button>
```

### 5. Validare URL

```javascript
const validateUrl = (url) => {
  const regex = /^\/[a-z0-9\-\/]*$/;
  return regex.test(url);
};

const saveEdit = (nodeId) => {
  if (!validateUrl(editUrl)) {
    alert('Invalid URL format. Use /path/to/page');
    return;
  }
  // ... rest of save logic
};
```

---

## 🚀 Optimizări Performance

### 1. Memoization

```javascript
import { useMemo } from 'react';

const SitemapBuilder = () => {
  const [nodes, setNodes] = useState([...]);

  // Memorizează tree structure
  const tree = useMemo(() => {
    return buildTree();
  }, [nodes]);

  return <NodeItem node={tree} />;
};
```

### 2. Virtualization (Pentru siteuri mari)

```javascript
import { FixedSizeList } from 'react-window';

const NodeList = ({ nodes }) => (
  <FixedSizeList
    height={600}
    itemCount={nodes.length}
    itemSize={50}
    width="100%"
  >
    {({ index, style }) => (
      <NodeItem
        style={style}
        node={nodes[index]}
      />
    )}
  </FixedSizeList>
);
```

### 3. Debounce Auto-save

```javascript
import { useEffect, useRef } from 'react';

const SitemapBuilder = () => {
  const [nodes, setNodes] = useState([...]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem('sitemap-data', JSON.stringify(nodes));
    }, 1000); // Salvează după 1 secundă

    return () => clearTimeout(timeoutRef.current);
  }, [nodes]);
};
```

---

## 📊 Integrări

### 1. Export către Next.js Route Structure

```javascript
const exportToNextJs = () => {
  let routeConfig = 'export const routes = {\n';

  const traverse = (nodeId = null, indent = '') => {
    buildTree(nodeId).forEach(node => {
      routeConfig += `${indent}'${node.url}': '${node.label}',\n`;
      traverse(node.id, indent + '  ');
    });
  };

  traverse();
  routeConfig += '}';

  downloadFile(routeConfig, 'routes.js', 'text/javascript');
};
```

### 2. Sync cu Google Analytics

```javascript
const syncWithGA = async (propertyId) => {
  const response = await fetch(`/api/ga4-pages/${propertyId}`);
  const pages = await response.json();

  const newNodes = pages.map((page, i) => ({
    id: (i + 1).toString(),
    label: page.pagePath,
    url: page.pagePath,
    parentId: null
  }));

  setNodes(newNodes);
};
```

### 3. Export către Sitemap.xml

```javascript
const generateSitemapXml = () => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  const traverse = (parentId = null) => {
    buildTree(parentId).forEach(node => {
      xml += '<url>\n';
      xml += `  <loc>https://example.com${node.url}</loc>\n`;
      xml += '  <lastmod>' + new Date().toISOString() + '</lastmod>\n';
      xml += '  <priority>0.8</priority>\n';
      xml += '</url>\n';
      traverse(node.id);
    });
  };

  traverse();
  xml += '</urlset>';

  downloadFile(xml, 'sitemap.xml', 'application/xml');
};
```

---

## 🎯 Cas de Utilizare Avansate

### 1. Sitemap Builder SaaS

Creeaza o aplicație full-stack:

```
Frontend:
├── SitemapBuilder (React Component)
├── Dashboard
├── Team Collaboration
└── Sharing & Permissions

Backend:
├── User Authentication
├── Database (MongoDB/PostgreSQL)
├── Real-time Sync (WebSocket)
└── Export Pipelines
```

### 2. Plugin pentru WordPress

Expune componenta ca plugin:

```javascript
// Window.sitemapBuilder = SitemapBuilder;
// Loader script: <script src="sitemap-builder.js"></script>
// Usage: <div id="sitemap-root"></div>
```

### 3. Chrome Extension

Integreaza ca extension pentru a-și captura sitemapul direct din site:

```javascript
// Extrage links din pagina
const extractLinks = () => {
  const links = document.querySelectorAll('a');
  return Array.from(links).map(link => ({
    label: link.textContent,
    url: link.href
  }));
};
```

---

## 🧪 Testing

### Unit Tests

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import SitemapBuilder from './SitemapBuilder';

describe('SitemapBuilder', () => {
  it('renders initial home page', () => {
    render(<SitemapBuilder />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('adds new node', () => {
    render(<SitemapBuilder />);
    fireEvent.click(screen.getByText('Add Root Page'));
    expect(screen.getByText('New Page')).toBeInTheDocument();
  });

  it('deletes node', () => {
    render(<SitemapBuilder />);
    // ... test deletion logic
  });
});
```

---

## 📈 Analytics Integration

Urmăreste cum folosesc utilizatorii componenta:

```javascript
const trackAction = (action, data) => {
  gtag('event', action, {
    'sitemap_nodes': nodes.length,
    'action_type': action,
    'timestamp': new Date().toISOString(),
    ...data
  });
};

const handleAddNode = () => {
  addNode();
  trackAction('add_node', { depth: getCurrentDepth() });
};
```

---

## 🔒 Security

### Input Sanitization

```javascript
const sanitizeInput = (input) => {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 255);
};

const saveEdit = (nodeId) => {
  const sanitizedLabel = sanitizeInput(editLabel);
  const sanitizedUrl = sanitizeInput(editUrl);
  
  // ... save with sanitized values
};
```

---

## 📚 Resurse Suplimentare

- [Advanced React Patterns](https://www.patterns.dev/posts/render-props/)
- [Performance Optimization](https://react.dev/learn/render-and-commit)
- [Testing Library](https://testing-library.com/)
- [Tailwind Advanced](https://tailwindcss.com/docs/customization)

---

Succes în extinderea și customizarea Sitemap Builder! 🚀
