import { Link } from "@/components/ui/link";
import { ENERGY_MINERALS_WORKSPACE, MAPPING_WORKSPACE, PROD_GEOSERVER_URL, PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import { GeoJsonProperties } from "geojson";
import { addThousandsSeparator } from "@/lib/utils";


export const wellWithTopsLayerName = 'wellswithtops_hascore';
export const wellWithTopsWMSTitle = 'Wells Database';
const wellWithTopsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: wellWithTopsWMSTitle,
    visible: true,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${wellWithTopsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'API': { field: 'api', type: 'string' },
                'Well Name': { field: 'wellname', type: 'string' },
                'Disclaimer': {
                    field: 'Formation Tops Disclaimer',
                    type: 'custom',
                    transform: () => 'Formation top information and LAS file availability is provided as-is and may not be fully complete or accurate.'
                }
            },
            relatedTables: [
                {
                    fieldLabel: 'Formation Tops',
                    matchingField: 'api',
                    targetField: 'api',
                    url: PROD_POSTGREST_URL + '/view_wellswithtops_hascore',
                    headers: {
                        "Accept-Profile": 'emp',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'formation_alias', label: 'Formation Name' },
                        { field: 'formation_depth', label: 'Formation Depth (ft)', format: 'number' },
                    ],
                    sortBy: 'formation_depth',
                    sortDirection: 'asc',
                    displayAs: 'table'
                },
                {
                    fieldLabel: 'Core Photos',
                    matchingField: 'api',
                    targetField: 'api',
                    url: '',
                    headers: {},
                    displayAs: 'gallery',
                    galleryUrlField: 'medium_url',
                    galleryThumbnailField: 'thumb_url',
                    galleryLabelField: 'label',
                    galleryMetadataFields: [
                        { field: 'photo_type_name', label: 'Type' },
                        { field: 'top_depth', label: 'Top Depth (ft)' },
                        { field: 'bottom_depth', label: 'Bottom Depth (ft)' },
                        { field: 'date_taken', label: 'Date Taken' },
                        { field: 'notes', label: 'Notes' },
                    ],
                    mockData: [
                        { api: 'mock', filename: 'core_box_001.jpg', medium_url: 'https://picsum.photos/seed/cb001/800/600', thumb_url: 'https://picsum.photos/seed/cb001/200/150', top_depth: 100.0, bottom_depth: 105.0, date_taken: '2021-08-14', photo_type_name: 'Core Box', notes: 'Transition from sandstone to shale.', label: '100.0 – 105.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_002.jpg', medium_url: 'https://picsum.photos/seed/cb002/800/600', thumb_url: 'https://picsum.photos/seed/cb002/200/150', top_depth: 105.0, bottom_depth: 110.0, date_taken: '2021-08-14', photo_type_name: 'Core Box', notes: null, label: '105.0 – 110.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_003.jpg', medium_url: 'https://picsum.photos/seed/cb003/800/600', thumb_url: 'https://picsum.photos/seed/cb003/200/150', top_depth: 110.0, bottom_depth: 115.0, date_taken: '2021-08-14', photo_type_name: 'Core Box', notes: null, label: '110.0 – 115.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_004.jpg', medium_url: 'https://picsum.photos/seed/cb004/800/600', thumb_url: 'https://picsum.photos/seed/cb004/200/150', top_depth: 115.0, bottom_depth: 120.0, date_taken: '2021-08-14', photo_type_name: 'Core Box', notes: 'Visible vugs throughout interval.', label: '115.0 – 120.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_005.jpg', medium_url: 'https://picsum.photos/seed/cb005/800/600', thumb_url: 'https://picsum.photos/seed/cb005/200/150', top_depth: 120.0, bottom_depth: 125.0, date_taken: '2021-08-14', photo_type_name: 'Core Box', notes: null, label: '120.0 – 125.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_006.jpg', medium_url: 'https://picsum.photos/seed/cb006/800/600', thumb_url: 'https://picsum.photos/seed/cb006/200/150', top_depth: 125.0, bottom_depth: 130.0, date_taken: '2021-08-15', photo_type_name: 'Core Box', notes: null, label: '125.0 – 130.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_007.jpg', medium_url: 'https://picsum.photos/seed/cb007/800/600', thumb_url: 'https://picsum.photos/seed/cb007/200/150', top_depth: 130.0, bottom_depth: 135.0, date_taken: '2021-08-15', photo_type_name: 'Core Box', notes: 'Minor calcite cement visible.', label: '130.0 – 135.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_008.jpg', medium_url: 'https://picsum.photos/seed/cb008/800/600', thumb_url: 'https://picsum.photos/seed/cb008/200/150', top_depth: 135.0, bottom_depth: 140.0, date_taken: '2021-08-15', photo_type_name: 'Core Box', notes: null, label: '135.0 – 140.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_009.jpg', medium_url: 'https://picsum.photos/seed/cb009/800/600', thumb_url: 'https://picsum.photos/seed/cb009/200/150', top_depth: 140.0, bottom_depth: 145.0, date_taken: '2021-08-15', photo_type_name: 'Core Box', notes: null, label: '140.0 – 145.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_010.jpg', medium_url: 'https://picsum.photos/seed/cb010/800/600', thumb_url: 'https://picsum.photos/seed/cb010/200/150', top_depth: 145.0, bottom_depth: 150.0, date_taken: '2021-08-15', photo_type_name: 'Core Box', notes: 'Core recovery ~85%.', label: '145.0 – 150.0 ft · Core Box' },
                        { api: 'mock', filename: 'formation_detail_001.jpg', medium_url: 'https://picsum.photos/seed/fd001/800/600', thumb_url: 'https://picsum.photos/seed/fd001/200/150', top_depth: 112.5, bottom_depth: 113.0, date_taken: '2021-08-14', photo_type_name: 'Formation Detail', notes: 'Close-up of fracture zone.', label: '112.5 – 113.0 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_002.jpg', medium_url: 'https://picsum.photos/seed/fd002/800/600', thumb_url: 'https://picsum.photos/seed/fd002/200/150', top_depth: 127.3, bottom_depth: 127.8, date_taken: '2021-08-15', photo_type_name: 'Formation Detail', notes: 'Stylolite with clay residue.', label: '127.3 – 127.8 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_003.jpg', medium_url: 'https://picsum.photos/seed/fd003/800/600', thumb_url: 'https://picsum.photos/seed/fd003/200/150', top_depth: 138.0, bottom_depth: 138.5, date_taken: '2021-08-15', photo_type_name: 'Formation Detail', notes: 'Open fracture, partially mineralized.', label: '138.0 – 138.5 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_004.jpg', medium_url: 'https://picsum.photos/seed/fd004/800/600', thumb_url: 'https://picsum.photos/seed/fd004/200/150', top_depth: 143.2, bottom_depth: 143.6, date_taken: '2021-08-15', photo_type_name: 'Formation Detail', notes: null, label: '143.2 – 143.6 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_005.jpg', medium_url: 'https://picsum.photos/seed/fd005/800/600', thumb_url: 'https://picsum.photos/seed/fd005/200/150', top_depth: 148.9, bottom_depth: 149.2, date_taken: '2021-08-16', photo_type_name: 'Formation Detail', notes: 'Bioturbation evident.', label: '148.9 – 149.2 ft · Formation Detail' },
                        { api: 'mock', filename: 'core_box_011.jpg', medium_url: 'https://picsum.photos/seed/cb011/800/600', thumb_url: 'https://picsum.photos/seed/cb011/200/150', top_depth: 150.0, bottom_depth: 155.0, date_taken: '2021-08-16', photo_type_name: 'Core Box', notes: null, label: '150.0 – 155.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_012.jpg', medium_url: 'https://picsum.photos/seed/cb012/800/600', thumb_url: 'https://picsum.photos/seed/cb012/200/150', top_depth: 155.0, bottom_depth: 160.0, date_taken: '2021-08-16', photo_type_name: 'Core Box', notes: 'Significant color change — reddish hue.', label: '155.0 – 160.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_013.jpg', medium_url: 'https://picsum.photos/seed/cb013/800/600', thumb_url: 'https://picsum.photos/seed/cb013/200/150', top_depth: 160.0, bottom_depth: 165.0, date_taken: '2021-08-16', photo_type_name: 'Core Box', notes: null, label: '160.0 – 165.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_014.jpg', medium_url: 'https://picsum.photos/seed/cb014/800/600', thumb_url: 'https://picsum.photos/seed/cb014/200/150', top_depth: 165.0, bottom_depth: 170.0, date_taken: '2021-08-16', photo_type_name: 'Core Box', notes: null, label: '165.0 – 170.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_015.jpg', medium_url: 'https://picsum.photos/seed/cb015/800/600', thumb_url: 'https://picsum.photos/seed/cb015/200/150', top_depth: 170.0, bottom_depth: 175.0, date_taken: '2021-08-16', photo_type_name: 'Core Box', notes: 'Coarser grain size, moderate sorting.', label: '170.0 – 175.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_016.jpg', medium_url: 'https://picsum.photos/seed/cb016/800/600', thumb_url: 'https://picsum.photos/seed/cb016/200/150', top_depth: 175.0, bottom_depth: 180.0, date_taken: '2021-08-17', photo_type_name: 'Core Box', notes: null, label: '175.0 – 180.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_017.jpg', medium_url: 'https://picsum.photos/seed/cb017/800/600', thumb_url: 'https://picsum.photos/seed/cb017/200/150', top_depth: 180.0, bottom_depth: 185.0, date_taken: '2021-08-17', photo_type_name: 'Core Box', notes: null, label: '180.0 – 185.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_018.jpg', medium_url: 'https://picsum.photos/seed/cb018/800/600', thumb_url: 'https://picsum.photos/seed/cb018/200/150', top_depth: 185.0, bottom_depth: 190.0, date_taken: '2021-08-17', photo_type_name: 'Core Box', notes: 'Thin laminae of dark shale.', label: '185.0 – 190.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_019.jpg', medium_url: 'https://picsum.photos/seed/cb019/800/600', thumb_url: 'https://picsum.photos/seed/cb019/200/150', top_depth: 190.0, bottom_depth: 195.0, date_taken: '2021-08-17', photo_type_name: 'Core Box', notes: null, label: '190.0 – 195.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_020.jpg', medium_url: 'https://picsum.photos/seed/cb020/800/600', thumb_url: 'https://picsum.photos/seed/cb020/200/150', top_depth: 195.0, bottom_depth: 200.0, date_taken: '2021-08-17', photo_type_name: 'Core Box', notes: 'Core recovery ~90%. No lost intervals.', label: '195.0 – 200.0 ft · Core Box' },
                        { api: 'mock', filename: 'formation_detail_006.jpg', medium_url: 'https://picsum.photos/seed/fd006/800/600', thumb_url: 'https://picsum.photos/seed/fd006/200/150', top_depth: 162.4, bottom_depth: 162.9, date_taken: '2021-08-16', photo_type_name: 'Formation Detail', notes: 'Cross-bedding visible.', label: '162.4 – 162.9 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_007.jpg', medium_url: 'https://picsum.photos/seed/fd007/800/600', thumb_url: 'https://picsum.photos/seed/fd007/200/150', top_depth: 177.1, bottom_depth: 177.5, date_taken: '2021-08-17', photo_type_name: 'Formation Detail', notes: null, label: '177.1 – 177.5 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_008.jpg', medium_url: 'https://picsum.photos/seed/fd008/800/600', thumb_url: 'https://picsum.photos/seed/fd008/200/150', top_depth: 193.6, bottom_depth: 194.0, date_taken: '2021-08-17', photo_type_name: 'Formation Detail', notes: 'Mud clast conglomerate.', label: '193.6 – 194.0 ft · Formation Detail' },
                        { api: 'mock', filename: 'core_box_021.jpg', medium_url: 'https://picsum.photos/seed/cb021/800/600', thumb_url: 'https://picsum.photos/seed/cb021/200/150', top_depth: 200.0, bottom_depth: 205.0, date_taken: '2021-08-18', photo_type_name: 'Core Box', notes: null, label: '200.0 – 205.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_022.jpg', medium_url: 'https://picsum.photos/seed/cb022/800/600', thumb_url: 'https://picsum.photos/seed/cb022/200/150', top_depth: 205.0, bottom_depth: 210.0, date_taken: '2021-08-18', photo_type_name: 'Core Box', notes: 'Abundant plant fragments.', label: '205.0 – 210.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_023.jpg', medium_url: 'https://picsum.photos/seed/cb023/800/600', thumb_url: 'https://picsum.photos/seed/cb023/200/150', top_depth: 210.0, bottom_depth: 215.0, date_taken: '2021-08-18', photo_type_name: 'Core Box', notes: null, label: '210.0 – 215.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_024.jpg', medium_url: 'https://picsum.photos/seed/cb024/800/600', thumb_url: 'https://picsum.photos/seed/cb024/200/150', top_depth: 215.0, bottom_depth: 220.0, date_taken: '2021-08-18', photo_type_name: 'Core Box', notes: null, label: '215.0 – 220.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_025.jpg', medium_url: 'https://picsum.photos/seed/cb025/800/600', thumb_url: 'https://picsum.photos/seed/cb025/200/150', top_depth: 220.0, bottom_depth: 225.0, date_taken: '2021-08-18', photo_type_name: 'Core Box', notes: 'Fining upward sequence.', label: '220.0 – 225.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_026.jpg', medium_url: 'https://picsum.photos/seed/cb026/800/600', thumb_url: 'https://picsum.photos/seed/cb026/200/150', top_depth: 225.0, bottom_depth: 230.0, date_taken: '2021-08-18', photo_type_name: 'Core Box', notes: null, label: '225.0 – 230.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_027.jpg', medium_url: 'https://picsum.photos/seed/cb027/800/600', thumb_url: 'https://picsum.photos/seed/cb027/200/150', top_depth: 230.0, bottom_depth: 235.0, date_taken: '2021-08-19', photo_type_name: 'Core Box', notes: null, label: '230.0 – 235.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_028.jpg', medium_url: 'https://picsum.photos/seed/cb028/800/600', thumb_url: 'https://picsum.photos/seed/cb028/200/150', top_depth: 235.0, bottom_depth: 240.0, date_taken: '2021-08-19', photo_type_name: 'Core Box', notes: 'Pyrite nodules observed.', label: '235.0 – 240.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_029.jpg', medium_url: 'https://picsum.photos/seed/cb029/800/600', thumb_url: 'https://picsum.photos/seed/cb029/200/150', top_depth: 240.0, bottom_depth: 245.0, date_taken: '2021-08-19', photo_type_name: 'Core Box', notes: null, label: '240.0 – 245.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_030.jpg', medium_url: 'https://picsum.photos/seed/cb030/800/600', thumb_url: 'https://picsum.photos/seed/cb030/200/150', top_depth: 245.0, bottom_depth: 250.0, date_taken: '2021-08-19', photo_type_name: 'Core Box', notes: 'Core recovery ~95%. Clean sandstone.', label: '245.0 – 250.0 ft · Core Box' },
                        { api: 'mock', filename: 'formation_detail_009.jpg', medium_url: 'https://picsum.photos/seed/fd009/800/600', thumb_url: 'https://picsum.photos/seed/fd009/200/150', top_depth: 207.7, bottom_depth: 208.1, date_taken: '2021-08-18', photo_type_name: 'Formation Detail', notes: 'Burrow structures (Skolithos).', label: '207.7 – 208.1 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_010.jpg', medium_url: 'https://picsum.photos/seed/fd010/800/600', thumb_url: 'https://picsum.photos/seed/fd010/200/150', top_depth: 237.3, bottom_depth: 237.8, date_taken: '2021-08-19', photo_type_name: 'Formation Detail', notes: null, label: '237.3 – 237.8 ft · Formation Detail' },
                        { api: 'mock', filename: 'core_box_031.jpg', medium_url: 'https://picsum.photos/seed/cb031/800/600', thumb_url: 'https://picsum.photos/seed/cb031/200/150', top_depth: 250.0, bottom_depth: 255.0, date_taken: '2021-08-20', photo_type_name: 'Core Box', notes: null, label: '250.0 – 255.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_032.jpg', medium_url: 'https://picsum.photos/seed/cb032/800/600', thumb_url: 'https://picsum.photos/seed/cb032/200/150', top_depth: 255.0, bottom_depth: 260.0, date_taken: '2021-08-20', photo_type_name: 'Core Box', notes: 'Dolomite-cemented zone, very hard.', label: '255.0 – 260.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_033.jpg', medium_url: 'https://picsum.photos/seed/cb033/800/600', thumb_url: 'https://picsum.photos/seed/cb033/200/150', top_depth: 260.0, bottom_depth: 265.0, date_taken: '2021-08-20', photo_type_name: 'Core Box', notes: null, label: '260.0 – 265.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_034.jpg', medium_url: 'https://picsum.photos/seed/cb034/800/600', thumb_url: 'https://picsum.photos/seed/cb034/200/150', top_depth: 265.0, bottom_depth: 270.0, date_taken: '2021-08-20', photo_type_name: 'Core Box', notes: null, label: '265.0 – 270.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_035.jpg', medium_url: 'https://picsum.photos/seed/cb035/800/600', thumb_url: 'https://picsum.photos/seed/cb035/200/150', top_depth: 270.0, bottom_depth: 275.0, date_taken: '2021-08-20', photo_type_name: 'Core Box', notes: 'Gradational contact at base.', label: '270.0 – 275.0 ft · Core Box' },
                        { api: 'mock', filename: 'formation_detail_011.jpg', medium_url: 'https://picsum.photos/seed/fd011/800/600', thumb_url: 'https://picsum.photos/seed/fd011/200/150', top_depth: 252.0, bottom_depth: 252.4, date_taken: '2021-08-20', photo_type_name: 'Formation Detail', notes: 'Glauconite grains, marine influence.', label: '252.0 – 252.4 ft · Formation Detail' },
                        { api: 'mock', filename: 'formation_detail_012.jpg', medium_url: 'https://picsum.photos/seed/fd012/800/600', thumb_url: 'https://picsum.photos/seed/fd012/200/150', top_depth: 268.5, bottom_depth: 269.0, date_taken: '2021-08-20', photo_type_name: 'Formation Detail', notes: null, label: '268.5 – 269.0 ft · Formation Detail' },
                        { api: 'mock', filename: 'core_box_036.jpg', medium_url: 'https://picsum.photos/seed/cb036/800/600', thumb_url: 'https://picsum.photos/seed/cb036/200/150', top_depth: 275.0, bottom_depth: 280.0, date_taken: '2021-08-21', photo_type_name: 'Core Box', notes: null, label: '275.0 – 280.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_037.jpg', medium_url: 'https://picsum.photos/seed/cb037/800/600', thumb_url: 'https://picsum.photos/seed/cb037/200/150', top_depth: 280.0, bottom_depth: 285.0, date_taken: '2021-08-21', photo_type_name: 'Core Box', notes: 'Increase in organic content.', label: '280.0 – 285.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_038.jpg', medium_url: 'https://picsum.photos/seed/cb038/800/600', thumb_url: 'https://picsum.photos/seed/cb038/200/150', top_depth: 285.0, bottom_depth: 290.0, date_taken: '2021-08-21', photo_type_name: 'Core Box', notes: null, label: '285.0 – 290.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_039.jpg', medium_url: 'https://picsum.photos/seed/cb039/800/600', thumb_url: 'https://picsum.photos/seed/cb039/200/150', top_depth: 290.0, bottom_depth: 295.0, date_taken: '2021-08-21', photo_type_name: 'Core Box', notes: null, label: '290.0 – 295.0 ft · Core Box' },
                        { api: 'mock', filename: 'core_box_040.jpg', medium_url: 'https://picsum.photos/seed/cb040/800/600', thumb_url: 'https://picsum.photos/seed/cb040/200/150', top_depth: 295.0, bottom_depth: 300.0, date_taken: '2021-08-21', photo_type_name: 'Core Box', notes: 'End of cored interval.', label: '295.0 – 300.0 ft · Core Box' },
                        { api: 'mock', filename: 'geophysical_log_001.jpg', medium_url: 'https://picsum.photos/seed/gl001/800/600', thumb_url: 'https://picsum.photos/seed/gl001/200/150', top_depth: null, bottom_depth: null, date_taken: '2021-08-22', photo_type_name: 'Geophysical Log', notes: 'Full wireline log scan — gamma ray + density.', label: 'Geophysical Log 1 of 3' },
                        { api: 'mock', filename: 'geophysical_log_002.jpg', medium_url: 'https://picsum.photos/seed/gl002/800/600', thumb_url: 'https://picsum.photos/seed/gl002/200/150', top_depth: null, bottom_depth: null, date_taken: '2021-08-22', photo_type_name: 'Geophysical Log', notes: 'Neutron-density crossplot page.', label: 'Geophysical Log 2 of 3' },
                        { api: 'mock', filename: 'geophysical_log_003.jpg', medium_url: 'https://picsum.photos/seed/gl003/800/600', thumb_url: 'https://picsum.photos/seed/gl003/200/150', top_depth: null, bottom_depth: null, date_taken: '2021-08-22', photo_type_name: 'Geophysical Log', notes: 'Resistivity log, deep and shallow curves.', label: 'Geophysical Log 3 of 3' },
                        { api: 'mock', filename: 'well_site_001.jpg', medium_url: 'https://picsum.photos/seed/ws001/800/600', thumb_url: 'https://picsum.photos/seed/ws001/200/150', top_depth: null, bottom_depth: null, date_taken: '2021-08-13', photo_type_name: 'Well Site', notes: 'Site overview, pre-drill.', label: 'Well Site — Overview' },
                        { api: 'mock', filename: 'well_site_002.jpg', medium_url: 'https://picsum.photos/seed/ws002/800/600', thumb_url: 'https://picsum.photos/seed/ws002/200/150', top_depth: null, bottom_depth: null, date_taken: '2021-08-13', photo_type_name: 'Well Site', notes: 'Rig setup, morning of first core run.', label: 'Well Site — Rig Setup' },
                        { api: 'mock', filename: 'well_site_003.jpg', medium_url: 'https://picsum.photos/seed/ws003/800/600', thumb_url: 'https://picsum.photos/seed/ws003/200/150', top_depth: null, bottom_depth: null, date_taken: '2021-08-22', photo_type_name: 'Well Site', notes: 'Post-drill site condition.', label: 'Well Site — Post Drill' },
                    ],
                },
                {
                    fieldLabel: 'LAS File Information',
                    matchingField: 'display_api',
                    targetField: 'api',
                    url: PROD_POSTGREST_URL + '/ccus_las_display_view',
                    headers: {
                        "Accept-Profile": 'emp',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'display_description', label: 'Description', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        { field: 'display_field_name', label: 'Field Name', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        { field: 'display_well_status', label: 'Well Status', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        { field: 'display_well_type', label: 'Well Type', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        {
                            field: 'source', label: 'Source', transform: (value: string | null) => {
                                if (value === 'DOGM') {
                                    return <Link to="https://dataexplorer.ogm.utah.gov/">Utah Division of Oil, Gas and Mining</Link>
                                } else if (value === 'UGS') {
                                    return <>Utah Geological Survey - contact <Link to="mailto:gstpierre@utah.gov">gstpierre@utah.gov</Link></>
                                }
                                return value !== '' ? value : 'No Data';
                            }
                        }
                    ],
                    displayAs: 'table'
                }
            ]
        },
    ],
};


// SITLA Land Ownership Layer
const SITLAConfig: LayerProps = {
    type: 'map-image',
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer',
    opacity: 0.5,
    title: 'Land Ownership',
    options: {
        title: 'Land Ownership',
        elevationInfo: [{ mode: 'on-the-ground' }],
        visible: false,
        sublayers: [{
            id: 0,
            visible: true,
            crs: 'EPSG:26912',
        }],
    },
};


// Utah counties
const utCountiesayerName = 'enmin_ut_counties_current';
const utCountiesTitle = 'Counties';
const utCountiesConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: utCountiesTitle,
    visible: false,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${utCountiesayerName }`,
            popupEnabled: false,
            queryable: true,
        },
    ],
};

// Utah PLSS Grid
const utPlssayerName = 'enmin_plss_sections_current';
const utPlssTitle = 'PLSS Grid';
const utPlssConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: utPlssTitle,
    visible: false,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${utPlssayerName }`,
            popupEnabled: false,
            queryable: true,
        },
    ],
};


// utah township an range layer
const townshpRngLayerName = 'enmin_plss_townshiprange_current';
const townshpRngTitle = 'Utah Township & Ranges';
const townshpRngConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: townshpRngTitle,
    visible: false,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${townshpRngLayerName}`,
            popupEnabled: false,
            queryable: true,
        },
    ],
};

// Oil and Gas Fields WMS Layer
const oilGasFieldsLayerName = 'oilgasfields';
const oilGasFieldsWMSTitle = 'Oil and Gas Fields';
const oilGasFieldsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: oilGasFieldsWMSTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${oilGasFieldsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Field Name': { field: 'field_name', type: 'string' },
                'Field Type': { field: 'field_type', type: 'string' },
                'Producing Formations': { field: 'prod_formations', type: 'string' },
                'Reservoir Age': { field: 'reservoir_rocks', type: 'string' },
                'Status': { field: 'status', type: 'string' }
            },
        },
    ],
};

// UCRC Basins
const basinsLayerName = 'enmin_ucrc_basins_current';
const basinsWMSTitle = 'Basins';
const basinsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: basinsWMSTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${basinsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Feature': { field: 'feature', type: 'string' },
                'Label': { field: 'label', type: 'string' },
            },
        },
    ],
};

// Non Petroleum Wells Layer
const nonpetrolWellsLayerName = 'nwpd_nonpetroleumwellcatalogwells';
const nonpetrolWellsTitle = 'Non-Petroleum Wells';
const nonpetrolWellsConfig: WMSLayerProps = {
  type: 'wms',
  url: `${PROD_GEOSERVER_URL}/wms`,
  title: nonpetrolWellsTitle,
  visible: true,
  crs: 'EPSG:3857',
  sublayers: [
    {
      name: `${ENERGY_MINERALS_WORKSPACE}:${nonpetrolWellsLayerName}`,
      popupEnabled: true,
      queryable: true,
      popupFields: {
        'Name': { field: 'well_name', type: 'string' },
        'UWI': { field: 'uwi', type: 'string' },
        'Operator': { field: 'operator', type: 'string' },
        'Depth': {
            field: 'custom',
            type: 'custom',
            transform: (props) => {
                const bht = props?.['depth'];
                return `${bht} ft`;
            }
        },
        'County': {
            field: 'custom',
            type: 'custom',
            transform: (props) => {
                const cnty = props?.['county'];
                const st = props?.['state'];
                return `${cnty} , ${st}`;
            }
        },
        'Location': {
            field: 'custom',
            type: 'custom',
            transform: (props) => {
              const tnum = props?.['town_num'];
              const tdir = props?.['town_dir'];
              const rnum = props?.['range_num'];
              const rdir = props?.['range_dir'];
              const sect = props?.['sect'];
              return `${tnum}${tdir} ${rnum}${rdir} Section ${sect}`;
            }
        },
        'Meridian': { field: 'meridian', type: 'string' },
        'Purpose': {
          field: 'purpose',
          type: 'string',
          transform: (value: string | null) => {
            if (value === 'C') return 'Coal';
            if (value === 'T') return 'Tar Sands';
            if (value === 'SH') return 'Oil Shale';
            if (value === 'W') return 'Water/Geothermal';
            return 'Unknown';
          }
        },
        'Reports': {
          field: 'analyses',
          type: 'string',
          transform: (value: string | null) => {
            if (value === 'Y') return 'Available';
            if (value === 'N') return 'None';
            return 'Unknown';
          }
        },
        'Well Logs': {
          field: 'well_logs',
          type: 'string',
          transform: (value: string | null) => {
            if (value === 'Y') return 'Available';
            if (value === 'N') return 'None';
            return 'Unknown';
          }
        }
      }
    }
  ]
};



// Metal mining districts layer
const metalMiningDistrictsLayerName = 'metalmineralapp_mining_districts';
const metalMiningDistrictsTitle = 'Metalliferous Mining Districts';
const metalMiningDistrictsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: metalMiningDistrictsTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${metalMiningDistrictsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'District': { field: 'district', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Productive': { field: 'productive', type: 'string' },
                'Short Tons': { field: 'short_tons', type: 'string' },
                'Total Dollar Value': {
                    field: 'total_dollar_value',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === null) {
                            return 'No Data';
                        }
                        return `$ ${addThousandsSeparator(value)}`;
                    }
                },
                '': {
                    field: 'synonym',
                    type: 'custom',
                    transform: (() => 'Data current through 2017')
                },
            },
            linkFields: {
                'synonym': {
                    transform: (value: string | null) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://doi.org/10.34191/OFR-695'
                            }
                        ];
                    }
                }
            }
        },
    ],
};


// Seamless Geological Units WMS Layer
const seamlessGeolunitsLayerName = 'mapping_geolunits_500k';
export const seamlessGeolunitsWMSTitle = 'Geologic Units (500k)';
const seamlessGeolunitsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: seamlessGeolunitsWMSTitle,
    opacity: 0.5,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${MAPPING_WORKSPACE}:${seamlessGeolunitsLayerName}`,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Unit': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const unitName = props?.['unit_name'];
                        const unitSymbol = props?.['unit_symbol'];
                        const value = `${unitName} (${unitSymbol})`;
                        return value;
                    }
                },
                'Unit Description': { field: 'unit_description', type: 'string' },
                'Source': { field: 'series_id', type: 'string' },
            },
            linkFields: {
                'series_id': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const transformedValues = {
                            href: `https://doi.org/10.34191/${value}`,
                            label: `${value}`
                        };
                        return [transformedValues];
                    }
                }
            }
        },
    ],
};

// Pipelines WMS Layer
const pipelinesLayerName = 'pipelines';
const pipelinesWMSTitle = 'Pipelines';
const pipelinesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: pipelinesWMSTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${pipelinesLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Operator': { field: 'operator', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Acronym': { field: 'acronym', type: 'string' },
                'Code Remarks': { field: 'coderemarks', type: 'string' }
            },
        },
    ],
};


const ucrcWellsName = 'ucrc_wells_current';
const ucrcWellsTitle = 'Utah Core Research Center Inventory';
const ucrcWellsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: ucrcWellsTitle,
    visible: true,
    opacity: 0.6,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${ucrcWellsName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'API': { field: 'api_number',       type: 'string' },
                'UWI': { field: 'uwi', type: 'string' },
                'Well Name': { field: 'well_name',  type: 'string' },
                'Operator': { field: 'current_operator', type: 'string' },
                'Purpose': { field: 'purpose',  type: 'string' },
                'County':  { field: 'county',  type: 'string' },
                'Latitude': { field: 'latitude', type: 'number' },
                'Longitude': { field: 'longitude', type: 'number' },
                'Easting (NAD83)':  { field: 'easting',  type: 'number' },
                'Northing (NAD83)': { field: 'northing',  type: 'number' },
                'Township':  { field: 'township',  type: 'string' },
                'Range':  { field: 'range', type: 'string' },
                'Section': { field: 'section', type: 'string' },
            }
        }
    ]
};



const subsurfaceDataConfig: LayerProps = {
    type: 'group',
    title: 'Subsurface Data',
    visible: false,
    layers: [
        oilGasFieldsWMSConfig,
        basinsWMSConfig,
        metalMiningDistrictsConfig,
        wellWithTopsWMSConfig,
        nonpetrolWellsConfig,
    ]
}

const geologicalInformationConfig: LayerProps = {
    type: 'group',
    title: 'Geological Information',
    visible: true,
    layers: [
        seamlessGeolunitsWMSConfig,
    ]
}

const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: true,
    layers: [
        SITLAConfig,
        pipelinesWMSConfig, 
        utCountiesConfig,
        townshpRngConfig,
        utPlssConfig,          
    ]
}


const layersConfig: LayerProps[] = [
    ucrcWellsConfig,
    subsurfaceDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig
];

export default layersConfig;