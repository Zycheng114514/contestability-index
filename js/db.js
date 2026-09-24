/* The Contestability Index — data layer.
   Opens the project database (data/contestability.db, SQLite) in the browser with sql.js, reads every
   figure the site shows from it, and hands the result to app.js as window.CI_DATA. Nothing on the site
   is precomputed: dimension scores, indices and Effective Contestability come from the database's views.
   The published figures used for comparison (data/paper.json) are transcribed from the paper. */
(function () {
  "use strict";
  var me = document.currentScript;
  var DB_URL = me.getAttribute("data-db");
  var PAPER_URL = me.getAttribute("data-paper");
  var SQLJS = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";

  var status = document.getElementById("load-status");
  function say(t) { if (status) { status.hidden = false; status.textContent = t; } }

  // Which map features belong to each jurisdiction (ISO 3166 numeric codes); the EU is its 27 members.
  var EU27 = ["040","056","100","191","196","203","208","233","246","250","276","300","348","372",
              "380","428","440","442","470","528","616","620","642","703","705","724","752"];
  var MAP_IDS = { EU: EU27, DE: ["276"], US: ["840"], TR: ["792"], JP: ["392"],
                  KR: ["410"], CN: ["156"], UK: ["826"], AU: ["036"] };
  // Display names for the gatekeeper-market pairs, as the paper writes them.
  var UNIT_NAMES = { google_search: "Google Search", apple_ios_appstore: "Apple iOS/App Store",
                     google_play: "Android/Google Play" };
  var UNIT_ORDER = ["google_search", "apple_ios_appstore", "google_play"];

  function rows(db, sql, params) {
    var st = db.prepare(sql);
    if (params) st.bind(params);
    var out = [];
    while (st.step()) out.push(st.getAsObject());
    st.free();
    return out;
  }
  function r2(x) { var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 100 + 1e-9) / 100; }

  function build(db, paper) {
    var info = {};
    rows(db, "select key, value from database_info").forEach(function (r) { info[r.key] = r.value; });

    var dims = rows(db, "select dim_id, name, dma_obligations from dimensions order by dim_id").map(function (d) {
      return { id: d.dim_id, name: d.name, dmaObligations: d.dma_obligations || "" };
    });
    var mechanisms = rows(db, "select mechanism_id, name, description, dim_id, code, indicator from mechanisms order by mechanism_id")
      .map(function (m) {
        return { id: m.mechanism_id, name: m.name, description: m.description || "", dimension: m.dim_id,
                 code: m.code, indicator: m.indicator };
      });
    var mechDim = {};
    mechanisms.forEach(function (m) { mechDim[m.id] = m.dimension; });

    var jurisdictions = rows(db, "select code, name, enforcement_note from jurisdictions").map(function (j) {
      return { code: j.code, name: j.name, enforcementNote: j.enforcement_note || "", mapIds: MAP_IDS[j.code] || [] };
    });

    // ---------------------------------------------------------------- De Jure, jurisdiction level
    var cells = {};
    rows(db, "select * from assessments where layer = 'de_jure' and level = 'jurisdiction'").forEach(function (a) {
      var binding = ["existence", "scope", "enforceability"].filter(function (k) { return a[k] === a.score; });
      cells[a.mechanism_id + "|" + a.jurisdiction] = {
        score: a.score, existence: a.existence, scope: a.scope, enforceability: a.enforceability, binding: binding,
        factor_rationale: a.rationale || "", legal_form: a.legal_form_label || "", legal_form_code: a.legal_form || "",
        instrument_basis: a.instrument_basis || "", legal_basis_full: a.basis || "", market_scope: a.market_scope || "",
        evidence_notes: a.evidence_notes || "", pipeline: a.pipeline || "", evidence_date: a.evidence_date || ""
      };
    });
    var extractCount = 0;
    rows(db, "select * from provision_extracts order by extract_id").forEach(function (x) {
      var c = cells[x.mechanism_id + "|" + x.jurisdiction];
      if (!c) return;
      (c.extracts = c.extracts || []).push({ instrument: x.instrument_label, summary: x.summary, text: x.extract_text,
                                             translation: x.english_translation, sourcePath: x.source_txt_path });
      extractCount++;
    });

    var aggregates = {};
    rows(db, "select jurisdiction, dim_id, score from v_dimension_scores where layer = 'de_jure' and level = 'jurisdiction'")
      .forEach(function (r) { (aggregates[r.jurisdiction] = aggregates[r.jurisdiction] || { dims: {} }).dims[r.dim_id] = r.score; });
    rows(db, "select jurisdiction, index_score from v_index where layer = 'de_jure' and level = 'jurisdiction'")
      .forEach(function (r) { aggregates[r.jurisdiction].overall = r.index_score; });

    // ---------------------------------------------------------------- units, market-level indices
    var units = rows(db, "select * from units").map(function (u) {
      return { id: u.unit_id, name: UNIT_NAMES[u.unit_id] || u.service, service: u.service, gatekeeper: u.gatekeeper,
               market: u.market, designationDate: u.designation_date };
    }).sort(function (a, b) { return UNIT_ORDER.indexOf(a.id) - UNIT_ORDER.indexOf(b.id); });
    var periods = {};
    rows(db, "select * from periods").forEach(function (p) { periods[p.layer + "|" + p.level + "|" + p.period] = p; });

    var marketIndex = {};  // layer|unit|period -> {index, nScored, nApplicable, nItems, dims:{}}
    rows(db, "select * from v_index where level = 'market'").forEach(function (r) {
      marketIndex[r.layer + "|" + r.unit_id + "|" + r.period] = {
        index: r.index_score, nScored: r.n_scored, nApplicable: r.n_applicable, nItems: r.n_items, observed: r.observed, dims: {} };
    });
    rows(db, "select * from v_dimension_scores where level = 'market'").forEach(function (r) {
      marketIndex[r.layer + "|" + r.unit_id + "|" + r.period].dims[r.dim_id] =
        { score: r.score, nScored: r.n_scored, nApplicable: r.n_applicable, nItems: r.n_items };
    });

    // ---------------------------------------------------------------- De Facto
    var links = {};
    rows(db, "select l.unit_id, l.mechanism_id, s.title, s.url from de_facto_source_links l " +
             "join de_facto_sources s using (source_id) order by s.source_id").forEach(function (r) {
      var k = r.unit_id + "|" + (r.mechanism_id === null ? "*" : r.mechanism_id);
      (links[k] = links[k] || []).push({ title: r.title, url: r.url });
    });
    var byKey = {};
    rows(db, "select * from assessments where layer = 'de_facto'").forEach(function (a) {
      var k = a.unit_id + "|" + a.mechanism_id;
      var it = byKey[k] = byKey[k] || { unit: a.unit_id, mechanism: a.mechanism_id, status: a.status,
                                         confidence: a.confidence || "", evidence: a.rationale || "",
                                         sources: links[k] || [] };
      it[a.period === "baseline" ? "pre" : "post"] = a.score;
    });
    var items = Object.keys(byKey).map(function (k) {
      var it = byKey[k];
      it.delta = it.status === "scored" ? it.post - it.pre : null;
      it.dim = mechDim[it.mechanism];
      return it;
    }).sort(function (a, b) { return UNIT_ORDER.indexOf(a.unit) - UNIT_ORDER.indexOf(b.unit) || a.mechanism - b.mechanism; });
    var generalSources = {};
    UNIT_ORDER.forEach(function (u) { generalSources[u] = links[u + "|*"] || []; });

    // ---------------------------------------------------------------- Effective Contestability
    var effective = rows(db, "select * from v_effective").map(function (r) {
      return { unit: r.unit_id, period: r.period, deJureObserved: r.de_jure_observed, deFactoObserved: r.de_facto_observed,
               deJure: r.de_jure, deFacto: r.de_facto, multiplicative: r.ec_multiplicative, arithmetic: r.ec_arithmetic,
               bottleneck: r.ec_bottleneck, gap: r.implementation_gap };
    }).sort(function (a, b) {
      return UNIT_ORDER.indexOf(a.unit) - UNIT_ORDER.indexOf(b.unit) || (a.period === "current" ? -1 : 1);
    });

    // ---------------------------------------------------------------- context
    var instruments = {};
    rows(db, "select * from instruments order by jurisdiction, instrument_id").forEach(function (r) {
      (instruments[r.jurisdiction] = instruments[r.jurisdiction] || []).push({
        name: r.name, citation: r.citation, status: r.status, sourceLabel: r.official_source_label,
        url: r.official_source_url, pipeline: !!r.is_pipeline });
    });
    var legalForms = rows(db, "select * from legal_forms order by form_code").map(function (r) {
      return { code: r.form_code, name: r.name, definition: r.definition_examples, signature: r.typical_signature };
    });
    var coverage = rows(db, "select * from market_coverage order by market, jurisdiction").map(function (r) {
      return { market: r.market, jurisdiction: r.jurisdiction, instruments: r.binding_instruments,
               provisions: r.covered_provisions, regime: r.regime_type, firms: r.designated_or_bound_firms, notes: r.notes };
    });
    var marketDeJure = rows(db, "select * from assessments where layer = 'de_jure' and level = 'market' " +
                                "order by unit_id, period desc, mechanism_id").map(function (r) {
      return { unit: r.unit_id, period: r.period, observed: r.observed, mechanism: r.mechanism_id, score: r.score,
               existence: r.existence, scope: r.scope, enforceability: r.enforceability, provision: r.basis,
               form: r.legal_form, applicability: r.applicability, hook: r.market_hook, extract: r.verbatim_extract,
               rationale: r.rationale, note: r.record_note || "" };
    });

    // ---------------------------------------------------------------- comparison with the paper
    var discrepancies = [];
    (paper.deJure.rows || []).forEach(function (row) {
      var ours = aggregates[row.code];
      if (!ours) return;
      var diffs = [];
      ["D1", "D2", "D3", "D4"].forEach(function (d) {
        if (Math.abs(r2(ours.dims[d]) - row[d]) > 0.005) diffs.push(d + ": site " + r2(ours.dims[d]).toFixed(2) + ", paper " + row[d].toFixed(2));
      });
      if (Math.abs(r2(ours.overall) - row.overall) > 0.005) diffs.push("overall: site " + r2(ours.overall).toFixed(2) + ", paper " + row.overall.toFixed(2));
      if (!diffs.length) return;
      // Recompute on the paper's fifteen categories: if that reproduces the paper, category 16 alone explains it.
      var d15 = {};
      Object.keys(cells).forEach(function (k) {
        var p = k.split("|");
        if (p[1] !== row.code || p[0] === "16") return;
        (d15[mechDim[p[0]]] = d15[mechDim[p[0]]] || []).push(cells[k].score);
      });
      var dm = {}, sum = 0;
      Object.keys(d15).forEach(function (d) { dm[d] = d15[d].reduce(function (a, b) { return a + b; }, 0) / d15[d].length; sum += dm[d]; });
      var same15 = ["D1", "D2", "D3", "D4"].every(function (d) { return Math.abs(r2(dm[d]) - row[d]) <= 0.005; }) &&
                   Math.abs(r2(sum / 4) - row.overall) <= 0.005;
      discrepancies.push(same15 ? {
        layer: "deJure", code: row.code, name: row.name, detail: diffs, reason: "category16",
        why: "The paper's Table 3 covers fifteen obligation categories; this site includes the sixteenth, cross-service " +
             "data combination (D4), and that category alone accounts for the difference.",
        whyShort: "The sixteenth category alone accounts for the difference."
      } : {
        layer: "deJure", code: row.code, name: row.name, detail: diffs, reason: "corrected+category16",
        why: "Cells in this row were corrected after the database snapshot the paper was compiled from, and this site " +
             "also includes the sixteenth category, cross-service data combination (D4), which the paper's Table 3 does not.",
        whyShort: "Besides the sixteenth category, cells in this row were corrected after the database snapshot the paper was compiled from."
      });
    });
    var ecoToUnit = { "Google Search": "google_search", "Apple iOS/App Store": "apple_ios_appstore", "Android/Google Play": "google_play" };
    var dfCompare = (paper.deFacto.rows || []).map(function (row) {
      var u = ecoToUnit[row.ecosystem], pre = marketIndex["de_facto|" + u + "|baseline"], post = marketIndex["de_facto|" + u + "|current"];
      var same = pre && post && r2(pre.index) === row.baseline && r2(post.index) === row.later &&
                 post.nScored === row.scored && post.nApplicable === row.applicable;
      return { unit: u, name: row.ecosystem, paper: row, ours: { pre: pre && pre.index, post: post && post.index,
               scored: post && post.nScored, applicable: post && post.nApplicable }, same: !!same };
    });

    return {
      meta: {
        built: info.built || "", evidenceDate: (periods["de_jure|jurisdiction|current"] || {}).observed || "",
        mechanismCount: mechanisms.length, jurisdictionCount: jurisdictions.length, totalCells: Object.keys(cells).length,
        extractCount: extractCount, lambda: Number(info.effective_arithmetic_lambda || 0.5), dbUrl: DB_URL.split("?")[0]
      },
      jurisdictions: jurisdictions, dimensions: dims, mechanisms: mechanisms, cells: cells, aggregates: aggregates,
      legalForms: legalForms, instruments: instruments, periods: periods,
      deFacto: { units: units, items: items, index: marketIndex, generalSources: generalSources },
      effective: effective,
      markets: { coverage: coverage, deJure: marketDeJure, index: marketIndex },
      paper: {
        deJure: paper.deJure, deFacto: paper.deFacto, effectiveSpecs: paper.effectiveSpecifications,
        codingStates: paper.codingStates, dimensionQuestions: paper.dimensionQuestions,
        reportingRequirements: paper.reportingRequirements, handbook: paper.handbook,
        confidenceLevels: paper.confidenceLevels, discrepancies: discrepancies, deFactoCompare: dfCompare
      }
    };
  }

  say("Loading the project database…");
  Promise.all([
    window.initSqlJs({ locateFile: function (f) { return SQLJS + f; } }),
    fetch(DB_URL).then(function (r) { if (!r.ok) throw new Error("database: HTTP " + r.status); return r.arrayBuffer(); }),
    fetch(PAPER_URL).then(function (r) { if (!r.ok) throw new Error("paper figures: HTTP " + r.status); return r.json(); })
  ]).then(function (res) {
    var db = new res[0].Database(new Uint8Array(res[1]));
    window.CI_DB = db;  // the open database, for anyone who wants to query it from the console
    window.CI_DATA = build(db, res[2]);
    if (status) status.hidden = true;
    window.CI_BOOT();
  }).catch(function (e) {
    say("The project database could not be loaded (" + (e && e.message ? e.message : e) + "). " +
        "This page reads data/contestability.db over HTTP, so it has to be served by a web server rather than opened as a file.");
    if (window.console) console.error(e);
  });
})();
