# The Contestability Index — website

Interactive site for the Contestability Index: sixteen pro-contestability obligation categories scored on the law as written across nine jurisdictions, and a de facto pilot for three gatekeeper–market pairs in two European markets.

**Status: preliminary.** Figures may change.

This repository holds only the built site: plain HTML, CSS and JavaScript. The page reads the project database (SQLite) in the browser with [sql.js](https://sql.js.org), which it loads from cdnjs; every figure is computed from the database's tables and views when the page opens. `data/contestability.db` is the whole database, the file the site offers for download. The pages load `data/contestability_site.db`, the same database without the legal full texts and the search index, and fetch `data/legal_texts.db` when a reader opens a full text. `data/paper.json` holds the paper's published figures, shown for comparison. `data/`, `js/world.js` and the `?v=` values in `index.html` are written by the project's publish script (`website/build/publish_site_data.py`), which is not part of this repository. To update the site, run it, commit, and push; GitHub Pages redeploys from `main`.

The layout follows the WJP Rule of Law Index site and the colours and type follow the Knight-Georgetown Institute site;
no code or text is taken from either. Paragraphs that start with `[AI generated]` are drafts the team has not yet reviewed.

The page must be served over HTTP; opening `index.html` as a file does not work.

## License

The data, the documentation and the text of the site are under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/); the code is under the [MIT License](LICENSE). The working paper remains © its authors, and legal texts and quoted sources remain under the terms of their publishers. [LICENSE-DATA.md](LICENSE-DATA.md) lists what each license covers and the third-party components.
