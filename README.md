# The Contestability Index — website

Interactive site for the Contestability Index: sixteen pro-contestability obligation categories scored on the law as written across nine jurisdictions, and a de facto pilot for three gatekeeper–market pairs in two European markets.

**Status: preliminary.** Figures may change.

This repository holds only the built site: plain HTML, CSS and JavaScript. The page reads the project database, `data/contestability.db` (SQLite), in the browser with [sql.js](https://sql.js.org), which it loads from cdnjs; every figure is computed from the database's tables and views when the page opens, and the same file can be downloaded from the site. `data/paper.json` holds the paper's published figures, shown for comparison. `data/`, `js/world.js` and the `?v=` values in `index.html` are written by the project's publish script (`website/build/publish_site_data.py`), which is not part of this repository. To update the site, run it, commit, and push; GitHub Pages redeploys from `main`.

The page must be served over HTTP; opening `index.html` as a file does not work.
