import { Link } from "@/components/ui/link";
const appTitle = 'Geophysical & Geothermal Data Portal (beta)';

const references = (
    <ul className="list-disc ml-5 space-y-4">
        <li>Auken, E., Christiansen, A.V., Kirkegaard, C., Fiandaca, G., Schamper, C., Behroozmad, A.A., Binley, A., Nielsen, E., Efferso, F., Christensen, N.B., Sorensen, K., Foged, N., and Vignoli, G., 2015, An overview of a highly versatile forward and stable inverse algorithm for airborne, ground-based and borehole electromagnetic and electric data: Exploration Geophysics, v. 46, p. 223–235. </li>
        <li>Blackett, R.E., and Wakefield, S., 2004, Geothermal resources of Utah: Utah Geological Survey Open File Report OFR-431dm, <Link to="https://doi.org/10.34191/OFR-431dm">https://doi.org/10.34191/OFR-431dm</Link>. </li>
        <li>Cagniard, L., 1953, Basic theory of the magneto-telluric method of geophysical prospecting: Geophysics, v. 18, p. 605–635. </li>
        <li>Christiansen A.V., Auken E., Sørensen K., 2006, The transient electromagnetic method, in Kirsch R., editor, Groundwater Geophysics: Springer, Berlin, Heidelberg, <Link to="https://doi.org/10.1007/3-540-29387-6_6">https://doi.org/10.1007/3-540-29387-6_6</Link>. </li>
        <li>Christiansen, A.V., and Auken, E., 2012, A global measure for depth of investigation: Geophysics, v. 77, no. 4, p. WB171– WB177. </li>
        <li>Edwards, M., and Chapman, D.S., 2013, A final report: Geothermal Resource Assessment of the Basin and Range Province in Western Utah, 121 p. </li>
        <li>Gettings, P., D.S. Chapman, and R.G. Allis, 2008, Techniques, analysis, and noise in a Salt Lake Valley 4D gravity experiment: Geophysics, v. 73, p. WA71–WA82. </li>
        <li>Harmonica v0.7.0, 2024, Forward modeling, inversion, and processing gravity and magnetic data, <Link to="https://zenodo.org/records/13308312">https://zenodo.org/records/13308312</Link>. </li>
        <li>Hinze, W.J., Aiken, C., Brozena, J., Coakley, B., Dater, D., Flanagan, G., Forsberg, R., Hildenbrand, T., Keller, G.R., Kellogg, J., Kucks, R., Li, X., Mainville, A., Morin, R., Pilkington, M., Plouff, D., Ravat, D., Roman, D., Urrutia-Fucugauchi, J., Veronneau, M., Webring, M., and Winester, D., 2005, New standards for reducing gravity data—The North American gravity database: Geophysics, v. 70, no. 4, p. J25–J32. </li>
        <li>INGENIOUS - Great Basin Regional Dataset Compilation, 2022, doi:10.15121/1881483. </li>
        <li>Keller, R., Hildenbrand, T.G., Kucks, R., Webring, M., Briesacher, A., Rujawitz, K. Hittleman, A.M., Roman, D., Winester, D., Aldouri, R., Seeley, J., Rasillo, J., Torres, R., Hinze, W., Gates, A., Kreinovich, V., Salayandia, L., 2006, A community effort to construct a gravity database for the United States and an associated Web portal, doi:10.1130/2006.2397(02). </li>
        <li>Palacky, G.J., 1988, Resistivity characteristics of geologic targets–chapter 3, in Nabighian, M.N., editor, Electromagnetic methods in applied geophysics—Volume 1, Theory: Tulsa, Oklahoma, Society of Exploration Geophysicists, Investigations in Geophysics Series, p. 52–129. </li>
        <li>Soler, S.R. and Uieda, L., 2021, Gradient-boosted equivalent sources: Geophysical Journal International, doi:10.1093/gji/ggab297. </li>
        <li>Spies, B., 1989, Depth of investigation in electromagnetic sounding methods: Geophysics, v. 54, no. 7, p. 872–888. </li>
        <li>Tikhonov, A.N., 1950, On determining electrical characteristics of the deep layers of the Earth's crust: Dokl. Akad. Nauk SSSR, v. 73, p. 295–297. </li>
        <li>Uieda, L., Oliveira Jr., V.C., and Barbosa, V.C.F., 2013, Modeling the Earth with Fatiando a Terra: Proceedings of the 12th Python in Science Conference, p. 91–98, doi:10.25080/Majora-8b375195-010l. </li>
        <li>Wannamaker, P.E., Hohmann, G.W., and Ward, S.H., 1984, Magnetotelluric responses of three-dimensional bodies in layered earths: Geophysics, v. 49, no.9, p. 1517–1533, <Link to="https://doi.org/10.1190/1.1441777">https://doi.org/10.1190/1.1441777</Link>. </li>
        <li>Vozo, K., 1991, The magnetotelluric method, in Nabighian, M.N., editor, Electromagnetic methods in applied geophysics: Society of Exploration Geophysics, Tulsa, Oklahoma, v. 2B, p. 641–711. </li>
    </ul>
)

const acknowledgments = (
    <div className="space-y-2">
        <p>
            This web application was created to visualize the existing geophysical data coverage and geothermal potential of the state of Utah as well as make the associated data available for download by industry professionals, local government agencies, policy makers, and the general public. This project included aggregating existing data related to subsurface exploration and evaluating the potential for new geothermal resources. Funding support was provided by Operation Gigawatt granted during the 2025 Utah State Legislative Session.
        </p>
    </div>
)

const dataDisclaimer = (
    <div className="space-y-2">
        <p>
            This product represents a compilation of information from both the Utah Geological Survey and external sources. The Utah Department of Natural Resources, Utah Geological Survey, makes no warranty, expressed or implied, regarding its suitability for a particular use. The Utah Department of Natural Resources, Utah Geological Survey, shall not be liable under any circumstances for any direct, indirect, special, incidental, or consequential damages with respect to claims by users of this product.
        </p>
    </div>
);

const mapDetails = (
    <div className='mx-2 space-y-2'>
        <p>
            This web application is a tool for the public, scientists, and industry professionals interested in geophysical data and geothermal resources in Utah. It provides users with access to spatial data and technical resources to support informed decision making, promote development, and assist in current and future research opportunities.
        </p>
        <p>
            Explore the data by turning on layers and selecting features from the map to view details. To download data, see the Data Sources section or use the multi-select tool to download selected features. For questions or more information about geophysical data and geothermal resources, please contact Christian Hardwick at <Link to="mailto:christianhardwick@utah.gov">christianhardwick@utah.gov</Link>.
        </p>
    </div>
)

const mapDetailsShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        This web application is a tool for the public, scientists, and industry professionals interested in geophysical data and geothermal resources in Utah.
    </p>

)

const dataSources = (
    <div className='mx-2 space-y-2'>
    <p> 
        Data contained in this web application were published in past years and were curated by staff from the Utah Geological Survey (UGS). Sources of this data range from legacy studies to modern data generated by the UGS, student thesis work, private industry donations, state and federal agencies, and other public entities and groups. All data is public domain.
    </p>

<p> 
    <strong><u>Geophysical Data</u></strong>
    <ul className="list-disc ml-5 space-y-4">
        <li>UGS Gravity Stations - Utah Geological Survey</li>
        <li>Legacy Gravity Stations - Utah Geological Survey</li>
        <li>TEM Data - Utah Geological Survey</li>
        <li>MT Data - Utah Geological Survey</li>
        <li>Gravity Anomalies - Utah Geological Survey</li>
    </ul>
</p>     
<p> 
    <strong><u>Geothermal Resources</u></strong>
    <ul className="list-disc ml-5 space-y-4">
        <li>Utah Geothermal Uses - Utah Geological Survey</li>
        <li>Geothermal Wells &amp; Springs - Utah Geological Survey</li>
        <li>Heat-Flow Data - Utah Geological Survey</li>
        <li>Known Geothermal Resource Areas - Utah Geological Survey</li>
        <li>Geothermal Deep Sedimentary Basins - Utah Geological Survey</li>
        <li>Potential Geothermal Resource Areas - Utah Geological Survey</li>
    </ul>
</p>     
<p> 
    <strong><u>Geological Information</u></strong>
    <ul className="list-disc ml-5 space-y-4">
        <li>Hazardous (Quaternary Age) Faults - Utah Geological Survey <br />
            <Link to="https://opendata.gis.utah.gov/datasets/utahDNR::utah-quaternary-faults/Linkbout">Access data</Link>
        </li>
        <li>Great Basin Faults (INGENIOUS Project) - Geothermal Data Repository <br />
            <Link to="https://gdr.openei.org/submissions/1391">Access data</Link>
        </li>
        <li>Utah Faults - Utah Geological Survey <br />
            <Link to="https://geology.utah.gov/publication-details/?pub%3DM-179dm">Access data</Link>
        </li>
        <li>Geological Units (500k) - Utah Geological Survey <br />
            <Link to="https://geology.utah.gov/publication-details/?pub%3DM-179dm">Access data</Link>
        </li>
    </ul>
</p>     
<p> 
    <strong><u>Infrastructure and Land Use</u></strong>
    <ul className="list-disc ml-5 space-y-4">
        <li>Geothermal Power Plants - Utah Geological Survey</li>
        <li>Utah Roads - Local data stewards, UDOT, and UGRC <br />
            <Link to="https://opendata.gis.utah.gov/datasets/utah-roads/Linkbout">Access data</Link>
        </li>
        <li>Utah Railroads - UGRC <br />
            <Link to="https://opendata.gis.utah.gov/datasets/utah-railroads/Linkbout">Access data</Link>
        </li>
        <li>Transmission Lines - UGRC <br />
            <Link to="https://opendata.gis.utah.gov/datasets/utah::utah-transmission-lines/Linkbout">Access data</Link>
        </li>
        <li>Utah Land Ownership - School and Institutional Trust Lands Administration (SITLA), BLM, and Partners <br />
            <Link to="https://opendata.gis.utah.gov/datasets/SITLA::land-ownership/Linkbout">Access data</Link>
        </li>
    </ul>
    </p> 
</div>
)

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Data contained in this web application were published in past years and were curated by staff from the Utah Geological Survey (UGS).
    </p>
)

import type { AppEntry } from '@/routes/-data/portal-config'

const portalMeta: AppEntry = {
    title: 'Geophysical & Geothermal Data Portal',
    description: 'Geophysical data coverage and geothermal resource evaluation across Utah.',
    href: '/geophysics/',
    status: 'beta',
    public: true,
    image: 'https://geology.utah.gov/wp-content/uploads/roosevelt_hot_springs_area_3a.jpg',
    imageCredit: {
        author: 'Mark Milligan',
        article: 'GeoSights: Roosevelt Hot Springs, Beaver County',
        url: 'https://geology.utah.gov/map-pub/survey-notes/geosights/roosevelt_hot_springs/',
    },
}

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle, portalMeta };