import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Tối ưu Sidebar Right width ở Step 4
content = content.replace(/lg:w-\[480px\]/g, 'lg:w-[320px] 2xl:w-[380px]');

// 2. Chuyển đổi mã màu sang tone UI Giáo dục
// Đổi màu bg-slate-900, bg-indigo-600 sang ocean-blue & sky-blue thân thiện hơn.
content = content.replace(/bg-indigo-600/g, 'bg-blue-600');
content = content.replace(/text-indigo-600/g, 'text-blue-600');
content = content.replace(/border-indigo-600/g, 'border-blue-600');
content = content.replace(/shadow-indigo-600/g, 'shadow-blue-600');
content = content.replace(/bg-indigo-50/g, 'bg-sky-50');
content = content.replace(/text-indigo-700/g, 'text-blue-700');
content = content.replace(/border-indigo-100/g, 'border-blue-100');
content = content.replace(/bg-slate-900/g, 'bg-slate-800'); // Tránh đen quá đặc ở môi trường GD

// Xử lý nút Dropdown thay vì Button bình thường ở Step 4 (Tìm vùng nút xuất file để thay)
const exportCardRegex = /{[\s\S]*?\/\*\s*Final Export Card\s*\*\/[\s\S]*?Xuất file \.DOCX ngay\n\s*<\/button>\n\s*<\/div>\n\s*<\/div>/;

const dropdownReplacement = `{/* Final Export Card - Dropdown style */}
                             <div className="p-6 bg-slate-800 rounded-[2rem] text-white shadow-xl relative overflow-visible group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700"></div>
                                <div className="relative z-10">
                                   <div className="flex items-center gap-4 mb-4">
                                      <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md"><Download className="w-4 h-4 text-sky-300"/></div>
                                      <div>
                                         <span className="font-serif font-bold text-base block leading-none mb-1">Xuất bản Đề thi</span>
                                      </div>
                                   </div>
                                   
                                   <div className="relative group/dropdown">
                                     <button 
                                       className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs hover:bg-blue-500 transition-all flex items-center justify-between px-5 shadow-[0_10px_20px_rgba(37,99,235,0.2)] active:scale-95 disabled:opacity-50"
                                     >
                                       <div className="flex items-center gap-2">
                                          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                                          <span>Tải xuống...</span>
                                       </div>
                                       <ChevronDown className="w-4 h-4 opacity-70 group-hover/dropdown:rotate-180 transition-transform"/>
                                     </button>
                                     
                                     {/* Dropdown Menu */}
                                     <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-100 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all translate-y-2 group-hover/dropdown:translate-y-0 z-50 overflow-hidden">
                                        <button onClick={generateWordDoc} disabled={loading} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 group/btn transition-colors">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover/btn:scale-110 transition-transform"><FileText className="w-4 h-4"/></div>
                                            <div>
                                              <p className="text-sm font-bold text-slate-800">Microsoft Word (.docx)</p>
                                              <p className="text-[10px] text-slate-500 font-medium">Chuẩn in ấn 2026</p>
                                            </div>
                                        </button>
                                        <button onClick={() => {
                                          const blob = new Blob([JSON.stringify(examData, null, 2)], { type: "application/json" });
                                          saveAs(blob, "data-backup.json");
                                        }} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-3 group/btn transition-colors">
                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover/btn:scale-110 transition-transform"><Database className="w-4 h-4"/></div>
                                            <div>
                                              <p className="text-sm font-bold text-slate-800">Dữ liệu thô (.json)</p>
                                              <p className="text-[10px] text-slate-500 font-medium">Lưu trữ máy chủ</p>
                                            </div>
                                        </button>
                                     </div>
                                   </div>
                                </div>
                             </div>`;

content = content.replace(exportCardRegex, dropdownReplacement);

// 3. Xử lý "che lấp" chiều ngang bảng Ma trận.
// Đảm bảo Table container có `overflow-x-auto w-full block` để cuộn ngang trên màn nhỏ, không dồn nén text. 
content = content.replace(/<div className="overflow-x-auto">/g, '<div className="overflow-x-auto w-full custom-scrollbar pb-2">');

// Đảm bảo imports icon có ChevronDown nếu thiếu:
if(!content.includes("ChevronDown")) {
    content = content.replace(/import {([^}]+)} from 'lucide-react';/, "import { $1, ChevronDown } from 'lucide-react';");
}

fs.writeFileSync(file, content, 'utf8');
console.log('UI Overhaul completed successfully.');
