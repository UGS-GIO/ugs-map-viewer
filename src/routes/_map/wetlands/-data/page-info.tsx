import { Link } from "@/components/ui/link";

const appTitle = 'Utah Wetlands';

const references = (
    <ul className="list-disc ml-5 space-y-4">
        <li>
            AmphibiaWeb, 2018, AmphibiaWeb: Berkeley, California, University of California, online, <Link to="https://amphibiaweb.org/">https://amphibiaweb.org/</Link>, accessed January 2018.
        </li>
        <li>
            Green, D.M., Weir, L.A., Casper, G.S., and Lannoo, M., 2014, North American amphibians− distribution and diversity: Berkeley, University of California Press, 600 p.
        </li>
        <li>
            IUCN, 2017, The IUCN Red List of Threatened Species−version 2017-3: online,<Link to="http://www.iucnredlist.org"> http://www.iucnredlist.org</Link>, accessed March 2018.
        </li>
        <li>
            Menuz, 2015, Landscape integrity model for Utah’s wetlands: Salt Lake City, Utah Geological Survey, 50 p., available <Link to="https://geodata.geology.utah.gov/pages/search.php?search=!list15236&amp;order_by=date&amp;sort=DESC&amp;offset=0&amp;archive=0&amp;sort=DESC&amp;k=">online</Link>.
        </li>
        <li>
            Utah Conservation Data Center, 2017, Utah’s state listed species by county: Online, <Link to="https://dwrcdc.nr.utah.gov/ucdc/ViewReports/sslist.htm">https://dwrcdc.nr.utah.gov/ucdc/ViewReports/sslist.htm</Link>, accessed March 2018.
        </li>
        <li>
            U.S. Fish and Wildlife Service (2009), A system for mapping riparian areas in the western United States: Arlington, 43 p.
        </li>
        <li>
            U.S. Geological Survey, 2014, National amphibian atlas−version number 3.0: Laurel, Maryland, Patuxent Wildlife Research Center: Online, <Link to="http://www.pwrc.usgs.gov/naa">www.pwrc.usgs.gov/naa</Link>, accessed March 2018.
        </li>
    </ul>
)

const acknowledgments = (
    <div className="space-y-2">
        <p>
            Lorem ipsum, dolor sit amet consectetur adipisicing elit. Eius ipsa ipsam adipisci? Amet reprehenderit veritatis sint voluptate repellendus temporibus dolorem debitis placeat earum necessitatibus, quisquam illum facilis assumenda enim quia?
        </p>
        <p>
            Lorem ipsum, dolor sit amet consectetur adipisicing elit. Eius ipsa ipsam adipisci? Amet reprehenderit veritatis sint voluptate repellendus temporibus dolorem debitis placeat earum necessitatibus, quisquam illum facilis assumenda enim quia?
        </p>
    </div>
)

const dataDisclaimer = (
    <div className="space-y-2">
        <p>
            This product represents a compilation of information from both the Utah Geological Survey and external sources. The Utah Department of Natural Resources, Utah Geological Survey, makes no warranty, expressed or implied, regarding its suitability for a particular use. The Utah Department of Natural Resources, Utah Geological Survey, shall not be liable under any circumstances for any direct, indirect, special, incidental, or consequential damages with respect to claims by users of this product.
        </p>
        <p>
            Wetlands spatial data were produced from a combination of aerial imagery examination and on-the-ground assessment and are not meant to be used as the basis for a jurisdictional wetland delineation. Wetlands across much of the state were mapped in the 1980s at a coarse resolution; some wetlands may have been inadvertently omitted and other wetlands may no longer exist or may not be considered jurisdictional. Please contact your local U.S. Army Corps of Engineers office if you are unsure of the status of a wetland on your property.
        </p>
        <p>
            County-level data on species’ ranges were compiled from the Utah Conservation Data Center (2017) and the National Amphibian Atlas (U.S. Geological Survey, 2014); however, species may be found outside of the listed counties, elevation ranges, and habitat types.
        </p>
    </div>
);

const mapDetails = (
    <div className='mx-2 space-y-2'>
        <p>
            The Utah Geological Survey (UGS) conducts wetland mapping and wetland field assessment projects across Utah. All UGS mapping projects follow the National Wetland Inventory (NWI) standards developed by the U.S. Fish and Wildlife Service, and recent projects also include riparian mapping. Mapping is conducted primarily by reviewing aerial imagery and cannot be used as the basis for a jurisdictional wetland delineation. This map contains data from NWI that is up-to-date as of November 12, 2024. Wetland field assessment data and links to reports can be found under the Wetland Field Studies section of the application. Landscape Data show patterns of wetland abundance, ownership, and condition at multiple spatial scales. See Database Contents for more information about the data in this map.
        </p>
        <p><strong>Contact</strong></p>
        <ul>
            <li>
                <Link to="mailto:pgoodwin@utah.gov">Peter Goodwin </Link>- 801.537.3130
            </li>
        </ul>
        <p><strong>Links to Related Information</strong></p>
        <ul className="list-disc ml-5 space-y-4">
            <li>
                <Link to="https://geology.utah.gov/water/wetlands/">UGS Wetland Webpages</Link> for information on wetlands and UGS wetland research
            </li>
            <li>
                <Link to="https://www.fws.gov/wetlands/Data/Data-Download.html">National Wetlands Inventory</Link> for downloads of the original NWI data
            </li>
            <li>
                <Link to="http://www.spk.usace.army.mil/Missions/Regulatory/Contacts/Contact-Your-Local-Office/">U.S. Army Corps of Engineers District Offices</Link> for information about wetland regulations and jurisdictional wetland delineations
            </li>
            <li>
                <Link to="https://www.spk.usace.army.mil/Missions/Regulatory/Contacts/Wetland-Consultants/">U.S. Army Corps Wetland Consultants List</Link> for a list of consultants that can conduct wetland delineations
            </li>
        </ul>
    </div>
)

const mapDetailsShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        The Utah Geological Survey (UGS) conducts wetland mapping and wetland field assessment projects across Utah. All UGS mapping projects follow the National Wetland Inventory (NWI) standards developed by the U.S. Fish and Wildlife Service, and recent projects also include riparian mapping.
    </p>

)

const dataSources = (
    <div className='mx-2 space-y-2'>
        <p>
            <strong>WETLAND AND RIPARIAN MAPPING</strong>
        </p>
        <p>
            <strong>Wetland and riparian polygons, wetland outlines, and riverine features</strong>
        </p>
        <p>
            <i>Wetlands and riparian spatial data were produced from a combination of aerial imagery examination and on-the-ground assessment and are not meant to be used as the basis for a jurisdictional wetland delineation. </i>Data are derived from the U.S. Fish and Wildlife Service’s <Link to="https://www.fws.gov/wetlands/">National Wetlands Inventory</Link> (NWI) and are typically updated twice per year. NWI attributes wetlands with codes from the Cowardin Classification System. Polygons mapped as riverine are in a separate layer from other wetland features because of the large size of the data. Riverine features depict predominantly unvegetated habitat contained within a natural or artificial channel. Riparian data depict non-wetland areas along streams, rivers, and lakes that have distinct or distinctly more vigorous vegetation compared to adjacent areas. Mapping follows standards laid out in U.S. Fish and Wildlife Service (2009). Riparian features were mapped in conjuction with wetland features to produce a seamless dataset in the project areas where they were mapped.
        </p>
        <p>
            <strong>Mapping metadata</strong>
        </p>
        <p>
            Metadata are a description of wetland and riparian mapping projects, including the scale at which mapping was conducted and the imagery year used for the mapping. Some mapping projects include supplemental map information that describes the projects in more detail. The riparian metadata also depicts the project boundaries where riparian mapping has occurred. Other wetland mapping projects do not include riparian data.
        </p>
        <p>
            <strong>Additional Attributes and LLWW Data</strong>
        </p>
        <p>
            Wetland mapping was additionally described with Landscape Position, Landform, Water Flow path, and Waterbody Type (LLWW) attributes to provide detail about a wetland’s geomorphic setting, shape and form, and connectivity to stream networks as well as to characterize a greater variety of human impacts, water sources, and unique wetland types through LLWW-specific modifiers. When combined with NWI mapping, LLWW attributes allow for unique visualizations such as the reclassification of wetland mapping according to the Hydrogeomorphic (HGM) system depicted in this app. LLWW attributes can similarly be used to estimate some likely functions (such as nutrient retention or flood control) provided by wetlands and show the distribution of those functions across the landscape. More information about the LLWW classification system, and specific functions and how they are modeled, can be found in the <Link to="https://ugspub.nr.utah.gov/publications/open_file_reports/ofr-744.pdf">Cache Valley Supplemental Mapping Report.</Link> The complete LLWW dataset and results of individual function models are available to <Link to="https://firebasestorage.googleapis.com/v0/b/ut-dnr-wetlands-prod.appspot.com/o/LLWW_datasets.zip?alt=media&amp;token=3e2fbafb-522e-4fe3-8a46-c8692ddf2234">download.</Link>
        </p>
        <p>
            <strong>HYDRIC SOIL CLASSES</strong>
        </p>
        <p>
            The hydric soil classes data were produced by the Natural Resources Consevation Service and depict soils that are saturated for periods of time long enough to create wetland conditions. This data layer is maintained by <Link to="https://www.arcgis.com/home/item.html?id=2be45af986af4624839cedae883faf47">ESRI.</Link>
        </p>
        <p>
            <strong>LANDSCAPE DATA</strong>
        </p>
        <p>
            The landscape dataset summarizes information relevant to Utah’s wetlands at five spatial scales. These data allow us to understand where and what kinds of wetlands are in Utah, who owns those wetlands, how ownership patterns differ from overall land ownership patterns, and locations that have potentially restorable wetlands. These data also summarize trends in groundwater and surface water resources across the state. The data and a more detailed description of how they were developed are available via <Link to="https://firebasestorage.googleapis.com/v0/b/ut-dnr-wetlands-prod.appspot.com/o/Wetlands_Landscape_StudyResults.zip?alt=media&amp;token=fa7d4ff1-ebd3-40b2-b18e-e5bf609f8099">download</Link>.
        </p>

        <p>
            <strong>WETLAND CONDITION</strong>
        </p>
        <p>
            <strong>Wetland assessment projects</strong>
        </p>
        <p>
            The UGS has conducted field studies to evaluate the condition and potential function of Utah’s wetlands using the Utah Rapid Assessment Procedure. These projects provide baseline information on the types of wetlands, abundance and severity of common stressors, and rare and common wetland plants in each project area. The wetland assessments project layer shows the boundaries where assessment projects have taken place, years when field data were collected, a link to the associated reports when available, and information about project study design.
        </p>
        <p>
            <strong>Wetland assessment results</strong>
        </p>
        <p>
            The wetland assessment results dataset summarizes major findings from UGS wetland surveys. Results are organized by strata, which were based on ecoregions or watersheds, depending on the project. Only results from projects where sites were selected and surveyed using a random design are included in this dataset. The data and a more detailed methodology are available via <Link to="https://firebasestorage.googleapis.com/v0/b/ut-dnr-wetlands-prod.appspot.com/o/Wetlands_Landscape_StudyResults.zip?alt=media&amp;token=fa7d4ff1-ebd3-40b2-b18e-e5bf609f8099">download</Link>.
        </p>
        <p>
            <strong>Wetland stressors</strong>
        </p>
        <p>
            UGS created a landscape stress model for the state of Utah, focused on stressors likely to impact wetlands, including agriculture, development, hydrologic manipulations, and linear disturbances such as roads and pipelines. See <Link to="https://geodata.geology.utah.gov/pages/download.php?direct=1&amp;noattach=true&amp;ref=43843&amp;ext=pdf&amp;k=">Menuz (2015)</Link> for more information on the development of the landscape stress model.
        </p>

        <p>
            <strong>WETLAND-DEPENDENT SPECIES</strong>
        </p>
        <p>
            <strong>Sensitive amphibian ranges and habitat</strong>
        </p>
        <p>
            County-level data on species’ ranges were compiled from the Utah Conservation Data Center (2017) and the National Amphibian Atlas (U.S. Geological Survey, 2014). Final presence/absence designations for each county where the two sources disagreed were based on a combination of literature review and best professional judgment. Elevation range and habitat descriptions were developed through consultation with three primary sources (Green and others, 2014; IUCN, 2017; AmphibiaWeb, 2018) and additional literature review.
        </p>
        <p>
            <strong>LAND OWNERSHIP</strong>
        </p>
        <p>
            Land ownership data are maintained by the Bureau of Land Management and the State of Utah School and Institutional Trust Lands Administration and are described in more detail <Link to="https://gis.utah.gov/data/cadastre/land-ownership/">here.</Link>
        </p>
    </div>
)

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Data sources for this application include wetland and riparian mapping, hydric soils, landscape data, wetland assessments, stressors, species ranges, and land ownership, compiled from state and federal agencies, field studies, and geospatial analyses.
    </p>
)

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle };