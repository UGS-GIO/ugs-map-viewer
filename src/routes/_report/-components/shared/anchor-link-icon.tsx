import { Link2 } from 'lucide-react'

interface AnchorLinkIconProps {
    sectionId: string
    title: string
    size?: 'sm' | 'md' | 'lg'
}

export function AnchorLinkIcon({ sectionId, title, size = 'md' }: AnchorLinkIconProps) {
    const sizeMap = {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6'
    }

    return (
        <a
            href={`#${sectionId}`}
            className="inline-block text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 print:hidden ml-1"
            title={`Link to ${title}`}
        >
            <Link2 className={sizeMap[size]} />
        </a>
    )
}
