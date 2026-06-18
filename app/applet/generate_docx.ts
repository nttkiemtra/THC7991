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
    VerticalAlign
} from 'docx';
import fs from 'fs';
import * as cheerio from 'cheerio';

const createRun = (text: string, options: { bold?: boolean, italic?: boolean, underline?: boolean, break?: number, size?: number, font?: string } = {}) => {
    return new TextRun({
        text: text,
        bold: options.bold,
        italics: options.italic,
        underline: options.underline ? { type: "single" } : undefined,
        break: options.break,
        size: options.size || 26, // 13pt
        font: options.font || "Times New Roman"
    });
};

const createParagraph = (runs: any[], options: { alignment?: any, indentLeft?: number, spacingAfter?: number, break?: number } = {}) => {
    return new Paragraph({
        children: runs,
        alignment: options.alignment,
        indent: options.indentLeft ? { left: convertInchesToTwip(options.indentLeft) } : undefined,
        spacing: {
            line: 240, 
            after: options.spacingAfter !== undefined ? options.spacingAfter : 0, // default 0 for exact 1.0 spacing
            before: 0
        },
        pageBreakBefore: options.break ? true : false
    });
};

// Hàm xử lý bảng với viền đơn sắc không bị kép (Sử dụng size: 4 cho đường kẻ thanh thoát)
const getStandardBorders = () => ({
    top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
});

// Helper parsing matrix cell codes or counts
const parseMatrixCell = (val: any) => {
    if (val === undefined || val === null) return { count: 0, text: "" };
    const textStr = String(val).trim();
    if (textStr === "" || textStr === "0" || textStr === "0.0") return { count: 0, text: "" };
    
    // Simple check for numbers
    const num = Number(textStr);
    if (!isNaN(num)) {
        return { count: num, text: textStr };
    }
    
    // Splitting multiple questions comma separated e.g. "C1, C5, C9" or "C17 1.0đ"
    const parts = textStr.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
    return { count: parts.length, text: textStr, parts };
};

const getMatrixCellPoints = (dk: string, levelKey: string, cellVal: any, pointsPerQuestion: number = 0.25) => {
    const parsed = parseMatrixCell(cellVal);
    if (parsed.count === 0) return 0;
    
    if (parsed.parts) {
        let totalPoints = 0;
        parsed.parts.forEach(part => {
            const match = part.match(/(\d+\.?\d*)\s*(?:đ|điểm|pt|pts)/i);
            if (match) {
                totalPoints += parseFloat(match[1]);
            } else {
                if (dk === 'd1') {
                    totalPoints += pointsPerQuestion;
                } else if (dk === 'd2' || dk === 'd3' || dk === 'd4') {
                    totalPoints += 1.0;
                } else if (dk === 'd5') {
                    if (levelKey === 'nb') totalPoints += 1.0;
                    else if (levelKey === 'th') totalPoints += 1.0;
                    else if (levelKey === 'vd') totalPoints += 2.0;
                    else totalPoints += 1.5;
                } else {
                    totalPoints += 1.0;
                }
            }
        });
        return totalPoints;
    } else {
        const count = parsed.count;
        if (dk === 'd1') return count * pointsPerQuestion;
        if (dk === 'd2' || dk === 'd3' || dk === 'd4') return count * 1.0;
        if (dk === 'd5') {
            if (levelKey === 'nb') return count * 1.0;
            if (levelKey === 'th') return count * 1.0;
            if (levelKey === 'vd') return count * 2.0;
            return count * 1.5;
        }
        return count * 1.0;
    }
};

const calculateMatrixTotals = (matrix: any[], pointsPerQuestion: number = 0.25) => {
    const totals = {
        d1: { nb: 0, th: 0, vd: 0, points: 0 },
        d2: { nb: 0, th: 0, vd: 0, points: 0 },
        d3: { nb: 0, th: 0, vd: 0, points: 0 },
        d4: { nb: 0, th: 0, vd: 0, points: 0 },
        d5: { nb: 0, th: 0, vd: 0, points: 0 },
        sumNb: 0, sumTh: 0, sumVd: 0,
        sumNbPoints: 0, sumThPoints: 0, sumVdPoints: 0,
        totalQuestions: 0,
        totalPoints: 0
    };

    matrix.forEach(row => {
        ['d1', 'd2', 'd3', 'd4', 'd5'].forEach((dk) => {
            const level = row.levels[dk];
            if (!level) return;
            const nbCell = parseMatrixCell(level.nb);
            const thCell = parseMatrixCell(level.th);
            const vdCell = parseMatrixCell(level.vd);
            
            const nbPoints = getMatrixCellPoints(dk, 'nb', level.nb, pointsPerQuestion);
            const thPoints = getMatrixCellPoints(dk, 'th', level.th, pointsPerQuestion);
            const vdPoints = getMatrixCellPoints(dk, 'vd', level.vd, pointsPerQuestion);
            
            const subTotalPoints = nbPoints + thPoints + vdPoints;
            
            totals[dk as keyof typeof totals as any].nb += nbCell.count;
            totals[dk as keyof typeof totals as any].th += thCell.count;
            totals[dk as keyof typeof totals as any].vd += vdCell.count;
            totals[dk as keyof typeof totals as any].points += subTotalPoints;
            
            totals.sumNb += nbCell.count;
            totals.sumTh += thCell.count;
            totals.sumVd += vdCell.count;
            
            totals.sumNbPoints += nbPoints;
            totals.sumThPoints += thPoints;
            totals.sumVdPoints += vdPoints;
            
            totals.totalQuestions += (nbCell.count + thCell.count + vdCell.count);
            totals.totalPoints += subTotalPoints;
        });
    });

    return totals;
};

// Parser cho [scratch_img:w:h]base64[/scratch_img]
function parseTextWithImages(text: string, options: any = {}) {
    if (!text) return [createRun("", options)];
    const regex = /\[scratch_img:(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)\](.*?)\[\/scratch_img\]/g;
    let match;
    let lastIndex = 0;
    const runs: any[] = [];

    const addText = (str: string) => {
        const parts = str.split('\n');
        for(let i=0; i<parts.length; i++) {
            if (i > 0) runs.push(createRun("", { break: 1 }));
            if (parts[i]) runs.push(createRun(parts[i], options));
        }
    };

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            addText(text.substring(lastIndex, match.index));
        }
        const width = parseFloat(match[1]);
        const height = parseFloat(match[2]);
        const base64 = match[3];
        runs.push(new ImageRun({
            data: Buffer.from(base64, 'base64'),
            transformation: { width: width, height: height }
        }));
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) addText(text.substring(lastIndex));
    return runs.length ? runs : [createRun("", options)];
}

function parseHtmlElements(htmlText: string, defaultOptions: any = {}, pOptions: any = {}): any[] {
    if (!htmlText) return [];
    // Convert newlines out of html tags so parseTextWithImages catches them, 
    // but cheerio might ignore raw text newlines.
    const $ = cheerio.load(htmlText, null, false);
    const elements: any[] = [];
    
    function extractRuns(node: any, options: any): any[] {
        const runs: any[] = [];
        if (node.type === 'text') {
            runs.push(...parseTextWithImages(node.data, options));
        } else if (node.type === 'tag') {
            const tag = node.name.toLowerCase();
            const newOpts = { ...options };
            if (tag === 'b' || tag === 'strong') newOpts.bold = true;
            if (tag === 'i' || tag === 'em') newOpts.italic = true;
            if (tag === 'u') newOpts.underline = true;
            if (tag === 'br') runs.push(createRun("", { break: 1, ...options }));
            
            // support latex if it's the span output by our rich text editor
            if (tag === 'span' && node.attribs['data-latex']) {
               const latex = node.attribs['data-latex'];
               runs.push(createRun(latex, { ...newOpts, italic: true }));
               return runs;
            }

            if (tag === 'img' && node.attribs.src) {
                if (node.attribs.src.startsWith('data:image')) {
                    const base64 = node.attribs.src.split(',')[1];
                    runs.push(new ImageRun({
                        data: Buffer.from(base64, 'base64'),
                        transformation: { width: 300, height: 200 }
                    }));
                }
            } else {
                node.children?.forEach((child: any) => {
                    runs.push(...extractRuns(child, newOpts));
                });
            }
        }
        return runs;
    }

    let currentRuns: any[] = [];
    function flushParagraph() {
        if (currentRuns.length > 0) {
            elements.push(createParagraph(currentRuns, pOptions));
            currentRuns = [];
        }
    }

    $('body').contents().each((_, el) => {
        if (el.type === 'tag' && el.name.toLowerCase() === 'table') {
            flushParagraph();
            const rows: any[] = [];
            $(el).find('tr').each((_, trEl) => {
                const cells: any[] = [];
                $(trEl).find('td, th').each((_, tdEl) => {
                    const cellRuns = extractRuns(tdEl, defaultOptions);
                    cells.push(new TableCell({
                        children: cellRuns.length > 0 ? [createParagraph(cellRuns)] : [createParagraph([createRun("")])]
                    }));
                });
                rows.push(new TableRow({ children: cells }));
            });
            elements.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: getStandardBorders(),
                rows: rows
            }));
        } else if (el.type === 'tag' && (el.name.toLowerCase() === 'p' || el.name.toLowerCase() === 'div')) {
            flushParagraph();
            const blockRuns = extractRuns(el, defaultOptions);
            if (blockRuns.length > 0) elements.push(createParagraph(blockRuns, pOptions));
        } else if (el.type === 'tag' && (el.name.toLowerCase() === 'ul' || el.name.toLowerCase() === 'ol')) {
            flushParagraph();
            $(el).find('li').each((idx, liEl) => {
                const liRuns = extractRuns(liEl, defaultOptions);
                elements.push(createParagraph([createRun(`- `), ...liRuns], pOptions));
            });
        } else {
            currentRuns.push(...extractRuns(el, defaultOptions));
        }
    });
    flushParagraph();

    return elements.length > 0 ? elements : [createParagraph([createRun("")], pOptions)];
}

export async function generateWordDocx(jsonData: any, outputPath: string) {
    const children: any[] = [];

    // ====== 1. HEADER (Bảng ẩn viền) ======
    if (jsonData.headerConfig) {
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            children: [
                                createParagraph([createRun(jsonData.headerConfig.school || "TRƯỜNG THCS ...", { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 60 }),
                                createParagraph([createRun(`Lớp: ${jsonData.headerConfig.class || "9..."}`)], { alignment: AlignmentType.CENTER, spacingAfter: 60 }),
                                createParagraph([createRun(`Họ và tên: ...............................`)], { alignment: AlignmentType.CENTER, spacingAfter: 60 })
                            ]
                        }),
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            children: [
                                createParagraph([createRun(jsonData.headerConfig.examTitle || "BÀI KIỂM TRA", { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 60 }),
                                createParagraph([createRun(`MÔN: ${jsonData.headerConfig.subject || "TIN HỌC"}`)], { alignment: AlignmentType.CENTER, spacingAfter: 60 }),
                                createParagraph([createRun(`${jsonData.headerConfig.time || "Thời gian làm bài: 45 Phút"}`, { italic: true })], { alignment: AlignmentType.CENTER, spacingAfter: 60 })
                            ]
                        })
                    ]
                })
            ]
        }));
    }

    children.push(createParagraph([createRun("")], { spacingAfter: 200 }));

    // ====== 2. BẢNG ĐIỂM / LỜI PHÊ ======
    if (jsonData.settings && jsonData.settings.includeScoreTable) {
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: getStandardBorders(),
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ 
                            width: { size: 25, type: WidthType.PERCENTAGE }, 
                            children: [
                                createParagraph([createRun("Điểm", { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 60 }), 
                                createParagraph([createRun("")], { spacingAfter: 600 })
                            ] 
                        }),
                        new TableCell({ 
                            width: { size: 75, type: WidthType.PERCENTAGE }, 
                            children: [createParagraph([createRun("Lời nhận xét của thầy (cô) giáo:")])] 
                        })
                    ]
                })
            ]
        }));
        children.push(createParagraph([createRun("")], { spacingAfter: 200 }));
    }

    children.push(createParagraph([createRun("ĐỀ BÀI", { bold: true, underline: true })], { alignment: AlignmentType.CENTER, spacingAfter: 300 }));

    // Lặp qua các phần (Multiple Choice, True/False, Matching, Essay)
    if (jsonData.sections) {
        jsonData.sections.forEach((sec: any) => {
            children.push(createParagraph([createRun(sec.title, { bold: true })], { spacingAfter: 120 }));
            if (sec.description) children.push(createParagraph([createRun(sec.description, { italic: true })], { spacingAfter: 120 }));

            // --- Lặp câu hỏi ---
            if (sec.questions) {
                sec.questions.forEach((q: any, qIdx: number) => {
                    children.push(...parseHtmlElements(`<b>Câu ${qIdx + 1}:</b> ` + (q.question || q.text), {}, { alignment: AlignmentType.JUSTIFIED, spacingAfter: 120 }));

                    if (sec.type === 'multiple_choice' && q.options) {
                        const prefixes = ['A', 'B', 'C', 'D', 'E', 'F'];
                        const isShort = q.options.join(' ').length < 60;
                        if (isShort && q.options.length === 4) {
                            let combinedHtml = "";
                            q.options.forEach((opt: string, i: number) => {
                                combinedHtml += `<b>${prefixes[i]}.</b> ${opt} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `;
                            });
                            children.push(...parseHtmlElements(combinedHtml, {}, { alignment: AlignmentType.JUSTIFIED }));
                        } else {
                            q.options.forEach((opt: string, i: number) => {
                                children.push(...parseHtmlElements(`<b>${prefixes[i]}.</b> ${opt}`, {}, { alignment: AlignmentType.JUSTIFIED }));
                            });
                        }
                    } else if (sec.type === 'true_false' && q.statements) {
                        q.statements.forEach((st: any, i: number) => {
                            children.push(...parseHtmlElements(`<b>${String.fromCharCode(97+i)}.</b> ` + st.text, {}, { alignment: AlignmentType.JUSTIFIED, indentLeft: 0.3 }));
                        });
                    }
                    // Các phần khác (Essay, Fill-in) tự động sinh dòng kẻ nếu cần...
                });
            }
        });
    }
    
    // ====== MA TRẬN (Trang mới) ======
    if (jsonData.settings && jsonData.settings.includeMatrix && jsonData.settings.matrix) {
        children.push(createParagraph([], { break: 1 }));
        children.push(createParagraph([createRun("MA TRẬN ĐỀ THI CUỐI KỲ II", { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 120 }));
        children.push(createParagraph([createRun(`Môn: ${jsonData.headerConfig?.subject || "TIN HỌC"}`, { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 300 }));

        const matrix = jsonData.settings.matrix;
        const matrixRows: any[] = [];

        // --- Header Row 1 ---
        matrixRows.push(new TableRow({
            children: [
                new TableCell({ children: [createParagraph([createRun("TT", { bold: true })])], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
                new TableCell({ children: [createParagraph([createRun("Chủ đề", { bold: true })])], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
                new TableCell({ children: [createParagraph([createRun("Nội dung/Đơn vị kiến thức", { bold: true })])], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
                new TableCell({ children: [createParagraph([createRun("Mức độ nhận thức", { bold: true })])], columnSpan: 15, verticalAlign: VerticalAlign.CENTER }),
                new TableCell({ children: [createParagraph([createRun("Tổng", { bold: true })])], columnSpan: 3, rowSpan: 2, verticalAlign: VerticalAlign.CENTER }),
                new TableCell({ children: [createParagraph([createRun("Tỉ lệ % điểm", { bold: true })])], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
            ]
        }));

        // --- Header Row 2 ---
        matrixRows.push(new TableRow({
            children: [
                new TableCell({ children: [createParagraph([createRun("Dạng I (T.Nghiệm)", { bold: true })])], columnSpan: 3 }),
                new TableCell({ children: [createParagraph([createRun("Dạng II (Đ/Sai)", { bold: true })])], columnSpan: 3 }),
                new TableCell({ children: [createParagraph([createRun("Dạng III (Ghép)", { bold: true })])], columnSpan: 3 }),
                new TableCell({ children: [createParagraph([createRun("Dạng IV (Điền)", { bold: true })])], columnSpan: 3 }),
                new TableCell({ children: [createParagraph([createRun("Dạng V (T.Luận)", { bold: true })])], columnSpan: 3 }),
            ]
        }));

        // --- Header Row 3 ---
        const levelSubHeaders: any[] = [];
        for(let i=0; i<6; i++) {
            levelSubHeaders.push(new TableCell({ children: [createParagraph([createRun("Biết", { size: 18 })])] }));
            levelSubHeaders.push(new TableCell({ children: [createParagraph([createRun("Hiểu", { size: 18 })])] }));
            levelSubHeaders.push(new TableCell({ children: [createParagraph([createRun("VD", { size: 18 })])] }));
        }
        matrixRows.push(new TableRow({ children: levelSubHeaders }));

        // --- Data Rows ---
        const pointsPerQuestion = jsonData.settings?.pointsPerQuestion || 0.25;
        const dTotals = calculateMatrixTotals(matrix, pointsPerQuestion);

        matrix.forEach((row: any) => {
            const cells: any[] = [
                new TableCell({ children: [createParagraph([createRun(row.tt || "")])] }),
                new TableCell({ children: [createParagraph([createRun(row.topic || "")])] }),
                new TableCell({ children: [createParagraph([createRun(row.knowledgeUnit || "")])] }),
            ];

            let rowCountNb = 0, rowCountTh = 0, rowCountVd = 0;
            let rowPoints = 0;

            ['d1', 'd2', 'd3', 'd4', 'd5'].forEach(dk => {
                const nbCell = parseMatrixCell(row.levels[dk]?.nb);
                const thCell = parseMatrixCell(row.levels[dk]?.th);
                const vdCell = parseMatrixCell(row.levels[dk]?.vd);

                cells.push(new TableCell({ children: [createParagraph([createRun(nbCell.text || "")])] }));
                cells.push(new TableCell({ children: [createParagraph([createRun(thCell.text || "")])] }));
                cells.push(new TableCell({ children: [createParagraph([createRun(vdCell.text || "")])] }));

                rowCountNb += nbCell.count;
                rowCountTh += thCell.count;
                rowCountVd += vdCell.count;

                rowPoints += getMatrixCellPoints(dk, 'nb', row.levels[dk]?.nb, pointsPerQuestion);
                rowPoints += getMatrixCellPoints(dk, 'th', row.levels[dk]?.th, pointsPerQuestion);
                rowPoints += getMatrixCellPoints(dk, 'vd', row.levels[dk]?.vd, pointsPerQuestion);
            });

            cells.push(new TableCell({ children: [createParagraph([createRun(rowCountNb > 0 ? rowCountNb.toString() : "", { bold: true })])] }));
            cells.push(new TableCell({ children: [createParagraph([createRun(rowCountTh > 0 ? rowCountTh.toString() : "", { bold: true })])] }));
            cells.push(new TableCell({ children: [createParagraph([createRun(rowCountVd > 0 ? rowCountVd.toString() : "", { bold: true })])] }));
            
            cells.push(new TableCell({ children: [createParagraph([createRun(rowPoints.toFixed(2).replace(/\.00$/, ''), { bold: true })])] }));

            matrixRows.push(new TableRow({ children: cells }));
        });

        // --- Footer Rows ---
        // 1. Tổng số câu hỏi
        const qCountFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tổng số câu hỏi", { bold: true })])], columnSpan: 3 })];
        ['d1', 'd2', 'd3', 'd4', 'd5'].forEach(dk => {
            qCountFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals[dk as keyof typeof dTotals as any].nb.toString())])] }));
            qCountFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals[dk as keyof typeof dTotals as any].th.toString())])] }));
            qCountFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals[dk as keyof typeof dTotals as any].vd.toString())])] }));
        });
        qCountFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumNb.toString(), { bold: true })])] }));
        qCountFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumTh.toString(), { bold: true })])] }));
        qCountFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumVd.toString(), { bold: true })])] }));
        qCountFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.totalQuestions.toString(), { bold: true })])] }));
        matrixRows.push(new TableRow({ children: qCountFooter }));

        // 1b. Tổng cộng theo dạng
        const typeFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tổng cộng theo dạng (Số câu / Điểm)", { bold: true })])], columnSpan: 3 })];
        ['d1', 'd2', 'd3', 'd4', 'd5'].forEach(dk => {
            const dCount = dTotals[dk as keyof typeof dTotals as any].nb + dTotals[dk as keyof typeof dTotals as any].th + dTotals[dk as keyof typeof dTotals as any].vd;
            const dPoints = dTotals[dk as keyof typeof dTotals as any].points;
            typeFooter.push(new TableCell({ 
                children: [createParagraph([createRun(`${dCount} câu / ${dPoints.toFixed(1)}đ`, { bold: true })])], 
                columnSpan: 3 
            }));
        });
        typeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.sumNb} câu (${dTotals.sumNbPoints.toFixed(1)}đ)`, { bold: true })])] }));
        typeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.sumTh} câu (${dTotals.sumThPoints.toFixed(1)}đ)`, { bold: true })])] }));
        typeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.sumVd} câu (${dTotals.sumVdPoints.toFixed(1)}đ)`, { bold: true })])] }));
        typeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.totalQuestions} câu (${dTotals.totalPoints.toFixed(1)}đ)`, { bold: true })])] }));
        matrixRows.push(new TableRow({ children: typeFooter }));
        
        // 2. Tổng điểm
        const pointsFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tổng điểm", { bold: true })])], columnSpan: 3 })];
        ['d1', 'd2', 'd3', 'd4', 'd5'].forEach(dk => {
            const dkNbPoints = matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'nb', r.levels[dk]?.nb, pointsPerQuestion), 0);
            const dkThPoints = matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'th', r.levels[dk]?.th, pointsPerQuestion), 0);
            const dkVdPoints = matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'vd', r.levels[dk]?.vd, pointsPerQuestion), 0);
            pointsFooter.push(new TableCell({ children: [createParagraph([createRun(dkNbPoints > 0 ? dkNbPoints.toFixed(1) : "0")])] }));
            pointsFooter.push(new TableCell({ children: [createParagraph([createRun(dkThPoints > 0 ? dkThPoints.toFixed(1) : "0")])] }));
            pointsFooter.push(new TableCell({ children: [createParagraph([createRun(dkVdPoints > 0 ? dkVdPoints.toFixed(1) : "0")])] }));
        });
        pointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumNbPoints.toFixed(1), { bold: true })])] }));
        pointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumThPoints.toFixed(1), { bold: true })])] }));
        pointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumVdPoints.toFixed(1), { bold: true })])] }));
        pointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.totalPoints.toFixed(1), { bold: true })])] }));
        matrixRows.push(new TableRow({ children: pointsFooter }));

        // 3. Tỉ lệ %
        const percentFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tỉ lệ %", { bold: true })])], columnSpan: 3 })];
        ['d1', 'd2', 'd3', 'd4', 'd5'].forEach(dk => {
            const dTotal = dTotals[dk as keyof typeof dTotals as any].points;
            const percentage = (dTotal / dTotals.totalPoints) * 100;
            percentFooter.push(new TableCell({ children: [createParagraph([createRun(isNaN(percentage) || percentage === 0 ? "0%" : percentage.toFixed(0) + "%")])], columnSpan: 3 }));
        });
        const pctNb = (dTotals.sumNbPoints / dTotals.totalPoints) * 100;
        const pctTh = (dTotals.sumThPoints / dTotals.totalPoints) * 100;
        const pctVd = (dTotals.sumVdPoints / dTotals.totalPoints) * 100;
        percentFooter.push(new TableCell({ children: [createParagraph([createRun((isNaN(pctNb) ? 0 : pctNb).toFixed(0) + "%", { bold: true })])] }));
        percentFooter.push(new TableCell({ children: [createParagraph([createRun((isNaN(pctTh) ? 0 : pctTh).toFixed(0) + "%", { bold: true })])] }));
        percentFooter.push(new TableCell({ children: [createParagraph([createRun((isNaN(pctVd) ? 0 : pctVd).toFixed(0) + "%", { bold: true })])] }));
        percentFooter.push(new TableCell({ children: [createParagraph([createRun("100%", { bold: true })])] }));
        matrixRows.push(new TableRow({ children: percentFooter }));

        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: getStandardBorders(),
            rows: matrixRows
        }));

        // ====== ĐẶC TẢ MA TRẬN ======
        children.push(createParagraph([], { break: 1 }));
        children.push(createParagraph([createRun("ĐẶC TẢ MA TRẬN ĐỀ THI", { bold: true })], { alignment: AlignmentType.CENTER, spacingAfter: 300 }));

        const specRows: any[] = [];
        // Header
        specRows.push(new TableRow({
            children: [
                new TableCell({ children: [createParagraph([createRun("TT", { bold: true })])], rowSpan: 2 }),
                new TableCell({ children: [createParagraph([createRun("Chủ đề", { bold: true })])], rowSpan: 2 }),
                new TableCell({ children: [createParagraph([createRun("Nội dung", { bold: true })])], rowSpan: 2 }),
                new TableCell({ children: [createParagraph([createRun("Mức độ kiểm tra", { bold: true })])], rowSpan: 2 }),
                new TableCell({ children: [createParagraph([createRun("Số câu hỏi theo mức độ", { bold: true })])], columnSpan: 15 }),
                new TableCell({ children: [createParagraph([createRun("Tổng số câu", { bold: true })])], columnSpan: 3, rowSpan: 2 }),
                new TableCell({ children: [createParagraph([createRun("Tỉ lệ % điểm", { bold: true })])], rowSpan: 2 }),
            ]
        }));
        const specSubHeaders: any[] = [];
        ['Dạng I', 'Dạng II', 'Dạng III', 'Dạng IV', 'Dạng V', 'Tổng'].forEach(d => {
            specSubHeaders.push(new TableCell({ children: [createParagraph([createRun("B", { size: 16 })])] }));
            specSubHeaders.push(new TableCell({ children: [createParagraph([createRun("H", { size: 16 })])] }));
            specSubHeaders.push(new TableCell({ children: [createParagraph([createRun("V", { size: 16 })])] }));
        });
        specRows.push(new TableRow({ children: specSubHeaders }));

        matrix.forEach((row: any) => {
            const cells: any[] = [
                new TableCell({ children: [createParagraph([createRun(row.tt || "")])] }),
                new TableCell({ children: [createParagraph([createRun(row.topic || "")])] }),
                new TableCell({ children: [createParagraph([createRun(row.knowledgeUnit || "")])] }),
                new TableCell({ children: [createParagraph([createRun(row.assessmentLevel || "")])] }),
            ];
            let rowCountNb = 0, rowCountTh = 0, rowCountVd = 0;
            let rowPoints = 0;

            ['d1', 'd2', 'd3', 'd4', 'd5'].forEach(dk => {
                const nbCell = parseMatrixCell(row.levels[dk]?.nb);
                const thCell = parseMatrixCell(row.levels[dk]?.th);
                const vdCell = parseMatrixCell(row.levels[dk]?.vd);

                cells.push(new TableCell({ children: [createParagraph([createRun(nbCell.text || "")])] }));
                cells.push(new TableCell({ children: [createParagraph([createRun(thCell.text || "")])] }));
                cells.push(new TableCell({ children: [createParagraph([createRun(vdCell.text || "")])] }));

                rowCountNb += nbCell.count;
                rowCountTh += thCell.count;
                rowCountVd += vdCell.count;

                rowPoints += getMatrixCellPoints(dk, 'nb', row.levels[dk]?.nb, pointsPerQuestion);
                rowPoints += getMatrixCellPoints(dk, 'th', row.levels[dk]?.th, pointsPerQuestion);
                rowPoints += getMatrixCellPoints(dk, 'vd', row.levels[dk]?.vd, pointsPerQuestion);
            });
            
            cells.push(new TableCell({ children: [createParagraph([createRun(rowCountNb > 0 ? rowCountNb.toString() : "", { bold: true })])] }));
            cells.push(new TableCell({ children: [createParagraph([createRun(rowCountTh > 0 ? rowCountTh.toString() : "", { bold: true })])] }));
            cells.push(new TableCell({ children: [createParagraph([createRun(rowCountVd > 0 ? rowCountVd.toString() : "", { bold: true })])] }));
            
            cells.push(new TableCell({ children: [createParagraph([createRun(rowPoints.toFixed(2).replace(/\.00$/, ''), { bold: true })])] }));

            specRows.push(new TableRow({ children: cells }));
        });

        // Footer for Spec: Tổng điểm, Tổng cộng theo dạng & Tỉ lệ
        const specQFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tổng số câu hỏi", { bold: true })])], columnSpan: 4 })];
        const specPointsFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tổng điểm", { bold: true })])], columnSpan: 4 })];
        const specTypeFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tổng cộng theo dạng (Số câu / Điểm)", { bold: true })])], columnSpan: 4 })];
        const specPercentFooter: any[] = [new TableCell({ children: [createParagraph([createRun("Tỉ lệ %", { bold: true })])], columnSpan: 4 })];
        
        ['d1', 'd2', 'd3', 'd4', 'd5'].forEach(dk => {
            const sumNb = matrix.reduce((s: number, r: any) => s + parseMatrixCell(r.levels[dk]?.nb).count, 0);
            const sumTh = matrix.reduce((s: number, r: any) => s + parseMatrixCell(r.levels[dk]?.th).count, 0);
            const sumVd = matrix.reduce((s: number, r: any) => s + parseMatrixCell(r.levels[dk]?.vd).count, 0);

            // Q Count
            specQFooter.push(new TableCell({ children: [createParagraph([createRun(sumNb.toString())])] }));
            specQFooter.push(new TableCell({ children: [createParagraph([createRun(sumTh.toString())])] }));
            specQFooter.push(new TableCell({ children: [createParagraph([createRun(sumVd.toString())])] }));

            // Points
            const dkNbPoints = matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'nb', r.levels[dk]?.nb, pointsPerQuestion), 0);
            const dkThPoints = matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'th', r.levels[dk]?.th, pointsPerQuestion), 0);
            const dkVdPoints = matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'vd', r.levels[dk]?.vd, pointsPerQuestion), 0);
            
            specPointsFooter.push(new TableCell({ children: [createParagraph([createRun(dkNbPoints > 0 ? dkNbPoints.toFixed(1) : "0")])] }));
            specPointsFooter.push(new TableCell({ children: [createParagraph([createRun(dkThPoints > 0 ? dkThPoints.toFixed(1) : "0")])] }));
            specPointsFooter.push(new TableCell({ children: [createParagraph([createRun(dkVdPoints > 0 ? dkVdPoints.toFixed(1) : "0")])] }));

            // Type Footer
            const dCount = sumNb + sumTh + sumVd;
            const dPoints = dTotals[dk as keyof typeof dTotals as any].points;
            specTypeFooter.push(new TableCell({ 
                children: [createParagraph([createRun(`${dCount} câu / ${dPoints.toFixed(1)}đ`, { bold: true })])], 
                columnSpan: 3 
            }));

            // Percent
            const percentage = (dPoints / dTotals.totalPoints) * 100;
            specPercentFooter.push(new TableCell({ children: [createParagraph([createRun(isNaN(percentage) || percentage === 0 ? "0%" : percentage.toFixed(0) + "%")])], columnSpan: 3 }));
        });

        // 3 cột dọc tổng của footer spec
        specQFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumNb.toString(), { bold: true })])] }));
        specQFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumTh.toString(), { bold: true })])] }));
        specQFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumVd.toString(), { bold: true })])] }));
        specQFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.totalQuestions.toString(), { bold: true })])] }));

        specPointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumNbPoints.toFixed(1), { bold: true })])] }));
        specPointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumThPoints.toFixed(1), { bold: true })])] }));
        specPointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.sumVdPoints.toFixed(1), { bold: true })])] }));
        specPointsFooter.push(new TableCell({ children: [createParagraph([createRun(dTotals.totalPoints.toFixed(1), { bold: true })])] }));

        specTypeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.sumNb} câu (${dTotals.sumNbPoints.toFixed(1)}đ)`, { bold: true })])] }));
        specTypeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.sumTh} câu (${dTotals.sumThPoints.toFixed(1)}đ)`, { bold: true })])] }));
        specTypeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.sumVd} câu (${dTotals.sumVdPoints.toFixed(1)}đ)`, { bold: true })])] }));
        specTypeFooter.push(new TableCell({ children: [createParagraph([createRun(`${dTotals.totalQuestions} câu (${dTotals.totalPoints.toFixed(1)}đ)`, { bold: true })])] }));

        const specPctNb = (dTotals.sumNbPoints / dTotals.totalPoints) * 100;
        const specPctTh = (dTotals.sumThPoints / dTotals.totalPoints) * 100;
        const specPctVd = (dTotals.sumVdPoints / dTotals.totalPoints) * 100;
        specPercentFooter.push(new TableCell({ children: [createParagraph([createRun((isNaN(specPctNb) ? 0 : specPctNb).toFixed(0) + "%", { bold: true })])] }));
        specPercentFooter.push(new TableCell({ children: [createParagraph([createRun((isNaN(specPctTh) ? 0 : specPctTh).toFixed(0) + "%", { bold: true })])] }));
        specPercentFooter.push(new TableCell({ children: [createParagraph([createRun((isNaN(specPctVd) ? 0 : specPctVd).toFixed(0) + "%", { bold: true })])] }));
        specPercentFooter.push(new TableCell({ children: [createParagraph([createRun("100%", { bold: true })])] }));

        specRows.push(new TableRow({ children: specQFooter }));
        specRows.push(new TableRow({ children: specPointsFooter }));
        specRows.push(new TableRow({ children: specTypeFooter }));
        specRows.push(new TableRow({ children: specPercentFooter }));

        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: getStandardBorders(),
            rows: specRows
        }));
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size: {
                        width: 11906, // 210mm
                        height: 16838 // 297mm
                    },
                    margin: {
                        top: 1134,    // 20mm
                        bottom: 1134, // 20mm
                        left: 1134,   // 20mm
                        right: 850    // 15mm
                    }
                }
            },
            children: children
        }]
    });

    const docBuffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, docBuffer);
}