/* The Contestability Index — rendering, routing and interaction.
   Structure from the professor's plan (website/planning/professor_plan_2026-11-17/Index_Website.md): five tabs,
   Overview, Explore Data, Methodology, Applications, Data & Sources. Look: KGI theme, WJP-style map and ranking.
   Vanilla JS. Reads window.CI_DATA, which js/db.js builds from the project database, and window.CI_WORLD. db.js calls
   window.CI_BOOT once the database is open.
   Pages (hash routes): #/ overview; #/explore/dejure|defacto|compare[?state]; #/jurisdiction/<code>;
   #/methodology[/<section or category code>]; #/applications[/<id>]; #/data[/<section>]; #/legal/<code>; #/about.
   The state of Explore Data (dimension, selections, period) is kept in the address, so a view can be shared and is
   kept when moving between views.
   Text the team has not supplied is drafted here and starts with the marker [AI generated]; the figures inside those
   drafts are computed from the database when the page opens, so they follow the data. Text quoted from the
   Methodology Manual or the working paper is quoted as such, with its section. */
window.CI_BOOT = function () {
  "use strict";
  var D = window.CI_DATA, W = window.CI_WORLD;
  var APPENDIX = "https://zycheng114514.github.io/contestability-appendix/";
  var REPO = "https://github.com/Zycheng114514/contestability-index";
  var AI = "[AI generated]";
  var TBD = "[To be added by the team]";

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
  // A line the team still has to settle (licence, contact): marked like the drafts, so it is not read as decided.
  function tbdP(parts, cls) {
    var p = el("p", cls);
    p.appendChild(el("span", "ai-tag tbd-tag", TBD));
    p.appendChild(document.createTextNode(" "));
    (Array.isArray(parts) ? parts : [parts]).forEach(function (x) { add(p, x); });
    return p;
  }
  // A passage quoted from a team document (Methodology Manual, working paper), with where it comes from.
  function quoteP(text, source) {
    var q = el("blockquote", "doc-quote");
    q.appendChild(el("span", null, text));
    if (source) q.appendChild(el("cite", null, source));
    return q;
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
  // The first four are the validated default order; five more follow so that all nine jurisdictions can be compared.
  var SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#8e5bd0", "#d6457f", "#2ba9bd", "#7a8794", "#8a5a2b"];
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
  // The gatekeeper-market pairs observed in a jurisdiction (today all are in the EU; the pages do not assume it).
  function unitsOf(code) { return UNITS.filter(function (u) { return unitById[u].jurisdiction === code; }); }
  function unitPlace(u) { return jurName[unitById[u].jurisdiction] || ""; }
  // "12 of 16": indicators scored out of all indicators, as the Methodology Manual's worked example counts them.
  function scoredOf(x) { return x ? x.nScored + " of " + x.nItems : ""; }
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
  // The dataset version is the database build; the observation dates are the periods the scores describe.
  var VERSION = "Database of " + String(D.meta.built || "").replace(/ .*$/, "");
  (function footer() {
    var f = $("#footer"), g = el("div", "foot-grid");
    function col(title, nodes) {
      var c = el("div");
      c.appendChild(el("h4", null, title));
      nodes.forEach(function (n) { c.appendChild(n); });
      g.appendChild(c);
    }
    col("Research team", [el("p", null, "Zhiyang Cheng, Tracy Xu and Amr Yakout"),
                          el("p", null, "Knight-Georgetown Institute, Georgetown University"),
                          add(el("p"), link("#/about", "About the project"))]);
    col("Contact", [tbdP("Contact address for questions about the data.")]);
    col("Repository and documentation", [add(el("p"), extLink(REPO, "Site repository on GitHub")),
                                         add(el("p"), extLink(APPENDIX, "Online appendix")),
                                         add(el("p"), link("#/methodology", "Methodology"), " · ", link("#/data/docs", "Data documentation"))]);
    col("Licence", [tbdP("Licence for the data and the site.")]);
    f.appendChild(g);
    var p = el("p", "foot-note");
    add(p, "Preliminary preview. Every figure is computed in your browser from the project database, ",
        link(D.meta.dbUrl, "contestability.db"), " (SQLite, built " + D.meta.built + "). ",
        link("#/data/docs", "Version and observation dates"), ".");
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

    var hasDF = unitsOf(code).length > 0, mine = unitsOf(code);
    box.appendChild(el("div", "tt-sub", hasDF ? "De Jure and De Facto by dimension" : "De Jure by dimension"));
    var dims = el("div", "tt-dims");
    DIMS.forEach(function (d) {
      dims.appendChild(el("span", null, d + " " + DIM_SHORT[d]));
      var trk = el("span", "tt-track"), bar = el("span", "dj");
      bar.style.width = (a.dims[d] * 100) + "%";
      trk.appendChild(bar);
      // One dot per pair, each on its own line inside the track, so pairs with the same value stay visible.
      if (hasDF) mine.forEach(function (u, ui) {
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
    if (hasDF) mine.forEach(function (u) {
      var kk = el("span"), i = el("i");
      i.style.background = UNIT_COLOR[u];
      add(kk, i, unitById[u].name);
      key2.appendChild(kk);
    });
    box.appendChild(key2);
    if (hasDF) box.appendChild(el("div", "tt-foot", "Dots: De Facto, " + DF_NOW + ", one per gatekeeper–market pair."));
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

  // Ranking bars. opts.compare adds a button per row that puts the jurisdiction into the comparison workspace.
  function rankingList(key, opts) {
    opts = opts || {};
    var host = el("div", "rank-list" + (opts.compare ? " with-cmp" : ""));
    rankedBy(key).forEach(function (code) {
      var v = val(code, key);
      var line = el("div", "rank-line");
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
      line.appendChild(row);
      if (opts.compare) line.appendChild(compareToggle(code));
      host.appendChild(line);
    });
    return host;
  }

  var cellButtons = {}, matrixOrder = CODES, current = null;
  // The jurisdictions-by-categories matrix, organised into the four dimensions. The first row is the overall
  // index and each dimension starts with a row of its dimension scores, so overall, dimension and category scores
  // are read in one table. opts.dim highlights a dimension, opts.cat a category.
  function categoryMatrix(order, opts) {
    opts = opts || {};
    matrixOrder = order;
    cellButtons = {};
    var wrap = el("div", "heat-wrap"), t = el("table", "heat"), thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "corner", "Obligation category"));
    order.forEach(function (code) {
      var th = el("th", "jur-head"), a = link("#/jurisdiction/" + code, code);
      a.title = jurName[code] + ": open the profile";
      th.appendChild(a);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);
    var tb = el("tbody");
    function aggRow(key, label, cls) {
      var tr = el("tr", "agg-row " + cls + (opts.dim === key ? " on" : "")), th = el("th", "mech agg");
      th.appendChild(el("span", null, label));
      tr.appendChild(th);
      order.forEach(function (code) {
        var v = val(code, key), td = el("td"), b = paint(el("span", "aggcell", num(v)), v);
        withTip(b, function () { return [jurName[code] + " · " + keyName(key) + ": " + num(v), "Rank " + rankOf(code, key) + " of " + nJ]; });
        td.appendChild(b);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    aggRow("overall", "Overall index", "overall-row");
    D.dimensions.forEach(function (d) {
      var sep = el("tr", "dim-sep" + (opts.dim === d.id ? " on" : "")), td = el("td");
      add(td, d.id + " · " + d.name + " ", link("#/methodology/" + d.id, "How it is measured"));
      td.colSpan = order.length + 1;
      sep.appendChild(td);
      tb.appendChild(sep);
      aggRow(d.id, "Dimension score", "dim-row");
      D.mechanisms.filter(function (m) { return m.dimension === d.id; }).forEach(function (m) {
        var tr = el("tr", (opts.dim === d.id ? "in-dim" : "") + (opts.cat === m.id ? " cat-on" : "")), th = el("th", "mech");
        var ml = link("#/methodology/" + m.code, "");
        add(ml, el("span", "n", m.id + "."), m.name);
        ml.title = (m.description || "") + " · How this category is scored";
        th.appendChild(ml);
        tr.appendChild(th);
        order.forEach(function (code) {
          var c = cellOf(m.id, code), td2 = el("td");
          var b = paint(el("button", "cell opens-panel", glyph(c.score)), c.score);
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
    Object.keys(indButtons).forEach(function (k) { indButtons[k].classList.remove("active"); });
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
      p.appendChild(add(el("p", "panel-links"), link("#/methodology/" + m.code, "How this category is scored →"), " ",
                        link("#/jurisdiction/" + code, "Open the " + jurName[code] + " profile →"), " ",
                        link("#/data/library?j=" + code + "&cat=" + m.id + "&period=dj", "Sources of this observation →")));
      p.appendChild(el("p", "small muted", "Record " + recordId("dj", code, m, "current") + " · database row " + (c.id || "—") + "."));
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
    if (e.target.closest && e.target.closest(".cell, .cat-row button, .open-doc, .ind, .opens-panel")) return;
    closePanel(true);
  });

  // The full texts are in their own file, fetched the first time one is opened (see js/db.js).
  function openDoc(doc) {
    current = null;
    openPanel(function (p) {
      p.appendChild(el("p", "crumb", jurName[doc.jurisdiction] + " · full text"));
      p.appendChild(el("h2", null, doc.name || doc.stem));
      p.appendChild(el("p", "small muted", [doc.language, doc.file, Math.round(doc.chars / 1000) + "k characters"].filter(Boolean).join(" · ")));
      var reader = el("div", "reader", "Loading the text…");
      p.appendChild(reader);
      window.CI_TEXT(doc.id).then(function (text) { reader.textContent = text || "No text on file."; })
        .catch(function (e) { reader.textContent = "The text could not be loaded (" + (e && e.message ? e.message : e) + ")."; });
    });
  }

  // One De Facto indicator for one gatekeeper-market pair: the two observations, the coded evidence and its
  // sources, and the market-level De Jure record for the same mechanism.
  var indButtons = {};
  var CONF = { "HIGH": [100, "high"], "MODERATE": [75, "moderate"], "LOW-MOD": [50, "low to moderate"], "LOW": [25, "low"] };
  function openIndicator(u, mid) {
    var m = mechById[mid], unit = unitById[u];
    var it = D.deFacto.items.filter(function (x) { return x.unit === u && x.mechanism === mid; })[0];
    if (!it) return;
    current = null;
    Object.keys(indButtons).forEach(function (k) { indButtons[k].classList.toggle("active", k === u + "|" + mid); });
    openPanel(function (p) {
      p.appendChild(el("p", "crumb", m.dimension + " " + dimById[m.dimension].name + " · indicator " + m.code));
      p.appendChild(el("h2", null, m.indicator + ": " + unit.name));
      p.appendChild(el("p", "small muted", [unit.gatekeeper, unit.market, unitPlace(u)].filter(Boolean).join(" · ")));
      var states = D.paper.codingStates || {};
      if (it.status === "scored") {
        var fr = el("div", "factor-row two");
        [[DF_BASE, it.pre], [DF_NOW, it.post]].forEach(function (x) {
          fr.appendChild(add(paint(el("div", "factor"), x[1]), el("span", "fl", x[0]), el("span", "fv", glyph(x[1]))));
        });
        p.appendChild(fr);
        if (it.confidence) {
          var lvl = (CONF[it.confidence] || [0, it.confidence.toLowerCase()])[1], def = (D.paper.confidenceLevels || {})[cap(lvl)];
          p.appendChild(el("p", "small", "Confidence: " + lvl + (def ? " (" + def + ")" : "") + "."));
        }
      } else if (it.status === "missing") {
        p.appendChild(el("p", "formula", "Missing" + (states.Missing ? ": " + states.Missing : "") + ". Left out of the index."));
      } else {
        p.appendChild(el("p", "formula", "Not applicable" + (states["Not Applicable"] ? ": " + states["Not Applicable"] : "") + ". Left out of the index."));
      }
      p.appendChild(el("h4", null, "Evidence and scoring rationale"));
      p.appendChild(el("p", null, it.evidence || "—"));
      if (it.sources.length) {
        p.appendChild(el("h4", null, "Sources"));
        var ul = el("ul", "link-list");
        it.sources.forEach(function (l) {
          ul.appendChild(l.url ? add(el("li"), extLink(l.url, l.title), el("span", "muted small", " · " + domain(l.url))) : el("li", null, l.title));
        });
        p.appendChild(ul);
      }
      var dj = D.markets.deJure.filter(function (r) { return r.unit === u && r.mechanism === mid && r.period === "current"; })[0];
      if (dj) {
        p.appendChild(el("h4", null, "The law for this mechanism in this market, " + DJ_DATE));
        p.appendChild(add(el("p"), paint(el("span", "pill-inline", glyph(dj.score)), dj.score), " ", el("strong", null, m.id + ". " + m.name),
          " · min(Existence " + dj.existence + ", Scope " + dj.scope + ", Enforceability " + dj.enforceability + ")"));
        if (dj.provision) p.appendChild(el("p", "small", dj.provision));
        if (dj.hook) p.appendChild(el("p", "small", dj.hook));
        if (dj.extract) p.appendChild(el("blockquote", null, dj.extract));
        if (dj.note) p.appendChild(el("p", "small muted", dj.note));
      }
      p.appendChild(add(el("p", "panel-links"), link("#/methodology/" + m.code, "How this indicator is scored →"), " ",
                        link("#/explore/compare?type=gap&unit=" + u + "&cat=" + mid, "Law and market for this mechanism →"), " ",
                        link("#/data/library?type=defacto&cat=" + mid + "&q=" + encodeURIComponent(recordId("df", u, m, "current")), "Sources of this observation →")));
      p.appendChild(el("p", "small muted", "Records " + recordId("df", u, m, "baseline") + " and " + recordId("df", u, m, "current") + "."));
      p.appendChild(el("p", "small muted", "Esc closes."));
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


  /* ========================================================== shared state, kept in the address */
  // One state for Explore Data. It is written into the address with replaceState (no reload), read back when a
  // page opens, and kept in memory when the reader moves between De Jure, De Facto and Compare.
  var VIEWS = ["map", "rank"], PERIODS = ["baseline", "current", "change"], CMPS = ["jur", "mkt", "gap"];
  var S = { dim: "overall", view: "map", period: "current", jurs: ["EU", "JP", "CN", "US"], units: UNITS.slice(),
            cmp: "jur", unit: "all", cat: null };
  function readQuery(q) {
    var p = {};
    String(q || "").split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("="), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? "" : decodeURIComponent(kv.slice(i + 1));
      p[k] = v;
    });
    if (KEYS.indexOf(p.dim) >= 0) S.dim = p.dim;
    if (VIEWS.indexOf(p.view) >= 0) S.view = p.view;
    if (PERIODS.indexOf(p.period) >= 0) S.period = p.period;
    if (CMPS.indexOf(p.type) >= 0) S.cmp = p.type;
    if (p.j !== undefined) S.jurs = p.j.split(",").map(function (c) { return c.toUpperCase(); })
      .filter(function (c, i, a) { return jurByCode[c] && a.indexOf(c) === i; });
    if (p.units !== undefined) {
      var us = p.units.split(",").filter(function (u) { return unitById[u]; });
      if (us.length) S.units = UNITS.filter(function (u) { return us.indexOf(u) >= 0; });
    }
    if (p.unit !== undefined) S.unit = unitById[p.unit] ? p.unit : "all";
    if (p.cat !== undefined) S.cat = mechById[+p.cat] ? +p.cat : null;
    return p;
  }
  function query(keys) {
    var map = { dim: S.dim, view: S.view, period: S.period, type: S.cmp, j: S.jurs.join(","), units: S.units.join(","),
                unit: S.unit, cat: S.cat === null ? "" : String(S.cat) };
    return keys.filter(function (k) { return map[k] !== ""; }).map(function (k) { return k + "=" + encodeURIComponent(map[k]).replace(/%2C/g, ","); }).join("&");
  }
  function setAddress(path, keys) {
    var q = query(keys || []);
    history.replaceState(null, "", "#" + path + (q ? "?" + q : ""));
  }
  function exploreHref(view) {
    var keys = view === "dejure" ? ["view", "dim", "cat"] : view === "defacto" ? ["period", "dim", "units", "cat"]
             : ["type", "j", "units", "unit", "cat"];
    var q = query(keys);
    return "#/explore/" + view + (q ? "?" + q : "");
  }

  // A stable identifier for one score: layer, who, category code, observation month. It is built from the keys of
  // the record, so it stays the same when the database is rebuilt; the database row number does not.
  function recordId(layer, who, m, period) {
    var obs = layer === "dj" ? (D.periods["de_jure|jurisdiction|current"] || {}).observed
            : layer === "djm" ? (D.periods["de_jure|market|" + period] || {}).observed
            : (D.periods["de_facto|market|" + period] || {}).observed;
    return layer + ":" + who + ":" + m.code + ":" + (obs || period);
  }

  /* ------------------------------------------------------------ comparison selection */
  var cmpButtons = [];
  function compareToggle(code) {
    var b = el("button", "cmp-btn");
    b.type = "button";
    b.dataset.code = code;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var i = S.jurs.indexOf(code);
      if (i >= 0) S.jurs.splice(i, 1); else S.jurs.push(code);
      syncCompare();
    });
    cmpButtons.push(b);
    paintToggle(b);
    return b;
  }
  function paintToggle(b) {
    var on = S.jurs.indexOf(b.dataset.code) >= 0, full = false;
    b.textContent = on ? "✓ Compare" : "+ Compare";
    b.classList.toggle("on", on);
    b.disabled = full;
    b.title = on ? "Remove from the comparison" : "Add to the comparison";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", (on ? "Remove " : "Add ") + jurName[b.dataset.code] + (on ? " from" : " to") + " the comparison");
  }
  function syncCompare() {
    cmpButtons = cmpButtons.filter(function (b) { return document.body.contains(b); });
    cmpButtons.forEach(paintToggle);
    Array.prototype.forEach.call(document.querySelectorAll(".cmp-tray"), function (t) { t.refresh(); });
  }
  // "Compare selected (n)": the jurisdictions picked so far, and the way into the comparison workspace.
  function compareTray() {
    var a = el("a", "btn btn-outline cmp-tray");
    a.refresh = function () {
      a.textContent = "Compare selected (" + S.jurs.length + ") →";
      a.href = "#/explore/compare?type=jur&j=" + S.jurs.join(",");
      a.title = S.jurs.map(function (c) { return jurName[c]; }).join(", ");
    };
    a.addEventListener("click", function () { S.cmp = "jur"; });
    a.refresh();
    return a;
  }

  /* ------------------------------------------------------------ small controls */
  function segmented(options, value, onChange, label) {
    var seg = el("div", "seg"), bs = {};
    seg.setAttribute("role", "group");
    if (label) seg.setAttribute("aria-label", label);
    options.forEach(function (o) {
      var b = el("button", null, o[1]);
      b.type = "button";
      b.addEventListener("click", function () { set(o[0]); onChange(o[0]); });
      bs[o[0]] = b;
      seg.appendChild(b);
    });
    function set(v) { Object.keys(bs).forEach(function (k) { bs[k].setAttribute("aria-pressed", k === v ? "true" : "false"); }); }
    set(value);
    seg.set = set;
    return seg;
  }
  // A small link to the methodology entry that explains what is shown next to it.
  function helpLink(href, title) {
    var a = link(href, "?");
    a.className = "help";
    a.title = title || "How this is measured";
    a.setAttribute("aria-label", a.title);
    return a;
  }
  // A download button for the data behind a chart or table. rowsFn is called when it is clicked.
  function dlButton(name, header, rowsFn, label) {
    var b = el("button", "btn btn-outline btn-sm", label || "Download data (CSV)");
    b.type = "button";
    b.addEventListener("click", function () { csvDownload(name, header, rowsFn()); });
    return b;
  }
  function chartHead(title, sub, tools) {
    var h = el("div", "chart-head"), t = el("div");
    t.appendChild(el("h3", null, title));
    if (sub) t.appendChild(sub.nodeType ? sub : el("p", "pz-sub", sub));
    h.appendChild(t);
    if (tools && tools.length) { var r = el("div", "chart-tools"); tools.forEach(function (x) { if (x) r.appendChild(x); }); h.appendChild(r); }
    return h;
  }

  /* ------------------------------------------------------------ CSV rows shared by the downloads */
  var CSV = {
    dejureHeader: ["record_id", "db_row", "jurisdiction_code", "jurisdiction", "dimension", "category_code", "category_id", "category",
                   "score", "existence", "scope", "enforceability", "legal_form", "instrument_basis", "observed", "evidence_date"],
    dejureRows: function (codes, dim) {
      var out = [];
      codes.forEach(function (c) {
        D.mechanisms.forEach(function (m) {
          if (dim && dim !== "overall" && m.dimension !== dim) return;
          var x = cellOf(m.id, c);
          out.push([recordId("dj", c, m, "current"), x.id, c, jurName[c], m.dimension, m.code, m.id, m.name, x.score, x.existence, x.scope,
                    x.enforceability, x.legal_form, x.instrument_basis, (D.periods["de_jure|jurisdiction|current"] || {}).observed, x.evidence_date]);
        });
      });
      return out;
    },
    defactoHeader: ["record_id", "db_row", "unit_id", "pair", "gatekeeper", "market", "dimension", "indicator_code", "indicator", "category",
                    "period", "observed", "status", "score", "confidence"],
    defactoRows: function (units, dim) {
      var out = [];
      D.deFacto.items.forEach(function (it) {
        if (units.indexOf(it.unit) < 0) return;
        var m = mechById[it.mechanism], u = unitById[it.unit];
        if (dim && dim !== "overall" && m.dimension !== dim) return;
        ["baseline", "current"].forEach(function (p) {
          out.push([recordId("df", it.unit, m, p), p === "baseline" ? it.preId : it.postId, it.unit, u.name, u.gatekeeper, u.market, m.dimension, m.code,
                    m.indicator, m.name, p, (D.periods["de_facto|market|" + p] || {}).observed, it.status,
                    it.status === "scored" ? (p === "baseline" ? it.pre : it.post) : "", it.status === "scored" ? it.confidence : ""]);
        });
      });
      return out;
    },
    indexHeader: ["layer", "level", "who", "name", "period", "observed", "index"].concat(DIMS, ["n_scored", "n_applicable", "n_indicators"]),
    indexRows: function () {
      var out = [];
      CODES.forEach(function (c) {
        out.push(["de_jure", "jurisdiction", c, jurName[c], "current", (D.periods["de_jure|jurisdiction|current"] || {}).observed, val(c, "overall")]
          .concat(DIMS.map(function (d) { return val(c, d); }), [nM, nM, nM]));
      });
      ["de_jure", "de_facto"].forEach(function (layer) {
        UNITS.forEach(function (u) {
          ["baseline", "current"].forEach(function (p) {
            var x = mIdx(layer, u, p);
            if (!x) return;
            out.push([layer, "market", u, unitById[u].name, p, x.observed, x.index].concat(DIMS.map(function (d) { return x.dims[d] ? x.dims[d].score : ""; }),
                     [x.nScored, x.nApplicable, x.nItems]));
          });
        });
      });
      return out;
    },
    // law against market for the matched pairs: both layers and the difference between them
    gapHeader: ["unit_id", "pair", "jurisdiction", "period", "de_jure_market_level", "de_facto", "gap_de_jure_minus_de_facto"],
    gapRows: function () {
      return D.effective.map(function (r) { return [r.unit, unitById[r.unit].name, unitById[r.unit].jurisdiction, r.period, r.deJure, r.deFacto, r.gap]; });
    }
  };

  /* ------------------------------------------------------------ site search */
  // Searches jurisdictions, dimensions, obligation categories and indicators, market pairs, legal instruments,
  // full texts, provisions and De Facto sources. Built once, from the same data the pages show.
  var SEARCH = null;
  function searchIndex() {
    if (SEARCH) return SEARCH;
    var out = [];
    function put(type, label, sub, hay, href, act) { out.push({ type: type, label: label, sub: sub, hay: (label + " " + sub + " " + (hay || "")).toLowerCase(), href: href, act: act }); }
    D.jurisdictions.forEach(function (j) {
      put("Jurisdiction", j.name, "De Jure index " + num(val(j.code, "overall")) + ", rank " + rankOf(j.code, "overall") + " of " + nJ, j.code, "#/jurisdiction/" + j.code);
    });
    D.dimensions.forEach(function (d) {
      var q = (D.paper.dimensionQuestions || {})[d.id];
      put("Dimension", d.id + " " + d.name, q ? q.question : "Dimension", "", "#/methodology/" + d.id);
    });
    D.mechanisms.forEach(function (m) {
      put("Obligation category", m.id + ". " + m.name, m.dimension + " · De Facto indicator " + m.code + " " + m.indicator, m.description + " " + m.code, "#/methodology/" + m.code);
    });
    UNITS.forEach(function (u) {
      var x = unitById[u];
      put("Market pair", x.name, [x.gatekeeper, x.market, unitPlace(u)].filter(Boolean).join(" · "), x.service, "#/explore/defacto?units=" + u);
    });
    Object.keys(D.instruments).forEach(function (c) {
      D.instruments[c].forEach(function (i) {
        put("Legal instrument", i.name, jurName[c] + (i.citation ? " · " + i.citation : ""), i.status,
            "#/data/library?type=instrument&j=" + c + "&q=" + encodeURIComponent((i.name || "").split(" (")[0]));
      });
    });
    D.documents.forEach(function (d) {
      put("Full text", d.name || d.stem, jurName[d.jurisdiction] + (d.language ? " · " + d.language : ""), d.stem, null, function () { openDoc(d); });
    });
    Object.keys(D.cells).forEach(function (k) {
      var p = k.split("|"), m = mechById[+p[0]];
      (D.cells[k].extracts || []).forEach(function (x) {
        put("Provision", x.instrument, jurName[p[1]] + " · " + m.id + ". " + m.name, x.summary, null, function () { matrixOrder = CODES; openCell(m.id, p[1]); });
      });
    });
    var seen = {};
    D.deFacto.items.forEach(function (it) {
      it.sources.forEach(function (s) {
        var key = s.title + "|" + it.unit;
        if (seen[key]) return;
        seen[key] = 1;
        put("De Facto source", s.title, unitById[it.unit].name + " · " + mechById[it.mechanism].code, s.url, null, function () { openIndicator(it.unit, it.mechanism); });
      });
    });
    return (SEARCH = out);
  }
  (function siteSearch() {
    var host = $("#site-search");
    if (!host) return;
    var inp = el("input"), list = el("div", "search-results");
    inp.type = "search";
    inp.placeholder = "Search jurisdictions, categories, markets, sources";
    inp.setAttribute("aria-label", "Search the site");
    list.hidden = true;
    list.setAttribute("role", "listbox");
    add(host, inp, list);
    function hits(q) {
      var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return [];
      return searchIndex().filter(function (x) { return terms.every(function (t) { return x.hay.indexOf(t) >= 0; }); }).slice(0, 14);
    }
    function choose(x) {
      list.hidden = true;
      inp.value = "";
      inp.blur();
      if (x.act) x.act(); else go(x.href);
    }
    function draw() {
      var hs = hits(inp.value);
      list.textContent = "";
      if (!inp.value.trim()) { list.hidden = true; return; }
      if (!hs.length) list.appendChild(el("div", "sr-none", "Nothing found."));
      hs.forEach(function (x) {
        var b = el("button", "sr opens-panel");
        b.type = "button";
        add(b, el("span", "sr-t", x.type), el("span", "sr-l", x.label), el("span", "sr-s", x.sub));
        b.addEventListener("click", function () { choose(x); });
        list.appendChild(b);
      });
      list.hidden = false;
    }
    inp.addEventListener("input", draw);
    inp.addEventListener("focus", draw);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { list.hidden = true; inp.blur(); }
      if (e.key === "Enter") { var h = hits(inp.value); if (h.length) choose(h[0]); }
      if (e.key === "ArrowDown") { var f = list.querySelector("button"); if (f) { e.preventDefault(); f.focus(); } }
    });
    list.addEventListener("keydown", function (e) {
      var b = document.activeElement;
      if (e.key === "ArrowDown" && b.nextSibling) { e.preventDefault(); b.nextSibling.focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (b.previousSibling || inp).focus(); }
      if (e.key === "Escape") { list.hidden = true; inp.focus(); }
    });
    document.addEventListener("click", function (e) { if (!host.contains(e.target)) list.hidden = true; });
  })();

  /* ------------------------------------------------------------ citation and version */
  function citeText() {
    return {
      paper: "Cheng, Zhiyang, Tracy Xu and Amr Yakout. 2026. “Beyond Market Concentration: Measuring Contestability in Digital Markets.” Working paper, July 2026."
    };
  }
  function openCite() {
    current = null;
    var c = citeText();
    openPanel(function (p) {
      p.appendChild(el("p", "crumb", "Citation and version"));
      p.appendChild(el("h2", null, "Cite the Contestability Index"));
      p.appendChild(el("h4", null, "The working paper"));
      p.appendChild(el("p", null, c.paper));
      var copy = el("button", "btn btn-outline btn-sm", "Copy this citation");
      copy.type = "button";
      copy.addEventListener("click", function () {
        if (navigator.clipboard) navigator.clipboard.writeText(c.paper).then(function () { copy.textContent = "Copied"; });
      });
      p.appendChild(copy);
      p.appendChild(el("h4", null, "The dataset"));
      p.appendChild(tbdP("How to cite the dataset itself, and its licence. Until then, cite the working paper and give the version below."));
      p.appendChild(el("h4", null, "Version"));
      p.appendChild(versionBox());
      p.appendChild(add(el("p", "small"), link("#/data/docs", "Documentation, data dictionary and update history →")));
    });
  }
  // The dataset version and the dates the scores describe, shown wherever the data is.
  function versionBox() {
    var b = el("div", "version-box");
    b.appendChild(add(el("div"), el("span", null, "Version number"), tbdP("Version numbering.", "inline")));
    [["Database build", VERSION + " (preliminary)"], ["De Jure, jurisdiction level", "Law in force, " + DJ_DATE],
     ["De Jure, market level", month((D.periods["de_jure|market|baseline"] || {}).observed) + " and " + month((D.periods["de_jure|market|current"] || {}).observed)],
     ["De Facto", DF_BASE + " (before the DMA obligations applied) and " + DF_NOW]].forEach(function (x) {
      b.appendChild(add(el("div"), el("span", null, x[0]), el("b", null, x[1])));
    });
    return b;
  }
  (function citeButton() {
    var b = $("#cite-btn");
    if (b) b.addEventListener("click", function (e) { e.preventDefault(); openCite(); });
  })();

  /* ------------------------------------------------------------ quoted passages and computed statements */
  var MAN = D.paper.manual || {}, MANSRC = String(MAN.source || "Methodology Manual").split(" (")[0];
  // A passage of the Methodology Manual held in data/paper.json, quoted with its section; nothing if it is not on file.
  function mq(key, field) {
    var x = MAN[key], t = x && x[field || "text"];
    return t ? quoteP(t, MANSRC + ", section " + x.section) : null;
  }
  function span2(a, b) { return num(a) === num(b) ? num(a) : num(a) + "–" + num(b); }

  // Statements about the data, written once and used by the Overview and the Applications. Every number is read
  // from the database, so the sentences follow the data.
  var INS = null;
  function insights() {
    if (INS) return INS;
    var o = {};
    var rk = rankedBy("overall"), topV = val(rk[0], "overall");
    var tops = rk.filter(function (c) { return val(c, "overall") === topV; });
    var rest = rk.filter(function (c) { return tops.indexOf(c) < 0; });
    var below = rk.filter(function (c) { return val(c, "overall") < 0.5; });
    var last = rk[rk.length - 1];
    var pending = D.mechanisms.filter(function (m) { var c = cellOf(m.id, last); return c.legal_form === "pending" && c.score === 0; }).length;
    o.top = {
      big: [[num(topV), listText(tops.map(function (c) { return jurName[c]; }))], [num(val(rest[0], "overall")), jurName[rest[0]]],
            [num(val(last, "overall")), jurName[last]]],
      text: cap(theNames(tops)) + (tops.length > 1 ? " score " : " scores ") + num(topV) +
            (topV === 1 ? ": the law requires all " + words(nM) + " obligation categories in full. " : ". ") +
            cap(theName(rest[0])) + " follows at " + num(val(rest[0], "overall")) + ". " + cap(words(below.length)) +
            " jurisdictions score below 0.50, and " + theName(last) + " scores lowest at " + num(val(last, "overall")) +
            (pending ? "; " + words(pending) + " of its " + words(nM) + " categories are covered only by announced reforms that are not yet in force, which score zero." : ".")
    };

    var ch = UNITS.map(function (u) { return { u: u, a: mVal("de_facto", u, "baseline", "overall"), b: mVal("de_facto", u, "current", "overall") }; })
      .filter(function (x) { return x.a !== null && x.b !== null; });
    var up = ch.slice().sort(function (x, y) { return (y.b - y.a) - (x.b - x.a); });
    o.change = {
      rows: ch, most: up[0],
      big: ch.map(function (x) { return [num(x.a) + " → " + num(x.b), unitById[x.u].name]; }),
      text: (ch.every(function (x) { return x.b > x.a; }) ? "All " + words(ch.length) + " pairs scored higher in " + DF_NOW + " than in " + DF_BASE + ". " : "") +
            unitById[up[0].u].name + " rose the most, from " + num(up[0].a) + " to " + num(up[0].b) + ". These are observations from before " +
            "and after the Digital Markets Act's obligations began to apply in March 2024; they are not estimates of the Act's effect."
    };

    var eff = UNITS.map(function (u) { return effOf(u, "current"); }).filter(function (e) { return e && e.gap !== null; });
    var gaps = eff.map(function (e) { return e.gap; }), dfs = eff.map(function (e) { return e.deFacto; });
    var allFull = eff.every(function (e) { return e.deJure === 1; });
    o.gap = {
      rows: eff, allFull: allFull, lo: Math.min.apply(null, gaps), hi: Math.max.apply(null, gaps),
      dfLo: Math.min.apply(null, dfs), dfHi: Math.max.apply(null, dfs),
      big: eff.map(function (e) { return [num(e.gap), "gap, " + unitById[e.unit].name]; }),
      text: (allFull ? "In " + DJ_DATE + " EU law requires all " + words(nM) + " obligations in each of the three markets: the market-level De Jure score is " +
               num(1) + " for every pair. " : "") +
            "The " + DF_NOW + " De Facto scores run from " + num(Math.min.apply(null, dfs)) + " to " + num(Math.max.apply(null, dfs)) +
            ", so the implementation gap, De Jure minus De Facto, is between " + num(Math.min.apply(null, gaps)) + " and " + num(Math.max.apply(null, gaps)) + "."
    };

    var pv = prevalence();
    var maxF = Math.max.apply(null, pv.map(function (p) { return p.full.length; }));
    var minF = Math.min.apply(null, pv.map(function (p) { return p.full.length; }));
    var most = pv.filter(function (p) { return p.full.length === maxF; }), least = pv.filter(function (p) { return p.full.length === minF; });
    var onlyEU = least.every(function (p) { return p.full.slice().sort().join() === "DE,EU"; });
    function names(ps) { return listText(ps.map(function (p) { return p.m.name.toLowerCase(); })); }
    o.prevalence = {
      big: [[maxF + " of " + nJ, "most common"], [minF + " of " + nJ, "least common"]],
      text: (most.length > 1 ? cap(words(most.length)) + " categories are" : "One category is") + " required in full by " + words(maxF) + " of the " + words(nJ) +
            " jurisdictions, the most of any: " + names(most) + ". " + (least.length > 1 ? cap(words(least.length)) + " categories are" : "One category is") +
            " required in full by " + words(minF) + (onlyEU ? ", the European Union and Germany, whose scores rest on the same EU law" : "") + ": " + names(least) + "."
    };

    var sp = DIMS.map(function (d) {
      var vs = CODES.map(function (c) { return val(c, d); }), mean = vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
      var sd = Math.sqrt(vs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / vs.length);
      var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
      return { d: d, sd: sd, min: mn, max: mx,
               lo: CODES.filter(function (c) { return val(c, d) === mn; }), hi: CODES.filter(function (c) { return val(c, d) === mx; }) };
    });
    var bySd = sp.slice().sort(function (a, b) { return b.sd - a.sd; }), hiS = bySd[0], loS = bySd[bySd.length - 1];
    function who(cs) { var n = cs.map(theName); return n.length > 3 ? n.slice(0, 2).join(", ") + " and " + (n.length - 2) + " others" : listText(n); }
    o.spread = {
      big: [[num(hiS.sd), "spread on " + hiS.d], [num(loS.sd), "spread on " + loS.d]],
      text: "The jurisdictions differ most on " + hiS.d + " " + dimById[hiS.d].name + ", where scores run from " + num(hiS.min) + " (" + who(hiS.lo) +
            ") to " + num(hiS.max) + " (" + who(hiS.hi) + "). They differ least on " + loS.d + " " + dimById[loS.d].name + ", from " + num(loS.min) +
            " to " + num(loS.max) + ". Spread is the standard deviation of the " + words(nJ) + " scores."
    };

    // How fine the index is: one half-point step in one category moves the index by 0.5 / (categories in the
    // dimension) / (number of dimensions). Neighbours in the ranking that are closer than the smallest step are named.
    var steps = DIMS.map(function (d) { return 0.5 / D.mechanisms.filter(function (m) { return m.dimension === d; }).length / nD; });
    var minStep = Math.min.apply(null, steps), maxStep = Math.max.apply(null, steps), close = [];
    for (var i = 1; i < rk.length; i++) {
      var diff = val(rk[i - 1], "overall") - val(rk[i], "overall");
      if (diff > 1e-9 && diff < minStep - 1e-9) close.push([rk[i - 1], rk[i], diff]);
    }
    o.precision = {
      text: "One half-point step in one category moves a jurisdiction's index by " + num(minStep, 3) + " to " + num(maxStep, 3) +
            ", depending on how many categories its dimension has. " +
            (close.length ? "Neighbours in the ranking that are closer than the smallest step: " + close.map(function (x) {
              return theName(x[0]) + " (" + num(val(x[0], "overall"), 3) + ") and " + theName(x[1]) + " (" + num(val(x[1], "overall"), 3) + ")";
            }).join("; ") + ". Their order should not be read as a difference." : "No two neighbours in the ranking are closer than the smallest step.")
    };
    return (INS = o);
  }

  // Small squares for the categories of a dimension; each opens the category's methodology entry.
  function hierarchyMini() {
    var g = el("div", "hier-mini");
    D.dimensions.forEach(function (d) {
      var c = link("#/methodology/" + d.id, ""), ms = D.mechanisms.filter(function (m) { return m.dimension === d.id; });
      c.className = "hier-dim";
      add(c, el("span", "k", d.id), el("b", null, d.name), el("span", "n", ms.length + " obligation categories"));
      var sq = el("div", "hier-cats");
      ms.forEach(function (m) {
        var a = link("#/methodology/" + m.code, String(m.id));
        a.title = m.id + ". " + m.name + " · indicator " + m.code + " " + m.indicator;
        a.addEventListener("click", function (e) { e.stopPropagation(); });
        sq.appendChild(a);
      });
      var box = el("div", "hier-col");
      add(box, c, sq);
      g.appendChild(box);
    });
    return g;
  }

  /* ========================================================== TAB 1: OVERVIEW */
  function pageOverview(app) {
    var hero = el("section", "hero ov-hero"), hm = el("div", "hero-map");
    hm.setAttribute("aria-hidden", "true");
    hm.appendChild(drawWorld({ key: "overall" }));
    hero.appendChild(hm);
    var hin = el("div", "hero-in");
    hin.appendChild(el("h1", null, "Measuring Contestability in Digital Markets"));
    hin.appendChild(el("p", "lede", "A framework for comparing legal requirements and observed market conditions across jurisdictions and digital markets."));
    var cta = el("div", "hero-cta"), a1 = link("#/explore/dejure", "Explore the Index"), a2 = link("#/methodology", "How it works");
    a1.className = "btn btn-fill";
    a2.className = "btn btn-ghost";
    add(cta, a1, a2);
    hin.appendChild(cta);
    hero.appendChild(hin);
    app.appendChild(hero);

    /* introduction: definition and scope */
    var s1 = section(null, "intro"), w1 = el("div", "wrap ov-intro");
    var left = el("div"), right = el("div");
    left.appendChild(el("p", "sec-kicker", "Introduction"));
    left.appendChild(el("h2", "sec-head", "What the index measures"));
    left.appendChild(aiP("The Contestability Index measures the opportunity for incumbent positions in digital markets to be challenged, rather than market " +
      "structure or outcomes. It scores " + words(nM) + " mechanisms, grouped into " + words(nD) + " dimensions, from two sides: what the law requires and what is observed in the market."));
    left.appendChild(add(el("p"), link("#/methodology/concept", "Concept and scope →")));
    /* coverage summary: each figure is an entry point */
    var cov = el("div", "cov-grid");
    [[nJ, "Jurisdictions", "scored on the law", "#/explore/dejure?view=rank"],
     [nD, "Dimensions", "shared by both layers", "#/methodology/framework"],
     [nM, "Obligations", "categories, one indicator each", "#/explore/dejure?view=map&cat=1"],
     [nU, "Market pairs", "gatekeeper and market, observed in practice", "#/explore/defacto"]].forEach(function (x) {
      var a = link(x[3], "");
      a.className = "cov";
      add(a, el("b", null, String(x[0])), el("span", "l", x[1]), el("span", "s", x[2]));
      cov.appendChild(a);
    });
    right.appendChild(cov);
    var dates = link("#/data/docs", "");
    dates.className = "cov-dates";
    add(dates, el("span", "l", "Observation dates"),
        el("span", null, "De Jure: law in force, " + DJ_DATE + " · De Facto: " + DF_BASE + " and " + DF_NOW + " · " + VERSION));
    right.appendChild(dates);
    add(w1, left, right);
    s1.appendChild(w1);
    app.appendChild(s1);

    /* two measurement layers, side by side */
    var s2 = section("alt", "layers"), w2 = el("div", "wrap");
    head(w2, "Two measurement layers", "De Jure and De Facto");
    var lg = el("div", "layer-grid"), ins = insights();
    var rk = rankedBy("overall");
    function layerCard(title, tag, defn, facts, href, go2, methHref) {
      var c = el("div", "layer-card");
      add(c, el("h3", null, title), el("p", "tag", tag));
      if (defn) c.appendChild(quoteP(defn, MANSRC + ", section " + MAN.definitions.section));
      var f = el("div", "mfacts");
      facts.forEach(function (x) { add(f, el("span", null, x[0]), el("b", null, x[1])); });
      c.appendChild(f);
      var row = el("p", "layer-links"), a = link(href, go2 + " →");
      a.className = "btn btn-fill";
      add(row, a, link(methHref, "How it is scored"));
      c.appendChild(row);
      return c;
    }
    var defs = MAN.definitions || {};
    lg.appendChild(layerCard("De Jure", "What the legal framework requires", defs.deJure,
      [["Unit", nJ + " jurisdictions × " + nM + " obligation categories"], ["Observed", DJ_DATE],
       ["Index range", span2(val(rk[rk.length - 1], "overall"), val(rk[0], "overall"))]],
      "#/explore/dejure", "Explore legal scores", "#/methodology/dejure"));
    lg.appendChild(layerCard("De Facto", "What is observed in practice", defs.deFacto,
      [["Unit", nU + " gatekeeper–market pairs × " + nM + " indicators"], ["Observed", DF_BASE + " and " + DF_NOW],
       ["Index range, " + DF_NOW, span2(ins.gap.dfLo, ins.gap.dfHi)]],
      "#/explore/defacto", "Explore market scores", "#/methodology/defacto"));
    w2.appendChild(lg);
    s2.appendChild(w2);
    app.appendChild(s2);

    /* framework preview */
    var s3 = section(null, "framework"), w3 = el("div", "wrap");
    head(w3, "Understanding the measurement", "Four dimensions → sixteen obligation categories → scored observations → aggregated indices");
    w3.appendChild(hierarchyMini());
    var flow = el("div", "flow four");
    [["Dimension", "A broad category of competitive friction. There are " + words(nD) + "."],
     ["Obligation category and indicator", "Each of the " + words(nM) + " mechanisms has one legal category (De Jure) and one observable indicator (De Facto)."],
     ["Scored observation", "Each is scored 0, ½ or 1, with its legal basis or its evidence on record."],
     ["Index", "A dimension is the mean of its scores; the index is the mean of the " + words(nD) + " dimensions."]].forEach(function (x) {
      flow.appendChild(add(el("div", "st"), el("b", null, x[0]), x[1]));
    });
    w3.appendChild(flow);
    w3.appendChild(el("p", "small muted", "The four steps above are an [AI generated] summary of the Methodology Manual, sections II.C and III.E."));
    var vf = link("#/methodology/framework", "View measurement framework →");
    vf.className = "btn btn-outline";
    w3.appendChild(add(el("p"), vf));
    s3.appendChild(w3);
    app.appendChild(s3);

    /* featured data preview: one compact chart with context */
    var s4 = section("alt", "featured"), w4 = el("div", "wrap");
    head(w4, "Featured data", "De Jure index of the " + words(nJ) + " jurisdictions");
    var fc = el("div", "kp"), ft = el("div"), fv = el("div", "viz");
    ft.appendChild(aiP("Each bar is one jurisdiction's De Jure index in " + DJ_DATE + ": the mean of its " + words(nD) + " dimension scores, from 0 (no obligation category in the law) to 1 " +
      "(all " + words(nM) + " required in full). A score records the law as written, not compliance or market outcomes. Hover over a bar for the dimensions; click it for the profile."));
    var fa = link("#/explore/dejure?view=rank&dim=overall", "Open the full chart →");
    fa.className = "btn btn-outline";
    ft.appendChild(add(el("p"), fa));
    fv.appendChild(rankingList("overall"));
    fv.appendChild(add(el("p", "chart-foot"), dlButton("contestability_dejure_index.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[1] === "jurisdiction"; }); })));
    add(fc, ft, fv);
    w4.appendChild(fc);
    s4.appendChild(w4);
    app.appendChild(s4);

    /* research and downloads: brief links */
    var s5 = section(null, "more"), w5 = el("div", "wrap");
    head(w5, "Research and downloads", "Use the index");
    var cards = el("div", "link-cards");
    [["#/applications", "Applications", APPS.length + " analyses built from the data: comparing frameworks, change over time, law against market."],
     ["#/data", "Data & Sources", "Download every score as CSV or the whole database, and inspect the legal evidence behind each score."],
     ["#/methodology", "Methodology", "The measurement framework, the scoring rules for both layers, and the limits of the index."]].forEach(function (x) {
      var a = link(x[0], "");
      a.className = "link-card";
      add(a, el("b", null, x[1]), el("span", null, x[2]));
      cards.appendChild(a);
    });
    w5.appendChild(cards);
    s5.appendChild(w5);
    app.appendChild(s5);
  }

  /* ========================================================== TAB 2: EXPLORE DATA */
  // The bar under the navigation: the three views, the controls of the current view, and the score scale.
  function exploreBar(active, tools) {
    var bar = el("div", "ctrlbar"), inn = el("div", "wrap ctrlbar-in"), l = el("div", "ctrl-left");
    var tabs = el("div", "seg sub-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Explore Data views");
    [["dejure", "De Jure"], ["defacto", "De Facto"], ["compare", "Compare"]].forEach(function (t) {
      var b = el("button", null, t[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", t[0] === active ? "true" : "false");
      b.addEventListener("click", function () { go(exploreHref(t[0])); });
      tabs.appendChild(b);
    });
    l.appendChild(tabs);
    (tools || []).forEach(function (n) { if (n) l.appendChild(n); });
    add(inn, l, scaleLegend(active === "dejure" ? "Pro-contestability obligations in law" : "Contestability score"));
    bar.appendChild(inn);
    return bar;
  }
  // Which data the reader is looking at: version and observation dates, with the citation one click away.
  function dataLine(extra) {
    var p = el("p", "dataline wrap");
    add(p, el("b", null, VERSION + " (preliminary)"), " · De Jure: law in force, " + DJ_DATE + " · De Facto: " + DF_BASE + " and " + DF_NOW + " · ");
    var c = el("button", "linkish", "Cite");
    c.type = "button";
    c.addEventListener("click", function (e) { e.stopPropagation(); openCite(); });
    c.classList.add("opens-panel");
    add(p, c, " · ", link("#/data/docs", "Version details"));
    if (extra) add(p, " · ", extra);
    return p;
  }
  function dimSelect(onChange, allLabel) {
    var sel = el("select", "pselect");
    sel.setAttribute("aria-label", "Dimension");
    sel.appendChild(new Option(allLabel || "All four dimensions", "overall", false, S.dim === "overall"));
    DIMS.forEach(function (d) { sel.appendChild(new Option(d + " " + DIM_SHORT[d], d, false, S.dim === d)); });
    sel.addEventListener("change", function () { S.dim = sel.value; onChange(); });
    return sel;
  }

  /* ---------------------------------------------------------- De Jure */
  function pageDeJure(app) {
    document.title = "Explore Data: De Jure · The Contestability Index";
    var viewSeg = segmented([["map", "Map"], ["rank", "Ranking"]], S.view, function (v) { S.view = v; drawStage(); sync(); }, "Map or ranking");
    app.appendChild(exploreBar("dejure", [viewSeg, compareTray()]));
    app.appendChild(dataLine());

    var grid = el("div", "explore-grid"), list = el("div", "dimlist"), pane = el("div", "rankpane");
    var dimButtons = {};
    function dimButton(k, label, q) {
      var b = el("button", null, label);
      b.type = "button";
      if (q) b.appendChild(el("span", "q", q));
      b.addEventListener("click", function () { S.dim = k; S.cat = null; drawAll(); sync(); });
      dimButtons[k] = b;
      return b;
    }
    list.appendChild(dimButton("overall", "Overall index score"));
    list.appendChild(el("div", "lab", "Explore by dimension"));
    DIMS.forEach(function (d, i) {
      var q = (D.paper.dimensionQuestions || {})[d];
      list.appendChild(dimButton(d, (i + 1) + " | " + dimById[d].name, q ? q.question : ""));
    });
    list.appendChild(add(el("div", "lab"), link("#/methodology/framework", "How the dimensions are defined →")));

    var stageHead = el("div"), stage = el("div", "stage"), matrixHead = el("div"), matrixHost = el("div");
    matrixHost.id = "matrix";
    add(pane, stageHead, stage, matrixHead, matrixHost);
    add(grid, list, pane);
    app.appendChild(grid);

    var world = null;
    function measure() { return S.dim === "overall" ? "the De Jure index" : S.dim + " " + dimById[S.dim].name; }
    function drawStage() {
      stageHead.textContent = "";
      stage.textContent = "";
      viewSeg.set(S.view);
      stageHead.appendChild(chartHead(
        (S.view === "map" ? "Map of " : "Jurisdictions ranked by ") + measure() + ", " + DJ_DATE,
        S.view === "map" ? "Hover over a jurisdiction for its scores, click to open its profile. Grey areas have not been assessed."
                         : "Click a jurisdiction to open its profile. “+ Compare” puts it into the comparison workspace.",
        [helpLink("#/methodology/" + (S.dim === "overall" ? "dejure" : S.dim), "How " + measure() + " is measured"),
         dlButton("contestability_dejure_" + S.dim + ".csv", CSV.dejureHeader, function () { return CSV.dejureRows(CODES, S.dim); })]));
      if (S.view === "map") {
        var ms = el("div", "map-stage");
        world = drawWorld({ interactive: true, keyRef: function () { return S.dim; } });
        ms.appendChild(world);
        stage.appendChild(ms);
        stage.appendChild(el("p", "small muted map-note", "Germany carries its own score; the other 26 EU member states carry the EU score."));
        // every jurisdiction with its score: a second way to its profile, and the Compare action
        var chips = el("div", "jur-chips");
        rankedBy(S.dim).forEach(function (c) {
          var v = val(c, S.dim), box = el("div", "jur-chip"), a = link("#/jurisdiction/" + c, "");
          add(a, paint(el("span", "sw", num(v)), v), el("span", "nm", jurName[c]));
          withTip(a, function () { return hoverCard(c, S.dim); }, true);
          add(box, a, compareToggle(c));
          chips.appendChild(box);
        });
        stage.appendChild(chips);
      } else {
        world = null;
        stage.appendChild(rankingList(S.dim, { compare: true }));
      }
    }
    function drawMatrix() {
      matrixHead.textContent = "";
      matrixHost.textContent = "";
      matrixHead.appendChild(chartHead("Every De Jure score: " + nM + " obligation categories × " + nJ + " jurisdictions",
        "Overall and dimension scores are the shaded rows. Click a category score for its three components and the legal justification. " +
        "Columns are ordered by " + measure() + ".",
        [helpLink("#/methodology/dejure", "How a De Jure score is built"),
         dlButton("contestability_dejure_all_scores.csv", CSV.dejureHeader, function () { return CSV.dejureRows(CODES, "overall"); })]));
      matrixHost.appendChild(categoryMatrix(rankedBy(S.dim), { dim: S.dim === "overall" ? null : S.dim, cat: S.cat }));
    }
    function drawAll() {
      Object.keys(dimButtons).forEach(function (x) { dimButtons[x].setAttribute("aria-pressed", x === S.dim ? "true" : "false"); });
      drawStage();
      drawMatrix();
    }
    function sync() { setAddress("/explore/dejure", ["view", "dim", "cat"]); }
    drawAll();
    sync();
    if (S.cat !== null) {
      var row = matrixHost.querySelector("tr.cat-on");
      if (row) setTimeout(function () { row.scrollIntoView({ block: "center" }); }, 60);
    }
  }

  /* ---------------------------------------------------------- De Facto */
  var PERIOD_LABEL = { baseline: DF_BASE, current: DF_NOW, change: "Change" };
  function pairChips(max, onChange) {
    var wrap = el("div", "pair-chips");
    UNITS.forEach(function (u) {
      var b = el("button", "chip pair");
      b.type = "button";
      var dot = el("i");
      dot.style.background = UNIT_COLOR[u];
      add(b, dot, unitById[u].name);
      function paintChip() { b.setAttribute("aria-pressed", S.units.indexOf(u) >= 0 ? "true" : "false"); }
      b.addEventListener("click", function () {
        var i = S.units.indexOf(u);
        if (i >= 0) { if (S.units.length > 1) S.units.splice(i, 1); }
        else if (S.units.length < (max || 3)) S.units = UNITS.filter(function (x) { return x === u || S.units.indexOf(x) >= 0; });
        Array.prototype.forEach.call(wrap.children, function (c) { c.repaint(); });
        onChange();
      });
      b.repaint = paintChip;
      paintChip();
      wrap.appendChild(b);
    });
    return wrap;
  }

  // One row group per measure (overall and the four dimensions), one mark per pair. A period draws bars; "change"
  // draws the earlier observation (hollow) joined to the later one (filled). Clicking a group selects its dimension.
  function pairDimChart(units, period, onPick) {
    var w = 760, lw = 196, bh = 13, gap = 3, gpad = 18, top = 22;
    var gh = units.length * (bh + gap) - gap, h = top + KEYS.length * (gh + gpad) + 4;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img",
                         "aria-label": "De Facto scores by dimension for the selected pairs, " + (period === "change" ? DF_BASE + " to " + DF_NOW : PERIOD_LABEL[period]) });
    function X(v) { return lw + v * (w - lw - 96); }
    xGrid(s, X, top - 4, h - 4, true);
    KEYS.forEach(function (k, gi) {
      var y0 = top + gi * (gh + gpad) + gpad / 2;
      var lab = stext({ x: lw - 10, y: y0 + gh / 2 + 4, "text-anchor": "end", class: "lab" + (onPick ? " pick" : "") + (S.dim === k ? " on" : "") }, keyShort(k));
      if (onPick) { lab.addEventListener("click", function () { onPick(k); }); lab.setAttribute("tabindex", "0"); lab.setAttribute("role", "button"); }
      s.appendChild(lab);
      units.forEach(function (u, i) {
        var a = mVal("de_facto", u, "baseline", k), b = mVal("de_facto", u, "current", k), y = y0 + i * (bh + gap), col = UNIT_COLOR[u];
        var x = mIdx("de_facto", u, "current"), dm = k === "overall" ? null : x && x.dims[k];
        var cover = k === "overall" ? (x ? scoredOf(x) + " indicators scored" : "") : (dm ? scoredOf(dm) + " indicators scored" : "");
        if (period === "change") {
          if (a === null || b === null) { s.appendChild(stext({ x: X(0) + 6, y: y + bh - 2 }, "no score")); return; }
          var cy = y + bh / 2;
          s.appendChild(svg("line", { x1: X(a), x2: X(b), y1: cy, y2: cy, stroke: col, "stroke-width": 3, "stroke-linecap": "round" }));
          s.appendChild(svg("circle", { cx: X(a), cy: cy, r: 5, fill: "#fff", stroke: col, "stroke-width": 2 }));
          s.appendChild(svg("circle", { cx: X(b), cy: cy, r: 5, fill: col, stroke: "#fff", "stroke-width": 1.5 }));
          s.appendChild(stext({ x: Math.max(X(a), X(b)) + 10, y: y + bh - 2, class: "val" }, num(a) + " → " + num(b) + " (" + (b - a >= 0 ? "+" : "") + num(b - a) + ")"));
        } else {
          var v = period === "baseline" ? a : b;
          if (v === null) { s.appendChild(stext({ x: X(0) + 6, y: y + bh - 2 }, "no score")); return; }
          var bar = barPath(X(0), y, X(v) - X(0), bh);
          if (bar) { bar.setAttribute("fill", col); s.appendChild(bar); }
          s.appendChild(stext({ x: X(v) + 5, y: y + bh - 2, class: "val" }, num(v)));
        }
        var hit = tipRect(s, X(0), y - 1, w - X(0), bh + 2, function () {
          return [unitById[u].name + " · " + keyName(k), DF_BASE + ": " + num(a) + " · " + DF_NOW + ": " + num(b), cover, "Click for the indicators"].filter(Boolean);
        });
        hit.style.cursor = "pointer";
        hit.addEventListener("click", function () { if (onPick) onPick(k, u); });
      });
    });
    return s;
  }

  // The drill-down: one row per indicator, one column per pair. A cell shows the score of the chosen period, or
  // both observations when the change is shown. Missing and Not Applicable are drawn as such, never as zeros.
  function indicatorCell(u, it, period) {
    var m = mechById[it.mechanism], scored = it.status === "scored", conf = CONF[it.confidence] || null;
    var b = el("button", "ind opens-panel" + (scored ? (period === "change" ? "" : " one") : it.status === "missing" ? " miss" : " na"));
    b.type = "button";
    if (scored) {
      if (period === "change") add(b, paint(el("span", "h", glyph(it.pre)), it.pre), paint(el("span", "h", glyph(it.post)), it.post));
      else { var v = period === "baseline" ? it.pre : it.post; b.appendChild(paint(el("span", "h", glyph(v)), v)); }
      if (conf) { var cb = el("span", "conf"); cb.style.width = conf[0] + "%"; b.appendChild(cb); }
    } else b.textContent = it.status === "missing" ? "M" : "n/a";
    var what = scored ? DF_BASE + " " + glyph(it.pre) + " → " + DF_NOW + " " + glyph(it.post)
      : it.status === "missing" ? "Missing: too little evidence to score" : "Not applicable in this market";
    b.setAttribute("aria-label", m.code + " " + m.indicator + ", " + unitById[u].name + ". " + what +
      (scored && conf ? ", confidence " + conf[1] : "") + ". Opens the rationale and the evidence.");
    withTip(b, function () {
      return [unitById[u].name + " · " + m.code + " " + m.indicator, what, scored && conf ? "Confidence: " + conf[1] : "", "Click for the rationale, evidence and sources"].filter(Boolean);
    });
    b.addEventListener("click", function () { openIndicator(u, it.mechanism); });
    indButtons[u + "|" + it.mechanism] = b;
    var cell = el("span", "indcell");
    cell.appendChild(b);
    if (scored && period === "change") cell.appendChild(el("span", "code" + (it.delta > 0 ? " up" : ""), it.delta === 0 ? "=" : (it.delta > 0 ? "+" : "−") + glyph(Math.abs(it.delta))));
    return cell;
  }
  function indicatorTable(units, period, dim, cat) {
    indButtons = {};
    var wrap = el("div", "heat-wrap"), t = el("table", "heat indtable"), hr = el("tr");
    hr.appendChild(el("th", "corner", "De Facto indicator"));
    units.forEach(function (u) {
      var th = el("th", "pair-head"), dot = el("i");
      dot.style.background = UNIT_COLOR[u];
      add(th, dot, unitById[u].name);
      hr.appendChild(th);
    });
    t.appendChild(add(el("thead"), hr));
    var tb = el("tbody");
    D.dimensions.forEach(function (d) {
      if (dim && dim !== "overall" && dim !== d.id) return;
      var sep = el("tr", "dim-sep"), td = el("td");
      add(td, d.id + " · " + d.name + " ", link("#/methodology/" + d.id, "How it is measured"));
      td.colSpan = units.length + 1;
      sep.appendChild(td);
      tb.appendChild(sep);
      var agg = el("tr", "agg-row dim-row"), ath = el("th", "mech agg");
      ath.appendChild(el("span", null, "Dimension score"));
      agg.appendChild(ath);
      units.forEach(function (u) {
        var a = mVal("de_facto", u, "baseline", d.id), b = mVal("de_facto", u, "current", d.id), cell = el("td");
        var v = period === "baseline" ? a : b;
        if (period === "change") add(cell, el("span", "aggtext", num(a) + " → " + num(b)));
        else cell.appendChild(v === null ? el("span", "aggtext", "—") : paint(el("span", "aggcell wide", num(v)), v));
        agg.appendChild(cell);
      });
      tb.appendChild(agg);
      D.mechanisms.filter(function (m) { return m.dimension === d.id; }).forEach(function (m) {
        var tr = el("tr", cat === m.id ? "cat-on" : ""), th = el("th", "mech"), ml = link("#/methodology/" + m.code, "");
        add(ml, el("span", "n wide", m.code), m.indicator);
        ml.title = "Mechanism: " + m.description + " · How this indicator is scored";
        th.appendChild(ml);
        tr.appendChild(th);
        units.forEach(function (u) {
          var it = D.deFacto.items.filter(function (x) { return x.unit === u && x.mechanism === m.id; })[0], td2 = el("td");
          if (it) td2.appendChild(indicatorCell(u, it, period));
          tr.appendChild(td2);
        });
        tb.appendChild(tr);
      });
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }
  // How to read the cells; the meaning of each score is the Methodology Manual's own wording.
  function deFactoKey(period) {
    var scale = MAN.deFactoScale, key = el("div", "scale-list");
    if (period === "change") {
      var sample = el("span", "ind sample");
      add(sample, paint(el("span", "h", "0"), 0), paint(el("span", "h", "½"), 0.5));
      var cb = el("span", "conf");
      cb.style.width = "75%";
      sample.appendChild(cb);
      add(key, sample, el("span", null, "Left half: " + DF_BASE + ". Right half: " + DF_NOW + ". Line underneath: the coder's confidence, from low (short) to high (full width)."));
    } else {
      var one = el("span", "ind one sample");
      one.appendChild(paint(el("span", "h", "½"), 0.5));
      var cb2 = el("span", "conf");
      cb2.style.width = "75%";
      one.appendChild(cb2);
      add(key, one, el("span", null, "The score in " + PERIOD_LABEL[period] + ". Line underneath: the coder's confidence, from low (short) to high (full width)."));
    }
    [[0, "0", "No working path."], [0.5, "0.5", "A working path with friction."], [1, "1", "No gatekeeper-imposed friction."]].forEach(function (x) {
      add(key, paint(el("span", "pill-inline", glyph(x[0])), x[0]), el("span", null, scale && scale[x[1]] ? scale[x[1]] : x[2]));
    });
    add(key, el("span", "ind miss sample", "M"), el("span", null, "Missing. " + (scale && scale.Missing ? scale.Missing : "Left out of the index.")),
        el("span", "ind na sample", "n/a"), el("span", null, "Not applicable. " + (scale && scale["Not Applicable"] ? scale["Not Applicable"] : "Left out of the index.")));
    var box = el("div");
    box.appendChild(key);
    if (scale) box.appendChild(add(el("p", "small muted"), "Score definitions: " + MANSRC + ", section " + scale.section + ". ", link("#/methodology/defacto", "De Facto scoring rules →")));
    return box;
  }

  function pairCard(u, period) {
    var unit = unitById[u], pre = mIdx("de_facto", u, "baseline"), post = mIdx("de_facto", u, "current"), e = effOf(u, "current");
    var items = D.deFacto.items.filter(function (x) { return x.unit === u; });
    function count(st) { return items.filter(function (x) { return x.status === st; }).length; }
    var card = el("div", "mcard"), h = el("h3"), dot = el("i");
    dot.style.background = UNIT_COLOR[u];
    add(h, dot, unit.name);
    card.appendChild(el("p", "sec-kicker", "Market: " + unit.market));
    card.appendChild(h);
    card.appendChild(el("p", "small muted", [unit.gatekeeper, unitPlace(u), unit.designationDate ? "designated " + day(unit.designationDate) : ""].filter(Boolean).join(" · ")));
    var big = el("div", "mbig"), a = pre ? pre.index : null, b = post ? post.index : null;
    if (period === "change") add(big, el("b", null, num(a) + " → " + num(b)), el("span", null, "De Facto index, " + DF_BASE + " → " + DF_NOW + " (" + (b - a >= 0 ? "+" : "") + num(b - a) + ")"));
    else add(big, el("b", null, num(period === "baseline" ? a : b)), el("span", null, "De Facto index, " + PERIOD_LABEL[period]));
    card.appendChild(big);
    var facts = el("div", "mfacts");
    [["Indicators scored", scoredOf(post)], ["Missing (not zero)", String(count("missing"))],
     ["Not applicable (not zero)", String(count("not_applicable"))], ["De Jure, market level, " + DJ_DATE, e ? num(e.deJure) : "—"],
     ["Gap, De Jure minus De Facto", e ? num(e.gap) : "—"]].forEach(function (x) { add(facts, el("span", null, x[0]), el("b", null, x[1])); });
    card.appendChild(facts);
    card.appendChild(add(el("p", "small card-links"), link("#/explore/compare?type=gap&unit=" + u, "Law against market for this pair →")));
    return card;
  }

  function pageDeFacto(app) {
    document.title = "Explore Data: De Facto · The Contestability Index";
    var perSeg = segmented([["baseline", DF_BASE], ["current", DF_NOW], ["change", "Change"]], S.period, function (v) { S.period = v; draw(); }, "Observation period");
    var dsel = dimSelect(function () { S.cat = null; draw(); });
    app.appendChild(exploreBar("defacto", [perSeg, dsel]));
    app.appendChild(dataLine());
    var s = section(null, "defacto"), w = el("div", "wrap");
    head(w, "De Facto", "What is observed in " + words(nU) + " gatekeeper–market pairs",
      add(el("p", "sec-intro"), "Market-level observations for " + listText(UNITS.map(function (u) { return unitById[u].name + " (" + unitPlace(u) + ")"; })) +
          ", in " + DF_BASE + " and " + DF_NOW + ". ", link("#/methodology/limits", "Coverage and limits →")));
    var tools = el("div", "toolbar"), pc = pairChips(3, function () { draw(); });
    var cmp = link("#/explore/compare?type=mkt", "Compare these pairs →");
    cmp.className = "btn btn-outline";
    cmp.addEventListener("click", function () { S.cmp = "mkt"; });
    add(tools, add(el("div", "ctrl-left"), el("span", "small muted", "Pairs shown:"), pc), cmp);
    w.appendChild(tools);
    var body = el("div");
    w.appendChild(body);
    s.appendChild(w);
    app.appendChild(s);

    function draw() {
      perSeg.set(S.period);
      dsel.value = S.dim;
      body.textContent = "";
      var grid = el("div", "mgrid n" + S.units.length);
      S.units.forEach(function (u) { grid.appendChild(pairCard(u, S.period)); });
      body.appendChild(grid);

      body.appendChild(chartHead("By dimension, " + (S.period === "change" ? DF_BASE + " to " + DF_NOW : PERIOD_LABEL[S.period]),
        S.period === "change" ? "Hollow: " + DF_BASE + ". Filled: " + DF_NOW + ". Click a dimension to see its indicators."
                              : "One bar per pair. Click a dimension to see its indicators.",
        [helpLink("#/methodology/defacto", "How a De Facto score is built"),
         dlButton("contestability_defacto_indices.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[0] === "de_facto" && S.units.indexOf(r[2]) >= 0; }); })]));
      body.appendChild(seriesKey(S.units.map(function (u) { return { label: unitById[u].name, color: UNIT_COLOR[u], shape: S.period === "change" ? "" : "sq" }; })));
      body.appendChild(pairDimChart(S.units, S.period, function (k) {
        S.dim = k; S.cat = null; draw();
        var t = body.querySelector(".indtable");
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      }));

      body.appendChild(chartHead("Indicator by indicator" + (S.dim === "overall" ? "" : ": " + S.dim + " " + dimById[S.dim].name),
        "Click a cell for its status, the scoring rationale, the supporting evidence with its sources, and the confidence.",
        [helpLink("#/methodology/defacto", "How an indicator is scored"),
         dlButton("contestability_defacto_indicators.csv", CSV.defactoHeader, function () { return CSV.defactoRows(S.units, S.dim); })]));
      body.appendChild(deFactoKey(S.period));
      body.appendChild(indicatorTable(S.units, S.period, S.dim, S.cat));
      setAddress("/explore/defacto", ["period", "dim", "units", "cat"]);
    }
    draw();
    if (S.cat !== null) {
      var row = body.querySelector("tr.cat-on");
      if (row) setTimeout(function () { row.scrollIntoView({ block: "center" }); }, 60);
    }
  }

  /* ---------------------------------------------------------- Compare */
  // Colours stay with the jurisdiction while the selection changes: each takes the first free slot.
  var JUR_SLOT = {};
  function slotOf(code) {
    Object.keys(JUR_SLOT).forEach(function (c) { if (S.jurs.indexOf(c) < 0) delete JUR_SLOT[c]; });
    if (JUR_SLOT[code] === undefined) {
      var used = Object.keys(JUR_SLOT).map(function (c) { return JUR_SLOT[c]; });
      JUR_SLOT[code] = SERIES.map(function (x, k) { return k; }).filter(function (k) { return used.indexOf(k) < 0; })[0];
    }
    return JUR_SLOT[code];
  }
  function jurColor(code) { return SERIES[slotOf(code)]; }

  function cmpJurisdictions(host, redraw) {
    var chips = el("div", "chips");
    rankedBy("overall").forEach(function (c) {
      var on = S.jurs.indexOf(c) >= 0, b = el("button", "chip pair");
      b.type = "button";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) { var dot = el("i"); dot.style.background = jurColor(c); b.appendChild(dot); }
      b.appendChild(document.createTextNode(jurName[c]));
      b.addEventListener("click", function () {
        var i = S.jurs.indexOf(c);
        if (i >= 0) S.jurs.splice(i, 1); else S.jurs.push(c);
        redraw();
      });
      chips.appendChild(b);
    });
    host.appendChild(add(el("div", "toolbar"), add(el("div", "ctrl-left"), el("span", "small muted", "Jurisdictions (two or more):"), chips)));
    var sel = S.jurs.slice();
    if (sel.length < 2) { host.appendChild(el("p", "muted", "Pick at least two jurisdictions.")); return; }
    var key = seriesKey(sel.map(function (c) { return { label: jurName[c], color: jurColor(c), shape: "sq" }; }));

    /* grouped bars: overall and the four dimensions */
    host.appendChild(chartHead("Overall index and the four dimensions", "De Jure, " + DJ_DATE + ". Click a bar to open that jurisdiction's profile at that dimension.",
      [helpLink("#/methodology/dejure", "How the scores are built"),
       dlButton("contestability_compare_jurisdictions.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[1] === "jurisdiction" && sel.indexOf(r[2]) >= 0; }); })]));
    host.appendChild(key);
    var w = 760, lw = 196, bh = 14, gap = 2, gpad = 18, top = 22;
    var gh = sel.length * (bh + gap) - gap, h = top + KEYS.length * (gh + gpad) + 4;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img", "aria-label": "Grouped bars by dimension for the selected jurisdictions" });
    function X(v) { return lw + v * (w - lw - 50); }
    xGrid(s, X, top - 4, h - 4, true);
    KEYS.forEach(function (k, gi) {
      var y0 = top + gi * (gh + gpad) + gpad / 2;
      s.appendChild(stext({ x: lw - 10, y: y0 + gh / 2 + 4, "text-anchor": "end", class: "lab" }, keyShort(k)));
      sel.forEach(function (c, i) {
        var v = val(c, k), y = y0 + i * (bh + gap);
        var b = barPath(X(0), y, X(v) - X(0), bh);
        if (b) { b.setAttribute("fill", jurColor(c)); s.appendChild(b); }
        s.appendChild(stext({ x: X(v) + 5, y: y + bh - 3, class: "val" }, num(v)));
        var hit = tipRect(s, X(0), y, w - X(0), bh, function () { return [jurName[c], keyName(k) + ": " + num(v) + " (rank " + rankOf(c, k) + " of " + nJ + ")", "Click for the profile"]; });
        hit.style.cursor = "pointer";
        hit.addEventListener("click", function () { go("#/jurisdiction/" + c + (k === "overall" ? "" : "?dim=" + k)); });
      });
    });
    host.appendChild(s);

    /* dimension charts: where the selected stand among all the jurisdictions */
    host.appendChild(chartHead("Each dimension among all " + words(nJ) + " jurisdictions", "Coloured: the selected jurisdictions. Grey: the others. Click a dot for the profile.",
      [dlButton("contestability_dejure_all_jurisdictions.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[1] === "jurisdiction"; }); })]));
    var w2 = 760, lw2 = 196, x0 = lw2 + 10, x1 = w2 - 30, rh = 44, top2 = 22, h2 = top2 + KEYS.length * rh + 4;
    var s2 = svg("svg", { viewBox: "0 0 " + w2 + " " + h2, class: "chart", role: "img", "aria-label": "Position of the selected jurisdictions on each dimension" });
    function X2(v) { return x0 + v * (x1 - x0); }
    xGrid(s2, X2, top2 - 4, h2 - 4, true);
    KEYS.forEach(function (k, i) {
      var y = top2 + i * rh + rh / 2;
      s2.appendChild(stext({ x: lw2 - 4, y: y + 4, "text-anchor": "end", class: "lab" }, keyShort(k)));
      s2.appendChild(svg("line", { x1: x0, x2: x1, y1: y, y2: y, class: "grid" }));
      CODES.filter(function (c) { return sel.indexOf(c) < 0; }).forEach(function (c) {
        var dot = svg("circle", { cx: X2(val(c, k)), cy: y, r: 5, fill: "#c9c9ce", stroke: "#fff", "stroke-width": 1.5 });
        withTip(dot, function () { return [jurName[c] + ": " + num(val(c, k))]; });
        dot.style.cursor = "pointer";
        dot.addEventListener("click", function () { go("#/jurisdiction/" + c + (k === "overall" ? "" : "?dim=" + k)); });
        s2.appendChild(dot);
      });
      // selected jurisdictions with the same value sit side by side, so none hides another
      var groups = {};
      sel.forEach(function (c) { var g = num(val(c, k)); (groups[g] = groups[g] || []).push(c); });
      Object.keys(groups).forEach(function (g) {
        groups[g].forEach(function (c, j) {
          var off = (j - (groups[g].length - 1) / 2) * (groups[g].length > 3 ? 6 : 11);
          var dot = svg("circle", { cx: X2(val(c, k)), cy: y + off, r: 6.5, fill: jurColor(c), stroke: "#fff", "stroke-width": 2 });
          withTip(dot, function () { return [jurName[c] + " · " + keyName(k) + ": " + num(val(c, k)), "Rank " + rankOf(c, k) + " of " + nJ]; });
          dot.style.cursor = "pointer";
          dot.addEventListener("click", function () { go("#/jurisdiction/" + c + (k === "overall" ? "" : "?dim=" + k)); });
          s2.appendChild(dot);
        });
      });
    });
    host.appendChild(s2);

    /* category matrix for the selection */
    host.appendChild(chartHead("Category by category", "Click a score for its three components and the legal justification.",
      [helpLink("#/methodology/framework", "The sixteen obligation categories"),
       dlButton("contestability_compare_categories.csv", CSV.dejureHeader, function () { return CSV.dejureRows(sel, "overall"); })]));
    host.appendChild(categoryMatrix(sel));
  }

  function cmpMarkets(host, redraw) {
    host.appendChild(add(el("div", "toolbar"), add(el("div", "ctrl-left"), el("span", "small muted", "Gatekeeper–market pairs (two or three):"), pairChips(3, redraw))));
    var sel = S.units.slice();
    host.appendChild(el("p", "small muted", DF_BASE + " is before the Digital Markets Act's obligations applied (March 2024); " + DF_NOW + " is the latest observation."));
    host.appendChild(chartHead("Before and after: De Facto index and dimensions", "Hollow: " + DF_BASE + ". Filled: " + DF_NOW + ". Click a row for its indicators.",
      [helpLink("#/methodology/defacto", "How a De Facto score is built"),
       dlButton("contestability_compare_markets.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[0] === "de_facto" && sel.indexOf(r[2]) >= 0; }); })]));
    host.appendChild(seriesKey(sel.map(function (u) { return { label: unitById[u].name, color: UNIT_COLOR[u] }; })));
    host.appendChild(pairDimChart(sel, "change", function (k, u) {
      S.dim = k; S.period = "change";
      if (u) S.units = S.units.indexOf(u) >= 0 ? S.units : S.units.concat([u]);
      go(exploreHref("defacto"));
    }));
    host.appendChild(chartHead("Mechanism comparison", "The same sixteen indicators for each pair, " + DF_BASE + " and " + DF_NOW + ". Click a cell for the rationale and the evidence.",
      [helpLink("#/methodology/framework", "The sixteen mechanisms"),
       dlButton("contestability_compare_market_indicators.csv", CSV.defactoHeader, function () { return CSV.defactoRows(sel, "overall"); })]));
    host.appendChild(deFactoKey("change"));
    host.appendChild(indicatorTable(sel, "change", "overall", S.cat));
  }

  // Law and market for the same mechanism: the market-level De Jure score (square) above the two De Facto
  // observations (circles), for one pair. A row opens the evidence and the legal record for that mechanism.
  function mechGapChart(u) {
    var w = 760, lw = 330, x0 = lw + 20, x1 = w - 150, rh = 30, top = 26, rows = [];
    D.dimensions.forEach(function (d) {
      rows.push({ dim: d });
      D.mechanisms.filter(function (m) { return m.dimension === d.id; }).forEach(function (m) { rows.push({ m: m }); });
    });
    var h = top + rows.length * rh + 6;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img",
                         "aria-label": "Law and market, mechanism by mechanism, for " + unitById[u].name });
    function X(v) { return x0 + v * (x1 - x0); }
    [0, 0.5, 1].forEach(function (g) {
      s.appendChild(svg("line", { x1: X(g), x2: X(g), y1: top - 6, y2: h - 4, class: g === 0 ? "axis" : "grid" }));
      s.appendChild(stext({ x: X(g), y: top - 12, "text-anchor": "middle" }, g === 0.5 ? "½" : String(g)));
    });
    var col = UNIT_COLOR[u];
    rows.forEach(function (r, i) {
      var y = top + i * rh + rh / 2;
      if (r.dim) { s.appendChild(stext({ x: 0, y: y + 5, class: "ttl" }, r.dim.id + " · " + r.dim.name)); return; }
      var m = r.m, it = D.deFacto.items.filter(function (x) { return x.unit === u && x.mechanism === m.id; })[0];
      var dj = D.markets.deJure.filter(function (x) { return x.unit === u && x.mechanism === m.id && x.period === "current"; })[0];
      if (S.cat === m.id) s.appendChild(svg("rect", { x: 0, y: y - rh / 2, width: w, height: rh, fill: "#edf1f8" }));
      s.appendChild(stext({ x: 14, y: y + 4, class: "lab" }, m.id + ". " + m.name));
      s.appendChild(svg("line", { x1: X(0), x2: X(1), y1: y, y2: y, class: "grid" }));
      if (dj) s.appendChild(svg("rect", { x: X(dj.score) - 5, y: y - 12, width: 10, height: 10, rx: 1, fill: LAW, stroke: "#fff", "stroke-width": 1.5 }));
      var note = "";
      if (it && it.status === "scored") {
        if (it.pre !== it.post) s.appendChild(svg("line", { x1: X(it.pre), x2: X(it.post), y1: y + 7, y2: y + 7, stroke: col, "stroke-width": 2 }));
        s.appendChild(svg("circle", { cx: X(it.pre), cy: y + 7, r: 4.5, fill: "#fff", stroke: col, "stroke-width": 2 }));
        s.appendChild(svg("circle", { cx: X(it.post), cy: y + 7, r: 4.5, fill: col, stroke: "#fff", "stroke-width": 1.5 }));
        note = dj ? "gap " + num(dj.score - it.post, 1) : "";
      } else if (it) note = it.status === "missing" ? "Missing (not scored)" : "Not applicable";
      s.appendChild(stext({ x: x1 + 16, y: y + 4, class: it && it.status === "scored" ? "val" : "" }, note));
      var hit = tipRect(s, 0, y - rh / 2, w, rh, function () {
        return [unitById[u].name + " · " + m.id + ". " + m.name,
                "Law (market level, " + DJ_DATE + "): " + (dj ? glyph(dj.score) : "—"),
                "Market (" + m.code + " " + m.indicator + "): " + (it && it.status === "scored" ? glyph(it.pre) + " (" + DF_BASE + ") → " + glyph(it.post) + " (" + DF_NOW + ")"
                  : it && it.status === "missing" ? "Missing" : "Not applicable"),
                "Click for the evidence and the legal record"];
      });
      hit.style.cursor = "pointer";
      hit.classList.add("opens-panel");
      hit.addEventListener("click", function () { openIndicator(u, m.id); });
    });
    return s;
  }
  // Paired bars: for each pair (or each measure of one pair) the De Jure score and the De Facto score, with the gap.
  function pairedBars(groups) {
    var w = 760, lw = 250, bh = 15, gap = 3, gpad = 20, top = 22, gh = 2 * bh + gap, h = top + groups.length * (gh + gpad) + 4;
    var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "chart", role: "img", "aria-label": "De Jure and De Facto side by side, with the gap between them" });
    function X(v) { return lw + v * (w - lw - 150); }
    xGrid(s, X, top - 4, h - 4, true);
    groups.forEach(function (g, gi) {
      var y0 = top + gi * (gh + gpad) + gpad / 2;
      var dj = mVal("de_jure", g.u, "current", g.k), df = mVal("de_facto", g.u, "current", g.k), dfa = mVal("de_facto", g.u, "baseline", g.k);
      s.appendChild(stext({ x: lw - 10, y: y0 + gh / 2 + 4, "text-anchor": "end", class: "lab" }, g.label));
      [[dj, LAW, "De Jure, market level, " + DJ_DATE], [df, UNIT_COLOR[g.u], "De Facto, " + DF_NOW]].forEach(function (b, i) {
        if (b[0] === null) return;
        var y = y0 + i * (bh + gap), bar = barPath(X(0), y, X(b[0]) - X(0), bh);
        if (bar) { bar.setAttribute("fill", b[1]); s.appendChild(bar); }
        s.appendChild(stext({ x: X(b[0]) + 5, y: y + bh - 3, class: "val" }, num(b[0])));
      });
      if (dfa !== null) s.appendChild(svg("line", { x1: X(dfa), x2: X(dfa), y1: y0 + bh + gap - 2, y2: y0 + gh + 2, stroke: "#111", "stroke-width": 2 }));
      if (dj !== null && df !== null) s.appendChild(stext({ x: w - 4, y: y0 + gh / 2 + 4, "text-anchor": "end", class: "ttl" }, "gap " + num(dj - df)));
      var hit = tipRect(s, 0, y0 - 4, w, gh + 8, function () {
        return [unitById[g.u].name + " · " + keyName(g.k), "De Jure (market level, " + DJ_DATE + "): " + num(dj),
                "De Facto: " + num(dfa) + " (" + DF_BASE + ") → " + num(df) + " (" + DF_NOW + ")", "Gap, De Jure minus De Facto: " + (dj !== null && df !== null ? num(dj - df) : "—"),
                g.click ? "Click for the breakdown" : ""].filter(Boolean);
      });
      if (g.click) { hit.style.cursor = "pointer"; hit.addEventListener("click", g.click); }
    });
    return s;
  }

  function cmpGap(host, redraw) {
    var opts = [["all", "All three pairs"]].concat(UNITS.map(function (u) { return [u, unitById[u].name]; }));
    var seg = segmented(opts, S.unit, function (v) { S.unit = v; redraw(); }, "Gatekeeper–market pair");
    host.appendChild(add(el("div", "toolbar"), add(el("div", "ctrl-left"), el("span", "small muted", "Matched assessments:"), seg)));
    host.appendChild(add(el("p", "small muted"), "A matched assessment is the De Jure score measured again at market level, for the obligations that bind that market, beside the De Facto score " +
      "of the same market. ", link("#/methodology/limits", "How to read it →")));
    var units = S.unit === "all" ? UNITS : [S.unit];
    var keyItems = [{ label: "De Jure, market level, " + DJ_DATE, color: LAW, shape: "sq" }];
    units.forEach(function (u) { keyItems.push({ label: "De Facto, " + unitById[u].name + ", " + DF_NOW, color: UNIT_COLOR[u], shape: "sq" }); });
    keyItems.push({ label: "De Facto, " + DF_BASE + " (tick)", color: "#111", shape: "line" });

    var groups = [];
    if (S.unit === "all") UNITS.forEach(function (u) { groups.push({ u: u, k: "overall", label: unitById[u].name, click: function () { S.unit = u; redraw(); } }); });
    else KEYS.forEach(function (k) {
      groups.push({ u: S.unit, k: k, label: keyShort(k), click: function () { var c = host.querySelector(".mech-gap"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); } });
    });
    host.appendChild(chartHead(S.unit === "all" ? "Law against market: the three pairs" : "Law against market: " + unitById[S.unit].name + ", overall and by dimension",
      S.unit === "all" ? "The gap is De Jure minus De Facto. Click a pair for its breakdown." : "The gap is De Jure minus De Facto. Click a row for the mechanisms behind it.",
      [helpLink("#/methodology/limits", "How to read the gap"),
       dlButton("contestability_law_vs_market.csv", CSV.gapHeader, function () { return CSV.gapRows().filter(function (r) { return units.indexOf(r[0]) >= 0; }); })]));
    host.appendChild(seriesKey(keyItems));
    host.appendChild(pairedBars(groups));

    /* gap breakdown by dimension, as a table whose cells lead on */
    host.appendChild(chartHead("Gap breakdown by dimension", "De Jure minus De Facto, " + DF_NOW + ". Click a figure for the mechanisms behind it.",
      [dlButton("contestability_gap_by_dimension.csv", ["unit_id", "pair", "measure", "de_jure_market_level", "de_facto", "gap_de_jure_minus_de_facto"], function () {
        var out = [];
        units.forEach(function (u) { KEYS.forEach(function (k) {
          var a = mVal("de_jure", u, "current", k), b = mVal("de_facto", u, "current", k);
          out.push([u, unitById[u].name, k, a, b, a !== null && b !== null ? a - b : ""]);
        }); });
        return out;
      })]));
    var t = el("table", "plain gap-table"), hr = el("tr");
    ["Pair", "Overall"].concat(DIMS.map(function (d) { return d + " " + DIM_SHORT[d]; })).forEach(function (x, i) { hr.appendChild(el("th", i ? "num" : null, x)); });
    t.appendChild(hr);
    units.forEach(function (u) {
      var tr = el("tr"), td0 = el("td"), dot = el("i", "dot");
      dot.style.background = UNIT_COLOR[u];
      add(td0, dot, unitById[u].name);
      tr.appendChild(td0);
      KEYS.forEach(function (k) {
        var dj = mVal("de_jure", u, "current", k), df = mVal("de_facto", u, "current", k), td = el("td", "num");
        if (dj === null || df === null) td.textContent = "—";
        else {
          var b = el("button", "linkish", num(dj - df));
          b.type = "button";
          b.title = "De Jure " + num(dj) + " minus De Facto " + num(df);
          b.addEventListener("click", function () { S.unit = u; redraw(); var c = host.querySelector(".mech-gap"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); });
          td.appendChild(b);
        }
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
    host.appendChild(add(el("div", "table-scroll"), t));

    /* gap breakdown by mechanism */
    var mg = el("div", "mech-gap");
    if (S.unit === "all") {
      mg.appendChild(chartHead("Gap breakdown by mechanism", "Pick one pair above to see law and market for each of the sixteen mechanisms."));
      var pick = el("div", "chips");
      UNITS.forEach(function (u) {
        var b = el("button", "chip pair"), dot = el("i");
        b.type = "button";
        dot.style.background = UNIT_COLOR[u];
        add(b, dot, unitById[u].name);
        b.addEventListener("click", function () { S.unit = u; redraw(); });
        pick.appendChild(b);
      });
      mg.appendChild(pick);
    } else {
      mg.appendChild(chartHead("Gap breakdown by mechanism: " + unitById[S.unit].name,
        "Square: the law for this market, " + DJ_DATE + ". Circles: the market, " + DF_BASE + " (hollow) and " + DF_NOW + " (filled). Click a row for the evidence and the legal record.",
        [helpLink("#/methodology/framework", "The sixteen mechanisms"),
         dlButton("contestability_law_vs_market_mechanisms.csv",
           ["record_id_law", "record_id_market", "unit_id", "pair", "dimension", "category_code", "category", "indicator", "de_jure_market_" + (D.periods["de_jure|market|current"] || {}).observed,
            "de_facto_status", "de_facto_" + (D.periods["de_facto|market|baseline"] || {}).observed, "de_facto_" + (D.periods["de_facto|market|current"] || {}).observed, "gap"],
           function () {
             var u = S.unit;
             return D.mechanisms.map(function (m) {
               var it = D.deFacto.items.filter(function (x) { return x.unit === u && x.mechanism === m.id; })[0];
               var dj = D.markets.deJure.filter(function (x) { return x.unit === u && x.mechanism === m.id && x.period === "current"; })[0];
               var sc = it && it.status === "scored";
               return [recordId("djm", u, m, "current"), recordId("df", u, m, "current"), u, unitById[u].name, m.dimension, m.code, m.name, m.indicator, dj ? dj.score : "",
                       it ? it.status : "", sc ? it.pre : "", sc ? it.post : "", sc && dj ? dj.score - it.post : ""];
             });
           })]));
      mg.appendChild(mechGapChart(S.unit));
    }
    host.appendChild(mg);
  }

  function pageCompare(app) {
    document.title = "Explore Data: Compare · The Contestability Index";
    var typeSeg = segmented([["jur", "Jurisdictions"], ["mkt", "Markets"], ["gap", "De Jure vs. De Facto"]], S.cmp, function (v) { S.cmp = v; draw(); }, "Comparison type");
    app.appendChild(exploreBar("compare", [typeSeg]));
    app.appendChild(dataLine());
    var s = section(null, "compare"), w = el("div", "wrap");
    var TITLES = { jur: ["Jurisdiction comparison", "Two or more jurisdictions, on the law"],
                   mkt: ["Market comparison", "Two or three gatekeeper–market pairs, before and after"],
                   gap: ["De Jure vs. De Facto", "Matched legal and market assessments"] };
    var hd = el("div"), body = el("div");
    add(w, hd, body);
    s.appendChild(w);
    app.appendChild(s);
    function draw() {
      typeSeg.set(S.cmp);
      if (S.cmp === "mkt" && S.units.length < 2) S.units = UNITS.slice();
      hd.textContent = "";
      body.textContent = "";
      head(hd, "Compare", TITLES[S.cmp][0], TITLES[S.cmp][1] + ". Every mark leads to its detailed score and evidence; the selection is kept when you move to another view.");
      ({ jur: cmpJurisdictions, mkt: cmpMarkets, gap: cmpGap })[S.cmp](body, draw);
      setAddress("/explore/compare", S.cmp === "jur" ? ["type", "j"] : S.cmp === "mkt" ? ["type", "units"] : ["type", "unit", "cat"]);
      syncCompare();
    }
    draw();
    if (S.cmp === "gap" && S.cat !== null && S.unit !== "all") {
      var c = body.querySelector(".mech-gap");
      if (c) setTimeout(function () { c.scrollIntoView({ block: "start" }); }, 60);
    }
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

  function pageJurisdiction(app, code, arg) {
    var j = jurByCode[code], a = D.aggregates[code], v = a.overall, n = counts(code), mf = mainForm(code);
    document.title = j.name + " · The Contestability Index";
    var back = link(exploreHref("dejure"), "← Explore Data"), cmpB = el("button", "btn btn-outline", "Compare " + j.name + " with others →");
    back.className = "btn btn-outline";
    cmpB.type = "button";
    cmpB.addEventListener("click", function () {
      if (S.jurs.indexOf(code) < 0) S.jurs.push(code);
      S.cmp = "jur";
      go(exploreHref("compare"));
    });
    app.appendChild(ctrlBar([back, jurSelect(code), cmpB]));
    app.appendChild(dataLine());
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
    ov.appendChild(add(el("p", "chart-foot top"), dlButton("contestability_dejure_" + code + ".csv", CSV.dejureHeader, function () { return CSV.dejureRows([code], "overall"); },
      "Download " + j.name + "'s scores (CSV)")));
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
      cw.appendChild(aiP(["This jurisdiction differs from the published working paper (" + disc.detail.join("; ") + "). " + disc.why + " ",
                          link("#/data/docs", "All differences →")]));
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
      add(hd, el("h3", null, "Dimension " + (i + 1) + " | " + dimById[d].name), link("#/methodology/" + d, "How it is measured"));
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
        var nm = link("#/methodology/" + m.code, m.name);
        nm.title = "How this category is scored";
        row.appendChild(add(el("span"), nm));
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
      lm.appendChild(add(el("p", "small"), link("#/explore/defacto", "Open the De Facto view →"), " · ", link("#/explore/compare?type=gap", "Law against market, mechanism by mechanism →")));
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
                       link("#/legal/" + code, "Open the legal record of " + theName(code) + " →"), " · ",
                       link("#/data/library?j=" + code, "Search them in the source library →")));
    main.appendChild(lc);

    add(grid, side, main);
    app.appendChild(grid);
    // a link such as #/jurisdiction/JP?dim=D2 opens the profile at that dimension
    if (arg && targets[arg]) setTimeout(function () { targets[arg].scrollIntoView({ block: "start" }); }, 60);
  }

  /* ========================================================== TAB 3: METHODOLOGY */
  var METH = [["concept", "1 | Concept & Scope"], ["framework", "2 | Measurement Framework"], ["dejure", "3 | De Jure Scoring"],
              ["defacto", "4 | De Facto Scoring"], ["limits", "5 | Interpretation & Limitations"], ["docs", "6 | Technical Documentation"]];
  function fold(title, meta, nodes, cls) {
    var d = el("details", "fold" + (cls ? " " + cls : "")), sm = el("summary");
    add(sm, title, meta ? el("span", "meta", meta) : null);
    d.appendChild(sm);
    var body = el("div", "body");
    (nodes || []).forEach(function (n) { if (n) body.appendChild(typeof n === "string" ? el("p", null, n) : n); });
    d.appendChild(body);
    d.body = body;
    return d;
  }
  function recordButton(label, fn) {
    var b = el("button", "btn btn-outline btn-sm opens-panel", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function categoryEntry(m) {
    var d = fold(m.id + ". " + m.name, m.code + " · " + m.indicator, [], "cat");
    d.id = "meth-" + m.code;
    var b = d.body;
    var f = el("table", "plain entry-fields");
    f.appendChild(add(el("tr"), el("th", null, "Mechanism (conceptual definition)"), el("td", null, m.description || "—")));
    f.appendChild(add(el("tr"), el("th", null, "De Jure operationalisation"),
      add(el("td"), "Obligation category " + m.id + ": ", el("strong", null, m.name), ". One score per jurisdiction.")));
    f.appendChild(add(el("tr"), el("th", null, "De Facto operationalisation"),
      add(el("td"), "Indicator " + m.code + ": ", el("strong", null, m.indicator), ". One score per gatekeeper–market pair and observation date.")));
    f.appendChild(add(el("tr"), el("th", null, "Scoring rules"),
      add(el("td"), link("#/methodology/dejure", "De Jure: Existence, Scope, Enforceability →"), " · ", link("#/methodology/defacto", "De Facto: 0 / ½ / 1, Missing, Not Applicable →"))));
    b.appendChild(f);
    var act = el("p", "entry-actions");
    var a1 = link("#/explore/dejure?view=map&dim=" + m.dimension + "&cat=" + m.id, "View associated data: De Jure →");
    var a2 = link("#/explore/defacto?period=change&dim=" + m.dimension + "&cat=" + m.id, "View associated data: De Facto →");
    a1.className = a2.className = "btn btn-outline btn-sm";
    add(act, a1, a2);
    b.appendChild(act);
    return d;
  }

  function dimensionEntry(d, i) {
    var ms = D.mechanisms.filter(function (m) { return m.dimension === d.id; });
    var q = (D.paper.dimensionQuestions || {})[d.id] || {};
    var e = fold("Dimension " + (i + 1) + " | " + d.name, ms.length + " obligation categories", [], "dim");
    e.id = "meth-" + d.id;
    var b = e.body;
    if (q.question) b.appendChild(quoteP(q.question + (q.mechanisms ? " " + q.mechanisms : ""), "Working paper"));
    if (d.dmaObligations) b.appendChild(el("p", "small muted", "Digital Markets Act obligations its De Facto indicators observe: " + d.dmaObligations + "."));
    /* the dimension's scores are in Explore Data; the entry leads there with the dimension preselected */
    var act = el("p", "entry-actions");
    var v1 = link("#/explore/dejure?view=rank&dim=" + d.id, "View associated data: De Jure scores on " + d.id + " →");
    var v2 = link("#/explore/defacto?period=change&dim=" + d.id, "View associated data: De Facto scores on " + d.id + " →");
    v1.className = v2.className = "btn btn-outline btn-sm";
    add(act, v1, v2);
    b.appendChild(act);
    b.appendChild(el("h4", null, "Its obligation categories and indicators"));
    ms.forEach(function (m) { b.appendChild(categoryEntry(m)); });
    return e;
  }

  function pageMethodology(app, anchor) {
    document.title = "Methodology · The Contestability Index";
    indButtons = {};
    cellButtons = {};
    var grid = el("div", "wrap profile-grid meth"), side = el("div", "profile-side"), main = el("div", "profile-main");
    grid.style.padding = "0";
    var list = el("div", "dimlist"), cards = {};
    list.appendChild(el("div", "lab", "Methodology"));
    METH.forEach(function (x) {
      var b = el("button", null, x[1]);
      b.type = "button";
      b.addEventListener("click", function () { history.replaceState(null, "", "#/methodology/" + x[0]); scrollToEl(cards[x[0]]); });
      list.appendChild(b);
    });
    side.appendChild(list);
    function card(key, title, intro) {
      var c = el("div", "card meth-card");
      c.id = "meth-" + key;
      cards[key] = c;
      c.appendChild(el("h2", null, title));
      if (intro) c.appendChild(intro);
      main.appendChild(c);
      return c;
    }
    main.appendChild(el("h1", "pname", "Methodology"));
    main.appendChild(aiP(["How the index is built, from the definition of contestability to a single score. Passages in quotation blocks are quoted from the " +
      MANSRC + " or the working paper; examples and figures are read from the database. Every definition links to the data it produces, and every score in ",
      link("#/explore/dejure", "Explore Data"), " links back to its entry here."], "sec-intro"));

    /* ---- 1. Concept & Scope */
    var c1 = card("concept", "1. Concept & Scope");
    c1.appendChild(aiP("The Contestability Index measures the opportunity for incumbent positions in digital markets to be challenged, rather than market structure or outcomes."));
    c1.appendChild(el("h4", null, "The two measurement layers (expand for the definition and an example)"));
    var defs = MAN.definitions || {};
    var exJ = cellOf(6, "EU"), m6 = mechById[6];
    var exU = UNITS.indexOf("apple_ios_appstore") >= 0 ? "apple_ios_appstore" : UNITS[0];
    var exIt = D.deFacto.items.filter(function (x) { return x.unit === exU && x.mechanism === 6; })[0];
    c1.appendChild(fold("De Jure Contestability", "what the legal framework requires", [
      defs.deJure ? quoteP(defs.deJure, MANSRC + ", section " + defs.section) : null,
      exJ ? aiP("Example: in " + DJ_DATE + " the European Union scores " + glyph(exJ.score) + " on " + m6.name.toLowerCase() + " (category " + m6.id + "), on the basis of " + (exJ.instrument_basis || "its legal record") + ".") : null,
      exJ ? recordButton("Open this record", function () { matrixOrder = CODES; openCell(6, "EU"); }) : null]));
    c1.appendChild(fold("De Facto Contestability", "what is observed in practice", [
      defs.deFacto ? quoteP(defs.deFacto, MANSRC + ", section " + defs.section) : null,
      exIt && exIt.status === "scored" ? aiP("Example: for " + unitById[exU].name + " in " + theName(unitById[exU].jurisdiction) + ", indicator " + m6.code + " (" + m6.indicator.toLowerCase() + ") is scored " +
        glyph(exIt.pre) + " in " + DF_BASE + " and " + glyph(exIt.post) + " in " + DF_NOW + ".") : null,
      exIt ? recordButton("Open this record", function () { openIndicator(exU, 6); }) : null]));
    var two = el("div", "two-col"), yes = el("div"), no = el("div");
    yes.appendChild(el("h4", null, "What the index measures"));
    add(yes, mq("deJureObjective"), mq("deFactoObjective"));
    no.appendChild(el("h4", null, "What it does not measure"));
    add(no, mq("deJureObjective", "notCompliance"));
    if (MAN.indexMeaning && num(mVal("de_facto", "google_search", "current", "overall")) === "0.52") add(no, mq("indexMeaning"));
    add(two, yes, no);
    c1.appendChild(two);

    /* ---- 2. Measurement Framework */
    var c2 = card("framework", "2. Measurement Framework",
      aiP(words(nD).charAt(0).toUpperCase() + words(nD).slice(1) + " dimensions, " + words(nM) + " mechanisms and two measurement layers. Each mechanism has one De Jure obligation category " +
          "and one De Facto indicator, so the two layers can be read side by side. Open a dimension for its categories, and a category for its definition, both operationalisations and its data."));
    c2.appendChild(el("h4", null, "The terms"));
    var hz = MAN.hierarchy || {};
    [["Contestability dimension", hz.dimension], ["Contestability mechanism", hz.mechanism], ["De Jure obligation category", hz.obligationCategory, hz.legalBasis],
     ["De Facto indicator", hz.indicator]].forEach(function (x) {
      if (!x[1]) return;
      c2.appendChild(fold(x[0], null, [quoteP(x[1], MANSRC + ", section " + hz.section), x[2] ? quoteP(x[2], MANSRC + ", section " + hz.section) : null]));
    });
    c2.appendChild(fold("Units of observation", "what one record describes", [mq("units", "deJure"), mq("units", "deJureMarket"), mq("units", "deFacto")]));
    c2.appendChild(el("h4", null, "The hierarchy (open a dimension, then a category)"));
    D.dimensions.forEach(function (d, i) { c2.appendChild(dimensionEntry(d, i)); });

    /* ---- 3. De Jure Scoring */
    var c3 = card("dejure", "3. De Jure Scoring");
    add(c3, mq("deJureObjective"));
    c3.appendChild(el("h4", null, "Three factors"));
    var ff = MAN.deJureFactors || {}, fr = el("div", "flow three");
    [["Existence", ff.existence], ["Scope", ff.scope], ["Enforceability", ff.enforceability]].forEach(function (x) {
      fr.appendChild(add(el("div", "st"), el("b", null, x[0]), x[1] ? "“" + cap(x[1]) + ".”" : ""));
    });
    c3.appendChild(fr);
    if (ff.section) c3.appendChild(el("p", "small muted", "Factor definitions: " + MANSRC + ", section " + ff.section + "."));
    c3.appendChild(el("h4", null, "The 0 / ½ / 1 rubric"));
    var ds = MAN.deJureScale || {}, rt = el("table", "plain");
    rt.appendChild(add(el("tr"), el("th", null, "Score"), el("th", null, "Interpretation")));
    [[0, "0"], [0.5, "0.5"], [1, "1"]].forEach(function (x) {
      rt.appendChild(add(el("tr"), add(el("td"), paint(el("span", "pill-inline", glyph(x[0])), x[0])), el("td", null, ds[x[1]] ? "“" + ds[x[1]] + "”" : "")));
    });
    c3.appendChild(rt);
    if (ds.section) c3.appendChild(el("p", "small muted", "Rubric: " + MANSRC + ", section " + ds.section + "."));
    c3.appendChild(el("h4", null, "From three factors to a category score"));
    c3.appendChild(aiP("Each factor is scored 0, ½ or 1, and the category takes the lowest of the three. The lowest factor sets the score because the three factors " +
      "complement each other: a rule that reaches every firm but cannot be enforced protects little, and strong enforcement cannot make up for a rule that does not exist."));
    c3.appendChild(el("h4", null, "Aggregation"));
    add(c3, mq("aggregationDimension"), mq("aggregationOverall"));
    var flow = el("div", "flow");
    [["Legal text", "Statutes, regulations, orders and court remedies in force in " + DJ_DATE + "."],
     ["Three factors", "Existence, Scope and Enforceability, each scored 0, ½ or 1."],
     ["Category score", "The lowest of the three factors."],
     ["Dimension score", "The mean of the category scores in the dimension."],
     ["Index", "The mean of the " + words(nD) + " dimension scores."]].forEach(function (x) { flow.appendChild(add(el("div", "st"), el("b", null, x[0]), x[1])); });
    c3.appendChild(flow);
    // A worked example from the data: the first Japanese category whose factors differ, then Japan's dimension and index.
    var exCode = "JP", exM = D.mechanisms.filter(function (m) { var c = cellOf(m.id, exCode); return c && c.binding && c.binding.length < 3; })[0];
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
      ex.appendChild(recordButton("Open this record", function () { matrixOrder = CODES; openCell(exM.id, exCode); }));
      c3.appendChild(ex);
    }
    // One real record for each score, so the rubric can be seen applied.
    var exRows = [];
    [1, 0.5, 0].forEach(function (sv) {
      var found = null;
      ["JP", "UK", "KR", "TR", "US", "CN", "AU", "EU", "DE"].some(function (jc) {
        if (!jurByCode[jc]) return false;
        var m = D.mechanisms.filter(function (mm) { var x = cellOf(mm.id, jc); return x && x.score === sv && x.instrument_basis && (sv !== 0.5 || x.binding.length < 3); })[0];
        if (m) found = { j: jc, m: m, x: cellOf(m.id, jc) };
        return !!m;
      });
      if (found) exRows.push(found);
    });
    var exFold = fold("See examples of each score", "three records from the database", []);
    exRows.forEach(function (r) {
      var p = el("p");
      add(p, paint(el("span", "pill-inline", glyph(r.x.score)), r.x.score), " ", el("strong", null, jurName[r.j] + " · " + r.m.id + ". " + r.m.name),
          ": Existence " + r.x.existence + ", Scope " + r.x.scope + ", Enforceability " + r.x.enforceability + ". " + (r.x.instrument_basis || "") + " ");
      p.appendChild(recordButton("Open this record", function () { matrixOrder = CODES; openCell(r.m.id, r.j); }));
      exFold.body.appendChild(p);
      if (r.x.factor_rationale) exFold.body.appendChild(el("p", "small muted", r.x.factor_rationale));
    });
    c3.appendChild(exFold);
    var lf = el("table", "plain");
    lf.appendChild(add(el("tr"), el("th", null, "Form"), el("th", null, "Definition"), el("th", null, "Typical factor treatment")));
    D.legalForms.forEach(function (f) {
      lf.appendChild(add(el("tr"), el("td", "mono", f.code), add(el("td", "small"), el("strong", null, f.name), el("div", null, f.definition)), el("td", "small muted", f.signature)));
    });
    c3.appendChild(fold("Legal forms", "the form of the instrument each score rests on", [
      aiP("Each De Jure score also records the form of the instrument it rests on. The form is a benchmark for coding; the legal text decides the score."),
      add(el("div", "table-scroll"), lf)]));
    var vd = link("#/explore/dejure", "View associated data: every De Jure score →");
    vd.className = "btn btn-outline btn-sm";
    c3.appendChild(add(el("p", "entry-actions"), vd));

    /* ---- 4. De Facto Scoring */
    var c4 = card("defacto", "4. De Facto Scoring");
    add(c4, mq("deFactoObjective"));
    c4.appendChild(el("h4", null, "Observable mechanisms: how indicators are chosen"));
    var selp = MAN.deFactoSelection || {}, f3 = el("div", "flow three");
    [["Observability", selp.observability], ["Representativeness", selp.representativeness], ["Comparability", selp.comparability]].forEach(function (x) {
      f3.appendChild(add(el("div", "st"), el("b", null, x[0]), x[1] ? "“" + cap(x[1]) + ".”" : ""));
    });
    c4.appendChild(f3);
    if (selp.section) c4.appendChild(el("p", "small muted", "Selection principles: " + MANSRC + ", section " + selp.section + "."));
    c4.appendChild(el("h4", null, "Scoring rules"));
    var fs = MAN.deFactoScale || {}, st = el("table", "plain");
    st.appendChild(add(el("tr"), el("th", null, "Score"), el("th", null, "Interpretation")));
    [[0, "0"], [0.5, "0.5"], [1, "1"]].forEach(function (x) {
      st.appendChild(add(el("tr"), add(el("td"), paint(el("span", "pill-inline", glyph(x[0])), x[0])),
        el("td", null, (fs[x[1]] ? "“" + fs[x[1]] + "”" : "") + (x[1] === "0.5" && MAN.deFactoFriction ? " “" + MAN.deFactoFriction.text + ".”" : ""))));
    });
    st.appendChild(add(el("tr"), add(el("td"), el("span", "ind na sample", "n/a")), el("td", null, fs["Not Applicable"] ? "Not Applicable. “" + fs["Not Applicable"] + "”" : "Not Applicable")));
    st.appendChild(add(el("tr"), add(el("td"), el("span", "ind miss sample", "M")), el("td", null, fs.Missing ? "Missing. “" + fs.Missing + "”" : "Missing")));
    c4.appendChild(st);
    if (fs.section) c4.appendChild(el("p", "small muted", "Scale: " + MANSRC + ", section " + fs.section + "."));
    add(c4, mq("deFactoEvidence"));
    c4.appendChild(el("h4", null, "Missing observations"));
    add(c4, mq("notApplicableVsMissing"), mq("missingInformation"));
    var nSc = D.deFacto.items.filter(function (x) { return x.status === "scored"; }).length;
    var nMi = D.deFacto.items.filter(function (x) { return x.status === "missing"; }).length;
    var nNa = D.deFacto.items.filter(function (x) { return x.status === "not_applicable"; }).length;
    c4.appendChild(aiP("In this dataset, of the " + D.deFacto.items.length + " indicator records (" + words(nU) + " pairs × " + words(nM) + " indicators), " + nSc +
      " are scored, " + nMi + " are Missing and " + nNa + " are Not Applicable. A dimension is the mean of the indicators that could be scored, so an evidence gap does not count as a zero."));
    c4.appendChild(el("h4", null, "Confidence"));
    var cf = el("table", "plain"), cl = D.paper.confidenceLevels || {};
    ["High", "Moderate", "Low"].forEach(function (k) { if (cl[k]) cf.appendChild(add(el("tr"), el("th", null, k), el("td", null, "“" + cap(cl[k]) + ".”"))); });
    c4.appendChild(cf);
    if (cl.note) c4.appendChild(quoteP(cl.note, "Working paper"));
    // worked example: the first scored indicator of the first pair, as recorded
    var weU = UNITS[0], weIt = D.deFacto.items.filter(function (x) { return x.unit === weU && x.status === "scored" && x.delta > 0; })[0];
    if (weIt) {
      var wm = mechById[weIt.mechanism], we = el("div", "example");
      we.appendChild(el("p", null, "Worked example, read from the database: " + unitById[weU].name + ", indicator " + wm.code + " (" + wm.indicator + ")."));
      we.appendChild(el("p", "small", "Score: " + glyph(weIt.pre) + " in " + DF_BASE + ", " + glyph(weIt.post) + " in " + DF_NOW +
        (weIt.confidence ? ". Confidence: " + (CONF[weIt.confidence] || [0, weIt.confidence.toLowerCase()])[1] : "") + "."));
      we.appendChild(el("p", "small", weIt.evidence.length > 620 ? weIt.evidence.slice(0, 620).replace(/\s+\S*$/, "") + " …" : weIt.evidence));
      we.appendChild(recordButton("Open this record, with its sources", function () { openIndicator(weU, weIt.mechanism); }));
      c4.appendChild(we);
    }
    c4.appendChild(el("h4", null, "Indicator by indicator"));
    c4.appendChild(el("p", "small muted", "What each indicator observes. An indicator opens its entry in section 2; “Data” opens its scores and evidence."));
    c4.appendChild(add(el("p", "chart-foot top"), dlButton("contestability_definitions.csv", ["category_id", "category_code", "dimension", "dimension_name", "category", "mechanism_description", "de_facto_indicator"],
      function () { return D.mechanisms.map(function (m) { return [m.id, m.code, m.dimension, dimById[m.dimension].name, m.name, m.description, m.indicator]; }); }, "Download the definitions (CSV)")));
    var it2 = el("table", "plain ind-list"), ih = el("tr");
    ["Indicator", "What it observes (the mechanism)", "De Jure counterpart", ""].forEach(function (x) { ih.appendChild(el("th", null, x)); });
    it2.appendChild(ih);
    D.mechanisms.forEach(function (m) {
      it2.appendChild(add(el("tr"), add(el("td"), link("#/methodology/" + m.code, m.code + " " + m.indicator)), el("td", "small", m.description || "—"),
        el("td", "small", m.id + ". " + m.name), add(el("td", "small"), link("#/explore/defacto?period=change&dim=" + m.dimension + "&cat=" + m.id, "Data →"))));
    });
    c4.appendChild(add(el("div", "table-scroll"), it2));
    var vf = link("#/explore/defacto", "View associated data: the De Facto dashboard →");
    vf.className = "btn btn-outline btn-sm";
    c4.appendChild(add(el("p", "entry-actions"), vf));

    /* ---- 5. Interpretation & Limitations */
    var c5 = card("limits", "5. Interpretation & Limitations",
      aiP("What the scores can and cannot support, with the data each note is about."));
    var ins = insights(), disc = D.paper.discrepancies || [], dfc = (D.paper.deFactoCompare || []).filter(function (x) { return !x.same; });
    function notes(title, items) {
      c5.appendChild(el("h4", null, title));
      var g = el("div", "notes-grid");
      items.forEach(function (n) {
        if (!n) return;
        var c = el("div", "note");
        c.appendChild(el("h3", null, n[0]));
        n[1].forEach(function (x) { if (x) c.appendChild(typeof x === "string" ? aiP(x) : x); });
        if (n[2]) c.appendChild(add(el("p", "small note-link"), link(n[2][0], n[2][1] + " →")));
        g.appendChild(c);
      });
      c5.appendChild(g);
    }
    notes("Coverage", [
      ["Coverage of the De Facto layer", [mq("pilotLimitation"), mq("noJurisdictionDeFacto")], ["#/explore/defacto", "The gatekeeper–market pairs"]],
      ["Nine jurisdictions; grey is not zero",
       [cap(words(nJ)) + " jurisdictions are assessed on the law. Areas shown in grey on the map have not been assessed, which is different from a score of zero. " +
        "The 27 EU member states share the EU score; Germany also has its own national regime and its own score."], ["#/explore/dejure?view=map", "The map"]],
      ["Why these markets", [mq("marketRationale")], ["#/explore/defacto", "The De Facto dashboard"]]]);
    notes("Comparability", [
      ["The law as written, not compliance", [mq("deJureObjective", "notCompliance")], ["#/explore/compare?type=gap", "Law against market"]],
      ["Two levels of De Jure", [mq("units", "deJureMarket"),
        "The jurisdiction-level index and the market-level De Jure score of a pair are therefore different numbers and should not be compared with each other."],
       ["#/explore/compare?type=gap", "Market-level De Jure beside De Facto"]]]);
    notes("Aggregation assumptions", [
      ["Equal weights", [mq("weighting"), mq("weighting", "marketSpecific")], ["#/explore/dejure?view=rank", "Scores by dimension"]],
      ["The index moves in steps", [ins.precision.text], ["#/explore/dejure?view=rank&dim=overall", "The ranking"]],
      ["A score is not a weight", [mq("scoresNotWeights")], ["#/methodology/framework", "The hierarchy"]]]);
    notes("Interpretation", [
      ["Before and after, not cause and effect",
       ["The De Facto observations compare " + DF_BASE + ", before the Digital Markets Act's obligations applied in March 2024, with " + DF_NOW +
        ". A change between the two dates happened after the Act applied; the index does not show that the Act caused it."], ["#/explore/defacto?period=change", "The change between the two dates"]],
      MAN.indexMeaning && num(mVal("de_facto", "google_search", "current", "overall")) === "0.52"
        ? ["What a De Facto score does not say", [mq("indexMeaning")], ["#/explore/defacto?units=google_search&period=current", "Google Search"]] : null,
      disc.length || dfc.length ? ["Differences from the working paper",
        ["The working paper (July 2026) was compiled from an earlier state of the database. " + disc.length + " of " + nJ + " jurisdictions and " + dfc.length + " of " +
         (D.paper.deFactoCompare || []).length + " pairs differ from its tables; each difference is listed with its reason."], ["#/data/docs", "The differences"]] : null]);

    c5.appendChild(el("h4", null, "Validation"));
    c5.appendChild(tbdP("Validation of the measurement (for example agreement between coders and robustness of the rankings to the weighting) will be reported here."));

    /* ---- 6. Technical Documentation */
    var c6 = card("docs", "6. Technical Documentation");
    c6.appendChild(versionBox());
    var dl = el("ul", "doc-list");
    function doc(title, note, action) { dl.appendChild(add(el("li"), el("strong", null, title), note ? el("span", "muted small", " · " + note) : null, action ? " " : null, action)); }
    doc(MANSRC, "the full methodology; quoted throughout this page", null);
    dl.lastChild.appendChild(tbdP("Whether and where the Manual itself is published.", "small"));
    doc((D.paper.handbook || {}).version || "Coding Handbook", "category-by-category and indicator-by-indicator coding instructions", null);
    dl.lastChild.appendChild(tbdP("Whether and where the Handbook itself is published.", "small"));
    doc("Working paper", "Cheng, Xu and Yakout, “Beyond Market Concentration: Measuring Contestability in Digital Markets”, July 2026", null);
    doc("Online appendix", "every table of the database and the scoring rules in full", extLink(APPENDIX, "Open"));
    doc("Complete database", "SQLite" + (D.meta.fullDbBytes ? ", " + (D.meta.fullDbBytes / 1e6).toFixed(1) + " MB" : "") + ", built " + D.meta.built, link(D.meta.dbUrl, "Download"));
    doc("Data dictionary, citation and update history", null, link("#/data/docs", "Open"));
    doc("Site repository", null, extLink(REPO, "GitHub"));
    c6.appendChild(dl);

    add(grid, side, main);
    app.appendChild(grid);

    /* open the entry the address names: a section, a dimension or a category code */
    if (anchor) {
      var key = String(anchor), target = null;
      var m = D.mechanisms.filter(function (x) { return x.code.toUpperCase() === key.toUpperCase(); })[0];
      if (m) {
        var dd = document.getElementById("meth-" + m.dimension), ce = document.getElementById("meth-" + m.code);
        if (dd) dd.open = true;
        if (ce) { ce.open = true; ce.classList.add("target"); target = ce; }
      } else if (dimById[key.toUpperCase()]) {
        target = document.getElementById("meth-" + key.toUpperCase());
        if (target) { target.open = true; target.classList.add("target"); }
      } else target = cards[key.toLowerCase()] || null;
      if (target) setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 60);
    }
  }

  /* ========================================================== TAB 4: APPLICATIONS */
  // The three analyses of the professor's plan. Titles and one-line descriptions are the plan's own wording; the
  // analyses themselves are drafts ([AI generated]) built from the data, for the team to replace.
  var APPS = [
    { id: "frameworks", title: "Comparing Digital Competition Frameworks",
      blurb: "Examining differences in contestability obligations across jurisdictions and regulatory approaches.",
      explore: "#/explore/compare?type=jur", build: appFrameworks },
    { id: "change", title: "Changes in Observed Market Contestability",
      blurb: "Examining how the assessed market conditions differ between observation periods.",
      explore: "#/explore/defacto?period=change", build: appChange },
    { id: "gap", title: "Legal Requirements and Market Conditions",
      blurb: "Using matched legal and market assessments to examine differences between formal requirements and observed contestability.",
      explore: "#/explore/compare?type=gap", build: appGap }
  ];

  function pageApplications(app) {
    document.title = "Applications · The Contestability Index";
    var s = section(), w = el("div", "wrap");
    head(w, "Applications", "Applications of the Contestability Index", "Research analyses and illustrative applications using the index data.");
    w.appendChild(tbdP("Authors and final texts. The three entries below hold the place: their charts are computed from the data, and their paragraphs are [AI generated] drafts. " +
      "Market case studies, analytical notes and research results can be added as further entries."));
    var list = el("div", "app-list");
    APPS.forEach(function (a, i) {
      var c = el("div", "app-card");
      c.appendChild(el("p", "sec-kicker", "Application " + ("0" + (i + 1)).slice(-2)));
      c.appendChild(add(el("h3"), link("#/applications/" + a.id, a.title)));
      c.appendChild(el("p", null, a.blurb));
      var row = el("p", "app-links"), ex = link(a.explore, "Explore data ↗");
      add(row, link("#/applications/" + a.id, "Read analysis"), ex);
      c.appendChild(row);
      list.appendChild(c);
    });
    w.appendChild(list);
    s.appendChild(w);
    app.appendChild(s);
  }

  // The fixed outline of one application page.
  function appPage(app, a, i, parts) {
    document.title = a.title + " · The Contestability Index";
    var s = section(), w = el("div", "wrap app-page");
    w.appendChild(add(el("p", "small"), link("#/applications", "← All applications")));
    w.appendChild(el("p", "sec-kicker", "Application " + ("0" + (i + 1)).slice(-2)));
    w.appendChild(el("h1", "pname", a.title));
    w.appendChild(el("p", "sec-intro", a.blurb));
    w.appendChild(tbdP("Author, date and the final text of this analysis. The paragraphs marked [AI generated] below are placeholders drafted from the data."));
    function block(title) {
      var c = el("div", "card");
      c.appendChild(el("h2", null, title));
      w.appendChild(c);
      return c;
    }
    var b1 = block("Research question and short takeaway");
    b1.appendChild(el("p", "rq", parts.question));
    if (parts.big) {
      var big = el("div", "kp-big big");
      parts.big.forEach(function (x) { big.appendChild(add(el("div"), el("b", null, x[0]), el("span", null, x[1]))); });
      b1.appendChild(big);
    }
    parts.takeaway.forEach(function (t) { b1.appendChild(aiP(t)); });
    var b2 = block("Featured visualization");
    parts.featured(b2);
    var b3 = block("Interpretation");
    parts.interpretation.forEach(function (t) { b3.appendChild(aiP(t)); });
    var b4 = block("Additional analysis");
    parts.additional(b4);
    var b5 = block("Explore the underlying data");
    var links = el("div", "link-cards");
    parts.data.forEach(function (x) {
      var l = link(x[0], "");
      l.className = "link-card";
      add(l, el("b", null, x[1]), el("span", null, x[2]));
      links.appendChild(l);
    });
    b5.appendChild(links);
    var b6 = block("Research reference");
    var ul = el("ul", "doc-list"), c = citeText();
    ul.appendChild(add(el("li"), el("strong", null, "Working paper"), el("span", "muted small", " · " + c.paper)));
    ul.appendChild(add(el("li"), el("strong", null, "Methodology"), " ", link(parts.method[0], parts.method[1])));
    ul.appendChild(add(el("li"), el("strong", null, "Sources"), " ", link(parts.sources[0], parts.sources[1])));
    var cb = el("button", "linkish opens-panel", "How to cite the dataset");
    cb.type = "button";
    cb.addEventListener("click", function () { openCite(); });
    ul.appendChild(add(el("li"), el("strong", null, "Citation"), " ", cb));
    b6.appendChild(ul);
    s.appendChild(w);
    app.appendChild(s);
  }

  function appFrameworks(app, a, i) {
    var ins = insights();
    appPage(app, a, i, {
      question: "Which jurisdictions' laws require the most pro-contestability obligations, and where do the legal frameworks differ?",
      big: ins.top.big,
      takeaway: [ins.top.text],
      featured: function (c) {
        c.appendChild(chartHead("De Jure index, " + words(nJ) + " jurisdictions, " + DJ_DATE, "Click a jurisdiction for its profile.",
          [helpLink("#/methodology/dejure", "How the De Jure index is built"),
           dlButton("contestability_dejure_index.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[1] === "jurisdiction"; }); })]));
        c.appendChild(rankingList("overall"));
      },
      interpretation: [ins.spread.text, ins.prevalence.text,
        "Qualifications: a De Jure score records the law as written. It does not record compliance or market outcomes, and the dimensions are weighted equally. " + ins.precision.text],
      additional: function (c) {
        c.appendChild(chartHead("Where the jurisdictions differ: every jurisdiction on each dimension", "One dot per score; the lowest and highest are named.",
          [dlButton("contestability_dejure_index.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[1] === "jurisdiction"; }); })]));
        c.appendChild(dimSpread());
        c.appendChild(chartHead("How common is each obligation?", "The " + words(nJ) + " jurisdictions split by their score on each category.",
          [dlButton("contestability_dejure_categories.csv", CSV.dejureHeader, function () { return CSV.dejureRows(CODES, "overall"); })]));
        c.appendChild(prevalenceChart(true, false));
        if (jurByCode.JP) {
          var jn = counts("JP"), jv = val("JP", "overall");
          var fullJP = D.mechanisms.filter(function (m) { return cellOf(m.id, "JP").score === 1; });
          var msca = fullJP.filter(function (m) { return /MSCA/.test(cellOf(m.id, "JP").instrument_basis || ""); });
          var zeros = D.mechanisms.filter(function (m) { return cellOf(m.id, "JP").score === 0; });
          c.appendChild(el("h3", "pane-title", "Case: Japan, a law written for smartphones"));
          c.appendChild(aiP("Japan scores " + num(jv) + ", the highest outside the European Union and Germany. " +
            (msca.length === fullJP.length ? "All " + words(fullJP.length) : cap(words(msca.length)) + " of the " + words(fullJP.length)) +
            " categories it requires in full rest on the Mobile Software Competition Act (Act 58/2024), which the coding records as in full force since 18 December 2025."));
          c.appendChild(aiP("Japan scores 0.5 in " + words(jn.part) + " categories and 0 in " + words(jn.none) + (zeros.length ? ": " + listText(zeros.map(function (m) { return m.name.toLowerCase(); })) : "") +
            ". The table shows which factor holds each partial score down; click a score for its legal justification."));
          var t = el("table", "plain"), hr = el("tr");
          ["Category", "Score", "Existence", "Scope", "Enforceability", "Basis"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
          t.appendChild(hr);
          D.mechanisms.filter(function (m) { return cellOf(m.id, "JP").score < 1; }).forEach(function (m) {
            var x = cellOf(m.id, "JP"), tr = el("tr"), b = el("button", "linkish opens-panel", m.id + ". " + m.name);
            b.type = "button";
            b.addEventListener("click", function () { matrixOrder = CODES; openCell(m.id, "JP"); });
            tr.appendChild(add(el("td"), b));
            [x.score, x.existence, x.scope, x.enforceability].forEach(function (v) { tr.appendChild(paint(el("td", "sc", glyph(v)), v)); });
            tr.appendChild(el("td", "small", x.instrument_basis || "—"));
            t.appendChild(tr);
          });
          c.appendChild(add(el("div", "table-scroll"), t));
        }
      },
      data: [["#/explore/compare?type=jur", "Compare jurisdictions", "Pick two or more jurisdictions and compare them dimension by dimension and category by category."],
             ["#/explore/dejure?view=rank", "De Jure ranking and matrix", "Every jurisdiction, every dimension, all " + D.meta.totalCells + " category scores."],
             ["#/data/downloads?set=dejure", "Download the De Jure data", "Category scores with their three components, legal form and legal basis."]],
      method: ["#/methodology/dejure", "De Jure scoring →"],
      sources: ["#/data/library?type=instrument", "Legal instruments in the source library →"]
    });
  }

  function appChange(app, a, i) {
    var ins = insights(), c1 = ins.change.most, u1 = unitById[c1.u], post = mIdx("de_facto", c1.u, "current");
    var items = D.deFacto.items.filter(function (it) { return it.unit === c1.u; });
    var changed = items.filter(function (it) { return it.status === "scored" && it.delta > 0; }).sort(function (x, y) { return y.delta - x.delta || x.mechanism - y.mechanism; });
    var missing = items.filter(function (it) { return it.status === "missing"; }).length;
    var dimUp = DIMS.filter(function (d) { return mVal("de_facto", c1.u, "current", d) > mVal("de_facto", c1.u, "baseline", d); });
    appPage(app, a, i, {
      question: "Did observed contestability in the three European Union gatekeeper–market pairs differ between " + DF_BASE + " and " + DF_NOW + "?",
      big: ins.change.big,
      takeaway: [ins.change.text],
      featured: function (c) {
        c.appendChild(chartHead("De Facto index, " + DF_BASE + " and " + DF_NOW, "One line per gatekeeper–market pair.",
          [helpLink("#/methodology/defacto", "How the De Facto index is built"),
           dlButton("contestability_defacto_index.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[0] === "de_facto"; }); })]));
        c.appendChild(seriesKey(UNITS.map(function (u) { return { label: unitById[u].name, color: UNIT_COLOR[u] }; })));
        c.appendChild(slopeChart("overall"));
      },
      interpretation: [
        "The comparison is before and after, so it does not separate the Digital Markets Act from other changes in these markets. The three pairs were chosen because they are well documented, and are not representative of digital markets in general.",
        "Indicators with too little evidence are recorded as Missing and left out of the index rather than counted as zero, so each index rests on the indicators that could be scored: " +
        listText(UNITS.map(function (u) { return scoredOf(mIdx("de_facto", u, "current")) + " for " + unitById[u].name; })) + "."],
      additional: function (c) {
        c.appendChild(chartHead("By dimension", "Hollow: " + DF_BASE + ". Filled: " + DF_NOW + ".",
          [dlButton("contestability_defacto_index.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[0] === "de_facto"; }); })]));
        c.appendChild(seriesKey(UNITS.map(function (u) { return { label: unitById[u].name, color: UNIT_COLOR[u] }; })));
        c.appendChild(pairDimChart(UNITS, "change", null));
        c.appendChild(el("h3", "pane-title", "Case: " + u1.name + ", the largest increase"));
        c.appendChild(aiP("The Digital Markets Act designation of " + u1.gatekeeper + " for " + u1.service.replace(/ \(.*\)$/, "") + " dates from " +
          day(u1.designationDate) + ". In " + DF_BASE + ", before the Act's obligations applied, the pair scored " + num(c1.a) + " on the De Facto index; in " + DF_NOW +
          " it scored " + num(c1.b) + ", the largest increase of the " + words(nU) + " pairs."));
        if (changed.length) {
          var bigI = changed[0], bm = mechById[bigI.mechanism];
          c.appendChild(aiP((dimUp.length === nD ? "The increase is spread across all " + words(nD) + " dimensions. " : "The increase comes from " + listText(dimUp) + ". ") +
            "The largest change at indicator level is " + bm.code + " " + bm.indicator.toLowerCase() + ", from " + num(bigI.pre) + " to " + num(bigI.post) + "; " +
            words(changed.length) + " indicators rose in all. " + cap(words(missing)) + " of the " + words(post.nItems) + " indicators had too little evidence to score."));
        }
        c.appendChild(el("h4", null, "Indicators that changed, with the coded evidence"));
        changed.forEach(function (it) {
          var m = mechById[it.mechanism];
          var d = fold(m.code + " " + m.indicator, num(it.pre) + " → " + num(it.post) + (it.confidence ? " · confidence " + (CONF[it.confidence] || [0, it.confidence.toLowerCase()])[1] : ""),
            [el("p", null, it.evidence || "—"), recordButton("Open this record, with its sources", function () { openIndicator(c1.u, it.mechanism); })]);
          c.appendChild(d);
        });
      },
      data: [["#/explore/defacto?period=change", "De Facto dashboard, change between the two dates", "The three pairs by dimension, then indicator by indicator with the evidence."],
             ["#/explore/compare?type=mkt", "Compare markets", "Before and after for two or three pairs, mechanism by mechanism."],
             ["#/data/downloads?set=defacto", "Download the De Facto data", "Indicator scores for both dates, with status and confidence."]],
      method: ["#/methodology/defacto", "De Facto scoring →"],
      sources: ["#/data/library?type=defacto", "De Facto evidence sources in the source library →"]
    });
  }

  function appGap(app, a, i) {
    var ins = insights();
    var djs = UNITS.map(function (u) { return mVal("de_jure", u, "current", "overall"); });
    var dfs = UNITS.map(function (u) { return mVal("de_facto", u, "current", "overall"); });
    var same = djs.every(function (x) { return x === djs[0]; });
    var leaders = DIMS.map(function (d) {
      var best = UNITS.slice().sort(function (x, y) { return mVal("de_facto", y, "current", d) - mVal("de_facto", x, "current", d); });
      var top = mVal("de_facto", best[0], "current", d);
      return { d: d, who: best.filter(function (u) { return mVal("de_facto", u, "current", d) === top; }), v: top };
    });
    appPage(app, a, i, {
      question: "Where the law requires an obligation in a market, how far do the observed market conditions follow?",
      big: ins.gap.big,
      takeaway: [ins.gap.text],
      featured: function (c) {
        c.appendChild(chartHead("Law against market in the three pairs, " + DF_NOW, "Dark bar: De Jure at market level. Coloured bar: De Facto. Tick: De Facto in " + DF_BASE + ".",
          [helpLink("#/methodology/limits", "How to read the gap"), dlButton("contestability_law_vs_market.csv", CSV.gapHeader, CSV.gapRows)]));
        c.appendChild(pairedBars(UNITS.map(function (u) { return { u: u, k: "overall", label: unitById[u].name, click: function () { go("#/explore/compare?type=gap&unit=" + u); } }; })));
      },
      interpretation: [
        "The gap is a difference between two measurements, not an estimate of non-compliance: the market-level De Jure score records what the law requires in that market, and the De Facto score records how the mechanism was observed to work.",
        "A gap can also reflect indicators that could not be scored. Missing indicators are left out of the De Facto index, so the gap is computed on the indicators that were scored."],
      additional: function (c) {
        c.appendChild(el("h3", "pane-title", "Case: one law, three markets"));
        c.appendChild(aiP((same ? "In " + DJ_DATE + " the same EU obligations apply to all " + words(nU) + " pairs: each has a market-level De Jure score of " + num(djs[0]) + ". " : "") +
          "Their De Facto scores in " + DF_NOW + " are " + listText(UNITS.map(function (u, k) { return num(dfs[k]) + " for " + unitById[u].name; })) +
          ". The dimensions differ more than the totals: " + leaders.map(function (l) {
            return l.d + " is highest for " + listText(l.who.map(function (u) { return unitById[u].name; })) + " (" + num(l.v) + ")";
          }).join("; ") + "."));
        c.appendChild(aiP("Google Play is scored on the app-distribution record of the market-level De Jure layer, because the same obligations bind both app stores; it has no " + DF_BASE + " De Jure record."));
        c.appendChild(chartHead("De Facto by dimension for the three pairs, " + DF_NOW, null,
          [dlButton("contestability_defacto_index.csv", CSV.indexHeader, function () { return CSV.indexRows().filter(function (r) { return r[0] === "de_facto"; }); })]));
        c.appendChild(seriesKey(UNITS.map(function (u) { return { label: unitById[u].name, color: UNIT_COLOR[u], shape: "sq" }; })));
        c.appendChild(pairDims());
        c.appendChild(chartHead("Law and market over time", "Squares: De Jure at market level. Circles: De Facto. Hollow: " + DF_BASE + ". Filled: latest.",
          [dlButton("contestability_law_vs_market.csv", CSV.gapHeader, CSV.gapRows)]));
        c.appendChild(lawMarketRows(UNITS, ["overall"]));
      },
      data: [["#/explore/compare?type=gap", "De Jure vs. De Facto", "Paired bars and the gap breakdown by dimension and by mechanism."],
             ["#/jurisdiction/EU", "European Union profile", "The jurisdiction-level law beside the three pairs."],
             ["#/data/downloads?set=indices", "Download the aggregated indices", "Both layers for each pair, with the gap."]],
      method: ["#/methodology/limits", "Interpretation and limitations →"],
      sources: ["#/data/library", "Source and evidence library →"]
    });
  }

  function pageApplication(app, id) {
    var i = -1;
    APPS.forEach(function (a, k) { if (a.id === id) i = k; });
    if (i < 0) { pageApplications(app); return; }
    APPS[i].build(app, APPS[i], i);
  }

  /* ========================================================== TAB 5: DATA & SOURCES */
  var DATA_SECTIONS = [["downloads", "Data downloads"], ["library", "Source and evidence library"], ["docs", "Documentation and versioning"]];
  var DSETS = [
    { id: "dejure", name: "De Jure", content: "Jurisdiction, category, component scores, overall scores", fn: "Preview, filter, CSV download" },
    { id: "defacto", name: "De Facto", content: "Gatekeeper–market pairs, indicators, periods, scores, confidence", fn: "Preview, filter, CSV download" },
    { id: "indices", name: "Aggregated Indices", content: "Overall and dimension-level results", fn: "Preview, download" },
    { id: "meta", name: "Supporting Metadata", content: "Definitions, coding identifiers, missing-value conventions, version", fn: "View and download" },
    { id: "db", name: "Complete Database", content: "Full database", fn: "SQLite download" }
  ];
  // what each column of the downloads means
  var DICT = {
    dejure: [["record_id", "Stable identifier of the score: dj : jurisdiction : category code : observation month. It does not change when the database is rebuilt."],
             ["db_row", "Row number of the score in the assessments table of this database build. It can change between builds."],
             ["jurisdiction_code, jurisdiction", "The jurisdiction scored."], ["dimension", "D1 to D4."],
             ["category_code, category_id, category", "The obligation category: its code (D2.2), its number (1 to 16) and its name."],
             ["score", "0, 0.5 or 1: the lowest of the three components."], ["existence, scope, enforceability", "The three components, each 0, 0.5 or 1."],
             ["legal_form", "The form of the instrument the score rests on."], ["instrument_basis", "Short citation of the legal basis."],
             ["observed", "Month the legal state is observed (YYYY-MM)."], ["evidence_date", "Date of the evidence used for the record."],
             ["dimension_score, jurisdiction_index", "The jurisdiction's score on the category's dimension and its overall De Jure index, repeated on each row."]],
    defacto: [["record_id", "Stable identifier of the score: df : pair : indicator code : observation month."],
              ["db_row", "Row number in the assessments table of this database build."],
              ["unit_id, pair, gatekeeper, market", "The gatekeeper–market pair."], ["dimension", "D1 to D4."],
              ["indicator_code, indicator, category", "The De Facto indicator and the obligation category it corresponds to."],
              ["period, observed", "baseline or current, and the month observed (YYYY-MM)."],
              ["status", "scored, missing (too little evidence to score) or not_applicable (the mechanism does not operate in the market)."],
              ["score", "0, 0.5 or 1 when status is scored; empty otherwise. An empty score is never a zero."],
              ["confidence", "The coder's confidence in the evidence of a scored indicator."]],
    indices: [["layer, level", "de_jure or de_facto; jurisdiction or market."], ["who, name", "Jurisdiction code or pair identifier, and its name."],
              ["period, observed", "baseline or current, and the month observed."], ["index", "Mean of the four dimension scores."],
              ["D1 to D4", "Dimension scores: the mean of the scored categories or indicators of the dimension."],
              ["n_scored, n_applicable, n_indicators", "How many indicators were scored, how many apply to the market, and how many there are."]]
  };

  function pageData(app, sec, params) {
    document.title = "Data & Sources · The Contestability Index";
    sec = DATA_SECTIONS.some(function (x) { return x[0] === sec; }) ? sec : "downloads";
    var s = section(), w = el("div", "wrap");
    head(w, "Data & Sources", "Work with the data, verify the assessments",
      "Download the scores, inspect the legal provisions and the evidence behind them, and check which version you are using.");
    w.appendChild(versionBox());
    var tabs = el("div", "tabs-row");
    tabs.setAttribute("role", "tablist");
    DATA_SECTIONS.forEach(function (x) {
      var b = el("button", null, x[1]);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", x[0] === sec ? "true" : "false");
      b.addEventListener("click", function () { go("#/data/" + x[0]); });
      tabs.appendChild(b);
    });
    var body = el("div");
    add(w, tabs, body);
    s.appendChild(w);
    app.appendChild(s);
    ({ downloads: dataDownloads, library: dataLibrary, docs: dataDocs })[sec](body, params || {});
  }

  /* ---------------------------------------------------------- downloads */
  function dataDownloads(host, params) {
    var cur = DSETS.some(function (d) { return d.id === params.set; }) ? params.set : "dejure";
    var t = el("table", "plain dsets"), hr = el("tr");
    ["Dataset", "Content", "Functionality", ""].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    var rows = {};
    DSETS.forEach(function (d) {
      var b = el("button", "btn btn-outline btn-sm", d.id === "db" ? "Details" : d.id === "meta" ? "View" : "Preview");
      b.type = "button";
      b.addEventListener("click", function () { cur = d.id; draw(); });
      var tr = add(el("tr"), add(el("td"), el("strong", null, d.name)), el("td", null, d.content), el("td", "small", d.fn), add(el("td", "num"), b));
      rows[d.id] = tr;
      t.appendChild(tr);
    });
    host.appendChild(add(el("div", "table-scroll"), t));
    host.appendChild(el("p", "small muted", "Every download carries the record identifiers that match a score to its definition and its sources; see Documentation and versioning."));
    var out = el("div", "dset-view");
    host.appendChild(out);
    function draw() {
      Object.keys(rows).forEach(function (k) { rows[k].classList.toggle("on", k === cur); });
      out.textContent = "";
      history.replaceState(null, "", "#/data/downloads?set=" + cur);
      ({ dejure: dsDeJure, defacto: dsDeFacto, indices: dsIndices, meta: dsMeta, db: dsDb })[cur](out);
    }
    draw();
  }
  function selectOf(label, options, onChange) {
    var sel = el("select", "pselect");
    sel.setAttribute("aria-label", label);
    options.forEach(function (o) { sel.appendChild(new Option(o[1], o[0])); });
    sel.addEventListener("change", function () { onChange(sel.value); });
    return sel;
  }
  function recordLink(label, fn) {
    var b = el("button", "linkish opens-panel", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function dsDeJure(host) {
    var all = [];
    CODES.forEach(function (c) { D.mechanisms.forEach(function (m) { all.push({ c: c, m: m, x: cellOf(m.id, c) }); }); });
    var fj = "", fd = "", out = el("div");
    function rows() { return all.filter(function (r) { return (!fj || r.c === fj) && (!fd || r.m.dimension === fd); }); }
    var header = CSV.dejureHeader.concat(["dimension_score", "jurisdiction_index"]);
    function csvRows() {
      var keep = {};
      rows().forEach(function (r) { keep[r.c + "|" + r.m.id] = 1; });
      return CSV.dejureRows(CODES, "overall").filter(function (r) { return keep[r[2] + "|" + r[6]]; })
        .map(function (r) { return r.concat([val(r[2], r[4]), val(r[2], "overall")]); });
    }
    host.appendChild(chartHead("De Jure: " + all.length + " category scores", "Law in force, " + DJ_DATE + ". Click a category for the legal justification; click a heading to sort.",
      [helpLink("#/methodology/dejure", "How a De Jure score is built")]));
    host.appendChild(add(el("div", "toolbar"), add(el("div", "ctrl-left"),
      selectOf("Jurisdiction", [["", "All jurisdictions"]].concat(CODES.map(function (c) { return [c, jurName[c]]; })), function (v) { fj = v; draw(); }),
      selectOf("Dimension", [["", "All dimensions"]].concat(DIMS.map(function (d) { return [d, d + " " + DIM_SHORT[d]]; })), function (v) { fd = v; draw(); })),
      dlButton("contestability_dejure.csv", header, csvRows, "Download CSV (as filtered)")));
    host.appendChild(out);
    var cols = [{ label: "Record", get: function (r) { return recordId("dj", r.c, r.m, "current"); } },
                { label: "Jurisdiction", get: function (r) { return jurName[r.c]; }, fmt: function (v, r) { return link("#/jurisdiction/" + r.c, v); } },
                { label: "Category", get: function (r) { return r.m.id; }, fmt: function (v, r) { return recordLink(r.m.id + ". " + r.m.name, function () { matrixOrder = CODES; openCell(r.m.id, r.c); }); } },
                { label: "Dim.", get: function (r) { return r.m.dimension; } },
                { label: "Score", score: true, get: function (r) { return r.x.score; }, fmt: function (v) { return glyph(v); } },
                { label: "E", score: true, get: function (r) { return r.x.existence; }, fmt: function (v) { return glyph(v); } },
                { label: "S", score: true, get: function (r) { return r.x.scope; }, fmt: function (v) { return glyph(v); } },
                { label: "Enf", score: true, get: function (r) { return r.x.enforceability; }, fmt: function (v) { return glyph(v); } },
                { label: "Legal form", get: function (r) { return pretty(r.x.legal_form); } },
                { label: "Legal basis", get: function (r) { return r.x.instrument_basis; } }];
    function draw() { out.textContent = ""; out.appendChild(dataTable(cols, rows())); }
    draw();
  }
  function dsDeFacto(host) {
    var all = [];
    D.deFacto.items.forEach(function (it) { ["baseline", "current"].forEach(function (p) { all.push({ it: it, p: p, m: mechById[it.mechanism] }); }); });
    var fu = "", fd = "", fp = "", out = el("div");
    function rows() { return all.filter(function (r) { return (!fu || r.it.unit === fu) && (!fd || r.m.dimension === fd) && (!fp || r.p === fp); }); }
    function csvRows() {
      var keep = {};
      rows().forEach(function (r) { keep[recordId("df", r.it.unit, r.m, r.p)] = 1; });
      return CSV.defactoRows(UNITS, "overall").filter(function (r) { return keep[r[0]]; });
    }
    host.appendChild(chartHead("De Facto: " + all.length + " indicator records", "Each indicator at each observation date. Click an indicator for the rationale, the evidence and its sources.",
      [helpLink("#/methodology/defacto", "How an indicator is scored")]));
    host.appendChild(add(el("div", "toolbar"), add(el("div", "ctrl-left"),
      selectOf("Pair", [["", "All pairs"]].concat(UNITS.map(function (u) { return [u, unitById[u].name]; })), function (v) { fu = v; draw(); }),
      selectOf("Dimension", [["", "All dimensions"]].concat(DIMS.map(function (d) { return [d, d + " " + DIM_SHORT[d]]; })), function (v) { fd = v; draw(); }),
      selectOf("Period", [["", "Both periods"], ["baseline", DF_BASE], ["current", DF_NOW]], function (v) { fp = v; draw(); })),
      dlButton("contestability_defacto.csv", CSV.defactoHeader, csvRows, "Download CSV (as filtered)")));
    host.appendChild(out);
    var cols = [{ label: "Record", get: function (r) { return recordId("df", r.it.unit, r.m, r.p); } },
                { label: "Pair", get: function (r) { return unitById[r.it.unit].name; } },
                { label: "Indicator", get: function (r) { return r.m.id; }, fmt: function (v, r) { return recordLink(r.m.code + " " + r.m.indicator, function () { openIndicator(r.it.unit, r.m.id); }); } },
                { label: "Dim.", get: function (r) { return r.m.dimension; } },
                { label: "Period", get: function (r) { return r.p; }, fmt: function (v) { return v === "baseline" ? DF_BASE : DF_NOW; } },
                { label: "Status", get: function (r) { return r.it.status; }, fmt: function (v) { return v === "scored" ? "Scored" : v === "missing" ? "Missing" : "Not applicable"; } },
                { label: "Score", score: true, get: function (r) { return r.it.status === "scored" ? (r.p === "baseline" ? r.it.pre : r.it.post) : null; }, fmt: function (v) { return glyph(v); } },
                { label: "Confidence", get: function (r) { return r.it.status === "scored" ? (CONF[r.it.confidence] || [0, (r.it.confidence || "").toLowerCase()])[1] : ""; } }];
    function draw() { out.textContent = ""; out.appendChild(dataTable(cols, rows())); }
    draw();
  }
  function dsIndices(host) {
    var raw = CSV.indexRows();
    host.appendChild(chartHead("Aggregated indices: overall and dimension-level results", "De Jure for " + words(nJ) + " jurisdictions; De Jure at market level and De Facto for the gatekeeper–market pairs.",
      [helpLink("#/methodology/dejure", "How scores are aggregated"), dlButton("contestability_indices.csv", CSV.indexHeader, function () { return raw; }, "Download CSV")]));
    var cols = [{ label: "Layer", get: function (r) { return r[0]; }, fmt: function (v, r) { return (v === "de_jure" ? "De Jure" : "De Facto") + (r[1] === "market" ? " (market)" : ""); } },
                { label: "Jurisdiction or pair", get: function (r) { return r[3]; }, fmt: function (v, r) { return r[1] === "jurisdiction" ? link("#/jurisdiction/" + r[2], v) : link("#/explore/defacto?units=" + r[2], v); } },
                { label: "Observed", get: function (r) { return r[5]; }, fmt: function (v) { return month(v); } },
                { label: "Index", score: true, get: function (r) { return r[6]; } }]
      .concat(DIMS.map(function (d, i) { return { label: d, score: true, get: function (r) { return r[7 + i] === "" ? null : r[7 + i]; } }; }))
      .concat([{ label: "Scored", get: function (r) { return r[7 + nD] + " of " + r[9 + nD]; } }]);
    host.appendChild(dataTable(cols, raw));
  }
  function dsMeta(host) {
    host.appendChild(chartHead("Supporting metadata", "Definitions, coding identifiers, missing-value conventions and version.",
      [dlButton("contestability_definitions.csv", ["category_id", "category_code", "dimension", "dimension_name", "category", "mechanism_description", "de_facto_indicator"],
         function () { return D.mechanisms.map(function (m) { return [m.id, m.code, m.dimension, dimById[m.dimension].name, m.name, m.description, m.indicator]; }); }, "Download definitions (CSV)"),
       dlButton("contestability_legal_forms.csv", ["form_code", "name", "definition", "typical_factor_treatment"],
         function () { return D.legalForms.map(function (f) { return [f.code, f.name, f.definition, f.signature]; }); }, "Download legal forms (CSV)")]));
    host.appendChild(el("h3", "pane-title", "Definitions"));
    var t = el("table", "plain"), hr = el("tr");
    ["#", "Code", "Obligation category (De Jure)", "Mechanism", "Indicator (De Facto)"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    D.mechanisms.forEach(function (m) {
      t.appendChild(add(el("tr"), el("td", "num", String(m.id)), add(el("td"), link("#/methodology/" + m.code, m.code)), el("td", null, m.name),
        el("td", "small", m.description), el("td", "small", m.indicator)));
    });
    host.appendChild(add(el("div", "table-scroll"), t));
    host.appendChild(el("h3", "pane-title", "Coding identifiers"));
    host.appendChild(aiP("Every score has a record identifier made of its keys: the layer (dj for De Jure at jurisdiction level, djm for De Jure at market level, df for De Facto), " +
      "the jurisdiction code or the pair identifier, the category code and the observation month. Example: " + recordId("dj", "EU", mechById[7], "current") +
      ". The identifier stays the same when the database is rebuilt; the db_row number does not."));
    host.appendChild(el("h3", "pane-title", "Missing-value conventions"));
    var cs = el("table", "plain"), st = D.paper.codingStates || {};
    [["scored", st.Scored], ["missing", st.Missing], ["not_applicable", st["Not Applicable"]]].forEach(function (x) {
      cs.appendChild(add(el("tr"), el("th", null, x[0]), el("td", null, x[1] ? "“" + cap(x[1]) + ".” (working paper)" : "")));
    });
    host.appendChild(cs);
    host.appendChild(aiP("In the downloads a missing or not applicable indicator has an empty score cell. An empty cell is never a zero, and such indicators are left out of the dimension score and the index."));
    host.appendChild(el("h3", "pane-title", "Version"));
    host.appendChild(versionBox());
  }
  function dsDb(host) {
    host.appendChild(chartHead("Complete database", "One SQLite file with every table the site reads, the legal full texts and the provisions."));
    var a = link(D.meta.dbUrl, "Download contestability.db" + (D.meta.fullDbBytes ? " (" + (D.meta.fullDbBytes / 1e6).toFixed(1) + " MB)" : ""));
    a.className = "btn btn-fill";
    a.setAttribute("download", "");
    host.appendChild(add(el("p"), a));
    var nInst = Object.keys(D.instruments).reduce(function (n, k) { return n + D.instruments[k].length; }, 0);
    var t = el("table", "plain");
    [["Built", D.meta.built], ["De Jure scores, jurisdiction level", String(D.meta.totalCells)], ["De Jure scores, market level", String(D.markets.deJure.length)],
     ["De Facto indicator records", String(D.deFacto.items.length * 2)], ["Legal instruments", String(nInst)], ["Full legal texts", String(D.documents.length)],
     ["Verbatim provisions", String(D.meta.extractCount)]].forEach(function (x) { t.appendChild(add(el("tr"), el("th", null, x[0]), el("td", null, x[1]))); });
    host.appendChild(t);
    host.appendChild(add(el("p", "small"), "The ", extLink(APPENDIX + "database.html", "online appendix"), " lets you browse every table without downloading. Scores are in the table “assessments”; " +
      "its key columns (layer, level, jurisdiction, unit_id, period, mechanism_id) are the parts of the record identifier."));
  }

  /* ---------------------------------------------------------- source and evidence library */
  var LIB = null, LIB_TYPES = [["instrument", "Legal instrument"], ["provision", "Verbatim provision"], ["text", "Full legal text"], ["defacto", "De Facto evidence source"]];
  function libraryRecords() {
    if (LIB) return LIB;
    var out = [];
    Object.keys(D.instruments).forEach(function (c) {
      D.instruments[c].forEach(function (i) {
        var stem = (i.name || "").split(" (")[0];
        var cats = D.mechanisms.filter(function (m) {
          var x = cellOf(m.id, c);
          return stem && x && ((x.instrument_basis || "").indexOf(stem) !== -1 || (x.legal_basis_full || "").indexOf(stem) !== -1);
        }).map(function (m) { return m.id; });
        out.push({ type: "instrument", j: c, cats: cats, period: "dj", title: i.name, ref: [i.citation, i.status].filter(Boolean).join(" · "), url: i.url,
                   urlLabel: i.sourceLabel, flag: i.pipeline ? "Not in force" : "" });
      });
    });
    Object.keys(D.cells).forEach(function (k) {
      var p = k.split("|"), m = mechById[+p[0]];
      (D.cells[k].extracts || []).forEach(function (x) {
        out.push({ type: "provision", j: p[1], cats: [m.id], period: "dj", title: x.instrument, ref: x.summary || "", excerpt: x.text, translation: x.translation });
      });
    });
    D.documents.forEach(function (d) {
      out.push({ type: "text", j: d.jurisdiction, cats: [], period: "dj", title: d.name || d.stem, ref: [d.language, Math.round(d.chars / 1000) + "k characters"].filter(Boolean).join(" · "), doc: d });
    });
    var seen = {};
    D.deFacto.items.forEach(function (it) {
      it.sources.forEach(function (s) {
        var key = it.unit + "|" + s.title + "|" + s.url, r = seen[key];
        if (!r) { r = seen[key] = { type: "defacto", j: unitById[it.unit].jurisdiction, unit: it.unit, cats: [], period: "df", title: s.title, ref: unitById[it.unit].name, url: s.url }; out.push(r); }
        if (r.cats.indexOf(it.mechanism) < 0) r.cats.push(it.mechanism);
      });
    });
    UNITS.forEach(function (u) {
      (D.deFacto.generalSources[u] || []).forEach(function (s) {
        out.push({ type: "defacto", j: unitById[u].jurisdiction, unit: u, cats: [], period: "df", title: s.title, ref: unitById[u].name + " · cited for the whole observation", url: s.url });
      });
    });
    out.forEach(function (r) {
      r.hay = [r.title, r.ref, r.excerpt || "", r.translation || "", r.url || "", jurName[r.j] || "",
               r.cats.map(function (id) { return mechById[id].name + " " + mechById[id].code + " " + mechById[id].indicator; }).join(" ")].join(" ").toLowerCase();
    });
    return (LIB = out);
  }
  function dataLibrary(host, params) {
    var recs = libraryRecords();
    var F = { type: LIB_TYPES.some(function (t) { return t[0] === params.type; }) ? params.type : "", j: jurByCode[(params.j || "").toUpperCase()] ? params.j.toUpperCase() : "",
              dim: dimById[(params.dim || "").toUpperCase()] ? params.dim.toUpperCase() : "", cat: mechById[+params.cat] ? String(+params.cat) : "",
              period: params.period === "dj" || params.period === "df" ? params.period : "", q: params.q || "" };
    var shown = 40;
    host.appendChild(chartHead("Source and evidence library: " + recs.length + " records",
      "The legal instruments, the full texts and verbatim provisions behind the De Jure scores, and the sources behind the De Facto scores. Each record names the scored observations it supports."));
    add(host, mq("codingRecord"));
    var bar = el("div", "toolbar lib-bar"), left = el("div", "ctrl-left");
    function sel(label, key, options) {
      var s2 = selectOf(label, options, function (v) { F[key] = v; if (key === "dim") { F.cat = ""; fillCats(); } shown = 40; draw(); });
      s2.value = F[key];
      return s2;
    }
    var sType = sel("Legal instrument or source type", "type", [["", "All record types"]].concat(LIB_TYPES));
    var sJ = sel("Jurisdiction", "j", [["", "All jurisdictions"]].concat(CODES.map(function (c) { return [c, jurName[c]]; })));
    var sD = sel("Dimension", "dim", [["", "All dimensions"]].concat(DIMS.map(function (d) { return [d, d + " " + DIM_SHORT[d]]; })));
    var sC = el("select", "pselect");
    sC.setAttribute("aria-label", "Obligation category");
    function fillCats() {
      sC.textContent = "";
      sC.appendChild(new Option("All obligation categories", ""));
      D.mechanisms.filter(function (m) { return !F.dim || m.dimension === F.dim; }).forEach(function (m) { sC.appendChild(new Option(m.id + ". " + m.name, String(m.id))); });
      sC.value = F.cat;
    }
    fillCats();
    sC.addEventListener("change", function () { F.cat = sC.value; shown = 40; draw(); });
    var sP = sel("Applicable period", "period", [["", "All periods"], ["dj", "De Jure: law in force, " + DJ_DATE], ["df", "De Facto: " + DF_BASE + " and " + DF_NOW]]);
    var q = el("input");
    q.type = "search";
    q.placeholder = "Search titles and provisions, or a scored observation such as dj:JP:D2.2";
    q.value = F.q;
    q.setAttribute("aria-label", "Search the library");
    q.addEventListener("input", function () { F.q = q.value; shown = 40; draw(); });
    add(left, sType, sJ, sD, sC, sP, q);
    bar.appendChild(left);
    host.appendChild(bar);
    var count = el("p", "small muted"), list = el("div", "lib-list"), more = el("p");
    var hitsNow = [];
    function obsIds(r) { return r.cats.slice().sort(function (a, b) { return a - b; }).map(function (id) {
      return r.type === "defacto" ? recordId("df", r.unit, mechById[id], "current") : recordId("dj", r.j, mechById[id], "current"); }); }
    bar.appendChild(dlButton("contestability_sources.csv", ["record_type", "jurisdiction", "pair", "title", "reference", "url", "scored_observations", "provision_text", "english_translation"], function () {
      return hitsNow.map(function (r) { return [r.type, r.j, r.unit || "", r.title, r.ref || "", r.url || "", obsIds(r).join(" "), r.excerpt || "", r.translation || ""]; });
    }, "Download these records (CSV)"));
    add(host, count, list, more);
    host.appendChild(el("h3", "pane-title", "Browse the legal record by jurisdiction"));
    var chips = el("div", "chips");
    CODES.forEach(function (c) { var a = link("#/legal/" + c, jurName[c]); a.className = "chip"; chips.appendChild(a); });
    host.appendChild(chips);

    function obsButtons(r) {
      var box = el("div", "lib-obs");
      if (!r.cats.length) return null;
      box.appendChild(el("span", "small muted", "Scored observation" + (r.cats.length > 1 ? "s" : "") + ": "));
      r.cats.slice().sort(function (a, b) { return a - b; }).forEach(function (id) {
        var m = mechById[id];
        var label = r.type === "defacto" ? recordId("df", r.unit, m, "current") : recordId("dj", r.j, m, "current");
        var b = recordLink(label, function () { if (r.type === "defacto") openIndicator(r.unit, id); else { matrixOrder = CODES; openCell(id, r.j); } });
        b.title = (r.type === "defacto" ? m.code + " " + m.indicator : m.id + ". " + m.name) + ": open the score and its evidence";
        box.appendChild(b);
      });
      return box;
    }
    function draw() {
      var terms = F.q.toLowerCase().split(/\s+/).filter(Boolean);
      var hits = recs.filter(function (r) {
        if (F.type && r.type !== F.type) return false;
        if (F.j && r.j !== F.j) return false;
        if (F.period && r.period !== F.period) return false;
        if (F.cat && r.cats.indexOf(+F.cat) < 0) return false;
        if (F.dim && !r.cats.some(function (id) { return mechById[id].dimension === F.dim; })) return false;
        if (terms.length) {
          var ids = r.cats.map(function (id) { return (r.type === "defacto" ? recordId("df", r.unit, mechById[id], "current") : recordId("dj", r.j, mechById[id], "current")).toLowerCase(); }).join(" ");
          if (!terms.every(function (t) { return r.hay.indexOf(t) >= 0 || ids.indexOf(t) >= 0; })) return false;
        }
        return true;
      });
      hitsNow = hits;
      count.textContent = hits.length + " of " + recs.length + " records" + (F.dim || F.cat ? ". Records not tied to an obligation category (full texts, some instruments) are left out by a dimension or category filter." : ".");
      list.textContent = "";
      hits.slice(0, shown).forEach(function (r) {
        var c = el("div", "lib-rec"), hd = el("div", "lib-head");
        add(hd, el("span", "badge", LIB_TYPES.filter(function (t) { return t[0] === r.type; })[0][1]), el("span", "badge form", jurName[r.j] || r.j),
            r.flag ? el("span", "badge warn", r.flag) : null);
        c.appendChild(hd);
        if (r.doc) c.appendChild(add(el("h4"), recordLink(r.title, function () { openDoc(r.doc); })));
        else c.appendChild(el("h4", null, r.title));
        if (r.ref) c.appendChild(el("p", "small", r.ref));
        if (r.url) c.appendChild(add(el("p", "small"), "Source reference: ", extLink(r.url, r.urlLabel || domain(r.url))));
        if (r.excerpt) {
          var d = fold("Provision text", r.translation ? "with English translation" : null, [el("blockquote", null, r.excerpt), r.translation ? el("blockquote", "translation", r.translation) : null]);
          c.appendChild(d);
        }
        if (r.type === "defacto" && r.cats.length) {
          // the coded evidence of the observations this source supports (the database holds no excerpt of the source itself)
          var ev = r.cats.slice().sort(function (a, b) { return a - b; }).map(function (id) {
            var it = D.deFacto.items.filter(function (x) { return x.unit === r.unit && x.mechanism === id; })[0];
            if (!it || !it.evidence) return null;
            var t = it.evidence.length > 420 ? it.evidence.slice(0, 420).replace(/\s+\S*$/, "") + " …" : it.evidence;
            return add(el("p", "small"), el("strong", null, mechById[id].code + " " + mechById[id].indicator + ": "), t);
          }).filter(Boolean);
          if (ev.length) c.appendChild(fold("Evidence excerpt", "the coded evidence of the observations it supports", ev));
        }
        add(c, obsButtons(r));
        list.appendChild(c);
      });
      more.textContent = "";
      if (hits.length > shown) {
        var b = el("button", "btn btn-outline", "Show " + Math.min(40, hits.length - shown) + " more");
        b.type = "button";
        b.addEventListener("click", function () { shown += 40; draw(); });
        more.appendChild(b);
      }
      var qs = ["type", "j", "dim", "cat", "period", "q"].filter(function (k) { return F[k]; }).map(function (k) { return k + "=" + encodeURIComponent(F[k]); }).join("&");
      history.replaceState(null, "", "#/data/library" + (qs ? "?" + qs : ""));
    }
    draw();
  }

  /* ---------------------------------------------------------- documentation and versioning */
  function dataDocs(host) {
    var c = citeText();
    host.appendChild(el("h3", "pane-title", "Citation"));
    host.appendChild(el("p", null, c.paper));
    host.appendChild(tbdP("How to cite the dataset itself, and the licence it is released under. Until then, cite the working paper and give the database build shown above."));

    host.appendChild(el("h3", "pane-title", "Data dictionary"));
    host.appendChild(aiP("The columns of the three score downloads. The field descriptions are drafted from the database; the definitions of the scores themselves are in the Methodology."));
    [["dejure", "De Jure (contestability_dejure.csv)"], ["defacto", "De Facto (contestability_defacto.csv)"], ["indices", "Aggregated indices (contestability_indices.csv)"]].forEach(function (x) {
      var t = el("table", "plain");
      t.appendChild(add(el("tr"), el("th", null, "Column"), el("th", null, "Meaning")));
      DICT[x[0]].forEach(function (r) { t.appendChild(add(el("tr"), el("td", "mono", r[0]), el("td", "small", r[1]))); });
      host.appendChild(fold(x[1], DICT[x[0]].length + " groups of columns", [add(el("div", "table-scroll"), t)]));
    });
    host.appendChild(add(el("p", "small"), link("#/data/downloads?set=meta", "Definitions, coding identifiers and missing-value conventions →")));

    host.appendChild(el("h3", "pane-title", "Data coverage"));
    var nInst = Object.keys(D.instruments).reduce(function (n, k) { return n + D.instruments[k].length; }, 0);
    var mdj = function (p) { return D.markets.deJure.filter(function (r) { return r.period === p; }).length; };
    var cov = el("table", "plain");
    cov.appendChild(add(el("tr"), el("th", null, "Layer"), el("th", null, "Unit"), el("th", null, "Observed"), el("th", "num", "Records")));
    [["De Jure", nJ + " jurisdictions × " + nM + " obligation categories", DJ_DATE, D.meta.totalCells],
     ["De Jure, market level", "pairs × the obligations that bind the market", month((D.periods["de_jure|market|baseline"] || {}).observed), mdj("baseline")],
     ["De Jure, market level", "pairs × the obligations that bind the market", month((D.periods["de_jure|market|current"] || {}).observed), mdj("current")],
     ["De Facto", nU + " gatekeeper–market pairs × " + nM + " indicators", DF_BASE, D.deFacto.items.length],
     ["De Facto", nU + " gatekeeper–market pairs × " + nM + " indicators", DF_NOW, D.deFacto.items.length],
     ["Sources", "legal instruments · full texts · verbatim provisions", "", nInst + " · " + D.documents.length + " · " + D.meta.extractCount]].forEach(function (x) {
      cov.appendChild(add(el("tr"), el("td", null, x[0]), el("td", "small", x[1]), el("td", "small", x[2]), el("td", "num", String(x[3]))));
    });
    host.appendChild(add(el("div", "table-scroll"), cov));
    host.appendChild(add(el("p", "small"), "Jurisdictions: " + CODES.map(function (c2) { return jurName[c2]; }).join(", ") + ". Pairs: " +
      UNITS.map(function (u) { return unitById[u].name + " (" + unitPlace(u) + ")"; }).join(", ") + "."));

    host.appendChild(el("h3", "pane-title", "Methodology and appendix"));
    host.appendChild(add(el("p"), link("#/methodology", "Methodology on this site"), " · ", link("#/methodology/docs", "Technical documentation"), " · ", extLink(APPENDIX, "Online appendix")));

    host.appendChild(el("h3", "pane-title", "Update history"));
    var uh = el("table", "plain");
    uh.appendChild(add(el("tr"), el("th", null, "Date"), el("th", null, "What")));
    uh.appendChild(add(el("tr"), el("td", null, String(D.meta.built || "").replace(/ .*$/, "")), el("td", "small", "Database build used by this site (" + D.meta.built + "): " + nM +
      " obligation categories in " + nJ + " jurisdictions; De Facto for " + nU + " pairs at two dates.")));
    host.appendChild(uh);
    host.appendChild(tbdP("Version numbers and the record of earlier and later releases."));

    host.appendChild(el("h3", "pane-title", "Differences from the working paper"));
    dataPaper(host);

    host.appendChild(el("h3", "pane-title", "Repository"));
    host.appendChild(add(el("p"), extLink(REPO, "The site and its data files on GitHub"), " · ", link(D.meta.dbUrl, "Download the complete database")));
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

  function pageLegal(app, code) {
    document.title = "Legal documents · The Contestability Index";
    code = jurByCode[code] ? code : "EU";
    var s = section(), w = el("div", "wrap");
    w.appendChild(add(el("p", "small"), link("#/data/library?j=" + code, "← Source and evidence library")));
    var nExtracts = Object.keys(D.cells).reduce(function (n, k) { return n + (D.cells[k].extracts || []).length; }, 0);
    var nInst = Object.keys(D.instruments).reduce(function (n, k) { return n + D.instruments[k].length; }, 0);
    head(w, "Data & Sources · legal record", "The law behind every score",
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
      var c = cellOf(m.id, code), b = el("button", "open-doc opens-panel", "Details");
      b.type = "button";
      b.style.cssText = "background:none;border:1px solid var(--purple);color:var(--purple);border-radius:3px;padding:1px 8px;font-size:.76rem;font-weight:700;cursor:pointer";
      b.addEventListener("click", function () { matrixOrder = CODES; openCell(m.id, code); });
      t2.appendChild(add(el("tr"), add(el("td"), link("#/methodology/" + m.code, m.id + ". " + m.name)), paint(el("td", "sc", glyph(c.score)), c.score),
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

  /* ========================================================== ABOUT (linked from the footer) */
  function pageAbout(app) {
    document.title = "About · The Contestability Index";
    var s = section(), w = el("div", "wrap prose");
    head(w, "About", "About the index");
    w.appendChild(aiP("The Contestability Index measures the opportunity for incumbent positions in digital markets to be challenged, rather than market structure " +
      "or outcomes. It is developed in the working paper Beyond Market Concentration: Measuring Contestability in Digital Markets by Zhiyang Cheng, Tracy Xu " +
      "and Amr Yakout (July 2026)."));
    w.appendChild(aiP("The project is affiliated with the Knight-Georgetown Institute (KGI) at Georgetown University."));
    w.appendChild(aiP("The De Jure layer covers " + words(nJ) + " jurisdictions: " + theNames(CODES) +
      ". The De Facto layer covers " + words(nU) + " gatekeeper–market pairs. Both use the same " + words(nM) + " mechanisms in " + words(nD) + " dimensions."));
    w.appendChild(el("h3", null, "Research team and contact"));
    w.appendChild(el("p", null, "Zhiyang Cheng, Tracy Xu and Amr Yakout."));
    w.appendChild(tbdP("Contact address, and the licence for the data and the site."));
    w.appendChild(el("h3", null, "How to cite"));
    w.appendChild(el("p", null, citeText().paper));
    w.appendChild(tbdP("How to cite the dataset itself."));
    w.appendChild(el("h3", null, "Status of these figures"));
    w.appendChild(aiP(["The site is a preliminary preview. Its figures come from the project database built " + D.meta.built + " and may change. Where they differ from the working paper, ",
      link("#/data/docs", "Data & Sources"), " lists each difference and its reason."]));
    w.appendChild(el("h3", null, "How the site works"));
    w.appendChild(aiP("The site is a set of static files. When a page opens, your browser downloads a copy of the project database without the legal " +
      "full texts (SQLite, " + (D.meta.dbBytes / 1e6).toFixed(1) + " MB) and computes every figure from it with sql.js. A full text is fetched only when you open one. " +
      "The download is the whole database" + (D.meta.fullDbBytes ? " (" + (D.meta.fullDbBytes / 1e6).toFixed(1) + " MB)" : "") + "; its scores are the same rows."));
    w.appendChild(add(el("p"), extLink(APPENDIX, "Online appendix"), " · ", link(D.meta.dbUrl, "Download the database"), " · ", extLink(REPO, "Repository")));
    s.appendChild(w);
    app.appendChild(s);
  }

  /* ------------------------------------------------------------ router */
  // Addresses of earlier versions of the site keep working.
  var LEGACY = { overview: "#/", dejure: "#/explore/dejure", defacto: "#/explore/defacto", markets: "#/explore/defacto", methodology: "#/methodology" };
  var MOVED = { cases: "#/applications", scoring: "#/methodology", jurisdictions: "#/explore/dejure?view=rank" };
  function parseQuery(q) {
    var p = {};
    String(q || "").split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("=");
      try { p[i < 0 ? kv : kv.slice(0, i)] = i < 0 ? "" : decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* a broken escape is ignored */ }
    });
    return p;
  }
  function render() {
    var h = location.hash.replace(/^#/, "");
    if (LEGACY[h]) { location.replace(LEGACY[h]); return; }
    var qi = h.indexOf("?"), q = qi >= 0 ? h.slice(qi + 1) : "", path = (qi >= 0 ? h.slice(0, qi) : h).replace(/^\//, "");
    var parts = path.split("/"), page = parts[0] || "overview", arg = parts[1] || "";
    if (MOVED[page]) { location.replace(MOVED[page]); return; }
    if (page === "legal" && !jurByCode[arg.toUpperCase()]) { location.replace("#/data/library"); return; }
    if (page === "jurisdiction" && !jurByCode[arg.toUpperCase()]) { location.replace("#/explore/dejure?view=rank"); return; }
    closePanel(true);
    ttHide();
    var app = $("#app");
    app.textContent = "";
    cmpButtons = [];
    document.title = "The Contestability Index";
    var navKey = page === "explore" || page === "jurisdiction" ? "explore" : page === "data" || page === "legal" ? "data"
               : page === "methodology" || page === "applications" || page === "about" ? page : "overview";
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    links.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    var params = parseQuery(q);
    if (page === "explore") {
      if (q) { S.cat = null; readQuery(q); }
      if (arg === "defacto") pageDeFacto(app);
      else if (arg === "compare") pageCompare(app);
      else pageDeJure(app);
    }
    else if (page === "jurisdiction") pageJurisdiction(app, arg.toUpperCase(), (params.dim || "").toUpperCase());
    else if (page === "methodology") pageMethodology(app, arg);
    else if (page === "applications") { if (arg) pageApplication(app, arg); else pageApplications(app); }
    else if (page === "data") pageData(app, arg, params);
    else if (page === "legal") pageLegal(app, arg.toUpperCase());
    else if (page === "about") pageAbout(app);
    else pageOverview(app);
    if (!(page === "methodology" && arg) && !(page === "jurisdiction" && params.dim) && !(page === "explore" && S.cat !== null)) window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  render();
};
