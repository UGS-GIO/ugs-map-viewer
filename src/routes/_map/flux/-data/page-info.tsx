const appTitle = 'Utah Flux Network';

const references = null;

const acknowledgments = null;

const dataDisclaimer = (
    <div className="space-y-2">
        <p>
            This product represents a compilation of information from both the Utah Geological Survey and external sources. The Utah Department of Natural Resources, Utah Geological Survey, makes no warranty, expressed or implied, regarding its suitability for a particular use. The Utah Department of Natural Resources, Utah Geological Survey, shall not be liable under any circumstances for any direct, indirect, special, incidental, or consequential damages with respect to claims by users of this product.
        </p>
    </div>
)

const mapDetails = (
    <div className='mx-2 space-y-2'>
        <p>
            Eddy covariance flux stations operated by the Utah Geological Survey. Select a station to see its readings.
        </p>
    </div>
)

const mapDetailsShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Eddy covariance flux stations operated by the Utah Geological Survey.
    </p>
)

const dataSources = (
    <div className='mx-2 space-y-2'>
        <p>
            <strong>Utah Flux Network stations</strong>
        </p>
        <p className="pl-4">
            Station locations and details from the Utah Geological Survey station registry. Readings come from the data logger at each station.
        </p>
    </div>
)

const dataSourcesShortened = (
    <p className='text-left text-sm mx-2 font-normal'>
        Station locations and readings from the Utah Flux Network.
    </p>
)

export { references, acknowledgments, dataDisclaimer, mapDetails, mapDetailsShortened, dataSources, dataSourcesShortened, appTitle };
