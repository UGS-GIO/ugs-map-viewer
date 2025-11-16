## [1.0.0-beta.2](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.12.0...v1.0.0-beta.2) (2025-11-16)

### Features

* **common:** add a landing page ([#273](https://github.com/UGS-GIO/ugs-map-viewer/issues/273)) ([269cf4f](https://github.com/UGS-GIO/ugs-map-viewer/commit/269cf4f50ec1f71400f03525a2d48168d5637c37))
* **common:** add export control with theme styling and remove arcgis deps ([32a8a82](https://github.com/UGS-GIO/ugs-map-viewer/commit/32a8a820229be8bb234a9b106a2e28a3bae518f0))
* **common:** add legend functionality for graphicstroke and graphicfill in sld ([dcbd9d1](https://github.com/UGS-GIO/ugs-map-viewer/commit/dcbd9d1713b765b938ed2aad680b91089d3e32a0))
* **common:** add mapfactory abstraction for parallel arcgis/maplibre initialization ([1bb0657](https://github.com/UGS-GIO/ugs-map-viewer/commit/1bb0657fa46eb8df93bccadbcc865aefbebaefa4))
* **common:** add maplibre url sync for zoom and position updates ([73854f9](https://github.com/UGS-GIO/ugs-map-viewer/commit/73854f90a1b78b3c7553ba248ba3485f2e9fffe0))
* **common:** add multi-select as maplibre control with polygon-based query ([ce4503e](https://github.com/UGS-GIO/ugs-map-viewer/commit/ce4503e91e555eb0be4674d10ebd372023fb4f1b))
* **common:** add use-is-map-loading hook and maploadingspinner component to track map loading state ([#300](https://github.com/UGS-GIO/ugs-map-viewer/issues/300)) ([3428d7e](https://github.com/UGS-GIO/ugs-map-viewer/commit/3428d7eff49d8eb2d727176ead1d00ef9b8e98c1))
* **common:** convert symbol generation to native svg, remove esri symbol deps ([#263](https://github.com/UGS-GIO/ugs-map-viewer/issues/263)) ([569e3f2](https://github.com/UGS-GIO/ugs-map-viewer/commit/569e3f27571316b209280618b543d16ce5d03453))
* **common:** implement maplibre gl controls system with home button and centralized configuration ([75ae373](https://github.com/UGS-GIO/ugs-map-viewer/commit/75ae3739bc1e5f2b0e717f130c96848df3ff4096))
* **common:** implement maplibreMapProvider using factory pattern ([2d8be12](https://github.com/UGS-GIO/ugs-map-viewer/commit/2d8be12692de70afb4c12e06ba914f9126a768c6))
* **common:** implement parallel map provider architecture with coordinate adapters ([bfc3a8e](https://github.com/UGS-GIO/ugs-map-viewer/commit/bfc3a8e29fc05f4d2d4ace19d434d218679b90f9))
* **common:** improve wms feature selection and highlighting ([c9d2176](https://github.com/UGS-GIO/ugs-map-viewer/commit/c9d21767b0c63db35f4d3fdebef9b47a53bc175e))
* **common:** migrate basemaps from esri to openfreemap and sentenel-2 with url integration ([0fdebc9](https://github.com/UGS-GIO/ugs-map-viewer/commit/0fdebc9c3b5a6be7c54285645de2b339a2174038))
* **common:** migrate popup from vaul drawer to shadcn sheet with glassmorphism ([2acf0e1](https://github.com/UGS-GIO/ugs-map-viewer/commit/2acf0e17241c3e4fed174b18fb12cebec0101e45))
* **common:** return text-only legend item for SLD rules with only name elements as children ([#267](https://github.com/UGS-GIO/ugs-map-viewer/issues/267)) ([079ad79](https://github.com/UGS-GIO/ugs-map-viewer/commit/079ad7965fcd598ee0e3537b22f206b685c529bc))
* **data-reviewer:** add dynamic review layers ([#288](https://github.com/UGS-GIO/ugs-map-viewer/issues/288)) ([c6da29c](https://github.com/UGS-GIO/ugs-map-viewer/commit/c6da29ce0977130c94bde8f7221cbf4e01db7542))
* **data-reviewer:** add splash screen for reviewer ([#306](https://github.com/UGS-GIO/ugs-map-viewer/issues/306)) ([7040910](https://github.com/UGS-GIO/ugs-map-viewer/commit/70409102a19988026f4b9e6fb9ec4c4504c6fbb2))
* **geophysics:** add layers ([#305](https://github.com/UGS-GIO/ugs-map-viewer/issues/305)) ([c3511e9](https://github.com/UGS-GIO/ugs-map-viewer/commit/c3511e9be7610f9361d269742f55cfce35a32bfb))
* **hazards:** add terra draw polygon integration for maplibre report generator ([d236fb2](https://github.com/UGS-GIO/ugs-map-viewer/commit/d236fb21d0e1adee48a1559018ce31a28f4a7d95))
* **hazards:** rewrite report generator and remove legacy code ([#322](https://github.com/UGS-GIO/ugs-map-viewer/issues/322)) ([a39fd9e](https://github.com/UGS-GIO/ugs-map-viewer/commit/a39fd9ed6b43839f2bbc57ce005d0f228100628d))

### Bug Fixes

* **ccs:** allow or operator for formation search ([#309](https://github.com/UGS-GIO/ugs-map-viewer/issues/309)) ([8fb0cc5](https://github.com/UGS-GIO/ugs-map-viewer/commit/8fb0cc5eed33df02e6d7f2ae737ec18526ba6528))
* **ccs:** fix layer descriptions ([#279](https://github.com/UGS-GIO/ugs-map-viewer/issues/279)) ([ec3c0f8](https://github.com/UGS-GIO/ugs-map-viewer/commit/ec3c0f842f44cc112951fc81a15fc90cc4df7280))
* **ccs:** resolve wells database filter reset issue ([4a312b3](https://github.com/UGS-GIO/ugs-map-viewer/commit/4a312b31551f1b6533ec4fa5e4b18c7d268937d1))
* **ccus:** geological units doesn't need sentence case ([#262](https://github.com/UGS-GIO/ugs-map-viewer/issues/262)) ([ada235b](https://github.com/UGS-GIO/ugs-map-viewer/commit/ada235b1c1d1676fb192fe67651a58258850e601))
* **ccus:** rename layer to make layer description info accordion work ([#270](https://github.com/UGS-GIO/ugs-map-viewer/issues/270)) ([dff196e](https://github.com/UGS-GIO/ugs-map-viewer/commit/dff196e6f6e17be391ee8b9a9b5bc5130d5e9480))
* **common:** add proper typescript types to layer transform functions ([a4219de](https://github.com/UGS-GIO/ugs-map-viewer/commit/a4219de92cd1903cb3c54cad47634da6bc5ce9fa))
* **common:** add vite config for maplibre gl js 5.12 static class field support ([ab8162a](https://github.com/UGS-GIO/ugs-map-viewer/commit/ab8162a621c1a9f00d15589568df71b91f2c6783))
* **common:** clean up unused view import and fix coordinate adapter usage in map interactions ([9361a88](https://github.com/UGS-GIO/ugs-map-viewer/commit/9361a88060e0088416f9d302e85c57f8466141e4))
* **common:** clear terra draw state when closing polygon query popup ([f7e1b44](https://github.com/UGS-GIO/ugs-map-viewer/commit/f7e1b445b0af58ca38c79220e9ff4a2d5797635f))
* **common:** don't wait for initview.when() to be true to render the map ([#324](https://github.com/UGS-GIO/ugs-map-viewer/issues/324)) ([c7ba5e9](https://github.com/UGS-GIO/ugs-map-viewer/commit/c7ba5e9cbc76461f9de7c1e9bbec0cc30dcbbc2b))
* **common:** enable WMS legend generation via source metadata ([92f4e9d](https://github.com/UGS-GIO/ugs-map-viewer/commit/92f4e9d35a098cf25a84ceedb7dafb13634ffa49))
* **common:** implement highlight system with click handler and provider caching ([a1f9970](https://github.com/UGS-GIO/ugs-map-viewer/commit/a1f99700aac8ec0e8c3fec1070adb2fd93c6c965))
* **common:** improve bbox conversion for wms coordinate detection ([01c74a8](https://github.com/UGS-GIO/ugs-map-viewer/commit/01c74a812cb75c427edb8620e77a95cb8beb93a4))
* **common:** prevent popup drawer from closing and reopening ([#313](https://github.com/UGS-GIO/ugs-map-viewer/issues/313)) ([35f4f84](https://github.com/UGS-GIO/ugs-map-viewer/commit/35f4f8425b84a6cacde8f7cc5307cbb6a6835f29))
* **common:** prevent usegetlayerconfigs from loading all config data ([#296](https://github.com/UGS-GIO/ugs-map-viewer/issues/296)) ([6b3e530](https://github.com/UGS-GIO/ugs-map-viewer/commit/6b3e530a6b76b0fe86ec231254718e2a2e3999a0))
* **common:** remove a highligh/selection graphic from a feature if layer is turned off ([#290](https://github.com/UGS-GIO/ugs-map-viewer/issues/290)) ([5e8dade](https://github.com/UGS-GIO/ugs-map-viewer/commit/5e8dade20ee61b16f8bbc8be5788eb63243ff680))
* **common:** remove duplicate popup titles and showlayertitles prop ([64604cf](https://github.com/UGS-GIO/ugs-map-viewer/commit/64604cfbd5a5ced30b8e169e0094660f76b59b2c))
* **common:** resolve merge conflict in carbonstorage layers with proper types ([b5aa970](https://github.com/UGS-GIO/ugs-map-viewer/commit/b5aa970a5000172173726af460b89817ae150074))
* **common:** top level definition of proj4, refactor searching by searchbox and highlighting ([#260](https://github.com/UGS-GIO/ugs-map-viewer/issues/260)) ([69e8a9b](https://github.com/UGS-GIO/ugs-map-viewer/commit/69e8a9b925c1d97ffa7235fb531136885fb02206))
* **common:** use a div instead of p in popup ([#323](https://github.com/UGS-GIO/ugs-map-viewer/issues/323)) ([693d869](https://github.com/UGS-GIO/ugs-map-viewer/commit/693d869f50e3da572233ada11fd103f1dc0d2511))
* **common:** use getMapImplementation in MapProvider to respect maplibre default ([8c6210f](https://github.com/UGS-GIO/ugs-map-viewer/commit/8c6210f5e8354eef077e7c479073b4c35d0f4641))
* **data-reviewer:** allow for multiple layer config descriptions to be displayed on 1 page ([#321](https://github.com/UGS-GIO/ugs-map-viewer/issues/321)) ([1374f26](https://github.com/UGS-GIO/ugs-map-viewer/commit/1374f2640121018d9acf81bec5c93209df049f43))
* **data-reviewer:** flood hazards review data now showing ([#319](https://github.com/UGS-GIO/ugs-map-viewer/issues/319)) ([bef4aef](https://github.com/UGS-GIO/ugs-map-viewer/commit/bef4aef9af0f34b6f41245c80e7f9f1a1e99fda6))
* **data-reviewer:** remove wrong visibility flag for landslides review layer ([#310](https://github.com/UGS-GIO/ugs-map-viewer/issues/310)) ([8f747d2](https://github.com/UGS-GIO/ugs-map-viewer/commit/8f747d2243f8ba42662fde042cb5c5b423056d1c))
* **data-reviewer:** reorg folder structure to move params to _map, clear params from login page ([#308](https://github.com/UGS-GIO/ugs-map-viewer/issues/308)) ([3040a6e](https://github.com/UGS-GIO/ugs-map-viewer/commit/3040a6ece337d6e724831d64161f565d0cdad16c))
* **hazards:** correcting related tables for flood hazards ([#318](https://github.com/UGS-GIO/ugs-map-viewer/issues/318)) ([8d810c3](https://github.com/UGS-GIO/ugs-map-viewer/commit/8d810c331b911292e05244c805306aa0a898f795))
* **hazards:** use wgs84 coordinates in report urls and add proper polygon typing ([89361f5](https://github.com/UGS-GIO/ugs-map-viewer/commit/89361f563a305edbc142223a47b9f8bfb2eb7f4c))

### Performance Improvements

* **common:** use constant app titles instead of loading page-info in headers ([be3ffc1](https://github.com/UGS-GIO/ugs-map-viewer/commit/be3ffc1fdcbee123bd5c1f53d1d01c5a999f6399))
* **hazards:** lazy load firebase to reduce bundle size ([40d6495](https://github.com/UGS-GIO/ugs-map-viewer/commit/40d64950df36fbf93a87630b3b6b8423886c1be2))
* **hazards:** lazy load terra draw and export control ([035b705](https://github.com/UGS-GIO/ugs-map-viewer/commit/035b70574d0981554d50a2986f055b2ceae05b34))
## [1.12.0](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.11.1...v1.12.0) (2025-08-05)

### Features

* **ccus:** add ccs exclusion areas layer ([#257](https://github.com/UGS-GIO/ugs-map-viewer/issues/257)) ([7744a85](https://github.com/UGS-GIO/ugs-map-viewer/commit/7744a85afa2754ad5c01a736233ac105311c2169))
* **ccus:** add new layers ccus_majorroads, ccus_railroads, and ccus_transmissionlines ([#251](https://github.com/UGS-GIO/ugs-map-viewer/issues/251)) ([5438b84](https://github.com/UGS-GIO/ugs-map-viewer/commit/5438b84ea916fe9c1058f15f5d5e869c74ec904d))
* **common:** add auth ([#254](https://github.com/UGS-GIO/ugs-map-viewer/issues/254)) ([ea21121](https://github.com/UGS-GIO/ugs-map-viewer/commit/ea2112135adf42d86ef9d7b4ea49ebb68d69c3ae))
* **common:** add layers to url state management, enable layers in url to override default ([#247](https://github.com/UGS-GIO/ugs-map-viewer/issues/247)) ([1ebc9d0](https://github.com/UGS-GIO/ugs-map-viewer/commit/1ebc9d03bca1abac1909101c419d6d9996675f7b))
* **common:** implement picturesymbols when we get an image in the legend ([#255](https://github.com/UGS-GIO/ugs-map-viewer/issues/255)) ([1b4fb7d](https://github.com/UGS-GIO/ugs-map-viewer/commit/1b4fb7d62d578fc6f7912611e06d4dc901923616))

### Bug Fixes

* **common:** allow layers to clear filters from url when turning off, rewrite logic for how url manages visibility ([#250](https://github.com/UGS-GIO/ugs-map-viewer/issues/250)) ([c9f27d0](https://github.com/UGS-GIO/ugs-map-viewer/commit/c9f27d08f3e69165519ee5da2f5971704054302e))
## [1.11.1](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.11.0...v1.11.1) (2025-08-04)

### Bug Fixes

* **data-reviewer:** change is_current_cql to allow for review items ([#253](https://github.com/UGS-GIO/ugs-map-viewer/issues/253)) ([1bd0adb](https://github.com/UGS-GIO/ugs-map-viewer/commit/1bd0adba98411f1f62350184a9621722cbc048a6))
## [1.11.0](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.10.0...v1.11.0) (2025-07-09)

### Features

* **ccus:** add geothermal powerplants layer ([#243](https://github.com/UGS-GIO/ugs-map-viewer/issues/243)) ([70622eb](https://github.com/UGS-GIO/ugs-map-viewer/commit/70622eb70e4347388db36d581ed034392c7d3260))
* **data-reviewer:** add data reviewer app ([#237](https://github.com/UGS-GIO/ugs-map-viewer/issues/237)) ([c07b340](https://github.com/UGS-GIO/ugs-map-viewer/commit/c07b3400e80fe6f9dd11f1c5b77aae028cd07177))
* **hazards:** set up new report gen page ([#238](https://github.com/UGS-GIO/ugs-map-viewer/issues/238)) ([fc3bad0](https://github.com/UGS-GIO/ugs-map-viewer/commit/fc3bad01eef0aca93bc82a1b238c61ed2106884d))

### Bug Fixes

* **common:** prevent the constant rerendering when moving the mouse ([#244](https://github.com/UGS-GIO/ugs-map-viewer/issues/244)) ([92ffd27](https://github.com/UGS-GIO/ugs-map-viewer/commit/92ffd273764333762c3acd55e9acac831caf9406))
## [1.10.0](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.9.0...v1.10.0) (2025-06-05)

### Features

* allow us to specify specific cql with map calls ([#236](https://github.com/UGS-GIO/ugs-map-viewer/issues/236)) ([8e476c4](https://github.com/UGS-GIO/ugs-map-viewer/commit/8e476c43cd1a19ec56b010c0e90fe0867e86ab37))
* **ccus:** add wells filter, add formation name filter ([#232](https://github.com/UGS-GIO/ugs-map-viewer/issues/232)) ([39827f8](https://github.com/UGS-GIO/ugs-map-viewer/commit/39827f88cd2fb540d610496f84daa1fb3c64f525))
* **ccus:** added popup attributes ([#231](https://github.com/UGS-GIO/ugs-map-viewer/issues/231)) ([0506a55](https://github.com/UGS-GIO/ugs-map-viewer/commit/0506a55dacac715ec32b3548965d0e30a35636d2))
* **wetlands:** added opacity settings ([#229](https://github.com/UGS-GIO/ugs-map-viewer/issues/229)) ([6165bd1](https://github.com/UGS-GIO/ugs-map-viewer/commit/6165bd17fd8034cdfecafa870757f8976735b3f8))
## [1.9.0](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.8.0...v1.9.0) (2025-05-13)

### Features

* **ccus:** add cores, ccus_co2_sources, ccus_wsa, ccus_sitla_reports layers ([#222](https://github.com/UGS-GIO/ugs-map-viewer/issues/222)) ([7e8ad11](https://github.com/UGS-GIO/ugs-map-viewer/commit/7e8ad1160da5b7fad1fb10b7e06b922852825f83))
* **wetlands:** added popup info ([#224](https://github.com/UGS-GIO/ugs-map-viewer/issues/224)) ([01e2947](https://github.com/UGS-GIO/ugs-map-viewer/commit/01e294710c0611cac784a505ed1f64547a8c7aed))
* **wetlands:** added popup info ([#226](https://github.com/UGS-GIO/ugs-map-viewer/issues/226)) ([e4372ac](https://github.com/UGS-GIO/ugs-map-viewer/commit/e4372aceb669fd8eb04b1d97f7d1cd5bf8767ef3))

### Reverts

* Revert "feat(wetlands): added popup info (#224)" (#225) ([7741dd2](https://github.com/UGS-GIO/ugs-map-viewer/commit/7741dd26be85b092efd5fa45f16bb8a6c13ff48a)), closes [#224](https://github.com/UGS-GIO/ugs-map-viewer/issues/224) [#225](https://github.com/UGS-GIO/ugs-map-viewer/issues/225)
## [1.8.0](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.7.0...v1.8.0) (2025-05-02)

### Features

* add layers to minerals app (minerals) ([#161](https://github.com/UGS-GIO/ugs-map-viewer/issues/161)) ([6bfd02a](https://github.com/UGS-GIO/ugs-map-viewer/commit/6bfd02ab2092b592df2a2aff02725fd6ace9ef46))
* **ccus:** add LAS related table for ([#156](https://github.com/UGS-GIO/ugs-map-viewer/issues/156)) ([48ae5cc](https://github.com/UGS-GIO/ugs-map-viewer/commit/48ae5cc64e929057998145c53997123524851da8))
* **ccus:** add qfaults layer ([7d7d2c9](https://github.com/UGS-GIO/ugs-map-viewer/commit/7d7d2c9e5d7e7715765e55e319b343bffc4f6893))
* **ccus:** add qfaults layer ([#192](https://github.com/UGS-GIO/ugs-map-viewer/issues/192)) ([5fff0be](https://github.com/UGS-GIO/ugs-map-viewer/commit/5fff0bea490ca3cb0043775c3f3c82a6598217f3))
* **common:** add a custom hardcoded optional linkFields element ([#184](https://github.com/UGS-GIO/ugs-map-viewer/issues/184)) ([128c191](https://github.com/UGS-GIO/ugs-map-viewer/commit/128c191f47465a93a94349c756a24753d31ce2e9))
* **common:** add a geocoder search to the search-combobox ([#212](https://github.com/UGS-GIO/ugs-map-viewer/issues/212)) ([18b636e](https://github.com/UGS-GIO/ugs-map-viewer/commit/18b636eb45e6a9946555059b9481be50a565b4fe))
* **common:** implement 'custom' field to create a paragraph view or concatenate fields together ([#186](https://github.com/UGS-GIO/ugs-map-viewer/issues/186)) ([0e62666](https://github.com/UGS-GIO/ugs-map-viewer/commit/0e62666cbbe230ad15ddd8b67c0b7058d641fdd5))
* **common:** implement sorting for related table ([3c7089f](https://github.com/UGS-GIO/ugs-map-viewer/commit/3c7089f21f35bea8fb21c77d024a8e5b5c89f769))
* **wetlands:** add layers to map ([#211](https://github.com/UGS-GIO/ugs-map-viewer/issues/211)) ([7f0f532](https://github.com/UGS-GIO/ugs-map-viewer/commit/7f0f5325da2220152509068f218aac1fc5807229))
* **wetlands:** added wetlands route and populated with map ([#191](https://github.com/UGS-GIO/ugs-map-viewer/issues/191)) ([839f005](https://github.com/UGS-GIO/ugs-map-viewer/commit/839f00567d3253dcf0e23743a96de29f410f86e4))

### Bug Fixes

* **common:** cleaning up and fixing firebase configs and github actions ([#216](https://github.com/UGS-GIO/ugs-map-viewer/issues/216)) ([fb67502](https://github.com/UGS-GIO/ugs-map-viewer/commit/fb6750243845de0f3026b2c00aac2f31a74ae44a))
* **hazards:** fix acknowledgments spelling, update report generator report link ([#169](https://github.com/UGS-GIO/ugs-map-viewer/issues/169)) ([95ed512](https://github.com/UGS-GIO/ugs-map-viewer/commit/95ed512fa1587fbc71fb5a0416898a493a10f534))
## [1.6.1](https://github.com/UGS-GIO/ugs-map-viewer/compare/v1.6.0...v1.6.1) (2025-02-28)

### Features

* add a basemap switcher to the top nav ([#56](https://github.com/UGS-GIO/ugs-map-viewer/issues/56)) ([e367ccf](https://github.com/UGS-GIO/ugs-map-viewer/commit/e367ccfd23bed8f908a7d25ea4f896de02f7528f))
* add a button that will take you to the layers panel (ALL-2236) ([#25](https://github.com/UGS-GIO/ugs-map-viewer/issues/25)) ([6145752](https://github.com/UGS-GIO/ugs-map-viewer/commit/61457522aea16b4545520d33806f415d6091cc26))
* add a button to the popup to open the report generator panel ([#75](https://github.com/UGS-GIO/ugs-map-viewer/issues/75)) ([36751a6](https://github.com/UGS-GIO/ugs-map-viewer/commit/36751a67252a7149da82152d3c16c3d55093723f))
* add a legend combined with a layerlist, include controls to adjust opacity and visibility (ALL-1461) ([bfec0cc](https://github.com/UGS-GIO/ugs-map-viewer/commit/bfec0ccc3efa2b7554d5cb6ec81da326f9e084e7))
* add a linkFields prop to the wms sublayers to make external link ([#96](https://github.com/UGS-GIO/ugs-map-viewer/issues/96)) ([827c2f0](https://github.com/UGS-GIO/ugs-map-viewer/commit/827c2f0b96eb25bb05838b7eaa3d652b0109c341))
* add a seachbar with address and qfaults search ([#24](https://github.com/UGS-GIO/ugs-map-viewer/issues/24)) ([5c77939](https://github.com/UGS-GIO/ugs-map-viewer/commit/5c77939b387216e574872ff7ca192bbcb55ae13d))
* add a select all checkbox in layerlist, add switch for grouplayers ([#112](https://github.com/UGS-GIO/ugs-map-viewer/issues/112)) ([e20efd0](https://github.com/UGS-GIO/ugs-map-viewer/commit/e20efd0eeb3bf4e6aaaed8239d0632253ca30f16))
* add a tooltip with description for each imported layer ([#29](https://github.com/UGS-GIO/ugs-map-viewer/issues/29)) ([df25bbf](https://github.com/UGS-GIO/ugs-map-viewer/commit/df25bbf19fe648e114fbed29a5a6b31b05fde24e))
* add a transform and decimalplaces property to popupFields ([#118](https://github.com/UGS-GIO/ugs-map-viewer/issues/118)) ([9a22790](https://github.com/UGS-GIO/ugs-map-viewer/commit/9a22790a73cd3957d23563386c912eb5287b9701))
* add and refactor existing code for hazard report generator  ([#34](https://github.com/UGS-GIO/ugs-map-viewer/issues/34)) ([e2cb997](https://github.com/UGS-GIO/ugs-map-viewer/commit/e2cb997568ff7f0a80ba4379b62ea7edff9f4dba))
* add contact webmaster link (ALL-1510) ([8b41356](https://github.com/UGS-GIO/ugs-map-viewer/commit/8b41356af80e0515d08cd16cc9574df81f2daba3))
* add custom basemap option for the basemapList ([#140](https://github.com/UGS-GIO/ugs-map-viewer/issues/140)) ([aa3c6da](https://github.com/UGS-GIO/ugs-map-viewer/commit/aa3c6da5b169b275cba7c17f54d96b35d7690867))
* add favicon (ALL-2135) ([50cc9f5](https://github.com/UGS-GIO/ugs-map-viewer/commit/50cc9f5ec3e7afaeb2a2a14217f83044098091d0))
* add feedback link (hazards) ([#158](https://github.com/UGS-GIO/ugs-map-viewer/issues/158)) ([6381055](https://github.com/UGS-GIO/ugs-map-viewer/commit/638105586172b73d5e012943c9044dd2bab95d42))
* add layer descriptions, convert the dialog to a toggle that triggers an accordion ([#58](https://github.com/UGS-GIO/ugs-map-viewer/issues/58)) ([1d13eb9](https://github.com/UGS-GIO/ugs-map-viewer/commit/1d13eb9bf863b217fe9ae6a2010e6669664324d9))
* add legend to layerlist accordions, enable popup for WMS layer ([#42](https://github.com/UGS-GIO/ugs-map-viewer/issues/42)) ([e1dcde6](https://github.com/UGS-GIO/ugs-map-viewer/commit/e1dcde620d5e6a8a80c8cdd9aa5535c1a4d9ede3))
* add logic behind map configurations coordinate toggle ([#53](https://github.com/UGS-GIO/ugs-map-viewer/issues/53)) ([b0980ca](https://github.com/UGS-GIO/ugs-map-viewer/commit/b0980ca735961abeda9da08abc88638561833a0a))
* add mineral_resources app ([#153](https://github.com/UGS-GIO/ugs-map-viewer/issues/153)) ([760780c](https://github.com/UGS-GIO/ugs-map-viewer/commit/760780cd5c193e4af960c601d870fdb6b7cce6df))
* add semantic release to github action workflow (ALL-1535) ([c83dd7e](https://github.com/UGS-GIO/ugs-map-viewer/commit/c83dd7eb6c9d8e82d2d4e0c45d9274041252c633))
* add tanstack router, remove react-router-dom, track zoom/lat/lon in url ([#67](https://github.com/UGS-GIO/ugs-map-viewer/issues/67)) ([fbe6961](https://github.com/UGS-GIO/ugs-map-viewer/commit/fbe696111eeeccc0a8fc6adb4e40036042cc084a))
* add updated data disclaimer text (ALL-1471) ([0d1b194](https://github.com/UGS-GIO/ugs-map-viewer/commit/0d1b1942685e5996f875251c5db008500846d644))
* add zoom to feature and highlight logic ([#79](https://github.com/UGS-GIO/ugs-map-viewer/issues/79)) ([4d7b780](https://github.com/UGS-GIO/ugs-map-viewer/commit/4d7b7808f10a9ffda331f61aedeccc6fecee672e))
* adding an optional raster value to the popup ([#121](https://github.com/UGS-GIO/ugs-map-viewer/issues/121)) ([f1a63df](https://github.com/UGS-GIO/ugs-map-viewer/commit/f1a63dffe8a7eadbb9763bb30c8382e97c2587bd))
* adding content to info panel ([#31](https://github.com/UGS-GIO/ugs-map-viewer/issues/31)) ([50a0b16](https://github.com/UGS-GIO/ugs-map-viewer/commit/50a0b16bba6d6e33274bd2ad45465a60ae25d908))
* adding husky and commitlint to enforce conventional commits ([#68](https://github.com/UGS-GIO/ugs-map-viewer/issues/68)) ([a6673c1](https://github.com/UGS-GIO/ugs-map-viewer/commit/a6673c1db5e375a5ede88b9f570ac6690a2536ef))
* adding more sidebar placeholders, update some colors ([3fb26a4](https://github.com/UGS-GIO/ugs-map-viewer/commit/3fb26a4c8811788e901e1190a391567baeca5f89))
* **ccus:** add 500k faults layer ([f745eb1](https://github.com/UGS-GIO/ugs-map-viewer/commit/f745eb144de7ff9f985c003a5793313d8ad988e1))
* **ccus:** add 500k faults layer ([#109](https://github.com/UGS-GIO/ugs-map-viewer/issues/109)) ([6be11fe](https://github.com/UGS-GIO/ugs-map-viewer/commit/6be11fe441521ef787199e29a688e227da06d66f))
* **ccus:** add related tables for ccus wells ([#97](https://github.com/UGS-GIO/ugs-map-viewer/issues/97)) ([63af352](https://github.com/UGS-GIO/ugs-map-viewer/commit/63af3529c8d8e9f141edb1cf5b7ca6c0808c5850))
* create custom hook to manage getting layer extents ([#108](https://github.com/UGS-GIO/ugs-map-viewer/issues/108)) ([52b7005](https://github.com/UGS-GIO/ugs-map-viewer/commit/52b70057659ddfabede79a7f5421d21f0222c200))
* Create main.yml ([f1be60d](https://github.com/UGS-GIO/ugs-map-viewer/commit/f1be60dbf93244b7317a23249a71a252dd8d3506))
* decrease width of the expanded toolbar (ALL-2136) ([#21](https://github.com/UGS-GIO/ugs-map-viewer/issues/21)) ([09e6064](https://github.com/UGS-GIO/ugs-map-viewer/commit/09e6064178d73ded9c75da53643c5634b3b2df53))
* deploy on merge action (ALL-1518) ([e753646](https://github.com/UGS-GIO/ugs-map-viewer/commit/e753646461a70de25f62a9bbda099ea46d245576))
* dock popup, upgrade calcite ([#27](https://github.com/UGS-GIO/ugs-map-viewer/issues/27)) ([ea411fd](https://github.com/UGS-GIO/ugs-map-viewer/commit/ea411fd146365a38e67fef2e4b09616efb16ca9a))
* **hazards:** store and access report aoi in url ([#124](https://github.com/UGS-GIO/ugs-map-viewer/issues/124)) ([5217b23](https://github.com/UGS-GIO/ugs-map-viewer/commit/5217b230858947f8abd71d14714afb3b30fba44c))
* highlight first feature on map click ([#85](https://github.com/UGS-GIO/ugs-map-viewer/issues/85)) ([f002805](https://github.com/UGS-GIO/ugs-map-viewer/commit/f002805060e8208105c2f3ad374de90c1827edd0))
* highlight qfaults on click, swap data to pgfeatureserv source, format popup ([#30](https://github.com/UGS-GIO/ugs-map-viewer/issues/30)) ([946d202](https://github.com/UGS-GIO/ugs-map-viewer/commit/946d20279fa103191b509cd0f4e1036626893daf))
* hooking up data disclaimer button to dialog and drawer ([#64](https://github.com/UGS-GIO/ugs-map-viewer/issues/64)) ([836f5db](https://github.com/UGS-GIO/ugs-map-viewer/commit/836f5dbe5a8ede276cbe1dafc44c21177aa0c5e3))
* implement configuration based approach for using @arcgis/core (ALL-1589) ([#11](https://github.com/UGS-GIO/ugs-map-viewer/issues/11)) ([0afeb96](https://github.com/UGS-GIO/ugs-map-viewer/commit/0afeb964dbdab51cada425bc55948d81840cd8a3))
* improve sidebar toggling behavior ([0f9fae0](https://github.com/UGS-GIO/ugs-map-viewer/commit/0f9fae05f65878b37b5e16a74b7666a3db227ce2))
* improve toolbar and components that it triggers ([3e3a175](https://github.com/UGS-GIO/ugs-map-viewer/commit/3e3a175f581eefcb211703e7eaa5b7404d5665dd))
* info panel refactor ([#39](https://github.com/UGS-GIO/ugs-map-viewer/issues/39)) ([a2d2574](https://github.com/UGS-GIO/ugs-map-viewer/commit/a2d2574e7841174f1763eca88f6e635e706dee6b))
* make a permanent icon sidebar menu with tooltips on desktop ([#52](https://github.com/UGS-GIO/ugs-map-viewer/issues/52)) ([7b24be4](https://github.com/UGS-GIO/ugs-map-viewer/commit/7b24be449f85c15abeb252a6276ff1214c89b33b))
* make legend expandable ([#28](https://github.com/UGS-GIO/ugs-map-viewer/issues/28)) ([f9b380e](https://github.com/UGS-GIO/ugs-map-viewer/commit/f9b380e395002224ed1d219cb1a0d87eb972d8ae))
* make map-container more general with useMapContainer hook, enable layer sorting in popup ([#147](https://github.com/UGS-GIO/ugs-map-viewer/issues/147)) ([7c4a55c](https://github.com/UGS-GIO/ugs-map-viewer/commit/7c4a55c8194094f5783e195db03d96285cf808d6))
* make popup content, pagination, and graphics reset ([#136](https://github.com/UGS-GIO/ugs-map-viewer/issues/136)) ([bb3eb09](https://github.com/UGS-GIO/ugs-map-viewer/commit/bb3eb0945e30bd751c19f5bc9b0087898513b3f5))
* make the dialogtitle sticky to the top of the dialog, add drawer ([#63](https://github.com/UGS-GIO/ugs-map-viewer/issues/63)) ([d9f49f4](https://github.com/UGS-GIO/ugs-map-viewer/commit/d9f49f46f5df50592d2ad30598d6ad2a298078d7))
* map config changes ([e61b6e9](https://github.com/UGS-GIO/ugs-map-viewer/commit/e61b6e9445a509c244e325c5e230c63ca35219b9))
* open context menu on right click and longpress, remove coordinate feature widget, add coordinate bar in new map-footer ([#59](https://github.com/UGS-GIO/ugs-map-viewer/issues/59)) ([9d8f11e](https://github.com/UGS-GIO/ugs-map-viewer/commit/9d8f11e0cd6bc76434fd44989b86795fc3489037))
* rebuild popups into a custom drawer ([#62](https://github.com/UGS-GIO/ugs-map-viewer/issues/62)) ([0110ba5](https://github.com/UGS-GIO/ugs-map-viewer/commit/0110ba564e4574d2b85ba931be45ba57cbd46992))
* redesign layerlist with shadcn components ([#37](https://github.com/UGS-GIO/ugs-map-viewer/issues/37)) ([2d00557](https://github.com/UGS-GIO/ugs-map-viewer/commit/2d0055717ecd11f7cdad7c0c709f6af4284b9091))
* refactoring navbar,  add a basemap toggle expand widget, add coordinates feature widget (ALL-1472) ([#18](https://github.com/UGS-GIO/ugs-map-viewer/issues/18)) ([d4fef6c](https://github.com/UGS-GIO/ugs-map-viewer/commit/d4fef6c8ec0f133b08763089ae2f2411a1d67e70))
* remove default CalciteAction so that the map loads with undefined as the default active (ALL-1509) ([0a78685](https://github.com/UGS-GIO/ugs-map-viewer/commit/0a78685826888959fc98ddb17cbacbfbc43e90aa))
* removing arcgis rest layers, swap for geoserver prod layers ([#65](https://github.com/UGS-GIO/ugs-map-viewer/issues/65)) ([3f365a5](https://github.com/UGS-GIO/ugs-map-viewer/commit/3f365a5f0cf90decfa0e5a80fdf2381ec50503bd))
* reorder map widgets (ALL-2135) ([1b9adc2](https://github.com/UGS-GIO/ugs-map-viewer/commit/1b9adc2e02d6b47ce637959c6e83587bbcb51759))
* report generator preview dialog with basemap only ([#142](https://github.com/UGS-GIO/ugs-map-viewer/issues/142)) ([54f9696](https://github.com/UGS-GIO/ugs-map-viewer/commit/54f96967f948aac3a8d920569966363aa5e5038d))
* set up firebase hosting and live preview channels (ALL-1417) ([f2c5314](https://github.com/UGS-GIO/ugs-map-viewer/commit/f2c531490afa910fb9a3c990c0aa07dd3d56bd47))
* shadcn header and sidebar, remove all calcite, make all popups their own components ([#40](https://github.com/UGS-GIO/ugs-map-viewer/issues/40)) ([d47b750](https://github.com/UGS-GIO/ugs-map-viewer/commit/d47b750b46f26523e96a47061c952491b725ac73))
* tying a color coding map to a field ([#107](https://github.com/UGS-GIO/ugs-map-viewer/issues/107)) ([dd95ff6](https://github.com/UGS-GIO/ugs-map-viewer/commit/dd95ff616777b8a7d5cdf1047af1e634c3d0a914))
* Update main.yml ([bd814b3](https://github.com/UGS-GIO/ugs-map-viewer/commit/bd814b35d2368adccde6d2dc853131b201a70e6f))
* Update Tailwind, investigate calcite-preset.js, add MapConfiguration mockup, custom Link, and update Info component. Fix layout, remove placeholder components. Set up vite and add basic tests for MapConfigurations component. Small fixes for checkboxes, move div to link, fix test, and remove calcite block descriptions. (ALL-1462) ([8e88b96](https://github.com/UGS-GIO/ugs-map-viewer/commit/8e88b9688e23fbec43004b105bb45b3b4bd7b8a8))
* zoom to layer and close menu when on mobile, refactor the useSidebar to lift state up into a sidbar context ([#54](https://github.com/UGS-GIO/ugs-map-viewer/issues/54)) ([a699ddf](https://github.com/UGS-GIO/ugs-map-viewer/commit/a699ddf1b5813229eed3f52c10062a6b2b9abf46))

### Bug Fixes

* account for each info panel accordion separately to prevent interfering states ([c54c284](https://github.com/UGS-GIO/ugs-map-viewer/commit/c54c284520f2e495c42d7cfcd56a912173ee84be))
* account for no dasharray property in the simplelinesybol ([16cfe36](https://github.com/UGS-GIO/ugs-map-viewer/commit/16cfe36a94e0bae72435ead3eb98d3dad0d68413))
* add conditional release logic so we can also deploy develop again (ALL-1535) ([#15](https://github.com/UGS-GIO/ugs-map-viewer/issues/15)) ([09f93de](https://github.com/UGS-GIO/ugs-map-viewer/commit/09f93de33b924dd6770ac2072274e1cd7a3f8256))
* add popupfields and related tables for karstfeatures and erosionhazardzone ([#89](https://github.com/UGS-GIO/ugs-map-viewer/issues/89)) ([e818e36](https://github.com/UGS-GIO/ugs-map-viewer/commit/e818e3685a595757a871e14870985ddbc90922a5))
* casing for hazards related table displayfields ([#162](https://github.com/UGS-GIO/ugs-map-viewer/issues/162)) ([d2cc1cc](https://github.com/UGS-GIO/ugs-map-viewer/commit/d2cc1ccf0af0a0f661c4be55f3d3f7725611a3cf))
* change stroke-width to camelcase to fix warning ([#120](https://github.com/UGS-GIO/ugs-map-viewer/issues/120)) ([90da5b1](https://github.com/UGS-GIO/ugs-map-viewer/commit/90da5b1476d5e5d2d4c6d7c1d95e9f91e9a9fddd))
* close menu when mobile is making report, don't reset currentContent when collapsing header menu ([#116](https://github.com/UGS-GIO/ugs-map-viewer/issues/116)) ([e388841](https://github.com/UGS-GIO/ugs-map-viewer/commit/e388841d5f9f0d6d151fd9e7becc62b99f686bd0))
* don't display any null fields, display correct mapped hazards field, fix related table field label ([#123](https://github.com/UGS-GIO/ugs-map-viewer/issues/123)) ([23e986c](https://github.com/UGS-GIO/ugs-map-viewer/commit/23e986cf2a65f2512fbe44192cb535874e77b49d))
* ensure panel closes after initial open ALL-1509 ([fa04832](https://github.com/UGS-GIO/ugs-map-viewer/commit/fa048320c553fe4eccb5becc5d53c02eebfc1f0b))
* fixing a missing description console warning by including a hidden drawerdescription ([#119](https://github.com/UGS-GIO/ugs-map-viewer/issues/119)) ([6c79d5c](https://github.com/UGS-GIO/ugs-map-viewer/commit/6c79d5c0320db7069d8ae9d011e4097d9da250af))
* **hazards:** clear polygon before drawing another polygon, generate report for custom polygon ([#103](https://github.com/UGS-GIO/ugs-map-viewer/issues/103)) ([9445ba4](https://github.com/UGS-GIO/ugs-map-viewer/commit/9445ba407cd91944fbb71afae2f54f41a15731d0))
* make 24kquads symbology work with stroke ([#90](https://github.com/UGS-GIO/ugs-map-viewer/issues/90)) ([4cc7389](https://github.com/UGS-GIO/ugs-map-viewer/commit/4cc73899c61f88bb8d2227fc4a4c3a08e800d9b5))
* make layer info links open in another tab ([#114](https://github.com/UGS-GIO/ugs-map-viewer/issues/114)) ([87a6bb8](https://github.com/UGS-GIO/ugs-map-viewer/commit/87a6bb8ca67e066c066025fbc7929db83176879e))
* match active basemapList element with the initial basemap on load ([#98](https://github.com/UGS-GIO/ugs-map-viewer/issues/98)) ([0268ff2](https://github.com/UGS-GIO/ugs-map-viewer/commit/0268ff24eba1d924d588aeaba980ec13150d8d39))
* move the favicon where it can be accessed ([#145](https://github.com/UGS-GIO/ugs-map-viewer/issues/145)) ([93438ef](https://github.com/UGS-GIO/ugs-map-viewer/commit/93438ef6cd2c1cbefa25b6c7d7ad2cfeca3a0de2))
* prevent graphics layer from being added to layerlist ([#146](https://github.com/UGS-GIO/ugs-map-viewer/issues/146)) ([7803127](https://github.com/UGS-GIO/ugs-map-viewer/commit/780312781d3f0b304039fece44731f52f649edbc))
* prevent popup when report generator custom area button is active ([#99](https://github.com/UGS-GIO/ugs-map-viewer/issues/99)) ([fb97c55](https://github.com/UGS-GIO/ugs-map-viewer/commit/fb97c55d34169f88829ea5f75e28387ef55a8e05))
* release branch changed in config from main to master ([ab9b22f](https://github.com/UGS-GIO/ugs-map-viewer/commit/ab9b22f0cfee87709c056486984913dfa562d4ce))
* update package-lock ([bc723af](https://github.com/UGS-GIO/ugs-map-viewer/commit/bc723afd48cd2b667ef21be82de64ee283aa76da))
* update page number when changing itemsPerPage, remove all option ([#94](https://github.com/UGS-GIO/ugs-map-viewer/issues/94)) ([3ef2914](https://github.com/UGS-GIO/ugs-map-viewer/commit/3ef29148b19c8745a47f2ce713c1c0f851350194))
