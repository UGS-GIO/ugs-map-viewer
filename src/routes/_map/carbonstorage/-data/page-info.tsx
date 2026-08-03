import { Link } from "@/components/ui/link";

const appTitle = 'Carbon Storage Portal';

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
            This web application remains under active development. Although we strive for accuracy and reliability, the data presented may be incomplete, outdated, or incorrect, and features may change, malfunction, or be removed without notice. Users should not rely on this application as the sole source for decision-making or critical operations, and use of the application is at your own risk. We welcome your feedback and encourage you to report any issues or suggestions to <Link to="mailto:gstpierre@utah.gov">gstpierre@utah.gov</Link> to help us improve the application.
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

// Per-dataset sourcing (agency + external links) now lives on each layer config
// and renders inline in the Download Datasets list (DatasetDownloads) — nothing
// left to duplicate here.
const dataSources = <></>;

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Data for the Carbon Storage Portal was collected from a variety of authoritative sources including the Utah Geological Survey, Utah Division of Oil, Gas and Mining, Utah State and Institutional Trust Lands Administration, and federal agencies...
    </p>
)

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle };