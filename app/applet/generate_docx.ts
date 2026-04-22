// generate_docx.ts - Tối ưu hóa định dạng chuẩn sư phạm
import { AlignmentType, WidthType, convertInchesToTwip, BorderStyle } from 'docx';

// 1. Ép Font Times New Roman 14pt cho toàn bộ văn bản 
const createRun = (text: string, options: any = {}) => {
    return new TextRun({
        text: text,
        font: 'Times New Roman',
        size: 28, // 14pt = 28 half-points [cite: 7]
        bold: options.bold,
        italics: options.italic,
        underline: options.underline ? { type: "single" } : undefined
    });
};

// 2. Ép căn lề đều hai bên (Justify) cho mọi đoạn văn 
const createParagraph = (runs: any[], options: any = {}) => {
    return new Paragraph({
        children: runs,
        alignment: options.alignment || AlignmentType.JUSTIFY, // Ép Justify 
        spacing: {
            line: 240, 
            after: options.spacingAfter !== undefined ? options.spacingAfter : 120,
        }
    });
};

// 3. Cấu trúc lại lề trang chuẩn 2026 
// Lề trái 2.0cm (1134 twips), Phải 1.5cm (850 twips) 
const doc = new Document({
    sections: [{
        properties: {
            page: {
                margin: {
                    top: 1134,    // 2.0cm
                    bottom: 1134, // 2.0cm
                    left: 1134,   // 2.0cm (Có thể chỉnh lên 1700 nếu cần đóng tập 3cm) 
                    right: 850,    // 1.5cm 
                }
            }
        },
        children: children
    }]
});