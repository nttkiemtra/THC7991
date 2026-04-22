// Tìm và cập nhật hàm createRun
const createRun = (text: string, options: { bold?: boolean, italic?: boolean, underline?: boolean } = {}) => {
    return new TextRun({
        text: text,
        font: 'Times New Roman',
        size: 28, // 14pt
        sizeComplexScript: 28, // Ép 14pt cho cả font hệ thống
        bold: options.bold,
        italics: options.italic,
        underline: options.underline ? { type: "single" } : undefined
    });
};

// Tìm và cập nhật hàm createParagraph (Ép Justify triệt để)
const createParagraph = (runs: any[], options: { alignment?: any, justify?: boolean, indentLeft?: number, spacingAfter?: number } = {}) => {
    return new Paragraph({
        children: runs,
        alignment: options.alignment || AlignmentType.JUSTIFY, // Mặc định luôn là JUSTIFY
        indent: options.indentLeft ? { left: convertInchesToTwip(options.indentLeft) } : undefined,
        spacing: {
            line: 240, // Single spacing
            after: options.spacingAfter !== undefined ? options.spacingAfter : 0, // Giảm spacing dư thừa
        }
    });
};

// TRONG HÀM generateWordDocx - CẬP NHẬT CÁC BẢNG:

// 1. Cập nhật bảng Đúng/Sai (RULE 3)
if (sec.type === 'true_false') {
    const tfTable = new Table({
        width: { size: 28, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({ 
                        width: { size: 28, type: WidthType.PERCENTAGE }, // Ép 70%
                        children: [createParagraph([createRun("Phát biểu", { bold: true })], { alignment: AlignmentType.JUSTIFY })] 
                    }),
                    new TableCell({ 
                        width: { size: 28, type: WidthType.PERCENTAGE }, // Ép 15%
                        children: [createParagraph([createRun("Đúng", { bold: true })], { alignment: AlignmentType.JUSTIFY })] 
                    }),
                    new TableCell({ 
                        width: { size: 28, type: WidthType.PERCENTAGE }, // Ép 15%
                        children: [createParagraph([createRun("Sai", { bold: true })], { alignment: AlignmentType.JUSTIFY })] 
                    }),
                ]
            }),
            ...statements.map((st: any, i: number) => (
                new TableRow({
                    children: [
                        new TableCell({ children: [createParagraph(parseTextToRuns(st.text), { justify: true })] }),
                        new TableCell({ children: [createParagraph([createRun("")])] }),
                        new TableCell({ children: [createParagraph([createRun("")])] }),
                    ]
                })
            ))
        ]
    });
    children.push(tfTable);
}

// 2. Ép lề chuẩn 2.0cm - 1.5cm (RULE 5)
const doc = new Document({
    sections: [{
        properties: {
            page: {
                margin: {
        top: 1134,
        bottom: 1134,
        left: 1134,
        right: 850,
    }
            }
        },
        children: children
    }]
});