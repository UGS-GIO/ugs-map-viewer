import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/hooks/use-sidebar';
import { cn } from '@/lib/utils';



const BackToMenuButton = () => {

    const { setCurrentContent } = useSidebar();
    const handleBackToMenu = () => {
        setCurrentContent(null)
    }
    return (
        <Button onClick={handleBackToMenu} variant="ghost" className={cn('md:hidden justify-start flex-none px-0')}>
            <ArrowLeft />&nbsp;Back to menu
        </Button>
    )
}

export { BackToMenuButton }