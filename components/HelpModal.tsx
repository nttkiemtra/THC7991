
import React from 'react';
import { X, FileText, FileSpreadsheet, FileSignature, Upload, Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col animate-slide-up">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Hướng dẫn sử dụng</h2>
            <p className="text-sm text-slate-500">Quy trình tạo đề thi chuẩn 4 bước</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xl">1</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                Dữ liệu & Cấu trúc
              </h3>
              <ul className="space-y-2 text-slate-600 text-sm list-disc pl-5">
                <li>Tải lên file <em>Phân phối chương trình</em> (PDF, Word, Ảnh). AI sẽ tự động trích xuất các chương và bài học.</li>
                <li>Chọn các bài học sẽ có trong đề. Bạn có thể <strong>"Chọn câu hỏi chỉ định"</strong> từ Kho câu hỏi để AI ưu tiên đưa vào đề thi.</li>
                <li>Thiết lập số lượng câu hỏi cho từng dạng (Trắc nghiệm, Đúng/Sai, Ghép nối, Điền khuyết, Tự luận).</li>
              </ul>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xl">2</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Ma trận đề thi
              </h3>
              <ul className="space-y-2 text-slate-600 text-sm list-disc pl-5">
                <li>Hệ thống tự động phân bổ câu hỏi vào các cấp độ (Biết, Hiểu, Vận dụng) để đảm bảo tỉ lệ điểm chuẩn.</li>
                <li>Kiểm tra tổng điểm và bấm <strong>"Tùy chỉnh hiển thị"</strong> để thay đổi font chữ, lề in ấn.</li>
              </ul>
            </div>
          </div>

           {/* Step 3 */}
           <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold text-xl">3</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Bảng đặc tả
              </h3>
              <p className="text-sm text-slate-600">
                AI sẽ tự động soạn thảo các Yêu cầu cần đạt chi tiết cho từng câu hỏi dựa trên nội dung bài học đã chọn, đảm bảo tính khoa học và bám sát chương trình.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xl">4</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-blue-600" />
                Đề thi & Chỉnh sửa trực tiếp
              </h3>
              <ul className="space-y-2 text-slate-600 text-sm list-disc pl-5">
                <li>AI soạn nội dung câu hỏi và Đáp án chi tiết. Riêng Tin học hỗ trợ <strong>khối lệnh Scratch</strong> sinh động.</li>
                <li><strong>Chế độ sửa:</strong> Bấm "Chỉnh sửa" để thay đổi nội dung trực tiếp trên đề thi, "Chèn từ kho" để thêm câu hỏi lưu trữ hoặc "Lưu vào kho" để tái sử dụng câu hỏi AI vừa tạo.</li>
                <li><strong>Xuất file:</strong> Tải đề thi về định dạng Word (.docx), Excel hoặc file Zip đầy đủ.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
            <button 
                onClick={onClose}
                className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
            >
                Đã hiểu, bắt đầu ngay!
            </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
