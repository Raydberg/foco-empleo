export function extractDescription(content: string): string {
    let cleanContent = content
        .replace(/^---[\s\S]*?---/, '')
        .replace(/import\s+.*?from\s+['"].*?['"];?/g, '')
        .trim();

    cleanContent = cleanContent
        .replace(/<[^>]+>/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^#+\s+.*/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1');

    cleanContent = cleanContent
        .replace(/\n\s*\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();

    cleanContent = cleanContent
        .replace(/^Blog\s+numero\s+\d+\s*/i, '')
        .replace(/^Blog\s+\d+\s*/i, '')
        .trim();

    const targetLength = 600;

    if (cleanContent.length <= targetLength) {
        return cleanContent;
    }

    let truncated = cleanContent.substring(0, targetLength);

    const lastPeriodIndex = truncated.lastIndexOf('. ');

    if (lastPeriodIndex !== -1) {
        truncated = truncated.substring(0, lastPeriodIndex + 1);
    } else {
        const lastPeriodEnd = truncated.lastIndexOf('.');
        if (lastPeriodEnd !== -1) {
            truncated = truncated.substring(0, lastPeriodEnd + 1);
        } else {
            truncated = truncated.substring(0, truncated.lastIndexOf(' ')) + '...';
        }
    }

    return truncated.trim();
}
