import { Link } from "@/components/custom/link";

const appTitle = 'Wetland Plants Application';

const references = (
    <ul className="list-disc ml-5 space-y-4">

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
            The Wetland Plant Application is a tool that allows users to query, view, and download plant community composition data from Utah's wetlands. Some potential uses of the data include evaluating threats posed by noxious weed species, developing watershed-based species lists to ensure that regionally appropriate species are used in restoration activities, and identifying reference sites to use when setting mitigation standards. Data can also be used to support research on Utah's wetlands to better understand these systems.
        </p>
        <p>
            Each site is linked to a list of plant species observed at the site and their associated percent cover, using scientific and common names from <Link to="https://plants.sc.egov.usda.gov/">USDA Plants </Link>. Plant data were collected by multiple organizations using a variety of methods. Wetlands for the sake of this application include any system considered to be wetland by the contributing organizations and include features such as aquatic beds and unvegetated mudflats and playas that may not meet regulatory definitions of wetlands. Some private landowners requested that the exact site location for sites on their property remain confidential. Therefore, the location of these sites is randomly assigned within the vicinity of the actual site. Data from these sites still show up in the query results. Though only data from reputable sources were included in this application, we make no guarantees about the accuracy of plant identification.
        </p>
        <p>
            Data can be queried in four main ways. First, you can click on individual sites to see site attributes and associated plant species. Second, you can query by species to see a list of sites where a particular species was found. Third, you can query by site attributes to either obtain a list of sites having those attributes or a summary list of all species found at sites having those attributes. Data can be queried by major ecoregion, wetland class, watershed, and condition class. For example, you could obtain a list of all playa wetlands in the Jordan watershed that were considered reference condition or you could obtain a list of all species known from wet meadows in montane valleys. Last, you can use the Select features by polygon tool (upper left under the compass) to generate a list of sites that fall within a polygon you draw on the map.
        </p>
        <p>
            Click on the three horizontal bars on the upper left to start exploring Utah's wetlands.
        </p>
        <p>
            Please contact <Link to="mailto:beckad@utah.gov">Becka Downard </Link> (801-537-3319) with questions or if you are interested in contributing data.
        </p>
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
            lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </p>
    </div>
)

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
    </p>
)

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle };