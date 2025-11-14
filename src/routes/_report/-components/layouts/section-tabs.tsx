import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Section {
    id: string
    label: string
    icon?: React.ReactNode
}

interface SectionTabsProps {
    sections: Section[]
    activeSection: string
    onSectionChange: (sectionId: string) => void
}

export function SectionTabs({
    sections,
    activeSection,
    onSectionChange,
}: SectionTabsProps) {
    return (
        <div className="inline-flex gap-1.5 p-2 bg-muted rounded-lg mx-4 my-2 items-center">
            {sections.map((section) => (
                <Button
                    key={section.id}
                    variant={activeSection === section.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSectionChange(section.id)}
                    className={cn(
                        'flex items-center gap-2 whitespace-nowrap transition-all duration-200 rounded-md px-4 py-2',
                        activeSection === section.id
                            ? 'bg-foreground text-background shadow-md hover:bg-secondary hover:text-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                >
                    {section.icon}
                    {section.label}
                </Button>
            ))}
        </div>
    )
}