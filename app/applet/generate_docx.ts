import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    convertInchesToTwip,
    BorderStyle,
    HeadingLevel
} from 'docx';
import fs from 'fs';
import path from 'path';

// Helper to create a consistent text run with Times New Roman 14pt (28 half-points)
const createRun = (text: string, options: { bold?: boolean, italic?: boolean, underline?: boolean } = {}) => {
    return new TextRun({
        text: text,
        font: 'Times New Roman',
        size: 28, // 14pt = 28 half-points
        bold: options.bold,
        italics: options.italic,
        underline: options.underline ? {} as any : undefined
    });
};

function parseTextToRuns(text: string, baseOptions: { bold?: boolean, italic?: boolean, underline?: boolean } = {}): any[] {
    const runs: any[] = [];
    if (!text) return runs;

    const regex = /\[scratch_img:(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)\](.*?)\[\/scratch_img\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            runs.push(createRun(text.slice(lastIndex, match.index), baseOptions));
        }
        
        try {
            const width = parseFloat(match[1]);
            const height = parseFloat(match[2]);
            const base64Data = match[3];
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Refine scaling to fit within ~16cm usable width (at ~96dpi, 16cm ≈ 600px)
            const maxWidth = 550; 
            const scale = width > maxWidth ? maxWidth / width : 1; 

            runs.push(new ImageRun({
                data: buffer,
                type: "png",
                transformation: {
                    width: width * scale, 
                    height: height * scale
                } 
            } as any));
        } catch (e) {
            console.error("Failed to inject image into docx", e);
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        runs.push(createRun(text.slice(lastIndex), baseOptions));
    }

    return runs;
}

const createParagraph = (runs: any[], options: { alignment?: any, justify?: boolean, indentLeft?: number, spacingAfter?: number } = {}) => {
    return new Paragraph({
        children: runs,
        alignment: options.alignment || (options.justify ? AlignmentType.BOTH : AlignmentType.LEFT),
        indent: options.indentLeft ? { left: convertInchesToTwip(options.indentLeft) } : undefined,
        spacing: {
            line: 240, // 1.0 line spacing
            after: options.spacingAfter !== undefined ? options.spacingAfter : 0,
        }
    });
};

export async function generateWordDocx(jsonData: any, outputPath: string) {
    const margin2cm = convertInchesToTwip(0.7874); // 2.0cm
    const marginLeft3cm = convertInchesToTwip(1.1811); // 3.0cm

    const children: any[] = [];

    // ====== 1. HEADER ======
    if (jsonData.header) {
        const leftHeader = jsonData.header.left || [];
        const rightHeader = jsonData.header.center || []; // Actually called center in JSON but it goes on the right

        const headerTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 40, type: WidthType.PERCENTAGE },
                            children: leftHeader.map((text: string) => createParagraph([createRun(text, { bold: !text.includes("...") && !text.includes("Thời gian") })], { alignment: AlignmentType.CENTER }))
                        }),
                        new TableCell({
                            width: { size: 60, type: WidthType.PERCENTAGE },
                            children: rightHeader.map((text: string) => createParagraph([createRun(text, { bold: !text.includes("...") && !text.includes("Thời gian") })], { alignment: AlignmentType.CENTER }))
                        })
                    ]
                })
            ]
        });
        children.push(headerTable);
        children.push(createParagraph([createRun("")], { spacingAfter: 200 }));
    }

    // ====== 2. SCORE TABLE ======
    if (jsonData.settings?.includeScoreTable !== false) {
        const scoreTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 25, type: WidthType.PERCENTAGE },
                            children: [
                                createParagraph([createRun("Điểm", { bold: true })], { alignment: AlignmentType.CENTER }),
                                createParagraph([createRun("")]),
                                createParagraph([createRun("")])
                            ]
                        }),
                        new TableCell({
                            width: { size: 75, type: WidthType.PERCENTAGE },
                            children: [
                                createParagraph([createRun("Lời nhận xét của thầy (cô) giáo:")], { alignment: AlignmentType.LEFT }),
                                createParagraph([createRun("")]),
                                createParagraph([createRun("")])
                            ]
                        })
                    ]
                })
            ]
        });
        children.push(scoreTable);
        children.push(createParagraph([createRun("")], { spacingAfter: 200 }));
    }

    // ====== 2.5 MATRIX TABLE (OPTIONAL) ======
    if (jsonData.settings?.includeMatrix && jsonData.settings.matrix) {
        children.push(createParagraph([createRun("MA TRẬN ĐỀ THI", { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 100 }));
        const matrixRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [createParagraph([createRun("Chủ đề/Nội dung", { bold: true })])] }),
                    new TableCell({ children: [createParagraph([createRun("NB", { bold: true })])], width: { size: 10, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [createParagraph([createRun("TH", { bold: true })])], width: { size: 10, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [createParagraph([createRun("VD", { bold: true })])], width: { size: 10, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [createParagraph([createRun("VDC", { bold: true })])], width: { size: 10, type: WidthType.PERCENTAGE } }),
                ]
            })
        ];

        jsonData.settings.matrix.forEach((m: any) => {
            matrixRows.push(new TableRow({
                children: [
                    new TableCell({ children: [createParagraph([createRun(m.topic)])] }),
                    new TableCell({ children: [createParagraph([createRun(m.nb.toString())], { alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [createParagraph([createRun(m.th.toString())], { alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [createParagraph([createRun(m.vd.toString())], { alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [createParagraph([createRun(m.vdc.toString())], { alignment: AlignmentType.CENTER })] }),
                ]
            }));
        });

        const mTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: matrixRows
        });
        children.push(mTable);
        children.push(createParagraph([createRun("")], { spacingAfter: 300 }));
    }

    // TITLE "ĐỀ BÀI"
    children.push(createParagraph([createRun("ĐỀ BÀI", { bold: true, underline: true })], { alignment: AlignmentType.CENTER, spacingAfter: 200 }));

    // ====== 3. SECTIONS ======
    const sections = jsonData.sections || [];
    for (const sec of sections) {
        children.push(createParagraph([createRun(sec.title || '', { bold: true })], { spacingAfter: 120 }));

        for (let qIdx = 0; qIdx < (sec.questions || []).length; qIdx++) {
            const q = sec.questions[qIdx];
            const qText = `Câu \${q.id || (qIdx + 1)}. `;
            
            children.push(createParagraph([
                ...parseTextToRuns(qText, { bold: true }),
                ...parseTextToRuns(q.question || '')
            ], { justify: true }));

            if (sec.type === 'multiple_choice') {
                const options = q.options || [];
                for (let i = 0; i < options.length; i++) {
                    const prefix = String.fromCharCode(65 + i) + ". ";
                    let oText = String(options[i]).trim();
                    if (!oText.startsWith(prefix.trim()) && !oText.startsWith(String.fromCharCode(65 + i) + ")")) {
                        oText = prefix + oText;
                    }
                    children.push(createParagraph(parseTextToRuns(oText), { indentLeft: 0.3937 })); // 1cm indent
                }
            } else if (sec.type === 'true_false') {
                const statements = q.statements || [];
                if (statements.length > 0) {
                    const tfTable = new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, children: [createParagraph([createRun("Lệnh hỏi", { bold: true })], { alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [createParagraph([createRun("Đúng", { bold: true })], { alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [createParagraph([createRun("Sai", { bold: true })], { alignment: AlignmentType.CENTER })] }),
                                ]
                            }),
                            ...statements.map((st: any, i: number) => {
                                let t = String(st.text || '').trim();
                                const prefix = String.fromCharCode(97 + i) + ") ";
                                if (!t.toLowerCase().startsWith(prefix.trim())) {
                                    t = prefix + t;
                                }
                                return new TableRow({
                                    children: [
                                        new TableCell({ children: [createParagraph(parseTextToRuns(t), { alignment: AlignmentType.LEFT })] }),
                                        new TableCell({ children: [createParagraph([createRun("")], { alignment: AlignmentType.CENTER })] }),
                                        new TableCell({ children: [createParagraph([createRun("")], { alignment: AlignmentType.CENTER })] }),
                                    ]
                                });
                            })
                        ]
                    });
                    children.push(tfTable);
                }
            } else if (sec.type === 'matching') {
                 const left = q.left || [];
                 const right = q.right || [];
                 const maxLen = Math.max(left.length, right.length);
                 if (maxLen > 0) {
                     const matchTable = new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [createParagraph([createRun("Cột A", { bold: true })], { alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [createParagraph([createRun("Cột B", { bold: true })], { alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [createParagraph([createRun("Ghép nối", { bold: true })], { alignment: AlignmentType.CENTER })] }),
                                ]
                            }),
                            ...Array.from({ length: maxLen }).map((_, i) => {
                                let l = left[i] || "";
                                let r = right[i] || "";
                                const pL = `\${i+1}. `;
                                const pR = `\${String.fromCharCode(65 + i)}. `;
                                if (l && !l.startsWith(String(i+1))) l = pL + l;
                                if (r && !r.startsWith(String.fromCharCode(65 + i))) r = pR + r;

                                return new TableRow({
                                    children: [
                                        new TableCell({ children: [createParagraph(parseTextToRuns(l), { alignment: AlignmentType.LEFT })] }),
                                        new TableCell({ children: [createParagraph(parseTextToRuns(r), { alignment: AlignmentType.LEFT })] }),
                                        new TableCell({ children: [createParagraph([createRun(`\${i+1} - ........`)], { alignment: AlignmentType.CENTER })] }),
                                    ]
                                });
                            })
                        ]
                     });
                     children.push(matchTable);
                 }
            } else if (sec.type === 'essay') {
                children.push(createParagraph([createRun("")], { spacingAfter: 1000 }));
            }
            
            children.push(createParagraph([createRun("")], { spacingAfter: 120 }));
        }
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: margin2cm,
                        bottom: margin2cm,
                        left: marginLeft3cm,
                        right: margin2cm,
                    }
                }
            },
            children: children
        }]
    });

    const docBuffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, docBuffer);
}
