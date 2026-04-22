// super_fix_app.mjs - Sử dụng Regex để sửa App.tsx an toàn
import fs from 'fs';
const path = 'app/applet/src/App.tsx';

if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf-8');

    // 1. Xóa bỏ logic cũ gây lỗi hiển thị chồng lấn [cite: 10]
    const garbageRegex = /<div className="flex-1 h-\[2px\] bg-slate-100 rounded-full">[\s\S]*?<\/div>/g;
    content = content.replace(garbageRegex, '');

    // 2. Chèn bảng đáp án chuẩn sư phạm ngay trên giao diện Preview [cite: 11, 14]
    const insertionPoint = /<div className="grid grid-cols-1 gap-8">/;
    const answerTableTemplate = `
    {sec.type === 'multiple_choice' && sec.questions?.length > 0 && (
        <div className="mb-6 p-2 border-2 border-black font-serif bg-white">
            <p className="italic text-sm mb-2">Em hãy chọn đáp án đúng nhất và điền vào bảng trả lời dưới đây:</p>
            <table className="w-full border-collapse border border-black text-center table-fixed">
                <tr className="border-b border-black">
                    <td className="border-r border-black font-bold bg-gray-100 w-16">Câu</td>
                    {sec.questions.map((_, i) => <td key={i} className="border-r border-black last:border-r-0">{i+1}</td>)}
                </tr>
                <tr className="h-8">
                    <td className="border-r border-black font-bold bg-gray-100">Chọn</td>
                    {sec.questions.map((_, i) => <td key={i} className="border-r border-black last:border-r-0"></td>)}
                </tr>
            </table>
        </div>
    )}
    <div className="grid grid-cols-1 gap-8">`;

    content = content.replace(insertionPoint, answerTableTemplate);
    fs.writeFileSync(path, content, 'utf-8');
}