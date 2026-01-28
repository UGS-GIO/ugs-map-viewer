import { Link } from "@/components/ui/link";
import ThemeSwitch from "@/components/theme-switch";
import { useGetCurrentPage } from "@/hooks/use-get-current-page";
import { getAppTitle } from "@/lib/app-titles";
import { Button } from "@/components/ui/button";
import { Share2, Printer, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ReportHeaderProps {
    onPrint?: () => void;
    testAllHazards?: boolean;
}

export const ReportHeader = ({ onPrint, testAllHazards = false }: ReportHeaderProps) => {
    const currentPage = useGetCurrentPage();
    const appTitle = getAppTitle(currentPage);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href)
            .then(() => {
                toast('Report link copied to clipboard!');
            })
            .catch((err) => {
                toast.warning('Failed to copy report link.');
                console.error('Could not copy text: ', err);
            });
    };

    return (
        <div className="flex items-center justify-between w-full py-2 px-2 md:px-4 bg-background">
            <div className="flex items-center gap-3">
                <Link to="https://geology.utah.gov/" className="cursor-pointer flex-shrink-0">
                    <img
                        src='/logo_main.png'
                        alt='Utah Geological Survey Logo'
                        className="h-9 w-auto"
                    />
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <span className='font-semibold text-base sm:text-lg text-foreground'>{appTitle}</span>
                    <span className='hidden sm:inline text-muted-foreground'>|</span>
                    <span className='text-xs sm:text-sm text-muted-foreground'>Utah Geological Survey</span>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {onPrint && (
                    <div className="hidden sm:inline-flex flex-row gap-2 print:hidden">
                        <Button
                            onClick={handleShare}
                            variant="outline"
                            size="sm"
                        >
                            <Share2 className="h-4 w-4" />
                            <span className="hidden lg:inline">Share</span>
                        </Button>
                        <Button
                            onClick={onPrint}
                            variant="outline"
                            size="sm"
                        >
                            <Printer className="h-4 w-4" />
                            <span className="hidden lg:inline">Print</span>
                        </Button>
                    </div>
                )}
                {import.meta.env.DEV && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => {
                                        const url = new URL(window.location.href)
                                        if (testAllHazards) {
                                            url.searchParams.delete('testAll')
                                        } else {
                                            url.searchParams.set('testAll', 'true')
                                        }
                                        window.location.href = url.toString()
                                    }}
                                    variant={testAllHazards ? "destructive" : "ghost"}
                                    size="icon"
                                    className="h-8 w-8"
                                >
                                    <FlaskConical className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{testAllHazards ? "Exit test mode" : "Test all hazards"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                <ThemeSwitch />
            </div>
        </div>
    );
}