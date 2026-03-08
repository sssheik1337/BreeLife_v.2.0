const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderInline = (value: string): string => {
    let html = escapeHtml(value);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return html;
};

export const renderLegalMarkdown = (source: unknown): string => {
    const text = typeof source === 'string' ? source.replace(/\r\n/g, '\n') : '';
    const lines = text.split('\n');
    const chunks: string[] = [];
    let paragraph: string[] = [];
    let listItems: string[] = [];

    const flushParagraph = (): void => {
        if (paragraph.length === 0) {
            return;
        }
        chunks.push(`<p>${renderInline(paragraph.join('<br>'))}</p>`);
        paragraph = [];
    };

    const flushList = (): void => {
        if (listItems.length === 0) {
            return;
        }
        chunks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
        listItems = [];
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();
        if (!trimmed) {
            flushParagraph();
            flushList();
            return;
        }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            chunks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
            return;
        }

        const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
        if (listMatch) {
            flushParagraph();
            listItems.push(listMatch[1]);
            return;
        }

        flushList();
        paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();

    return chunks.join('');
};
