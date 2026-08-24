import { Link } from "@/components/ui/link";

const appTitle = 'Subsurface';

const references = (
    <div>
        <ul className="list-disc ml-5 space-y-4">
            <li>
                Visit the Utah Geological Survey's Utah Core Research Center website for more information. .&nbsp;
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
            This web application is a digital library representing the geological materials housed at the Utah Core Research Center (UCRC) in Salt Lake City, Utah. Starting in 2025, UCRC curators began a comprehensive inventory and data cleaning project and database restructuring. In addition, the web application was upgraded to support more functionality for users and offer more modern data export options. The inventory of the UCRC is continuously updated as materials are donated, analyses and reports are conducted, and boxes of core are photographed.
        </p>
        <p className="pl-4">
            <b>Inventory Management and Data Curation: </b>Ammon McDonald <Link to="ammonmcdonald@utah.gov">(ammonmcdonald@utah.gov)</Link>,  Madeline Griem, <Link to="mgriem@utah.gov">(mgriem@utah.gov)</Link>
        </p>
        <p className="pl-4">
           <b>Energy & Minerals Program Manager: </b>Michael Vanden Berg <Link to="michaelvandenberg@utah.gov">(michaelvandenberg@utah.gov)</Link>
        </p>
        <p className="pl-4">
            <b>Database Infrastructure and Application Development: </b>Marshall Robinson, Lance Weaver, Clinton Lunn, Nathan Payne 
        </p>
    </div>
)

const dataDisclaimer = (
    <div className="space-y-2">
        <p>
            This product represents a compilation of information from both the Utah Geological Survey and external sources. The Utah Department of Natural Resources, Utah Geological Survey, makes no warranty, expressed or implied, regarding its suitability for a particular use. The Utah Department of Natural Resources, Utah Geological Survey, shall not be liable under any circumstances for any direct, indirect, special, incidental, or consequential damages with respect to claims by users of this product.
        </p>
        <p>
            The data in this web application may contain derogatory and offensive terms associated with geographic place names, specifically related to Utah’s mining history (oil and gas fields, well names, and mining districts). Historically, numerous geographic place names in the United States have been named in a manner that demoralizes and degrades certain groups of people, particularly those belonging to minority communities. In the present day context, this terminology has been widely acknowledged as socially and culturally unacceptable. Occurrences of this language do not align with the mission, vision, and values of the Utah Geological Survey. Striving to acknowledge and address such offensive geographic names in Utah is integral to the Utah Geological Survey’s commitment to disseminate geologic information equitably to the people of Utah and beyond.
        </p>
        <p>
           The information displayed in this web application is continuously updated and corrected as needed. If you notice any errors or inaccurate information, please contact the UCRC. 
        </p>

    </div>
);

const mapDetails = (
    <div className='mx-2 space-y-2'>
        <p>
            Established in 1951, the Utah Geological Survey’s Utah Core Research Center (UCRC) contains the region’s only publicly available and most complete collection of geologic core and cuttings from Utah. The facility presently holds core from over 1500 drill holes, totaling about 500,000 feet of material, and cuttings from nearly 5500 drill holes, representing over 57,000,000 feet of subsurface data. This collection represents about $5 to $10 billion worth of investment in Utah’s natural resources.
        </p>
        <p>
            The UCRC’s collection also includes cataloged outcrop samples (mostly from graduate student projects and state geologic mapping efforts), cuttings from water and geothermal wells, sidewall plugs from drill holes, thin sections, and numerous other hand samples. In addition, the UCRC has a vast archive of analytical data related to the collection, with ongoing efforts to make this information available through this web portal.
        </p>
        <p>
             The UCRC inventory can be searched using this online map. If you have any questions regarding the UCRC’s collection or would like to look at any of the samples, please contact the UCRC at 801-537-3359.  
        </p>
        <p>
            <strong>Related Information:</strong>
        </p>
        <p>
            <Link to="https://geology.utah.gov/about-us/utah-core-research-center/">Utah Core Research Center</Link>
        </p>
        <p>
            <Link to="https://oilgas.ogm.utah.gov/oilgasweb/live-data-search/lds-logs/logs-lu.xhtml">Oil & Gas Well Logs </Link> (Utah Division of Oil, Gas and Mining) - View scanned/digital geophysical logs from Utah oil and gas wells.
        </p>
        <p>
            <Link to="https://www.waterrights.utah.gov/wellInfo/wellInfo.asp">Water Well Logs</Link> (Utah Division of Water Rights) - View geologic logs from Utah water wells.
        </p>
    </div>
)

const mapDetailsShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Established in 1951, the Utah Geological Survey’s Utah Core Research Center contains the region’s only publicly available and most complete collection of geologic core and cuttings from Utah.
    </p>
)

// Per-dataset sourcing (agency + external links) now lives on each layer config
// and renders inline in the Download Datasets list (DatasetDownloads) — nothing
// left to duplicate here.
const dataSources = <></>;

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Data for the UCRC Collections Portal were compiled from a variety of authoritative sources including the Utah Geological Survey; the Utah Division of Oil, Gas and Mining; the Utah State and Institutional Trust Lands Administration; and federal agencies.
    </p>
)

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle };