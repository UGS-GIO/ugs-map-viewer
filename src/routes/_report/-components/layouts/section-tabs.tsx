import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    const activeLabel = sections.find(s => s.id === activeSection)?.label || 'Select section'

    return (
        <>
            {/* Mobile dropdown */}
            <div className="lg:hidden my-2 px-4 w-full">
                <Select value={activeSection} onValueChange={onSectionChange}>
                    <SelectTrigger className="w-full bg-muted">
                        <SelectValue placeholder={activeLabel} />
                    </SelectTrigger>
                    <SelectContent>
                        {sections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                                <div className="flex items-center gap-2">
                                    {section.icon}
                                    {section.label}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Desktop tabs */}
            <div className="hidden lg:block overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent w-full px-4">
                <div className="inline-flex gap-1.5 p-2 bg-muted rounded-lg my-2 items-center min-w-min w-full">
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
            </div>
        </>
    )
}