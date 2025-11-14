import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LegendItem {
    id: string
    label: string
    color?: string
    description?: string
}

interface LegendCardProps {
    title?: string
    items: LegendItem[]
    showDescriptions?: boolean
}

export function LegendCard({
    title = 'Legend',
    items,
    showDescriptions = false
}: LegendCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {items.map((item) => (
                    <div key={item.id}>
                        <div className="flex items-center gap-2 mb-1">
                            <div
                                className="w-4 h-4 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: item.color || '#f97316' }}
                            />
                            <span className="font-medium">{item.label}</span>
                        </div>
                        {showDescriptions && item.description && (
                            <p className="text-xs text-muted-foreground ml-6">
                                {item.description}
                            </p>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}