/* The Contestability Index — rendering and interaction.
   Vanilla JS. Reads window.CI_DATA, which js/db.js builds from the project database, and window.CI_WORLD.
   db.js calls window.CI_BOOT once the database is open. */
window.CI_BOOT = function () {
  "use strict";
  var D = window.CI_DATA, W = window.CI_WORLD;

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
  // Rounded half up, as the Handbook and the paper print (0.475 -> 0.48); toFixed alone would give 0.47.
  function num(v, d) {
    if (v === null || v === undefined) return "—";
    var p = d === undefined ? 2 : d, k = Math.pow(10, p), s = v < 0 ? -1 : 1;
    return (s * Math.round(Math.abs(v) * k + 1e-9) / k).toFixed(p);
  }
  function glyph(v) { return v === 1 ? "1" : v === 0.5 ? "½" : v === 0 ? "0" : "—"; }
  function tier(v) { return v === 1 ? "s100" : v === 0.5 ? "s50" : "s0"; }
  function pretty(s) {
    if (!s) return "";
    return String(s).replace(/_/g, " ").replace(/\+/g, " + ")
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function domain(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; } }
  function extLink(url, text) {
    var a = el("a", "ext", text || domain(url));
    a.setAttribute("href", url);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    return a;
  }

  var jurName = {}, jurByCode = {};
  D.jurisdictions.forEach(function (j) { jurName[j.code] = j.name; jurByCode[j.code] = j; });
  var mechById = {};
  D.mechanisms.forEach(function (m) { mechById[m.id] = m; });
  var dimById = {};
  D.dimensions.forEach(function (d) { dimById[d.id] = d; });

  var ranked = D.jurisdictions.map(function (j) { return j.code; }).sort(function (a, b) {
    return D.aggregates[b].overall - D.aggregates[a].overall;
  });
  function cellOf(pid, code) { return D.cells[pid + "|" + code]; }

  /* ------------------------------------------------------------ header */
  $("#metaline").textContent =
    "De jure snapshot " + D.meta.evidenceDate + " · " + D.meta.mechanismCount +
    " obligation categories × " + D.meta.jurisdictionCount + " jurisdictions = " +
    D.meta.totalCells + " assessments · " + D.meta.extractCount +
    " verbatim legal extracts · database built " + D.meta.built;

  $("#ribbon").hidden = false;
  $("#ribbon-text").textContent = " Preliminary — the figures on this site may still change.";

  function dbLink(text) {
    var a = el("a", null, text);
    a.setAttribute("href", D.meta.dbUrl);
    a.setAttribute("download", "contestability.db");
    return a;
  }
  var footNote = $("#footer-note");
  footNote.textContent = "Every figure on this site is computed in your browser from the project database, ";
  footNote.appendChild(dbLink("contestability.db"));
  footNote.appendChild(document.createTextNode(
    " (SQLite), which you can download. Published figures shown for comparison are transcribed from the paper."));

  /* ------------------------------------------------------------ tabs */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function showTab(name) {
    tabs.forEach(function (b) {
      var on = b.dataset.tab === name;
      b.setAttribute("aria-selected", on ? "true" : "false");
      $("#view-" + b.dataset.tab).hidden = !on;
    });
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
    window.scrollTo(0, 0);
  }
  tabs.forEach(function (b) {
    b.addEventListener("click", function () { showTab(b.dataset.tab); });
  });
  window.addEventListener("hashchange", function () {
    var h = location.hash.slice(1);
    if (h && $("#view-" + h)) showTab(h);
  });

  /* ------------------------------------------------------------ tooltip */
  var tt = $("#tooltip");
  function ttShow(lines, x, y) {
    tt.textContent = "";
    lines.forEach(function (l) { tt.appendChild(el("div", null, l)); });
    tt.hidden = false;
    ttMove(x, y);
  }
  function ttMove(x, y) {
    var r = tt.getBoundingClientRect();
    tt.style.left = Math.min(x + 14, window.innerWidth - r.width - 10) + "px";
    tt.style.top = Math.max(8, y - r.height - 12) + "px";
  }
  function ttHide() { tt.hidden = true; }
  window.addEventListener("scroll", ttHide, { passive: true });
  function withTip(node, linesFn) {
    node.addEventListener("pointerenter", function (e) { ttShow(linesFn(), e.clientX, e.clientY); });
    node.addEventListener("pointermove", function (e) { ttMove(e.clientX, e.clientY); });
    node.addEventListener("pointerleave", ttHide);
    node.addEventListener("focus", function () {
      var r = node.getBoundingClientRect();
      ttShow(linesFn(), r.left + r.width / 2, r.top);
    });
    node.addEventListener("blur", ttHide);
  }

  /* ========================================================== OVERVIEW */

  /* -- the two layers side by side, and the paper's four ways of relating them (section 3.5) -- */
  var unitById = {};
  D.deFacto.units.forEach(function (u) { unitById[u.id] = u; });
  function effOf(unit, period) {
    return D.effective.filter(function (e) { return e.unit === unit && e.period === period; })[0];
  }

  (function renderGap() {
    var host = $("#gap");
    var list = el("div", "gap-list");
    D.deFacto.units.forEach(function (u) {
      var e = effOf(u.id, "current");
      if (!e) return;
      var row = el("div", "gap-row");
      var head = el("div", "gap-head");
      head.appendChild(el("strong", null, u.name));
      head.appendChild(el("span", "muted small", " · " + u.market));
      row.appendChild(head);

      [["De jure — what the law mandates", e.deJure, "dj"],
       ["De facto — what was observed", e.deFacto, "df"]].forEach(function (p) {
        var line = el("div", "gap-bar-line");
        line.appendChild(el("span", "gap-label", p[0]));
        var track = el("span", "gap-track");
        var fill = el("span", "gap-fill " + p[2]);
        fill.style.width = (p[1] * 100).toFixed(1) + "%";
        track.appendChild(fill);
        line.appendChild(track);
        line.appendChild(el("span", "gap-val", num(p[1])));
        row.appendChild(line);
      });

      var foot = el("p", "gap-foot");
      foot.appendChild(el("strong", null, "Implementation gap " + num(e.gap)));
      foot.appendChild(document.createTextNode(
        " · product " + num(e.multiplicative) + " · arithmetic mean " + num(e.arithmetic) +
        " · binding layer " + num(e.bottleneck)));
      row.appendChild(foot);
      list.appendChild(row);
    });
    host.appendChild(list);

    host.appendChild(el("h3", "eff-title", "The four specifications, at both observation dates"));
    var wrap = el("div", "table-scroll");
    var t = el("table", "plain eff-table");
    var hr = el("tr");
    ["Gatekeeper–market", "Observed", "De jure", "De facto", "Product (5)",
     "Arithmetic, λ = " + D.meta.lambda + " (6)", "Binding layer (7)", "Gap (8)"]
      .forEach(function (x, i) { hr.appendChild(el("th", i > 1 ? "num" : null, x)); });
    t.appendChild(hr);
    D.effective.forEach(function (e) {
      var tr = el("tr");
      tr.appendChild(el("td", null, (unitById[e.unit] || {}).name || e.unit));
      tr.appendChild(el("td", "small", e.period === "baseline" ? "December 2023"
        : "June 2026 (de jure), July 2026 (de facto)"));
      [e.deJure, e.deFacto, e.multiplicative, e.arithmetic, e.bottleneck, e.gap].forEach(function (v) {
        tr.appendChild(el("td", "num", num(v)));
      });
      t.appendChild(tr);
    });
    wrap.appendChild(t);
    host.appendChild(wrap);
    var noBase = D.effective.filter(function (e) { return e.deJure === null; })
      .map(function (e) { return (unitById[e.unit] || {}).name; });
    host.appendChild(el("p", "small muted",
      "Equation numbers are the paper's. The paper uses the product for contestability that is both formally " +
      "supported and practically realised; the arithmetic mean treats the layers as partly substitutable; the " +
      "binding layer takes the weaker of the two; the gap is descriptive and is not a composite." +
      (noBase.length ? " " + noBase.join(", ") + " has no December 2023 de jure baseline, so its baseline row shows the de facto score only." : "")));
  })();

  /* ---------------------------- world map ---------------------------- */
  (function renderMap() {
    var host = $("#map");
    if (!W || !W.countries) { host.appendChild(el("p", "muted", "Map data unavailable.")); return; }

    var idToJur = {};
    D.jurisdictions.forEach(function (j) {
      (j.mapIds || []).forEach(function (id) {
        // A country already claimed by a national regime keeps it; the bloc is recorded separately.
        if (idToJur[id]) { idToJur[id + "_extra"] = j.code; } else { idToJur[id] = j.code; }
      });
    });
    // Germany sits inside the EU: shade it with the EU, mark it as also having a national regime.
    var dualIds = { "276": true };

    var s = svg("svg", { viewBox: W.viewBox, class: "worldmap", role: "img",
                         "aria-label": "World map showing which jurisdictions are assessed by the index" });
    var defs = svg("defs");
    var pat = svg("pattern", { id: "dual", width: 6, height: 6, patternUnits: "userSpaceOnUse",
                               patternTransform: "rotate(45)" });
    pat.appendChild(svg("rect", { width: 6, height: 6, fill: "var(--s100)" }));
    pat.appendChild(svg("rect", { width: 2.2, height: 6, fill: "var(--surface)", opacity: 0.85 }));
    defs.appendChild(pat);
    s.appendChild(defs);

    Object.keys(W.countries).forEach(function (id) {
      var c = W.countries[id];
      var code = idToJur[id];
      var isEUmember = code === "EU";
      var p = svg("path", { d: c.d });
      if (!code) {
        p.setAttribute("class", "c-none");
        p.setAttribute("aria-hidden", "true");
        s.appendChild(p);
        return;
      }
      var score = D.aggregates[code] ? D.aggregates[code].overall : null;
      p.setAttribute("class", "c-jur " + scoreClass(score));
      if (dualIds[id]) p.setAttribute("fill", "url(#dual)");
      p.setAttribute("tabindex", "0");
      p.setAttribute("role", "button");
      var label = dualIds[id]
        ? c.n + ": covered by the European Union regime and by its own national regime"
        : (isEUmember ? c.n + ", European Union" : c.n);
      p.setAttribute("aria-label", label + ", de jure index " + num(score));
      withTip(p, function () {
        var lines = [label, "De jure index " + num(score)];
        if (dualIds[id]) lines.push("Germany scores " + num(D.aggregates.DE.overall) + " on its own regime");
        lines.push("Click to open the record");
        return lines;
      });
      p.addEventListener("click", function () { openJurisdiction(dualIds[id] ? "DE" : code); });
      p.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openJurisdiction(dualIds[id] ? "DE" : code); }
      });
      s.appendChild(p);
    });
    host.appendChild(s);

    var lg = $("#map-legend");
    [["c-none", "Not assessed"], ["sc-low", "0 to 0.33"], ["sc-mid", "0.34 to 0.66"], ["sc-high", "0.67 to 1"]]
      .forEach(function (p) {
        var k = el("span", "key");
        k.appendChild(el("span", "swatch " + p[0]));
        k.appendChild(el("span", null, p[1]));
        lg.appendChild(k);
      });
    var k2 = el("span", "key");
    var sw = el("span", "swatch swatch-dual");
    k2.appendChild(sw);
    k2.appendChild(el("span", null, "Also has a national regime"));
    lg.appendChild(k2);

    $("#map-note").textContent =
      "Equal Earth projection, chosen because it preserves relative area: on a Mercator map the " +
      "high-latitude jurisdictions would look far larger than they are, and area is doing the work here. " +
      "The twenty-seven European Union member states carry the European Union score; Germany is hatched " +
      "because it is covered both by that regime and by its own. Malta is absent from the boundary data at " +
      "this resolution. Grey means not assessed, which is not a score of zero.";
  })();

  function scoreClass(v) {
    if (v === null || v === undefined) return "c-none";
    return v >= 0.67 ? "sc-high" : v >= 0.34 ? "sc-mid" : "sc-low";
  }

  /* ---------------------------- ranking ------------------------------ */
  (function renderRanking() {
    var host = $("#ranking");
    ranked.forEach(function (code) {
      var a = D.aggregates[code];
      var row = el("button", "bar-row");
      row.type = "button";
      row.appendChild(el("span", "bar-name", jurName[code]));
      var track = el("span", "bar-track");
      var fill = el("span", "bar-fill");
      fill.style.width = (a.overall * 100).toFixed(1) + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("span", "bar-val", num(a.overall)));
      withTip(row, function () {
        return [jurName[code], "Overall " + num(a.overall),
                D.dimensions.map(function (d) { return d.id + " " + num(a.dims[d.id]); }).join("  ")];
      });
      row.addEventListener("click", function () { openJurisdiction(code); });
      host.appendChild(row);
    });
  })();

  /* ------------------------- dimension panels ------------------------ */
  (function renderDimGrid() {
    var host = $("#dimgrid");
    D.dimensions.forEach(function (d) {
      var p = el("div", "dim-panel");
      p.appendChild(el("h3", null, d.id + " · " + d.name));
      var q = (D.paper.dimensionQuestions || {})[d.id];
      if (q) p.appendChild(el("p", "dim-q muted small", q.question));
      ranked.forEach(function (code) {
        var v = D.aggregates[code].dims[d.id];
        var row = el("div", "mini-row");
        row.appendChild(el("span", "mini-name", code));
        var track = el("span", "mini-track");
        var fill = el("span", "mini-fill");
        fill.style.width = (v * 100).toFixed(1) + "%";
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(el("span", "mini-val", num(v)));
        p.appendChild(row);
      });
      host.appendChild(p);
    });
  })();

  /* ========================================================== DE JURE */

  $("#dj-count").textContent = D.meta.totalCells;

  var dimFilter = null, jurFilter = null;

  (function renderFilters() {
    var host = $("#filters");
    var chips = el("div", "chips");
    function chip(label, val) {
      var b = el("button", "chip" + (val === dimFilter ? " on" : ""), label);
      b.type = "button";
      b.setAttribute("aria-pressed", val === dimFilter ? "true" : "false");
      b.addEventListener("click", function () {
        dimFilter = (dimFilter === val) ? null : val;
        renderHeatmap();
        Array.prototype.forEach.call(chips.children, function (c) {
          var on = c.dataset.val === String(dimFilter);
          c.classList.toggle("on", on);
          c.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });
      b.dataset.val = String(val);
      return b;
    }
    chips.appendChild(chip("All dimensions", null));
    D.dimensions.forEach(function (d) { chips.appendChild(chip(d.id + " " + d.name, d.id)); });
    host.appendChild(chips);

    var sel = el("select", "jur-select");
    sel.setAttribute("aria-label", "Highlight a jurisdiction");
    sel.appendChild(new Option("All jurisdictions", ""));
    ranked.forEach(function (c) { sel.appendChild(new Option(jurName[c], c)); });
    sel.addEventListener("change", function () {
      jurFilter = sel.value || null;
      renderHeatmap();
      renderProfile();
    });
    host.appendChild(sel);
  })();

  function renderProfile() {
    var host = $("#profile");
    host.textContent = "";
    if (!jurFilter) { host.hidden = true; return; }
    host.hidden = false;
    var a = D.aggregates[jurFilter], j = jurByCode[jurFilter];
    host.appendChild(el("h3", null, jurName[jurFilter]));
    var stats = el("p", "profile-stats");
    stats.appendChild(el("strong", null, "Overall " + num(a.overall)));
    D.dimensions.forEach(function (d) {
      stats.appendChild(el("span", "stat", d.id + " " + num(a.dims[d.id])));
    });
    host.appendChild(stats);

    var counts = {};
    D.mechanisms.forEach(function (m) {
      var f = cellOf(m.id, jurFilter).legal_form;
      if (f) counts[f] = (counts[f] || 0) + 1;
    });
    var mix = Object.keys(counts).sort(function (x, y) { return counts[y] - counts[x]; })
      .map(function (f) { return pretty(f) + " ×" + counts[f]; }).join(" · ");
    host.appendChild(el("p", "small muted", "Legal forms across the " + D.mechanisms.length + " categories: " + mix));

    if (j.enforcementNote) host.appendChild(el("p", "small", j.enforcementNote));

    var inst = D.instruments[jurFilter] || [];
    if (inst.length) {
      host.appendChild(el("h4", null, "Instruments on the record"));
      var ul = el("ul", "inst-list");
      inst.forEach(function (i) {
        var li = el("li");
        li.appendChild(el("strong", null, i.name));
        if (i.citation) li.appendChild(el("span", "muted small", " · " + i.citation));
        if (i.pipeline) li.appendChild(el("span", "badge warn-badge", "Not yet in force"));
        if (i.url) { li.appendChild(document.createTextNode(" ")); li.appendChild(extLink(i.url, i.sourceLabel || domain(i.url))); }
        if (i.status) li.appendChild(el("div", "small muted", i.status));
        ul.appendChild(li);
      });
      host.appendChild(ul);
    }

    var disc = (D.paper.discrepancies || []).filter(function (d) { return d.code === jurFilter; })[0];
    if (disc) {
      var warn = el("div", "callout warn-callout");
      warn.appendChild(el("strong", null, "This jurisdiction differs from the published paper. "));
      warn.appendChild(document.createTextNode(
        "The site shows the current master coding sheet (" + disc.detail.join("; ") + "). " + disc.why));
      host.appendChild(warn);
    }
  }

  function openJurisdiction(code) {
    showTab("dejure");
    jurFilter = code;
    var sel = $(".jur-select");
    if (sel) sel.value = code;
    renderHeatmap();
    renderProfile();
  }

  var cellButtons = {};

  function renderHeatmap() {
    var host = $("#heatmap");
    host.textContent = "";
    cellButtons = {};

    var table = el("table", "heat");
    var thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "corner", "Obligation category"));
    ranked.forEach(function (code) {
      var th = el("th", "jur-head" + (jurFilter && jurFilter !== code ? " dim" : ""), code);
      th.setAttribute("title", jurName[code]);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    D.dimensions.forEach(function (d) {
      if (dimFilter && dimFilter !== d.id) return;
      var sep = el("tr", "dim-sep");
      var sc = el("td", null, d.id + " — " + d.name.toUpperCase());
      sc.colSpan = ranked.length + 1;
      sep.appendChild(sc);
      tbody.appendChild(sep);

      D.mechanisms.filter(function (m) { return m.dimension === d.id; }).forEach(function (m) {
        var tr = el("tr");
        var name = el("th", "mech-name");
        name.appendChild(el("span", "mech-num", m.id + "."));
        name.appendChild(el("span", null, " " + m.name));
        name.setAttribute("title", m.description || "");
        tr.appendChild(name);

        ranked.forEach(function (code) {
          var c = cellOf(m.id, code);
          var td = el("td", "cell-td" + (jurFilter && jurFilter !== code ? " dim" : ""));
          var b = el("button", "cell " + tier(c.score), glyph(c.score));
          b.type = "button";
          b.setAttribute("aria-label",
            m.name + ", " + jurName[code] + ", score " + c.score +
            ", minimum of existence " + c.existence + ", scope " + c.scope +
            ", enforceability " + c.enforceability);
          if (c.pipeline) b.appendChild(el("span", "pip", ""));
          if (c.extracts && c.extracts.length) b.classList.add("has-extract");
          withTip(b, function () {
            var l = [m.name + " · " + jurName[code],
                     "Score " + num(c.score) + "  =  min(E " + c.existence + ", S " + c.scope + ", Enf " + c.enforceability + ")"];
            if (c.binding && c.binding.length < 3) l.push("Binding factor: " + c.binding.map(pretty).join(", "));
            if (c.instrument_basis) l.push(c.instrument_basis);
            if (c.extracts && c.extracts.length) l.push("Verbatim legal text available");
            return l;
          });
          b.addEventListener("click", function () { openCell(m.id, code); });
          cellButtons[m.id + "|" + code] = b;
          td.appendChild(b);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    });
    table.appendChild(tbody);
    host.appendChild(table);

    var lg = $("#legend");
    lg.textContent = "";
    [["s0", "0 — no operative obligation"], ["s50", "½ — partial"], ["s100", "1 — full"]]
      .forEach(function (p) {
        var k = el("span", "key");
        k.appendChild(el("span", "swatch " + p[0]));
        k.appendChild(el("span", null, p[1]));
        lg.appendChild(k);
      });
    var k3 = el("span", "key");
    k3.appendChild(el("span", "swatch pip-key"));
    k3.appendChild(el("span", null, "Instrument announced but not yet in force (scores 0 until enacted)"));
    lg.appendChild(k3);
    var k4 = el("span", "key");
    k4.appendChild(el("span", "swatch extract-key"));
    k4.appendChild(el("span", null, "Verbatim legal text on file"));
    lg.appendChild(k4);
  }

  /* --------------------------- detail panel -------------------------- */
  var panel = $("#panel"), current = null;

  function openCell(pid, code) {
    var m = mechById[pid], c = cellOf(pid, code);
    current = { pid: pid, code: code };
    Object.keys(cellButtons).forEach(function (k) { cellButtons[k].classList.remove("active"); });
    if (cellButtons[pid + "|" + code]) cellButtons[pid + "|" + code].classList.add("active");
    ttHide();
    panel.textContent = "";

    var close = el("button", "close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close detail panel");
    close.addEventListener("click", closePanel);
    panel.appendChild(close);

    panel.appendChild(el("p", "crumb",
      m.dimension + " — " + dimById[m.dimension].name +
      " · category " + m.id + " of " + D.mechanisms.length));
    panel.appendChild(el("h2", null, m.name));
    if (m.description) panel.appendChild(el("p", "mech-desc muted", m.description));
    if (m.code) panel.appendChild(el("p", "small muted",
      "Observed in the de facto layer as indicator " + m.code + ", " + m.indicator + "."));
    panel.appendChild(el("p", "jname", jurName[code]));

    var fr = el("div", "factor-row");
    [["Existence", c.existence, "existence"], ["Scope", c.scope, "scope"],
     ["Enforceability", c.enforceability, "enforceability"]].forEach(function (f) {
      // Marking all three as binding when they are equal says nothing; only mark a real constraint.
      var informative = c.binding && c.binding.length < 3;
      var isBinding = informative && c.binding.indexOf(f[2]) !== -1;
      var box = el("div", "factor " + tier(f[1]) + (isBinding ? " binding" : ""));
      box.appendChild(el("span", "flabel", f[0]));
      box.appendChild(el("span", "fval", glyph(f[1])));
      if (isBinding) box.appendChild(el("span", "fbind", "binding"));
      fr.appendChild(box);
    });
    panel.appendChild(fr);

    var min = el("p", "formula-line");
    min.textContent = "Category score = min(" + c.existence + ", " + c.scope + ", " + c.enforceability + ") = " + c.score;
    panel.appendChild(min);
    if (c.binding && c.binding.length < 3) {
      panel.appendChild(el("p", "small",
        "The binding constraint here is " + c.binding.map(pretty).join(" and ") +
        ". Raising the other factors would not raise this score."));
    }
    panel.appendChild(el("p", "small muted",
      "The minimum rule reflects the complementarity of the three factors: broad enforcement cannot " +
      "substitute for a missing obligation, and a broadly written duty without credible enforcement " +
      "provides little effective protection."));

    if (c.factor_rationale) {
      panel.appendChild(el("h4", null, "Why this score"));
      panel.appendChild(el("p", null, c.factor_rationale));
    }

    panel.appendChild(el("h4", null, "Legal basis"));
    if (c.legal_form) panel.appendChild(el("span", "badge", pretty(c.legal_form)));
    if (c.instrument_basis) {
      var ib = el("p");
      ib.appendChild(el("strong", null, c.instrument_basis));
      panel.appendChild(ib);
    }
    if (c.legal_basis_full && c.legal_basis_full !== c.instrument_basis) {
      panel.appendChild(el("p", "sub small", c.legal_basis_full));
    }
    if (c.market_scope) panel.appendChild(el("p", "small", "Market scope: " + c.market_scope));

    if (c.extracts && c.extracts.length) {
      panel.appendChild(el("h4", null, "The legal text itself"));
      c.extracts.forEach(function (x) {
        var box = el("div", "extract");
        box.appendChild(el("div", "extract-head", x.instrument));
        if (x.summary) box.appendChild(el("div", "small muted", x.summary));
        if (x.text) box.appendChild(el("blockquote", null, x.text));
        if (x.translation) {
          box.appendChild(el("div", "small muted", "English translation"));
          box.appendChild(el("blockquote", "translation", x.translation));
        }
        if (x.sourcePath) box.appendChild(el("div", "small muted", "Source file: " + x.sourcePath));
        panel.appendChild(box);
      });
    }

    var inst = (D.instruments[code] || []).filter(function (i) {
      return c.instrument_basis && i.name &&
        (c.instrument_basis.indexOf(i.name.split(" (")[0]) !== -1 ||
         (c.legal_basis_full || "").indexOf(i.name.split(" (")[0]) !== -1);
    });
    if (inst.length) {
      panel.appendChild(el("h4", null, "Official sources"));
      var ul = el("ul", "inst-list");
      inst.forEach(function (i) {
        var li = el("li");
        li.appendChild(el("strong", null, i.name));
        if (i.url) { li.appendChild(document.createTextNode(" ")); li.appendChild(extLink(i.url, i.sourceLabel || domain(i.url))); }
        ul.appendChild(li);
      });
      panel.appendChild(ul);
    }

    if (c.evidence_notes) {
      panel.appendChild(el("h4", null, "Evidence notes"));
      panel.appendChild(el("p", null, c.evidence_notes));
    }
    if (c.pipeline) {
      panel.appendChild(el("h4", null, "Announced but not in force"));
      panel.appendChild(el("div", "callout", c.pipeline +
        " — instruments that have not entered into force score zero on Existence."));
    }

    if (c.evidence_date) panel.appendChild(el("p", "status-line", "Evidence as of " + c.evidence_date));

    var hint = el("p", "navhint");
    hint.append("Navigate: ");
    hint.appendChild(el("kbd", null, "←"));
    hint.append(" ");
    hint.appendChild(el("kbd", null, "→"));
    hint.append(" jurisdictions · ");
    hint.appendChild(el("kbd", null, "↑"));
    hint.append(" ");
    hint.appendChild(el("kbd", null, "↓"));
    hint.append(" categories · ");
    hint.appendChild(el("kbd", null, "Esc"));
    hint.append(" close");
    panel.appendChild(hint);

    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add("open"); });
    close.focus();
  }

  function closePanel() {
    if (!panel.classList.contains("open")) return;
    panel.classList.remove("open");
    panel.hidden = true;
    Object.keys(cellButtons).forEach(function (k) { cellButtons[k].classList.remove("active"); });
    if (current && cellButtons[current.pid + "|" + current.code]) {
      cellButtons[current.pid + "|" + current.code].focus();
    }
    current = null;
  }

  function step(dPid, dJur) {
    if (!current) return;
    var visible = D.mechanisms.filter(function (m) { return !dimFilter || m.dimension === dimFilter; });
    var pi = visible.findIndex(function (m) { return String(m.id) === String(current.pid); });
    var ji = ranked.indexOf(current.code);
    if (pi < 0 || ji < 0) return;
    pi = Math.max(0, Math.min(visible.length - 1, pi + dPid));
    ji = Math.max(0, Math.min(ranked.length - 1, ji + dJur));
    openCell(visible[pi].id, ranked[ji]);
  }
  document.addEventListener("keydown", function (e) {
    if (panel.hidden) return;
    if (e.key === "Escape") { closePanel(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(0, -1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(0, 1); }
    if (e.key === "ArrowUp") { e.preventDefault(); step(-1, 0); }
    if (e.key === "ArrowDown") { e.preventDefault(); step(1, 0); }
  });
  document.addEventListener("click", function (e) {
    if (panel.hidden || panel.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".cell")) return;
    closePanel();
  });

  renderHeatmap();

  /* ========================================================== DE FACTO */

  var DF = D.deFacto;
  var dfDim = "D1";
  var LINE = {};
  DF.units.forEach(function (u, i) { LINE[u.id] = "line-" + i; });
  function dfIdx(u, p) { return DF.index["de_facto|" + u + "|" + p]; }

  $("#df-note").textContent =
    "Three gatekeeper–market pairs in the European Union (" +
    DF.units.map(function (u) { return u.name; }).join(", ") +
    "), each coded on the same sixteen indicators, one for each contestability mechanism, at two points in time: " +
    "a December 2023 baseline, before the principal Digital Markets Act obligations applied, and a July 2026 " +
    "observation. An indicator whose mechanism does not operate in the market is Not Applicable and is left out; " +
    "one that applies but lacks the evidence to score it is Missing and is left out of the denominator. The " +
    "comparison is descriptive. It does not identify a causal effect of the regulation.";

  (function paperCompare() {
    var host = $("#view-defacto");
    var cmp = D.paper.deFactoCompare || [];
    var differ = cmp.filter(function (c) { return !c.same; });
    var box = el("div", "callout" + (differ.length ? " warn-callout" : ""));
    box.appendChild(el("strong", null, differ.length
      ? "Compared with the paper's Table 4, " + differ.length + " of " + cmp.length + " observations differ. "
      : "These figures reproduce the paper's Table 4. "));
    box.appendChild(document.createTextNode(
      "The paper and this database use the same sixteen indicators and the same denominator rule; the database " +
      "holds the current coding, and the paper's table reflects an earlier state of it."));
    var ul = el("ul", "small");
    cmp.forEach(function (c) {
      ul.appendChild(el("li", c.same ? "muted" : null,
        c.name + " — paper: " + c.paper.scored + " of " + c.paper.applicable + " applicable indicators scored, " +
        num(c.paper.baseline) + " → " + num(c.paper.later) + "; this database: " + c.ours.scored + " of " +
        c.ours.applicable + ", " + num(c.ours.pre) + " → " + num(c.ours.post) + (c.same ? " (identical)" : "")));
    });
    box.appendChild(ul);
    host.insertBefore(box, host.children[2]);
  })();

  (function renderTiles() {
    var host = $("#df-tiles");
    var grid = el("div", "tile-grid");
    DF.units.forEach(function (u) {
      var pre = dfIdx(u.id, "baseline"), post = dfIdx(u.id, "current");
      var t = el("div", "tile");
      t.appendChild(el("div", "tile-label", u.name));
      t.appendChild(el("div", "tile-sub muted small", u.gatekeeper + " · " + u.market));
      t.appendChild(el("div", "tile-value", num(post.index)));
      var delta = post.index - pre.index;
      var d = el("div", "tile-delta " + (delta > 0 ? "up" : "flat"));
      d.textContent = (delta > 0 ? "▲ +" : "") + num(delta) + " vs " + num(pre.index) + " at the baseline";
      t.appendChild(d);
      t.appendChild(el("div", "small muted", post.nScored + " of " + post.nApplicable +
        " applicable indicators scored (" + post.nItems + " in the set)"));
      grid.appendChild(t);
    });
    host.appendChild(grid);
  })();

  (function renderSlopes() {
    var host = $("#slopes");
    var legend = el("div", "slope-legend");
    DF.units.forEach(function (u) {
      var k = el("span", "key");
      k.appendChild(el("span", "swatch " + LINE[u.id]));
      k.appendChild(el("span", null, u.name));
      legend.appendChild(k);
    });
    host.appendChild(legend);

    D.dimensions.forEach(function (d) {
      var box = el("div", "slope");
      box.appendChild(el("h3", null, d.id + " · " + d.name));
      var w = 300, h = 190, pad = { t: 16, r: 54, b: 26, l: 40 };
      var s = svg("svg", { viewBox: "0 0 " + w + " " + h, class: "slope-svg", role: "img" });
      var x0 = pad.l, x1 = w - pad.r, y0 = h - pad.b, y1 = pad.t;
      function Y(v) { return y0 - v * (y0 - y1); }
      [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
        s.appendChild(svg("line", { x1: x0, x2: x1, y1: Y(g), y2: Y(g), class: "gridline" }));
        var t = svg("text", { x: x0 - 6, y: Y(g) + 4, class: "axis-lab", "text-anchor": "end" });
        t.textContent = g;
        s.appendChild(t);
      });
      [[x0, "Pre-DMA"], [x1, "Post-DMA"]].forEach(function (p) {
        var t = svg("text", { x: p[0], y: h - 8, class: "axis-lab", "text-anchor": "middle" });
        t.textContent = p[1];
        s.appendChild(t);
      });
      var desc = [], labelled = { pre: {}, post: {} };
      DF.units.forEach(function (u) {
        var a = dfIdx(u.id, "baseline").dims[d.id], b = dfIdx(u.id, "current").dims[d.id];
        if (!a || !b || a.score === null || b.score === null) return;
        var cls = LINE[u.id];
        s.appendChild(svg("line", { x1: x0, y1: Y(a.score), x2: x1, y2: Y(b.score), class: "sline " + cls }));
        s.appendChild(svg("circle", { cx: x0, cy: Y(a.score), r: 4, class: "sdot " + cls }));
        s.appendChild(svg("circle", { cx: x1, cy: Y(b.score), r: 4, class: "sdot " + cls }));
        // Pairs that share a value share one label, so coinciding labels do not print on top of each other.
        if (!labelled.post[num(b.score)]) {
          labelled.post[num(b.score)] = true;
          var lab = svg("text", { x: x1 + 6, y: Y(b.score) + 4, class: "sval " + cls });
          lab.textContent = num(b.score);
          s.appendChild(lab);
        }
        if (!labelled.pre[num(a.score)]) {
          labelled.pre[num(a.score)] = true;
          var lab0 = svg("text", { x: x0 - 6, y: Y(a.score) - 8, class: "sval " + cls, "text-anchor": "end" });
          lab0.textContent = num(a.score);
          s.appendChild(lab0);
        }
        desc.push(u.name + " " + num(a.score) + " to " + num(b.score));
      });
      s.setAttribute("aria-label", d.id + " " + d.name + ": " + desc.join("; "));
      box.appendChild(s);

      // Name the pairs whose lines lie exactly on top of each other, so a hidden line is not read as missing.
      var same = {};
      DF.units.forEach(function (u) {
        var a = dfIdx(u.id, "baseline").dims[d.id], b = dfIdx(u.id, "current").dims[d.id];
        var k = num(a.score) + "|" + num(b.score);
        (same[k] = same[k] || []).push(u.name);
      });
      var overlap = Object.keys(same).filter(function (k) { return same[k].length > 1; })
        .map(function (k) { return same[k].join(" and ") + " coincide"; });
      var f = el("p", "small muted");
      f.textContent = "Mean of the scored indicators · " + DF.units.map(function (u) {
        var b = dfIdx(u.id, "current").dims[d.id];
        return u.name + " " + b.nScored + " of " + b.nApplicable;
      }).join(" · ") + (overlap.length ? ". Lines drawn on top of each other: " + overlap.join("; ") + "." : "");
      box.appendChild(f);
      host.appendChild(box);
    });
  })();

  (function dfChips() {
    var host = $("#df-dim-chips");
    D.dimensions.forEach(function (d) {
      var b = el("button", "chip" + (d.id === dfDim ? " on" : ""), d.id + " " + d.name);
      b.type = "button";
      b.setAttribute("aria-pressed", d.id === dfDim ? "true" : "false");
      b.addEventListener("click", function () {
        dfDim = d.id;
        Array.prototype.forEach.call(host.children, function (c) {
          var on = c.textContent.indexOf(dfDim) === 0;
          c.classList.toggle("on", on);
          c.setAttribute("aria-pressed", on ? "true" : "false");
        });
        renderDfDetail();
      });
      host.appendChild(b);
    });
  })();

  function confBadge(v) {
    var cls = v.indexOf("LOW") === 0 ? "conf-low" : v === "MODERATE" ? "conf-mod" : "conf-high";
    return el("span", "badge " + cls, v.replace("-", "–"));
  }
  function statusPill(it, v) {
    if (it.status === "missing") return el("span", "pill st-missing", "Missing");
    if (it.status === "not_applicable") return el("span", "pill st-na", "N/A");
    return el("span", "pill " + tier(v), glyph(v));
  }

  function renderDfDetail() {
    var host = $("#df-detail");
    host.textContent = "";
    DF.units.forEach(function (u) {
      var a = dfIdx(u.id, "baseline").dims[dfDim], b = dfIdx(u.id, "current").dims[dfDim];
      var card = el("div", "df-card");
      var head = el("div", "df-card-head");
      head.appendChild(el("h3", null, u.name));
      head.appendChild(el("span", "muted small", dfDim + " " + num(a.score) + " → " + num(b.score) + " · " +
        b.nScored + " of " + b.nApplicable + " applicable indicators scored"));
      card.appendChild(head);

      DF.items.filter(function (it) { return it.unit === u.id && it.dim === dfDim; }).forEach(function (it) {
        var m = mechById[it.mechanism];
        var det = el("details", "subrow");
        var sum = el("summary");
        sum.appendChild(el("span", "sub-id", m.code));
        sum.appendChild(el("span", "sub-label", m.indicator));
        sum.appendChild(statusPill(it, it.pre));
        if (it.status === "scored") {
          sum.appendChild(el("span", "arrow", "→"));
          sum.appendChild(statusPill(it, it.post));
          sum.appendChild(el("span", "sub-delta " + (it.delta > 0 ? "up" : "flat"),
            it.delta > 0 ? "+" + num(it.delta) : "±0"));
          if (it.confidence) sum.appendChild(confBadge(it.confidence));
        }
        det.appendChild(sum);

        var body = el("div", "subbody");
        body.appendChild(el("h5", null, "Evidence and scoring rationale"));
        body.appendChild(el("p", null, it.evidence || "—"));
        if (it.sources.length) {
          body.appendChild(el("h5", null, "Sources"));
          var ul = el("ul", "link-list");
          it.sources.forEach(function (l) {
            var li = el("li");
            if (l.url) {
              li.appendChild(extLink(l.url, l.title));
              li.appendChild(el("span", "muted small", " · " + domain(l.url)));
            } else {
              li.appendChild(el("span", null, l.title + " (no link recorded)"));
            }
            ul.appendChild(li);
          });
          body.appendChild(ul);
        }
        body.appendChild(el("p", "small muted", "The same mechanism in the de jure layer: category " + m.id +
          ", " + m.name + "."));
        det.appendChild(body);
        card.appendChild(det);
      });
      host.appendChild(card);
    });
  }
  renderDfDetail();

  (function obligationMap() {
    var host = $("#obligation-map");
    var t = el("table", "plain");
    var head = el("tr");
    ["Dimension", "DMA obligations observed", "Indicators"].forEach(function (x) { head.appendChild(el("th", null, x)); });
    t.appendChild(head);
    D.dimensions.forEach(function (d) {
      var tr = el("tr");
      tr.appendChild(el("td", null, d.id + " · " + d.name));
      var td = el("td", "small");
      d.dmaObligations.split(/;\s*/).filter(Boolean).forEach(function (o) { td.appendChild(el("div", null, o.trim())); });
      tr.appendChild(td);
      tr.appendChild(el("td", "small muted", D.mechanisms.filter(function (m) { return m.dimension === d.id; })
        .map(function (m) { return m.code + " " + m.indicator; }).join(" · ")));
      t.appendChild(tr);
    });
    host.appendChild(t);
    var gen = [];
    DF.units.forEach(function (u) {
      (DF.generalSources[u.id] || []).forEach(function (s) {
        if (gen.every(function (g) { return g.url !== s.url; })) gen.push(s);
      });
    });
    if (gen.length) {
      var p = el("p", "small muted", "Cited for every observation: ");
      gen.forEach(function (s, i) {
        if (i) p.appendChild(document.createTextNode("; "));
        p.appendChild(s.url ? extLink(s.url, s.title) : document.createTextNode(s.title));
      });
      host.appendChild(p);
    }
  })();

  /* ========================================================== MARKETS */

  (function marketMatrix() {
    var host = $("#market-matrix");
    var cov = D.markets.coverage;
    var markets = [];
    cov.forEach(function (r) { if (markets.indexOf(r.market) === -1) markets.push(r.market); });
    var byKey = {};
    cov.forEach(function (r) { byKey[r.market + "|" + r.jurisdiction] = r; });

    function regimeClass(regime) {
      if (!regime || regime === "none") return "rg-none";
      if (regime === "pending") return "rg-pending";
      if (regime.indexOf("ex_ante") === 0) return "rg-exante";
      if (regime.indexOf("court") === 0 || regime.indexOf("designated") === 0) return "rg-targeted";
      return "rg-other";
    }

    var table = el("table", "heat");
    var hr = el("tr");
    hr.appendChild(el("th", "corner", "Market"));
    ranked.forEach(function (c) { hr.appendChild(el("th", "jur-head", c)); });
    table.appendChild(hr);

    markets.forEach(function (mk) {
      var tr = el("tr");
      tr.appendChild(el("th", "mech-name", mk));
      ranked.forEach(function (code) {
        var r = byKey[mk + "|" + code];
        var td = el("td", "cell-td");
        var b = el("button", "cell mk " + regimeClass(r && r.regime), "");
        b.type = "button";
        b.setAttribute("aria-label", mk + ", " + jurName[code] + ", regime " + ((r && r.regime) || "none"));
        withTip(b, function () {
          if (!r) return [mk + " · " + jurName[code], "No record"];
          var l = [mk + " · " + jurName[code], "Regime: " + pretty(r.regime)];
          if (r.instruments) l.push("Instruments: " + r.instruments);
          if (r.firms) l.push("Firms: " + r.firms);
          return l;
        });
        b.addEventListener("click", function () { openMarketCell(r, mk, code); });
        td.appendChild(b);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    host.appendChild(table);

    var lg = $("#market-legend");
    [["rg-exante", "Ex ante statute"], ["rg-targeted", "Targeted order or designation"],
     ["rg-other", "Other binding instrument"], ["rg-pending", "Announced, not in force"],
     ["rg-none", "No instrument on point"]].forEach(function (p) {
      var k = el("span", "key");
      k.appendChild(el("span", "swatch " + p[0]));
      k.appendChild(el("span", null, p[1]));
      lg.appendChild(k);
    });
  })();

  function openMarketCell(r, mk, code) {
    ttHide();
    panel.textContent = "";
    var close = el("button", "close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close detail panel");
    close.addEventListener("click", closePanel);
    panel.appendChild(close);
    panel.appendChild(el("p", "crumb", "Market coverage"));
    panel.appendChild(el("h2", null, mk));
    panel.appendChild(el("p", "jname", jurName[code]));
    if (!r) {
      panel.appendChild(el("p", "muted", "No record for this pair."));
    } else {
      panel.appendChild(el("span", "badge", pretty(r.regime)));
      if (r.instruments) { panel.appendChild(el("h4", null, "Binding instruments")); panel.appendChild(el("p", null, r.instruments)); }
      if (r.provisions) { panel.appendChild(el("h4", null, "Categories covered")); panel.appendChild(el("p", null, r.provisions)); }
      if (r.firms) { panel.appendChild(el("h4", null, "Firms reached")); panel.appendChild(el("p", null, r.firms)); }
      if (r.notes) { panel.appendChild(el("h4", null, "Notes")); panel.appendChild(el("p", null, r.notes)); }
    }
    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add("open"); });
    close.focus();
  }

  (function marketDeJure() {
    var host = $("#market-dj");
    var rows = D.markets.deJure;
    if (!rows.length) { host.appendChild(el("p", "muted", "No market-level scoring on file.")); return; }
    var PERIOD = { current: "June 2026", baseline: "December 2023 baseline" };
    D.deFacto.units.forEach(function (u) {
      ["current", "baseline"].forEach(function (p) {
        var sub = rows.filter(function (r) { return r.unit === u.id && r.period === p; });
        if (!sub.length) return;
        var idx = D.markets.index["de_jure|" + u.id + "|" + p];
        var card = el("div", "df-card");
        var head = el("div", "df-card-head");
        head.appendChild(el("h3", null, u.market + " · " + u.name + " · " + PERIOD[p]));
        head.appendChild(el("span", "muted small", sub.length + " categories · index " + num(idx && idx.index)));
        card.appendChild(head);
        if (sub[0].note) card.appendChild(el("p", "small muted", sub[0].note));
        sub.forEach(function (r) {
          var m = mechById[r.mechanism] || { name: "Category " + r.mechanism };
          var det = el("details", "subrow");
          var sum = el("summary");
          sum.appendChild(el("span", "sub-id", String(r.mechanism)));
          sum.appendChild(el("span", "sub-label", m.name));
          sum.appendChild(el("span", "pill " + tier(r.score), glyph(r.score)));
          sum.appendChild(el("span", "muted small", r.provision || ""));
          det.appendChild(sum);
          var body = el("div", "subbody");
          body.appendChild(el("p", "small", "min(E " + r.existence + ", S " + r.scope + ", Enf " + r.enforceability +
            ") = " + r.score + " · legal form " + r.form + " · " + pretty(r.applicability)));
          if (r.hook) { body.appendChild(el("h5", null, "What makes it apply to this market")); body.appendChild(el("p", null, r.hook)); }
          if (r.extract) { body.appendChild(el("h5", null, "Verbatim")); body.appendChild(el("blockquote", null, r.extract)); }
          if (r.rationale) { body.appendChild(el("h5", null, "Rationale")); body.appendChild(el("p", null, r.rationale)); }
          det.appendChild(body);
          card.appendChild(det);
        });
        host.appendChild(card);
      });
    });
  })();

  /* ====================================================== METHODOLOGY */
  (function methodology() {
    var h = $("#methodology");
    function head(t) { h.appendChild(el("h2", null, t)); }
    function para(t) { h.appendChild(el("p", null, t)); }

    head("What the index measures");
    para("The index separates two questions that are often merged. The de jure layer measures the " +
      "strength of the formal legal, regulatory and institutional conditions that support competitive " +
      "challenge. It does not measure compliance or realised market effects. The de facto layer asks " +
      "whether users and rivals can actually exercise the corresponding competitive opportunity in a " +
      "defined market. Any combination of the two is a derived summary, not a separately observed quantity.");

    head("Relating the two layers");
    para("There is no uniquely correct way to combine a de jure and a de facto score. The paper gives four " +
      "specifications and uses the product for contestability that is both formally supported and practically " +
      "realised. The front page reports all four for every gatekeeper–market pair, with the arithmetic mean at " +
      "λ = " + D.meta.lambda + " (equal weighting), and keeps the two component scores visible beside them.");
    var st = el("table", "plain");
    var sh = el("tr");
    ["Specification", "Formula", "When it is appropriate"].forEach(function (x) { sh.appendChild(el("th", null, x)); });
    st.appendChild(sh);
    D.paper.effectiveSpecs.forEach(function (s) {
      var tr = el("tr");
      tr.appendChild(el("td", null, pretty(s.id) + " " + s.eq));
      tr.appendChild(el("td", "mono", s.formula));
      tr.appendChild(el("td", "small", s.use));
      st.appendChild(tr);
    });
    h.appendChild(st);

    head("The four dimensions");
    var dt = el("table", "plain");
    var dh = el("tr");
    ["", "Dimension", "De jure category = de facto indicator"].forEach(function (x) { dh.appendChild(el("th", null, x)); });
    dt.appendChild(dh);
    D.dimensions.forEach(function (d) {
      var tr = el("tr");
      tr.appendChild(el("td", null, d.id));
      tr.appendChild(el("td", null, d.name));
      var td = el("td", "small");
      D.mechanisms.filter(function (m) { return m.dimension === d.id; }).forEach(function (m) {
        td.appendChild(el("div", null, m.id + ". " + m.name + " = " + m.code + " " + m.indicator));
      });
      tr.appendChild(td);
      dt.appendChild(tr);
    });
    h.appendChild(dt);
    para("Each mechanism belongs to exactly one dimension. Data portability sits in D1 because its " +
      "principal function is to lower the cost of leaving. A rival's access to competitively necessary " +
      "data sits in D4. A platform using a business user's non-public data to compete against that user " +
      "sits in D3, because it is discriminatory platform conduct rather than a data-access question.");

    head("Scoring");
    para("Every observation is scored on three factors. Existence asks whether an operative obligation " +
      "addressing the mechanism is present. Scope asks what range of firms, services, markets or " +
      "activities it covers. Enforceability asks whether it is supported by credible oversight, " +
      "sanctions, judicial supervision or private enforcement. Each takes 0, 0.5 or 1, and the score " +
      "for the observation is the minimum of the three.");
    para("The minimum rule reflects the complementarity of the three factors. A broad enforcement system " +
      "cannot compensate for the absence of an operative obligation; an obligation binding a single named " +
      "firm does not deliver what a generally applicable rule delivers; and a broadly written obligation " +
      "without credible enforcement may provide little effective protection.");

    head("Three coding states");
    var cs = el("table", "plain");
    Object.keys(D.paper.codingStates).forEach(function (k) {
      var tr = el("tr");
      tr.appendChild(el("th", null, k));
      tr.appendChild(el("td", "small", D.paper.codingStates[k]));
      cs.appendChild(tr);
    });
    h.appendChild(cs);
    para("These are deliberately distinct. A score of zero is a finding about the world. Not Applicable " +
      "is a statement about measurement scope. Missing is a statement about evidence. Collapsing them " +
      "would let an evidence gap read as an absence of protection.");

    head("Aggregation");
    para("A dimension score is the unweighted mean of the scored observations within it, so a dimension " +
      "with fewer applicable indicators has a smaller denominator rather than implicit zeros. The index " +
      "is the equal-weighted mean of the four dimension scores. Equal weighting is the benchmark because " +
      "it is transparent and reproducible and imposes no assumption about the relative economic " +
      "importance of the four channels. Alternative weights belong in a robustness exercise; this site " +
      "reports the equal-weight benchmark only.");

    head("Why this site is built as a drill-down");
    var rr = D.paper.reportingRequirements || {};
    para("The shape of this site is not a stylistic choice. The methodology manual states what a " +
      "report of these results must contain, and the list is what these pages deliver.");
    var rl = el("ul");
    (rr.mustReport || []).forEach(function (t) { rl.appendChild(el("li", null, pretty(t))); });
    h.appendChild(rl);
    if (rr.traceability) para(rr.traceability);
    if (rr.effectiveTogether) para(rr.effectiveTogether + " That is why the front page shows the " +
      "two component scores as bars beside all four ways of combining them, rather than presenting a single " +
      "composite number on its own.");

    head("Legal-form taxonomy");
    para("Instruments are classified by how their substantive obligations become operative. The typical " +
      "factor treatment below is a coding benchmark rather than an automatic score: the legal text and " +
      "institutional setting of the individual observation remain controlling.");
    var lf = el("table", "plain");
    var lh = el("tr");
    ["Form", "Definition", "Typical factor treatment"].forEach(function (x) { lh.appendChild(el("th", null, x)); });
    lf.appendChild(lh);
    D.legalForms.forEach(function (f) {
      var tr = el("tr");
      tr.appendChild(el("td", "mono", f.code));
      var td = el("td", "small");
      td.appendChild(el("strong", null, f.name));
      td.appendChild(el("div", null, f.definition));
      tr.appendChild(td);
      tr.appendChild(el("td", "small muted", f.signature));
      lf.appendChild(tr);
    });
    h.appendChild(lf);

    head("Confidence");
    var cf = el("table", "plain");
    ["High", "Moderate", "Low"].forEach(function (k) {
      var tr = el("tr");
      tr.appendChild(el("th", null, k));
      tr.appendChild(el("td", "small", D.paper.confidenceLevels[k]));
      cf.appendChild(tr);
    });
    h.appendChild(cf);
    para(D.paper.confidenceLevels.note);

    head("What this site shows, and where it differs from the paper");
    var disc = D.paper.discrepancies || [];
    if (disc.length) {
      var box = el("div", "callout warn-callout");
      box.appendChild(el("strong", null, "De jure: " + disc.length +
        (disc.length === 1 ? " jurisdiction differs" : " jurisdictions differ") + " from the published table. "));
      box.appendChild(document.createTextNode(
        "The other jurisdictions reproduce it exactly. The paper's Table 3 covers fifteen obligation categories; " +
        "this site covers sixteen."));
      var dl = el("ul", "small");
      disc.forEach(function (d) { dl.appendChild(el("li", null, d.name + " (" + d.detail.join("; ") + "). " + (d.whyShort || d.why))); });
      box.appendChild(dl);
      if (D.paper.handbook && D.paper.handbook.note) {
        box.appendChild(el("div", "small", D.paper.handbook.note + " The handbook prints " +
          D.paper.handbook.ukIndex + "."));
      }
      h.appendChild(box);
    }
    var cmp = D.paper.deFactoCompare || [];
    var dfDiffer = cmp.filter(function (c) { return !c.same; });
    var box2 = el("div", "callout" + (dfDiffer.length ? " warn-callout" : ""));
    box2.appendChild(el("strong", null, "De facto: " + (dfDiffer.length
      ? dfDiffer.length + " of " + cmp.length + " observations differ from the paper's Table 4. "
      : "the figures reproduce the paper's Table 4. ")));
    box2.appendChild(document.createTextNode("Both use the same sixteen indicators and the same denominator rule. " +
      (dfDiffer.length ? "The differing observations are " + dfDiffer.map(function (c) { return c.name; }).join(" and ") +
       "; the published figures are listed on the de facto page next to the current ones." : "")));
    h.appendChild(box2);

    head("Limitations");
    var lim = el("ul");
    [
      "Coverage is limited. Nine legal systems are assessed for the de jure layer, and the de facto work covers a small number of gatekeeper-market observations in the European Union alone.",
      "The pre and post comparisons are descriptive. The index supplies measurement infrastructure for causal analysis; it does not itself provide an identification strategy.",
      "Scores are least comparable across markets. A 0.5 in search and a 0.5 in app distribution need not describe equivalent competitive conditions.",
      "Assigning 0, 0.5 or 1 involves judgment. Systematic inter-coder reliability has not yet been evaluated; independent double-coding and agreement statistics are planned.",
      "The de facto layer rests on heterogeneous public evidence, and its weakest dimension is technical interoperability and data access.",
      "Equal weighting is a transparent baseline, not a claim that every mechanism matters equally in every market.",
      "The de jure layer is a snapshot. Instruments announced but not yet in force score zero on Existence and are flagged rather than credited."
    ].forEach(function (t) { lim.appendChild(el("li", null, t)); });
    h.appendChild(lim);

    head("Reproducing these numbers");
    var rp = el("p");
    rp.appendChild(document.createTextNode("Every figure on this site is computed in your browser from the project " +
      "database, which you can download: "));
    rp.appendChild(dbLink("contestability.db"));
    rp.appendChild(document.createTextNode(" (SQLite). Each score, de jure or de facto, is one row of the table " +
      "assessments, with the same columns in both layers; dimension scores, indices and the four Effective " +
      "Contestability specifications are the views v_dimension_scores, v_index and v_effective, so nothing is " +
      "stored twice. The database is built from the coding sheets by a script that stops if any score falls " +
      "outside the three-point grid, if a de jure score is not the minimum of its three factors, or if a count " +
      "is off. For example:"));
    h.appendChild(rp);
    h.appendChild(el("pre", "mono small", "select unit_id, period, de_jure, de_facto,\n" +
      "       ec_multiplicative, ec_arithmetic, ec_bottleneck, implementation_gap\n" +
      "from v_effective;"));
  })();

  /* ------------------------------------------------------------ boot */
  var h0 = location.hash.slice(1);
  if (h0 && $("#view-" + h0)) showTab(h0);
};
