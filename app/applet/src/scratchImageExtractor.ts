export async function convertScratchTextToImagesAsync(text: string): Promise<string> {
    if (!text || typeof text !== 'string') return text;
    if (!text.includes('[scratch]')) return text;

    const scratchRegex = /\[scratch\]([\s\S]*?)\[\/scratch\]/g;
    
    let result = text;
    let match;
    const replacements = [];

    while ((match = scratchRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const code = match[1].trim();
        const imgData = await renderScratchToPng(code);
        if (imgData) {
            replacements.push({
                old: fullMatch,
                new: `[scratch_img:${imgData.width}:${imgData.height}]${imgData.base64}[/scratch_img]`
            });
        }
    }

    for (let r of replacements) {
        result = result.replace(r.old, r.new);
    }
    return result;
}

export async function processPayloadForScratchImages(payload: any): Promise<any> {
    const clone = JSON.parse(JSON.stringify(payload));

    if (!clone.sections) return clone;

    for (const sec of clone.sections) {
        if (!sec.questions) continue;
        for (const q of sec.questions) {
            if (q.question) q.question = await convertScratchTextToImagesAsync(q.question);
            if (q.options) {
                for (let i=0; i<q.options.length; i++) {
                    q.options[i] = await convertScratchTextToImagesAsync(q.options[i]);
                }
            }
            if (q.statements) {
                for (let i=0; i<q.statements.length; i++) {
                    q.statements[i].text = await convertScratchTextToImagesAsync(q.statements[i].text);
                }
            }
            if (q.left) {
                for (let i=0; i<q.left.length; i++) {
                    q.left[i] = await convertScratchTextToImagesAsync(q.left[i]);
                }
            }
            if (q.right) {
                for (let i=0; i<q.right.length; i++) {
                    q.right[i] = await convertScratchTextToImagesAsync(q.right[i]);
                }
            }
        }
    }
    return clone;
}

function renderScratchToPng(code: string): Promise<{base64: string, width: number, height: number} | null> {
    return new Promise((resolve) => {
        try {
            const scratchblocks = (window as any).scratchblocks;
            if (!scratchblocks) {
                import('scratchblocks').then(sb => {
                    doRender(sb.default || sb, code, resolve);
                }).catch(() => resolve(null));
            } else {
                doRender(scratchblocks, code, resolve);
            }
        } catch (e) {
            console.error(e);
            resolve(null);
        }
    });
}

function doRender(scratchblocks: any, code: string, resolve: (val: {base64: string, width: number, height: number} | null) => void) {
    try {
        const parsed = scratchblocks.parse(code);
        const view = scratchblocks.newView(parsed, { style: 'scratch3' });
        const svg = view.render();

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const URL_impl = window.URL || window.webkitURL;
        const blobURL = URL_impl.createObjectURL(blob);

        img.onload = () => {
            // scale up for docx clarity
            const scale = 2; 
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            if (ctx) {
                // Ensure transparent or white background? Let's keep transparent
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);
            }
            URL_impl.revokeObjectURL(blobURL);
            
            // docx Image run needs base64 without the prefix
            const pngBase64 = canvas.toDataURL("image/png").split(',')[1];
            resolve({ base64: pngBase64, width: img.width, height: img.height });
        };
        
        img.onerror = () => {
            resolve(null);
        };

        img.src = blobURL;
    } catch(e) {
        console.error("Failed to render sb", e);
        resolve(null);
    }
}
