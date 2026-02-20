import { Card, CardContent } from '@/components/ui/card'

interface MapPlaceholderProps {
    title?: string
    height?: string
    className?: string
}

export function MapPlaceholder({
    title = 'Map',
    height = 'h-96',
    className
}: MapPlaceholderProps) {
    return (
        <Card className={className}>
            <CardContent className="p-4">
                <div className={`bg-muted rounded-lg ${height} flex items-center justify-center`}>
                    <p className="text-muted-foreground text-sm text-center px-4">
                        {title} will be inserted here
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}