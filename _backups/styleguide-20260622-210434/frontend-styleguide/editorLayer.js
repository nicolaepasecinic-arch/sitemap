/* ------------------------------------------------------------------ */
/*  Editor layer injected into the style-guide iframe (same-origin).    */
/*                                                                      */
/*  Everything is edited DIRECTLY on the element via a small inline      */
/*  popover anchored next to it (same idea as the colour swatches):      */
/*   - colour swatch  → colour picker + live hex + Add / Delete          */
/*   - any other el   → section-scoped fields (type / spacing / …),      */
/*     text, link, Add / Delete, and Download for images / logos.        */
/*  Add respects layout: a columns row gets a NEW COLUMN (max 6),        */
/*  a stacked list gets a NEW ROW. The sidebar only lists global tokens. */
/*  The whole layer is stripped by window.__sg.serialize().             */
/* ------------------------------------------------------------------ */

const RUNTIME = `(function () {
  var DOC = document, ROOT = DOC.documentElement, BODY = DOC.body;
  var pop = null, target = null;
  function post(type, extra) { try { parent.postMessage(Object.assign({ source: 'sg-editor', type: type }, extra || {}), '*'); } catch (e) {} }
  function dirty() { post('dirty'); }
  function isUi(n) { return n && n.closest && (n.closest('#sg-pop') || n.closest('#sg-pick') || n.closest('#sg-fontpick')); }

  ['#studio','#studio-toggle','#studio-toast','#studio-style','#studio-script'].forEach(function (s) {
    var n = DOC.querySelector(s); if (n) n.remove();
  });
  var cover = DOC.querySelector('header.cover'); if (cover) cover.remove();

  var st = DOC.createElement('style'); st.id = 'sg-style';
  st.textContent = '.sg-sel{outline:2px solid #473AE0 !important;outline-offset:3px;border-radius:6px}'
    + '.sg-hov{outline:1px dashed rgba(71,58,224,.5) !important;outline-offset:2px}'
    + '.tocnav{display:none !important}nav:has(.tocnav){display:none !important}'
    + '.feat>.sw,.strip .sw,.semantic .item{cursor:pointer}'
    + '#sg-pop{position:fixed;z-index:2147483600;width:248px;max-height:78vh;overflow:auto;background:#fff;border:1px solid #e7e7ef;border-radius:14px;box-shadow:0 14px 44px rgba(20,16,60,.20);padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;color:#1f2430}'
    + '#sg-pop *{box-sizing:border-box}'
    + '#sg-pop .h{display:flex;align-items:center;justify-content:space-between;font-weight:700;color:#473AE0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}'
    + '#sg-pop .h .x{cursor:pointer;border:none;background:transparent;color:#9aa0ad;font-size:16px;line-height:1}'
    + '#sg-pop .r{margin-bottom:8px}'
    + '#sg-pop label{display:block;font-size:10px;font-weight:600;color:#7a7f8c;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px}'
    + '#sg-pop input,#sg-pop select,#sg-pop textarea{width:100%;border:1px solid #e2e2ec;border-radius:8px;padding:6px 8px;font-size:12px;outline:none;background:#f7f7fb}'
    + '#sg-pop textarea{resize:vertical;min-height:44px}'
    + '#sg-pop input:focus,#sg-pop select:focus,#sg-pop textarea:focus{border-color:#473AE0;background:#fff}'
    + '#sg-pop .two{display:flex;gap:8px}#sg-pop .two>div{flex:1}'
    + '#sg-pop input[type=color]{height:32px;padding:2px;cursor:pointer;background:#fff}'
    + '#sg-pop .cwrap{display:flex;gap:6px;align-items:center}#sg-pop .cwrap input[type=color]{width:38px}#sg-pop .cwrap input[type=text]{flex:1;font-family:monospace;text-transform:uppercase}'
    + '#sg-pop .btns{display:flex;gap:8px;margin-top:4px}'
    + '#sg-pop .btns button{flex:1;border:none;border-radius:9px;padding:8px;font-size:12px;font-weight:600;cursor:pointer}'
    + '#sg-pop .add{background:#eef0ff;color:#473AE0}#sg-pop .del{background:#fde8e8;color:#e0413e}'
    + '#sg-pop .dl{width:100%;border:none;border-radius:9px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;background:#f1f1f4;color:#374151;margin-top:6px}'
    + '#sg-pop .adv{width:100%;text-align:left;border:none;background:transparent;color:#7a7f8c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;padding:8px 0 6px;margin-top:6px;border-top:1px solid #eee}'
    + '#sg-pop .roles{display:grid;grid-template-columns:1fr 1fr;gap:5px 8px;margin-top:2px}'
    + '#sg-pop .roles label{display:flex;align-items:center;gap:6px;font-size:12px;text-transform:none;letter-spacing:0;color:#1f2430;font-weight:500;margin:0}'
    + '#sg-pop .roles input{width:auto;margin:0}'
    + '#sg-pick{position:fixed;inset:0;z-index:2147483646;background:rgba(20,16,60,.45);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
    + '#sg-pick .hd{color:#fff;font-weight:700;margin-bottom:12px}'
    + '#sg-pick .gr{display:grid;grid-template-columns:repeat(4,90px);gap:12px;max-width:520px;max-height:60vh;overflow:auto;background:#fff;border-radius:14px;padding:14px}'
    + '#sg-pick .gr img{width:90px;height:64px;object-fit:contain;border:1px solid #e7e7ef;border-radius:8px;background:#faf9fe;cursor:pointer;padding:4px}'
    + '#sg-pick .gr img:hover{border-color:#473AE0}'
    + '#sg-pick .cl{margin-top:14px;background:#fff;border:none;border-radius:9px;padding:8px 18px;font-weight:600;cursor:pointer}'
    + '#sg-pop .fontbtn{width:100%;text-align:left;border:1px solid #e2e2ec;border-radius:8px;padding:7px 9px;font-size:13px;background:#f7f7fb;color:#1f2430;cursor:pointer;display:flex;align-items:center;justify-content:space-between}'
    + '#sg-pop .fontbtn:hover{border-color:#473AE0;background:#fff}'
    + '#sg-fontpick{position:fixed;top:0;right:0;height:100%;width:340px;max-width:92vw;z-index:2147483647;background:#fff;box-shadow:-10px 0 40px rgba(20,16,60,.18);display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
    + '#sg-fontpick .hd{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eee;font-weight:700;color:#1f2430;font-size:15px}'
    + '#sg-fontpick .hd button{border:none;background:transparent;font-size:18px;color:#9aa0ad;cursor:pointer}'
    + '#sg-fontpick .sb{margin:12px 16px;display:flex;align-items:center;gap:8px;background:#f1f1f4;border-radius:10px;padding:9px 12px;color:#9aa0ad}'
    + '#sg-fontpick .sb input{border:none;background:transparent;outline:none;font-size:14px;width:100%;color:#1f2430}'
    + '#sg-fontpick .ls{flex:1;overflow:auto;padding:4px 10px 16px}'
    + '#sg-fontpick .ft{padding:11px 14px;border-radius:10px;font-size:20px;line-height:1.1;color:#1f2430;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '#sg-fontpick .ft:hover{background:#f4f4f8}'
    + '#sg-fontpick .ft.sel{background:#3b6cff;color:#fff}';
  ROOT.appendChild(st);

  function px(v) { v = parseFloat(v); return isNaN(v) ? 0 : Math.round(v); }
  function rgbToHex(c) {
    if (!c) return '#000000';
    if (c[0] === '#') return c;
    var m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return '#000000';
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    function h(n) { n = Math.max(0, Math.min(255, Math.round(n))); return ('0' + n.toString(16)).slice(-2); }
    return '#' + h(p[0]) + h(p[1]) + h(p[2]);
  }
  function cs(el, prop) { return getComputedStyle(el).getPropertyValue(prop); }
  function sectionOf(el) { var s = el && el.closest ? el.closest('section[id]') : null; return s ? s.id : ''; }

  /* ---- layout-aware add: columns → new column (max 6); rows → new row ---- */
  function isColumns(parent) {
    var s = getComputedStyle(parent);
    if (s.display.indexOf('flex') >= 0) return s.flexDirection.indexOf('row') === 0;
    if (s.display.indexOf('grid') >= 0) {
      return (s.gridTemplateColumns || 'none').split(' ').filter(function (x) { return x && x !== 'none'; }).length > 1;
    }
    return false;
  }
  function addSibling(el) {
    var p = el.parentElement; if (!p) return 'err';
    var cols = isColumns(p);
    if (cols && p.children.length >= 6) return 'max';
    var c = el.cloneNode(true);
    c.classList.remove('sg-sel'); c.classList.remove('sg-hov');
    p.insertBefore(c, el.nextSibling);
    if (cols && getComputedStyle(p).display.indexOf('grid') >= 0) {
      p.style.gridTemplateColumns = 'repeat(' + p.children.length + ', 1fr)'; // make it a real new column
    }
    dirty(); return 'ok';
  }

  /* ---- which fields to show for an element, by its section (a base hint) ---- */
  function fieldsFor(section) {
    if (section === 'colors') return ['color', 'background', 'radius'];
    if (section === 'type') return ['color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign'];
    if (section === 'spacing') return ['padding', 'marginY', 'radius', 'border'];
    if (section === 'forms') return ['color', 'background', 'border', 'radius', 'padding', 'fontSize'];
    if (section === 'components') return ['color', 'background', 'fontSize', 'fontWeight', 'padding', 'radius', 'border'];
    if (section === 'brand') return ['color', 'background', 'fontSize', 'padding', 'radius'];
    return ['color', 'background', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'padding', 'marginY', 'radius', 'border'];
  }
  // Is this an interactive control (gets a hover state)?
  function isInteractive(el) {
    var tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'A') return true;
    if (tag === 'INPUT') { var ty = (el.getAttribute('type') || '').toLowerCase(); return ty === 'submit' || ty === 'button' || ty === 'reset'; }
    if (el.classList && (el.classList.contains('btn') || el.classList.contains('button') || el.classList.contains('chip'))) return true;
    if ((el.getAttribute('role') || '') === 'button') return true;
    return false;
  }
  // Union the section hint with element-type defaults, so EVERY element exposes all the
  // controls that make sense for it (a table cell in "spacing" still gets colour/size/etc.).
  function fieldsForEl(el, section) {
    var set = {};
    fieldsFor(section).forEach(function (f) { set[f] = 1; });
    var tag = el.tagName;
    var textTags = /^(P|SPAN|A|LI|TD|TH|H1|H2|H3|H4|H5|H6|BUTTON|LABEL|STRONG|EM|SMALL|B|I|BLOCKQUOTE|FIGCAPTION|DT|DD|CODE)$/;
    var boxTags = /^(DIV|SECTION|BUTTON|A|TD|TH|TR|LI|UL|OL|INPUT|TEXTAREA|SELECT|ARTICLE|ASIDE|HEADER|FOOTER|FORM|FIELDSET|FIGURE|NAV|TABLE)$/;
    var hasText = el.childElementCount === 0 && el.textContent && el.textContent.trim();
    if (hasText || textTags.test(tag)) { ['color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign'].forEach(function (f) { set[f] = 1; }); }
    if (boxTags.test(tag) || isInteractive(el)) { ['background', 'padding', 'radius', 'border'].forEach(function (f) { set[f] = 1; }); }
    return Object.keys(set);
  }

  // A spacing/token DISPLAY element: a ".chip" ("--token: 12px") or a ".val" whose sibling
  // ".name" holds the token. Returns the token + its value + how to update the visible text.
  function tokenDisplay(el) {
    if (el.classList && el.classList.contains('chip')) {
      var m = el.textContent.match(/(--[a-z0-9-]+)\\s*:\\s*(.+)/i);
      if (m) return { token: m[1], value: m[2].trim(), setDisplay: function (v) { el.textContent = m[1] + ': ' + v; } };
    }
    if (el.classList && (el.classList.contains('val') || el.classList.contains('name'))) {
      var row = el.parentElement;
      var nm = row && row.querySelector('.name');
      var vl = row && row.querySelector('.val');
      var t = nm ? (nm.textContent.match(/--[a-z0-9-]+/) || [])[0] : '';
      if (t && vl) return { token: t, value: vl.textContent.trim(), setDisplay: function (v) { vl.textContent = v; } };
    }
    return null;
  }

  /* ---- colour swatch detection ---- */
  function swatchOf(el) {
    if (!el || !el.closest) return null;
    var sw = el.closest('.sw');
    if (sw && sw.parentElement) {
      var pc = sw.parentElement.classList;
      if (pc.contains('feat')) return { sw: sw, colorEl: sw, hxEl: sw.querySelector('.hx') };
      if (pc.contains('strip')) return { sw: sw, colorEl: sw.querySelector('.box') || sw, hxEl: sw.querySelector('.hx') };
    }
    var item = el.closest('.semantic .item');
    if (item) return { sw: item, colorEl: item.querySelector('.dot') || item, hxEl: null, token: (item.querySelector('.token') ? item.querySelector('.token').textContent.trim() : '') };
    return null;
  }

  function closePop() { if (pop) { pop.remove(); pop = null; } if (target) { target.classList.remove('sg-sel'); target = null; } ['sg-pick', 'sg-fontpick'].forEach(function (i) { var n = DOC.getElementById(i); if (n) n.remove(); }); }
  function mkPop() { closePop(); pop = DOC.createElement('div'); pop.id = 'sg-pop'; ROOT.appendChild(pop); }
  function header(title) {
    var h = DOC.createElement('div'); h.className = 'h';
    h.innerHTML = '<span>' + title + '</span>';
    var x = DOC.createElement('button'); x.className = 'x'; x.textContent = '\\u00d7';
    x.onclick = closePop; h.appendChild(x); pop.appendChild(h);
  }
  function row(label, ctrl) { var r = DOC.createElement('div'); r.className = 'r'; var l = DOC.createElement('label'); l.textContent = label; r.appendChild(l); r.appendChild(ctrl); return r; }
  function colorField(label, getHex, set) {
    var wrap = DOC.createElement('div'); wrap.className = 'cwrap';
    var ci = DOC.createElement('input'); ci.type = 'color'; try { ci.value = getHex(); } catch (e) {}
    var ti = DOC.createElement('input'); ti.type = 'text'; ti.value = getHex().toUpperCase();
    ci.addEventListener('input', function () { ti.value = ci.value.toUpperCase(); set(ci.value); });
    ti.addEventListener('input', function () { var v = ti.value.trim(); if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return; try { ci.value = v; } catch (e) {} set(v); });
    wrap.appendChild(ci); wrap.appendChild(ti); return row(label, wrap);
  }
  function numField(label, val, step, set) { var i = DOC.createElement('input'); i.type = 'number'; i.step = step || '1'; i.value = val; i.addEventListener('input', function () { set(i.value); }); return row(label, i); }
  function selField(label, val, opts, set) { var s = DOC.createElement('select'); opts.forEach(function (o) { var op = DOC.createElement('option'); op.value = o; op.textContent = o; s.appendChild(op); }); s.value = val; s.addEventListener('change', function () { set(s.value); }); return row(label, s); }

  /* ---- Google Fonts ---- */
  var GOOGLE_FONTS = ['Abel','Abril Fatface','Alegreya','Alegreya Sans','Anton','Archivo','Archivo Black','Archivo Narrow','Arimo','Arvo','Asap','Assistant','Barlow','Barlow Condensed','Be Vietnam Pro','Bebas Neue','Bitter','Bricolage Grotesque','Cabin','Cairo','Cormorant Garamond','DM Sans','DM Serif Display','Figtree','Fira Sans','Fraunces','Heebo','IBM Plex Mono','IBM Plex Sans','IBM Plex Serif','Inter','Josefin Sans','Karla','Lato','Libre Baskerville','Libre Franklin','Lora','Manrope','Merriweather','Montserrat','Mulish','Nunito','Nunito Sans','Open Sans','Oswald','Outfit','Plus Jakarta Sans','Playfair Display','Poppins','PT Serif','Public Sans','Quicksand','Raleway','Roboto','Roboto Condensed','Roboto Mono','Roboto Slab','Rubik','Sora','Source Sans Pro','Source Serif Pro','Space Grotesk','Spectral','Work Sans'];
  function ensureFont(name) {
    var id = 'sgfont-' + name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    if (DOC.getElementById(id)) return;
    var l = DOC.createElement('link'); l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@300;400;500;600;700;800&display=swap';
    (DOC.head || ROOT).appendChild(l);
  }
  // Load every listed font once (for the picker previews), in two requests to keep URLs sane.
  function ensureAllFonts() {
    if (DOC.getElementById('sg-allfonts')) return;
    var half = Math.ceil(GOOGLE_FONTS.length / 2);
    [GOOGLE_FONTS.slice(0, half), GOOGLE_FONTS.slice(half)].forEach(function (group, i) {
      var fams = group.map(function (f) { return 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600'; });
      var l = DOC.createElement('link'); l.id = i === 0 ? 'sg-allfonts' : 'sg-allfonts2'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?' + fams.join('&') + '&display=swap';
      (DOC.head || ROOT).appendChild(l);
    });
  }
  // The Canva-style searchable font panel. cb(fontName) on pick.
  function openFontPicker(current, cb) {
    ensureAllFonts();
    var ex = DOC.getElementById('sg-fontpick'); if (ex) ex.remove();
    var ov = DOC.createElement('div'); ov.id = 'sg-fontpick';
    var hd = DOC.createElement('div'); hd.className = 'hd'; hd.innerHTML = '<span>Fonts</span>';
    var x = DOC.createElement('button'); x.textContent = '\\u00d7'; x.onclick = function (e) { e.stopPropagation(); ov.remove(); }; hd.appendChild(x); ov.appendChild(hd);
    var sb = DOC.createElement('div'); sb.className = 'sb';
    var si = DOC.createElement('input'); si.type = 'text'; si.placeholder = 'Search'; sb.appendChild(si); ov.appendChild(sb);
    var ls = DOC.createElement('div'); ls.className = 'ls'; ov.appendChild(ls);
    function render(q) {
      ls.innerHTML = '';
      GOOGLE_FONTS.filter(function (f) { return !q || f.toLowerCase().indexOf(q.toLowerCase()) >= 0; }).forEach(function (f) {
        var r = DOC.createElement('div'); r.className = 'ft' + (f === current ? ' sel' : ''); r.textContent = f; r.style.fontFamily = '"' + f + '"';
        r.onclick = function (e) { e.stopPropagation(); cb(f); ov.remove(); };
        ls.appendChild(r);
      });
    }
    render('');
    si.addEventListener('input', function () { render(si.value); });
    ROOT.appendChild(ov); setTimeout(function () { si.focus(); }, 30);
  }
  // A field that looks like an input but opens the font picker.
  function fontButton(label, getCur, onPick) {
    var b = DOC.createElement('button'); b.className = 'fontbtn';
    function paint() { var f = getCur(); b.innerHTML = ''; var sp = DOC.createElement('span'); sp.textContent = f || 'Choose a font'; sp.style.fontFamily = f ? '"' + f + '"' : 'inherit'; var ch = DOC.createElement('span'); ch.textContent = '\\u25be'; ch.style.color = '#9aa0ad'; b.appendChild(sp); b.appendChild(ch); }
    paint();
    b.onclick = function (e) { e.stopPropagation(); openFontPicker(getCur(), function (f) { onPick(f); paint(); }); };
    return row(label, b);
  }
  function fontField(el) {
    return fontButton('Font family (Google Fonts)',
      function () { return (cs(el, 'font-family') || '').split(',')[0].replace(/["']/g, '').trim(); },
      function (f) { ensureFont(f); el.style.fontFamily = '"' + f + '", sans-serif'; dirty(); });
  }

  /* ---- apply a font to whole roles (H1…Nav) at once, persistently ---- */
  var ROLES = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Body', 'Buttons', 'Nav'];
  var ROLE_SEL = { H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h5', H6: 'h6', Body: 'body,p,li,.desc', Buttons: 'button,.btn', Nav: 'nav a,.nav-demo a,.nlinks a' };
  var roleFonts = {};
  function fontsStyle() { var s = DOC.getElementById('sg-fonts'); if (!s) { s = DOC.createElement('style'); s.id = 'sg-fonts'; (DOC.head || ROOT).appendChild(s); } return s; }
  function rebuildFonts() {
    var css = '';
    Object.keys(roleFonts).forEach(function (role) { var sel = ROLE_SEL[role]; if (sel) css += sel + '{font-family:"' + roleFonts[role] + '", sans-serif !important;}\\n'; });
    fontsStyle().textContent = css;
  }
  // typography specimens use inline font-family:var(--font-…), so also set them inline by tag.
  function setSpecimenFont(role, font) {
    DOC.querySelectorAll('.typerow').forEach(function (tr) {
      var tag = tr.querySelector('.tag'); var spec = tr.querySelector('.specimen');
      if (tag && spec && tag.textContent.trim().toUpperCase() === role.toUpperCase()) spec.style.setProperty('font-family', '"' + font + '", sans-serif', 'important');
    });
  }
  function applyRoleFont(role, font) { roleFonts[role] = font; ensureFont(font); rebuildFonts(); setSpecimenFont(role, font); }

  // Font-family card (the .fam blocks): choose a font + tick which roles it applies to.
  function openFontCard(famEl) {
    mkPop(); target = famEl; target.classList.add('sg-sel');
    header('Font family');
    var cur = (cs(famEl, 'font-family') || '').split(',')[0].replace(/["']/g, '').trim();
    var chosen = cur;
    pop.appendChild(fontButton('Font family (Google Fonts)', function () { return chosen; }, function (f) { chosen = f; apply(); }));
    // which roles
    var col = famEl.closest('.col');
    var meta = col ? (col.querySelector('.fmeta') ? col.querySelector('.fmeta').textContent.toUpperCase() : '') : '';
    var rwrap = DOC.createElement('div'); rwrap.className = 'r';
    var rl = DOC.createElement('label'); rl.textContent = 'Apply to'; rwrap.appendChild(rl);
    var grid = DOC.createElement('div'); grid.className = 'roles';
    var checks = {};
    ROLES.forEach(function (role) {
      var lab = DOC.createElement('label'); var cb = DOC.createElement('input'); cb.type = 'checkbox';
      cb.checked = meta.indexOf(role.toUpperCase()) >= 0;
      checks[role] = cb; lab.appendChild(cb); lab.appendChild(DOC.createTextNode(role)); grid.appendChild(lab);
    });
    rwrap.appendChild(grid); pop.appendChild(rwrap);

    function apply() {
      var f = chosen; if (!f) return;
      famEl.style.setProperty('font-family', '"' + f + '", sans-serif', 'important');
      ROLES.forEach(function (role) { if (checks[role].checked) applyRoleFont(role, f); });
      dirty();
    }
    ROLES.forEach(function (role) { checks[role].addEventListener('change', apply); });
    actions(famEl);
    position(famEl);
  }

  // Advanced (collapsed): a small "what is this used for" note. Stored on the element so
  // it persists; for swatches it edits the visible .use line.
  function advancedSection(getVal, setVal) {
    var t = DOC.createElement('button'); t.className = 'adv'; t.textContent = 'Advanced \\u25be';
    var body = DOC.createElement('div'); body.style.display = 'none';
    var lbl = DOC.createElement('label'); lbl.textContent = 'Usage / description';
    var ta = DOC.createElement('textarea'); ta.placeholder = 'What is this element used for?'; ta.value = getVal() || '';
    ta.addEventListener('input', function () { setVal(ta.value); });
    body.appendChild(lbl); body.appendChild(ta);
    t.onclick = function (e) { e.stopPropagation(); var open = body.style.display === 'none'; body.style.display = open ? 'block' : 'none'; t.textContent = open ? 'Advanced \\u25b4' : 'Advanced \\u25be'; };
    pop.appendChild(t); pop.appendChild(body);
  }

  /* ---- per-element hover state (real :hover CSS, persisted in <style id=sg-hover>) ---- */
  var HV_ATTR = { fg: 'data-sg-hvfg', bg: 'data-sg-hvbg', bd: 'data-sg-hvbd' };
  var hvSeq = 0;
  function hoverStyleEl() { var s = DOC.getElementById('sg-hover'); if (!s) { s = DOC.createElement('style'); s.id = 'sg-hover'; (DOC.head || ROOT).appendChild(s); } return s; }
  function ensureHvId(el) { var id = el.getAttribute('data-sg-hv'); if (!id) { id = 'hv' + Date.now().toString(36) + (hvSeq++); el.setAttribute('data-sg-hv', id); } return id; }
  function getHover(el, key) { return el.getAttribute(HV_ATTR[key]) || ''; }
  function rebuildHover() {
    var css = '';
    DOC.querySelectorAll('[data-sg-hv]').forEach(function (el) {
      var id = el.getAttribute('data-sg-hv'); var d = [];
      var fg = el.getAttribute(HV_ATTR.fg), bg = el.getAttribute(HV_ATTR.bg), bd = el.getAttribute(HV_ATTR.bd);
      if (fg) d.push('color:' + fg + ' !important');
      if (bg) d.push('background-color:' + bg + ' !important');
      if (bd) d.push('border-color:' + bd + ' !important');
      if (d.length) css += '[data-sg-hv="' + id + '"]:hover{' + d.join(';') + ';transition:all .15s ease}\\n';
    });
    hoverStyleEl().textContent = css;
  }
  function setHover(el, key, val) { ensureHvId(el); if (val) el.setAttribute(HV_ATTR[key], val); else el.removeAttribute(HV_ATTR[key]); rebuildHover(); dirty(); }
  // Collapsible "Hover" section for interactive elements.
  function hoverSection(el) {
    var t = DOC.createElement('button'); t.className = 'adv'; t.textContent = 'Hover state \\u25be';
    var body = DOC.createElement('div'); body.style.display = 'none';
    body.appendChild(colorField('Hover text color', function () { return getHover(el, 'fg') || rgbToHex(cs(el, 'color')); }, function (v) { setHover(el, 'fg', v); }));
    body.appendChild(colorField('Hover background', function () { return getHover(el, 'bg') || rgbToHex(cs(el, 'background-color')); }, function (v) { setHover(el, 'bg', v); }));
    body.appendChild(colorField('Hover border color', function () { return getHover(el, 'bd') || rgbToHex(cs(el, 'border-top-color')); }, function (v) { setHover(el, 'bd', v); }));
    t.onclick = function (e) { e.stopPropagation(); var open = body.style.display === 'none'; body.style.display = open ? 'block' : 'none'; t.textContent = open ? 'Hover state \\u25b4' : 'Hover state \\u25be'; };
    pop.appendChild(t); pop.appendChild(body);
  }

  function actions(el) {
    var b = DOC.createElement('div'); b.className = 'btns';
    var add = DOC.createElement('button'); add.className = 'add'; add.textContent = '+ Add';
    add.onclick = function (e) { e.stopPropagation(); var r = addSibling(el); if (r === 'max') post('toast', { message: 'Max 6 columns in a row' }); };
    var del = DOC.createElement('button'); del.className = 'del'; del.textContent = 'Delete';
    del.onclick = function (e) { e.stopPropagation(); el.remove(); closePop(); dirty(); };
    b.appendChild(add); b.appendChild(del); pop.appendChild(b);
  }
  // Image / logo controls: Upload (replace), pick from another component, Download.
  function imageControls(el) {
    var imgEl = el.tagName === 'IMG' ? el : el.querySelector('img');
    var bgSrc = ''; if (!imgEl) { var bg = cs(el, 'background-image'); var bm = bg && bg.match(/url\\(["']?([^"')]+)["']?\\)/); if (bm) bgSrc = bm[1]; }
    if (!imgEl && !bgSrc) return;
    function setImg(src) { if (imgEl) imgEl.setAttribute('src', src); else el.style.backgroundImage = 'url("' + src + '")'; dirty(); }

    var fi = DOC.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
    fi.addEventListener('change', function () { var f = fi.files && fi.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { setImg(String(rd.result)); }; rd.readAsDataURL(f); });
    var up = DOC.createElement('button'); up.className = 'dl'; up.textContent = '\\u2191 Upload image';
    up.onclick = function (e) { e.stopPropagation(); fi.click(); };
    pop.appendChild(up); pop.appendChild(fi);

    var ob = DOC.createElement('button'); ob.className = 'dl'; ob.textContent = 'Use image from another component';
    ob.onclick = function (e) { e.stopPropagation(); openPicker(setImg); };
    pop.appendChild(ob);

    var cur = imgEl ? (imgEl.getAttribute('src') || imgEl.src || '') : bgSrc;
    if (cur) { var d = DOC.createElement('button'); d.className = 'dl'; d.textContent = '\\u2193 Download image'; d.onclick = function (e) { e.stopPropagation(); post('download', { src: cur }); }; pop.appendChild(d); }
  }

  // Popup of every image used in the document, to reuse one.
  function openPicker(cb) {
    var ex = DOC.getElementById('sg-pick'); if (ex) ex.remove();
    var srcs = []; DOC.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || im.src; if (s && srcs.indexOf(s) < 0) srcs.push(s); });
    var ov = DOC.createElement('div'); ov.id = 'sg-pick';
    var hd = DOC.createElement('div'); hd.className = 'hd'; hd.textContent = 'Pick an image from the page'; ov.appendChild(hd);
    var grid = DOC.createElement('div'); grid.className = 'gr';
    if (!srcs.length) { var em = DOC.createElement('div'); em.style.cssText = 'color:#9aa0ad;font-size:12px;padding:10px'; em.textContent = 'No images found on the page.'; grid.appendChild(em); }
    srcs.forEach(function (s) { var im = DOC.createElement('img'); im.src = s; im.onclick = function (e) { e.stopPropagation(); cb(s); ov.remove(); }; grid.appendChild(im); });
    ov.appendChild(grid);
    var cl = DOC.createElement('button'); cl.className = 'cl'; cl.textContent = 'Close'; cl.onclick = function (e) { e.stopPropagation(); ov.remove(); }; ov.appendChild(cl);
    ROOT.appendChild(ov);
  }
  function position(el) {
    var r = el.getBoundingClientRect(), pw = 248, ph = pop.offsetHeight || 260;
    var left = r.left; if (left + pw > innerWidth - 8) left = innerWidth - pw - 8; if (left < 8) left = 8;
    var top = r.bottom + 8; if (top + ph > innerHeight - 8) top = r.top - ph - 8; if (top < 8) top = 8;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }

  function openSwatch(el, info) {
    mkPop(); target = el; target.classList.add('sg-sel');
    header('Colour');
    pop.appendChild(colorField('Colour', function () { return rgbToHex(cs(info.colorEl, 'background-color')); }, function (v) {
      if (info.token) ROOT.style.setProperty(info.token, v); else info.colorEl.style.background = v;
      if (info.hxEl) info.hxEl.textContent = v.toUpperCase();
      info.sw.setAttribute('data-copy', v); dirty();
    }));
    actions(el);
    var useEl = info.sw.querySelector('.use');
    advancedSection(
      function () { return useEl ? useEl.textContent : (info.sw.getAttribute('data-sg-use') || ''); },
      function (v) { if (useEl) { useEl.textContent = v; } else if (v) { info.sw.setAttribute('data-sg-use', v); } else { info.sw.removeAttribute('data-sg-use'); } dirty(); }
    );
    position(el);
  }

  function openEl(el) {
    mkPop(); target = el; target.classList.add('sg-sel');
    header(el.tagName.toLowerCase());
    var fields = fieldsForEl(el, sectionOf(el));
    var tok = tokenDisplay(el);
    if (tok) {
      // edit the real design token + its visible value (e.g. --container-width: 1300px)
      var vi = DOC.createElement('input'); vi.type = 'text'; vi.value = tok.value;
      vi.addEventListener('input', function () {
        var v = vi.value;
        var m = v.match(/-?[0-9.]+\\s*(px|rem|em|%|vh|vw|ch|fr)?/);
        if (m) ROOT.style.setProperty(tok.token, m[0].replace(/\\s+/g, ''));
        tok.setDisplay(v); dirty();
      });
      pop.appendChild(row('Value (' + tok.token + ')', vi));
    } else if (el.childElementCount === 0 && el.tagName !== 'IMG' && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
      var ta = DOC.createElement('textarea'); ta.value = el.textContent;
      ta.addEventListener('input', function () { el.textContent = ta.value; dirty(); });
      // A short, number-bearing cell (e.g. a breakpoint "\\u2265 1200px") is really a VALUE,
      // so label it as such — it reads cleaner and extracts correctly.
      var txt = (el.textContent || '').trim();
      var isValueCell = (el.tagName === 'TD' || el.tagName === 'TH' || (el.classList && (el.classList.contains('val') || el.classList.contains('num')))) && /[0-9]/.test(txt) && txt.length <= 24;
      pop.appendChild(row(isValueCell ? 'Value' : 'Text', ta));
    }
    if (el.tagName === 'A') {
      var hi = DOC.createElement('input'); hi.type = 'text'; hi.value = el.getAttribute('href') || '';
      hi.addEventListener('input', function () { el.setAttribute('href', hi.value); dirty(); });
      pop.appendChild(row('Link URL', hi));
    }
    // font family for ANY element that carries text (everywhere, not just Typography)
    if (el.textContent && el.textContent.trim()) pop.appendChild(fontField(el));
    if (fields.indexOf('color') >= 0) pop.appendChild(colorField('Text color', function () { return rgbToHex(cs(el, 'color')); }, function (v) { el.style.color = v; dirty(); }));
    if (fields.indexOf('background') >= 0) pop.appendChild(colorField('Background', function () { return rgbToHex(cs(el, 'background-color')); }, function (v) { el.style.backgroundColor = v; dirty(); }));
    if (fields.indexOf('fontSize') >= 0) pop.appendChild(numField('Font size (px)', px(cs(el, 'font-size')), '1', function (v) { el.style.fontSize = (v || 0) + 'px'; dirty(); }));
    if (fields.indexOf('fontWeight') >= 0) pop.appendChild(selField('Weight', String(px(cs(el, 'font-weight')) || 400), ['300', '400', '500', '600', '700', '800'], function (v) { el.style.fontWeight = v; dirty(); }));
    if (fields.indexOf('lineHeight') >= 0) { var lh = Math.round((parseFloat(cs(el, 'line-height')) / (px(cs(el, 'font-size')) || 16)) * 100) / 100; pop.appendChild(numField('Line height', isNaN(lh) ? '' : lh, '0.05', function (v) { if (v) { el.style.lineHeight = v; dirty(); } })); }
    if (fields.indexOf('letterSpacing') >= 0) { var ls = cs(el, 'letter-spacing') === 'normal' ? 0 : Math.round(parseFloat(cs(el, 'letter-spacing')) * 100) / 100; pop.appendChild(numField('Letter spacing (px)', ls, '0.1', function (v) { el.style.letterSpacing = (v || 0) + 'px'; dirty(); })); }
    if (fields.indexOf('textAlign') >= 0) pop.appendChild(selField('Align', (cs(el, 'text-align') || 'left').trim(), ['left', 'center', 'right', 'justify'], function (v) { el.style.textAlign = v; dirty(); }));
    if (fields.indexOf('padding') >= 0) pop.appendChild(numField('Padding (px)', px(cs(el, 'padding-top')), '1', function (v) { el.style.padding = (v || 0) + 'px'; dirty(); }));
    if (fields.indexOf('marginY') >= 0) pop.appendChild(numField('Margin Y (px)', px(cs(el, 'margin-top')), '1', function (v) { el.style.marginTop = (v || 0) + 'px'; el.style.marginBottom = (v || 0) + 'px'; dirty(); }));
    if (fields.indexOf('radius') >= 0) pop.appendChild(numField('Corner radius (px)', px(cs(el, 'border-radius')), '1', function (v) { el.style.borderRadius = (v || 0) + 'px'; dirty(); }));
    if (fields.indexOf('border') >= 0) {
      pop.appendChild(numField('Border width (px)', px(cs(el, 'border-top-width')), '1', function (v) { el.style.borderStyle = 'solid'; el.style.borderWidth = (v || 0) + 'px'; dirty(); }));
      pop.appendChild(colorField('Border color', function () { return rgbToHex(cs(el, 'border-top-color')); }, function (v) { el.style.borderStyle = 'solid'; el.style.borderColor = v; dirty(); }));
    }
    actions(el);
    imageControls(el);
    if (isInteractive(el)) hoverSection(el);
    advancedSection(
      function () { return el.getAttribute('data-sg-use') || ''; },
      function (v) { if (v) el.setAttribute('data-sg-use', v); else el.removeAttribute('data-sg-use'); dirty(); }
    );
    position(el);
  }

  /* ============ PROPERTIES MODE — edit design TOKENS in :root ============ *
   * Clicking an element shows only the token(s) that control it; editing a
   * token writes to :root (inline on <html>) so it propagates to everything
   * that uses var(--token), live. 'everything' mode keeps the free editor.   */
  var MODE = 'properties';
  var WEIGHTS = ['300', '400', '500', '600', '700', '800'];
  function setTok(name, val) { ROOT.style.setProperty(name, val); refreshTypeMeta(); dirty(); }
  function getTokRaw(name) { return getComputedStyle(ROOT).getPropertyValue(name).trim(); }
  function pxNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n); }
  // Keep the section value labels live & informative.
  function refreshTypeMeta() {
    DOC.querySelectorAll('.meta[data-typ]').forEach(function (m) {
      var base = m.getAttribute('data-typ');
      var role = m.getAttribute('data-role') || '';
      var d = pxNum(getTokRaw(base));
      var vals = m.getAttribute('data-resp')
        ? (d + ' / ' + pxNum(getTokRaw(base + '-t')) + ' / ' + pxNum(getTokRaw(base + '-m')) + ' px')
        : (d + 'px');
      m.textContent = role ? (role + ' \\u00b7 ' + vals) : vals;
    });
    DOC.querySelectorAll('[data-radval]').forEach(function (e) {
      var v = pxNum(getTokRaw(e.getAttribute('data-radval')));
      e.textContent = v >= 100 ? 'pill' : (v + 'px');
    });
    DOC.querySelectorAll('[data-bpval]').forEach(function (td) {
      td.textContent = '\\u2264 ' + pxNum(getTokRaw(td.getAttribute('data-bpval'))) + 'px';
    });
  }
  // CSS media queries can't read var(), so the breakpoint widths are baked into the
  // #sg-responsive block — rebuild it whenever --bp-tablet / --bp-mobile change.
  function rebuildResponsive() {
    var t = pxNum(getTokRaw('--bp-tablet')) || 1024;
    var mo = pxNum(getTokRaw('--bp-mobile')) || 640;
    var css = '@media (max-width:' + t + 'px){'
      + 'h1,.page-head .title{font-size:var(--text-h1-t)}h2{font-size:var(--text-h2-t)}h3{font-size:var(--text-h3-t)}'
      + '.section{padding:var(--section-padding-y-t) 0}}'
      + '@media (max-width:' + mo + 'px){'
      + 'h1,.page-head .title{font-size:var(--text-h1-m)}h2{font-size:var(--text-h2-m)}h3{font-size:var(--text-h3-m)}'
      + '.section{padding:var(--section-padding-y-m) 0}.container{padding:0 var(--container-padding-x-m)}}';
    var st = DOC.getElementById('sg-responsive'); if (st) st.textContent = css;
  }
  function bpNumRow(label, name) {
    var i = DOC.createElement('input'); i.type = 'number'; i.value = pxNum(getTokRaw(name));
    i.addEventListener('input', function () { setTok(name, (i.value || 0) + 'px'); rebuildResponsive(); refreshTypeMeta(); });
    return row(label, i);
  }
  try { refreshTypeMeta(); rebuildResponsive(); } catch (e) {}
  var COLOR_USE = {
    '--color-brand': 'Headings \\u00b7 Nav \\u00b7 Dark surfaces',
    '--color-accent': 'Buttons \\u00b7 Links \\u00b7 Eyebrows',
    '--color-surface-alt': 'Alt section backgrounds',
    '--color-surface-card': 'Card backgrounds',
    '--color-surface-page': 'Page background',
    '--color-muted': 'Captions \\u00b7 Secondary text'
  };
  function swatchTok(el) {
    var sw = el.closest && el.closest('.sw'); if (!sw) return null;
    var nm = sw.querySelector('.nm'); var label = nm ? nm.textContent.toLowerCase() : '';
    var token = label.indexOf('brand') >= 0 ? '--color-brand'
      : label.indexOf('accent') >= 0 ? '--color-accent'
      : label.indexOf('page') >= 0 ? '--color-surface-page'
      : label.indexOf('card') >= 0 ? '--color-surface-card'
      : label.indexOf('alt') >= 0 ? '--color-surface-alt'
      : label.indexOf('muted') >= 0 ? '--color-muted' : '';
    if (!token) return null;
    return { sw: sw, token: token, role: nm ? nm.textContent.trim() : 'Color' };
  }
  function tokColorRow(label, name, onAfter) {
    return colorField(label, function () { return rgbToHex(getTokRaw(name) || '#000000'); }, function (v) { setTok(name, v); if (onAfter) onAfter(v); });
  }
  function tokNumRow(label, name, unit) {
    var i = DOC.createElement('input'); i.type = 'number'; i.value = pxNum(getTokRaw(name));
    i.addEventListener('input', function () { setTok(name, (i.value || 0) + (unit || '')); });
    return row(label, i);
  }
  function tokSelRow(label, name, opts) {
    return selField(label, (getTokRaw(name) || opts[0]).trim(), opts, function (v) { setTok(name, v); });
  }
  function tokFontRow(label, name) {
    return fontButton(label, function () { return (getTokRaw(name) || '').split(',')[0].replace(/["']/g, '').trim(); },
      function (f) { ensureFont(f); setTok(name, '"' + f + '", system-ui, sans-serif'); });
  }
  // responsive size: Desktop / Tablet / Mobile tabs editing name / name-t / name-m
  function tokBpRow(label, base, hasVariants) {
    var names = { base: base, tablet: base + '-t', mobile: base + '-m' };
    var cur = 'base';
    var input = DOC.createElement('input'); input.type = 'number';
    var tabs = DOC.createElement('div'); tabs.style.cssText = 'display:flex;gap:5px;margin-bottom:6px';
    var btns = {};
    function paint() { Object.keys(btns).forEach(function (k) { var on = cur === k; btns[k].style.background = on ? '#eef0ff' : '#f7f7fb'; btns[k].style.color = on ? '#473AE0' : '#7a7f8c'; }); }
    function load() { input.value = pxNum(getTokRaw(names[cur])); }
    function mkTab(key, txt) { var b = DOC.createElement('button'); b.textContent = txt; b.style.cssText = 'flex:1;border:1px solid #e2e2ec;border-radius:7px;padding:5px;font-size:11px;font-weight:600;cursor:pointer'; b.onclick = function (ev) { ev.stopPropagation(); cur = key; paint(); load(); }; btns[key] = b; tabs.appendChild(b); }
    mkTab('base', 'Desktop'); if (hasVariants) { mkTab('tablet', 'Tablet'); mkTab('mobile', 'Mobile'); }
    input.addEventListener('input', function () { setTok(names[cur], (input.value || 0) + 'px'); });
    paint(); load();
    var r = DOC.createElement('div'); r.className = 'r';
    var l = DOC.createElement('label'); l.textContent = label; r.appendChild(l); r.appendChild(tabs); r.appendChild(input); return r;
  }
  function usedBy(text) { if (!text) return; var d = DOC.createElement('div'); d.style.cssText = 'font-size:11px;color:#9aa0ad;margin:-2px 0 8px;padding:6px 8px;background:#f7f7fb;border-radius:7px'; d.textContent = 'Used by: ' + text; pop.appendChild(d); }

  function openProps(el) {
    mkPop(); target = el; target.classList.add('sg-sel');
    var tag = el.tagName.toLowerCase();
    // explicit token markers (informative value labels) are directly editable, first
    var typEl = el.closest && el.closest('[data-typ]');
    if (typEl) {
      var tbase = typEl.getAttribute('data-typ');
      var trole = typEl.getAttribute('data-role') || tbase.replace(/^--/, '').replace(/-/g, ' ');
      header('Token \\u00b7 ' + trole);
      if (typEl.getAttribute('data-resp')) pop.appendChild(tokBpRow('Value', tbase, true));
      else pop.appendChild(tokNumRow('Value (px)', tbase, 'px'));
      position(el); return;
    }
    var sw = swatchTok(el);
    if (sw) {
      header('Color \\u00b7 ' + sw.role);
      pop.appendChild(tokColorRow('Color', sw.token, function (v) { var hx = sw.sw.querySelector('.hx'); if (hx) hx.textContent = v.toUpperCase(); sw.sw.setAttribute('data-copy', v); }));
      usedBy(COLOR_USE[sw.token]); actions(el); position(el); return;
    }
    if (/^h[1-6]$/.test(tag)) {
      var n = tag.charAt(1);
      header('Typography \\u00b7 ' + tag.toUpperCase());
      pop.appendChild(tokBpRow('Size', '--text-h' + n, (n === '1' || n === '2' || n === '3')));
      pop.appendChild(tokFontRow('Heading font', '--font-heading'));
      pop.appendChild(tokSelRow('Weight', '--fw-h' + n, WEIGHTS));
      pop.appendChild(tokColorRow('Heading color', '--text-heading'));
      pop.appendChild(tokNumRow('Line height', '--lh-heading', ''));
      pop.appendChild(tokNumRow('Letter spacing (em)', '--ls-heading', 'em'));
      position(el); return;
    }
    if (el.classList && (el.classList.contains('eyebrow') || el.classList.contains('lead') || el.classList.contains('caption'))) {
      var isEy = el.classList.contains('eyebrow'), isLead = el.classList.contains('lead');
      header(isEy ? 'Eyebrow' : isLead ? 'Lead text' : 'Caption');
      pop.appendChild(tokColorRow('Color', isEy ? '--color-accent' : '--text-muted'));
      pop.appendChild(tokNumRow('Size', isEy ? '--text-caption' : isLead ? '--text-body-lg' : '--text-caption', 'px'));
      position(el); return;
    }
    if (tag === 'p') {
      header('Typography \\u00b7 Body');
      pop.appendChild(tokNumRow('Size', '--text-body-lg', 'px'));
      pop.appendChild(tokFontRow('Body font', '--font-body'));
      pop.appendChild(tokSelRow('Weight', '--fw-body', WEIGHTS));
      pop.appendChild(tokColorRow('Text color', '--text-primary'));
      pop.appendChild(tokNumRow('Line height', '--lh-body', ''));
      position(el); return;
    }
    if (tag === 'a' && !(el.classList && el.classList.contains('btn'))) {
      header('Links');
      pop.appendChild(tokColorRow('Link color', '--link-color'));
      pop.appendChild(tokColorRow('Hover color', '--link-color-hover'));
      pop.appendChild(tokSelRow('Underline', '--link-decoration', ['none', 'underline']));
      position(el); return;
    }
    if (el.classList && el.classList.contains('btn')) {
      header('Button');
      pop.appendChild(tokColorRow('Background', '--btn-bg'));
      pop.appendChild(tokColorRow('Text color', '--btn-text'));
      pop.appendChild(tokSelRow('Weight', '--btn-weight', WEIGHTS));
      pop.appendChild(tokNumRow('Padding Y', '--btn-padding-y', 'px'));
      pop.appendChild(tokNumRow('Padding X', '--btn-padding-x', 'px'));
      pop.appendChild(tokNumRow('Radius', '--btn-radius', 'px'));
      position(el); return;
    }
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      header('Forms');
      pop.appendChild(tokColorRow('Background', '--input-bg'));
      pop.appendChild(tokColorRow('Text color', '--input-text'));
      pop.appendChild(tokColorRow('Border', '--input-border'));
      pop.appendChild(tokColorRow('Focus border', '--input-focus-border'));
      pop.appendChild(tokNumRow('Radius', '--input-radius', 'px'));
      pop.appendChild(tokNumRow('Padding', '--input-padding', 'px'));
      position(el); return;
    }
    if ((el.classList && el.classList.contains('card')) || (el.closest && el.closest('.card'))) {
      header('Card');
      pop.appendChild(tokColorRow('Background', '--card-bg'));
      pop.appendChild(tokColorRow('Border', '--card-border'));
      pop.appendChild(tokNumRow('Radius', '--card-radius', 'px'));
      pop.appendChild(tokNumRow('Padding', '--card-padding', 'px'));
      position(el); return;
    }
    if (el.closest && el.closest('.demo-nav')) {
      header('Navigation Bar');
      pop.appendChild(tokColorRow('Background', '--nav-bg'));
      pop.appendChild(tokColorRow('Text', '--nav-text'));
      pop.appendChild(tokColorRow('Link hover', '--nav-link-hover'));
      pop.appendChild(tokNumRow('Height', '--nav-height', 'px'));
      position(el); return;
    }
    if (el.closest && el.closest('.demo-footer')) {
      header('Footer');
      pop.appendChild(tokColorRow('Background', '--footer-bg'));
      pop.appendChild(tokColorRow('Text', '--footer-text'));
      pop.appendChild(tokNumRow('Padding', '--footer-padding', 'px'));
      position(el); return;
    }
    if (el.closest && el.closest('li')) {
      header('Lists');
      pop.appendChild(tokColorRow('Marker color', '--list-marker'));
      pop.appendChild(tokNumRow('Item gap', '--list-gap', 'px'));
      pop.appendChild(tokNumRow('Indent', '--list-indent', 'px'));
      position(el); return;
    }
    if (tag === 'blockquote') {
      header('Blockquote');
      pop.appendChild(tokColorRow('Border color', '--bq-border-color'));
      pop.appendChild(tokColorRow('Text color', '--bq-text-color'));
      pop.appendChild(tokNumRow('Padding', '--bq-padding', 'px'));
      position(el); return;
    }
    var radBox = el.closest && el.closest('[data-radius]');
    if (radBox) {
      var rtok = radBox.getAttribute('data-radius');
      var RADIUS_USE = {
        '--radius-card': 'Content cards', '--radius-image': 'Images', '--radius-button': 'Buttons',
        '--radius-input': 'Form inputs', '--radius-icon-btn': 'Icon buttons', '--radius-tag': 'Tags / chips'
      };
      header('Radius \\u00b7 ' + rtok.replace('--radius-', ''));
      pop.appendChild(tokNumRow('Radius (px)', rtok, 'px'));
      usedBy(RADIUS_USE[rtok] || '');
      position(el); return;
    }
    if (el.closest && el.closest('#breakpoints')) {
      header('Responsive Breakpoints');
      pop.appendChild(bpNumRow('Tablet \\u2264 (px)', '--bp-tablet'));
      pop.appendChild(bpNumRow('Mobile \\u2264 (px)', '--bp-mobile'));
      usedBy('Where type & spacing switch sizes');
      position(el); return;
    }
    var sec = el.closest && el.closest('section');
    if (sec) {
      header('Spacing \\u00b7 Section');
      pop.appendChild(tokBpRow('Padding Y', '--section-padding-y', true));
      pop.appendChild(tokNumRow('Container max (px)', '--container-max-width', 'px'));
      pop.appendChild(tokNumRow('Gap (px)', '--gap', 'px'));
      position(el); return;
    }
    header(tag);
    pop.appendChild(tokColorRow('Text color', '--text-primary'));
    position(el);
  }
  addEventListener('message', function (e) { var d = e.data || {}; if (d && d.source === 'sg-host' && d.type === 'mode') { MODE = d.mode; closePop(); } });

  DOC.addEventListener('click', function (e) {
    var t = e.target;
    if (isUi(t)) return;
    if (t.closest && t.closest('.tocnav')) return;
    e.preventDefault();
    if (t === BODY || t === ROOT) { closePop(); return; }
    if (MODE === 'properties') { openProps(t); post('section', { sectionId: sectionOf(t) }); return; }
    var fam = t.closest('.fam');
    if (fam) { openFontCard(fam); post('section', { sectionId: sectionOf(fam) }); return; }
    var info = swatchOf(t);
    if (info) { openSwatch(info.sw, info); post('section', { sectionId: sectionOf(info.sw) }); return; }
    openEl(t); post('section', { sectionId: sectionOf(t) });
  }, true);
  DOC.addEventListener('mouseover', function (e) { var t = e.target; if (isUi(t) || (t.closest && t.closest('.tocnav'))) return; if (t !== target && t !== BODY && t !== ROOT) t.classList.add('sg-hov'); }, true);
  DOC.addEventListener('mouseout', function (e) { e.target.classList && e.target.classList.remove('sg-hov'); }, true);
  addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });

  try {
    var io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) post('section', { sectionId: en.target.id }); }); }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    DOC.querySelectorAll('main section[id], section.ds[id]').forEach(function (s) { io.observe(s); });
  } catch (e) {}

  /* ---- API for the React sidebar (global tokens) ---- */
  function rootVars() {
    var out = {};
    try {
      for (var i = 0; i < DOC.styleSheets.length; i++) {
        var rules; try { rules = DOC.styleSheets[i].cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var ru = rules[j]; if (!ru.selectorText) continue;
          if (ru.selectorText === ':root' || ru.selectorText === 'html') { var sd = ru.style; for (var k = 0; k < sd.length; k++) { var nm = sd[k]; if (nm.indexOf('--') === 0) out[nm] = sd.getPropertyValue(nm).trim(); } }
        }
      }
    } catch (e) {}
    return out;
  }
  window.__sg = {
    getTokens: function () { var v = rootVars(), list = []; Object.keys(v).forEach(function (name) { var val = (getComputedStyle(ROOT).getPropertyValue(name).trim()) || v[name]; list.push({ name: name, value: val, isColor: /^#|^rgb|^hsl/i.test(val) }); }); return list; },
    setToken: function (name, val) { ROOT.style.setProperty(name, val); dirty(); },
    // also paint the visible brand-palette swatches (they use literal hex, not var()).
    setPalette: function (role, hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
      var targets = [];
      var feat = DOC.querySelectorAll('.feat > .sw');
      var strip = DOC.querySelectorAll('.strip .sw');
      if (role === 'brand') { if (feat[0]) targets.push(feat[0]); }
      else if (role === 'accent') { for (var i = 1; i < feat.length; i++) targets.push(feat[i]); }
      else { var idx = { surfaceAlt: 0, surfaceCard: 1, surfacePage: 2, muted: 3 }[role]; if (strip[idx]) targets.push(strip[idx]); }
      targets.forEach(function (sw) {
        var box = sw.querySelector('.box');
        if (box) box.style.background = hex; else sw.style.background = hex;
        var hx = sw.querySelector('.hx'); if (hx) hx.textContent = hex.toUpperCase();
        sw.setAttribute('data-copy', hex);
      });
      dirty();
    },
    applyRoleFont: function (role, font) { applyRoleFont(role, font); },
    loadFont: function (font) { ensureFont(font); },
    scrollTo: function (id) { var el = DOC.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    serialize: function () {
      closePop();
      DOC.querySelectorAll('.sg-hov,.sg-sel').forEach(function (n) { n.classList.remove('sg-hov'); n.classList.remove('sg-sel'); });
      var clone = ROOT.cloneNode(true);
      // strip the WHOLE editor layer so saved/exported HTML is clean (no runtime baked in)
      clone.querySelectorAll('#sg-style,#sg-pop,#sg-pick,#sg-fontpick,#sg-script,#sg-allfonts,#sg-allfonts2').forEach(function (n) { n.remove(); });
      clone.querySelectorAll('.sg-sel,.sg-hov').forEach(function (n) { n.classList.remove('sg-sel'); n.classList.remove('sg-hov'); });
      return '<!DOCTYPE html>\\n' + clone.outerHTML;
    }
  };

  post('ready');
})();`;

// Remove any editor layer that may have been baked into saved content by older builds,
// so we never run two runtimes at once (that broke clicks + autosave).
function stripPrevLayer(html) {
  return String(html)
    .replace(/<script id="sg-script">[\s\S]*?<\/script>/g, '')
    .replace(/<style id="sg-style">[\s\S]*?<\/style>/g, '')
    .replace(/<link id="sg-allfonts2?"[^>]*>/g, '')
    .replace(/<div id="sg-pop"[\s\S]*?<\/div>/g, '');
}

// Build the iframe document: saved content + editor layer injected before </body>.
export function buildEditableDoc(content) {
  const raw = content || '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';
  const html = stripPrevLayer(raw);
  const closeTag = String.fromCharCode(60) + '/script>'; // "</script>" without a literal tag
  const layer = '<script id="sg-script">' + RUNTIME + closeTag;
  if (html.indexOf('</body>') !== -1) return html.replace('</body>', layer + '</body>');
  return html + layer;
}
