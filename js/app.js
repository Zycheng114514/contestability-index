/* The Contestability Index — rendering, routing and interaction.
   Layout modelled on the WJP Rule of Law Index site. Vanilla JS. Reads window.CI_DATA, which js/db.js builds from
   the project database, and window.CI_WORLD. db.js calls window.CI_BOOT once the database is open.
   Pages (hash routes): #/ explore, #/jurisdictions, #/jurisdiction/<code>, #/cases, #/scoring, #/data,
   #/legal[/<code>], #/about.
   Text the team has not supplied is drafted here and starts with the marker [AI generated]; the figures inside those
   drafts are computed from the database when the page opens, so they follow the data. */
window.CI_BOOT = function () {
  "use strict";
  var D = window.CI_DATA, W = window.CI_WORLD;
  var APPENDIX = "https://zycheng114514.github.io/contestability-appendix/";
  var AI = "[AI generated]";

  /* ------------------------------------------------------------ helpers */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function stext(attrs, t) { var n = svg("text", attrs); n.textContent = t; return n; }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      parent.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return parent;
  }
  // Rounded half up, as the Handbook and the paper print (0.475 -> 0.48); toFixed alone would give 0.47.
  function num(v, d) {
    if (v === null || v === undefined) return "—";
    var p = d === undefined ? 2 : d, k = Math.pow(10, p), s = v < 0 ? -1 : 1;
    return (s * Math.round(Math.abs(v) * k + 1e-9) / k).toFixed(p);
  }
  function glyph(v) { return v === 1 ? "1" : v === 0.5 ? "½" : v === 0 ? "0" : "—"; }
  function pretty(s) {
    if (!s) return "";
    return String(s).replace(/_/g, " ").replace(/\+/g, " + ").replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function domain(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; } }
  function extLink(url, text) {
    var a = el("a", null, text || domain(url));
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  function link(href, text) { var a = el("a", null, text); a.href = href; return a; }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
                "November", "December"];
  function month(ym) {
    if (!ym) return "";
    var p = String(ym).split("-");
    return p[1] ? MONTHS[+p[1] - 1] + " " + p[0] : p[0];
  }
  function day(ymd) {
    var p = String(ymd || "").split("-");
    return p.length === 3 ? (+p[2]) + " " + MONTHS[+p[1] - 1] + " " + p[0] : String(ymd || "");
  }
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  var WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
               "thirteen", "fourteen", "fifteen", "sixteen"];
  function words(n) { return WORDS[n] || String(n); }
  function listText(arr) {
    if (arr.length < 2) return arr.join("");
    return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
  }
  // A paragraph drafted for the team to review. It opens with the [AI generated] marker; parts are strings or nodes.
  function aiP(parts, cls) {
    var p = el("p", cls);
    p.appendChild(el("span", "ai-tag", AI));
    p.appendChild(document.createTextNode(" "));
    (Array.isArray(parts) ? parts : [parts]).forEach(function (x) { add(p, x); });
    return p;
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function scrollToEl(node) { if (node) node.scrollIntoView({ behavior: "smooth", block: "start" }); }

  /* ------------------------------------------------------------ the score scale
     One hue, light to dark, built on KGI blue (#003da5). The WJP site's magenta-to-teal ramp was
     [[0,"#d40276"],[0.103,"#d40276"],[0.2217,"#ea1813"],[0.3842,"#f19d4b"],[0.5,"#f6c600"],[0.6768,"#adc493"],
      [0.7758,"#6a9e89"],[0.8865,"#125459"],[0.9699,"#003632"],[1,"#003632"]]; swapping it back is this one line. */
  var STOPS = [[0, "#c9d8f3"], [0.25, "#93b0e8"], [0.5, "#5583d6"], [0.75, "#1f56bd"], [0.88, "#003da5"], [1, "#0c2a66"]];
  var GRADIENT = "linear-gradient(90deg, " + STOPS.map(function (s) {
    return s[1] + " " + (s[0] * 100).toFixed(2) + "%";
  }).join(", ") + ")";
  function rgbOf(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function scoreRgb(v) {
    v = Math.max(0, Math.min(1, v));
    for (var i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i][0]) {
        var a = STOPS[i - 1], b = STOPS[i], t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
        var ca = rgbOf(a[1]), cb = rgbOf(b[1]);
        return [0, 1, 2].map(function (k) { return Math.round(ca[k] + (cb[k] - ca[k]) * t); });
      }
    }
    return rgbOf(STOPS[STOPS.length - 1][1]);
  }
  function scoreColor(v) {
    if (v === null || v === undefined) return "#e8e8e8";
    return "rgb(" + scoreRgb(v).join(",") + ")";
  }
  // Text on a score fill: white on the dark ends of the scale, near-black on the light middle (orange to sage).
  function inkOn(v) {
    if (v === null || v === undefined) return "#26262b";
    var c = scoreRgb(v).map(function (x) {
      x /= 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.18 ? "#1d1d22" : "#ffffff";
  }
  function paint(node, v) { node.style.background = scoreColor(v); node.style.color = inkOn(v); return node; }

  /* ------------------------------------------------------------ lookups */
  var jurName = {}, jurByCode = {};
  D.jurisdictions.forEach(function (j) { jurName[j.code] = j.name; jurByCode[j.code] = j; });
  var CODES = D.jurisdictions.map(function (j) { return j.code; });
  var mechById = {};
  D.mechanisms.forEach(function (m) { mechById[m.id] = m; });
  var dimById = {};
  D.dimensions.forEach(function (d) { dimById[d.id] = d; });
  var DIMS = D.dimensions.map(function (d) { return d.id; });
  var KEYS = ["overall"].concat(DIMS);
  var DIM_SHORT = { D1: "Mobility & switching", D2: "Rival access", D3: "Neutrality", D4: "Data & interoperability" };
  var unitById = {};
  D.deFacto.units.forEach(function (u) { unitById[u.id] = u; });
  var UNITS = D.deFacto.units.map(function (u) { return u.id; });
  // Categorical slots in the validated default order; colour follows the entity, never its rank.
  var SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
  var UNIT_COLOR = {};
  UNITS.forEach(function (u, i) { UNIT_COLOR[u] = SERIES[i]; });
  var LAW = "#151515";  // De Jure marks in the law-against-market charts
  var nM = D.mechanisms.length, nJ = CODES.length, nD = DIMS.length, nU = UNITS.length;
  var DJ_DATE = month(D.meta.evidenceDate);
  var DF_NOW = month((D.periods["de_facto|market|current"] || {}).observed);
  var DF_BASE = month((D.periods["de_facto|market|baseline"] || {}).observed);

  function val(code, key) {
    var a = D.aggregates[code];
    if (!a) return null;
    return key === "overall" ? a.overall : a.dims[key];
  }
  // A jurisdiction's name inside a sentence: "the European Union", "the United States", "Japan".
  function theName(code) { return (/^(EU|US|UK)$/.test(code) ? "the " : "") + jurName[code]; }
  function theNames(codes) { return listText(codes.map(theName)); }
  function keyName(key) { return key === "overall" ? "Overall index" : key + " " + dimById[key].name; }
  function keyShort(key) { return key === "overall" ? "Overall index" : key + " " + DIM_SHORT[key]; }
  function rankedBy(key) {
    return CODES.slice().sort(function (a, b) { return val(b, key) - val(a, key) || CODES.indexOf(a) - CODES.indexOf(b); });
  }
  // Competition ranking: equal scores share a rank (the EU and Germany are both first).
  function rankOf(code, key) {
    var v = val(code, key), r = 1;
    CODES.forEach(function (c) { if (val(c, key) > v + 1e-9) r++; });
    return r;
  }
  function avgOf(key) { return CODES.reduce(function (s, c) { return s + val(c, key); }, 0) / nJ; }
  function cellOf(pid, code) { return D.cells[pid + "|" + code]; }
  function counts(code) {
    var n = { full: 0, part: 0, none: 0 };
    D.mechanisms.forEach(function (m) {
      var s = cellOf(m.id, code).score;
      if (s === 1) n.full++; else if (s === 0.5) n.part++; else n.none++;
    });
    return n;
  }
  function mainForm(code) {
    var c = {};
    D.mechanisms.forEach(function (m) { var f = cellOf(m.id, code).legal_form || "none"; c[f] = (c[f] || 0) + 1; });
    var best = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
    return { label: best, n: c[best] };
  }
  function mIdx(layer, unit, period) { return D.markets.index[layer + "|" + unit + "|" + period] || null; }
  function mVal(layer, unit, period, key) {
    var x = mIdx(layer, unit, period);
    if (!x) return null;
    if (key === "overall") return x.index;
    return x.dims[key] ? x.dims[key].score : null;
  }
  function effOf(unit, period) { return D.effective.filter(function (e) { return e.unit === unit && e.period === period; })[0]; }
  function prevalence() {
    return D.mechanisms.map(function (m) {
      var p = { m: m, full: [], part: [], none: [] };
      CODES.forEach(function (c) {
        var s = cellOf(m.id, c).score;
        (s === 1 ? p.full : s === 0.5 ? p.part : p.none).push(c);
      });
      return p;
    });
  }

  /* ------------------------------------------------------------ header, footer, menu */
  $("#download-db").href = D.meta.dbUrl;
  (function footer() {
    var f = $("#footer");
    add(f, el("p", null, "The Contestability Index · preliminary preview."));
    var p = el("p");
    add(p, "Every figure on this site is computed in your browser from the project database, ",
        link(D.meta.dbUrl, "contestability.db"), " (SQLite, built " + D.meta.built + "). Full scoring rules and every table: ",
        extLink(APPENDIX, "Online Appendix"), ".");
    f.appendChild(p);
  })();
  var menuBtn = $(".menu-btn"), links = $("#subnav-links");
  menuBtn.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ------------------------------------------------------------ tooltip and hover card */
  var tt = $("#tooltip");
  function ttShow(content, x, y, card) {
    tt.textContent = "";
    tt.className = "tooltip" + (card ? " card" : "");
    if (Array.isArray(content)) content.forEach(function (l) { tt.appendChild(el("div", null, l)); });
    else tt.appendChild(content);
    tt.hidden = false;
    ttMove(x, y);
  }
  function ttMove(x, y) {
    var r = tt.getBoundingClientRect();
    var left = x + 16, top = y + 16;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 16;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 12;
    tt.style.left = Math.max(8, left) + "px";
    tt.style.top = Math.max(8, top) + "px";
  }
  function ttHide() { tt.hidden = true; }
  window.addEventListener("scroll", ttHide, { passive: true });
  function withTip(node, fn, card) {
    node.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") ttShow(fn(), e.clientX, e.clientY, card); });
    node.addEventListener("pointermove", function (e) { if (!tt.hidden) ttMove(e.clientX, e.clientY); });
    node.addEventListener("pointerleave", ttHide);
    node.addEventListener("focus", function () { var r = node.getBoundingClientRect(); ttShow(fn(), r.left + r.width / 2, r.bottom, card); });
    node.addEventListener("blur", ttHide);
  }

  // The dark card shown on the map and the ranking: the De Jure score, the rank, and the four dimensions, with
  // the De Facto observations beside them where they exist (the three EU gatekeeper-market pairs).
  function hoverCard(code, key, place) {
    var a = D.aggregates[code], v = val(code, key);
    var box = el("div");
    var top = el("div", "tt-top"), left = el("div");
    left.appendChild(el("div", "tt-name", jurName[code]));
    if (place && place !== jurName[code]) left.appendChild(el("div", "small", place + ", EU member state"));
    top.appendChild(left);
    var sc = paint(el("div", "tt-score"), v);
    sc.style.borderColor = "transparent";
    sc.appendChild(el("b", null, num(v)));
    sc.appendChild(el("i", null, key === "overall" ? "De Jure index" : key + " score"));
    top.appendChild(sc);
    box.appendChild(top);

    var scale = el("div", "tt-scale");
    scale.style.background = GRADIENT;
    var mk = el("span", "mk");
    mk.style.left = (v * 100) + "%";
    mk.style.background = scoreColor(v);
    add(scale, mk, el("span", "lo", "0.0"), el("span", "hi", "1.0"));
    box.appendChild(scale);

    var n = counts(code), rows = el("div", "tt-rows");
    add(rows, el("span", null, key === "overall" ? "Rank" : "Rank on " + key), el("b", null, rankOf(code, key) + " / " + nJ),
        el("span", null, "Categories required in full"), el("b", null, n.full + " of " + nM),
        el("span", null, "Snapshot"), el("b", null, DJ_DATE));
    box.appendChild(rows);

    var hasDF = code === "EU";
    box.appendChild(el("div", "tt-sub", hasDF ? "De Jure and De Facto by dimension" : "De Jure by dimension"));
    var dims = el("div", "tt-dims");
    DIMS.forEach(function (d) {
      dims.appendChild(el("span", null, d + " " + DIM_SHORT[d]));
      var trk = el("span", "tt-track"), bar = el("span", "dj");
      bar.style.width = (a.dims[d] * 100) + "%";
      trk.appendChild(bar);
      // One dot per pair, each on its own line inside the track, so pairs with the same value stay visible.
      if (hasDF) UNITS.forEach(function (u, ui) {
        var x = mVal("de_facto", u, "current", d);
        if (x === null) return;
        var dot = el("span", "df");
        dot.style.left = (x * 100) + "%";
        dot.style.top = (ui * 6) + "px";
        dot.style.background = UNIT_COLOR[u];
        trk.appendChild(dot);
      });
      dims.appendChild(trk);
      dims.appendChild(el("span", null, num(a.dims[d])));
    });
    box.appendChild(dims);
    var key2 = el("div", "tt-key"), k = el("span");
    add(k, el("i", "bar"), "De Jure, " + DJ_DATE);
    key2.appendChild(k);
    if (hasDF) UNITS.forEach(function (u) {
      var kk = el("span"), i = el("i");
      i.style.background = UNIT_COLOR[u];
      add(kk, i, unitById[u].name);
      key2.appendChild(kk);
    });
    box.appendChild(key2);
    box.appendChild(el("div", "tt-foot", hasDF ? "Dots: De Facto, " + DF_NOW + ", one per gatekeeper–market pair."
      : code === "DE" ? "De Facto is observed EU-wide: see the European Union."
      : "De Facto is not measured for this jurisdiction."));
    box.appendChild(el("div", "tt-foot", "Click for the full profile."));
    return box;
  }

  /* ------------------------------------------------------------ shared components */
  function scaleLegend(title) {
    var g = el("div", "scale-legend");
    g.appendChild(el("span", "t", title || "Pro-contestability obligations in law"));
    g.appendChild(el("span", "end", "Weaker"));
    var bar = el("span", "bar");
    bar.style.background = GRADIENT;
    g.appendChild(bar);
    g.appendChild(el("span", "end", "Stronger"));
    var ticks = el("span", "ticks");
    ["0.00", "0.25", "0.50", "0.75", "1.00"].forEach(function (t) { ticks.appendChild(el("span", null, t)); });
    g.appendChild(ticks);
    return g;
  }

  // Which jurisdiction each map feature belongs to. The EU is its 27 members; Germany keeps its own national score.
  var ID_JUR = {};
  D.jurisdictions.forEach(function (j) {
    (j.mapIds || []).forEach(function (id) { if (!ID_JUR[id] || j.code !== "EU") ID_JUR[id] = j.code; });
  });
  // Mini-map windows (Equal Earth coordinates of world.js), cut around each jurisdiction's main territory.
  var MINI_VIEW = { EU: "396.6 -29.1 270.5 194.4", DE: "486.5 38.3 75.5 54.2", US: "26.5 -65.1 414.4 297.8",
                    TR: "539.5 67.4 100.2 72.0", JP: "781.3 57.2 136.7 98.3", KR: "799.1 91.5 56.1 40.3",
                    CN: "593.6 1.7 322.9 232.1", UK: "453.6 27.9 79.5 57.1", AU: "706.0 237.3 299.2 215.1" };

  // A shape cut at the antimeridian (Fiji) carries a sub-path that runs across the whole map; drop such slivers.
  var CLEAN = {};
  function cleanPath(id) {
    if (CLEAN[id]) return CLEAN[id];
    var parts = W.countries[id].d.split("Z").filter(function (p) {
      var xs = (p.match(/-?\d+(?:\.\d+)?(?=,)/g) || []).map(Number);
      return xs.length && Math.max.apply(null, xs) - Math.min.apply(null, xs) < 500;
    });
    return (CLEAN[id] = parts.map(function (p) { return p + "Z"; }).join(""));
  }

  function drawWorld(opts) {
    var s = svg("svg", { viewBox: opts.viewBox || W.viewBox, class: "worldmap", role: "img",
                         "aria-label": opts.label || "World map of the De Jure index" });
    if (opts.viewBox) s.setAttribute("preserveAspectRatio", "xMidYMid meet");
    var paths = {};
    function key() { return opts.keyRef ? opts.keyRef() : (opts.key || "overall"); }
    // Germany is part of the EU, so the EU's own map keeps it in focus.
    function inFocus(code) { return code === opts.focus || (opts.focus === "EU" && code === "DE"); }
    Object.keys(W.countries).forEach(function (id) {
      var c = W.countries[id], code = ID_JUR[id];
      var p = svg("path", { d: cleanPath(id) });
      if (!code) {
        p.setAttribute("class", "c-none");
        s.appendChild(p);
        return;
      }
      p.setAttribute("class", "c-jur" + (opts.focus && !inFocus(code) ? " faded" : "") + (opts.focus && inFocus(code) ? " hot" : ""));
      p.style.fill = scoreColor(val(code, key()));
      (paths[code] = paths[code] || []).push(p);
      if (opts.interactive) {
        var place = code === "EU" ? c.n : jurName[code];
        p.setAttribute("tabindex", "0");
        p.setAttribute("role", "link");
        p.setAttribute("aria-label", place + (code === "EU" ? ", European Union" : "") + ": De Jure " +
          keyShort(key()).toLowerCase() + " " + num(val(code, key())) + ". Opens the profile.");
        withTip(p, function () { return hoverCard(code, key(), place); }, true);
        p.addEventListener("pointerenter", function () { hot(code, true); });
        p.addEventListener("pointerleave", function () { hot(code, false); });
        p.addEventListener("click", function () { go("#/jurisdiction/" + code); });
        p.addEventListener("keydown", function (e) { if (e.key === "Enter") go("#/jurisdiction/" + code); });
      }
      s.appendChild(p);
    });
    function hot(code, on) {
      if (opts.focus && inFocus(code)) return;
      (paths[code] || []).forEach(function (p) { p.classList.toggle("hot", on); });
    }
    s.recolor = function () {
      Object.keys(paths).forEach(function (code) {
        paths[code].forEach(function (p) { p.style.fill = scoreColor(val(code, key())); });
      });
    };
    return s;
  }

  function rankingList(key) {
    var host = el("div", "rank-list");
    rankedBy(key).forEach(function (code) {
      var v = val(code, key);
      var row = el("button", "rank-row");
      row.type = "button";
      row.setAttribute("aria-label", jurName[code] + ", rank " + rankOf(code, key) + ", " + num(v) + ". Opens the profile.");
      row.appendChild(el("span", "nm", jurName[code]));
      row.appendChild(el("span", "rk", String(rankOf(code, key))));
      var trk = el("span", "trk"), f = el("span", "fill"), w = "calc((100% - 44px) * " + v.toFixed(4) + ")";
      f.style.width = w;
      f.style.background = scoreColor(v);
      var lab = el("span", "val", num(v));
      lab.style.left = w;
      add(trk, f, lab);
      row.appendChild(trk);
      withTip(row, function () { return hoverCard(code, key); }, true);
      row.addEventListener("click", function () { go("#/jurisdiction/" + code); });
      host.appendChild(row);
    });
    return host;
  }

  var cellButtons = {}, matrixOrder = CODES, current = null;
  function categoryMatrix(order) {
    matrixOrder = order;
    cellButtons = {};
    var wrap = el("div", "heat-wrap"), t = el("table", "heat"), thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "corner", "Obligation category"));
    order.forEach(function (code) {
      var th = el("th", "jur-head"), a = link("#/jurisdiction/" + code, code);
      a.title = jurName[code];
      th.appendChild(a);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);
    var tb = el("tbody");
    D.dimensions.forEach(function (d) {
      var sep = el("tr", "dim-sep"), td = el("td", null, d.id + " · " + d.name);
      td.colSpan = order.length + 1;
      sep.appendChild(td);
      tb.appendChild(sep);
      D.mechanisms.filter(function (m) { return m.dimension === d.id; }).forEach(function (m) {
        var tr = el("tr"), th = el("th", "mech");
        add(th, el("span", "n", m.id + "."), m.name);
        th.title = m.description || "";
        tr.appendChild(th);
        order.forEach(function (code) {
          var c = cellOf(m.id, code), td2 = el("td");
          var b = paint(el("button", "cell", glyph(c.score)), c.score);
          b.type = "button";
          if (c.pipeline) b.appendChild(el("span", "pip"));
          b.setAttribute("aria-label", m.name + ", " + jurName[code] + ", score " + c.score + ". Opens the detail.");
          withTip(b, function () {
            return [m.name + " · " + jurName[code],
                    "Score " + num(c.score) + " = min(Existence " + c.existence + ", Scope " + c.scope + ", Enforceability " + c.enforceability + ")",
                    c.instrument_basis || ""].filter(Boolean);
          });
          b.addEventListener("click", function () { openCell(m.id, code); });
          cellButtons[m.id + "|" + code] = b;
          td2.appendChild(b);
          tr.appendChild(td2);
        });
        tb.appendChild(tr);
      });
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    wrap.appendChild(scoreKey(true));
    return wrap;
  }
  function scoreKey(withPipeline) {
    var lg = el("div", "legend-row");
    [[1, "1 · full"], [0.5, "½ · partial"], [0, "0 · no operative obligation"]].forEach(function (p) {
      var k = el("span"), sw = el("span", "sw");
      sw.style.background = scoreColor(p[0]);
      add(k, sw, p[1]);
      lg.appendChild(k);
    });
    if (withPipeline) lg.appendChild(el("span", null, "• in a cell: announced, not yet in force (scores 0)"));
    return lg;
  }

  function scoreBox(v, cls) { return paint(el("div", "scorebox" + (cls ? " " + cls : ""), num(v)), v); }

  // A bar whose data end is rounded (4px) and whose baseline end is square.
  function barPath(x, y, w, h, r) {
    if (w <= 0) return null;
    r = Math.min(r === undefined ? 4 : r, w, h / 2);
    return svg("path", { d: "M" + x + "," + y + "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r +
      "v" + (h - 2 * r) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r + "h" + (-(w - r)) + "z" });
  }
  function seriesKey(items) {
    var k = el("div", "series-key");
    items.forEach(function (it) {
      var s = el("span"), i = el("i", it.shape || "");
      if (it.hollow) { i.style.border = "2px solid " + it.color; i.style.background = "#fff"; } else i.style.background = it.color;
      add(s, i, it.label);
      k.appendChild(s);
    });
    return k;
  }
  function tipRect(parent, x, y, w, h, fn) {
    var r = svg("rect", { x: x, y: y, width: Math.max(w, 1), height: h, class: "hit" });
    withTip(r, fn);
    parent.appendChild(r);
    return r;
  }
  function xGrid(s, x, y0, y1, labels) {
    [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
      s.appendChild(svg("line", { x1: x(g), x2: x(g), y1: y0, y2: y1, class: g === 0 ? "axis" : "grid" }));
      if (labels) s.appendChild(stext({ x: x(g), y: y0 - 6, "text-anchor": "middle" }, g === 0 || g === 1 ? String(g) : g.toFixed(2)));
    });
  }

  // WJP-style strip: the scale, a small triangle for every other jurisdiction, the focus marked and named,
  // and the average of all nine.
  var gradSeq = 0;
  function strip(code, key) {
    var w = 620, x0 = 40, x1 = 580, id = "grad" + (++gradSeq);
    var s = svg("svg", { viewBox: "0 0 " + w + " 78", class: "strip", role: "img",
                         "aria-label": jurName[code] + " " + num(val(code, key)) + " against the other jurisdictions; average " + num(avgOf(key)) });
    var defs = svg("defs"), lg = svg("linearGradient", { id: id });
    STOPS.forEach(function (st) { lg.appendChild(svg("stop", { offset: st[0], "stop-color": st[1] })); });
    defs.appendChild(lg);
    s.appendChild(defs);
    function X(v) { return x0 + v * (x1 - x0); }
    s.appendChild(svg("rect", { x: x0, y: 38, width: x1 - x0, height: 12, fill: "url(#" + id + ")" }));
    s.appendChild(stext({ x: x0 - 6, y: 48, "text-anchor": "end" }, "0.0"));
    s.appendChild(stext({ x: x1 + 6, y: 48 }, "1.0"));
    CODES.forEach(function (c) {
      if (c === code) return;
      var x = X(val(c, key));
      var tri = svg("path", { d: "M" + (x - 5) + ",26L" + (x + 5) + ",26L" + x + ",35Z", fill: "#a7a7ae" });
      withTip(tri, function () { return [jurName[c] + " " + num(val(c, key))]; });
      s.appendChild(tri);
    });
    var avg = avgOf(key), xa = X(avg);
    s.appendChild(svg("line", { x1: xa, x2: xa, y1: 34, y2: 56, stroke: "#3a3a40", "stroke-width": 2 }));
    s.appendChild(stext({ x: Math.min(Math.max(xa, 90), w - 90), y: 70, "text-anchor": "middle" }, "AVERAGE OF " + words(nJ).toUpperCase() + ": " + num(avg)));
    var v = val(code, key), xf = X(v);
    s.appendChild(svg("path", { d: "M" + (xf - 7) + ",22L" + (xf + 7) + ",22L" + xf + ",35Z", fill: "#111" }));
    var anchor = xf < 120 ? "start" : xf > w - 120 ? "end" : "middle";
    s.appendChild(stext({ x: xf, y: 16, "text-anchor": anchor, class: "focus" }, jurName[code].toUpperCase() + " " + num(v)));
    return s;
  }

  // WJP-style ranking columns: every jurisdiction, lowest to highest, the focus marked.
  function rankColumns(code, key) {
    var w = 620, h = 210, x0 = 34, x1 = 610, yb = 170, yt = 30;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img",
                         "aria-label": jurName[code] + " ranks " + rankOf(code, key) + " of " + nJ });
    var order = rankedBy(key).reverse(), bw = (x1 - x0) / order.length;
    function Y(v) { return yb - v * (yb - yt); }
    [0, 0.5, 1].forEach(function (g) {
      s.appendChild(svg("line", { x1: x0, x2: x1, y1: Y(g), y2: Y(g), class: g === 0 ? "axis" : "grid" }));
      s.appendChild(stext({ x: x0 - 6, y: Y(g) + 4, "text-anchor": "end" }, g.toFixed(1)));
    });
    order.forEach(function (c, i) {
      var v = val(c, key), cx = x0 + i * bw + bw / 2, cw = Math.min(24, bw - 8), hh = yb - Y(v);
      if (hh > 0) {
        var p = svg("path", { d: "M" + (cx - cw / 2) + "," + yb + "v" + (-(hh - 4)) + "a4,4 0 0 1 4,-4h" + (cw - 8) +
          "a4,4 0 0 1 4,4v" + (hh - 4) + "z", fill: scoreColor(v) });
        if (hh < 4) p = svg("rect", { x: cx - cw / 2, y: Y(v), width: cw, height: hh, fill: scoreColor(v) });
        s.appendChild(p);
      }
      s.appendChild(stext({ x: cx, y: yb + 16, "text-anchor": "middle", class: c === code ? "ttl" : "" }, c));
      tipRect(s, cx - bw / 2, yt - 10, bw, yb - yt + 10, function () { return [jurName[c] + ": " + num(v) + " (rank " + rankOf(c, key) + ")"]; });
      if (c === code) {
        s.appendChild(svg("path", { d: "M" + (cx - 7) + "," + (Y(v) - 18) + "h14l-7,10z", fill: "#111" }));
        var anchor = i < 2 ? "start" : i > order.length - 3 ? "end" : "middle";
        s.appendChild(stext({ x: cx, y: Y(v) - 24, "text-anchor": anchor, class: "ttl" },
          jurName[code].toUpperCase() + ", " + rankOf(code, key) + " / " + nJ));
      }
    });
    return s;
  }

  // Horizontal bars for one series: rows [{label, value, color, tip}]
  function hbars(rows, opts) {
    opts = opts || {};
    var w = opts.width || 560, lw = opts.labelW || 150, rh = 26, top = 22, h = top + rows.length * rh + 6;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img", "aria-label": opts.label || "" });
    function X(v) { return lw + v * (w - lw - 44); }
    xGrid(s, X, top - 4, h - 6, true);
    rows.forEach(function (r, i) {
      var y = top + i * rh + 5;
      s.appendChild(stext({ x: lw - 8, y: y + 12, "text-anchor": "end", class: "lab" }, r.label));
      var b = barPath(X(0), y, X(r.value) - X(0), 16);
      if (b) { b.setAttribute("fill", r.color || scoreColor(r.value)); s.appendChild(b); }
      s.appendChild(stext({ x: X(r.value) + 5, y: y + 12, class: "val" }, num(r.value)));
      if (r.tip) tipRect(s, 0, y - 4, w, rh, r.tip);
    });
    return s;
  }

  // Slope chart between the De Facto baseline and the latest observation, one line per gatekeeper-market pair.
  function slopeChart(key) {
    var w = 560, h = 250, xa = 150, xb = 410, yt = 26, yb = 210;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img",
                         "aria-label": "De Facto " + keyShort(key).toLowerCase() + ", " + DF_BASE + " and " + DF_NOW });
    function Y(v) { return yb - v * (yb - yt); }
    [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
      s.appendChild(svg("line", { x1: xa, x2: xb, y1: Y(g), y2: Y(g), class: g === 0 ? "axis" : "grid" }));
      s.appendChild(stext({ x: xa - 44, y: Y(g) + 4, "text-anchor": "end" }, g.toFixed(2)));
    });
    s.appendChild(stext({ x: xa, y: h - 12, "text-anchor": "middle" }, DF_BASE));
    s.appendChild(stext({ x: xb, y: h - 12, "text-anchor": "middle" }, DF_NOW));
    var lines = UNITS.map(function (u) { return { u: u, a: mVal("de_facto", u, "baseline", key), b: mVal("de_facto", u, "current", key) }; })
      .filter(function (l) { return l.a !== null && l.b !== null; });
    lines.forEach(function (l) {
      var col = UNIT_COLOR[l.u];
      s.appendChild(svg("line", { x1: xa, y1: Y(l.a), x2: xb, y2: Y(l.b), stroke: col, "stroke-width": 2, "stroke-linecap": "round" }));
      [[xa, l.a], [xb, l.b]].forEach(function (p) {
        s.appendChild(svg("circle", { cx: p[0], cy: Y(p[1]), r: 5, fill: col, stroke: "#fff", "stroke-width": 2 }));
      });
      tipRect(s, xa - 10, Math.min(Y(l.a), Y(l.b)) - 8, xb - xa + 20, Math.abs(Y(l.a) - Y(l.b)) + 16, function () {
        return [unitById[l.u].name, "De Facto " + keyShort(key).toLowerCase() + ": " + num(l.a) + " (" + DF_BASE + ") → " + num(l.b) + " (" + DF_NOW + ")"];
      });
    });
    // End labels, highest value first, each pushed down until it clears the one above, so they keep the lines' order.
    function labels(side) {
      var placed = [];
      lines.slice().sort(function (p, q) { return q[side] - p[side]; }).forEach(function (l) {
        var y = Y(l[side]) + 4;
        if (placed.length && y < placed[placed.length - 1] + 14) y = placed[placed.length - 1] + 14;
        placed.push(y);
        s.appendChild(side === "a"
          ? stext({ x: xa - 10, y: y, "text-anchor": "end", class: "val" }, num(l.a))
          : stext({ x: xb + 10, y: y, class: "val" }, num(l.b) + "  " + unitById[l.u].name));
      });
    }
    labels("a");
    labels("b");
    return s;
  }

  // Stacked bars: how many jurisdictions score 1, 0.5 and 0 on each obligation category.
  function prevalenceChart(sorted, compact) {
    var rows = prevalence();
    if (sorted) rows.sort(function (a, b) { return b.full.length - a.full.length || b.part.length - a.part.length || a.m.id - b.m.id; });
    var w = compact ? 560 : 760, lw = compact ? 232 : 250, rh = compact ? 21 : 25, top = 8, h = top + rows.length * rh + 8;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img",
                         "aria-label": "Number of jurisdictions scoring 1, one half and 0 on each obligation category" });
    var span = w - lw - 10;
    rows.forEach(function (r, i) {
      var y = top + i * rh, x = lw;
      s.appendChild(stext({ x: lw - 8, y: y + rh / 2 + 4, "text-anchor": "end", class: "lab" }, r.m.id + ". " + r.m.name));
      [[r.full, 1, "required in full by"], [r.part, 0.5, "partly required by"], [r.none, 0, "not required by"]].forEach(function (seg) {
        if (!seg[0].length) return;
        var sw = span * seg[0].length / nJ;
        var hgt = rh - 6;
        s.appendChild(svg("rect", { x: x, y: y + 3, width: Math.max(sw - 2, 1), height: hgt, fill: scoreColor(seg[1]),
                                    rx: 1 }));
        if (sw >= 18) s.appendChild(stext({ x: x + (sw - 2) / 2, y: y + 3 + hgt / 2 + 4, "text-anchor": "middle",
                                            fill: inkOn(seg[1]), style: "fill:" + inkOn(seg[1]) }, String(seg[0].length)));
        tipRect(s, x, y + 3, sw - 2, hgt, function () {
          return [r.m.name + ": " + seg[2] + " " + seg[0].length + " of " + nJ, seg[0].map(function (c) { return jurName[c]; }).join(", ")];
        });
        x += sw;
      });
    });
    var wrap = el("div");
    wrap.appendChild(seriesKey([{ label: "Required in full (1)", color: scoreColor(1), shape: "sq" },
                                { label: "Partly (½)", color: scoreColor(0.5), shape: "sq" },
                                { label: "No operative obligation (0)", color: scoreColor(0), shape: "sq" }]));
    wrap.appendChild(s);
    return wrap;
  }

  // De Jure (market level) and De Facto for one gatekeeper-market pair, December 2023 to the latest observation.
  // Hollow mark = December 2023, filled = latest; squares = De Jure, circles = De Facto.
  function lawMarketRows(units, keys) {
    var w = 680, lw = 230, x0 = lw + 20, x1 = w - 50, rh = 22;
    var groups = [];
    units.forEach(function (u) { keys.forEach(function (k) { groups.push({ u: u, k: k }); }); });
    var per = 2 * rh + 22, h = 30 + groups.length * per;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img",
                         "aria-label": "De Jure and De Facto for the gatekeeper–market pairs, " + DF_BASE + " and latest" });
    function X(v) { return x0 + v * (x1 - x0); }
    xGrid(s, X, 22, h - 4, true);
    groups.forEach(function (g, gi) {
      var y = 30 + gi * per;
      s.appendChild(stext({ x: 0, y: y + 10, class: "ttl" }, (units.length > 1 ? unitById[g.u].name + " · " : "") + keyShort(g.k)));
      [["de_jure", "De Jure (market level)", LAW, "sq"], ["de_facto", "De Facto", UNIT_COLOR[g.u], "dot"]].forEach(function (L, li) {
        var yy = y + 14 + li * rh + 10;
        var a = mVal(L[0], g.u, "baseline", g.k), b = mVal(L[0], g.u, "current", g.k);
        s.appendChild(stext({ x: 14, y: yy + 4 }, L[1] + (a === null && b !== null ? ", no " + DF_BASE + " record" : "")));
        if (b === null) return;
        if (a !== null && Math.abs(a - b) > 1e-9) {
          s.appendChild(svg("line", { x1: X(a), x2: X(b), y1: yy, y2: yy, stroke: L[2], "stroke-width": 2 }));
        }
        function mark(v, filled) {
          var m = L[3] === "sq"
            ? svg("rect", { x: X(v) - 5, y: yy - 5, width: 10, height: 10, rx: 1 })
            : svg("circle", { cx: X(v), cy: yy, r: 5 });
          m.setAttribute("fill", filled ? L[2] : "#fff");
          m.setAttribute("stroke", filled ? "#fff" : L[2]);
          m.setAttribute("stroke-width", 2);
          s.appendChild(m);
        }
        if (a !== null) mark(a, false);
        mark(b, true);
        var right = num(b) + (a !== null && a === b ? " (unchanged)" : "");
        s.appendChild(stext({ x: X(b) + 10, y: yy + 4, class: "val" }, right));
        if (a !== null && a !== b && X(b) - X(a) > 44) s.appendChild(stext({ x: X(a) - 9, y: yy + 4, "text-anchor": "end", class: "val" }, num(a)));
        tipRect(s, 0, yy - rh / 2, w, rh, function () {
          return [unitById[g.u].name + " · " + keyShort(g.k), L[1] + ": " + (a === null ? "no " + DF_BASE + " record" : num(a) + " (" + DF_BASE + ")") +
                  " → " + num(b) + " (" + (L[0] === "de_jure" ? DJ_DATE : DF_NOW) + ")"];
        });
      });
    });
    var wrap = el("div");
    var items = [{ label: "De Jure, market level", color: LAW, shape: "sq" }];
    units.forEach(function (u) { items.push({ label: "De Facto, " + unitById[u].name, color: UNIT_COLOR[u] }); });
    items.push({ label: DF_BASE + " (hollow)", color: "#85858c", hollow: true });
    wrap.appendChild(seriesKey(items));
    wrap.appendChild(s);
    return wrap;
  }

  /* ------------------------------------------------------------ detail panel */
  var panel = $("#panel");
  function openPanel(build) {
    ttHide();
    panel.textContent = "";
    var close = el("button", "close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close the detail panel");
    close.addEventListener("click", function () { closePanel(); });
    panel.appendChild(close);
    build(panel);
    panel.hidden = false;
    panel.scrollTop = 0;
    requestAnimationFrame(function () { panel.classList.add("open"); });
    close.focus();
  }
  function closePanel(silent) {
    if (panel.hidden) return;
    panel.classList.remove("open");
    panel.hidden = true;
    Object.keys(cellButtons).forEach(function (k) { cellButtons[k].classList.remove("active"); });
    if (!silent && current && cellButtons[current.pid + "|" + current.code]) cellButtons[current.pid + "|" + current.code].focus();
    current = null;
  }

  function openCell(pid, code) {
    var m = mechById[pid], c = cellOf(pid, code);
    current = { pid: pid, code: code };
    Object.keys(cellButtons).forEach(function (k) { cellButtons[k].classList.toggle("active", k === pid + "|" + code); });
    openPanel(function (p) {
      p.appendChild(el("p", "crumb", m.dimension + " " + dimById[m.dimension].name + " · category " + m.id + " of " + nM));
      p.appendChild(el("h2", null, m.name + ": " + jurName[code]));
      if (m.description) p.appendChild(el("p", "muted small", m.description));
      var fr = el("div", "factor-row");
      var informative = c.binding && c.binding.length < 3;
      [["Existence", c.existence, "existence"], ["Scope", c.scope, "scope"], ["Enforceability", c.enforceability, "enforceability"]]
        .forEach(function (f) {
          var bind = informative && c.binding.indexOf(f[2]) !== -1;
          var box = paint(el("div", "factor" + (bind ? " binding" : "")), f[1]);
          add(box, el("span", "fl", f[0]), el("span", "fv", glyph(f[1])), bind ? el("span", "fb", "binding") : null);
          fr.appendChild(box);
        });
      p.appendChild(fr);
      p.appendChild(el("p", "formula", "score = min(" + c.existence + ", " + c.scope + ", " + c.enforceability + ") = " + c.score));
      if (c.factor_rationale) { p.appendChild(el("h4", null, "Why this score")); p.appendChild(el("p", null, c.factor_rationale)); }
      p.appendChild(el("h4", null, "Legal basis"));
      if (c.legal_form) p.appendChild(el("span", "badge form", pretty(c.legal_form)));
      if (c.instrument_basis) p.appendChild(add(el("p"), el("strong", null, c.instrument_basis)));
      if (c.legal_basis_full && c.legal_basis_full !== c.instrument_basis) p.appendChild(el("p", "small", c.legal_basis_full));
      if (c.market_scope) p.appendChild(el("p", "small", "Market scope: " + c.market_scope));
      (c.extracts || []).forEach(function (x, i) {
        if (!i) p.appendChild(el("h4", null, "The legal text"));
        p.appendChild(el("p", "small", x.instrument + (x.summary ? ": " + x.summary : "")));
        if (x.text) p.appendChild(el("blockquote", null, x.text));
        if (x.translation) p.appendChild(el("blockquote", "translation", x.translation));
      });
      var inst = (D.instruments[code] || []).filter(function (i) {
        var stem = (i.name || "").split(" (")[0];
        return stem && ((c.instrument_basis || "").indexOf(stem) !== -1 || (c.legal_basis_full || "").indexOf(stem) !== -1);
      });
      if (inst.length) {
        p.appendChild(el("h4", null, "Official sources"));
        var ul = el("ul", "link-list");
        inst.forEach(function (i) { ul.appendChild(add(el("li"), el("strong", null, i.name), " ", i.url ? extLink(i.url, i.sourceLabel || domain(i.url)) : null)); });
        p.appendChild(ul);
      }
      if (c.evidence_notes) { p.appendChild(el("h4", null, "Evidence notes")); p.appendChild(el("p", "small", c.evidence_notes)); }
      if (c.pipeline) { p.appendChild(el("h4", null, "Announced, not in force")); p.appendChild(el("p", "small", c.pipeline)); }
      if (c.evidence_date) p.appendChild(el("p", "small muted", "Evidence as of " + c.evidence_date + "."));
      p.appendChild(el("p", "small muted", "Keys: ← → jurisdictions · ↑ ↓ categories · Esc closes."));
    });
  }
  function step(dP, dJ) {
    if (!current) return;
    var pi = D.mechanisms.findIndex(function (m) { return m.id === current.pid; });
    var ji = matrixOrder.indexOf(current.code);
    if (pi < 0 || ji < 0) return;
    pi = Math.max(0, Math.min(nM - 1, pi + dP));
    ji = Math.max(0, Math.min(matrixOrder.length - 1, ji + dJ));
    openCell(D.mechanisms[pi].id, matrixOrder[ji]);
  }
  document.addEventListener("keydown", function (e) {
    if (panel.hidden) return;
    if (e.key === "Escape") { closePanel(); return; }
    if (!current) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); step(0, -1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(0, 1); }
    if (e.key === "ArrowUp") { e.preventDefault(); step(-1, 0); }
    if (e.key === "ArrowDown") { e.preventDefault(); step(1, 0); }
  });
  document.addEventListener("click", function (e) {
    if (panel.hidden || panel.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".cell, .cat-row button, .open-doc")) return;
    closePanel(true);
  });

  function openDoc(doc) {
    current = null;
    openPanel(function (p) {
      p.appendChild(el("p", "crumb", jurName[doc.jurisdiction] + " · full text"));
      p.appendChild(el("h2", null, doc.name || doc.stem));
      p.appendChild(el("p", "small muted", [doc.language, doc.file, Math.round(doc.chars / 1000) + "k characters"].filter(Boolean).join(" · ")));
      var r = window.CI_DB.exec("select content from document_texts where doc_id = " + Number(doc.id));
      var text = r.length && r[0].values.length ? r[0].values[0][0] : "";
      p.appendChild(el("div", "reader", text || "No text on file."));
    });
  }

  /* ------------------------------------------------------------ tables and CSV */
  function csvDownload(name, header, rows) {
    function q(v) {
      if (v === null || v === undefined) return "";
      var s = String(v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var text = "﻿" + [header].concat(rows).map(function (r) { return r.map(q).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    var a = el("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  // cols: [{label, get(row), fmt(value,row) -> string|node, score: bool, num: bool}]
  function dataTable(cols, rows) {
    var wrap = el("div", "table-scroll"), t = el("table", "plain dtable"), thead = el("thead"), hr = el("tr"), tbody = el("tbody");
    var sortCol = -1, dir = 1;
    cols.forEach(function (c, i) {
      var th = el("th", c.num || c.score ? "num" : null), b = el("button", null, c.label);
      b.type = "button";
      b.addEventListener("click", function () {
        if (sortCol === i) dir = -dir; else { sortCol = i; dir = c.num || c.score ? -1 : 1; }
        draw();
      });
      th.appendChild(b);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    add(t, thead, tbody);
    wrap.appendChild(t);
    function draw() {
      var list = rows.slice();
      if (sortCol >= 0) {
        var g = cols[sortCol].get;
        list.sort(function (a, b) {
          var x = g(a), y = g(b);
          if (x === y) return 0;
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          return (x > y ? 1 : -1) * dir;
        });
      }
      Array.prototype.forEach.call(hr.children, function (th, i) {
        th.setAttribute("aria-sort", i === sortCol ? (dir > 0 ? "ascending" : "descending") : "none");
        th.firstChild.dataset.dir = i === sortCol ? (dir > 0 ? "asc" : "desc") : "";
      });
      tbody.textContent = "";
      list.forEach(function (r) {
        var tr = el("tr");
        cols.forEach(function (c) {
          var v = c.get(r), td = el("td", c.score ? "sc" : c.num ? "num" : null);
          if (c.score && v !== null && v !== undefined) { paint(td, v); td.textContent = c.fmt ? c.fmt(v, r) : num(v); }
          else {
            var f = c.fmt ? c.fmt(v, r) : (v === null || v === undefined || v === "" ? "—" : String(v));
            if (typeof f === "string") td.textContent = f; else td.appendChild(f);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    draw();
    return wrap;
  }
  function csvButton(label, fn) {
    var b = el("button", "btn btn-outline", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  /* ------------------------------------------------------------ page scaffolding */
  function section(cls, id) { var s = el("section", "section" + (cls ? " " + cls : "")); if (id) s.id = id; return s; }
  function head(host, kicker, title, intro) {
    if (kicker) host.appendChild(el("p", "sec-kicker", kicker));
    host.appendChild(el("h2", "sec-head", title));
    if (intro) host.appendChild(intro.nodeType ? intro : el("p", "sec-intro", intro));
  }
  function ctrlBar(left) {
    var bar = el("div", "ctrlbar"), inn = el("div", "wrap ctrlbar-in"), l = el("div", "ctrl-left");
    left.forEach(function (n) { l.appendChild(n); });
    add(inn, l, scaleLegend());
    bar.appendChild(inn);
    return bar;
  }
  function jurSelect(selected, placeholder) {
    var sel = el("select", "pselect");
    sel.setAttribute("aria-label", placeholder || "Jurisdiction");
    if (placeholder) sel.appendChild(new Option(placeholder, ""));
    rankedBy("overall").forEach(function (c) { sel.appendChild(new Option(jurName[c], c, false, c === selected)); });
    sel.addEventListener("change", function () { if (sel.value) go("#/jurisdiction/" + sel.value); });
    return sel;
  }

  /* ========================================================== EXPLORE (first page) */
  function pageExplore(app) {
    var state = { key: "overall", pane: "rank" };

    /* 1. Brief */
    var hero = el("section", "hero"), hm = el("div", "hero-map");
    hm.setAttribute("aria-hidden", "true");
    hm.appendChild(drawWorld({ key: "overall" }));
    hero.appendChild(hm);
    var hin = el("div", "hero-in");
    hin.appendChild(add(el("h1"), "How far do the laws require digital markets to be open to rivals, and how far are the markets ",
                        el("em", null, "actually open?")));
    hin.appendChild(el("p", "lede", "What is the difference between countries? We answer these questions in two layers: what the law " +
      "requires (De Jure) and what we observe in the market (De Facto)."));
    hin.appendChild(aiP("The De Jure layer scores " + words(nM) + " pro-contestability obligation categories, grouped into " +
      words(nD) + " dimensions, in the law of " + words(nJ) + " jurisdictions as of " + DJ_DATE + ". The De Facto layer scores the same " +
      words(nM) + " mechanisms as observed in " + words(nU) + " European Union gatekeeper–market pairs, in " + DF_BASE + " and " + DF_NOW + ".", "brief"));
    var stats = el("div", "hero-stats");
    [[nJ, "Jurisdictions"], [nM, "Obligation categories"], [nD, "Dimensions"], [nU, "EU gatekeeper–market pairs"]].forEach(function (x) {
      stats.appendChild(add(el("div", "hero-stat"), el("b", null, String(x[0])), el("span", null, x[1])));
    });
    hin.appendChild(stats);
    var cta = el("button", "btn btn-fill", "Explore the data");
    cta.type = "button";
    hin.appendChild(cta);
    hero.appendChild(hin);
    app.appendChild(hero);

    /* 2-4. Map, hover card and plot zone in the same place */
    var ex = el("section");
    ex.id = "explore";
    cta.addEventListener("click", function () { scrollToEl(ex); });
    var seg = el("div", "seg"), bMap = el("button", null, "Map"), bPlot = el("button", null, "Plot zone");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "View");
    [bMap, bPlot].forEach(function (b) { b.type = "button"; seg.appendChild(b); });
    ex.appendChild(ctrlBar([seg, jurSelect(null, "Go to a jurisdiction")]));

    var stage = el("div", "map-stage"), mapTitle = el("div", "map-title");
    var world = drawWorld({ interactive: true, keyRef: function () { return state.key; } });
    add(stage, mapTitle, world, el("div", "map-hint", "Hover over a jurisdiction for its scores · click to open its profile"));
    var noteRow = el("p", "map-note small muted");
    var sw = el("span", "sw");
    sw.style.cssText = "display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:-1px;background:#e8e8e8";
    add(noteRow, sw, "Not assessed. Germany carries its own score; the other 26 EU member states carry the EU score.");
    var mapView = add(el("div"), stage, noteRow);
    var plotView = el("div");
    plotView.hidden = true;
    var plotBuilt = false;
    add(ex, mapView, plotView);
    function setView(v) {
      bMap.setAttribute("aria-pressed", v === "map" ? "true" : "false");
      bPlot.setAttribute("aria-pressed", v === "plot" ? "true" : "false");
      mapView.hidden = v !== "map";
      plotView.hidden = v !== "plot";
      if (v === "plot" && !plotBuilt) { plotZone(plotView); plotBuilt = true; }
    }
    bMap.addEventListener("click", function () { setView("map"); });
    bPlot.addEventListener("click", function () { setView("plot"); });
    setView("map");

    var grid = el("div", "explore-grid"), list = el("div", "dimlist"), pane = el("div", "rankpane");
    var dimButtons = {};
    function dimButton(k, label, q) {
      var b = el("button", null, label);
      b.type = "button";
      if (q) b.appendChild(el("span", "q", q));
      b.addEventListener("click", function () { setKey(k); });
      dimButtons[k] = b;
      return b;
    }
    list.appendChild(dimButton("overall", "Overall index score"));
    list.appendChild(el("div", "lab", "Explore by dimension"));
    DIMS.forEach(function (d, i) {
      var q = (D.paper.dimensionQuestions || {})[d];
      list.appendChild(dimButton(d, (i + 1) + " | " + dimById[d].name, q ? q.question : ""));
    });
    var tabs = el("div", "tabs-row"), tRank = el("button", null, "Ranking"), tMatrix = el("button", null, "All " + D.meta.totalCells + " scores");
    [tRank, tMatrix].forEach(function (b) { b.type = "button"; b.setAttribute("role", "tab"); tabs.appendChild(b); });
    tabs.setAttribute("role", "tablist");
    var paneTitle = el("h3", "pane-title"), paneBody = el("div");
    add(pane, tabs, paneTitle, paneBody);
    tRank.addEventListener("click", function () { state.pane = "rank"; drawPane(); });
    tMatrix.addEventListener("click", function () { state.pane = "matrix"; drawPane(); });
    add(grid, list, pane);
    mapView.appendChild(grid);
    app.appendChild(ex);

    function drawPane() {
      tRank.setAttribute("aria-selected", state.pane === "rank" ? "true" : "false");
      tMatrix.setAttribute("aria-selected", state.pane === "matrix" ? "true" : "false");
      paneBody.textContent = "";
      if (state.pane === "rank") {
        paneTitle.textContent = "Jurisdictions ranked by " + (state.key === "overall" ? "the De Jure index" : state.key + " " + dimById[state.key].name) + ", " + DJ_DATE;
        paneBody.appendChild(rankingList(state.key));
      } else {
        paneTitle.textContent = "Every De Jure score: " + nM + " categories × " + nJ + " jurisdictions (click a cell for the legal basis)";
        paneBody.appendChild(categoryMatrix(rankedBy(state.key)));
      }
    }
    function setKey(k) {
      state.key = k;
      world.recolor();
      Object.keys(dimButtons).forEach(function (x) { dimButtons[x].setAttribute("aria-pressed", x === k ? "true" : "false"); });
      mapTitle.textContent = "De Jure, " + DJ_DATE + " · " + (k === "overall" ? "overall index" : k + " " + dimById[k].name);
      drawPane();
    }
    setKey("overall");

    /* 5. Notes right after the map */
    var notes = section("alt", "notes"), nin = el("div", "wrap");
    head(nin, "Before you compare", "Five things to know when reading the map");
    var grid2 = el("div", "notes-grid");
    [
      ["The law as written, not compliance",
       "A De Jure score records whether the law requires an obligation, how widely it applies and whether it can be enforced. " +
       "It does not record whether firms comply or whether the market has changed; that is the De Facto layer."],
      ["Grey is not zero",
       words(nJ).charAt(0).toUpperCase() + words(nJ).slice(1) + " jurisdictions are assessed. Grey areas have not been assessed, which is different " +
       "from a score of zero. The 27 EU member states share the EU score; Germany also has its own national regime and its own score."],
      ["Scores move in steps of one half",
       "Each obligation category is scored 0, 0.5 or 1 on Existence, Scope and Enforceability, and takes the lowest of the three. " +
       "A dimension is the mean of its categories, and the index is the mean of the " + words(nD) + " dimensions."],
      ["De Facto covers three EU pairs",
       "The De Facto layer is measured for " + listText(UNITS.map(function (u) { return unitById[u].name; })) + " in the European Union. " +
       "The other jurisdictions have De Jure scores only, so the map shows the law everywhere and the market only in the EU card."],
      ["Before and after, not cause and effect",
       "The De Facto observations compare " + DF_BASE + ", before the Digital Markets Act's obligations applied in March 2024, with " +
       DF_NOW + ". A change between the two dates happened after the Act applied; the index does not show that the Act caused it."]
    ].forEach(function (n) {
      var c = el("div", "note");
      c.appendChild(el("h3", null, n[0]));
      c.appendChild(aiP(n[1]));
      grid2.appendChild(c);
    });
    nin.appendChild(grid2);
    notes.appendChild(nin);
    app.appendChild(notes);

    /* 6. Key points */
    var kps = section(null, "key-points"), kin = el("div", "wrap");
    head(kin, "Key points", "Answers to the questions people ask first",
      aiP("The answers below are drafts. Every number in them is read from the project database when this page opens.", "sec-intro"));
    var kl = el("div", "kp-list");
    keyPoints().forEach(function (k, i) {
      var c = el("div", "kp"), t = el("div");
      t.appendChild(el("p", "qn", "Question " + (i + 1)));
      t.appendChild(el("h3", null, k.q));
      if (k.big) {
        var big = el("div", "big");
        k.big.forEach(function (b) { big.appendChild(add(el("div"), el("b", null, b[0]), el("span", null, b[1]))); });
        t.appendChild(big);
      }
      k.text.forEach(function (p) { t.appendChild(aiP(p)); });
      if (k.more) {
        var mo = link(k.more[0] === "explore" ? "#/" : k.more[0], k.more[1] + " →");
        if (k.more[0] === "explore") mo.addEventListener("click", function (e) { e.preventDefault(); scrollToEl(ex); });
        t.appendChild(add(el("p", "small"), mo));
      }
      var v = el("div", "viz");
      v.appendChild(k.viz());
      add(c, t, v);
      kl.appendChild(c);
    });
    kin.appendChild(kl);
    kps.appendChild(kin);
    app.appendChild(kps);

    /* where to go next */
    var nx = section("alt"), xin = el("div", "wrap");
    head(xin, "Go further", "Read the details");
    var cards = el("div", "link-cards");
    [["#/jurisdictions", "Jurisdiction profiles", "Every category score, with the law behind it, for each of the " + words(nJ) + " jurisdictions."],
     ["#/cases", "Case studies", "Three cases told with the data: an app store, one law in three markets, and Japan."],
     ["#/scoring", "Scoring rules", "How a legal text becomes a 0, ½ or 1, and how the scores add up."],
     ["#/data", "Data", "Every table on one page, sortable and downloadable."],
     ["#/legal", "Legal documents", "The instruments, the articles relied on and the verbatim provisions."]].forEach(function (x) {
      var a = link(x[0], "");
      a.className = "link-card";
      add(a, el("b", null, x[1]), el("span", null, x[2]));
      cards.appendChild(a);
    });
    xin.appendChild(cards);
    nx.appendChild(xin);
    app.appendChild(nx);
  }

  function keyPoints() {
    var out = [];
    var rk = rankedBy("overall"), topV = val(rk[0], "overall");
    var tops = rk.filter(function (c) { return val(c, "overall") === topV; });
    var rest = rk.filter(function (c) { return tops.indexOf(c) < 0; });
    var below = rk.filter(function (c) { return val(c, "overall") < 0.5; });
    var last = rk[rk.length - 1];
    var pending = D.mechanisms.filter(function (m) { var c = cellOf(m.id, last); return c.legal_form === "pending" && c.score === 0; }).length;
    out.push({
      q: "Which jurisdictions require the most?",
      big: [[num(topV), listText(tops.map(function (c) { return jurName[c]; }))], [num(val(rest[0], "overall")), jurName[rest[0]]],
            [num(val(last, "overall")), jurName[last]]],
      text: [cap(theNames(tops)) + (tops.length > 1 ? " score " : " scores ") + num(topV) +
             (topV === 1 ? ": the law requires all " + words(nM) + " obligation categories in full. " : ". ") +
             cap(theName(rest[0])) + " follows at " + num(val(rest[0], "overall")) + ". " + cap(words(below.length)) +
             " jurisdictions score below 0.50, and " + theName(last) + " scores lowest at " + num(val(last, "overall")) +
             (pending ? "; " + words(pending) + " of its " + words(nM) + " categories are covered only by announced reforms that are not yet in force, which score zero." : ".")],
      more: ["#/jurisdictions", "Open the jurisdiction profiles"],
      viz: function () { return rankingList("overall"); }
    });

    var ch = UNITS.map(function (u) { return { u: u, a: mVal("de_facto", u, "baseline", "overall"), b: mVal("de_facto", u, "current", "overall") }; })
      .filter(function (x) { return x.a !== null && x.b !== null; });
    var up = ch.slice().sort(function (x, y) { return (y.b - y.a) - (x.b - x.a); });
    out.push({
      q: "Did the three EU markets open up after the Digital Markets Act?",
      big: ch.map(function (x) { return [num(x.a) + " → " + num(x.b), unitById[x.u].name]; }),
      text: [(ch.every(function (x) { return x.b > x.a; }) ? "All " + words(ch.length) + " pairs scored higher in " + DF_NOW + " than in " + DF_BASE + ". " : "") +
             unitById[up[0].u].name + " rose the most, from " + num(up[0].a) + " to " + num(up[0].b) + ". These are observations from before " +
             "and after the Act's obligations began to apply in March 2024; they are not estimates of the Act's effect."],
      more: ["#/cases", "Read the case studies"],
      viz: function () {
        var w = el("div");
        w.appendChild(seriesKey(UNITS.map(function (u) { return { label: unitById[u].name, color: UNIT_COLOR[u] }; })));
        w.appendChild(slopeChart("overall"));
        return w;
      }
    });

    var eff = UNITS.map(function (u) { return effOf(u, "current"); }).filter(Boolean);
    var gaps = eff.map(function (e) { return e.gap; }), dfs = eff.map(function (e) { return e.deFacto; });
    var allFull = eff.every(function (e) { return e.deJure === 1; });
    out.push({
      q: "How far behind the law are the markets?",
      big: eff.map(function (e) { return [num(e.gap), "gap, " + unitById[e.unit].name]; }),
      text: [(allFull ? "In " + DJ_DATE + " EU law requires all " + words(nM) + " obligations in each of the three markets: the market-level De Jure score is " +
               num(1) + " for every pair. " : "") +
             "The " + DF_NOW + " De Facto scores run from " + num(Math.min.apply(null, dfs)) + " to " + num(Math.max.apply(null, dfs)) +
             ", so the implementation gap, De Jure minus De Facto, is between " + num(Math.min.apply(null, gaps)) + " and " + num(Math.max.apply(null, gaps)) + "."],
      more: ["#/jurisdiction/EU", "See the European Union profile"],
      viz: function () {
        var rows = [];
        eff.forEach(function (e) {
          rows.push({ label: unitById[e.unit].name + ", De Jure", value: e.deJure, color: LAW,
                      tip: function () { return [unitById[e.unit].name, "De Jure, market level, " + DJ_DATE + ": " + num(e.deJure)]; } });
          rows.push({ label: "De Facto", value: e.deFacto, color: UNIT_COLOR[e.unit],
                      tip: function () { return [unitById[e.unit].name, "De Facto, " + DF_NOW + ": " + num(e.deFacto), "Gap: " + num(e.gap)]; } });
        });
        return hbars(rows, { labelW: 200, label: "De Jure and De Facto for each pair" });
      }
    });

    var pv = prevalence();
    var maxF = Math.max.apply(null, pv.map(function (p) { return p.full.length; }));
    var minF = Math.min.apply(null, pv.map(function (p) { return p.full.length; }));
    var most = pv.filter(function (p) { return p.full.length === maxF; }), least = pv.filter(function (p) { return p.full.length === minF; });
    var onlyEU = least.every(function (p) { return p.full.slice().sort().join() === "DE,EU"; });
    function names(ps) { return listText(ps.map(function (p) { return p.m.name.toLowerCase(); })); }
    out.push({
      q: "Which obligations are most and least common?",
      big: [[maxF + " of " + nJ, "most common"], [minF + " of " + nJ, "least common"]],
      text: [(most.length > 1 ? cap(words(most.length)) + " categories are" : "One category is") + " required in full by " + words(maxF) + " of the " + words(nJ) +
             " jurisdictions, the most of any: " + names(most) + ". " + (least.length > 1 ? cap(words(least.length)) + " categories are" : "One category is") +
             " required in full by " + words(minF) + (onlyEU ? ", the European Union and Germany, whose scores rest on the same EU law" : "") + ": " + names(least) + "."],
      more: ["#/data", "Open the category table"],
      viz: function () { return prevalenceChart(true, true); }
    });

    var sp = DIMS.map(function (d) {
      var vs = CODES.map(function (c) { return val(c, d); }), mean = vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
      var sd = Math.sqrt(vs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / vs.length);
      var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
      return { d: d, sd: sd, min: mn, max: mx,
               lo: CODES.filter(function (c) { return val(c, d) === mn; }), hi: CODES.filter(function (c) { return val(c, d) === mx; }) };
    });
    var bySd = sp.slice().sort(function (a, b) { return b.sd - a.sd; }), hiS = bySd[0], loS = bySd[bySd.length - 1];
    function who(cs) { var n = cs.map(theName); return n.length > 3 ? n.slice(0, 2).join(", ") + " and " + (n.length - 2) + " others" : listText(n); }
    out.push({
      q: "Where do the jurisdictions differ most?",
      big: [[num(hiS.sd), "spread on " + hiS.d], [num(loS.sd), "spread on " + loS.d]],
      text: ["The jurisdictions differ most on " + hiS.d + " " + dimById[hiS.d].name + ", where scores run from " + num(hiS.min) + " (" + who(hiS.lo) +
             ") to " + num(hiS.max) + " (" + who(hiS.hi) + "). They differ least on " + loS.d + " " + dimById[loS.d].name + ", from " + num(loS.min) +
             " to " + num(loS.max) + ". Spread is the standard deviation of the " + words(nJ) + " scores."],
      more: ["explore", "Use the dimension list under the map"],
      viz: function () { return dimSpread(); }
    });
    return out;
  }

  // One row per dimension, a dot for every jurisdiction; the lowest and highest are named.
  function dimSpread() {
    var w = 560, lw = 170, x0 = lw + 10, x1 = w - 20, rh = 46, top = 22, h = top + DIMS.length * rh + 4;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img", "aria-label": "Scores of every jurisdiction on each dimension" });
    function X(v) { return x0 + v * (x1 - x0); }
    xGrid(s, X, top - 4, h - 4, true);
    DIMS.forEach(function (d, i) {
      var y = top + i * rh + rh / 2;
      s.appendChild(stext({ x: lw - 4, y: y + 4, "text-anchor": "end", class: "lab" }, d + " " + DIM_SHORT[d]));
      s.appendChild(svg("line", { x1: x0, x2: x1, y1: y, y2: y, class: "grid" }));
      var groups = {};
      CODES.forEach(function (c) { var k = num(val(c, d)); (groups[k] = groups[k] || []).push(c); });
      Object.keys(groups).forEach(function (k) {
        var v = +k, cs = groups[k];
        s.appendChild(svg("circle", { cx: X(v), cy: y, r: 6, fill: scoreColor(v), stroke: "#fff", "stroke-width": 2 }));
        var hit = svg("circle", { cx: X(v), cy: y, r: 13, class: "hit" });
        withTip(hit, function () { return [d + " " + num(v), cs.map(function (c) { return jurName[c]; }).join(", ")]; });
        s.appendChild(hit);
      });
      var vs = CODES.map(function (c) { return val(c, d); }), mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
      s.appendChild(stext({ x: X(mn), y: y + 20, "text-anchor": X(mn) < x0 + 30 ? "start" : "middle", class: "val" }, groups[num(mn)].join(", ")));
      s.appendChild(stext({ x: X(mx), y: y - 11, "text-anchor": X(mx) > x1 - 30 ? "end" : "middle", class: "val" }, groups[num(mx)].join(", ")));
    });
    return s;
  }

  /* ---------------------------------------------------------- plot zone (same place as the map) */
  var PZ = { preset: "compare", sel: null, x: "D1", y: "D4", lm: "overall", eff: "current", sorted: true };
  function plotZone(host) {
    var PRESETS = [
      ["compare", "Compare jurisdictions", pzCompare],
      ["scatter", "Dimension against dimension", pzScatter],
      ["lawmarket", "Law against market (EU pairs)", pzLawMarket],
      ["effective", "Effective Contestability", pzEffective],
      ["prevalence", "How common is each obligation?", pzPrevalence]
    ];
    var wrap = el("div", "plotzone"), side = el("div", "pz-side"), main = el("div", "pz-main");
    side.appendChild(el("h3", null, "Presets"));
    var pl = el("div", "pz-presets"), btns = {};
    PRESETS.forEach(function (p) {
      var b = el("button", null, p[1]);
      b.type = "button";
      b.addEventListener("click", function () { show(p[0]); });
      btns[p[0]] = b;
      pl.appendChild(b);
    });
    side.appendChild(pl);
    side.appendChild(el("h3", null, "Options"));
    var opts = el("div", "pz-opts");
    side.appendChild(opts);
    add(wrap, side, main);
    host.appendChild(wrap);
    function show(id) {
      PZ.preset = id;
      Object.keys(btns).forEach(function (k) { btns[k].setAttribute("aria-pressed", k === id ? "true" : "false"); });
      opts.textContent = "";
      main.textContent = "";
      PRESETS.filter(function (p) { return p[0] === id; })[0][2](main, opts);
    }
    show(PZ.preset);
  }
  function selectBox(label, options, value, onChange) {
    var l = el("label", null, label), s = el("select");
    options.forEach(function (o) { s.appendChild(new Option(o[1], o[0], false, o[0] === value)); });
    s.addEventListener("change", function () { onChange(s.value); });
    l.appendChild(s);
    return l;
  }
  var KEY_OPTS = KEYS.map(function (k) { return [k, keyShort(k)]; });

  function pzCompare(main, opts) {
    if (!PZ.sel) PZ.sel = [["EU", 0], ["JP", 1], ["CN", 2], ["US", 3]];
    opts.appendChild(el("label", null, "Jurisdictions (up to four)"));
    var checks = el("div", "pz-checks"), boxes = {};
    rankedBy("overall").forEach(function (c) {
      var l = el("label"), cb = el("input");
      cb.type = "checkbox";
      cb.checked = PZ.sel.some(function (x) { return x[0] === c; });
      cb.addEventListener("change", function () {
        if (cb.checked) {
          var used = PZ.sel.map(function (x) { return x[1]; }), slot = [0, 1, 2, 3].filter(function (k) { return used.indexOf(k) < 0; })[0];
          PZ.sel.push([c, slot]);
        } else PZ.sel = PZ.sel.filter(function (x) { return x[0] !== c; });
        sync();
        draw();
      });
      boxes[c] = cb;
      add(l, cb, jurName[c]);
      checks.appendChild(l);
    });
    opts.appendChild(checks);
    function sync() { Object.keys(boxes).forEach(function (c) { boxes[c].disabled = !boxes[c].checked && PZ.sel.length >= 4; }); }
    sync();
    function draw() {
      main.textContent = "";
      main.appendChild(el("h3", null, "Compare jurisdictions across the four dimensions"));
      main.appendChild(el("p", "pz-sub", "De Jure scores, " + DJ_DATE + ". One bar per jurisdiction; colours stay with the jurisdiction while you change the selection."));
      var sel = PZ.sel.slice().sort(function (a, b) { return a[1] - b[1]; });
      if (!sel.length) { main.appendChild(el("p", "muted", "Pick at least one jurisdiction.")); return; }
      main.appendChild(seriesKey(sel.map(function (x) { return { label: jurName[x[0]], color: SERIES[x[1]], shape: "sq" }; })));
      var w = 760, lw = 190, bh = 14, gap = 2, gpad = 18, top = 22;
      var gh = sel.length * (bh + gap) - gap, h = top + KEYS.length * (gh + gpad) + 4;
      var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img", "aria-label": "Grouped bars by dimension" });
      function X(v) { return lw + v * (w - lw - 50); }
      xGrid(s, X, top - 4, h - 4, true);
      KEYS.forEach(function (k, gi) {
        var y0 = top + gi * (gh + gpad) + gpad / 2;
        s.appendChild(stext({ x: lw - 10, y: y0 + gh / 2 + 4, "text-anchor": "end", class: "lab" }, keyShort(k)));
        sel.forEach(function (x, i) {
          var v = val(x[0], k), y = y0 + i * (bh + gap);
          var b = barPath(X(0), y, X(v) - X(0), bh);
          if (b) { b.setAttribute("fill", SERIES[x[1]]); s.appendChild(b); }
          s.appendChild(stext({ x: X(v) + 5, y: y + bh - 3, class: "val" }, num(v)));
          tipRect(s, X(0), y, w - X(0), bh, function () { return [jurName[x[0]], keyName(k) + ": " + num(v)]; });
        });
      });
      main.appendChild(s);
    }
    draw();
  }

  function pzScatter(main, opts) {
    opts.appendChild(selectBox("Horizontal axis", KEY_OPTS, PZ.x, function (v) { PZ.x = v; draw(); }));
    opts.appendChild(selectBox("Vertical axis", KEY_OPTS, PZ.y, function (v) { PZ.y = v; draw(); }));
    function draw() {
      main.textContent = "";
      main.appendChild(el("h3", null, keyShort(PZ.y) + " against " + keyShort(PZ.x)));
      main.appendChild(el("p", "pz-sub", "De Jure, " + DJ_DATE + ". One dot per jurisdiction; on the diagonal the two scores are equal."));
      var w = 560, h = 470, x0 = 70, x1 = 520, y0 = 410, y1 = 20;
      var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img", "aria-label": keyShort(PZ.y) + " against " + keyShort(PZ.x) });
      function X(v) { return x0 + v * (x1 - x0); }
      function Y(v) { return y0 - v * (y0 - y1); }
      [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
        s.appendChild(svg("line", { x1: X(g), x2: X(g), y1: y0, y2: y1, class: g === 0 ? "axis" : "grid" }));
        s.appendChild(svg("line", { x1: x0, x2: x1, y1: Y(g), y2: Y(g), class: g === 0 ? "axis" : "grid" }));
        s.appendChild(stext({ x: X(g), y: y0 + 18, "text-anchor": "middle" }, g.toFixed(2)));
        s.appendChild(stext({ x: x0 - 8, y: Y(g) + 4, "text-anchor": "end" }, g.toFixed(2)));
      });
      s.appendChild(svg("line", { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), class: "ref" }));
      s.appendChild(stext({ x: (x0 + x1) / 2, y: h - 16, "text-anchor": "middle", class: "ttl" }, keyName(PZ.x)));
      s.appendChild(stext({ x: 16, y: (y0 + y1) / 2, "text-anchor": "middle", class: "ttl",
                            transform: "rotate(-90 16 " + ((y0 + y1) / 2) + ")" }, keyName(PZ.y)));
      var groups = {};
      CODES.forEach(function (c) { var k = num(val(c, PZ.x)) + "|" + num(val(c, PZ.y)); (groups[k] = groups[k] || []).push(c); });
      var placed = [];
      function free(bx) { return !placed.some(function (p) { return bx.x < p.x + p.w && bx.x + bx.w > p.x && bx.y < p.y + p.h && bx.y + bx.h > p.y; }); }
      Object.keys(groups).forEach(function (k) {
        var cs = groups[k], vx = val(cs[0], PZ.x), vy = val(cs[0], PZ.y), cx = X(vx), cy = Y(vy);
        s.appendChild(svg("circle", { cx: cx, cy: cy, r: 7, fill: LAW, stroke: "#fff", "stroke-width": 2 }));
        var hit = svg("circle", { cx: cx, cy: cy, r: 15, class: "hit" });
        withTip(hit, function () { return cs.map(function (c) { return jurName[c]; }).concat([PZ.x + " " + num(vx) + " · " + PZ.y + " " + num(vy)]); });
        s.appendChild(hit);
        var t = cs.join(", "), tw = t.length * 7.4 + 4;
        var cand = [{ x: cx + 11, y: cy - 8, a: "start" }, { x: cx - 11 - tw, y: cy - 8, a: "end" }, { x: cx - tw / 2, y: cy - 28, a: "middle" },
                    { x: cx - tw / 2, y: cy + 12, a: "middle" }, { x: cx + 11, y: cy + 6, a: "start" }, { x: cx - 11 - tw, y: cy + 6, a: "end" }];
        var pick = cand.filter(function (c) { return free({ x: c.x, y: c.y, w: tw, h: 16 }) && c.x > 0 && c.x + tw < w; })[0] || cand[0];
        placed.push({ x: pick.x, y: pick.y, w: tw, h: 16 });
        var tx = pick.a === "start" ? pick.x : pick.a === "end" ? pick.x + tw : pick.x + tw / 2;
        s.appendChild(stext({ x: tx, y: pick.y + 12, "text-anchor": pick.a, class: "lab" }, t));
      });
      main.appendChild(s);
    }
    draw();
  }

  function pzLawMarket(main, opts) {
    opts.appendChild(selectBox("Measure", KEY_OPTS, PZ.lm, function (v) { PZ.lm = v; draw(); }));
    function draw() {
      main.textContent = "";
      main.appendChild(el("h3", null, "Law against market in the three EU gatekeeper–market pairs"));
      main.appendChild(el("p", "pz-sub", keyName(PZ.lm) + ". De Jure at market level (" + DF_BASE + " and " + DJ_DATE + ") and De Facto (" +
        DF_BASE + " and " + DF_NOW + "). The distance between the filled square and the filled circle is the implementation gap."));
      main.appendChild(lawMarketRows(UNITS, [PZ.lm]));
    }
    draw();
  }

  function pzEffective(main, opts) {
    opts.appendChild(selectBox("Observation", [["current", "Latest (" + DJ_DATE + " / " + DF_NOW + ")"], ["baseline", DF_BASE]], PZ.eff,
      function (v) { PZ.eff = v; draw(); }));
    function draw() {
      main.textContent = "";
      main.appendChild(el("h3", null, "Effective Contestability, shown beside both layers"));
      main.appendChild(el("p", "pz-sub", "The paper's four ways of relating the two layers (equations 5 to 8), for each gatekeeper–market pair."));
      var specs = D.paper.effectiveSpecs || [];
      var t = el("table", "plain"), hr = el("tr");
      ["Gatekeeper–market pair", "De Jure", "De Facto"].concat(specs.map(function (s) { return pretty(s.id) + " " + s.eq; })).forEach(function (x, i) {
        hr.appendChild(el("th", i ? "num" : null, x));
      });
      t.appendChild(hr);
      UNITS.forEach(function (u) {
        var e = effOf(u, PZ.eff), tr = el("tr");
        tr.appendChild(el("td", null, unitById[u].name));
        var vals = e ? [e.deJure, e.deFacto, e.multiplicative, e.arithmetic, e.bottleneck, e.gap] : [null, null, null, null, null, null];
        vals.forEach(function (v, i) {
          var td = el("td", "num", num(v));
          if (v !== null && i < 5) { paint(td, v); td.style.textAlign = "center"; td.style.fontWeight = "700"; }
          tr.appendChild(td);
        });
        t.appendChild(tr);
      });
      main.appendChild(add(el("div", "table-scroll"), t));
      var ul = el("ul", "small");
      specs.forEach(function (s) { ul.appendChild(el("li", null, s.eq + " " + s.formula + ": " + s.use + ".")); });
      main.appendChild(ul);
      var rr = D.paper.reportingRequirements || {};
      if (rr.effectiveTogether) main.appendChild(el("p", "small muted", "“" + rr.effectiveTogether + "” (" + rr.source + ")"));
      main.appendChild(el("p", "small muted", "The gap is a difference between the layers, not a score, so it is not coloured. λ = " + D.meta.lambda +
        ". A pair with no De Jure record at an observation date shows the De Facto score only."));
    }
    draw();
  }

  function pzPrevalence(main, opts) {
    opts.appendChild(selectBox("Order", [["sorted", "Most required first"], ["id", "Category order"]], PZ.sorted ? "sorted" : "id",
      function (v) { PZ.sorted = v === "sorted"; draw(); }));
    function draw() {
      main.textContent = "";
      main.appendChild(el("h3", null, "How many of the " + words(nJ) + " jurisdictions require each obligation?"));
      main.appendChild(el("p", "pz-sub", "De Jure, " + DJ_DATE + ". Each bar splits the " + words(nJ) + " jurisdictions by their score on that category."));
      main.appendChild(prevalenceChart(PZ.sorted, false));
    }
    draw();
  }

  /* ========================================================== JURISDICTIONS */
  function pageJurisdictions(app) {
    app.appendChild(ctrlBar([jurSelect(null, "Choose a jurisdiction")]));
    var s = section(), w = el("div", "wrap");
    head(w, "Jurisdictions", "Nine profiles",
      aiP("Each profile shows the De Jure index, the four dimensions and all " + words(nM) + " categories, with the legal basis for every score. " +
          "The European Union profile also shows the De Facto observations for the three gatekeeper–market pairs.", "sec-intro"));
    var cards = el("div", "jur-cards");
    rankedBy("overall").forEach(function (c) {
      var a = link("#/jurisdiction/" + c, ""), v = val(c, "overall"), n = counts(c);
      a.className = "jur-card";
      var t = el("div");
      add(t, el("h3", null, jurName[c]), el("div", "r", "Rank " + rankOf(c, "overall") + " of " + nJ + " · " + n.full + " of " + nM + " categories in full"));
      add(a, t, paint(el("div", "sb", num(v)), v));
      cards.appendChild(a);
    });
    w.appendChild(cards);
    s.appendChild(w);
    app.appendChild(s);
  }

  function pageJurisdiction(app, code) {
    var j = jurByCode[code], a = D.aggregates[code], v = a.overall, n = counts(code), mf = mainForm(code);
    document.title = j.name + " · The Contestability Index";
    app.appendChild(ctrlBar([jurSelect(code)]));
    var grid = el("div", "wrap profile-grid"), side = el("div", "profile-side"), main = el("div", "profile-main");
    grid.style.padding = "0";

    var mm = el("div", "mini-map");
    mm.appendChild(drawWorld({ key: "overall", focus: code, viewBox: MINI_VIEW[code], interactive: true,
                               label: "Map of " + j.name }));
    side.appendChild(mm);
    var list = el("div", "dimlist"), targets = {};
    function jump(label, id, pressed) {
      var b = el("button", null, label);
      b.type = "button";
      if (pressed) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () { scrollToEl(targets[id]); });
      list.appendChild(b);
    }
    jump("Overall index score", "overall", true);
    list.appendChild(el("div", "lab", "Explore by dimension"));
    DIMS.forEach(function (d, i) { jump((i + 1) + " | " + dimById[d].name, d); });
    list.appendChild(el("div", "lab", "More"));
    jump("Law and market", "lawmarket");
    jump("Legal sources", "legal");
    side.appendChild(list);

    main.appendChild(el("h1", "pname", j.name));
    var info = el("div", "pinfo");
    [["Snapshot", DJ_DATE], ["Categories in full", n.full + " of " + nM], ["Most common legal form", pretty(mf.label) + " (" + mf.n + " of " + nM + ")"],
     ["Instruments on record", String((D.instruments[code] || []).length)]].forEach(function (x) {
      info.appendChild(add(el("div"), el("span", null, x[0]), el("b", null, x[1])));
    });
    main.appendChild(info);
    var tabs = el("div", "ptabs");
    [["Overall", "overall"], ["Dimensions", "D1"], ["Law and market", "lawmarket"], ["Legal sources", "legal"]].forEach(function (x) {
      var t = link("#/jurisdiction/" + code, x[0]);
      t.addEventListener("click", function (e) { e.preventDefault(); scrollToEl(targets[x[1]]); });
      tabs.appendChild(t);
    });
    main.appendChild(tabs);

    /* overall */
    var ov = el("div", "card");
    targets.overall = ov;
    ov.appendChild(el("h2", null, j.name + " Overall Score, " + DJ_DATE));
    var og = el("div", "overall"), ol = el("div");
    ol.appendChild(el("p", "box-label", "De Jure index"));
    ol.appendChild(scoreBox(v));
    add(ol, add(el("p", "rankline"), el("span", null, "Rank"), el("b", null, rankOf(code, "overall") + " / " + nJ)),
        add(el("p", "rankline"), el("span", null, "Average of " + words(nJ)), el("b", null, num(avgOf("overall")))),
        add(el("p", "rankline"), el("span", null, "Scores 1 · ½ · 0"), el("b", null, n.full + " · " + n.part + " · " + n.none)));
    var or = el("div");
    var level = CODES.filter(function (c) { return c !== code && val(c, "overall") === v; });
    or.appendChild(el("p", "small", cap(theName(code)) + " ranks " + ordinal(rankOf(code, "overall")) + " of " + nJ + " jurisdictions" +
      (level.length ? ", level with " + theNames(level) : "") + "."));
    or.appendChild(rankColumns(code, "overall"));
    add(og, ol, or);
    ov.appendChild(og);
    if (j.enforcementNote) {
      ov.appendChild(el("h4", null, "Enforcement and legal setting"));
      ov.appendChild(el("p", "small", j.enforcementNote));
    }
    var disc = (D.paper.discrepancies || []).filter(function (d) { return d.code === code; })[0];
    if (disc) {
      var cw = el("div", "callout warn");
      cw.appendChild(aiP("This jurisdiction differs from the published working paper (" + disc.detail.join("; ") + "). " + disc.why));
      ov.appendChild(cw);
    }
    main.appendChild(ov);

    /* dimensions with their categories */
    var dc = el("div", "card");
    dc.appendChild(el("h2", null, j.name + " by Dimension"));
    DIMS.forEach(function (d, i) {
      var b = el("div", "dimblock");
      targets[d] = b;
      var hd = el("div", "dimblock-head");
      add(hd, el("h3", null, "Dimension " + (i + 1) + " | " + dimById[d].name), link("#/scoring", "More info"));
      b.appendChild(hd);
      var q = (D.paper.dimensionQuestions || {})[d];
      if (q) b.appendChild(el("p", "small muted", q.question));
      var top = el("div", "dimblock-top"), lt = el("div");
      lt.appendChild(scoreBox(a.dims[d], "sm"));
      var mech = D.mechanisms.filter(function (m) { return m.dimension === d; });
      var full = mech.filter(function (m) { return cellOf(m.id, code).score === 1; }).length;
      var r3 = el("div", "ranks3");
      add(r3, el("span", null, "Rank"), el("b", null, rankOf(code, d) + " / " + nJ), el("span", null, "Average of " + words(nJ)),
          el("b", null, num(avgOf(d))), el("span", null, "Categories in full"), el("b", null, full + " of " + mech.length));
      add(top, lt, r3);
      b.appendChild(top);
      b.appendChild(strip(code, d));
      var cats = el("div", "cats");
      mech.forEach(function (m) {
        var c = cellOf(m.id, code), row = el("div", "cat-row");
        row.appendChild(el("span", "n", m.id + "."));
        row.appendChild(el("span", null, m.name));
        row.appendChild(paint(el("span", "pill", glyph(c.score)), c.score));
        var fc = el("span", "fchips"), informative = c.binding && c.binding.length < 3;
        [["E", "existence"], ["S", "scope"], ["Enf", "enforceability"]].forEach(function (f) {
          var chip = el("span", informative && c.binding.indexOf(f[1]) !== -1 ? "bind" : null, f[0] + " " + glyph(c[f[1]]));
          chip.title = pretty(f[1]) + " " + c[f[1]] + (chip.className ? " (binding)" : "");
          fc.appendChild(chip);
        });
        row.appendChild(fc);
        var bs = el("span", "basis", c.instrument_basis || "—");
        bs.title = c.instrument_basis || "";
        row.appendChild(bs);
        var btn = el("button", null, "Details");
        btn.type = "button";
        btn.addEventListener("click", function () { matrixOrder = CODES; openCell(m.id, code); });
        row.appendChild(btn);
        cats.appendChild(row);
      });
      b.appendChild(cats);
      dc.appendChild(b);
    });
    dc.appendChild(scoreKey(false));
    main.appendChild(dc);

    /* law and market */
    var lm = el("div", "card");
    targets.lawmarket = lm;
    lm.appendChild(el("h2", null, "Law and Market"));
    if (code === "EU") {
      lm.appendChild(aiP("For the three gatekeeper–market pairs, the De Jure score is measured again at market level, for the obligations " +
        "that bind that market, and the De Facto score records what was observed. Hollow marks are " + DF_BASE + "; filled marks are the latest observation."));
      UNITS.forEach(function (u) {
        lm.appendChild(el("h4", null, unitById[u].name + " · " + unitById[u].gatekeeper + " · " + unitById[u].market));
        lm.appendChild(lawMarketRows([u], KEYS));
      });
    } else if (code === "DE") {
      lm.appendChild(aiP(["Germany is covered by the EU's De Facto observations, which are made for three gatekeeper–market pairs across the European Union: see the ",
        link("#/jurisdiction/EU", "European Union profile"), "."]));
    } else {
      lm.appendChild(aiP("De Facto contestability has not been measured for " + theName(code) + ". The De Facto layer covers three gatekeeper–market pairs in the European Union, so this profile shows the law only."));
    }
    main.appendChild(lm);

    /* legal sources */
    var lc = el("div", "card");
    targets.legal = lc;
    lc.appendChild(el("h2", null, "Legal Sources"));
    var inst = D.instruments[code] || [];
    if (inst.length) {
      var ul = el("ul", "link-list");
      inst.forEach(function (i) {
        var li = el("li");
        add(li, el("strong", null, i.name), i.citation ? el("span", "muted small", " · " + i.citation) : null,
            i.pipeline ? el("span", "badge warn", "Not in force") : null, " ", i.url ? extLink(i.url, i.sourceLabel || domain(i.url)) : null);
        if (i.status) li.appendChild(el("div", "small muted", i.status));
        ul.appendChild(li);
      });
      lc.appendChild(ul);
    }
    var docs = D.documents.filter(function (d) { return d.jurisdiction === code; });
    var ex = Object.keys(D.cells).filter(function (k) { return k.split("|")[1] === code; })
      .reduce(function (s, k) { return s + ((D.cells[k].extracts || []).length); }, 0);
    lc.appendChild(add(el("p", "small"), docs.length + " full texts and " + ex + " verbatim provisions on file. ",
                       link("#/legal/" + code, "Open them on the Legal Documents page →")));
    main.appendChild(lc);

    add(grid, side, main);
    app.appendChild(grid);
  }

  /* ========================================================== CASE STUDIES */
  function pageCases(app) {
    document.title = "Case studies · The Contestability Index";
    var s = section(), w = el("div", "wrap");
    head(w, "Case studies", "Three cases",
      aiP("These cases are drafts that show how the data can tell a specific story. Which cases the site should carry, and who writes them, is still open.", "sec-intro"));
    s.appendChild(w);
    app.appendChild(s);

    /* case 1: the pair whose De Facto score rose most */
    var ups = UNITS.map(function (u) { return { u: u, a: mVal("de_facto", u, "baseline", "overall"), b: mVal("de_facto", u, "current", "overall") }; })
      .filter(function (x) { return x.a !== null && x.b !== null; }).sort(function (x, y) { return (y.b - y.a) - (x.b - x.a); });
    var c1 = ups[0], u1 = unitById[c1.u], post = mIdx("de_facto", c1.u, "current");
    var items = D.deFacto.items.filter(function (it) { return it.unit === c1.u; });
    var changed = items.filter(function (it) { return it.status === "scored" && it.delta > 0; }).sort(function (a, b) { return b.delta - a.delta || a.mechanism - b.mechanism; });
    var missing = items.filter(function (it) { return it.status === "missing"; }).length;
    var dimUp = DIMS.filter(function (d) { return mVal("de_facto", c1.u, "current", d) > mVal("de_facto", c1.u, "baseline", d); });
    var cs1 = caseCard(app, "Case 1", u1.name + ", " + DF_BASE + " to " + DF_NOW,
      [[num(c1.a) + " → " + num(c1.b), "De Facto index"], ["+" + num(c1.b - c1.a), "change"], [post.nScored + " of " + post.nApplicable, "applicable indicators scored"]]);
    cs1.text.appendChild(aiP("The Digital Markets Act designation of " + u1.gatekeeper + " for " + u1.service.replace(/ \(.*\)$/, "") + " dates from " +
      day(u1.designationDate) + ". In " + DF_BASE + ", before the Act's obligations applied, the pair scored " + num(c1.a) + " on the De Facto index; in " + DF_NOW +
      " it scored " + num(c1.b) + ", the largest increase of the " + words(nU) + " pairs on this site."));
    if (changed.length) {
      var big = changed[0], bm = mechById[big.mechanism];
      cs1.text.appendChild(aiP((dimUp.length === nD ? "The increase is spread across all " + words(nD) + " dimensions. " :
        "The increase comes from " + listText(dimUp) + ". ") + "The largest change at indicator level is " + bm.code + " " + bm.indicator.toLowerCase() +
        ", from " + num(big.pre) + " to " + num(big.post) + "; " + words(changed.length) + " indicators rose in all."));
    }
    cs1.text.appendChild(aiP("What the case does not show: the comparison is before and after, so it does not separate the Act from other changes in the market. " +
      cap(words(missing)) + " of the " + words(post.nApplicable) + " applicable indicators had too little evidence to score and are left out of the index."));
    cs1.viz.appendChild(lawMarketRows([c1.u], KEYS));
    var tl = el("div");
    tl.appendChild(el("h4", null, "Indicators that changed, with the coded evidence"));
    changed.forEach(function (it) {
      var m = mechById[it.mechanism], d = el("details", "fold"), sm = el("summary");
      add(sm, m.code + " " + m.indicator, el("span", "meta", num(it.pre) + " → " + num(it.post) + (it.confidence ? " · confidence " + it.confidence.toLowerCase() : "")));
      d.appendChild(sm);
      var body = el("div", "body");
      body.appendChild(el("p", null, it.evidence || "—"));
      if (it.sources.length) {
        var ul = el("ul", "link-list");
        it.sources.forEach(function (l) { ul.appendChild(add(el("li"), l.url ? extLink(l.url, l.title) : l.title)); });
        body.appendChild(ul);
      }
      d.appendChild(body);
      tl.appendChild(d);
    });
    cs1.wide.appendChild(tl);

    /* case 2: one law, three markets */
    var djs = UNITS.map(function (u) { return mVal("de_jure", u, "current", "overall"); });
    var dfs = UNITS.map(function (u) { return mVal("de_facto", u, "current", "overall"); });
    var cs2 = caseCard(app, "Case 2", "One law, three markets",
      UNITS.map(function (u, i) { return [num(dfs[i]), "De Facto, " + unitById[u].name]; }));
    var same = djs.every(function (x) { return x === djs[0]; });
    var leaders = DIMS.map(function (d) {
      var best = UNITS.slice().sort(function (a, b) { return mVal("de_facto", b, "current", d) - mVal("de_facto", a, "current", d); });
      var top = mVal("de_facto", best[0], "current", d);
      return { d: d, who: best.filter(function (u) { return mVal("de_facto", u, "current", d) === top; }), v: top };
    });
    cs2.text.appendChild(aiP((same ? "In " + DJ_DATE + " the same EU obligations apply to all " + words(nU) + " pairs: each has a market-level De Jure score of " + num(djs[0]) + ". " : "") +
      "Their De Facto scores in " + DF_NOW + " are " + listText(UNITS.map(function (u, i) { return num(dfs[i]) + " for " + unitById[u].name; })) +
      ". The dimensions differ more than the totals: " + leaders.map(function (l) {
        return l.d + " is highest for " + listText(l.who.map(function (u) { return unitById[u].name; })) + " (" + num(l.v) + ")";
      }).join("; ") + "."));
    cs2.text.appendChild(aiP("Google Play is scored on the app-distribution record of the market-level De Jure layer, because the same obligations bind both app stores; " +
      "it has no " + DF_BASE + " De Jure record."));
    cs2.viz.appendChild(seriesKey(UNITS.map(function (u) { return { label: unitById[u].name, color: UNIT_COLOR[u], shape: "sq" }; })));
    cs2.viz.appendChild(pairDims());

    /* case 3: Japan */
    if (jurByCode.JP) {
      var jn = counts("JP"), jv = val("JP", "overall");
      var fullJP = D.mechanisms.filter(function (m) { return cellOf(m.id, "JP").score === 1; });
      var msca = fullJP.filter(function (m) { return /MSCA/.test(cellOf(m.id, "JP").instrument_basis || ""); });
      var zeros = D.mechanisms.filter(function (m) { return cellOf(m.id, "JP").score === 0; });
      var cs3 = caseCard(app, "Case 3", "Japan: a law written for smartphones",
        [[num(jv), "De Jure index"], [ordinal(rankOf("JP", "overall")) + " of " + nJ, "rank"], [jn.full + " · " + jn.part + " · " + jn.none, "categories at 1 · ½ · 0"]]);
      cs3.text.appendChild(aiP("Japan scores " + num(jv) + ", the highest outside the European Union and Germany. " +
        (msca.length === fullJP.length ? "All " + words(fullJP.length) : cap(words(msca.length)) + " of the " + words(fullJP.length)) +
        " categories it requires in full rest on the Mobile Software Competition Act (Act 58/2024), which the coding records as in full force since 18 December 2025."));
      cs3.text.appendChild(aiP("Japan scores 0.5 in " + words(jn.part) + " categories and 0 in " + words(jn.none) + (zeros.length ? ": " + listText(zeros.map(function (m) { return m.name.toLowerCase(); })) : "") +
        ". The table shows which factor holds each partial score down."));
      var t = el("table", "plain"), hr = el("tr");
      ["Category", "Score", "Existence", "Scope", "Enforceability", "Basis"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
      t.appendChild(hr);
      D.mechanisms.filter(function (m) { return cellOf(m.id, "JP").score < 1; }).forEach(function (m) {
        var c = cellOf(m.id, "JP"), tr = el("tr");
        tr.appendChild(el("td", null, m.id + ". " + m.name));
        [c.score, c.existence, c.scope, c.enforceability].forEach(function (x) { tr.appendChild(paint(el("td", "sc", glyph(x)), x)); });
        tr.appendChild(el("td", "small", c.instrument_basis || "—"));
        t.appendChild(tr);
      });
      cs3.wide.appendChild(add(el("div", "table-scroll"), t));
      cs3.viz.appendChild(hbars(KEYS.map(function (k) {
        return { label: keyShort(k), value: val("JP", k), tip: function () { return ["Japan · " + keyName(k) + ": " + num(val("JP", k))]; } };
      }), { labelW: 170, label: "Japan by dimension" }));
      cs3.wide.appendChild(add(el("p", "small"), link("#/jurisdiction/JP", "Open the Japan profile →")));
    }
  }
  function caseCard(app, kicker, title, big) {
    var s = section("alt"), w = el("div", "wrap"), c = el("div", "kp case"), t = el("div"), v = el("div", "viz"), wide = el("div");
    t.appendChild(el("p", "qn", kicker));
    t.appendChild(el("h3", null, title));
    if (big) {
      var b = el("div", "big");
      big.forEach(function (x) { b.appendChild(add(el("div"), el("b", null, x[0]), el("span", null, x[1]))); });
      t.appendChild(b);
    }
    add(c, t, v);
    add(w, c, wide);
    wide.style.marginTop = "14px";
    s.appendChild(w);
    app.appendChild(s);
    return { text: t, viz: v, wide: wide };
  }
  // De Facto by dimension for the three pairs, latest observation, with the market-level De Jure as a reference.
  function pairDims() {
    var w = 560, lw = 180, bh = 12, gap = 2, gpad = 16, top = 22, gh = nU * (bh + gap) - gap, h = top + DIMS.length * (gh + gpad) + 4;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img", "aria-label": "De Facto by dimension for the three pairs" });
    function X(v) { return lw + v * (w - lw - 44); }
    xGrid(s, X, top - 4, h - 4, true);
    DIMS.forEach(function (d, gi) {
      var y0 = top + gi * (gh + gpad) + gpad / 2;
      s.appendChild(stext({ x: lw - 10, y: y0 + gh / 2 + 4, "text-anchor": "end", class: "lab" }, d + " " + DIM_SHORT[d]));
      UNITS.forEach(function (u, i) {
        var v = mVal("de_facto", u, "current", d), y = y0 + i * (bh + gap);
        if (v === null) return;
        var b = barPath(X(0), y, X(v) - X(0), bh);
        if (b) { b.setAttribute("fill", UNIT_COLOR[u]); s.appendChild(b); }
        s.appendChild(stext({ x: X(v) + 5, y: y + bh - 2, class: "val" }, num(v)));
        tipRect(s, X(0), y, w - X(0), bh, function () { return [unitById[u].name, d + " De Facto, " + DF_NOW + ": " + num(v), "De Jure, market level: " + num(mVal("de_jure", u, "current", d))]; });
      });
    });
    return s;
  }

  /* ========================================================== SCORING RULES */
  function pageScoring(app) {
    document.title = "Scoring rules · The Contestability Index";
    var s = section(), w = el("div", "wrap");
    head(w, "Scoring rules", "How a score is built",
      aiP(["Every score on this site is built the same way, from one assessment per obligation category upward. This page summarises the rules; the ",
           extLink(APPENDIX, "online appendix"), " gives them in full."], "sec-intro"));
    var flow = el("div", "flow");
    [["Legal text", "Statutes, regulations, orders and court remedies in force in " + DJ_DATE + "."],
     ["Three factors", "Existence, Scope and Enforceability, each scored 0, ½ or 1."],
     ["Category score", "The lowest of the three factors."],
     ["Dimension score", "The mean of the category scores in the dimension."],
     ["Index", "The mean of the " + words(nD) + " dimension scores."]].forEach(function (x) {
      flow.appendChild(add(el("div", "st"), el("b", null, x[0]), x[1]));
    });
    w.appendChild(flow);

    // A worked example from the data: the first Japanese category whose factors differ, then Japan's dimension and index.
    var exCode = "JP", exM = D.mechanisms.filter(function (m) { var c = cellOf(m.id, exCode); return c.binding && c.binding.length < 3; })[0];
    if (exM) {
      var c = cellOf(exM.id, exCode), dm = D.mechanisms.filter(function (m) { return m.dimension === exM.dimension; });
      var ex = el("div", "example");
      ex.appendChild(el("p", null, "Worked example, read from the database: " + jurName[exCode] + ", category " + exM.id + " (" + exM.name + ")."));
      var ol = el("ol");
      ol.appendChild(el("li", null, "Existence " + c.existence + ", Scope " + c.scope + ", Enforceability " + c.enforceability +
        " → category score min(" + c.existence + ", " + c.scope + ", " + c.enforceability + ") = " + c.score + ". The binding factor is " + c.binding.join(" and ") + "."));
      ol.appendChild(el("li", null, exM.dimension + " for " + jurName[exCode] + " = mean(" + dm.map(function (m) { return cellOf(m.id, exCode).score; }).join(", ") +
        ") = " + num(val(exCode, exM.dimension)) + "."));
      ol.appendChild(el("li", null, "Index for " + jurName[exCode] + " = mean(" + DIMS.map(function (d) { return num(val(exCode, d)); }).join(", ") + ") = " + num(val(exCode, "overall")) + "."));
      ex.appendChild(ol);
      w.appendChild(ex);
    }
    w.appendChild(aiP("The lowest factor sets the score because the three factors complement each other: a rule that reaches every firm but cannot be enforced " +
      "protects little, and strong enforcement cannot make up for a rule that does not exist.", "prose"));
    s.appendChild(w);
    app.appendChild(s);

    var s2 = section("alt"), w2 = el("div", "wrap");
    head(w2, null, "Four dimensions, " + words(nM) + " categories");
    var t = el("table", "plain"), hr = el("tr");
    ["Dimension", "Question it answers", "De Jure obligation category", "De Facto indicator"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    D.dimensions.forEach(function (d) {
      var ms = D.mechanisms.filter(function (m) { return m.dimension === d.id; });
      ms.forEach(function (m, i) {
        var tr = el("tr");
        if (!i) {
          var td = el("td", null, d.id + " " + d.name), tq = el("td", "small", ((D.paper.dimensionQuestions || {})[d.id] || {}).question || "");
          td.rowSpan = tq.rowSpan = ms.length;
          add(tr, td, tq);
        }
        var tc = el("td");
        add(tc, el("strong", null, m.id + ". " + m.name), m.description ? el("div", "small muted", m.description) : null);
        add(tr, tc, el("td", "small", m.code + " " + m.indicator));
        t.appendChild(tr);
      });
    });
    w2.appendChild(add(el("div", "table-scroll"), t));
    w2.appendChild(el("p", "small muted", "Questions are quoted from the working paper; category names, descriptions and indicators from the project database."));
    s2.appendChild(w2);
    app.appendChild(s2);

    var s3 = section(), w3 = el("div", "wrap");
    head(w3, null, "The De Facto layer");
    w3.appendChild(aiP("A De Facto indicator is either scored 0, ½ or 1, or left out of the denominator. Not Applicable means the mechanism does not operate in the market; " +
      "Missing means the evidence was too thin to score. A dimension is the mean of the indicators that could be scored, so an evidence gap does not count as a zero.", "prose"));
    var cs = el("table", "plain");
    Object.keys(D.paper.codingStates || {}).forEach(function (k) { cs.appendChild(add(el("tr"), el("th", null, k), el("td", null, D.paper.codingStates[k]))); });
    w3.appendChild(cs);
    w3.appendChild(el("h3", "pane-title", "Confidence"));
    var cf = el("table", "plain");
    ["High", "Moderate", "Low"].forEach(function (k) { if (D.paper.confidenceLevels[k]) cf.appendChild(add(el("tr"), el("th", null, k), el("td", null, D.paper.confidenceLevels[k]))); });
    w3.appendChild(cf);
    if (D.paper.confidenceLevels.note) w3.appendChild(el("p", "small muted", D.paper.confidenceLevels.note + " (working paper)"));
    w3.appendChild(el("h3", "pane-title", "Effective Contestability"));
    var et = el("table", "plain");
    et.appendChild(add(el("tr"), el("th", null, "Specification"), el("th", null, "Formula"), el("th", null, "Use")));
    (D.paper.effectiveSpecs || []).forEach(function (x) { et.appendChild(add(el("tr"), el("td", null, pretty(x.id) + " " + x.eq), el("td", "mono", x.formula), el("td", "small", x.use))); });
    w3.appendChild(et);
    var rr = D.paper.reportingRequirements || {};
    if (rr.effectiveTogether) w3.appendChild(el("p", "small muted", "“" + rr.effectiveTogether + "” (" + rr.source + ")"));
    s3.appendChild(w3);
    app.appendChild(s3);

    var s4 = section("alt"), w4 = el("div", "wrap");
    head(w4, null, "Legal forms");
    w4.appendChild(aiP("Each De Jure score also records the form of the instrument it rests on. The form is a benchmark for coding; the legal text decides the score.", "prose"));
    var lf = el("table", "plain");
    lf.appendChild(add(el("tr"), el("th", null, "Form"), el("th", null, "Definition"), el("th", null, "Typical factor treatment")));
    D.legalForms.forEach(function (f) {
      lf.appendChild(add(el("tr"), el("td", "mono", f.code), add(el("td", "small"), el("strong", null, f.name), el("div", null, f.definition)), el("td", "small muted", f.signature)));
    });
    w4.appendChild(add(el("div", "table-scroll"), lf));
    w4.appendChild(add(el("p"), extLink(APPENDIX, "Read the complete rules in the online appendix")));
    s4.appendChild(w4);
    app.appendChild(s4);
  }

  /* ========================================================== DATA */
  var DATA_TAB = "jur";
  function pageData(app) {
    document.title = "Data · The Contestability Index";
    var s = section(), w = el("div", "wrap");
    head(w, "Data", "Every score as a table",
      aiP(["Each table is read from the project database when the page opens. Click a column heading to sort, and download any table as CSV. The whole database is one ",
           link(D.meta.dbUrl, "SQLite file"), "; the ", extLink(APPENDIX + "database.html", "online appendix"), " lets you browse every table in it."], "sec-intro"));
    var tabs = el("div", "tabs-row"), body = el("div");
    var TABS = [["jur", "De Jure: jurisdictions"], ["cat", "De Jure: categories"], ["mkt", "Markets"], ["eff", "Effective Contestability"], ["paper", "Differences from the paper"]];
    var tb = {};
    TABS.forEach(function (t) {
      var b = el("button", null, t[1]);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.addEventListener("click", function () { DATA_TAB = t[0]; draw(); });
      tb[t[0]] = b;
      tabs.appendChild(b);
    });
    add(w, tabs, body);
    s.appendChild(w);
    app.appendChild(s);
    function draw() {
      Object.keys(tb).forEach(function (k) { tb[k].setAttribute("aria-selected", k === DATA_TAB ? "true" : "false"); });
      body.textContent = "";
      ({ jur: dataJur, cat: dataCat, mkt: dataMkt, eff: dataEff, paper: dataPaper })[DATA_TAB](body);
    }
    draw();
  }
  function dataJur(host) {
    var rows = CODES.map(function (c) { var n = counts(c); return { c: c, n: n }; });
    var cols = [{ label: "Jurisdiction", get: function (r) { return jurName[r.c]; }, fmt: function (v, r) { return link("#/jurisdiction/" + r.c, v); } },
                { label: "Rank", num: true, get: function (r) { return rankOf(r.c, "overall"); } },
                { label: "Index", score: true, get: function (r) { return val(r.c, "overall"); } }]
      .concat(DIMS.map(function (d) { return { label: d, score: true, get: function (r) { return val(r.c, d); } }; }))
      .concat([{ label: "Scored 1", num: true, get: function (r) { return r.n.full; } }, { label: "Scored ½", num: true, get: function (r) { return r.n.part; } },
               { label: "Scored 0", num: true, get: function (r) { return r.n.none; } }]);
    host.appendChild(add(el("div", "toolbar"), el("p", "small muted", "De Jure, " + DJ_DATE + ". " + nJ + " jurisdictions."),
      csvButton("Download CSV", function () {
        csvDownload("contestability_dejure_jurisdictions.csv", ["code", "jurisdiction", "rank", "index"].concat(DIMS, ["n_full", "n_partial", "n_zero"]),
          rows.map(function (r) { return [r.c, jurName[r.c], rankOf(r.c, "overall"), val(r.c, "overall")].concat(DIMS.map(function (d) { return val(r.c, d); }), [r.n.full, r.n.part, r.n.none]); }));
      })));
    host.appendChild(dataTable(cols, rows));
  }
  function dataCat(host) {
    var all = [];
    CODES.forEach(function (c) { D.mechanisms.forEach(function (m) { all.push({ c: c, m: m, x: cellOf(m.id, c) }); }); });
    var fj = "", fd = "";
    var bar = el("div", "toolbar"), l = el("div", "ctrl-left"), out = el("div");
    var sj = el("select", "pselect");
    sj.appendChild(new Option("All jurisdictions", ""));
    CODES.forEach(function (c) { sj.appendChild(new Option(jurName[c], c)); });
    var sd = el("select", "pselect");
    sd.appendChild(new Option("All dimensions", ""));
    DIMS.forEach(function (d) { sd.appendChild(new Option(d + " " + DIM_SHORT[d], d)); });
    sj.addEventListener("change", function () { fj = sj.value; draw(); });
    sd.addEventListener("change", function () { fd = sd.value; draw(); });
    add(l, sj, sd);
    function rows() { return all.filter(function (r) { return (!fj || r.c === fj) && (!fd || r.m.dimension === fd); }); }
    add(bar, l, csvButton("Download CSV (filtered)", function () {
      csvDownload("contestability_dejure_categories.csv",
        ["jurisdiction", "category_id", "category", "dimension", "score", "existence", "scope", "enforceability", "legal_form", "instrument_basis", "evidence_date"],
        rows().map(function (r) { return [r.c, r.m.id, r.m.name, r.m.dimension, r.x.score, r.x.existence, r.x.scope, r.x.enforceability, r.x.legal_form, r.x.instrument_basis, r.x.evidence_date]; }));
    }));
    add(host, bar, out);
    var cols = [{ label: "Jurisdiction", get: function (r) { return r.c; } },
                { label: "#", num: true, get: function (r) { return r.m.id; } },
                { label: "Category", get: function (r) { return r.m.name; }, fmt: function (v, r) {
                  var b = el("button", "linkish", v);
                  b.type = "button";
                  b.style.cssText = "background:none;border:0;padding:0;color:var(--purple-deep);cursor:pointer;text-align:left;font:inherit";
                  b.className = "open-doc";
                  b.addEventListener("click", function () { matrixOrder = CODES; openCell(r.m.id, r.c); });
                  return b;
                } },
                { label: "Dim.", get: function (r) { return r.m.dimension; } },
                { label: "Score", score: true, get: function (r) { return r.x.score; }, fmt: function (v) { return glyph(v); } },
                { label: "E", score: true, get: function (r) { return r.x.existence; }, fmt: function (v) { return glyph(v); } },
                { label: "S", score: true, get: function (r) { return r.x.scope; }, fmt: function (v) { return glyph(v); } },
                { label: "Enf", score: true, get: function (r) { return r.x.enforceability; }, fmt: function (v) { return glyph(v); } },
                { label: "Legal form", get: function (r) { return pretty(r.x.legal_form); } },
                { label: "Instrument", get: function (r) { return r.x.instrument_basis; } }];
    function draw() { out.textContent = ""; out.appendChild(dataTable(cols, rows())); }
    draw();
  }
  function dataMkt(host) {
    var rows = [];
    ["de_jure", "de_facto"].forEach(function (layer) {
      UNITS.forEach(function (u) {
        ["baseline", "current"].forEach(function (p) {
          var x = mIdx(layer, u, p);
          if (x) rows.push({ layer: layer, u: u, p: p, x: x });
        });
      });
    });
    var cols = [{ label: "Pair", get: function (r) { return unitById[r.u].name; } },
                { label: "Layer", get: function (r) { return r.layer === "de_jure" ? "De Jure (market)" : "De Facto"; } },
                { label: "Observed", get: function (r) { return r.x.observed || ""; }, fmt: function (v) { return month(v); } },
                { label: "Index", score: true, get: function (r) { return r.x.index; } }]
      .concat(DIMS.map(function (d) { return { label: d, score: true, get: function (r) { return r.x.dims[d] ? r.x.dims[d].score : null; } }; }))
      .concat([{ label: "Scored / applicable", get: function (r) { return r.x.nScored + " / " + r.x.nApplicable; } }]);
    host.appendChild(add(el("div", "toolbar"), el("p", "small muted", "Three EU gatekeeper–market pairs. Google Play has no " + DF_BASE + " De Jure record."),
      csvButton("Download CSV", function () {
        csvDownload("contestability_markets.csv", ["unit", "layer", "period", "observed", "index"].concat(DIMS, ["n_scored", "n_applicable"]),
          rows.map(function (r) { return [r.u, r.layer, r.p, r.x.observed, r.x.index].concat(DIMS.map(function (d) { return r.x.dims[d] ? r.x.dims[d].score : ""; }), [r.x.nScored, r.x.nApplicable]); }));
      })));
    host.appendChild(dataTable(cols, rows));
  }
  function dataEff(host) {
    var rows = D.effective.slice();
    var cols = [{ label: "Pair", get: function (r) { return unitById[r.unit].name; } },
                { label: "Observation", get: function (r) { return r.period; }, fmt: function (v) { return v === "baseline" ? DF_BASE : "Latest"; } },
                { label: "De Jure", score: true, get: function (r) { return r.deJure; } }, { label: "De Facto", score: true, get: function (r) { return r.deFacto; } },
                { label: "Multiplicative (5)", score: true, get: function (r) { return r.multiplicative; } }, { label: "Additive (6)", score: true, get: function (r) { return r.arithmetic; } },
                { label: "Bottleneck (7)", score: true, get: function (r) { return r.bottleneck; } }, { label: "Gap (8)", num: true, get: function (r) { return r.gap; }, fmt: function (v) { return num(v); } }];
    host.appendChild(add(el("div", "toolbar"), el("p", "small muted", "λ = " + D.meta.lambda + " in the additive specification. Equation numbers are the paper's."),
      csvButton("Download CSV", function () {
        csvDownload("contestability_effective.csv", ["unit", "period", "de_jure", "de_facto", "ec_multiplicative", "ec_arithmetic", "ec_bottleneck", "implementation_gap"],
          rows.map(function (r) { return [r.unit, r.period, r.deJure, r.deFacto, r.multiplicative, r.arithmetic, r.bottleneck, r.gap]; }));
      })));
    host.appendChild(dataTable(cols, rows));
  }
  function dataPaper(host) {
    host.appendChild(aiP("The working paper (July 2026) was compiled from an earlier state of the database. The paper's Table 3 covers fifteen obligation categories; " +
      "the database covers " + words(nM) + " and includes corrections made afterwards. The lists below are computed by comparing the two when the page opens.", "prose"));
    var disc = D.paper.discrepancies || [];
    var t = el("table", "plain");
    t.appendChild(add(el("tr"), el("th", null, "Jurisdiction"), el("th", null, "Site against paper"), el("th", null, "Why")));
    disc.forEach(function (d) { t.appendChild(add(el("tr"), el("td", null, d.name), el("td", "small", d.detail.join("; ")), el("td", "small", d.whyShort || d.why))); });
    host.appendChild(el("h3", "pane-title", "De Jure: " + disc.length + " of " + nJ + " jurisdictions differ"));
    host.appendChild(add(el("div", "table-scroll"), t));
    var cmp = D.paper.deFactoCompare || [];
    host.appendChild(el("h3", "pane-title", "De Facto: " + cmp.filter(function (c) { return !c.same; }).length + " of " + cmp.length + " pairs differ"));
    var t2 = el("table", "plain");
    t2.appendChild(add(el("tr"), el("th", null, "Pair"), el("th", null, "Paper"), el("th", null, "Database"), el("th", null, "")));
    cmp.forEach(function (c) {
      t2.appendChild(add(el("tr"), el("td", null, c.name),
        el("td", "small", num(c.paper.baseline) + " → " + num(c.paper.later) + " (" + c.paper.scored + " of " + c.paper.applicable + " scored)"),
        el("td", "small", num(c.ours.pre) + " → " + num(c.ours.post) + " (" + c.ours.scored + " of " + c.ours.applicable + " scored)"),
        el("td", "small", c.same ? "identical" : "differs")));
    });
    host.appendChild(add(el("div", "table-scroll"), t2));
  }

  /* ========================================================== LEGAL DOCUMENTS */
  function pageLegal(app, code) {
    document.title = "Legal documents · The Contestability Index";
    code = jurByCode[code] ? code : "EU";
    var s = section(), w = el("div", "wrap");
    var nExtracts = Object.keys(D.cells).reduce(function (n, k) { return n + (D.cells[k].extracts || []).length; }, 0);
    var nInst = Object.keys(D.instruments).reduce(function (n, k) { return n + D.instruments[k].length; }, 0);
    head(w, "Legal documents", "The law behind every score",
      aiP("The instruments behind each De Jure score, with links to the official text. The database holds " + nInst + " instruments, the full text of " +
          D.documents.length + " documents and " + nExtracts + " verbatim provisions, each attached to the category and jurisdiction it supports.", "sec-intro"));
    var chips = el("div", "chips");
    CODES.forEach(function (c) {
      var b = el("button", "chip", jurName[c]);
      b.type = "button";
      b.setAttribute("aria-pressed", c === code ? "true" : "false");
      b.addEventListener("click", function () { go("#/legal/" + c); });
      chips.appendChild(b);
    });
    w.appendChild(chips);
    var j = jurByCode[code];
    w.appendChild(el("h3", "sec-head", j.name));
    if (j.enforcementNote) w.appendChild(el("p", "sec-intro", j.enforcementNote));

    var inst = D.instruments[code] || [];
    w.appendChild(el("h3", "pane-title", "Instruments on record (" + inst.length + ")"));
    var t = el("table", "plain");
    t.appendChild(add(el("tr"), el("th", null, "Instrument"), el("th", null, "Citation"), el("th", null, "Status"), el("th", null, "Official source")));
    inst.forEach(function (i) {
      t.appendChild(add(el("tr"), add(el("td"), el("strong", null, i.name), i.pipeline ? el("span", "badge warn", "Not in force") : null),
        el("td", "small", i.citation || "—"), el("td", "small", i.status || "—"),
        add(el("td", "small"), i.url ? extLink(i.url, i.sourceLabel || domain(i.url)) : "—")));
    });
    w.appendChild(add(el("div", "table-scroll"), t));

    w.appendChild(el("h3", "pane-title", "Legal basis by obligation category"));
    var basis = {};
    (D.legalBasis[code] || []).forEach(function (b) { (basis[b.mechanism] = basis[b.mechanism] || []).push(b.basis); });
    var t2 = el("table", "plain");
    t2.appendChild(add(el("tr"), el("th", null, "Category"), el("th", null, "Score"), el("th", null, "Article relied on"), el("th", null, "")));
    D.mechanisms.forEach(function (m) {
      var c = cellOf(m.id, code), b = el("button", "open-doc", "Details");
      b.type = "button";
      b.style.cssText = "background:none;border:1px solid var(--purple);color:var(--purple);border-radius:3px;padding:1px 8px;font-size:.76rem;font-weight:700;cursor:pointer";
      b.addEventListener("click", function () { matrixOrder = CODES; openCell(m.id, code); });
      t2.appendChild(add(el("tr"), el("td", null, m.id + ". " + m.name), paint(el("td", "sc", glyph(c.score)), c.score),
        el("td", "small", (basis[m.id] || []).join("; ") || c.instrument_basis || "—"), add(el("td"), b)));
    });
    w.appendChild(add(el("div", "table-scroll"), t2));

    var docs = D.documents.filter(function (d) { return d.jurisdiction === code; });
    w.appendChild(el("h3", "pane-title", "Full texts in the database (" + docs.length + ")"));
    if (docs.length) {
      var ul = el("ul", "link-list");
      docs.forEach(function (d) {
        var b = el("button", "open-doc", d.name || d.stem);
        b.type = "button";
        b.style.cssText = "background:none;border:0;padding:0;color:var(--purple-deep);text-decoration:underline;cursor:pointer;font:inherit;text-align:left";
        b.addEventListener("click", function () { openDoc(d); });
        ul.appendChild(add(el("li"), b, el("span", "muted small", " · " + [d.language, Math.round(d.chars / 1000) + "k characters"].filter(Boolean).join(" · "))));
      });
      w.appendChild(ul);
    } else w.appendChild(el("p", "muted", "None on file."));

    var ex = [];
    D.mechanisms.forEach(function (m) { (cellOf(m.id, code).extracts || []).forEach(function (x) { ex.push({ m: m, x: x }); }); });
    w.appendChild(el("h3", "pane-title", "Verbatim provisions (" + ex.length + ")"));
    ex.forEach(function (e) {
      var d = el("details", "fold"), sm = el("summary");
      add(sm, e.m.id + ". " + e.m.name, el("span", "meta", e.x.instrument));
      d.appendChild(sm);
      var body = el("div", "body");
      if (e.x.summary) body.appendChild(el("p", "small", e.x.summary));
      if (e.x.text) body.appendChild(el("blockquote", null, e.x.text));
      if (e.x.translation) { body.appendChild(el("p", "small muted", "English translation")); body.appendChild(el("blockquote", "translation", e.x.translation)); }
      d.appendChild(body);
      w.appendChild(d);
    });
    if (!ex.length) w.appendChild(el("p", "muted", "None on file."));
    s.appendChild(w);
    app.appendChild(s);
  }

  /* ========================================================== ABOUT */
  function pageAbout(app) {
    document.title = "About · The Contestability Index";
    var s = section(), w = el("div", "wrap prose");
    head(w, "About", "About the index");
    w.appendChild(aiP("The Contestability Index measures the opportunity for incumbent positions in digital markets to be challenged, rather than market structure " +
      "or outcomes. It is developed in the working paper Beyond Market Concentration: Measuring Contestability in Digital Markets by Zhiyang Cheng, Tracy Xu " +
      "and Amr Yakout (July 2026)."));
    w.appendChild(aiP("The project is affiliated with the Knight-Georgetown Institute (KGI) at Georgetown University."));
    w.appendChild(aiP("The De Jure layer covers " + words(nJ) + " jurisdictions: " + theNames(CODES) +
      ". The De Facto layer covers " + words(nU) + " gatekeeper–market pairs in the European Union. Both use the same " + words(nM) + " mechanisms in " + words(nD) + " dimensions."));
    w.appendChild(el("h3", null, "How to cite"));
    w.appendChild(aiP("Cheng, Zhiyang, Tracy Xu and Amr Yakout. 2026. “Beyond Market Concentration: Measuring Contestability in Digital Markets.” Working paper, July 2026."));
    w.appendChild(el("h3", null, "Status of these figures"));
    w.appendChild(aiP(["The site is a preliminary preview. Its figures come from the project database built " + D.meta.built + " and may change. Where they differ from the working paper, ",
      link("#/data", "the Data page"), " lists each difference and its reason."]));
    w.appendChild(el("h3", null, "How the site works"));
    w.appendChild(aiP("The site is a set of static files. When a page opens, your browser downloads the project database (SQLite, " +
      (D.meta.dbBytes / 1e6).toFixed(1) + " MB) and computes every figure from it with sql.js, so the numbers on the page and the downloadable file are the same."));
    w.appendChild(add(el("p"), extLink(APPENDIX, "Online appendix"), " · ", link(D.meta.dbUrl, "Download the database")));
    s.appendChild(w);
    app.appendChild(s);
  }

  /* ------------------------------------------------------------ router */
  var LEGACY = { overview: "#/", dejure: "#/data", defacto: "#/jurisdiction/EU", markets: "#/jurisdiction/EU", methodology: "#/scoring" };
  function render() {
    var h = location.hash.replace(/^#/, "");
    if (LEGACY[h]) { location.replace(LEGACY[h]); return; }
    var parts = h.replace(/^\//, "").split("/"), page = parts[0] || "explore", arg = (parts[1] || "").toUpperCase();
    closePanel(true);
    ttHide();
    var app = $("#app");
    app.textContent = "";
    document.title = "The Contestability Index";
    var navKey = page === "jurisdiction" ? "jurisdictions" : page;
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      if (a.dataset.nav === navKey || (navKey === "explore" && a.dataset.nav === "explore")) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    links.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    if (page === "jurisdiction" && jurByCode[arg]) pageJurisdiction(app, arg);
    else if (page === "jurisdictions" || page === "jurisdiction") pageJurisdictions(app);
    else if (page === "cases") pageCases(app);
    else if (page === "scoring") pageScoring(app);
    else if (page === "data") pageData(app);
    else if (page === "legal") pageLegal(app, arg);
    else if (page === "about") pageAbout(app);
    else pageExplore(app);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  render();
};
