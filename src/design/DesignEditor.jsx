/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Undo2, Redo2, Save, ChevronDown as Caret, Type, Loader2, Plus, Play, Palette, Check,
} from 'lucide-react';
import BrandStar from '../components/Brand';
import { getMarkupProject, listMarkupVersions, markupFileUrl, saveMarkupPage, saveMarkupStyles, createMarkupPage, updateMarkupPage, duplicateMarkupPageFile, deleteMarkupPage } from '../markup/markupApi';
import { StylesPanel, ComponentsPanel, normalizeStyles, genStylesCss, seedTextStylesFromDoc, applyStyleGuideTheme, newTextStyle } from './designStyles';
import { listStyleGuides } from '../styleguide/styleguideStore';
import { apiGetStyleGuideTheme } from '../styleguide/styleguideApi';
import { ensureFontsLoaded } from './googleFonts';
import { DEVICES, USER_STYLE_ID, EDIT_STYLE_ID, INSERT_ITEMS, makeInsertEl, uid, ANIM_RUNTIME_ID, ANIM_RUNTIME, rgbToHex } from './designConsts';
import { attrStr, Inspector, Layers, ContextMenu, NamePrompt, PageSettingsModal, ReplacePageModal, NewPageModal, CreateModal } from './designInspector';

export default function DesignEditor({ id, onBack, embedded = false, styleguideId = '' }) {
  const [project, setProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [version, setVersion] = useState(null);
  const [page, setPage] = useState('');
  const [device, setDevice] = useState('desktop');
  const [loadingIframe, setLoadingIframe] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [, setSelTick] = useState(0);   // bump to re-render (value refresh)
  const [selSeq, setSelSeq] = useState(0);      // bumps only when a DIFFERENT element is selected (Inspector remount key)
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const [styles, setStyles] = useState({ colors: [], text: [], link: [] });
  const [insertOpen, setInsertOpen] = useState(false);
  const [ctx, setCtx] = useState(null); // right-click menu: { x, y } in app coords
  const [namePrompt, setNamePrompt] = useState(null); // { title, value, placeholder, resolve }
  const [compModal, setCompModal] = useState(null);    // create/move component: { mode, title, folders, ..., resolve }
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [pageSettings, setPageSettings] = useState(null); // page being edited in Settings modal
  const [replacePageFor, setReplacePageFor] = useState(null); // page being replaced (template chooser)
  const [reloadTick, setReloadTick] = useState(0); // force-reload the iframe for the same path
  const [preview, setPreview] = useState(false);   // play scroll animations in the canvas

  const iframeRef = useRef(null);
  const selRef = useRef(null);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const draggingRef = useRef(null);
  const keydownRef = useRef(() => {});
  const clipRef = useRef('');           // internal copy/paste buffer (element outerHTML)
  const ctxOpenRef = useRef(() => {});  // opens the context menu from inside the iframe
  const stylesRef = useRef(styles);
  const saveStylesTimer = useRef(null);
  const autoSaveTimer = useRef(null);   // debounced page auto-save
  const saveRef = useRef(null);         // always points at the latest save()
  const savingGuard = useRef(false);    // prevents overlapping saves
  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);
  const seedRef = useRef(() => {});
  const syncHandlesRef = useRef(() => {});   // (re)draw resize handles over the selected element
  const autoAppliedRef = useRef(false);          // guard: auto-apply linked guide only once
  const applyStyleGuideRef = useRef(null);       // late-bound to applyStyleGuide (defined below)
  stylesRef.current = styles;

  const toastMsg = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };
  // Pretty in-app name prompt (replaces window.prompt). Resolves to the string, or null if cancelled.
  const askName = (title, initial = '', placeholder = 'Name') => new Promise((resolve) => setNamePrompt({ title, value: initial, placeholder, resolve }));

  useEffect(() => {
    let on = true;
    Promise.all([getMarkupProject(id), listMarkupVersions(id)]).then(([p, vs]) => {
      if (!on) return;
      setProject(p); setVersions(vs || []); setStyles(normalizeStyles(p.styles));
      const latest = (vs || [])[(vs || []).length - 1] || null;
      setVersion(latest);
      setPage(latest && latest.type === 'zip' && (latest.pages || []).length ? latest.pages[0].path : '');
    }).catch(() => { if (on) setErr('Could not load this project.'); });
    return () => { on = false; };
  }, [id]);

  const editable = version && version.type === 'zip';
  const src = version && editable ? markupFileUrl(version.id, page) : '';

  const doc = () => { try { return iframeRef.current?.contentDocument || null; } catch { return null; } };
  const win = () => { try { return iframeRef.current?.contentWindow || null; } catch { return null; } };

  const snapshot = () => { const d = doc(); return d ? d.documentElement.outerHTML : null; };
  const pushUndo = useCallback(() => { const s = snapshot(); if (s == null) return; undoRef.current.push(s); if (undoRef.current.length > 40) undoRef.current.shift(); redoRef.current = []; }, []);
  const markDirty = () => {
    setDirty(true);
    // debounced auto-save — no need to press Save
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { if (saveRef.current) saveRef.current(); }, 1200);
  };

  const clearSelection = useCallback(() => {
    const d = doc(); if (d) d.querySelectorAll('[data-dz-selected]').forEach((el) => el.removeAttribute('data-dz-selected'));
    selRef.current = null; setSelSeq((s) => s + 1); setSelTick((t) => t + 1); syncHandlesRef.current();
  }, []);
  const select = useCallback((el) => {
    const d = doc(); if (!d || !el) return;
    const changed = el !== selRef.current;
    d.querySelectorAll('[data-dz-selected]').forEach((x) => x.removeAttribute('data-dz-selected'));
    el.setAttribute('data-dz-selected', '');
    if (el.tagName !== 'BODY' && el.tagName !== 'HTML') el.setAttribute('draggable', 'true'); // never drag the page root
    selRef.current = el;
    if (changed) setSelSeq((s) => s + 1);   // remount inspector only on a new element (keeps accordions open while editing)
    setSelTick((t) => t + 1); syncHandlesRef.current();
  }, []);

  /* ---- drag-to-resize handles (4 corners) drawn over the selected element inside the iframe ---- */
  const HANDLE_ID = '__dz_resize';
  const positionHandles = (ov, el) => {
    const r = el.getBoundingClientRect(); const w = el.ownerDocument.defaultView || window;
    ov.style.left = (r.left + w.scrollX) + 'px'; ov.style.top = (r.top + w.scrollY) + 'px'; ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px';
    const place = { nw: [-6, -6], ne: [r.width - 6, -6], sw: [-6, r.height - 6], se: [r.width - 6, r.height - 6] };
    Array.from(ov.children).forEach((h) => { const c = h.getAttribute('data-dz-handle'); if (place[c]) { h.style.left = place[c][0] + 'px'; h.style.top = place[c][1] + 'px'; } });
  };
  const startResize = (e, corner) => {
    e.preventDefault(); e.stopPropagation();
    const el = selRef.current; const d = doc(); if (!el || !d) return;
    pushUndo();
    const sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight;
    const fx = corner.includes('e') ? 1 : -1, fy = corner.includes('s') ? 1 : -1;
    const move = (ev) => {
      el.style.setProperty('width', Math.max(8, Math.round(sw + fx * (ev.clientX - sx))) + 'px', 'important');
      el.style.setProperty('height', Math.max(8, Math.round(sh + fy * (ev.clientY - sy))) + 'px', 'important');
      const ov = d.getElementById(HANDLE_ID); if (ov) positionHandles(ov, el);
    };
    const up = () => { d.removeEventListener('mousemove', move, true); d.removeEventListener('mouseup', up, true); markDirty(); setSelTick((t) => t + 1); };
    d.addEventListener('mousemove', move, true); d.addEventListener('mouseup', up, true);
  };
  const syncHandles = () => {
    const d = doc(); if (!d || !d.body) return;
    let ov = d.getElementById(HANDLE_ID);
    const el = selRef.current;
    if (!el || el === d.body || el.tagName === 'HTML') { if (ov) ov.remove(); return; }
    if (!ov) {
      ov = d.createElement('div'); ov.id = HANDLE_ID; ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;margin:0;padding:0;';
      ['nw', 'ne', 'sw', 'se'].forEach((corner) => {
        const h = d.createElement('div'); h.setAttribute('data-dz-handle', corner);
        h.style.cssText = 'position:absolute;width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid #473AE0;pointer-events:auto;box-shadow:0 1px 2px rgba(0,0,0,.25);cursor:' + ((corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize') + ';';
        h.addEventListener('mousedown', (e) => startResize(e, corner));
        ov.appendChild(h);
      });
      d.body.appendChild(ov);
    }
    positionHandles(ov, el);
  };
  syncHandlesRef.current = syncHandles;

  // Inject the project's design-system CSS into the page (kept on save so it renders standalone).
  const injectUserStyles = useCallback(() => {
    const d = doc(); if (!d || !d.head) return;
    let st = d.getElementById(USER_STYLE_ID);
    if (!st) { st = d.createElement('style'); st.id = USER_STYLE_ID; d.head.appendChild(st); }
    st.textContent = genStylesCss(stylesRef.current);
    ensureFontsLoaded(stylesRef.current, d);
  }, []);

  const onIframeLoad = useCallback(() => {
    setLoadingIframe(false);
    const d = doc(); if (!d) return;
    undoRef.current = []; redoRef.current = []; selRef.current = null;
    setTitle(d.title || '');
    let style = d.getElementById(EDIT_STYLE_ID);
    if (!style) {
      style = d.createElement('style'); style.id = EDIT_STYLE_ID;
      style.textContent = `[data-dz-hover]{outline:2px solid #93c5fd!important;outline-offset:-2px}
        [data-dz-selected]{outline:2px solid #473AE0!important;outline-offset:-2px}
        [data-dz-drop-before]{box-shadow:0 -3px 0 0 #473AE0 inset!important}
        [data-dz-drop-after]{box-shadow:0 3px 0 0 #473AE0 inset!important}`;
      d.head && d.head.appendChild(style);
    }
    const okBase = (t) => t && t.nodeType === 1 && !['HTML', 'BODY', 'SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK'].includes(t.tagName) && t.id !== EDIT_STYLE_ID && !(t.closest && t.closest('#__dz_resize'));
    const okTarget = (t) => okBase(t) && !(t.closest && t.closest('[data-dz-locked]')); // locked elements are not selectable by click/hover
    d.addEventListener('contextmenu', (e) => {
      const t = e.target; if (!okBase(t)) return; // allow right-click on locked too (to unlock)
      e.preventDefault(); t.removeAttribute('data-dz-hover'); select(t); ctxOpenRef.current(e.clientX, e.clientY);
    }, true);
    d.addEventListener('mouseover', (e) => { const t = e.target; if (okTarget(t) && t !== selRef.current) t.setAttribute('data-dz-hover', ''); }, true);
    d.addEventListener('mouseout', (e) => { const t = e.target; if (t && t.removeAttribute) t.removeAttribute('data-dz-hover'); }, true);
    d.addEventListener('click', (e) => {
      const t = e.target; if (!okTarget(t)) return;
      if (t.getAttribute && t.getAttribute('contenteditable') === 'true') return;
      e.preventDefault(); e.stopPropagation(); t.removeAttribute('data-dz-hover'); select(t);
    }, true);
    d.addEventListener('dblclick', (e) => {
      const t = e.target; if (!okTarget(t)) return; e.preventDefault();
      t.setAttribute('contenteditable', 'true'); t.removeAttribute('draggable'); t.focus();
      const stop = () => { t.removeAttribute('contenteditable'); if (t === selRef.current) t.setAttribute('draggable', 'true'); markDirty(); setSelTick((x) => x + 1); t.removeEventListener('blur', stop); };
      t.addEventListener('blur', stop);
    }, true);
    d.addEventListener('input', () => markDirty(), true);
    d.addEventListener('keydown', (e) => keydownRef.current(e), true);
    d.addEventListener('dragstart', (e) => { const t = selRef.current; if (t && (e.target === t || t.contains(e.target))) { draggingRef.current = t; e.dataTransfer.effectAllowed = 'move'; } }, true);
    d.addEventListener('dragover', (e) => {
      const drag = draggingRef.current; if (!drag) return; const t = e.target; if (!okTarget(t) || t === drag || drag.contains(t)) return; e.preventDefault();
      d.querySelectorAll('[data-dz-drop-before],[data-dz-drop-after]').forEach((x) => { x.removeAttribute('data-dz-drop-before'); x.removeAttribute('data-dz-drop-after'); });
      const r = t.getBoundingClientRect(); t.setAttribute(e.clientY < r.top + r.height / 2 ? 'data-dz-drop-before' : 'data-dz-drop-after', '');
    }, true);
    d.addEventListener('drop', (e) => {
      const drag = draggingRef.current; if (!drag) return; const t = e.target; if (!okTarget(t) || t === drag || drag.contains(t)) return; e.preventDefault();
      const before = t.hasAttribute('data-dz-drop-before');
      d.querySelectorAll('[data-dz-drop-before],[data-dz-drop-after]').forEach((x) => { x.removeAttribute('data-dz-drop-before'); x.removeAttribute('data-dz-drop-after'); });
      pushUndo(); t.parentNode.insertBefore(drag, before ? t : t.nextSibling); draggingRef.current = null; markDirty(); setSelTick((x) => x + 1); syncHandlesRef.current();
    }, true);
    d.addEventListener('dragend', () => { d.querySelectorAll('[data-dz-drop-before],[data-dz-drop-after]').forEach((x) => { x.removeAttribute('data-dz-drop-before'); x.removeAttribute('data-dz-drop-after'); }); draggingRef.current = null; syncHandlesRef.current(); }, true);
    injectUserStyles();
    seedRef.current();
    // First open of a design that has a chosen style guide (from the project link OR the
    // "New design" picker, stored per-id): auto-apply it so the assets (Text, Colors,
    // Buttons) are ready without a manual "Apply".
    let pendingSg = styleguideId;
    try { if (!pendingSg) pendingSg = localStorage.getItem('qoders-design-sg-' + id) || ''; } catch (e) {}
    if (pendingSg && !autoAppliedRef.current && !(stylesRef.current && stylesRef.current.styleguideId)) {
      autoAppliedRef.current = true;
      try { localStorage.removeItem('qoders-design-sg-' + id); } catch (e) {}
      setTimeout(() => { applyStyleGuideRef.current && applyStyleGuideRef.current(pendingSg); }, 0);
    }
  }, [pushUndo, select, injectUserStyles, styleguideId]);

  // Re-generate the design-system CSS in the page whenever styles change.
  useEffect(() => { injectUserStyles(); }, [styles, injectUserStyles]);
  // re-place resize handles when the canvas width changes (device) or the page (re)loads
  useEffect(() => { const t = setTimeout(() => syncHandlesRef.current(), 60); return () => clearTimeout(t); }, [device, loadingIframe]);

  // Preview mode: play reveal-on-scroll animations on the LIVE DOM (keeps unsaved edits).
  const togglePreview = () => {
    const d = doc(); if (!d || !d.body) return;
    if (!preview) {
      clearSelection();
      if (!d.getElementById(ANIM_RUNTIME_ID)) { const s = d.createElement('script'); s.id = ANIM_RUNTIME_ID; s.textContent = ANIM_RUNTIME; d.body.appendChild(s); }
      setPreview(true);
    } else { clearPreviewDom(); setPreview(false); }
  };

  /* mutations */
  // Per-element edits use !important so they override tag-bound design-system styles
  // (which are themselves !important to beat the imported site's CSS).
  const applyStyle = (prop, value) => { const el = selRef.current; if (!el) return; pushUndo(); if (value === '' || value == null) el.style.removeProperty(prop); else el.style.setProperty(prop, value, 'important'); markDirty(); setSelTick((t) => t + 1); syncHandlesRef.current(); };
  const setText = (value) => { const el = selRef.current; if (!el) return; pushUndo(); el.textContent = value; markDirty(); setSelTick((t) => t + 1); syncHandlesRef.current(); };
  const setAttr = (name, value) => { const el = selRef.current; if (!el) return; pushUndo(); if (value) el.setAttribute(name, value); else el.removeAttribute(name); markDirty(); setSelTick((t) => t + 1); };
  // Link any element: edit <a> href directly, or wrap a non-anchor (e.g. an image) in an <a>; clearing the URL unwraps a wrapper we created.
  const setLink = (rawUrl) => {
    const el = selRef.current; if (!el) return;
    const url = (rawUrl || '').trim();
    const parent = el.parentElement;
    const linkEl = el.tagName === 'A' ? el : (parent && parent.tagName === 'A' ? parent : null);
    pushUndo();
    if (url) {
      if (linkEl) linkEl.setAttribute('href', url);
      else { const a = el.ownerDocument.createElement('a'); a.setAttribute('href', url); a.setAttribute('data-dz-link-wrap', ''); el.parentNode.insertBefore(a, el); a.appendChild(el); }
    } else if (linkEl) {
      if (linkEl !== el && linkEl.hasAttribute('data-dz-link-wrap') && linkEl.childElementCount === 1) { linkEl.parentNode.insertBefore(el, linkEl); linkEl.remove(); }
      else linkEl.removeAttribute('href');
    }
    markDirty(); setSelTick((t) => t + 1);
  };
  // Toggle "open in new tab" on the link element (adds rel for safety).
  const setLinkTarget = (newTab) => {
    const el = selRef.current; if (!el) return;
    const parent = el.parentElement;
    const linkEl = el.tagName === 'A' ? el : (parent && parent.tagName === 'A' ? parent : null);
    if (!linkEl) return;
    pushUndo();
    if (newTab) { linkEl.setAttribute('target', '_blank'); linkEl.setAttribute('rel', 'noopener noreferrer'); }
    else { linkEl.removeAttribute('target'); if (linkEl.getAttribute('rel') === 'noopener noreferrer') linkEl.removeAttribute('rel'); }
    markDirty(); setSelTick((t) => t + 1);
  };
  const moveSel = (dir) => { const el = selRef.current; if (!el || isBody(el)) return; const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling; if (!sib) return; pushUndo(); if (dir < 0) el.parentNode.insertBefore(el, sib); else el.parentNode.insertBefore(sib, el); markDirty(); setSelTick((t) => t + 1); };
  const duplicateSel = () => { const el = selRef.current; if (!el || isBody(el)) return; pushUndo(); const c = el.cloneNode(true); c.removeAttribute('data-dz-selected'); el.parentNode.insertBefore(c, el.nextSibling); markDirty(); select(c); };
  // Insert a new element (text / frame / stack / grid / masonry / image / video) into the
  // selected container (or the body) and select it. Text elements enter inline edit at once.
  const insertEl = (type) => {
    const d = doc(); if (!d || !d.body) return;
    pushUndo();
    const el = makeInsertEl(d, type);
    const cur = selRef.current;
    const container = cur && !['IMG', 'VIDEO', 'INPUT', 'BR', 'HR'].includes(cur.tagName) ? cur : d.body;
    container.appendChild(el);
    markDirty(); select(el);
    try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
    if (type === 'text') {
      el.setAttribute('contenteditable', 'true'); el.removeAttribute('draggable'); el.focus();
      try { const r = d.createRange(); r.selectNodeContents(el); const s = win().getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
      const stop = () => { el.removeAttribute('contenteditable'); if (el === selRef.current) el.setAttribute('draggable', 'true'); markDirty(); setSelTick((x) => x + 1); el.removeEventListener('blur', stop); };
      el.addEventListener('blur', stop);
    }
    setInsertOpen(false);
  };

  /* ---- right-click context-menu actions (operate on the selected element) ---- */
  const isBody = (el) => !el || el === doc()?.body || el.tagName === 'BODY';
  // Select the page root (BODY) to edit page-global styles (background, base typography, etc.).
  const selectBody = () => { const d = doc(); if (d && d.body) { select(d.body); try { d.body.scrollIntoView({ block: 'start' }); } catch (e) {} } };
  const selectParent = () => { const el = selRef.current; const p = el && el.parentElement; if (p && !isBody(p)) select(p); };
  const selectTopParent = () => { let el = selRef.current; if (!el) return; while (el.parentElement && !isBody(el.parentElement)) el = el.parentElement; select(el); };
  const selectFirstChild = () => { const el = selRef.current; const c = el && Array.from(el.children).find((x) => x.nodeType === 1); if (c) select(c); };
  const selectFirstText = () => { const el = selRef.current; if (!el) return; const t = Array.from(el.querySelectorAll('*')).find((x) => x.children.length === 0 && (x.textContent || '').trim()); if (t) select(t); };
  const fitContent = () => { const el = selRef.current; if (!el) return; pushUndo(); el.style.setProperty('width', 'fit-content'); el.style.setProperty('height', 'fit-content'); markDirty(); setSelTick((t) => t + 1); };
  const copyEl = () => { const el = selRef.current; if (!el) return; const c = el.cloneNode(true); ['data-dz-selected', 'data-dz-hover', 'draggable', 'contenteditable'].forEach((a) => c.removeAttribute(a)); clipRef.current = c.outerHTML; };
  const pasteEl = () => { const el = selRef.current; const d = doc(); if (!clipRef.current || !d) return; pushUndo(); const tmp = d.createElement('div'); tmp.innerHTML = clipRef.current; const node = tmp.firstElementChild; if (!node) return; const target = el && !isBody(el) ? el.parentNode : d.body; const ref = el && !isBody(el) ? el.nextSibling : null; target.insertBefore(node, ref); markDirty(); select(node); };
  const renameEl = async () => { const el = selRef.current; if (!el) return; const cur = el.getAttribute('data-dz-name') || ''; const n = await askName('Rename layer', cur, 'Layer name'); if (n == null) return; pushUndo(); if (n.trim()) el.setAttribute('data-dz-name', n.trim()); else el.removeAttribute('data-dz-name'); markDirty(); setSelTick((t) => t + 1); };
  const autoRenameEl = () => { const el = selRef.current; if (!el) return; pushUndo(); el.removeAttribute('data-dz-name'); markDirty(); setSelTick((t) => t + 1); };
  const toggleLock = () => { const el = selRef.current; if (!el) return; pushUndo(); if (el.hasAttribute('data-dz-locked')) el.removeAttribute('data-dz-locked'); else el.setAttribute('data-dz-locked', ''); markDirty(); setSelTick((t) => t + 1); };
  const toggleHide = () => { const el = selRef.current; if (!el) return; pushUndo(); el.style.display = el.style.display === 'none' ? '' : 'none'; markDirty(); setSelTick((t) => t + 1); };
  const setOverflow = (v) => { const el = selRef.current; if (!el) return; pushUndo(); if (v) el.style.setProperty('overflow', v); else el.style.removeProperty('overflow'); markDirty(); setSelTick((t) => t + 1); };
  // Add Frame / Add Stack WRAP the selected element in a new container (like Framer), rather than
  // nesting an empty box inside it. Remove Frame is the inverse.
  const wrapIn = (kind) => {
    const el = selRef.current; const d = doc();
    if (!el || isBody(el) || !el.parentNode || !d) return;
    pushUndo();
    const w = d.createElement('div');
    if (kind === 'stack') w.style.cssText = 'display:flex;gap:16px;align-items:flex-start;';
    w.setAttribute('data-dz-name', kind === 'stack' ? 'Stack' : 'Frame');
    el.parentNode.insertBefore(w, el); w.appendChild(el);
    markDirty(); select(w);
  };
  const renameElTo = (el, name) => { if (!el) return; pushUndo(); if (name && name.trim()) el.setAttribute('data-dz-name', name.trim()); else el.removeAttribute('data-dz-name'); markDirty(); setSelTick((t) => t + 1); };
  const removeFrame = () => { const el = selRef.current; if (!el || isBody(el) || !el.parentNode) return; pushUndo(); const p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); el.remove(); clearSelection(); markDirty(); };
  const openCtxMenu = (clientX, clientY) => { const r = iframeRef.current ? iframeRef.current.getBoundingClientRect() : { left: 0, top: 0 }; setCtx({ x: r.left + clientX, y: r.top + clientY }); };
  ctxOpenRef.current = openCtxMenu;

  /* ---- components & layout templates (reusable HTML snippets, stored on the project) ---- */
  const cleanClone = (el) => { const c = el.cloneNode(true); ['data-dz-selected', 'data-dz-hover', 'data-dz-locked', 'contenteditable', 'draggable'].forEach((a) => c.removeAttribute(a)); c.querySelectorAll('[data-dz-selected],[data-dz-hover],[data-dz-locked],[contenteditable]').forEach((x) => { x.removeAttribute('data-dz-selected'); x.removeAttribute('data-dz-hover'); x.removeAttribute('data-dz-locked'); x.removeAttribute('contenteditable'); }); return c; };
  const insertHtml = (html) => { const d = doc(); if (!d || !html) return; pushUndo(); const tmp = d.createElement('div'); tmp.innerHTML = html; const node = tmp.firstElementChild; if (!node) return; const cur = selRef.current; const container = cur && !['IMG', 'VIDEO', 'INPUT', 'BR', 'HR'].includes(cur.tagName) ? cur : d.body; container.appendChild(node); markDirty(); select(node); try { node.scrollIntoView({ block: 'center' }); } catch (e) {} };
  const replaceWithHtml = (html) => { const el = selRef.current; const d = doc(); if (!el || isBody(el) || !html || !el.parentNode) return; pushUndo(); const tmp = d.createElement('div'); tmp.innerHTML = html; const node = tmp.firstElementChild; if (!node) return; el.parentNode.replaceChild(node, el); markDirty(); select(node); };
  const folderList = () => { const set = new Set(['Project']); (stylesRef.current.components || []).forEach((c) => set.add((c.folder && String(c.folder).trim()) || 'Project')); return Array.from(set); };
  const askCreate = (kind) => new Promise((resolve) => setCompModal({ mode: 'create', title: kind === 'template' ? 'New layout template' : 'New component', folders: folderList(), resolve }));
  const askFolder = (current) => new Promise((resolve) => setCompModal({ mode: 'folder', title: 'Move to folder', folders: folderList(), folder: current, resolve }));
  const createComponent = async (kind) => { const el = selRef.current; if (!el) return; const res = await askCreate(kind); if (!res) return; const comp = { id: uid(), kind, name: (res.name || '').trim() || (kind === 'template' ? 'Layout Template' : 'Component'), folder: (res.folder || '').trim() || 'Project', html: cleanClone(el).outerHTML }; updateStyles({ ...stylesRef.current, components: [...(stylesRef.current.components || []), comp] }); toastMsg(kind === 'template' ? 'Layout template created' : 'Component created'); };
  const addToTemplate = (tid) => { const el = selRef.current; if (!el) return; const html = cleanClone(el).outerHTML; updateStyles({ ...stylesRef.current, components: (stylesRef.current.components || []).map((c) => (c.id === tid ? { ...c, html: c.html + html } : c)) }); toastMsg('Added to template'); };

  /* ---- create a new page (optionally from a saved component/template) ---- */
  const slugify = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
  // Reuse a real page's <head> (CSS links, fonts, styles) so new pages aren't unstyled.
  const hasCss = (s) => /<link[^>]+stylesheet|<style/i.test(s || '');
  const stripHead = (htmlInner) => { const tmp = document.createElement('div'); tmp.innerHTML = htmlInner; tmp.querySelectorAll('#' + EDIT_STYLE_ID + ',#' + USER_STYLE_ID + ',title').forEach((el) => el.remove()); return tmp.innerHTML; };
  const headFor = async (title) => {
    let inner = '';
    const d = doc();
    if (d && d.head) inner = stripHead(d.head.innerHTML);
    if (!hasCss(inner)) { // current page has no real CSS — borrow head from the first page that does
      try {
        for (const p of (version.pages || [])) {
          const r = await fetch(markupFileUrl(version.id, p.path)); const txt = await r.text();
          const m = txt.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
          if (m && hasCss(m[1])) { inner = stripHead(m[1]); break; }
        }
      } catch (e) { /* keep what we have */ }
    }
    const t = `<title>${String(title || 'Page').replace(/[<>&]/g, '')}</title>`;
    return inner ? inner + t : `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${t}`;
  };
  const pageHtml = async (title, body) => `<!DOCTYPE html>\n<html lang="en"><head>${await headFor(title)}</head><body>${body || ''}</body></html>`;
  const createPage = async ({ name, templateId }) => {
    if (!version) return;
    const title = (name || 'Page').trim() || 'Page';
    let path = slugify(title) + '.html';
    if ((version.pages || []).some((p) => p.path === path)) path = slugify(title) + '-' + uid().slice(0, 4) + '.html';
    const tpl = templateId ? (stylesRef.current.components || []).find((c) => c.id === templateId) : null;
    const html = await pageHtml(title, tpl ? tpl.html : '');
    try {
      const res = await createMarkupPage(version.id, { path, title, html });
      const vs = await listMarkupVersions(id);
      setVersions(vs || []);
      setVersion((vs || []).find((v) => v.id === version.id) || { ...version, pages: res.pages || version.pages });
      setPage(res.path || path); setDirty(false); setLoadingIframe(true); clearSelection();
      setNewPageOpen(false); toastMsg('Page created');
    } catch (e) { setErr(e.message || 'Could not create page.'); setNewPageOpen(false); }
  };
  const refreshVersion = async () => { const vs = await listMarkupVersions(id); setVersions(vs || []); const nv = (vs || []).find((v) => v.id === version.id); if (nv) setVersion(nv); return nv; };
  const savePageSettings = async ({ title, slug }) => {
    const p = pageSettings; if (!p || !version) return;
    try {
      const newPath = slug && slugify(slug) + '.html' !== p.path ? slugify(slug) + '.html' : undefined;
      const res = await updateMarkupPage(version.id, { path: p.path, title, newPath });
      await refreshVersion();
      if (p.path === page && res.path) setPage(res.path);
      setPageSettings(null); toastMsg('Page updated');
    } catch (e) { setErr(e.message || 'Could not update page.'); setPageSettings(null); }
  };
  const duplicatePage = async (p) => { if (!version) return; try { const res = await duplicateMarkupPageFile(version.id, p.path); await refreshVersion(); toastMsg('Page duplicated'); if (res.path) guardSwitch(() => { setPage(res.path); setDirty(false); setLoadingIframe(true); clearSelection(); }); } catch (e) { setErr(e.message || 'Could not duplicate.'); } };
  const removePage = async (p) => { if (!version) return; try { const res = await deleteMarkupPage(version.id, p.path); await refreshVersion(); toastMsg('Page deleted'); if (p.path === page) { const first = (res.pages || [])[0]; if (first) { setPage(first.path); setDirty(false); setLoadingIframe(true); clearSelection(); } } } catch (e) { setErr(e.message || 'Could not delete page.'); } };
  const setHomePage = async (p) => { if (!version) return; try { await updateMarkupPage(version.id, { path: p.path, home: true }); await refreshVersion(); toastMsg('Set as home'); } catch (e) { setErr(e.message || 'Could not set home.'); } };
  const replacePage = async (templateId) => {
    const p = replacePageFor; if (!p || !version) return;
    const tpl = templateId ? (stylesRef.current.components || []).find((c) => c.id === templateId) : null;
    const html = await pageHtml(p.title || 'Page', tpl ? tpl.html : '');
    try {
      await saveMarkupPage(version.id, p.path, html);
      setReplacePageFor(null); toastMsg('Page replaced');
      if (p.path === page) { setDirty(false); setLoadingIframe(true); setReloadTick((t) => t + 1); clearSelection(); }
    } catch (e) { setErr(e.message || 'Could not replace page.'); setReplacePageFor(null); }
  };
  // Capture a whole page as a reusable layout template (so New Page → from this template).
  const savePageAsTemplate = async (p) => {
    if (!version) return;
    let bodyHtml = '';
    try {
      if (p.path === page && doc() && doc().body) bodyHtml = doc().body.innerHTML;
      else { const r = await fetch(markupFileUrl(version.id, p.path)); const txt = await r.text(); const m = txt.match(/<body[^>]*>([\s\S]*?)<\/body>/i); bodyHtml = m ? m[1] : ''; }
    } catch (e) { setErr('Could not read the page.'); return; }
    const tmp = document.createElement('div');
    tmp.innerHTML = bodyHtml;
    tmp.querySelectorAll('#' + EDIT_STYLE_ID + ',#' + USER_STYLE_ID).forEach((el) => el.remove());
    tmp.querySelectorAll('[data-dz-selected],[data-dz-hover],[data-dz-locked],[contenteditable],[draggable]').forEach((el) => { el.removeAttribute('data-dz-selected'); el.removeAttribute('data-dz-hover'); el.removeAttribute('data-dz-locked'); el.removeAttribute('contenteditable'); el.removeAttribute('draggable'); });
    const name = await askName('Save page as template', (p.title || 'Page') + ' template', 'Template name');
    if (name == null) return;
    const comp = { id: uid(), kind: 'template', name: name.trim() || 'Page template', folder: 'Project', html: '<div>' + tmp.innerHTML + '</div>' };
    updateStyles({ ...stylesRef.current, components: [...(stylesRef.current.components || []), comp] });
    toastMsg('Template created from page');
  };
  const deleteSel = () => { const el = selRef.current; if (!el || isBody(el)) return; pushUndo(); el.remove(); clearSelection(); markDirty(); };

  /* design-system styles: update state + debounced save to backend */
  const updateStyles = (next) => {
    setStyles(next);
    markDirty(); // editing the style library also changes the page's embedded CSS → enable Save
    if (saveStylesTimer.current) clearTimeout(saveStylesTimer.current);
    saveStylesTimer.current = setTimeout(() => { saveMarkupStyles(id, next).catch(() => toastMsg('Could not save styles')); }, 600);
  };

  /* ---- Apply a style guide's theme (colors + typography + links/button) ---- */
  const [sgMenuOpen, setSgMenuOpen] = useState(false);
  const [sgList, setSgList] = useState(null);     // lazily loaded list of guides for the picker
  const [applyingSg, setApplyingSg] = useState(false);
  const linkedSgId = styles.styleguideId || styleguideId || '';

  const applyStyleGuide = async (sgId) => {
    if (!sgId || applyingSg) return;
    setApplyingSg(true); setSgMenuOpen(false);
    try {
      const theme = await apiGetStyleGuideTheme(sgId);
      const next = applyStyleGuideTheme(theme, stylesRef.current);
      next.styleguideId = sgId;                    // remember the link (re-applyable)
      updateStyles(next);                          // saves + re-injects CSS + loads fonts
      toastMsg(`Applied “${theme.name || 'style guide'}”`);
    } catch (e) {
      toastMsg('Could not apply the style guide');
    } finally { setApplyingSg(false); }
  };
  applyStyleGuideRef.current = applyStyleGuide;
  const openSgMenu = async () => {
    setSgMenuOpen((v) => !v);
    if (sgList == null) { try { setSgList(await listStyleGuides()); } catch (e) { setSgList([]); } }
  };
  // apply a text style to the selected element (single dz-text-* class); '' clears it
  const applyTextStyle = (styleId) => {
    const el = selRef.current; if (!el) return; pushUndo();
    Array.from(el.classList).filter((c) => c.startsWith('dz-text-')).forEach((c) => el.classList.remove(c));
    if (styleId) el.classList.add('dz-text-' + styleId);
    markDirty(); setSelTick((t) => t + 1);
  };
  const addColorToken = (hex) => { const cs = stylesRef.current.colors || []; updateStyles({ ...stylesRef.current, colors: [...cs, { id: uid(), name: 'Color ' + (cs.length + 1), light: hex || '#000000', dark: '' }] }); };
  // Create a text style from the selected element's current type, then apply it to the element.
  const createTextStyleFromEl = async () => {
    const el = selRef.current; const w = win(); if (!el || !w) return;
    const name = await askName('New text style', '', 'Style name'); if (name == null) return;
    const cs = w.getComputedStyle(el);
    const s = newTextStyle(name.trim() || 'Text', '', false);
    s.font = cs.fontFamily || '';
    s.weight = String(parseInt(cs.fontWeight, 10) || '') || '';
    s.italic = cs.fontStyle === 'italic';
    s.color = rgbToHex(cs.color) || '';
    const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
    if (!Number.isNaN(fs)) { s.bp.L.size = Math.round(fs * 100) / 100; s.bp.L.sizeUnit = 'px'; }
    if (!Number.isNaN(fs) && !Number.isNaN(lh)) { s.bp.L.line = Math.round((lh / fs) * 100) / 100; s.bp.L.lineUnit = ''; }
    updateStyles({ ...stylesRef.current, text: [...(stylesRef.current.text || []), s] });
    applyTextStyle(s.id);
  };
  const applyLinkStyle = (styleId) => {
    const el = selRef.current; if (!el) return; pushUndo();
    Array.from(el.classList).filter((c) => c.startsWith('dz-link-')).forEach((c) => el.classList.remove(c));
    if (styleId) el.classList.add('dz-link-' + styleId);
    markDirty(); setSelTick((t) => t + 1);
  };
  // First time a project has no styles: build a base text style per tag from the page.
  seedRef.current = () => {
    if (stylesRef.current.seeded || (stylesRef.current.text || []).length) return;
    const seeded = seedTextStylesFromDoc(win(), doc());
    updateStyles({ ...stylesRef.current, text: seeded, seeded: true });
  };

  const restore = (html) => { const d = doc(); if (!d || html == null) return; d.documentElement.innerHTML = html.replace(/^<html[^>]*>/i, '').replace(/<\/html>$/i, ''); selRef.current = null; setSelSeq((s) => s + 1); setSelTick((t) => t + 1); };
  const undo = () => { const cur = snapshot(); const prev = undoRef.current.pop(); if (prev == null) return; if (cur != null) redoRef.current.push(cur); restore(prev); markDirty(); };
  const redo = () => { const cur = snapshot(); const next = redoRef.current.pop(); if (next == null) return; if (cur != null) undoRef.current.push(cur); restore(next); markDirty(); };
  const reorder = (dragEl, targetEl, pos) => { if (!dragEl || !targetEl || dragEl === targetEl || dragEl.contains(targetEl)) return; pushUndo(); if (pos === 'inside') targetEl.appendChild(dragEl); else targetEl.parentNode.insertBefore(dragEl, pos === 'before' ? targetEl : targetEl.nextSibling); markDirty(); setSelTick((t) => t + 1); };

  keydownRef.current = (e) => {
    const d = doc();
    const editing = (e.target && e.target.isContentEditable) || (d && d.activeElement && d.activeElement.isContentEditable);
    if (editing) return;
    // don't hijack typing in the app's own panels (inspector inputs, modals, etc.)
    const ae = typeof document !== 'undefined' ? document.activeElement : null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const meta = e.metaKey || e.ctrlKey;
    const sel = selRef.current;
    if (meta && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (meta && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); }
    else if (meta && (e.key === 'c' || e.key === 'C')) { if (sel && !isBody(sel)) { e.preventDefault(); copyEl(); } }
    else if (meta && (e.key === 'v' || e.key === 'V')) { if (clipRef.current) { e.preventDefault(); pasteEl(); } }
    else if (meta && (e.key === 'd' || e.key === 'D')) { if (sel && !isBody(sel)) { e.preventDefault(); duplicateSel(); } }
    else if ((e.key === 'Backspace' || e.key === 'Delete')) { if (sel && !isBody(sel)) { e.preventDefault(); deleteSel(); } }
  };
  useEffect(() => { const h = (e) => keydownRef.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const applyTitle = (v) => { setTitle(v); const d = doc(); if (!d) return; let t = d.querySelector('title'); if (!t) { t = d.createElement('title'); d.head && d.head.appendChild(t); } t.textContent = v; markDirty(); };

  // Stop the preview runtime and revert the inline styles it set, leaving a clean DOM.
  const clearPreviewDom = () => {
    const d = doc(); const w = win(); if (!d) return;
    try { if (w && w.__dzAnimStop) w.__dzAnimStop(); } catch (e) {}
    const s = d.getElementById(ANIM_RUNTIME_ID); if (s) s.remove();
    d.querySelectorAll('[data-dz-anim]').forEach((el) => { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); el.style.removeProperty('transition'); el.style.removeProperty('will-change'); });
  };

  const save = async (silent = false) => {
    const d = doc(); if (!d || !version) return;
    if (savingGuard.current) return;                     // avoid overlapping saves
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    savingGuard.current = true;
    if (preview) { clearPreviewDom(); setPreview(false); } // don't bake the preview runtime / hidden states into the file
    setSaving(true); setErr('');
    try {
      const clone = d.documentElement.cloneNode(true);
      clone.querySelectorAll('[data-dz-hover],[data-dz-selected],[data-dz-drop-before],[data-dz-drop-after]').forEach((el) => { el.removeAttribute('data-dz-hover'); el.removeAttribute('data-dz-selected'); el.removeAttribute('data-dz-drop-before'); el.removeAttribute('data-dz-drop-after'); });
      clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
      clone.querySelectorAll('[data-dz-link-wrap]').forEach((el) => el.removeAttribute('data-dz-link-wrap'));
      const s = clone.querySelector('#' + EDIT_STYLE_ID); if (s) s.remove();
      const rh = clone.querySelector('#__dz_resize'); if (rh) rh.remove();
      const oldRt = clone.querySelector('#' + ANIM_RUNTIME_ID); if (oldRt) oldRt.remove();
      const body = clone.querySelector('body');
      if (body && clone.querySelector('[data-dz-anim]')) { const sc = d.createElement('script'); sc.id = ANIM_RUNTIME_ID; sc.textContent = ANIM_RUNTIME; body.appendChild(sc); }
      const html = '<!DOCTYPE html>\n<html' + attrStr(clone) + '>' + clone.innerHTML + '</html>';
      await saveMarkupPage(version.id, page, html);
      setDirty(false); if (!silent) toastMsg('Saved');
    } catch (e) { setErr(e.message || 'Could not save.'); }
    setSaving(false);
    savingGuard.current = false;
  };
  saveRef.current = save;

  // Auto-save before leaving the page / switching pages or versions (no Save needed).
  const guardSwitch = async (fn) => { if (dirty) { try { await save(true); } catch (e) {} } fn(); };
  const switchPage = (p) => guardSwitch(() => { setPage(p); setDirty(false); setLoadingIframe(true); clearSelection(); });
  const switchVersion = (vid) => guardSwitch(() => { const v = versions.find((x) => x.id === vid); if (!v) return; setVersion(v); setPage(v.type === 'zip' && (v.pages || []).length ? v.pages[0].path : ''); setDirty(false); setLoadingIframe(true); clearSelection(); });

  const sel = selRef.current;
  const pages = (version && version.pages) || [];
  const appliedTextId = sel ? (Array.from(sel.classList).find((c) => c.startsWith('dz-text-')) || '').replace('dz-text-', '') : '';
  const appliedLinkId = sel ? (Array.from(sel.classList).find((c) => c.startsWith('dz-link-')) || '').replace('dz-link-', '') : '';

  return (
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 flex flex-col bg-[#F3F4F8]`}>
      <div className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-3 gap-2">
        <button onClick={() => guardSwitch(onBack)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500" title="Back to Design projects"><ArrowLeft size={18} /></button>
        <BrandStar size={20} />
        <div className="font-semibold text-gray-800 truncate max-w-[180px]">{project?.name || 'Design'}</div>
        {editable && pages.length > 1 && (
          <div className="relative ml-2">
            <select value={page} onChange={(e) => switchPage(e.target.value)} className="appearance-none bg-gray-100 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-700 outline-none max-w-[220px]">
              {pages.map((p) => <option key={p.path} value={p.path}>{p.title || p.path}</option>)}
            </select>
            <Caret size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
        {versions.length > 1 && (
          <div className="relative">
            <select value={version?.id || ''} onChange={(e) => switchVersion(e.target.value)} className="appearance-none bg-gray-100 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-700 outline-none">
              {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <Caret size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
        {editable && (<>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button onClick={() => insertEl('text')} title="Add text" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 font-semibold">T</button>
          <div className="relative">
            <button onClick={() => setInsertOpen((v) => !v)} title="Add element" className={`w-9 h-9 rounded-lg flex items-center justify-center ${insertOpen ? 'bg-gray-100 text-[#473AE0]' : 'hover:bg-gray-100 text-gray-500'}`}><Plus size={18} /></button>
            {insertOpen && (<>
              <div className="fixed inset-0 z-40" onClick={() => setInsertOpen(false)} />
              <div className="absolute left-0 top-11 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-52 max-h-[70vh] overflow-y-auto text-sm">
                {INSERT_ITEMS.map(([type, lbl, Icon]) => (
                  <button key={type} onClick={() => insertEl(type)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2.5"><Icon size={15} className="text-gray-400" /> {lbl}</button>
                ))}
                {(styles.components || []).length > 0 && (
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Components & Templates</div>
                    {(styles.components || []).map((c) => (
                      <button key={c.id} onClick={() => { insertHtml(c.html); setInsertOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2.5 truncate"><span className="text-[#7c3aed] shrink-0">◈</span> <span className="truncate">{c.name}</span></button>
                    ))}
                  </div>
                )}
              </div>
            </>)}
          </div>
        </>)}
        <div className="flex-1" />
        {editable && (
          <div className="relative mr-1">
            <button onClick={openSgMenu} disabled={applyingSg} title="Apply a style guide's colors & typography"
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium ${linkedSgId ? 'text-[#473AE0] bg-indigo-50 hover:bg-indigo-100' : 'text-gray-600 hover:bg-gray-100'} disabled:opacity-50`}>
              {applyingSg ? <Loader2 size={15} className="animate-spin" /> : <Palette size={15} />} Style guide <Caret size={13} className="text-gray-400" />
            </button>
            {sgMenuOpen && (<>
              <div className="fixed inset-0 z-30" onClick={() => setSgMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-40 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 text-sm">
                {linkedSgId && (
                  <button onClick={() => applyStyleGuide(linkedSgId)} className="w-full text-left px-3 py-1.5 font-medium text-[#473AE0] hover:bg-indigo-50">Re-apply linked guide</button>
                )}
                <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Apply from</div>
                {sgList == null && <div className="px-3 py-2 text-gray-400">Loading…</div>}
                {sgList && sgList.length === 0 && <div className="px-3 py-2 text-gray-400">No style guides yet.</div>}
                <div className="max-h-64 overflow-y-auto">
                  {sgList && sgList.map((g) => (
                    <button key={g.id} onClick={() => applyStyleGuide(g.id)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left">
                      <span className="flex-1 truncate text-gray-700">{g.name}</span>
                      {g.id === linkedSgId && <Check size={14} className="text-[#473AE0] shrink-0" />}
                    </button>
                  ))}
                </div>
                {linkedSgId && (<>
                  <div className="h-px bg-gray-100 my-1" />
                  <button onClick={() => { updateStyles({ ...stylesRef.current, styleguideId: '' }); setSgMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-red-50">Unlink style guide</button>
                </>)}
              </div>
            </>)}
          </div>
        )}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {Object.entries(DEVICES).map(([k, d]) => { const Icon = d.icon; return (
            <button key={k} onClick={() => setDevice(k)} title={d.label} className={`w-8 h-8 rounded-md flex items-center justify-center ${device === k ? 'bg-white shadow-sm text-[#473AE0]' : 'text-gray-500 hover:text-gray-700'}`}><Icon size={16} /></button>
          ); })}
        </div>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button onClick={togglePreview} disabled={!editable} title={preview ? 'Exit preview' : 'Preview scroll animations'} className={`w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40 ${preview ? 'bg-[#473AE0]/10 text-[#473AE0]' : 'hover:bg-gray-100 text-gray-500'}`}><Play size={16} /></button>
        <button onClick={undo} disabled={!editable} title="Undo (⌘Z)" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 disabled:opacity-40"><Undo2 size={17} /></button>
        <button onClick={redo} disabled={!editable} title="Redo (⌘⇧Z)" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 disabled:opacity-40"><Redo2 size={17} /></button>
        {editable && (
          <div className="ml-1 flex items-center gap-1.5 text-sm font-medium px-3 h-9 select-none">
            {saving
              ? <><Loader2 size={14} className="animate-spin text-gray-400" /> <span className="text-gray-400">Saving…</span></>
              : dirty
                ? <button onClick={() => save()} title="Save now" className="flex items-center gap-1.5 text-amber-500 hover:text-amber-600"><Save size={14} /> Save now</button>
                : <><Check size={14} className="text-green-500" /> <span className="text-green-600">Saved</span></>}
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {editable && <Layers getDoc={doc} selectedEl={sel} onReorder={reorder} onRename={renameElTo} pages={pages} page={page} onPage={switchPage} onSelect={(el) => { select(el); try { el.scrollIntoView({ block: 'center' }); } catch (e) {} }}
          onCtxMenu={(el, x, y) => { select(el); setCtx({ x, y }); }} onNewPage={() => guardSwitch(() => setNewPageOpen(true))}
          pageActions={{ settings: (p) => setPageSettings(p), duplicate: duplicatePage, remove: removePage, setHome: setHomePage, replace: (p) => setReplacePageFor(p), saveTemplate: savePageAsTemplate }}
          assetsContent={<>
            <StylesPanel styles={styles} onChange={updateStyles} selectedEl={sel} appliedTextId={appliedTextId} appliedLinkId={appliedLinkId} onApplyText={applyTextStyle} onRemoveText={() => applyTextStyle('')} onApplyLink={applyLinkStyle} onRemoveLink={() => applyLinkStyle('')} />
            <ComponentsPanel components={styles.components || []} styles={styles} onChange={updateStyles} onInsert={insertHtml} askName={askName} askFolder={askFolder} />
          </>} />}
        <div className="flex-1 relative overflow-auto flex justify-center p-6">
          {!version ? (
            <div className="self-center text-gray-400 text-sm">{err || 'Loading…'}</div>
          ) : !editable ? (
            <div className="self-center max-w-sm text-center text-gray-500">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Type size={22} className="text-gray-400" /></div>
              <div className="font-semibold text-gray-700 mb-1">This version is a live URL</div>
              <div className="text-sm">Design editing works on uploaded HTML/ZIP versions. Add a ZIP version in Markup, then edit it here.</div>
            </div>
          ) : (
            <div className="bg-white shadow-xl rounded-lg overflow-hidden self-start transition-all" style={{ width: DEVICES[device].w, maxWidth: '100%', height: device === 'desktop' ? '100%' : 'auto' }}>
              <div className="relative" style={{ height: device === 'desktop' ? '100%' : '85vh' }}>
                {loadingIframe && <div className="absolute inset-0 flex items-center justify-center bg-white z-10"><Loader2 size={26} className="animate-spin text-gray-300" /></div>}
                <iframe key={`${version.id}-${page}-${reloadTick}`} ref={iframeRef} onLoad={onIframeLoad} src={src} title="design" className="w-full h-full border-0 bg-white" />
              </div>
            </div>
          )}
          {err && editable && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm rounded-full px-4 py-2 shadow-lg">{err}</div>}
        </div>

        {editable && (
          <Inspector key={selSeq} el={sel} win={win()} title={title} onTitle={applyTitle} pages={pages}
            colors={styles.colors || []} onNewColor={addColorToken}
            textStyles={styles.text || []} appliedTextId={appliedTextId} onApplyText={applyTextStyle} onNewTextStyle={createTextStyleFromEl}
            onStyle={applyStyle} onText={setText} onAttr={setAttr} onLink={setLink} onLinkTarget={setLinkTarget}
            onMoveUp={() => moveSel(-1)} onMoveDown={() => moveSel(1)} onDuplicate={duplicateSel} onDelete={deleteSel} onDeselect={clearSelection} />
        )}
      </div>

      {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg">{toast}</div>}

      {ctx && sel && (
        <ContextMenu x={ctx.x} y={ctx.y} el={sel} onClose={() => setCtx(null)}
          components={styles.components || []}
          actions={{
            fitContent, selectParent, selectTopParent, selectFirstChild, selectFirstText, selectBody,
            copyEl, pasteEl, canPaste: !!clipRef.current, duplicate: duplicateSel, del: deleteSel,
            rename: renameEl, autoRename: autoRenameEl, toggleLock, toggleHide, setOverflow,
            addFrame: () => wrapIn('frame'), addStack: () => wrapIn('stack'), removeFrame,
            createComponent: () => createComponent('component'), createTemplate: () => createComponent('template'),
            replaceWith: replaceWithHtml, addToTemplate,
          }} />
      )}

      {namePrompt && (
        <NamePrompt title={namePrompt.title} initial={namePrompt.value} placeholder={namePrompt.placeholder}
          onSubmit={(v) => { namePrompt.resolve(v); setNamePrompt(null); }}
          onCancel={() => { namePrompt.resolve(null); setNamePrompt(null); }} />
      )}

      {compModal && (
        <CreateModal mode={compModal.mode} title={compModal.title} folders={compModal.folders} folder={compModal.folder}
          onSubmit={(val) => { compModal.resolve(val); setCompModal(null); }}
          onCancel={() => { compModal.resolve(null); setCompModal(null); }} />
      )}

      {newPageOpen && (
        <NewPageModal templates={styles.components || []} onSubmit={createPage} onCancel={() => setNewPageOpen(false)} />
      )}

      {pageSettings && (
        <PageSettingsModal page={pageSettings} onSubmit={savePageSettings} onCancel={() => setPageSettings(null)} />
      )}

      {replacePageFor && (
        <ReplacePageModal templates={styles.components || []} onSubmit={replacePage} onCancel={() => setReplacePageFor(null)} />
      )}
    </div>
  );
}

