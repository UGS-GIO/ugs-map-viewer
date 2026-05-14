import { Link } from "@/components/ui/link";

const appTitle = 'Subsurface';

const references = (
    <div>
        <ul className="list-disc ml-5 space-y-4">
            <li>
                Visit the Utah Geological Survey Core Research launch page for more information.&nbsp;
                <Link to="https://geology.utah.gov/about-us/utah-core-research-center/">
                    https://geology.utah.gov/about-us/utah-core-research-center/
                </Link>
            </li>
        </ul>
    </div>
)

const acknowledgments = (
    <div className="space-y-2">
        <p>
            the Utah Core Research Center (UCRC) works extensively in collaboration with other agencies, industry partners, and academic institutions. 
        </p>
        <p className="pl-4">
            Ammon McDonald, UCRC Curator: <Link to="ammonmcdonald@utah.gov">ammonmcdonald@utah.gov</Link> 
        </p>
        <p className="pl-4">
            Madeline Griem, UCRC Assistant Curator: <Link to="mgriem@utah.gov">mgriem@utah.gov</Link>
        </p>
        <p className="pl-4">
            Michael Vanden Berg, Energy and Minerals Program Manager: <Link to="michaelvandenberg@utah.gov">michaelvandenberg@utah.gov</Link>
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
            Established in 1951, the Utah Geological Survey’s Utah Core Research Center contains the region’s only publicly available and most complete collection of geologic core and cuttings from Utah. The facility presently holds core from over 1500 drill holes, totaling about 400,000 feet of material, and cuttings from nearly 5000 drill holes, representing over 57,000,000 feet of subsurface data. This collection represents about $5 billion worth of investment in Utah’s natural resources. 
        </p>
        <p>
            The UCRC’s collection also includes cataloged outcrop samples (mostly from graduate student projects and state geologic mapping efforts), cuttings from water and geothermal wells, sidewall plugs, and numerous other hand samples. The UCRC inventory can be searched using this map or the entire database can be downloaded as a spreadsheet. If you have any questions regarding the UCRC’s collection or would like to look at any of the samples, please contact the UCRC at 801-537-3359.
        </p>
        <p>
            <strong>Related Information:</strong>
        </p>
        <p>
            <Link to="https://geology.utah.gov/docs/xls/ucrc_cores.xlsx">UCRC Inventory Database</Link> (xlsx)
        </p>
        <p>
            <Link to="https://geology.utah.gov/about-us/utah-core-research-center/">Utah Core Research Center</Link>
        </p>
        <p>
            <Link to="https://oilgas.ogm.utah.gov/oilgasweb/live-data-search/lds-logs/logs-lu.xhtml">Oil & Gas Well Logs </Link> (Division of Oil, Gas and Mining) - View scanned logs of Utah oil and gas wells.
        </p>
        <p>
            <Link to="https://www.waterrights.utah.gov/wellInfo/wellInfo.asp">Water Well Logs</Link> (Utah Division of Water Rights) - These logs contain links to well logs/geologic logs.
        </p>
    </div>
)

const mapDetailsShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Established in 1951, the Utah Geological Survey’s Utah Core Research Center contains the region’s only publicly available and most complete collection of geologic core and cuttings from Utah.
    </p>
)

const dataSources = (
    <div className='mx-2 space-y-4'>
        <p>
            Data for the Subsurface Data Portal was collected from a variety of authoritative sources including the Utah Geological Survey, Utah Division of Oil, Gas and Mining, Utah State and Institutional Trust Lands Administration, and federal agencies.
        </p>


        <p className="text-lg font-semibold underline mt-4">
            Subsurface Data
        </p>

        <div className="space-y-2">
            <p>
                <strong>Wells Database</strong> - Utah Division of Oil, Gas and Mining
            </p>
            <p>
                <strong>Oil & Gas Fields</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://geology.utah.gov/oil-and-gas-fields-map-of-utah/">Access data</Link></span>
            <p>
                <strong>Utah Mining Districts</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://ugspub.nr.utah.gov/publications/open_file_reports/ofr-695.pdf">Access data</Link></span>
            <p>
                <strong>Non-Petroleum Well Data</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://geology.utah.gov/map-pub/maps/interactive-maps/npwd/">Access data</Link></span>

        </div>

        <p className="text-lg font-semibold underline mt-4">
            Geological Information
        </p>

        <div className="space-y-2">
            <p>
                <strong>Geological Units (500k)</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://geology.utah.gov/publication-details/?pub=M-179dm">Access data</Link></span>
        </div>

        <p className="text-lg font-semibold underline mt-4">
            Infrastructure and Land Use
        </p>

        <div className="space-y-2">

            <p>
                <strong>Wilderness Study Areas</strong> - U.S. Bureau of Land Management
            </p>
            <span><Link to="https://gbp-blm-egis.hub.arcgis.com/maps/0ae90ebbc1f54f77b80b76a6148ab83d/about">Access data</Link></span>


            <p>
                <strong>Utah Land Ownership</strong> - School and Institutional Trust Lands Administration (SITLA) & BLM & Partners
            </p>
            <span><Link to="https://opendata.gis.utah.gov/datasets/SITLA::land-ownership/about">Access data</Link></span>
            <p>
                <strong>Utah Oil & Gas Pipeline Data</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://ugspub.nr.utah.gov/publications/public_information/pi-22.pdf">Access data</Link></span>
            <p>
                <strong>Utah County Data</strong> - UGRC
            </p>
            <span><Link to="https://gis.utah.gov/products/sgid/boundaries/county/">Access data</Link></span>
            <p>
                <strong>Utah PLSS Data</strong> - UGRC
            </p>
            <span><Link to="https://gis.utah.gov/products/sgid/cadastre/plss-sections/">Access data</Link></span>

        </div>
    </div>
)

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Data for the subsurface data Portal was collected from a variety of authoritative sources including the Utah Geological Survey, Utah Division of Oil, Gas and Mining, Utah State and Institutional Trust Lands Administration, and federal agencies...
    </p>
)

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle };