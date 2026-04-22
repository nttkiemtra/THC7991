import fs from 'fs';

const filePath = 'src/App.tsx'; // Đảm bảo đúng đường dẫn file của bạn
if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // 1. Thay vì xoá theo dòng 706-718, ta xoá theo nội dung đặc trưng (An toàn hơn)
    // Script này tìm đoạn div gây lỗi hiển thị và loại bỏ nó
    const patternToRemove = /<div className="flex-1 h-\[2px\] bg-slate-100 rounded-full">[\s\S]*?<\/div>\s+<\/div>/g;
    content = content.replace(patternToRemove, '');

    // 2. Chèn bảng đáp án Trắc nghiệm (Rule 2) chuẩn sư phạm [cite: 3]
    const insertionPoint = /<div className="grid grid-cols-1 gap-8">/;
    const answerTableTemplate = `
    {sec.type === 'multiple_choice' && (
        <div className="mb-6 p-4 border-2 border-black font-serif">
            <p className="italic mb-2">Em hãy chọn đáp án đúng nhất và điền vào bảng trả lời dưới đây:</p>
            <table className="w-full border-collapse border border-black text-center table-fixed">
                <tr className="border-b border-black bg-gray-100">
                    <td className="border-r border-black font-bold w-16">Câu</td>
                    {sec.questions.map((_, i) => <td key={i} className="border-r border-black last:border-r-0">{i+1}</td>)}
                </tr>
                <tr className="h-8">
                    <td className="border-r border-black font-bold">Chọn</td>
                    {sec.questions.map((_, i) => <td key={i} className="border-r border-black last:border-r-0"></td>)}
                </tr>
            </table>
        </div>
    )}
    <div className="grid grid-cols-1 gap-8">`;

    content = content.replace(insertionPoint, answerTableTemplate);

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('✅ Đã sửa App.tsx bằng Regex (Không lo lệch dòng!)');
}