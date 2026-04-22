import fs from 'fs';
const path = 'app/applet/src/App.tsx';
if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf-8');

    // Ép các Card câu hỏi trắc nghiệm chia cột đều 50%
    const qCardRegex = /grid-cols-1 md:grid-cols-2/g;
    content = content.replace(qCardRegex, 'grid-cols-2');

    // Xóa màu sắc không cần thiết, đưa về đen trắng chuẩn in ấn
    content = content.replace(/bg-emerald-50/g, 'bg-white');
    content = content.replace(/text-emerald-700/g, 'text-black font-bold');

    fs.writeFileSync(path, content);
    console.log('✅ Giao diện: Đã chuyển sang chế độ đen trắng chuẩn in ấn!');
}