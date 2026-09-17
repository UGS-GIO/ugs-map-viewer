import { useCustomLayerList } from "@/hooks/use-custom-layerlist";
import { BackToMenuButton } from "../ui/back-to-menu-button";
import { useGetLayerConfigs } from "@/hooks/use-get-layer-configs";
import { AddLayerDialog } from "./add-layer-dialog";

function Layers({ disableExport = false }: { disableExport?: boolean } = {}) {
  const { layerConfigs: layersConfig, isLoading } = useGetLayerConfigs('layers');
  const layerList = useCustomLayerList({ config: layersConfig, disableExport });

  if (isLoading) {
    return <div>Loading layers...</div>;
  }

  return (
    <>
      <BackToMenuButton />
      <div className="mr-2">
        <AddLayerDialog />
      </div>
      <div key='layer-list' className='overflow-y-visible max-h-[calc(100vh)]' data-tour="layer-panel">
        {layerList}
      </div>
    </>
  )
}

export default Layers
