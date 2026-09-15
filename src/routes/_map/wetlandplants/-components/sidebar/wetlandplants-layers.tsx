import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useCustomLayerList } from '@/hooks/use-custom-layerlist';
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs';
import { renderWetlandPlantsLayerFilters } from './wetlandplants-layer-filters';

function WetlandPlantsLayers({ disableExport = false }: { disableExport?: boolean } = {}) {
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers');
    const layerList = useCustomLayerList({
        config: layerConfigs,
        disableExport,
        layerExtrasRender: renderWetlandPlantsLayerFilters,
    });

    if (isLoading) {
        return <div>Loading layers...</div>;
    }

    return (
        <>
            <BackToMenuButton />
            <div key='layer-list' className='overflow-y-visible max-h-[calc(100vh)]' data-tour="layer-panel">
                {layerList}
            </div>
        </>
    );
}

export default WetlandPlantsLayers;
