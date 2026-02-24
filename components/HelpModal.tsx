
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
            <div className="flex-shrink-0 w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 font-bold text-xl">1</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4 text-teal-600" />
                Thiết lập & Dữ liệu đầu vào
              </h3>
              <ul className="space-y-2 text-slate-600 text-sm list-disc pl-5">
                <li>Nhập thông tin môn học, khối lớp, thời gian và loại bài kiểm tra.</li>
                <li><strong>Quan trọng:</strong> Tải lên file <em>Kế hoạch dạy học</em> hoặc <em>Phân phối chương trình</em> (PDF, Word, Ảnh). AI sẽ tự động đọc tên bài học và Yêu cầu cần đạt.</li>
                <li>Chọn các bài học sẽ có trong đề thi từ danh sách bên phải.</li>
                <li>Cấu hình số lượng câu hỏi cho từng dạng (Trắc nghiệm, Đúng/Sai, Tự luận...).</li>
              </ul>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xl">2</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Xây dựng Ma trận
              </h3>
              <p className="text-sm text-slate-600 mb-2">
                Hệ thống tự động phân phối câu hỏi vào các ô nhận thức (Biết, Hiểu, Vận dụng) dựa trên cấu hình của bạn.
              </p>
              <ul className="space-y-2 text-slate-600 text-sm list-disc pl-5">
                <li>Kiểm tra kỹ tổng điểm và tỉ lệ % các mức độ nhận thức.</li>
                <li>Nếu chưa ưng ý, bạn có thể bấm "Tạo lại" hoặc sửa trực tiếp trên giao diện.</li>
              </ul>
            </div>
          </div>

           {/* Step 3 */}
           <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold text-xl">3</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Bảng Đặc tả
              </h3>
              <p className="text-sm text-slate-600">
                AI sẽ ánh xạ từ Ma trận sang các Yêu cầu cần đạt cụ thể của từng bài học. Bước này là cầu nối quan trọng để ra câu hỏi chính xác.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-xl">4</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-emerald-600" />
                Đề thi chi tiết & Xuất file
              </h3>
              <ul className="space-y-2 text-slate-600 text-sm list-disc pl-5">
                <li>AI soạn thảo câu hỏi chi tiết và Đáp án/Hướng dẫn chấm.</li>
                <li>Hỗ trợ đặc biệt cho môn Tin học (vẽ khối lệnh Scratch chuẩn).</li>
                <li><strong>Xuất file:</strong> Bấm nút <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium"><Download className="w-3 h-3 mr-1"/> Xuất File Word</span> để tải về bản .doc chỉnh sửa được.</li>
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
