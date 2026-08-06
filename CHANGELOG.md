## 2.8.0 (2026-08-06)

* **feat**(`common`): full-dataset downloads in the Data Sources panel (#498) ([498](///issues/498))
* **feat**(`common`): Power Plants from the warehouse, with PMTiles legends and parquet-backed filter options (#497) ([497](///issues/497))
* **feat**(`common`): shapefile, geopackage, geodatabase and flatgeobuf downloads via gdal3.js (#508) ([508](///issues/508))
* **fix**(`common`): correct 2x scale bar distance from 256px tile size assumption (#506) ([506](///issues/506))
* **fix**(`common`): resolve STAC layers via the items.json rollup (#509) ([509](///issues/509))
* **fix**(`common`): reveal a layer's enclosing groups when it is turned on (#490) ([490](///issues/490))
* ****: Merge pull request #510 from UGS-GIO/develop ([510](///issues/510))
* ****: Merge remote-tracking branch 'origin/master' into develop
* ****: Ucrc updated info panel content (#485) ([485](///issues/485))
* **refactor**(`ccs`): adding township to search (#481) ([481](///issues/481))
* **feat**(`geophysics`): add feedback form link in sidebar (#504) ([504](///issues/504))
* **chore**(`release`): 2.7.0 [skip ci] ([462](///issues/462)) ([465](///issues/465)) ([467](///issues/467)) ([470](///issues/470)) ([441](///issues/441)) ([473](///issues/473)) ([477](///issues/477)) ([471](///issues/471)) ([475](///issues/475)) ([472](///issues/472)) ([461](///issues/461)) ([463](///issues/463)) ([469](///issues/469)) ([459](///issues/459))
* **feat**(`subsurface`): default vector symbology to sample type on page load (#482) ([482](///issues/482))
* **feat**(`subsurface`): grouped legend display labels and per-group feature counts (#496) ([496](///issues/496))
* **refactor**(`subsurface`): derive symbology legend from STAC render, drop hardcoded box-type colors (#483) ([483](///issues/483))

## 2.7.0 (2026-08-05)

* **feat**(`common`): live PMTiles rendering via STAC renders (qfaults + UCRC migrated) (#462) ([462](///issues/462))
* **feat**(`common`): sortable related-table columns via TanStack Table (numeric/alpha, N/A last) (#465) ([465](///issues/465))
* **feat**(`common`): source popup related tables from STAC parquet assets via duckdb-wasm (#467) ([467](///issues/467))
* **fix**(`common`): add related-table download option to layerlist export (#470) ([470](///issues/470))
* **fix**(`common`): bump deploy workflows to node 22 for semantic-release 25
* **fix**(`common`): drop fgb export, rewrite geojson around broken duckdb-wasm gdal (#441) ([441](///issues/441))
* ****: Merge pull request #473 from UGS-GIO/develop ([473](///issues/473))
* ****: Merge pull request #477 from UGS-GIO/hotfix/ci-node-22 ([477](///issues/477))
* **refactor**(`ccs`):  changes to power plants layer (#471) ([471](///issues/471))
* **refactor**(`geophysics`): changes to layers (#475) ([475](///issues/475))
* **fix**(`hazards`): rename PostgREST endpoint unitdescriptions_current to hazards_unitdescriptions_current (#472) ([472](///issues/472))
* **feat**(`subsurface`): move UCRC layer filters and symbology into the layer-list dropdown (#461) ([461](///issues/461))
* **fix**(`subsurface`): legend Sample Type label, strip NUL sentinel, tighten Symbolize-by gap (#463) ([463](///issues/463))
* **refactor**(`subsurface`): ucrc inventory layer attribute changes (#469) ([469](///issues/469))
* **refactor**(`subsurface`): update ogm fields (#459) ([459](///issues/459))

## 2.6.0 (2026-06-22)

* **chore**(`common`): dependency upgrades and cleanup (#447) ([447](///issues/447))
* **feat**(`common`): add download tracking via gtm dataLayer (#456) ([456](///issues/456))
* **fix**(`common`): popup click respects layer visibility for rasters and skips empty results (#455) ([455](///issues/455))
* **fix**(`common`): render titleless related tables inline instead of as accordion (#452) ([452](///issues/452))
* **fix**: handle scientific notation in API number popups (#460) ([460](///issues/460))
* ****: Merge pull request #457 from UGS-GIO/develop ([457](///issues/457))
* ****: Ucrc layer info table changes (#458) ([458](///issues/458))
* **refactor**(`ccs`): added non petroleum layer to map (#442) ([442](///issues/442))
* **refactor**(`ccs`): added township to search (#451) ([451](///issues/451))
* **feat**(`geophysics`): adding tables to popups in same style as relatedTables (#450) ([450](///issues/450))

## [1.16.4](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.16.3...v1.16.4) (2026-01-22)


### common

* **♻️ Refactors**(`common`): use new qfaults layer

### hazards

* **🐛 Bug Fixes**(`hazards`): remove is_current filter from qfaults layer* **🐛 Bug Fixes**(`hazards`): update related table to use unitdescriptions_current* **🐛 Bug Fixes**(`hazards`): use unitdescriptions_current table in hazards-review layers

## [1.16.3](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.16.2...v1.16.3) (2025-11-13)


### ccs

* **♻️ Refactors**(`ccs`): changes to georegion opacity,  popup disclaimer and su… ([#327](https://github.com/UGS-GIO/ugs-map-viewer/issues/327))* **♻️ Refactors**(`ccs`): swap seamlessgeolunits layer ([#329](https://github.com/UGS-GIO/ugs-map-viewer/issues/329))

### common

* **♻️ Refactors**(`common`): add error boundaries for wrong url and out of bounds arguments ([#325](https://github.com/UGS-GIO/ugs-map-viewer/issues/325))* **♻️ Refactors**(`common`): change github link to new url, edit readme ([#326](https://github.com/UGS-GIO/ugs-map-viewer/issues/326))* **🐛 Bug Fixes**(`common`): don't wait for initview.when() to be true to render the map ([#324](https://github.com/UGS-GIO/ugs-map-viewer/issues/324))* **🐛 Bug Fixes**(`common`): use a div instead of p in popup ([#323](https://github.com/UGS-GIO/ugs-map-viewer/issues/323))

### data-reviewer

* **🐛 Bug Fixes**(`data-reviewer`): allow for multiple layer config descriptions to be displayed on 1 page ([#321](https://github.com/UGS-GIO/ugs-map-viewer/issues/321))

### wetlandplants

* **♻️ Refactors**(`wetlandplants`): initial setup for wetland plants app ([#320](https://github.com/UGS-GIO/ugs-map-viewer/issues/320))

## [1.16.2](https://github.com/UGS-GIO/geohaz-v2/compare/v1.16.1...v1.16.2) (2025-10-06)


### ccs

* **♻️ Refactors**(`ccs`): add data sources information, change sitla layer name ([#314](https://github.com/UGS-GIO/geohaz-v2/issues/314))

### common

* **🐛 Bug Fixes**(`common`): prevent popup drawer from closing and reopening ([#313](https://github.com/UGS-GIO/geohaz-v2/issues/313))

### data-reviewer

* **♻️ Refactors**(`data-reviewer`): change some text, update packages ([#312](https://github.com/UGS-GIO/geohaz-v2/issues/312))* **🐛 Bug Fixes**(`data-reviewer`): flood hazards review data now showing ([#319](https://github.com/UGS-GIO/geohaz-v2/issues/319))* **🐛 Bug Fixes**(`data-reviewer`): remove wrong visibility flag for landslides review layer ([#310](https://github.com/UGS-GIO/geohaz-v2/issues/310))

### hazards

* **♻️ Refactors**(`hazards`): add flooding hazard layers to hazards and hazards-review apps ([#315](https://github.com/UGS-GIO/geohaz-v2/issues/315))* **♻️ Refactors**(`hazards`): clean up routes and put report into a pathless route ([#316](https://github.com/UGS-GIO/geohaz-v2/issues/316))* **🐛 Bug Fixes**(`hazards`): correcting related tables for flood hazards ([#318](https://github.com/UGS-GIO/geohaz-v2/issues/318))

## [1.16.1](https://github.com/UGS-GIO/geohaz-v2/compare/v1.16.0...v1.16.1) (2025-10-01)


### data-reviewer

* **🐛 Bug Fixes**(`data-reviewer`): remove wrong visibility flag for landslides review layer ([#310](https://github.com/UGS-GIO/geohaz-v2/issues/310)) ([#311](https://github.com/UGS-GIO/geohaz-v2/issues/311))

## [1.16.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.15.0...v1.16.0) (2025-10-01)


### ccs

* **🐛 Bug Fixes**(`ccs`): allow or operator for formation search ([#309](https://github.com/UGS-GIO/geohaz-v2/issues/309))

### common

* **♻️ Refactors**(`common`): remove tabler/react-icons in favor of lucide icons ([#302](https://github.com/UGS-GIO/geohaz-v2/issues/302))* **♻️ Refactors**(`common`): some optimizing, upgrade packages, remove unused packages, ([#304](https://github.com/UGS-GIO/geohaz-v2/issues/304))

### data-reviewer

* **✨ Features**(`data-reviewer`): add splash screen for reviewer ([#306](https://github.com/UGS-GIO/geohaz-v2/issues/306))* **🐛 Bug Fixes**(`data-reviewer`): reorg folder structure to move params to _map, clear params from login page ([#308](https://github.com/UGS-GIO/geohaz-v2/issues/308))

### geophysics

* **✨ Features**(`geophysics`): add layers ([#305](https://github.com/UGS-GIO/geohaz-v2/issues/305))

## [1.15.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.14.0...v1.15.0) (2025-09-23)


### common

* **✨ Features**(`common`): add use-is-map-loading hook and maploadingspinner component to track map loading state ([#300](https://github.com/UGS-GIO/geohaz-v2/issues/300))

### data-reviewer

* **♻️ Refactors**(`data-reviewer`): alter visibility layers ([#297](https://github.com/UGS-GIO/geohaz-v2/issues/297))

## [1.14.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.13.1...v1.14.0) (2025-09-23)


### common

* **♻️ Refactors**(`common`): fix the logo collapsed size, connect sidebar content and collapsed state to url, refactor usegetsidebarlink and usegetpageinfo to usequery ([#294](https://github.com/UGS-GIO/geohaz-v2/issues/294))* **🐛 Bug Fixes**(`common`): prevent usegetlayerconfigs from loading all config data ([#296](https://github.com/UGS-GIO/geohaz-v2/issues/296))

### data-reviewer

* **✨ Features**(`data-reviewer`): add dynamic review layers ([#288](https://github.com/UGS-GIO/geohaz-v2/issues/288))

### geophysics

* **♻️ Refactors**(`geophysics`): Initial map setup for geophysics app ([#293](https://github.com/UGS-GIO/geohaz-v2/issues/293))

## [1.13.1](https://github.com/UGS-GIO/geohaz-v2/compare/v1.13.0...v1.13.1) (2025-09-10)


### ccs

* **♻️ Refactors**(`ccs`): add a feedback form for the carbon storage app ([#291](https://github.com/UGS-GIO/geohaz-v2/issues/291))

### common

* **♻️ Refactors**(`common`): extract feature response handling into dedicated hook* **♻️ Refactors**(`common`): extract layer visibility logic into reusable hook* **♻️ Refactors**(`common`): extract map click handling into reusable hook* **♻️ Refactors**(`common`): make a coordinate adapter to make a map library agnostic coordinate functionality* **♻️ Refactors**(`common`): move useMap to its own hook file, abstract filters and position to useDomainFilter and useMapUrlSync* **🐛 Bug Fixes**(`common`): remove a highligh/selection graphic from a feature if layer is turned off ([#290](https://github.com/UGS-GIO/geohaz-v2/issues/290))* **♻️ Refactors**(`common`): store zoom, lat, lon, in the root search schema

## [1.13.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.12.1...v1.13.0) (2025-08-28)


### ccs

* **♻️ Refactors**(`ccs`): add beta in portal title ([#282](https://github.com/UGS-GIO/geohaz-v2/issues/282))* **♻️ Refactors**(`ccs`): add disabled states to layer filters and a conditional message to turn on layer ([#284](https://github.com/UGS-GIO/geohaz-v2/issues/284))* **♻️ Refactors**(`ccs`): add las filter ([#280](https://github.com/UGS-GIO/geohaz-v2/issues/280))* **♻️ Refactors**(`ccs`): add the color ranking to the geo region layer ([#281](https://github.com/UGS-GIO/geohaz-v2/issues/281))* **🐛 Bug Fixes**(`ccs`): fix layer descriptions ([#279](https://github.com/UGS-GIO/geohaz-v2/issues/279))* **♻️ Refactors**(`ccs`): refactor ccus to either ccs or carbonstorage ([#278](https://github.com/UGS-GIO/geohaz-v2/issues/278))

### ccus

* **♻️ Refactors**(`ccus`): allow for multiple formations to be queried ([#272](https://github.com/UGS-GIO/geohaz-v2/issues/272))* **♻️ Refactors**(`ccus`): change layer Geothermal Powerplants to Geothermal Power Plants ([#269](https://github.com/UGS-GIO/geohaz-v2/issues/269))* **🐛 Bug Fixes**(`ccus`): rename layer to make layer description info accordion work ([#270](https://github.com/UGS-GIO/geohaz-v2/issues/270))* **♻️ Refactors**(`ccus`): update layer names ([#276](https://github.com/UGS-GIO/geohaz-v2/issues/276))* **♻️ Refactors**(`ccus`): update map details, data sources, references, and acknowledgements ([#268](https://github.com/UGS-GIO/geohaz-v2/issues/268))

### common

* **✨ Features**(`common`): add a landing page ([#273](https://github.com/UGS-GIO/geohaz-v2/issues/273))* **✨ Features**(`common`): add legend functionality for graphicstroke and graphicfill in sld* **✨ Features**(`common`): convert symbol generation to native svg, remove esri symbol deps ([#263](https://github.com/UGS-GIO/geohaz-v2/issues/263))* **♻️ Refactors**(`common`): create useMap hook, simplify MapProvider, and remove unused variables ([#277](https://github.com/UGS-GIO/geohaz-v2/issues/277))* **♻️ Refactors**(`common`): decrease zoom value on load, fix bad link ([#286](https://github.com/UGS-GIO/geohaz-v2/issues/286))* **♻️ Refactors**(`common`): ensure that cql filters are added with click requests ([#266](https://github.com/UGS-GIO/geohaz-v2/issues/266))* **♻️ Refactors**(`common`): make index.html file generic for now ([#283](https://github.com/UGS-GIO/geohaz-v2/issues/283))* **♻️ Refactors**(`common`): more ccus mentioned removed ([#285](https://github.com/UGS-GIO/geohaz-v2/issues/285))* **✨ Features**(`common`): return text-only legend item for SLD rules with only name elements as children ([#267](https://github.com/UGS-GIO/geohaz-v2/issues/267))

## [1.12.1](https://github.com/UGS-GIO/geohaz-v2/compare/v1.12.0...v1.12.1) (2025-08-14)


### ccus

* **♻️ Refactors**(`ccus`): finalize the order of the layers* **♻️ Refactors**(`ccus`): format popups, add coming soon message for georegions* **🐛 Bug Fixes**(`ccus`): geological units doesn't need sentence case ([#262](https://github.com/UGS-GIO/geohaz-v2/issues/262))

### common

* **♻️ Refactors**(`common`): removing dead code, use crs that is given to us by postgrest if it exists ([#265](https://github.com/UGS-GIO/geohaz-v2/issues/265))* **🐛 Bug Fixes**(`common`): top level definition of proj4, refactor searching by searchbox and highlighting ([#260](https://github.com/UGS-GIO/geohaz-v2/issues/260))

## [1.12.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.11.1...v1.12.0) (2025-08-05)


### ccus

* **✨ Features**(`ccus`): add ccs exclusion areas layer ([#257](https://github.com/UGS-GIO/geohaz-v2/issues/257))* **✨ Features**(`ccus`): add new layers ccus_majorroads, ccus_railroads, and ccus_transmissionlines ([#251](https://github.com/UGS-GIO/geohaz-v2/issues/251))* **♻️ Refactors**(`ccus`): finalize the cored_formation field in cores/cuttings ([#256](https://github.com/UGS-GIO/geohaz-v2/issues/256))* **♻️ Refactors**(`ccus`): sync filters with visible layers

### common

* **✨ Features**(`common`): add auth ([#254](https://github.com/UGS-GIO/geohaz-v2/issues/254))* **🐛 Bug Fixes**(`common`): allow layers to clear filters from url when turning off, rewrite logic for how url manages visibility ([#250](https://github.com/UGS-GIO/geohaz-v2/issues/250))* **✨ Features**(`common`): implement picturesymbols when we get an image in the legend ([#255](https://github.com/UGS-GIO/geohaz-v2/issues/255))

## [1.11.1](https://github.com/UGS-GIO/geohaz-v2/compare/v1.11.0...v1.11.1) (2025-08-04)


### data-reviewer

* **🐛 Bug Fixes**(`data-reviewer`): change is_current_cql to allow for review items ([#253](https://github.com/UGS-GIO/geohaz-v2/issues/253))

## [1.11.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.10.0...v1.11.0) (2025-07-09)


### ccus

* **✨ Features**(`ccus`): add geothermal powerplants layer ([#243](https://github.com/UGS-GIO/geohaz-v2/issues/243))* **♻️ Refactors**(`ccus`): add popupfields to 500k layer ([#240](https://github.com/UGS-GIO/geohaz-v2/issues/240))* **♻️ Refactors**(`ccus`): changing some popups ([#233](https://github.com/UGS-GIO/geohaz-v2/issues/233))* **♻️ Refactors**(`ccus`): implement map-image legend for sitla landownership ([#242](https://github.com/UGS-GIO/geohaz-v2/issues/242))* **♻️ Refactors**(`ccus`): remove unused diameter field for pipelines layer ([#239](https://github.com/UGS-GIO/geohaz-v2/issues/239))* **♻️ Refactors**(`ccus`): update Major Rivers layer popup ([#241](https://github.com/UGS-GIO/geohaz-v2/issues/241))

### common

* **🐛 Bug Fixes**(`common`): prevent the constant rerendering when moving the mouse ([#244](https://github.com/UGS-GIO/geohaz-v2/issues/244))* **♻️ Refactors**(`common`): refactor use-map-container into more hooks, integrate react-query more ([#245](https://github.com/UGS-GIO/geohaz-v2/issues/245))

### data-reviewer

* **✨ Features**(`data-reviewer`): add data reviewer app ([#237](https://github.com/UGS-GIO/geohaz-v2/issues/237))

### hazards

* **✨ Features**(`hazards`): set up new report gen page ([#238](https://github.com/UGS-GIO/geohaz-v2/issues/238))

## [1.10.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.9.0...v1.10.0) (2025-06-05)


### ccus

* **✨ Features**(`ccus`): add wells filter, add formation name filter ([#232](https://github.com/UGS-GIO/geohaz-v2/issues/232))* **✨ Features**(`ccus`): added popup attributes ([#231](https://github.com/UGS-GIO/geohaz-v2/issues/231))* **♻️ Refactors**(`ccus`): altering popup format, add link to epa data ([#234](https://github.com/UGS-GIO/geohaz-v2/issues/234))

### common

* **♻️ Refactors**(`common`): comment out unused filter cards

* **✨ Features**: allow us to specify specific cql with map calls ([#236](https://github.com/UGS-GIO/geohaz-v2/issues/236))

### wetlands

* **✨ Features**(`wetlands`): added opacity settings ([#229](https://github.com/UGS-GIO/geohaz-v2/issues/229))

## [1.9.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.8.0...v1.9.0) (2025-05-13)


### ccus

* **✨ Features**(`ccus`): add cores, ccus_co2_sources, ccus_wsa, ccus_sitla_reports layers ([#222](https://github.com/UGS-GIO/geohaz-v2/issues/222))

### common

* **♻️ Refactors**(`common`): ensure all legend symbol icons are aligned ([#221](https://github.com/UGS-GIO/geohaz-v2/issues/221))* **👷 CI/CD**(`common`): make changelog include commit type ([#219](https://github.com/UGS-GIO/geohaz-v2/issues/219))* **♻️ Refactors**(`common`): make useFetchLayerDescriptions more dynamic by page ([#223](https://github.com/UGS-GIO/geohaz-v2/issues/223))* **👷 CI/CD**(`common`): relax the commit length rules ([#217](https://github.com/UGS-GIO/geohaz-v2/issues/217))* **✨ Features**(`common`): turn on layers when searching for in searchbox ([#227](https://github.com/UGS-GIO/geohaz-v2/issues/227))

### wetlands

* **✨ Features**(`wetlands`): added popup info ([#224](https://github.com/UGS-GIO/geohaz-v2/issues/224))* **✨ Features**(`wetlands`): added popup info ([#226](https://github.com/UGS-GIO/geohaz-v2/issues/226))

## [1.8.0](https://github.com/UGS-GIO/geohaz-v2/compare/v1.7.0...v1.8.0) (2025-05-02)


### common

* **common:** add a geocoder search to the search-combobox ([#212](https://github.com/UGS-GIO/geohaz-v2/issues/212)) ([18b636e](https://github.com/UGS-GIO/geohaz-v2/commit/18b636eb45e6a9946555059b9481be50a565b4fe))
* **common:** add new subdomains to firebaserc ([434e794](https://github.com/UGS-GIO/geohaz-v2/commit/434e794570a49f6193062ed7e05ccac5b06b471e))
* **common:** add redirects to firebase hosting, new production deployment workflows ([34c9e28](https://github.com/UGS-GIO/geohaz-v2/commit/34c9e28b59687b17eaadae6a42a468f921019faa))
* **common:** add redirects to firebase hosting, new production deployment workflows ([d6cb3ae](https://github.com/UGS-GIO/geohaz-v2/commit/d6cb3aee474bdfe29f5412704659da2edf67d40b))
* **common:** add release as a scope-enum ([b0347cc](https://github.com/UGS-GIO/geohaz-v2/commit/b0347cc887edf25721057f3cd76b176a86f4ff2d))
* **common:** add wetlands to firebase.json and firebaserc ([7af6a72](https://github.com/UGS-GIO/geohaz-v2/commit/7af6a726e2ac8991dd2a5aa5bda97519a0e842af))
* **common:** cleaning up and fixing firebase configs and github actions ([#216](https://github.com/UGS-GIO/geohaz-v2/issues/216)) ([fb67502](https://github.com/UGS-GIO/geohaz-v2/commit/fb6750243845de0f3026b2c00aac2f31a74ae44a))
* **common:** fix wetlands hosting targets ([6d7e124](https://github.com/UGS-GIO/geohaz-v2/commit/6d7e1248b5f57bea74f6afd75b2fd3a48bfd6a69))
* **common:** relax the commit length rules ([#217](https://github.com/UGS-GIO/geohaz-v2/issues/217)) ([#218](https://github.com/UGS-GIO/geohaz-v2/issues/218)) ([d13016b](https://github.com/UGS-GIO/geohaz-v2/commit/d13016be407e26809d30b84072ed1b1c3bc41ea1))
* **common:** revert the firebaserc code ([3000809](https://github.com/UGS-GIO/geohaz-v2/commit/3000809f62b39edef4be514656900bfe2da68c16))


### wetlands

* **wetlands:** add layers to map ([#211](https://github.com/UGS-GIO/geohaz-v2/issues/211)) ([7f0f532](https://github.com/UGS-GIO/geohaz-v2/commit/7f0f5325da2220152509068f218aac1fc5807229))
