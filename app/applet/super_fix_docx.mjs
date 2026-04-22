import fs from 'fs';

const docxPath = 'app/applet/generate_docx.ts'; 
if (fs.existsSync(docxPath)) {
    let content = fs.readFileSync(docxPath, 'utf8');

    // 1. Ép Font 14pt (28 half-points) 
    content = content.replace(/size: \d+/g, 'size: 28');

    // 2. Ép Căn lề đều hai bên (Justify) cho toàn bộ văn bản 
    content = content.replace(/alignment: AlignmentType\.\w+/g, 'alignment: AlignmentType.JUSTIFY');

    // 3. Cố định Margin chuẩn: Trái 2.0cm, Phải 1.5cm, Trên/Dưới 2.0cm 
    // 1134 twips = 2.0cm | 850 twips = 1.5cm
    content = content.replace(/margin: \{[\s\S]*?\}/, `margin: {
        top: 1134,
        bottom: 1134,
        left: 1134,
        right: 850,
    }`);

    fs.writeFileSync(docxPath, content);
    console.log('✅ Đã cấu trúc lại file Word: Font 14pt, Justify, Margin chuẩn.');
}