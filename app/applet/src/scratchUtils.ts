import scratchblocks from 'scratchblocks';

export function renderScratchToSvgString(code: string): string {
    const doc = scratchblocks.parse(code);
    const docView = scratchblocks.newView(doc, {
        style: 'scratch3'
    });
    const svg = docView.render();
    
    // We need to return the SVG string
    return svg.outerHTML;
}
