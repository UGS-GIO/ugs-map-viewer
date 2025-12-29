import { Button } from "@/components/ui/button"
import ReportGenerator from "@/routes/_map/hazards/-components/sidebar/report-generator"
import { FileText, FileTextIcon } from "lucide-react"
import { useSidebar } from "@/hooks/use-sidebar"

// Define ReportGeneratorButton as a React component
const ReportGeneratorButton: React.FC = () => {
    const { setCurrentContent } = useSidebar()

    const handleReportGenerator = () => {
        setCurrentContent({
            title: 'Report Generator',
            label: '',
            icon: <FileTextIcon />,
            componentPath: '/src/pages/hazards/components/sidebar/report-generator',
            component: ReportGenerator,
        })
    }

    return (
        <Button onClick={handleReportGenerator} variant="ghost" className="flex gap-x-2">
            <FileText className='stroke-foreground h-5 w-5' />
            <span className="hidden md:flex">Report Generator</span>
            <span className="md:hidden">Report</span>
        </Button>
    )
}

// Export popupButtons with the proper component
export const popupButtons = [
    {
        id: "reportGenerator",
        component: ReportGeneratorButton, // Use the React component directly
    },
]