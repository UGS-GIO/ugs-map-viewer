import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { useReactToPrint } from 'react-to-print'
import { queryKeys } from '@/lib/query-keys'
import { ReportLayout } from '@/routes/_report/-components/layouts/report-layout'
import { SectionTabs, Section } from '@/routes/_report/-components/layouts/section-tabs'
import { FileText, AlertTriangle, Printer, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Image } from '@/components/ui/image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { queryGeoServerForHazardUnits } from '@/routes/_report/-utils/geoserver-wfs-service'
import {
    HazardUnit,
    queryGroupingStatic,
    queryHazardUnitsStatic,
    queryAllUnitsForHazardCodes,
    queryReferencesStatic,
} from '@/routes/_report/-utils/static-hazards-service'
import type { CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import { generateQFFLegendItems } from '@/routes/_report/-utils/qff-legend-service'
import { HeroSection } from '@/components/custom/hero-section'
import { ReportCover } from '@/routes/_report/-components/content/report-cover'
import { ReportSummary } from '@/routes/_report/-components/content/report-summary'
import { ReportGroupSection } from '@/routes/_report/-components/content/report-group-section'
import { ReportResources } from '@/routes/_report/-components/content/report-resources'
import '@/routes/_report/-components/shared/print-styles.css'
import heroImage from '@/assets/geologic-hazards-banner-alstrom-point-1920px.webp'
import { Banner, BannerIcon, BannerTitle } from '@/components/ui/banner'
import { toast } from "sonner"
import { ReportHeader } from './layouts/report-header'


interface HazardsReportProps {
    polygon: string
}

interface HazardLayer {
    code: string
    name: string
    category: string
    url: string
    units: HazardUnit[]
    references: string[]
    customLegendItems?: CustomLegendItem[]
}

interface HazardGroup {
    id: string
    name: string
    layers: HazardLayer[]
}

export function HazardsReport({ polygon }: HazardsReportProps) {
    const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({})
    const printRef = useRef<HTMLDivElement>(null)
    const [activeSection, setActiveSection] = useState<string>('cover')
    const visibleSectionsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map())

    // Query for hazard data
    const { data: hazardGroups = [], isLoading } = useQuery({
        queryKey: queryKeys.hazards.report(polygon),
        queryFn: async () => {
            const allHazardInfos = await queryGeoServerForHazardUnits(polygon);

            const hazardInfos = allHazardInfos.filter(
                ({ units }) => units && units.length > 0
            )

            const flatUnitCodes = Array.from(
                new Set(
                    hazardInfos.reduce(
                        (prev: string[], { units }) => prev.concat(units),
                        []
                    )
                )
            )

            // Extract unique hazard codes from the polygon results
            const hazardCodes = Array.from(
                new Set(
                    hazardInfos.map(h => h.hazard)
                )
            )

            const [
                groupings,
                hazardUnitText,
                allHazardUnits,
                hazardReferences,
                qffLegendItems,
            ] = await Promise.all([
                Promise.resolve(queryGroupingStatic(flatUnitCodes)),
                Promise.resolve(queryHazardUnitsStatic(flatUnitCodes)),
                Promise.resolve(queryAllUnitsForHazardCodes(hazardCodes)),
                Promise.resolve(queryReferencesStatic(flatUnitCodes)),
                // Generate QFF legend items if QFF is present
                hazardCodes.includes('QFF') ? generateQFFLegendItems(polygon) : Promise.resolve([]),
            ])

            // Get unique groups
            const uniqueGroups = Array.from(new Set(groupings.map(g => g.HazardGroup)))

            // Organize by groups
            const groupMap: { [key: string]: HazardGroup } = {}

            uniqueGroups.forEach((groupName: string) => {
                groupMap[groupName] = {
                    id: groupName.toLowerCase().replace(/\s+/g, '-'),
                    name: groupName,
                    layers: []
                }
            })

            // Group hazards by their group
            groupings.forEach(g => {
                // Check if this hazard code was present in the polygon
                if (!hazardCodes.includes(g.HazardCode)) return;

                // Find the unit description matching the specific unit (using HazardCode to match the unit's base code, e.g., 'LSF')
                const units = hazardUnitText.filter(u =>
                    u.HazardUnit.toLowerCase().includes(g.HazardCode.toLowerCase())
                )

                // Use allHazardUnits for legend (all possible units for this layer)
                const allUnitsForLayer = allHazardUnits.filter(u =>
                    u.HazardUnit.toLowerCase().includes(g.HazardCode.toLowerCase())
                )

                const refs = hazardReferences.filter(r => r.Hazard === g.HazardCode)

                // Find the matching hazard info to get the URL
                const hazardInfo = hazardInfos.find(h => h.hazard === g.HazardCode)

                if (groupMap[g.HazardGroup]) {
                    groupMap[g.HazardGroup].layers.push({
                        code: g.HazardCode,
                        name: units[0]?.HazardName || g.HazardCode,
                        category: g.HazardGroup,
                        url: hazardInfo?.url || '',
                        units: allUnitsForLayer.map(u => ({
                            HazardName: u.HazardName,
                            HazardUnit: u.HazardUnit,
                            UnitName: u.UnitName,
                            Description: u.Description,
                            HowToUse: u.HowToUse,
                        })),
                        references: refs.map(r => r.Text),
                        customLegendItems: g.HazardCode === 'QFF' ? qffLegendItems : undefined,
                    })
                }
            })

            return Object.values(groupMap).filter(g => g.layers.length > 0)
        },
        enabled: !!polygon,
    })

    const sections: Section[] = useMemo(() => [
        { id: 'cover', label: 'Cover', icon: <FileText className="h-4 w-4" /> },
        { id: 'summary', label: 'Summary', icon: <FileText className="h-4 w-4" /> },
        ...hazardGroups.map(group => ({
            id: group.id,
            label: group.name,
            icon: <AlertTriangle className="h-4 w-4" />
        })),
        { id: 'resources', label: 'Other Resources', icon: <FileText className="h-4 w-4" /> }
    ], [hazardGroups])

    const sectionIds = useMemo(() => sections.map(s => s.id), [sections])

    // Function to update visible sections and determine which should be active
    const updateVisibleSection = useCallback((id: string, inView: boolean, entry?: IntersectionObserverEntry) => {
        if (inView && entry) {
            visibleSectionsRef.current.set(id, entry)
        } else {
            visibleSectionsRef.current.delete(id)
        }

        if (visibleSectionsRef.current.size === 0) return

        // Find the section that's most visible (highest intersection ratio)
        // or if at bottom of page, pick the last visible section
        let maxRatio = 0
        let bestSection = sectionIds[0]

        visibleSectionsRef.current.forEach((entry, sectionId) => {
            const ratio = entry.intersectionRatio

            // If this section has a higher ratio, it wins
            if (ratio > maxRatio) {
                maxRatio = ratio
                bestSection = sectionId
            }
            // If ratios are equal, prefer the later section (for bottom of page)
            else if (ratio === maxRatio) {
                const currentIndex = sectionIds.indexOf(bestSection)
                const newIndex = sectionIds.indexOf(sectionId)
                if (newIndex > currentIndex) {
                    bestSection = sectionId
                }
            }
        })
        setActiveSection(bestSection)
    }, [sectionIds])

    const scrollToSection = useCallback((sectionId: string) => {
        const element = sectionRefs.current[sectionId]
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [])

    // Handle anchor link navigation from URL hash on page load and hash changes
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1) // Remove '#' prefix
            if (hash && sectionRefs.current[hash]) {
                // Small delay to ensure content is rendered
                setTimeout(() => scrollToSection(hash), 100)
            }
        }

        // Run on initial load to handle direct links with anchors
        handleHashChange()

        // Listen for hash changes (e.g., when clicking anchor link icons)
        window.addEventListener('hashchange', handleHashChange)
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [sections, scrollToSection])

    const handlePrint = useReactToPrint({
        contentRef: printRef,
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading report data...</p>
                </div>
            </div>
        )
    }

    return (
        <>
            <ReportLayout
                header={<ReportHeader />}
                hero={
                    <div className="print:hidden">
                        <HeroSection
                            image={
                                <Image
                                    src={heroImage}
                                    alt="Hero"
                                    className="w-full h-48 object-cover"
                                    loading="eager"
                                />
                            }
                            overlayText="Geologic Hazards Report"
                        />
                    </div>
                }
                tabs={
                    <div className="print:hidden flex justify-between">
                        <SectionTabs
                            sections={sections}
                            activeSection={activeSection}
                            onSectionChange={scrollToSection}
                        />
                        <TooltipProvider>
                            <div className="flex flex-wrap gap-2 items-center mx-4 my-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={() => {
                                                const reportUrl = window.location.href; // Use the current URL

                                                // Directly copy the URL to the clipboard and show toast notification
                                                navigator.clipboard.writeText(reportUrl)
                                                    .then(() => {
                                                        // Success toast
                                                        toast('Report link copied to clipboard!');
                                                    })
                                                    .catch((err) => {
                                                        // Failure toast
                                                        toast.warning('Failed to copy report link.');
                                                        console.error('Could not copy text: ', err);
                                                    });
                                            }}
                                            variant="default"
                                            className='inline-flex gap-1.5 p-2 items-center'
                                        >
                                            <Upload className="h-4 w-4 xl:mr-2" />
                                            <span className="hidden xl:inline">Share Report</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Share Report</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handlePrint}
                                            variant="default"
                                            className='inline-flex gap-1.5 p-2 items-center'
                                        >
                                            <Printer className="h-4 w-4 xl:mr-2" />
                                            <span className="hidden xl:inline">Print / Save as PDF</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Print / Save as PDF</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>
                }
                banner={
                    <Banner className="rounded-sm w-4/5 bg-transparent border border border-primary">
                        <BannerIcon className='text-primary' icon={AlertTriangle} />
                        <BannerTitle className='text-foreground'>
                            <span className="font-semibold">Notice:</span> The absence of data does not imply that no geologic hazard or hazards exist.
                        </BannerTitle>
                    </Banner>
                }
                footer={
                    <div className="flex items-center justify-between w-full text-sm text-muted-foreground print:hidden">
                        <span>Utah Geological Survey</span>
                        <span>Generated: {new Date().toLocaleString()}</span>
                    </div>
                }
            >
                <div ref={printRef} className="report-content space-y-6 md:space-y-12 max-w-7xl mx-auto">
                    {/* Print-only header */}
                    <div className="hidden print:block mb-8">
                        <div className="flex items-center justify-between border-b-2 border-secondary pb-4">
                            <div>
                                <h1 className="font-bold">Geological Hazards Mapping and Data Custom Report</h1>
                                <p className="text-sm text-foreground/80">Utah Geological Survey</p>
                            </div>
                            <img
                                src='/logo_main.png'
                                alt='Utah Geological Survey Logo'
                                className="print-logo-header w-auto"
                            />
                        </div>
                        <p className="text-foreground/80 mt-2">
                            Report Generated on: {new Date().toLocaleString()}
                        </p>
                    </div>
                    {/* Cover Page */}
                    <SectionWithObserver id="cover" setRef={(el) => sectionRefs.current['cover'] = el} updateVisible={updateVisibleSection}>
                        <ReportCover
                            polygon={polygon}
                        />
                    </SectionWithObserver>

                    {/* Summary Page */}
                    <SectionWithObserver id="summary" setRef={(el) => sectionRefs.current['summary'] = el} updateVisible={updateVisibleSection}>
                        <ReportSummary
                            hazardGroups={hazardGroups}
                        />
                    </SectionWithObserver>

                    {/* Hazard Group Sections */}
                    {hazardGroups.map(group => (
                        <SectionWithObserver
                            key={group.id}
                            id={group.id}
                            setRef={(el) => sectionRefs.current[group.id] = el}
                            updateVisible={updateVisibleSection}
                        >
                            <ReportGroupSection
                                group={group}
                                polygon={polygon}
                            />
                        </SectionWithObserver>
                    ))}

                    {/* Other Resources Section */}
                    <SectionWithObserver
                        id="resources"
                        setRef={(el) => sectionRefs.current['resources'] = el}
                        updateVisible={updateVisibleSection}
                        isLast={true}
                    >
                        <ReportResources />
                    </SectionWithObserver>
                </div>
            </ReportLayout>
        </>
    )
}

// Helper component to attach intersection observer to each section
function SectionWithObserver({
    id,
    setRef,
    updateVisible,
    children,
    isLast = false
}: {
    id: string
    setRef: (el: HTMLElement | null) => void
    updateVisible: (id: string, isVisible: boolean, entry?: IntersectionObserverEntry) => void
    children: React.ReactNode
    isLast?: boolean
}) {
    const { ref, inView, entry } = useInView({
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], // Multiple thresholds for better granularity
        // For the last section, use a more lenient bottom margin so it can be detected even at the bottom of the page
        rootMargin: isLast ? '0px 0px 0px 0px' : '0px 0px -40% 0px',
    })

    useEffect(() => {
        updateVisible(id, inView, entry)
    }, [inView, entry, id, updateVisible])

    const setRefs = useCallback((node: HTMLElement | null) => {
        // Set both refs
        ref(node)
        setRef(node)
    }, [ref, setRef])

    return (
        <div ref={setRefs} id={id} className="scroll-mt-16 md:scroll-mt-20">
            {children}
        </div>
    )
}