import { useCustomLayerList } from "@/hooks/use-custom-layerlist";
import { BackToMenuButton } from "../ui/back-to-menu-button";
import { useGetLayerConfigs } from "@/hooks/use-get-layer-configs";

function Layers() {
  const { layerConfigs: layersConfig, isLoading } = useGetLayerConfigs('layers');
  const layerList = useCustomLayerList({ config: layersConfig });

  if (isLoading) {
    return <div>Loading layers...</div>;
  }

  return (
    <>
      <BackToMenuButton />
      <div key='layer-list' className='overflow-y-visible max-h-[calc(100vh)]'>
        {layerList}
      </div>
    </>
  )
}

export default Layers
