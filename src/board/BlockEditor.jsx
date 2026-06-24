import React, { useEffect, useRef } from 'react';
import '@blocknote/core/fonts/inter.css';
import { BlockNoteSchema, defaultBlockSpecs, insertOrUpdateBlockForSlashMenu as insertOrUpdateBlock, filterSuggestionItems } from '@blocknote/core';
import { useCreateBlockNote, createReactBlockSpec, getDefaultReactSlashMenuItems, SuggestionMenuController } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import './notion-theme.css';
import { Minus, Info, Bookmark, Search } from 'lucide-react';
import { uploadMarkupAttachment, hasBackend } from '../markup/markupApi';

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

// Upload handler for BlockNote media blocks (image / video / audio / file).
async function uploadFile(file) {
  const dataUrl = await fileToDataUrl(file);
  if (hasBackend()) {
    const att = await uploadMarkupAttachment(file.name, dataUrl);
    return att.url;
  }
  return dataUrl;
}

const hostOf = (u) => {
  try { return new URL(/^https?:\/\//.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); }
  catch (e) { return ''; }
};

/* ----------------------- custom blocks (Notion-style) ----------------------- */

// Callout — highlighted box with an editable emoji + inline content.
const Callout = createReactBlockSpec(
  { type: 'callout', propSchema: { emoji: { default: '💡' } }, content: 'inline' },
  {
    render: (props) => (
      <div className="bn-callout">
        <div className="bn-callout-emoji" contentEditable={false}
             onClick={() => { const e = window.prompt('Emoji', props.block.props.emoji); if (e !== null) props.editor.updateBlock(props.block, { props: { emoji: e || '💡' } }); }}>
          {props.block.props.emoji}
        </div>
        <div className="bn-callout-body" ref={props.contentRef} />
      </div>
    ),
  }
);

// Divider — visual separator.
const Divider = createReactBlockSpec(
  { type: 'divider', propSchema: {}, content: 'none' },
  { render: () => (<div className="bn-divider" contentEditable={false}><hr /></div>) }
);

// Web bookmark — paste a link, shows it as a card (favicon + title + host).
const Bookmark2 = createReactBlockSpec(
  { type: 'bookmark', propSchema: { url: { default: '' }, title: { default: '' }, host: { default: '' } }, content: 'none' },
  {
    render: (props) => {
      const { url, title, host } = props.block.props;
      if (!url) {
        return (
          <div className="bn-bookmark-empty" contentEditable={false}>
            <Bookmark size={16} color="#9B9A97" />
            <input autoFocus placeholder="Paste a link and press Enter…"
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       const u = e.target.value.trim();
                       if (u) { const h = hostOf(u); props.editor.updateBlock(props.block, { props: { url: u, host: h, title: h || u } }); }
                     }
                   }} />
          </div>
        );
      }
      const href = /^https?:\/\//.test(url) ? url : 'https://' + url;
      return (
        <a className="bn-bookmark" href={href} target="_blank" rel="noreferrer" contentEditable={false}>
          <div className="bn-bookmark-text">
            <div className="bn-bookmark-title">{title || url}</div>
            <div className="bn-bookmark-host">{host || url}</div>
          </div>
          {host && <img className="bn-bookmark-fav" src={`https://logo.clearbit.com/${host}`} alt="" onError={(e) => { e.target.style.display = 'none'; }} />}
        </a>
      );
    },
  }
);

// NOTE: in BlockNote 0.51 createReactBlockSpec returns a *factory* — call it to get the spec.
const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, callout: Callout(), divider: Divider(), bookmark: Bookmark2() },
});

// extra slash-menu items for the custom blocks
const customSlashItems = (editor) => [
  {
    title: 'Callout', subtext: 'Make text stand out in a box', aliases: ['callout', 'note', 'info'],
    group: 'Basic blocks', icon: <Info size={18} />,
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'callout' }),
  },
  {
    title: 'Divider', subtext: 'Visually separate blocks', aliases: ['divider', 'hr', 'line', '---'],
    group: 'Basic blocks', icon: <Minus size={18} />,
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'divider' }),
  },
  {
    title: 'Web bookmark', subtext: 'Save a link as a visual card', aliases: ['bookmark', 'link', 'url', 'web'],
    group: 'Media', icon: <Bookmark size={18} />,
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'bookmark' }),
  },
];

// the live slash query (set in getItems on each keystroke, read by the menu's search header)
let currentQuery = '';

// Close the slash menu by sending Escape to the focused editor (ProseMirror handles it).
const closeSlash = () => {
  const ae = document.activeElement;
  if (ae) ae.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
};

/* Notion-style slash menu: grouped, compact rows (icon + title + subtext + shortcut),
   internal scroll, and a "Close menu / esc" footer. */
function NotionSlashMenu({ items, selectedIndex, onItemClick }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current && scrollRef.current.querySelector('[data-sel="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // keep BlockNote's order, but cluster consecutive items by group
  const groups = [];
  items.forEach((it, i) => {
    const name = it.group || '';
    let g = groups[groups.length - 1];
    if (!g || g.name !== name) { g = { name, rows: [] }; groups.push(g); }
    g.rows.push({ it, i });
  });

  return (
    <div className="bn-slash" onMouseDown={(e) => e.preventDefault()}>
      <div className="bn-slash-search">
        <Search size={15} />
        {currentQuery ? <span className="q">{currentQuery}</span> : <span className="ph">Search for a block…</span>}
      </div>
      <div ref={scrollRef} className="bn-slash-scroll">
        {items.length === 0 && <div className="bn-slash-empty">No results</div>}
        {groups.map((g, gi) => (
          <div key={gi} className="bn-slash-group">
            {g.name && <div className="bn-slash-label">{g.name}</div>}
            {g.rows.map(({ it, i }) => (
              <button key={i} type="button" data-sel={i === selectedIndex}
                      onClick={() => onItemClick && onItemClick(it)}
                      className="bn-slash-item">
                <span className="bn-slash-ic">{it.icon}</span>
                <span className="bn-slash-txt">
                  <span className="bn-slash-title">{it.title}</span>
                  {it.subtext && <span className="bn-slash-sub">{it.subtext}</span>}
                </span>
                {it.badge && <span className="bn-slash-badge">{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="bn-slash-close" onClick={closeSlash}>
        <span>Close menu</span><span className="bn-slash-badge">esc</span>
      </button>
    </div>
  );
}

/**
 * Notion-style block editor (BlockNote) used inside a board Text element.
 * - `initialContent`: array of BlockNote blocks (or undefined for an empty doc).
 * - `onChange(blocks)`: called with the document blocks on every edit.
 * - `focused`: when it flips true, the editor takes focus (used on double-click to edit).
 */
export default function BlockEditor({ initialContent, onChange, editable = true, focused = false }) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent && initialContent.length ? initialContent : undefined,
    uploadFile,
  });

  useEffect(() => {
    if (focused) { try { editor.focus(); } catch (e) { /* ignore */ } }
  }, [focused, editor]);

  // Add `n` empty paragraphs after the end of the document, then put the cursor in the
  // last one. Lets the user click far below the content and start typing right there.
  const addLinesAndFocus = (n) => {
    try {
      const doc = editor.document;
      const last = doc[doc.length - 1];
      if (!last) { editor.focus(); return; }
      const lastEmpty = last.type === 'paragraph' && (!last.content || last.content.length === 0);
      // if the last block is already an empty paragraph it counts as the first line
      const toInsert = Math.max(0, lastEmpty ? n - 1 : n);
      let target = last;
      if (toInsert > 0) {
        const news = Array.from({ length: toInsert }, () => ({ type: 'paragraph' }));
        const inserted = editor.insertBlocks(news, last, 'after');
        if (inserted && inserted.length) target = inserted[inserted.length - 1];
      } else if (!lastEmpty) {
        const inserted = editor.insertBlocks([{ type: 'paragraph' }], last, 'after');
        if (inserted && inserted[0]) target = inserted[0];
      }
      editor.setTextCursorPosition(target, 'end');
      editor.focus();
    } catch (e) { /* ignore */ }
  };

  // Click in the empty area below the content → drop the cursor near where you clicked
  // (insert blank lines to reach that vertical position). Clicks on a block are left
  // to the editor so it places the cursor normally.
  const onWrapMouseDown = (e) => {
    if (!editable) return;
    const blocks = e.currentTarget.querySelectorAll('.bn-block-outer');
    const lastEl = blocks[blocks.length - 1];
    if (!lastEl) return;
    const rect = lastEl.getBoundingClientRect();
    if (e.clientY <= rect.bottom) return; // clicked on the content itself
    e.preventDefault();
    const lineH = 30; // approx height of one empty paragraph line
    const lines = Math.max(1, Math.min(Math.round((e.clientY - rect.bottom) / lineH), 60));
    addLinesAndFocus(lines);
  };

  return (
    <div className="bn-fill" style={{ minHeight: '100%', cursor: 'text' }} onMouseDown={onWrapMouseDown}>
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="light"
        slashMenu={false}
        onChange={() => onChange && onChange(editor.document)}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          suggestionMenuComponent={NotionSlashMenu}
          getItems={async (query) => {
            currentQuery = query;
            return filterSuggestionItems(
              [...getDefaultReactSlashMenuItems(editor), ...customSlashItems(editor)],
              query
            );
          }}
        />
      </BlockNoteView>
    </div>
  );
}
