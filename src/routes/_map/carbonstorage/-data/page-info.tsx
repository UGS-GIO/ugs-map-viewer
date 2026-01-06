import { Link } from "@/components/ui/link";

const appTitle = 'Carbon Storage Portal (beta)';

const references = (
    <div>
        <ul className="list-disc ml-5 space-y-4">
            <li>
                Carbon Solutions, SCO₂Tᴾᴿᴼ, undated, Unlocking the nation's subsurface to support the energy transition:&nbsp;
                <Link to="https://www.carbonsolutionsllc.com/sco%e2%82%82t%e1%b4%be%e1%b4%bf%e1%b4%bc-unlocking-the-nations-subsurface-to-support-the-energy-transition/">
                    https://www.carbonsolutionsllc.com/sco₂tᴾᴿᴼ-unlocking-the-nations-subsurface-to-support-the-energy-transition/
                </Link>, accessed January 2025.
            </li>
            <li>
                Environmental Protection Agency, 2023 Greenhouse gas emissions from large facilities:&nbsp;
                <Link to="https://ghgdata.epa.gov/ghgp/">
                    https://ghgdata.epa.gov/ghgp/
                </Link>, accessed January 2025.
            </li>
            <li>
                Gall, R., Vanden Berg, M., Mulhern, J., 2023, Geologic characterization and assessment of CO2 sequestration potential for selected SITLA blocks across Utah: Utah Geological Survey, Contract Deliverable to SITLA,&nbsp;
                <Link to="https://ugspub.nr.utah.gov/publications/non_lib_pubs/contract_deliverables/EMP-1.pdf">
                    https://ugspub.nr.utah.gov/publications/non_lib_pubs/contract_deliverables/EMP-1.pdf
                </Link>.
            </li>
            <li>
                Hintze, Lehi F., Willis, Grant C., Laes, D.Y.M., Sprinkel, Douglas A., and Brown, Kent D., 2000, Digital geologic map of Utah: Utah Geological Survey, Map 179DM,&nbsp;
                <Link to="https://doi.org/10.34191/M-179DM">
                    https://doi.org/10.34191/M-179DM
                </Link>.
            </li>
        </ul>
    </div>
)

const acknowledgments = (
    <div className="space-y-2">
        <p>
            This web application was created to visualize the carbon storage potential of the state of Utah and make the associated data available for download by industry professionals, local government agencies, lawmakers, and the public. The project included gathering data related to subsurface exploration and fixing data gaps through new stratigraphic analysis and interpretation of data with partners from the University of Utah. The project also included investigating community perspectives on CCUS in Utah in collaboration with Anthropology and Sociology faculty at the University of Utah. Funding was provided by the U.S. Department of Energy, grant #DE-FE0032367 as part of the 2799 FOA.
        </p>
        <p>
            <Link to="https://geology.utah.gov/">Utah Geological Survey</Link> project team: Dr. Gabriela St. Pierre, Dr. Eugene Szymanski, Michael Vanden Berg, Tara Tankersley
        </p>
        <p>
            University of Utah project team:
        </p>
        <p className="pl-4">
            <Link to="https://egi.utah.edu/">Energy and Geoscience Institute</Link>: Prof. Nathan Moodie and Dr. Eric Edelman;

        </p>
        <p className="pl-4">
            <Link to="https://earth.utah.edu/">Geology and Geophysics</Link>: Dr. Cari Johnson, Dr. Liz Mahon, and Rohanna Bowers (M.S. student);
        </p>
        <p className="pl-4">
            <Link to="https://anthro.utah.edu/">Anthropology and Sociology</Link>: Dr. Kate Magargal, Dr. Lazarus Adua, Sarah Dyer (Ph.D. candidate)
        </p>
        <p>
            Data curation and database formatting: Gabriela St. Pierre, Nathan Payne, Tara Tankersley
        </p>
        <p>
            Application development: Clinton Lunn, Marshall Robinson, Mackenzie Cope
        </p>
    </div>
)

const dataDisclaimer = (
    <div className="space-y-2">
        <p>
            This web application is currently released as a beta version and remains under active development. Although we strive for accuracy and reliability, the data presented may be incomplete, outdated, or incorrect, and features may change, malfunction, or be removed without notice. Users should not rely on this application as the sole source for decision-making or critical operations, and use of the application is at your own risk. We welcome your feedback and encourage you to report any issues or suggestions to <Link to="mailto:gstpierre@utah.gov">gstpierre@utah.gov</Link> to help us improve the application.
        </p>
        <p>
            The Utah Department of Natural Resources, Utah Geological Survey, makes no warranty, expressed or implied, regarding its suitability for a particular use, and does not guarantee accuracy or completeness of the data. The Utah Department of Natural Resources, Utah Geological Survey, shall not be liable under any circumstances for any direct, indirect, special, incidental, or consequential damages with respect to claims by users of this product.
        </p>
    </div>
);

const mapDetails = (
    <div className='mx-2 space-y-2'>
        <p>
            This web application is a tool for the public, scientists, and industry professionals interested in carbon capture, utilization, and storage (CCUS). It provides access to spatial data and technical resources to support site selection, storage resource assessment, and project planning. The visualization is intended to assist in evaluating geologic carbon storage potential options and make informed decisions based on current information.</p>
        <p>
            About CCUS: CCUS involves collecting carbon dioxide (CO₂) from the atmosphere or industrial sources and either using it in commercial processes or storing it underground in geologic reservoir rock. Successful geologic carbon storage requires porous rock reservoirs capped by non-porous seals to trap the CO₂. Utah's unique geology offers many suitable sites for CO₂ storage, often located near major emission sources like power plants and refineries. <Link to="https://geology.utah.gov/energy-minerals/ccus/">Learn More</Link>.
        </p>
    </div>
)

const mapDetailsShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        This web application is a tool for the public, scientists, and industry professionals interested in carbon capture, utilization, and storage (CCUS)...
    </p>
)

const dataSources = (
    <div className='mx-2 space-y-4'>
        <p>
            Data for the Carbon Storage Portal was collected from a variety of authoritative sources including the Utah Geological Survey, Utah Division of Oil, Gas and Mining, Utah State and Institutional Trust Lands Administration, and federal agencies.
        </p>

        <p className="text-lg font-semibold underline">
            Carbon Storage Resources
        </p>

        <div className="space-y-2">
            <p>
                <strong>Storage Resource Estimates</strong> - Carbon Solutions
            </p>
            <span><Link to="https://www.carbonsolutionsllc.com/sco%e2%82%82t%e1%b4%be%e1%b4%bf%e1%b4%bc-unlocking-the-nations-subsurface-to-support-the-energy-transition/">View website</Link></span>

            <p>
                <strong>GeoRegions</strong> - Utah Geological Survey
            </p>
            <span>Report coming soon</span>
            <p>
                <strong>CO₂ Emission Sources</strong> - 2023 EPA Flight Data
            </p>
            <span><Link to="https://ghgdata.epa.gov/ghgp/main.do#/facility/?q=Find%20a%20Facility%20or%20Location&st=&bs=&et=&fid=&sf=11001100&lowE=-20000&highE=23000000&g1=1&g2=1&g3=1&g4=1&g5=1&g6=0&g7=1&g8=1&g9=1&g10=1&g11=1&g12=1&s1=1&s2=1&s3=1&s4=1&s5=1&s6=1&s7=1&s8=1&s9=1&s10=1&s201=1&s202=1&s203=1&s204=1&s301=1&s302=1&s303=1&s304=1&s305=1&s306=1&s307=1&s401=1&s402=1&s403=1&s404=1&s405=1&s601=1&s602=1&s701=1&s702=1&s703=1&s704=1&s705=1&s706=1&s707=1&s708=1&s709=1&s710=1&s711=1&s801=1&s802=1&s803=1&s804=1&s805=1&s806=1&s807=1&s808=1&s809=1&s810=1&s901=1&s902=1&s903=1&s904=1&s905=1&s906=1&s907=1&s908=1&s909=1&s910=1&s911=1&si=&ss=&so=0&ds=E&yr=2023&tr=current&cyr=2023&ol=0&sl=0&rs=ALL">Access data</Link></span>
            <p>
                <strong>SITLA Reports</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://ugspub.nr.utah.gov/publications/non_lib_pubs/contract_deliverables/EMP-1.pdf">View report</Link></span>

            <p>
                <strong>CCUS Study Areas</strong> - Utah Geological Survey
            </p>

            <p>
                <strong>CCS Exclusion Areas</strong> - Utah Geological Survey
            </p>
        </div>

        <p className="text-lg font-semibold underline mt-4">
            Subsurface Data
        </p>

        <div className="space-y-2">
            <p>
                <strong>Wells Database</strong> - Utah Division of Oil, Gas and Mining
            </p>

            <p>
                <strong>Cores and Cuttings</strong> - Utah Geological Survey
            </p>

            <p>
                <strong>Oil and Gas Fields</strong> - Utah Geological Survey
            </p>
        </div>

        <p className="text-lg font-semibold underline mt-4">
            Geological Information
        </p>

        <div className="space-y-2">
            <p>
                <strong>Hazardous (Quaternary age) Faults</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://maps.geology.utah.gov/hazards">Access data</Link></span>

            <p>
                <strong>Utah Faults</strong> - Utah Geological Survey
            </p>
            <span><Link to="https://geology.utah.gov/publication-details/?pub=M-179dm">Access data</Link></span>

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
                <strong>Geothermal Power Plants</strong> - Utah Geological Survey
            </p>

            <p>
                <strong>Pipelines</strong> - UGRC
            </p>

            <p>
                <strong>Utah Roads</strong> - Local data stewards & UDOT & UGRC
            </p>
            <span><Link to="https://opendata.gis.utah.gov/datasets/utah-roads/about">Access data</Link></span>

            <p>
                <strong>Utah Railroads</strong> - UGRC
            </p>
            <span><Link to="https://opendata.gis.utah.gov/datasets/utah-railroads/about">Access data</Link></span>

            <p>
                <strong>Transmission Lines</strong> - UGRC
            </p>
            <span><Link to="https://opendata.gis.utah.gov/datasets/utah::utah-transmission-lines/about">Access data</Link></span>

            <p>
                <strong>Wilderness Study Areas</strong> - U.S. Bureau of Land Management
            </p>
            <span><Link to="https://gbp-blm-egis.hub.arcgis.com/maps/0ae90ebbc1f54f77b80b76a6148ab83d/about">Access data</Link></span>

            <p>
                <strong>Major Rivers</strong> - UGRC
            </p>
            <span><Link to="https://opendata.gis.utah.gov/datasets/utah-major-rivers-polygons/about">Access data</Link></span>

            <p>
                <strong>Utah Land Ownership</strong> - School and Institutional Trust Lands Administration (SITLA) & BLM & Partners
            </p>
            <span><Link to="https://opendata.gis.utah.gov/datasets/SITLA::land-ownership/about">Access data</Link></span>
        </div>
    </div>
)

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Data for the Carbon Storage Portal was collected from a variety of authoritative sources including the Utah Geological Survey, Utah Division of Oil, Gas and Mining, Utah State and Institutional Trust Lands Administration, and federal agencies...
    </p>
)

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle };