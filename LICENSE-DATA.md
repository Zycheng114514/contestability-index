# License for the data, the documentation and the text

Copyright (c) 2026 Tracy Xu, Amr Yakout and Zhiyang Cheng.

The material listed under "Covered" is licensed under the
[Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
The full legal text is at <https://creativecommons.org/licenses/by/4.0/legalcode>.

You may copy, redistribute and adapt this material for any purpose, including commercially, provided that you give
appropriate credit, link to the license and indicate whether you made changes. To give credit, cite the working paper
as shown under "Cite" on the site and name the version of the database you used (its build date).

## Covered

- The data of the Contestability Index: the scores, codings, justifications and metadata in `data/contestability.db`,
  `data/contestability_site.db` and `data/paper.json`.
- The documentation: `files/Contestability_Index_Coding_Handbook_V4.1.pdf` and
  `files/Contestability_Index_Methodology_Manual_V3.2.pdf`, and the passages of them shown on the site.
- The text written for the pages of the site.

## Not covered

- The working paper, `files/Beyond_Market_Concentration_Working_Paper_2026-07.pdf`, and the passages of it reproduced
  on the site (in `data/paper.json`, the passages whose source is `paper`). They remain © their authors, all rights
  reserved, and may be quoted with a citation in the usual way.
- Legal texts and other material quoted from third parties: the texts of laws, regulations, decisions and guidance in
  `data/legal_texts.db`, and the quotations from them and from other sources in the fields of the database. They
  remain under the terms of their publishers.
- The code of the site, which is under the MIT License (see `LICENSE`).
- The names and marks of Georgetown University and the Knight-Georgetown Institute.

## Third-party components

- `js/world.js` holds country outlines generated from [world-atlas](https://github.com/topojson/world-atlas), which
  redistributes vector data of Natural Earth (public domain). world-atlas is under the ISC License:

  > Copyright 2013-2019 Michael Bostock
  >
  > Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
  > granted, provided that the above copyright notice and this permission notice appear in all copies.
  >
  > THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
  > IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
  > INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER
  > IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
  > PERFORMANCE OF THIS SOFTWARE.

- The site loads [sql.js](https://sql.js.org) (MIT License) from cdnjs and the typeface Libre Caslon Text (SIL Open
  Font License 1.1) from Google Fonts. Neither is part of this repository.
