export const ReportFooter = () => {
    return (
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
            <span>Utah Geological Survey</span>
            <span>Generated: {new Date().toLocaleString()}</span>
        </div>
    );
}