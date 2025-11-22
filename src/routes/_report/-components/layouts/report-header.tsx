import { Link } from "@/components/custom/link";
import ThemeSwitch from "@/components/theme-switch";
import { useGetCurrentPage } from "@/hooks/use-get-current-page";
import { getAppTitle } from "@/lib/app-titles";
import { Button } from "@/components/ui/button";
import { Share2, Printer } from "lucide-react";
import { toast } from "sonner";

interface ReportHeaderProps {
    onPrint?: () => void;
}

export const ReportHeader = ({ onPrint }: ReportHeaderProps) => {
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
        <div className="flex items-center justify-between w-full py-1 px-2 md:px-4 bg-background">
            <div className="flex items-center gap-4">
                <Link to="https://geology.utah.gov/" className="cursor-pointer">
                    <img
                        src='/logo_main.png'
                        alt='Utah Geological Survey Logo'
                        className="h-10 w-auto"
                    />
                </Link>
                <div className="flex flex-col">
                    <span className='font-semibold text-lg text-foreground'>{appTitle}</span>
                    <span className='text-sm text-muted-foreground'>Utah Geological Survey</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {onPrint && (
                    <div className="hidden sm:flex gap-2 print:hidden">
                        <Button
                            onClick={handleShare}
                            variant="outline"
                            size="sm"
                            className='inline-flex gap-1.5 items-center'
                        >
                            <Share2 className="h-4 w-4" />
                            <span className="hidden lg:inline">Share</span>
                        </Button>
                        <Button
                            onClick={onPrint}
                            variant="outline"
                            size="sm"
                            className='inline-flex gap-1.5 items-center'
                        >
                            <Printer className="h-4 w-4" />
                            <span className="hidden lg:inline">Print</span>
                        </Button>
                    </div>
                )}
                <ThemeSwitch />
            </div>
        </div>
    );
}