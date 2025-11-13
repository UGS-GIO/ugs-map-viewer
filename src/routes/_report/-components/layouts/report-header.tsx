import { Link } from "@/components/custom/link";
import ThemeSwitch from "@/components/theme-switch";
import { useGetPageInfo } from "@/hooks/use-get-page-info";

export const ReportHeader = () => {
    const { data: pageInfo, isLoading: isInfoLoading } = useGetPageInfo()

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
                    {isInfoLoading ? (
                        <>
                            <div className="h-5 w-48 bg-muted animate-pulse rounded mb-1" />
                            <div className="h-4 w-36 bg-muted animate-pulse rounded" />
                        </>
                    ) : (
                        <>
                            <span className='font-semibold text-lg text-foreground'>{pageInfo?.appTitle}</span>
                            <span className='text-sm text-muted-foreground'>Utah Geological Survey</span>
                        </>
                    )}
                </div>
            </div>
            <ThemeSwitch />
        </div>
    );
}