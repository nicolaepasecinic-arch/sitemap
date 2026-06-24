/* ------------------------------------------------------------------ */
/*  SitemapBuilder presentational panels: toolbars, palettes, modals.   */
/*  All prop-driven (no shared state) — split out of SitemapBuilder.    */
/* ------------------------------------------------------------------ */
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Bold, Check, CheckCircle2, Copy, Download, ExternalLink, FileText, Italic,
  LayoutGrid, List, LogOut, MoveUpRight, Palette, Paperclip, Plus, PlusSquare, Save, Send,
  Sliders, Sparkles, Trash2, Underline, Upload, X,
} from 'lucide-react';
import {
  COLORS, COLOR_KEYS, resolveColor, NOTE_COLORS, NOTE_KEYS, ME, THEMES, THEME_KEYS,
  FRAME_OPTIONS, relTime, FRAME_KEYS, FrameGlyph, PAGE_FRAMES, PageFrameGlyph,
} from './sitemapTheme';
import ActiveCollabField, { AcIcon } from '../components/ActiveCollabField';
import { hasBackend, apiGenerateContentMap, apiSetProjectActiveCollab } from '../api';
import { uploadMarkupAttachment } from '../markup/markupApi';
import { ATTACH_ACCEPT, fileToDataUrl, isImageAtt, prettySize } from './sitemapUtils';

export function ToolbarShell({ zoom, top = -12, children }) {
  return (
    <div data-ui
         className="absolute left-1/2 z-20"
         style={{ top, transform: `translate(-50%, -100%) scale(${1 / zoom})`, transformOrigin: 'bottom center' }}
         onMouseDown={(e) => e.stopPropagation()}
         onClick={(e) => e.stopPropagation()}>
      <div className="relative flex items-center gap-0.5 bg-white rounded-xl shadow-xl border border-gray-100 px-1.5 py-1.5">
        {children}
      </div>
    </div>
  );
}

/* icon button with a small dark tooltip on hover */
export function TipBtn({ title, onClick, active, danger, children }) {
  const base = 'relative group/tb w-7 h-7 rounded-lg flex items-center justify-center';
  const tone = danger
    ? 'text-red-500 hover:bg-red-50'
    : active ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]';
  return (
    <button onClick={onClick} className={`${base} ${tone} ${active && danger ? 'bg-red-50' : ''}`}>
      {children}
      <span className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white text-[11px] px-2 py-1 opacity-0 group-hover/tb:opacity-100 transition-opacity z-30">
        {title}
      </span>
    </button>
  );
}

/* 3 line-style choices: solid / dashed / dotted */
export function LineStyleRow({ value, onPick }) {
  const opts = [
    { k: 'solid',  dash: '' },
    { k: 'dashed', dash: '6 5' },
    { k: 'dotted', dash: '1 5' },
  ];
  return (
    <div className="flex gap-1 mb-2">
      {opts.map((o) => (
        <button key={o.k} onClick={() => onPick(o.k)} title={o.k}
                className={`flex-1 h-7 rounded-lg border flex items-center justify-center ${value === o.k ? 'border-[#473AE0] bg-indigo-50' : 'border-gray-200'}`}>
          <svg width="30" height="8" viewBox="0 0 30 8">
            <path d="M1 4 H29" stroke={value === o.k ? '#473AE0' : '#9aa3b2'} strokeWidth="2"
                  strokeDasharray={o.dash || undefined} strokeLinecap={o.k === 'dotted' ? 'round' : 'butt'} />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* floating toolbar above a canvas object (note / link) */
export function ItemToolbar({ zoom, colors, extra, onDuplicate, onDelete }) {
  return (
    <div data-ui className="absolute left-1/2 z-20"
         style={{ top: -10, transform: `translate(-50%, -100%) scale(${1 / zoom})`, transformOrigin: 'bottom center' }}
         onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5 bg-white rounded-xl shadow-xl border border-gray-100 px-1.5 py-1.5">
        {colors}
        {extra}
        {(colors || extra) && <div className="w-px h-5 bg-gray-200 mx-0.5" />}
        <button onClick={onDuplicate} title="Duplicate" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]"><Copy size={15} /></button>
        <button onClick={onDelete} title="Delete" className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

/* note color = a single swatch that opens a 4-color popover (same pattern as page/section) */
export function NoteColorButton({ value, onPick }) {
  const [open, setOpen] = useState(false);
  const nc = NOTE_COLORS[value] || NOTE_COLORS.yellow;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} title="Note color" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
        <span className="w-4 h-4 rounded-full" style={{ background: nc.bg, boxShadow: `inset 0 0 0 1px ${nc.edge}` }} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 px-3 py-2 flex gap-2">
          {NOTE_KEYS.map((k) => (
            <button key={k} onClick={() => { onPick(k); setOpen(false); }} title={k} className="w-5 h-5 rounded-full"
                    style={{ background: NOTE_COLORS[k].bg, boxShadow: value === k ? `0 0 0 2px #fff, 0 0 0 3px ${NOTE_COLORS[k].edge}` : `inset 0 0 0 1px ${NOTE_COLORS[k].edge}` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* shared 12-color palette popover + free color picker */
export function ColorPalette({ value, onPick, onClose, keys = COLOR_KEYS }) {
  const isPreset = !!COLORS[value];
  return (
    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-44">
      <div className="grid grid-cols-4 gap-2.5 justify-items-center">
        {keys.map((k) => {
          const col = resolveColor(k);
          return (
            <button key={k} onClick={() => { onPick(k); onClose?.(); }} title={col.name}
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: col.solid,
                             boxShadow: value === k ? `0 0 0 2px #fff, 0 0 0 4px ${col.solid}` : 'none' }}>
              {value === k && <span className="w-2 h-2 rounded-full bg-white" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-2">
        <label className="relative w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden"
               title="Pick a custom color"
               style={!isPreset ? { background: resolveColor(value).solid } : undefined}>
          {isPreset && <Plus size={15} className="text-gray-500" />}
          <input type="color" value={resolveColor(value).solid}
                 onChange={(e) => onPick(e.target.value)}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </label>
        <span className="text-xs text-gray-500">Custom color</span>
      </div>
    </div>
  );
}

/* small inline delete confirmation popover (English) */
export function DeleteConfirm({ text, onCancel, onConfirm }) {
  return (
    <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-56 text-left">
      <div className="text-sm text-gray-700 mb-3">{text}</div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
        <button onClick={onConfirm} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600">Delete</button>
      </div>
    </div>
  );
}

/* ---------------- PAGE menu ---------------- */
export function PageToolbar({ zoom, node, colorOpen, frameOpen, linkOpen, colorKeys,
                       onAddBlock, onFrame, onPickFrame, onColor, onPickColor, onCloseColor, onLink, onSetLink, onApplyContentMap, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');

  const runGenerate = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;
    if (!hasBackend()) { setAiErr('AI needs the backend running (set REACT_APP_API_URL).'); return; }
    setAiBusy(true); setAiErr('');
    try {
      const { sections } = await apiGenerateContentMap(prompt, node.label || '');
      if (!sections || !sections.length) { setAiErr('No sections returned. Try a more detailed prompt.'); return; }
      onApplyContentMap(sections);
      setAiOpen(false); setAiPrompt('');
    } catch (e) {
      setAiErr((e && e.message) || 'Generation failed.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <ToolbarShell zoom={zoom}>
      {/* 1 — add section */}
      <TBtn onClick={onAddBlock} title="Add section"><Plus size={16} /></TBtn>
      {/* 2 — page frame */}
      <button onClick={onFrame} title="Frame"
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 ${frameOpen ? 'bg-indigo-50 text-[#473AE0]' : ''}`}>
        <PageFrameGlyph frame={node.pageFrame || 'window'} />
      </button>
      {/* 3 — color */}
      <button onClick={onColor} title="Color" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
        <span className="w-4 h-4 rounded-full" style={{ background: resolveColor(node.color).solid }} />
      </button>
      {/* 6 — link */}
      <button onClick={onLink} title="Link to this page"
              className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 ${node.link ? 'text-[#473AE0]' : 'text-gray-600'}`}>
        <ExternalLink size={16} />
      </button>
      {/* 7 — AI */}
      <button onClick={() => setAiOpen((v) => !v)} title="AI"
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-purple-500 hover:bg-purple-50 ${aiOpen ? 'bg-purple-50' : ''}`}>
        <Sparkles size={16} />
      </button>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      {/* 8 — delete page */}
      <button onClick={() => setConfirm(true)} title="Delete page" className={`w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 ${confirm ? 'bg-red-50' : ''}`}><Trash2 size={16} /></button>

      {confirm && (
        <DeleteConfirm
          text="Delete this page and all its sub-pages?"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); onDelete(); }}
        />
      )}

      {frameOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-xl shadow-xl border border-gray-100 px-2 py-2">
          {PAGE_FRAMES.map((f) => (
            <button key={f} onClick={() => onPickFrame(f)} title={f}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center hover:border-indigo-300 ${(node.pageFrame || 'window') === f ? 'border-[#473AE0] bg-indigo-50' : 'border-gray-200'}`}
                    style={{ color: '#473AE0' }}>
              <PageFrameGlyph frame={f} />
            </button>
          ))}
        </div>
      )}

      {colorOpen && <ColorPalette value={node.color} onPick={onPickColor} onClose={onCloseColor} keys={colorKeys} />}

      {linkOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 px-2 py-2 w-56">
          <div className="text-[10px] font-semibold text-gray-400 px-1 pb-1 uppercase tracking-wide">Link to this page</div>
          <input autoFocus value={node.link || ''} onChange={(e) => onSetLink(e.target.value)} placeholder="Enter link URL"
                 className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-300" />
        </div>
      )}

      {aiOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-64">
          <textarea autoFocus value={aiPrompt} onChange={(e) => { setAiPrompt(e.target.value); if (aiErr) setAiErr(''); }}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runGenerate(); }}
                    placeholder="A few words about page content…" rows={3} disabled={aiBusy}
                    className="w-full resize-none outline-none text-sm text-gray-700 placeholder-gray-400 disabled:opacity-60" />
          {aiErr && <div className="text-[11px] text-red-500 mb-1">{aiErr}</div>}
          <button onClick={runGenerate} disabled={aiBusy || !aiPrompt.trim()}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:hover:bg-transparent">
            <Sparkles size={15} className={aiBusy ? 'animate-spin' : ''} /> {aiBusy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      )}
    </ToolbarShell>
  );
}

/* ---------------- SECTION menu (floats above the selected section) ---------------- */
export function SectionToolbar({ zoom, topOffset, block, colorOpen, framePickerOpen, arrowActive, colorKeys,
                          onMarkDone, onAddBelow, onColor, onPickColor, onCloseColor, onWireframes, onPickFrame, onClearFrame,
                          onArrows, onDuplicate, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <ToolbarShell zoom={zoom} top={topOffset != null ? topOffset - 12 : -12}>
      {/* 1 — mark as completed (toggle) */}
      <button onClick={onMarkDone}
              className={`relative group/tb w-7 h-7 rounded-lg flex items-center justify-center ${block.done ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]'}`}>
        <CheckCircle2 size={16} fill={block.done ? 'currentColor' : 'none'} stroke={block.done ? '#fff' : 'currentColor'} />
        <span className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white text-[11px] px-2 py-1 opacity-0 group-hover/tb:opacity-100 transition-opacity z-30">
          {block.done ? 'Mark as not completed' : 'Mark as completed'}
        </span>
      </button>
      {/* 2 — add section below */}
      <TipBtn title="Add section below" onClick={onAddBelow}><PlusSquare size={16} /></TipBtn>
      {/* 3 — color */}
      <TipBtn title="Section color" active={colorOpen} onClick={onColor}>
        <span className="w-4 h-4 rounded-full" style={{ background: resolveColor(block.color).solid }} />
      </TipBtn>
      {/* 4 — wireframe */}
      <TipBtn title="Wireframe" active={framePickerOpen} onClick={onWireframes}><LayoutGrid size={16} /></TipBtn>
      {/* 5 — arrows (link to pages) */}
      <TipBtn title="Link to pages" active={arrowActive || (block.arrowTargets || []).length > 0} onClick={onArrows}><MoveUpRight size={16} /></TipBtn>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      {/* 6 — duplicate */}
      <TipBtn title="Duplicate section" onClick={onDuplicate}><Copy size={16} /></TipBtn>
      {/* 7 — delete (with confirm) */}
      <TipBtn title="Delete section" danger active={confirm} onClick={() => setConfirm(true)}><Trash2 size={16} /></TipBtn>

      {confirm && (
        <DeleteConfirm
          text="Delete this section?"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); onDelete(); }}
        />
      )}

      {colorOpen && <ColorPalette value={block.color} onPick={onPickColor} onClose={onCloseColor} keys={colorKeys} />}

      {framePickerOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-60">
          <div className="text-[10px] font-semibold text-gray-400 px-1 pb-1.5 uppercase tracking-wide">Wireframe — {block.name}</div>
          <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
            {FRAME_KEYS.map((f) => (
              <button key={f} onClick={() => onPickFrame(f)} title={f}
                      className={`h-12 rounded-lg border flex items-center justify-center px-1.5 py-1 hover:border-indigo-300 ${block.frame === f ? 'border-[#473AE0] bg-indigo-50' : 'border-gray-200'}`}
                      style={{ color: '#473AE0' }}>
                <FrameGlyph frame={f} />
              </button>
            ))}
          </div>
          <button onClick={onClearFrame} className="w-full text-center text-sm text-red-500 font-medium pt-2 hover:text-red-600">Clear wireframe (none)</button>
        </div>
      )}
    </ToolbarShell>
  );
}

export function TBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]">
      {children}
    </button>
  );
}

export function ToolBtn({ children, onClick, title, active }) {
  return (
    <button onClick={onClick} title={title}
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-indigo-50 text-[#473AE0]' : 'text-gray-500 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Project menu (left dropdown): Go to Dashboard + Export              */
/* ------------------------------------------------------------------ */
export function ProjectMenu({ onClose, onDashboard, onLogout, exportMenu }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute left-0 top-10 z-40 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5"
         onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <button onClick={onDashboard} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
        <LayoutGrid size={15} /> Go to Dashboard
      </button>
      <div className="h-px bg-gray-100 my-1" />
      {exportMenu}
      {onLogout && <>
        <div className="h-px bg-gray-100 my-1" />
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50">
          <LogOut size={15} /> Logout
        </button>
      </>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Project settings panel (theme / frames / colors)                   */
/* ------------------------------------------------------------------ */
export function ProjectSettings({ settings, setSettings, onClose, onAddColor, onRemoveColor, project, onAcLinked, isPM }) {
  const [tab, setTab] = useState('general');
  const setTheme = (t) => setSettings((s) => ({ ...s, theme: t }));
  const setFrame = (f) => setSettings((s) => ({ ...s, frame: f }));
  const colorList = (settings.colorList && settings.colorList.length) ? settings.colorList : COLOR_KEYS;
  return (
    <div data-ui className="absolute top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-100 shadow-xl z-50 flex flex-col"
         onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
        <span className="font-semibold text-gray-800">Project settings</span>
        <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
      </div>
      <div className="flex items-center gap-8 px-5 border-b border-gray-100">
        <button onClick={() => setTab('general')} title="General" className={`py-3 ${tab === 'general' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}><Sliders size={16} /></button>
        <button onClick={() => setTab('colors')} title="Colors" className={`py-3 ${tab === 'colors' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}><Palette size={16} /></button>
        {hasBackend() && project?.id && isPM && <button onClick={() => setTab('activecollab')} title="Assign AC Project" className={`py-3 ${tab === 'activecollab' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}><AcIcon size={16} /></button>}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'general' && (
          <>
            <div className="text-sm font-semibold text-gray-700 mb-3">Theme</div>
            <div className="grid grid-cols-2 gap-3 mb-7">
              {THEME_KEYS.map((k) => (
                <button key={k} onClick={() => setTheme(k)}
                        className={`rounded-xl border-2 p-3 h-20 flex flex-col justify-between ${settings.theme === k ? 'border-[#10B981]' : 'border-gray-200'}`}
                        style={{ background: THEMES[k].bg }}>
                  <span className={`text-sm font-medium ${k === 'dark' ? 'text-white' : 'text-gray-700'}`}>{THEMES[k].name}</span>
                  <div className="flex gap-1">
                    <span className="w-7 h-3 rounded" style={{ background: '#5C4FE8' }} />
                    <span className="w-4 h-3 rounded" style={{ background: '#13C08A' }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Frames</div>
            <div className="grid grid-cols-3 gap-2">
              {FRAME_OPTIONS.map((f) => (
                <button key={f.key} onClick={() => setFrame(f.key)}
                        className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 ${settings.frame === f.key ? 'border-[#10B981]' : 'border-gray-200'}`}
                        style={{ color: '#473AE0' }}>
                  <PageFrameGlyph frame={f.frame} />
                  <span className="text-xs text-gray-600">{f.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {tab === 'activecollab' && hasBackend() && project?.id && (
          <ActiveCollabField
            acProjectId={project.acProjectId || ''}
            acProjectName={project.acProjectName || ''}
            onSave={(acId) => apiSetProjectActiveCollab(project.id, acId)}
            onLinked={onAcLinked}
          />
        )}
        {tab === 'colors' && (
          <>
            <div className="text-sm font-semibold text-gray-700 mb-1">Color legend</div>
            <div className="text-xs text-gray-400 mb-2">Removing a color resets pages &amp; sections that used it to the default.</div>
            <div className="divide-y divide-gray-100">
              {colorList.map((k) => {
                const col = resolveColor(k);
                return (
                  <div key={k} className="flex items-center gap-3 py-2.5">
                    <span className="w-4 h-4 rounded-full" style={{ background: col.solid }} />
                    <span className="text-sm text-gray-700">{col.name}</span>
                    {k === 'blue'
                      ? <span className="ml-auto text-xs text-gray-400">Default</span>
                      : <button onClick={() => onRemoveColor(k)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>}
                  </div>
                );
              })}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-[#473AE0] font-medium cursor-pointer">
              <Plus size={16} /> New color
              <input type="color" defaultValue="#473AE0" onChange={(e) => onAddColor(e.target.value)} className="sr-only" />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section detail modal (description + comments + page preview)        */
/* ------------------------------------------------------------------ */
/* basic rich-text editor (bold / italic / underline / list) */
export function RichEditor({ html, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = html || ''; /* set once */ }, []); // eslint-disable-line
  const cmd = (c) => { document.execCommand(c, false); if (ref.current) { ref.current.focus(); onChange(ref.current.innerHTML); } };
  const TB = ({ on, title, children }) => (
    <button onMouseDown={(e) => { e.preventDefault(); on(); }} title={title}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#473AE0]">{children}</button>
  );
  return (
    <div>
      <div className="flex items-center gap-0.5 border-b border-gray-100 pb-2 mb-3">
        <TB on={() => cmd('bold')} title="Bold"><Bold size={15} /></TB>
        <TB on={() => cmd('italic')} title="Italic"><Italic size={15} /></TB>
        <TB on={() => cmd('underline')} title="Underline"><Underline size={15} /></TB>
        <TB on={() => cmd('insertUnorderedList')} title="List"><List size={15} /></TB>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
           onInput={() => onChange(ref.current.innerHTML)}
           data-ph="Add a description…"
           className="min-h-[150px] outline-none text-gray-700 leading-relaxed empty:before:content-[attr(data-ph)] empty:before:text-gray-400" />
    </div>
  );
}

export function SectionDetail({ node, block, onClose, onDescription, onAddComment, onAttachments }) {
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachErr, setAttachErr] = useState('');
  const pcol = resolveColor(node.color);
  const send = () => { if (draft.trim()) { onAddComment(draft); setDraft(''); } };
  const files = block.attachments || [];
  const addFiles = async (fileList) => {
    const list = Array.from(fileList || []); if (!list.length) return;
    setAttachErr(''); setAttachBusy(true);
    try {
      const added = [];
      for (const file of list) {
        if (file.size > 30 * 1024 * 1024) { setAttachErr(`${file.name} is too large (max 30MB).`); continue; }
        const dataUrl = await fileToDataUrl(file); // eslint-disable-line no-await-in-loop
        added.push(await uploadMarkupAttachment(file.name, dataUrl)); // eslint-disable-line no-await-in-loop
      }
      if (added.length) onAttachments([...files, ...added]);
    } catch (e) { setAttachErr(e.message || 'Upload failed'); }
    setAttachBusy(false);
  };
  const removeFile = (fid) => onAttachments(files.filter((f) => f.id !== fid));
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
     <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
      <div className="h-14 px-5 flex items-center justify-between border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-[#473AE0] font-semibold"><ArrowLeft size={18} /> {block.name}</button>
        <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
      </div>
      <div className="flex gap-8 p-6 overflow-auto">
        {/* left: description + comments */}
        <div className="flex-1 min-w-0 max-w-[680px]">
          <div className="rounded-2xl border border-gray-200 p-5">
            <div className="text-lg font-bold mb-3" style={{ color: pcol.solid }}>{block.name}</div>
            <RichEditor html={block.description} onChange={onDescription} />
          </div>

          {/* attachments */}
          <div className="mt-4 rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-700">Files</div>
              <button onClick={() => { setAttachOpen(true); setAttachErr(''); }} className="flex items-center gap-1.5 text-sm text-[#473AE0] font-medium hover:underline"><Paperclip size={15} /> Attach files</button>
            </div>
            {files.length === 0 ? (
              <div className="text-xs text-gray-400">No files yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {files.map((f) => (isImageAtt(f) ? (
                  <div key={f.id} className="relative group">
                    <a href={f.url} target="_blank" rel="noreferrer" title={`Open ${f.name}`}><img src={f.url} alt={f.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" /></a>
                    <button onClick={() => removeFile(f.id)} title="Remove" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 flex items-center justify-center shadow-sm"><X size={11} /></button>
                  </div>
                ) : (
                  <div key={f.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 max-w-[180px]">
                    <FileText size={13} className="text-indigo-500 shrink-0" />
                    <a href={f.url} download={f.name} className="truncate flex-1 hover:underline" title={`${f.name}${f.size ? ` · ${prettySize(f.size)}` : ''}`}>{f.name}</a>
                    <a href={f.url} download={f.name} title="Download" className="text-gray-400 hover:text-[#473AE0]"><Download size={12} /></a>
                    <button onClick={() => removeFile(f.id)} title="Remove" className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                  </div>
                )))}
              </div>
            )}
          </div>
          <div className="mt-6 space-y-3">
            {(block.comments || []).map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <span className="w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: c.color }}>{c.initials}</span>
                <div className="bg-gray-50 rounded-xl px-3 py-2 flex-1">
                  <div className="text-xs font-semibold text-gray-700">{c.author} <span className="text-gray-400 font-normal ml-1">{relTime(c.ts)}</span></div>
                  <div className="text-sm text-gray-700 break-words">{c.text}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <span className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ background: ME.color }}>{ME.initials}</span>
              <div className="flex-1 relative">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                       placeholder="Add a comment…"
                       className="w-full bg-gray-100 rounded-xl pl-4 pr-12 py-3 outline-none text-sm" />
                {draft.trim() && (
                  <button onClick={send} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#473AE0] text-white flex items-center justify-center hover:bg-[#3a2fc0]"><Send size={14} /></button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* right: compact page preview, active section highlighted */}
        <div className="shrink-0">
          <div className="w-60 rounded-2xl border-2" style={{ borderColor: pcol.solid }}>
            <div className="text-center font-bold py-2.5" style={{ color: pcol.solid }}>{node.label}</div>
            <div className="px-2 pb-2 flex flex-col gap-1.5">
              {node.blocks.map((bb) => {
                const bc = resolveColor(bb.color);
                const active = bb.id === block.id;
                return (
                  <div key={bb.id} className="rounded-md px-2 py-2 text-white text-[11px] font-semibold"
                       style={{ background: active ? bc.solid : bc.soft, boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${bc.solid}` : 'none' }}>
                    {bb.name}
                    <div className="mt-1" style={{ color: 'rgba(255,255,255,0.9)', height: 18 }}><FrameGlyph frame={bb.frame || 'bar'} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
     </div>
     {attachOpen && (
       <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/30 p-6" onMouseDown={() => setAttachOpen(false)}>
         <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
           <div className="h-14 px-5 flex items-center justify-between border-b border-gray-100">
             <div className="font-semibold text-gray-800">Attach Files</div>
             <button onClick={() => setAttachOpen(false)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
           </div>
           <div className="p-5">
             <label className={`block border-2 border-dashed rounded-2xl py-10 text-center cursor-pointer transition ${attachBusy ? 'opacity-60 pointer-events-none' : 'border-gray-300 hover:border-[#473AE0] hover:bg-indigo-50/40'}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
               <input type="file" multiple accept={ATTACH_ACCEPT} className="hidden" disabled={attachBusy}
                      onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
               <Paperclip size={26} className="mx-auto text-gray-400 mb-2" />
               <div className="text-sm font-medium text-gray-700">{attachBusy ? 'Uploading…' : 'Click to choose or drop files here'}</div>
               <div className="text-xs text-gray-400 mt-1">Images, PDFs, docs — up to 30MB each</div>
             </label>
             {attachErr && <div className="text-xs text-red-500 mt-3">{attachErr}</div>}
             {files.length > 0 && <div className="text-xs text-gray-500 mt-3">{files.length} file{files.length > 1 ? 's' : ''} attached.</div>}
           </div>
         </div>
       </div>
     )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Files modal — project attachments (Upload / See files tabs)        */
/* ------------------------------------------------------------------ */
export function FilesModal({ files, onSave, onSaved, onClose, readOnly = false }) {
  const saved = Array.isArray(files) ? files : [];
  const hasSaved = saved.length > 0;
  const [tab, setTab] = useState(hasSaved ? 'see' : 'upload');
  const [staged, setStaged] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);

  const addFiles = async (fileList) => {
    const list = Array.from(fileList || []); if (!list.length) return;
    setErr(''); setBusy(true);
    const added = [];
    for (const file of list) {
      if (file.size > 30 * 1024 * 1024) { setErr(`${file.name} is too large (max 30MB).`); continue; }
      try {
        const dataUrl = await fileToDataUrl(file); // eslint-disable-line no-await-in-loop
        added.push(await uploadMarkupAttachment(file.name, dataUrl)); // eslint-disable-line no-await-in-loop
      } catch (e) { setErr(e.message || 'Upload failed'); }
    }
    if (added.length) setStaged((s) => [...s, ...added]);
    setBusy(false);
  };
  const removeStaged = (id) => setStaged((s) => s.filter((f) => f.id !== id));
  const removeSaved = (id) => onSave(saved.filter((f) => f.id !== id));
  const save = () => { onSave([...saved, ...staged]); onSaved?.(); setStaged([]); onClose(); };

  const SUPPORTS = 'Supports: JPG, JPEG, PNG, SVG, BMP, GIF, PDF, PSD, AI, EPS, TIFF, RTF, TXT, DOCX, PAGES, ODT, PPTX, ODP, KEY, XLSX, CSV, MP4';
  const dropZone = (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
      className={`block border-2 border-dashed rounded-2xl py-16 text-center cursor-pointer transition ${busy ? 'opacity-60 pointer-events-none' : ''} ${drag ? 'border-[#473AE0] bg-indigo-50/60' : 'border-indigo-200 bg-gray-50/60 hover:border-[#473AE0] hover:bg-indigo-50/40'}`}>
      <input type="file" multiple accept={ATTACH_ACCEPT} className="hidden" disabled={busy}
             onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      <Upload size={30} className="mx-auto text-gray-400 mb-3" />
      <div className="text-[15px] text-gray-600">{busy ? 'Uploading…' : 'Drag & drop files here, or click to browse'}</div>
    </label>
  );

  const fileRow = (f, onRemove, withDownload) => (
    <div key={f.id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3">
      {withDownload
        ? (isImageAtt(f) ? <img src={f.url} alt="" className="w-9 h-9 rounded object-cover shrink-0" /> : <FileText size={18} className="text-indigo-500 shrink-0" />)
        : <Check size={18} className="text-green-500 shrink-0" />}
      <div className="flex-1 min-w-0 text-[15px] text-gray-800 truncate" title={f.name}>{f.name}</div>
      <div className="text-sm text-gray-400 shrink-0">{prettySize(f.size)}</div>
      {withDownload && <a href={f.url} download={f.name} target="_blank" rel="noreferrer" title="Download" className="text-gray-400 hover:text-[#473AE0] shrink-0"><Download size={17} /></a>}
      {!readOnly && onRemove && <button onClick={onRemove} title="Remove" className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={17} /></button>}
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="h-14 px-5 flex items-center justify-between border-b border-gray-100 shrink-0">
          <div className="font-bold text-gray-900">{staged.length ? `${staged.length} Attached File${staged.length > 1 ? 's' : ''}` : 'Attach Files'}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center"><X size={16} /></button>
        </div>

        {/* tabs (only when there are already saved files) */}
        {hasSaved && (
          <div className="flex gap-1 px-5 pt-3 border-b border-gray-100 shrink-0">
            {[['upload', 'Upload'], ['see', `See files (${saved.length})`]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                      className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px border-b-2 ${tab === k ? 'border-[#473AE0] text-[#473AE0]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'see' && hasSaved ? (
            <div className="space-y-2">{saved.map((f) => fileRow(f, () => removeSaved(f.id), true))}</div>
          ) : staged.length ? (
            <>
              <div className="text-sm text-gray-500 mb-4">Heads up: Larger files can take longer to process.</div>
              <div className="space-y-2">{staged.map((f) => fileRow(f, () => removeStaged(f.id), false))}</div>
              {!readOnly && (
                <label className="mt-3 inline-flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 cursor-pointer hover:border-[#473AE0] hover:text-[#473AE0]">
                  <input type="file" multiple accept={ATTACH_ACCEPT} className="hidden" disabled={busy}
                         onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                  <Plus size={16} /> Add More Files
                </label>
              )}
            </>
          ) : readOnly ? (
            <div className="text-center text-sm text-gray-400 py-10">No files attached.</div>
          ) : dropZone}

          {err && <div className="text-sm text-red-500 mt-3">{err}</div>}
          <div className="text-xs text-gray-400 mt-5 leading-relaxed">{SUPPORTS}</div>
        </div>

        {staged.length > 0 && !readOnly && (
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button onClick={() => { setStaged([]); onClose(); }} className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={busy} className="px-7 py-2.5 rounded-full bg-[#473AE0] text-white text-sm font-semibold hover:bg-[#3a2fc0] disabled:opacity-50">Save</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Export menu (JSON / XML / CSV + backup / load)                     */
/* ------------------------------------------------------------------ */
export function ExportMenu({ nodes, childrenOf, onClose, setNodes }) {
  const download = (content, filename, type) => {
    const a = document.createElement('a');
    a.href = `data:${type};charset=utf-8,${encodeURIComponent(content)}`;
    a.download = filename;
    a.click();
    onClose();
  };
  const escapeXML = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

  const hierarchy = (pid = null) =>
    childrenOf(pid).map((n) => ({ label: n.label, color: n.color,
      blocks: n.blocks.map((b) => ({ name: b.name, color: b.color })), children: hierarchy(n.id) }));

  const exportJSON = () => download(JSON.stringify(hierarchy(), null, 2), 'sitemap.json', 'application/json');
  const exportXML = () => {
    const build = (pid = null, indent = '  ') =>
      childrenOf(pid).map((n) => {
        const kids = childrenOf(n.id);
        const inner = kids.length ? `\n${build(n.id, indent + '  ')}\n${indent}` : '';
        return `${indent}<page label="${escapeXML(n.label)}">${inner}</page>`;
      }).join('\n');
    download(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemap>\n${build()}\n</sitemap>`, 'sitemap.xml', 'application/xml');
  };
  const exportCSV = () => {
    let csv = 'Label,Depth,Blocks\n';
    const walk = (pid = null, d = 0) => childrenOf(pid).forEach((n) => {
      csv += `"${n.label}",${d},"${n.blocks.map((b) => b.name).join(' | ')}"\n`;
      walk(n.id, d + 1);
    });
    walk();
    download(csv, 'sitemap.csv', 'text/csv');
  };
  const exportTXT = () => {
    let txt = '';
    const walk = (pid = null, d = 0) => childrenOf(pid).forEach((n) => {
      txt += `${'  '.repeat(d)}- ${n.label}${n.link ? ' (' + n.link + ')' : ''}\n`;
      walk(n.id, d + 1);
    });
    walk();
    download(txt, 'sitemap.txt', 'text/plain');
  };
  const backup = () => download(JSON.stringify(nodes, null, 2), 'sitemap-backup.json', 'application/json');
  const load = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('not an array');
        setNodes(data);
        onClose();
      } catch (err) { alert('Invalid file — expected a sitemap backup (.json).'); }
    };
    r.readAsText(f);
  };

  const item = 'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50';
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 px-3 pt-1 pb-0.5 uppercase tracking-wide">Export</div>
      <button className={item} onClick={exportJSON}><Download size={15} /> JSON</button>
      <button className={item} onClick={exportXML}><Download size={15} /> Sitemap XML</button>
      <button className={item} onClick={exportCSV}><Download size={15} /> CSV</button>
      <button className={item} onClick={exportTXT}><Download size={15} /> TXT</button>
      <div className="h-px bg-gray-100 my-1" />
      <div className="text-[10px] font-semibold text-gray-400 px-3 pt-1 pb-0.5 uppercase tracking-wide">Import / Backup</div>
      <label className={item + ' cursor-pointer'}><Upload size={15} /> Import JSON
        <input type="file" accept=".json,application/json" onChange={load} className="hidden" />
      </label>
      <button className={item} onClick={backup}><Save size={15} /> Backup (.json)</button>
    </div>
  );
}
