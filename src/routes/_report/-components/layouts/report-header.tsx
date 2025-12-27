import { Link } from "@/components/ui/link";
import ThemeSwitch from "@/components/theme-switch";
import { useGetCurrentPage } from "@/hooks/use-get-current-page";
import { getAppTitle } from "@/lib/app-titles";

export const ReportHeader = () => {
    const currentPage = useGetCurrentPage();
    const appTitle = getAppTitle(currentPage);

    return (
        <div className="flex items-center justify-between w-full py-1 bg-background">
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
            <ThemeSwitch />
        </div>
    );
}