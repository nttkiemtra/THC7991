import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, FileText, Loader2, Save, FolderOpen, 
  LogIn, LogOut, Trash2, Plus, Sparkles, ChevronRight, 
  Layout, Settings, Database, Edit3, Eye, Printer, X, Check, ChevronLeft, Play, AlertCircle
} from 'lucide-react';
import { auth, loginWithGoogle, saveExamConfig, getExamConfigs, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import scratchblocks from 'scratchblocks';

const ScratchBlock = ({ code }: { code: string; key?: string | number }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
       containerRef.current.innerHTML = '';
       try {
           const parsed = scratchblocks.parse(code);
           const view = scratchblocks.newView(parsed, { style: 'scratch3' });
           const svg = view.render();
           
           svg.style.display = 'block';
           svg.style.margin = '10px 0';
           containerRef.current.appendChild(svg);
       } catch (e) {
           console.error("Scratch render error", e);
           containerRef.current.innerText = code;
       }
    }
  }, [code]);

  return <div ref={containerRef} className="scratch-container" />;
};

const FormattedText = ({ text }: { text: string }) => {
  if (!text) return null;
  const parts = text.split(/(\[scratch\][\s\S]*?\[\/scratch\])/g);
  
  return (
    <>
       {parts.map((part, idx) => {
          if (part.startsWith('[scratch]') && part.endsWith('[/scratch]')) {
             const code = part.replace(/^\[scratch\]/, '').replace(/\[\/scratch\]$/, '').trim();
             return <ScratchBlock key={idx} code={code} />;
          }
          return <span key={idx}>{part.split('\n').map((line, i) => <React.Fragment key={i}>{line}{i < part.split('\n').length - 1 && <br />}</React.Fragment>)}</span>;
       })}
    </>
  );
};

import { processPayloadForScratchImages } from './scratchImageExtractor';

const HEADER_TEMPLATES = [
  {
    id: 'standard_thcs',
    name: 'THCS Chuẩn',
    config: {
      school: "TRƯỜNG THCS NGUYỄN TRƯỜNG TỘ",
      class: "Lớp: .....",
      student: "Họ và tên: ..........................................",
      examTitle: "BÀI KIỂM TRA ĐỊNH KỲ",
      subject: "MÔN: TIN HỌC",
      time: "Thời gian làm bài: 45 Phút"
    }
  },
  {
    id: 'primary',
    name: 'Tiểu học',
    config: {
      school: "TRƯỜNG TIỂU HỌC .................",
      class: "Lớp: .....",
      student: "Họ và tên học sinh: .................................",
      examTitle: "KIỂM TRA CUỐI HỌC KỲ",
      subject: "MÔN: TIN HỌC",
      time: "Thời gian: 35 Phút"
    }
  },
  {
    id: 'university',
    name: 'Đại học / Cao đẳng',
    config: {
      school: "ĐẠI HỌC .........................",
      class: "Mã học phần: ...........",
      student: "MSSV: .................... Họ tên: .................",
      examTitle: "THI KẾT THÚC HỌC PHẦN",
      subject: "HỌC PHẦN: .....................",
      time: "Thời gian: 60-90 Phút"
    }
  }
];

const SAMPLE_MASTER_TEMPLATE = {
  templateId: 'standard_thcs',
  includeScoreTable: true,
  includeMatrix: true,
  headerConfig: {
    school: "TRƯỜNG TRUNG HỌC CƠ SỞ EXAMAI mẫu",
    class: "Lớp: 9A... Năm học: 2023 - 2024",
    student: "Họ và tên học sinh: ...........................................",
    examTitle: "KIỂM TRA ĐỊNH KỲ HỌC KỲ I (Mẫu)",
    subject: "MÔN: TIN HỌC 9",
    time: "Thời gian: 45 phút (không kể thời gian giao đề)"
  },
  matrix: [
    { topic: "Chủ đề A: Máy tính và xã hội tri thức", nb: 2, th: 1, vd: 0, vdc: 0 },
    { topic: "Chủ đề E: Giải quyết vấn đề với sự trợ giúp của máy tính", nb: 1, th: 2, vd: 1, vdc: 1 }
  ],
  sections: [
    {
      title: "PHẦN I. CÂU HỎI TRẮC NGHIỆM (4.0 điểm)",
      description: "Mỗi câu trả lời đúng được 0.25 điểm",
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          text: "Thiết bị nào sau đây là thiết bị vào của máy tính?",
          options: ["Màn hình", "Bàn phím", "Máy in", "Loa"],
          answer: "Bàn phím",
          points: 0.25
        },
        {
          id: "q2",
          type: "multiple_choice",
          text: "Các khối lệnh trong Scratch được phân biệt bởi?",
          options: ["Kích thước", "Màu sắc", "Phông chữ", "Ngôn ngữ"],
          answer: "Màu sắc",
          points: 0.25
        }
      ]
    },
    {
      title: "PHẦN II. CÂU HỎI ĐÚNG SAI (2.0 điểm)",
      description: "Mỗi ý trả lời đúng được 0.5 điểm",
      questions: [
        {
          id: "q3",
          type: "true_false",
          text: "Mạng Internet là mạng kết nối các máy tính trên toàn thế giới.",
          answer: "Đúng",
          points: 0.5
        },
        {
          id: "q4",
          type: "true_false",
          text: "CPU là bộ não của máy tính, thực hiện các phép toán logic.",
          answer: "Đúng",
          points: 0.5
        }
      ]
    },
    {
      title: "PHẦN III. CÂU HỎI ĐIỀN KHUYẾT / TRẢ LỜI NGẮN (2.0 điểm)",
      questions: [
        {
          id: "q5",
          type: "fill_in",
          text: "Thiết bị dùng để lưu trữ dữ liệu lâu dài là [.....].",
          answer: "Ổ cứng (HDD/SSD)",
          points: 1.0
        }
      ]
    },
    {
        title: "PHẦN IV. LẬP TRÌNH VỚI SCRATCH (2.0 điểm)",
        questions: [
            {
                id: "q6",
                type: "essay",
                text: "Dựa vào đoạn code sau, hãy cho biết nhân vật sẽ di chuyển bao nhiêu bước? \n [scratch]\n khi nhấn vào lá cờ xanh\n lặp lại 10 lần\n di chuyển 10 bước\n [/scratch]",
                answer: "Nhân vật di chuyển 100 bước (10 * 10)",
                points: 1.0
            }
        ]
    }
  ]
};

// --- INITIAL STATE (MATCHING STRICT AI SCHEMA) ---
const INITIAL_EXAM_DATA = {
  templateId: 'standard_thcs',
  includeScoreTable: true,
  includeMatrix: false,
  headerConfig: HEADER_TEMPLATES[0].config,
  matrix: [
    { topic: "Chương 1: Máy tính và cộng đồng", nb: 2, th: 1, vd: 0, vdc: 0 },
    { topic: "Chương 2: Tổ chức lưu trữ, tìm kiếm", nb: 1, th: 2, vd: 1, vdc: 0 }
  ],
  sections: [] 
};

// --- HELPER COMPONENTS ---
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
    <div className="w-1 h-3 bg-indigo-500 rounded-full opacity-50"></div>
    {children}
  </h3>
);

export default function App() {
  const [loading, setLoading] = useState(false);
  const [examData, setExamData] = useState<any>(INITIAL_EXAM_DATA);
  const [user, setUser] = useState<User | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'bank'>('dashboard');
  const [wizardStep, setWizardStep] = useState(1);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // JSON Edit Fallback States
  const [jsonEditMode, setJsonEditMode] = useState(false);
  const [rawJsonContent, setRawJsonContent] = useState("");

  // AI Generation States
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("Medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingTemplate, setIsAnalyzingTemplate] = useState(false);
  const [scanText, setScanText] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchConfigs();
    });
    return () => unsubscribe();
  }, []);

  const fetchConfigs = async () => {
    try {
      const configs = await getExamConfigs();
      setSavedConfigs(configs);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadSampleTemplate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_MASTER_TEMPLATE)
      });
      
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MAU_DE_THI_CHUAN_EXAMAI.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Không thể tải file mẫu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (tplId: string) => {
    const tpl = HEADER_TEMPLATES.find(t => t.id === tplId);
    if (tpl) {
      setExamData((prev: any) => ({
        ...prev,
        templateId: tplId,
        headerConfig: { ...tpl.config }
      }));
    }
  };

  const handleScanTemplate = async () => {
    if (!scanText.trim()) return;
    setIsAnalyzingTemplate(true);
    try {
      const res = await fetch('/api/analyze-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: scanText })
      });
      const data = await res.json();
      if (res.ok) {
        setExamData((prev: any) => ({
          ...prev,
          templateId: 'custom',
          headerConfig: { ...prev.headerConfig, ...data }
        }));
        setShowScanner(false);
        setScanText("");
        showToast("Đã phân tích và áp dụng thành công!", "success");
      }
    } catch (err) {
      showToast("Lỗi khi phân tích nội dung.", "error");
    } finally {
      setIsAnalyzingTemplate(false);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      showToast("Vui lòng nhập tên cho cấu hình đề thi!", "error");
      return;
    }
    setIsSaving(true);
    try {
      await saveExamConfig(saveName, examData);
      showToast("Đã lưu cấu hình thành công!", "success");
      setSaveName("");
      fetchConfigs();
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi lưu cấu hình!", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = (config: any) => {
    setExamData(config.data);
    setWizardStep(4);
    setCurrentView('workspace');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa cấu hình này?")) return;
    try {
      await deleteDoc(doc(db, "examConfigurations", id));
      fetchConfigs();
    } catch (err) {
      console.error(err);
    }
  };

  const updateHeader = (key: string, value: string) => {
    setExamData((prev: any) => ({
      ...prev,
      headerConfig: { ...prev.headerConfig, [key]: value }
    }));
  };

  const updateMatrix = (idx: number, field: string, value: any) => {
    const newMatrix = [...examData.matrix];
    newMatrix[idx][field] = value;
    setExamData({ ...examData, matrix: newMatrix });
  };

  const addMatrixRow = () => {
    setExamData({
      ...examData,
      matrix: [...examData.matrix, { topic: "Chủ đề mới", nb: 0, th: 0, vd: 0, vdc: 0 }]
    });
  };

  const removeMatrixRow = (idx: number) => {
    setExamData({
      ...examData,
      matrix: examData.matrix.filter((_: any, i: number) => i !== idx)
    });
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login component error:", err);
    }
  };

  const handleSaveParsedJson = () => {
    try {
      const parsedData = JSON.parse(rawJsonContent);
      parseAiResponseToExamData(parsedData);
      setJsonEditMode(false);
      showToast("Đã cập nhật dữ liệu JSON thành công!", "success");
    } catch (err: any) {
      showToast("Cú pháp JSON tĩnh bị lỗi! Hãy kiểm tra lại.", "error");
    }
  };

  const parseAiResponseToExamData = (aiData: any) => {
    if (aiData && aiData.sections) {
      setExamData((prev: any) => ({
        ...prev,
        sections: aiData.sections
      }));
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      alert("Vui lòng mô tả yêu cầu trong bảng đặc tả (chủ đề, cấu trúc) để AI xử lý!");
      return;
    }
    setIsGenerating(true);
    try {
      const matrixDetails = examData.matrix.map((m: any) => `- ${m.topic}: Nhận biết: ${m.nb}, Thông hiểu: ${m.th}, Vận dụng: ${m.vd}, Vận dụng cao: ${m.vdc}`).join('\n');
      
      const dbPrompt = `Đề thi môn: ${examData.headerConfig.subject}, Cấp độ: Lớp / Khối tương ứng
Thời gian: ${examData.headerConfig.time}
Mức độ khó chung: ${aiDifficulty}

MA TRẬN ĐỀ THI YÊU CẦU:
${matrixDetails}

YÊU CẦU TỪ BẢNG ĐẶC TẢ CHI TIẾT:
${aiPrompt}

Hãy sinh đề thi áp dụng TẤT CẢ các quy tắc strict JSON và đảm bảo cover được ma trận trên.`;

      const res = await fetch('/api/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: dbPrompt })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'JSON_PARSE_ERROR') {
           setRawJsonContent(data.rawText);
           setWizardStep(4);
           setJsonEditMode(true);
           alert("Gemini trả về JSON bị sai cấu trúc hoặc bị cắt ngang! Hãy sửa lại Code bằng tay trong tab Mã nguồn (JSON).");
           return;
        }
        throw new Error("API Generate failed: " + (data.details || res.statusText));
      }
      
      console.log("AI Data Received:", data);
      
      // Auto-set the raw JSON for the editor if user wants to tinker later
      setRawJsonContent(JSON.stringify(data, null, 2));

      parseAiResponseToExamData(data);
      
      setWizardStep(4); // Go to step 4 Review + Edit
    } catch (err) {
      console.error(err);
      showToast("Đã xảy ra lỗi khi tạo đề.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateWordDoc = async () => {
    setLoading(true);
    try {
      // 100% compatible with the strict JSON schema
      let payload = {
        header: {
          left: [examData.headerConfig.school, examData.headerConfig.class, examData.headerConfig.student],
          center: [examData.headerConfig.examTitle, examData.headerConfig.subject, examData.headerConfig.time]
        },
        settings: {
          includeScoreTable: examData.includeScoreTable,
          includeMatrix: examData.includeMatrix,
          matrix: examData.matrix
        },
        sections: examData.sections,
        scoring: {}
      };

      payload = await processPayloadForScratchImages(payload);

      const response = await fetch('/api/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Server failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `De_Thi_${examData.headerConfig.subject.replace(/[: ]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Đã xuất file Word thành công!", "success");
    } catch (err) {
      showToast("Lỗi khi kết xuất file Word!", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 text-slate-500 flex flex-col items-center lg:items-start p-4 transition-all duration-300 z-30 shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-slate-900 font-bold text-lg hidden lg:block tracking-tight">ExamAI</span>
        </div>

        <nav className="flex-1 w-full space-y-2">
          <SidebarLink icon={<Layout className="w-5 h-5"/>} label="Bảng điều khiển" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <SidebarLink 
            icon={
              <div className="relative">
                <FileText className="w-5 h-5"/>
                <span className="absolute -top-2 -right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              </div>
            } 
            label="Soạn đề & Quét mẫu" 
            active={currentView === 'workspace'} 
            onClick={() => { setCurrentView('workspace'); setWizardStep(1); }} 
          />
          <SidebarLink icon={<Database className="w-5 h-5"/>} label="Ngân hàng câu hỏi" active={currentView === 'bank'} onClick={() => setCurrentView('bank')} />
        </nav>

        <div className="w-full mt-auto">
          {user ? (
             <div className="flex items-center lg:gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-100" onClick={() => signOut(auth)}>
                <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-slate-200" />
                <div className="hidden lg:block overflow-hidden">
                  <p className="text-slate-900 text-xs font-semibold truncate">{user.displayName}</p>
                  <p className="text-[10px] text-slate-400 truncate tracking-tight">{user.email}</p>
                </div>
             </div>
          ) : (
            <button onClick={handleLogin} className="w-full flex items-center justify-center lg:justify-start gap-3 p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              <LogIn className="w-5 h-5" />
              <span className="hidden lg:block font-medium">Đăng nhập</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex-1 overflow-auto p-8 custom-scrollbar"
            >
              <div className="max-w-6xl mx-auto space-y-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Chào mừng quay trở lại</h1>
                    <p className="text-slate-500 mt-1">Giám sát và tạo cấu trúc đề thi nhanh chóng với ExamAI.</p>
                  </div>
                        <button 
                          onClick={() => { setCurrentView('workspace'); setWizardStep(1); }}
                          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-2xl shadow-indigo-600/40 hover:bg-indigo-700 transition-all transform hover:-translate-y-1 active:scale-95"
                        >
                          <Plus className="w-6 h-6" />
                          Bắt đầu Soạn đề mới
                        </button>
                        <button 
                          onClick={downloadSampleTemplate}
                          className="flex items-center gap-3 px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-600 rounded-2xl font-bold shadow-xl hover:bg-indigo-50 transition-all transform hover:-translate-y-1 active:scale-95 ml-4"
                        >
                          <FileText className="w-6 h-6" />
                          Tải File Đề mẫu (.docx)
                        </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard label="Tổng số đề" value={savedConfigs.length.toString()} icon={<FileText className="text-indigo-600" />} />
                  <StatCard label="Câu hỏi được tạo" value="AI Powered" icon={<Sparkles className="text-cyan-500" />} />
                  <StatCard label="Lượt xuất file" value="DOCX" icon={<Download className="text-indigo-600" />} />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                   <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Đề thi gần đây</h3>
                    {!user && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full font-medium border border-amber-100">Đăng nhập để xem bản lưu</span>
                    )}
                  </div>
                  <div className="overflow-x-auto min-h-[200px] flex flex-col justify-center">
                    {!user ? (
                      <div className="text-center py-12 px-6">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                          <FolderOpen className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-slate-900 font-bold mb-2">Bạn chưa đăng nhập</h4>
                        <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">Vui lòng đăng nhập với Google để lưu cấu hình đề thi và xem lại các đề đã tạo.</p>
                        <button onClick={handleLogin} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
                          Đăng nhập ngay
                        </button>
                      </div>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-400">
                            <th className="px-6 py-4">Tên cấu hình</th>
                            <th className="px-6 py-4">Môn học</th>
                            <th className="px-6 py-4">Ngày tạo</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {savedConfigs.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Chưa có dữ liệu nào. Hãy bắt đầu tạo đề thi đầu tiên!</td></tr>
                          ) : savedConfigs.slice(0, 10).map((config) => (
                            <tr key={config.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-6 py-4 font-semibold text-slate-900">{config.name}</td>
                              <td className="px-6 py-4 text-slate-500">{config.data.headerConfig?.subject}</td>
                              <td className="px-6 py-4 text-slate-500 text-sm">{config.createdAt?.toDate ? config.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button 
                                  onClick={() => handleLoad(config)} 
                                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2 inline-flex"
                                >
                                  <Play className="w-3 h-3"/>
                                  Sử dụng
                                </button>
                                <button 
                                  onClick={() => handleDelete(config.id)} 
                                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4"/>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'workspace' && (
            <motion.div 
              key="workspace"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden"
            >
              {/* Universal Header with Progress Bar */}
              <header className="h-auto min-h-[88px] border-b border-slate-200 bg-white px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 shadow-sm relative z-20">
                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setCurrentView('dashboard')} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-500 hover:text-slate-900 border border-slate-200">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-slate-900 font-bold text-lg whitespace-nowrap">Soạn thảo Đề</h2>
                  </div>
                  
                  {/* Mobile Header Actions */}
                  <div className="flex md:hidden items-center gap-2">
                     {user && <button onClick={handleSave} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Save className="w-5 h-5"/></button>}
                  </div>
                </div>

                {/* Progress Bar (Responsive) */}
                <div className="flex items-center scale-90 md:scale-100">
                  <WizardStep step={1} current={wizardStep} label="Cấu hình" />
                  <div className={`h-[2px] w-8 md:w-16 lg:w-24 transition-colors duration-300 ${wizardStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                  <WizardStep step={2} current={wizardStep} label="Ma trận" />
                  <div className={`h-[2px] w-8 md:w-16 lg:w-24 transition-colors duration-300 ${wizardStep >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                  <WizardStep step={3} current={wizardStep} label="Đặc tả" />
                  <div className={`h-[2px] w-8 md:w-16 lg:w-24 transition-colors duration-300 ${wizardStep >= 4 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                  <WizardStep step={4} current={wizardStep} label="Đề thi" />
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  {user && (
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 gap-2">
                      <input 
                        type="text" 
                        placeholder="Tên bản lưu..." 
                        className="bg-transparent text-sm w-32 outline-none font-medium text-slate-700"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                      />
                      <button 
                        onClick={handleSave} 
                        className="text-indigo-600 hover:text-indigo-800 p-1.5 bg-white border border-indigo-100 rounded-md transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                      >
                        <Save className="w-4 h-4"/>
                        Lưu
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {wizardStep > 1 && (
                      <button 
                        onClick={() => setWizardStep(prev => Math.max(prev - 1, 1))}
                        className="px-4 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 text-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Quay lại
                      </button>
                    )}

                    {wizardStep === 4 ? (
                      <button onClick={generateWordDoc} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Xuất đề
                      </button>
                    ) : (
                      <button 
                        onClick={() => setWizardStep(prev => Math.min(prev + 1, 4))}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm"
                      >
                        Kế tiếp
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </header>

              {/* Dynamic Body Content */}
              <div className="flex-1 overflow-auto flex flex-col">
                  {wizardStep === 1 && (
                    <div className="flex-1 overflow-auto p-8 lg:p-12 custom-scrollbar animate-in slide-in-from-bottom-2">
                      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Template Selection */}
                        <div className="lg:col-span-1 space-y-6">
                           <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-xl shadow-indigo-900/20">
                             <Sparkles className="w-8 h-8 mb-4 text-indigo-300" />
                             <h3 className="font-bold text-lg mb-2">Quét từ Mẫu có sẵn (AI)</h3>
                             <p className="text-indigo-200 text-sm leading-relaxed mb-4">Bạn có mẫu đề cũ? Hãy copy nội dung phần tiêu đề và dán vào đây, AI sẽ tự động điền các ô bên phải cho bạn.</p>
                             <button 
                               onClick={() => setShowScanner(true)}
                               className="w-full py-3.5 bg-white text-indigo-900 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-indigo-50 shadow-lg"
                             >
                               <Eye className="w-4 h-4"/> Bắt đầu Quét Mẫu
                             </button>
                           </div>

                           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                             <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Chọn Mẫu (Template)</h3>
                             <div className="grid grid-cols-1 gap-3">
                               <button 
                                 onClick={downloadSampleTemplate}
                                 className="w-full p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all mb-4"
                               >
                                 <Download className="w-4 h-4"/> Tải mẫu chuẩn để tham khảo
                               </button>
                               {HEADER_TEMPLATES.map(tpl => (
                                 <button 
                                   key={tpl.id}
                                   onClick={() => applyTemplate(tpl.id)}
                                   className={`w-full p-4 rounded-2xl text-left border transition-all ${examData.templateId === tpl.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 group'}`}
                                 >
                                   <div className="flex items-center justify-between">
                                      <p className="font-bold text-sm tracking-tight">{tpl.name}</p>
                                      {examData.templateId === tpl.id && <Check className="w-3 h-3 text-indigo-200" />}
                                   </div>
                                 </button>
                               ))}
                             </div>
                           </div>
                           
                           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                             <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Cấu hình hiển thị</h3>
                             <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                   <div className={`w-10 h-6 rounded-full relative transition-all ${examData.includeScoreTable ? 'bg-indigo-600' : 'bg-slate-200'}`} onClick={() => setExamData((p:any) => ({...p, includeScoreTable: !p.includeScoreTable}))}>
                                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${examData.includeScoreTable ? 'left-5' : 'left-1'}`}></div>
                                   </div>
                                   <span className="text-sm font-medium text-slate-700">Khung ghi Điểm</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                   <div className={`w-10 h-6 rounded-full relative transition-all ${examData.includeMatrix ? 'bg-indigo-600' : 'bg-slate-200'}`} onClick={() => setExamData((p:any) => ({...p, includeMatrix: !p.includeMatrix}))}>
                                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${examData.includeMatrix ? 'left-5' : 'left-1'}`}></div>
                                   </div>
                                   <span className="text-sm font-medium text-slate-700">Chèn Ma trận</span>
                                </label>
                             </div>
                           </div>
                        </div>

                        {/* Scanner Overlay Modal */}
                        {showScanner && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                            <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-8 space-y-6">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-900">Quét dữ liệu từ văn bản</h3>
                                <button onClick={() => setShowScanner(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
                              </div>
                              <p className="text-slate-500 text-sm italic">Dán nội dung tiêu đề đề thi của bạn vào ô dưới đây (Ví dụ: tên trường, năm học, tên bài kiểm tra...):</p>
                              <textarea 
                                value={scanText}
                                onChange={(e) => setScanText(e.target.value)}
                                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all resize-none"
                                placeholder="TRƯỜNG THCS ABC... LỚP 9... KIỂM TRA GIỮA KỲ..."
                              ></textarea>
                              <div className="flex gap-3">
                                <button onClick={() => setShowScanner(false)} className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors">Hủy bỏ</button>
                                <button 
                                  onClick={handleScanTemplate}
                                  disabled={isAnalyzingTemplate || !scanText.trim()}
                                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                >
                                  {isAnalyzingTemplate ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                  {isAnalyzingTemplate ? "AI Đang phân tích..." : "Phân tích & Áp dụng"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Details Configuration */}
                        <div className="lg:col-span-2 space-y-4">
                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                            <div className="mb-4 pb-4 border-b border-slate-100">
                              <h2 className="text-xl font-bold text-slate-900 tracking-tight">1. Thông tin Tiêu đề</h2>
                            </div>
                            <div className="space-y-4">
                              <EditableField label="Tên trường / Cở sở giáo dục" value={examData.headerConfig.school} onChange={(v) => updateHeader('school', v)} />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <EditableField label="Thông tin Lớp / Khối" value={examData.headerConfig.class} onChange={(v) => updateHeader('class', v)} />
                                <EditableField label="Dòng tên học sinh" value={examData.headerConfig.student} onChange={(v) => updateHeader('student', v)} />
                              </div>
                              <div className="border-t border-slate-50 pt-2"></div>
                              <EditableField label="Tiêu đề bài kiểm tra" value={examData.headerConfig.examTitle} onChange={(v) => updateHeader('examTitle', v)} />
                              <EditableField label="Môn học / Phân môn" value={examData.headerConfig.subject} onChange={(v) => updateHeader('subject', v)} />
                              <EditableField label="Thời gian làm bài" value={examData.headerConfig.time} onChange={(v) => updateHeader('time', v)} />
                            </div>
                          </div>

                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                             <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-6">Xem trước tiêu đề nhanh</h4>
                             <div className="font-serif bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-inner scale-95 origin-top" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                <div className="flex justify-between border-b pb-4 mb-4">
                                   <div className="text-center">
                                      <div className="uppercase font-bold text-sm tracking-tighter">{examData.headerConfig.school || "[TÊN TRƯỜNG]"}</div>
                                      <div className="font-bold text-sm tracking-tight">{examData.headerConfig.class || "[LỚP]"}</div>
                                   </div>
                                   <div className="text-center font-bold text-sm tracking-tight">
                                      <div>{examData.headerConfig.subject || "[MÔN HỌC]"}</div>
                                      <div className="font-normal italic text-[11px]">{examData.headerConfig.time || "[THỜI GIAN]"}</div>
                                   </div>
                                </div>
                                <div className="text-xs mb-4">{examData.headerConfig.student || "[DÒNG TÊN HỌC SINH]"}</div>
                                <div className="text-center font-bold text-base uppercase tracking-normal">{examData.headerConfig.examTitle || "[TIÊU ĐỀ KIỂM TRA]"}</div>
                             </div>
                             <p className="mt-4 text-[10px] text-slate-400 italic text-center">Lưu ý: Font chữ và căn lề sẽ được áp dụng chuẩn Times New Roman khi xuất file Word.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div className="flex-1 overflow-auto p-4 lg:p-6 custom-scrollbar animate-in slide-in-from-right-4">
                      <div className="max-w-5xl mx-auto space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                          <div>
                            <h2 className="text-xl font-bold text-indigo-900 tracking-tight">2. Xây dựng Ma trận</h2>
                            <p className="text-indigo-600/70 text-xs">Thiết lập ma trận nhận thức theo các chuẩn kiến thức kỹ năng.</p>
                          </div>
                          <button onClick={addMatrixRow} className="px-3 py-1.5 bg-white text-indigo-600 font-bold rounded-lg border border-indigo-200 shadow-sm hover:bg-indigo-50 flex items-center gap-2 text-xs">
                             <Plus className="w-4 h-4"/> Thêm chủ đề
                          </button>
                        </div>
                        
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left bg-white text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                <th className="p-3 w-1/3">Nội dung / Chủ đề</th>
                                <th className="p-3 text-center">Nhận biết</th>
                                <th className="p-3 text-center">Thông hiểu</th>
                                <th className="p-3 text-center">Vận dụng</th>
                                <th className="p-3 text-center">VD Cao</th>
                                <th className="p-3 text-center w-14">Xóa</th>
                              </tr>
                            </thead>
                            <tbody>
                               {examData.matrix.map((row: any, i: number) => (
                                 <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                   <td className="p-2">
                                      <input type="text" value={row.topic} onChange={e => updateMatrix(i, 'topic', e.target.value)} className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-400 py-1 px-1 outline-none font-medium text-slate-700 text-sm" />
                                   </td>
                                   <td className="p-2" align="center"><input type="number" min="0" value={row.nb} onChange={e => updateMatrix(i, 'nb', parseInt(e.target.value)||0)} className="w-12 bg-slate-50 rounded p-1 text-center font-bold text-slate-700 outline-none focus:ring-1 ring-indigo-200" /></td>
                                   <td className="p-2" align="center"><input type="number" min="0" value={row.th} onChange={e => updateMatrix(i, 'th', parseInt(e.target.value)||0)} className="w-12 bg-slate-50 rounded p-1 text-center font-bold text-slate-700 outline-none focus:ring-1 ring-indigo-200" /></td>
                                   <td className="p-2" align="center"><input type="number" min="0" value={row.vd} onChange={e => updateMatrix(i, 'vd', parseInt(e.target.value)||0)} className="w-12 bg-slate-50 rounded p-1 text-center font-bold text-slate-700 outline-none focus:ring-1 ring-indigo-200" /></td>
                                   <td className="p-2" align="center"><input type="number" min="0" value={row.vdc} onChange={e => updateMatrix(i, 'vdc', parseInt(e.target.value)||0)} className="w-12 bg-slate-50 rounded p-1 text-center font-bold text-slate-700 outline-none focus:ring-1 ring-indigo-200" /></td>
                                   <td className="p-2" align="center">
                                      <button onClick={() => removeMatrixRow(i)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                                   </td>
                                 </tr>
                               ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="flex-1 overflow-auto p-6 md:p-8 custom-scrollbar animate-in slide-in-from-right-4">
                       <div className="max-w-4xl mx-auto space-y-6 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                        <div className="text-center pb-4 border-b border-slate-100 flex flex-col md:flex-row items-center gap-4 text-left">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shrink-0">
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">3. Bảng đặc tả & Sinh đề AI</h2>
                            <p className="text-slate-500 text-xs mt-1">Thiết lập đặc tả và yêu cầu AI sinh bộ câu hỏi bám sát Ma trận.</p>
                          </div>
                        </div>
                        <div className="space-y-6 text-left">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Mô tả đặc tả / Yêu cầu mở rộng:</label>
                            <textarea 
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              placeholder="Nhập nội dung bảng đặc tả chi tiết..."
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all resize-none shadow-inner"
                            ></textarea>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                               <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Mức độ khó chung:</label>
                               <div className="grid grid-cols-3 gap-2">
                                 <DifficultyBtn label="Dễ" active={aiDifficulty === 'Easy'} onClick={() => setAiDifficulty('Easy')} />
                                 <DifficultyBtn label="Vừa" active={aiDifficulty === 'Medium'} onClick={() => setAiDifficulty('Medium')} />
                                 <DifficultyBtn label="Khó" active={aiDifficulty === 'Hard'} onClick={() => setAiDifficulty('Hard')} />
                               </div>
                            </div>
                            <button 
                              onClick={handleGenerateAI}
                              disabled={isGenerating}
                              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white py-3 rounded-xl font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 disabled:opacity-70 transition-all transform hover:-translate-y-1"
                            >
                               {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                               {isGenerating ? "AI Đang xử lý..." : "Sinh Đề bằng AI"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {wizardStep === 4 && (
                    <div className="flex-1 flex overflow-hidden animate-in fade-in bg-slate-50">
                      {/* Editor Sub-Header (JSON vs Visual Toggle) */}
                      <div className="absolute top-[88px] left-0 right-0 h-14 bg-slate-100 flex items-center justify-center gap-2 border-b border-slate-200 z-10 shadow-sm">
                         <button 
                            onClick={() => setJsonEditMode(false)}
                            className={`px-6 py-1.5 rounded-lg font-bold text-sm transition-all ${!jsonEditMode ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}
                         >Giao diện (Visual)</button>
                         <button 
                            onClick={() => setJsonEditMode(true)}
                            className={`px-6 py-1.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${jsonEditMode ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-200'}`}
                         >
                            Mã nguồn (JSON)
                            {jsonEditMode && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                         </button>
                      </div>

                      {/* Workspace content starts below the sub-header */}
                      <div className="w-full h-full pt-14 flex">
                         {jsonEditMode ? (
                            <section className="flex-1 flex flex-col p-8 bg-slate-900 custom-scrollbar overflow-hidden">
                                <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-4">
                                   <div className="flex items-center justify-between text-slate-300">
                                      <p className="text-sm font-medium">Bạn có thể sửa trực tiếp cấu trúc JSON nếu AI trả về sai định dạng.</p>
                                      <button 
                                        onClick={handleSaveParsedJson}
                                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors shadow-lg flex items-center gap-2 text-sm"
                                      >
                                         <Check className="w-4 h-4"/>
                                         Cập nhật Dữ liệu
                                      </button>
                                   </div>
                                   <textarea 
                                      value={rawJsonContent}
                                      onChange={(e) => setRawJsonContent(e.target.value)}
                                      className="flex-1 w-full bg-[#0d1117] text-[#c9d1d9] border border-slate-700 rounded-xl p-6 font-mono text-sm outline-none focus:border-emerald-500/50 resize-none shadow-inner"
                                      spellCheck={false}
                                   />
                                </div>
                            </section>
                         ) : (
                            <section className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar pb-24">
                               <div className="max-w-4xl mx-auto space-y-6">
                                  {examData.sections?.length > 0 ? examData.sections.map((sec: any, sIdx: number) => (
                                     <div key={sIdx} className="space-y-3">
                                       <SectionTitle>{sec.title}</SectionTitle>
                                       <div className="grid grid-cols-1 gap-3">
                                          {sec.questions?.map((q: any, qIdx: number) => (
                                             <QuestionCard key={qIdx} q={q} type={sec.type} number={q.id || qIdx + 1} />
                                          ))}
                                       </div>
                                     </div>
                                  )) : (
                                    <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center">
                                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                      <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có dữ liệu câu hỏi</h3>
                                      <p>Vui lòng quay lại Bước 3 để sử dụng AI Sinh đề dựa vào Ma trận.</p>
                                      <button onClick={() => setWizardStep(3)} className="mt-6 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors">Quay lại Bước 3</button>
                                    </div>
                                  )}
                               </div>
                            </section>
                         )}

                         {/* Print/Word Preview Pane (A4) - ALWAYS visible in Step 4 on large screens */}
                         <section className="w-[450px] lg:w-[500px] xl:w-[600px] bg-[#E2E8F0] p-8 hidden md:flex flex-col border-l border-slate-300 relative shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                               <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Xem trước Bản in (A4)</span>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar flex justify-center items-start pt-4">
                               <div className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] mb-10 overflow-hidden" style={{ width: '210mm', minHeight: '297mm', paddingLeft: '30mm', paddingRight: '20mm', paddingTop: '20mm', paddingBottom: '20mm', transform: 'scale(0.65)', transformOrigin: 'top center' }}>
                                  <div className="font-serif leading-tight text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt' }}>
                                     <div className="flex justify-between border-b pb-4 mb-8">
                                        <div className="text-center">
                                          <div className="uppercase font-bold">{examData.headerConfig.school}</div>
                                          <div className="font-bold">{examData.headerConfig.class}</div>
                                        </div>
                                        <div className="text-center font-bold">
                                          <div>{examData.headerConfig.subject}</div>
                                          <div className="font-normal italic text-[12pt]">{examData.headerConfig.time}</div>
                                        </div>
                                     </div>
                                     
                                     <div className="mb-4">{examData.headerConfig.student}</div>
                                     
                                     <div className="text-center font-bold text-xl uppercase mb-8 mt-6">
                                        {examData.headerConfig.examTitle}
                                     </div>

                                     <div className="space-y-6">
                                        {examData.sections?.map((sec: any, sIdx: number) => (
                                           <div key={sIdx} className="mb-6">
                                              <div className="font-bold mb-3">{sec.title}</div>
                                              <div className="space-y-3">
                                                 {sec.questions?.map((q: any, qIdx: number) => (
                                                    <div key={qIdx} className="text-justify leading-relaxed break-inside-avoid">
                                                       <span className="font-bold">Câu {q.id || qIdx + 1}. </span>
                                                       <FormattedText text={q.question} />

                                                       {sec.type === 'multiple_choice' && q.options && (
                                                         <div className="mt-2 pl-8 space-y-1">
                                                           {q.options.map((o: string, i: number) => (
                                                              <div key={i} className="flex gap-2">
                                                                <span className="shrink-0">{String.fromCharCode(65 + i)}.</span>
                                                                <FormattedText text={String(o).replace(/^[A-D](\.|\)) /, '')} />
                                                              </div>
                                                           ))}
                                                         </div>
                                                       )}

                                                       {sec.type === 'true_false' && q.statements && (
                                                         <div className="mt-2 pl-4 space-y-1">
                                                           {q.statements.map((s: any, i: number) => {
                                                              let t = String(s.text || '').trim();
                                                              const prefix = String.fromCharCode(97 + i) + ") ";
                                                              if (!t.toLowerCase().startsWith(prefix.trim())) t = prefix + t;
                                                              return <div key={i}><FormattedText text={t} /></div>;
                                                           })}
                                                         </div>
                                                       )}

                                                       {sec.type === 'matching' && q.left && q.right && (
                                                         <div className="flex justify-between mt-4 pl-4 w-full pr-8">
                                                            <div className="space-y-2 flex-1 pr-4">
                                                              <div className="font-bold text-center mb-2">Cột A</div>
                                                              {q.left.map((l: string, i: number) => {
                                                                let text = l;
                                                                if (!text.startsWith(String(i+1))) text = `${i+1}. ${text}`;
                                                                return <div key={i}><FormattedText text={text} /></div>;
                                                              })}
                                                            </div>
                                                            <div className="space-y-2 flex-1 pl-4 border-l border-slate-100">
                                                              <div className="font-bold text-center mb-2">Cột B</div>
                                                              {q.right.map((r: string, i: number) => {
                                                                const prefix = String.fromCharCode(65 + i) + '. ';
                                                                let text = r;
                                                                if (!text.startsWith(String.fromCharCode(65 + i))) text = prefix + text;
                                                                return <div key={i}><FormattedText text={text} /></div>;
                                                              })}
                                                            </div>
                                                         </div>
                                                       )}

                                                       {(sec.type === 'essay' || sec.type === 'fill_in_the_blanks') && (
                                                         <div className="mt-8 mb-4 border-b border-dotted border-slate-400"></div>
                                                       )}
                                                    </div>
                                                 ))}
                                              </div>
                                           </div>
                                        ))}
                                     </div>
                                  </div>
                               </div>
                            </div>
                          </section>
                      </div>
                    </div>
                  )}
              </div>
            </motion.div>
          )}

          {currentView === 'bank' && (
            <motion.div 
              key="bank"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 p-8 overflow-auto custom-scrollbar bg-slate-50"
            >
              <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Question Bank</h1>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">Import Questions</button>
                </div>
                {/* Implementation placeholder for Bank */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Toast Notifications */}
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border min-w-[300px] ${
                  toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                  toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
                  'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {toast.type === 'success' && <Check className="w-5 h-5 text-emerald-600" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                {toast.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-600" />}
                <p className="font-bold text-sm tracking-tight">{toast.message}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- UI COMPONENTS ---

function SidebarLink({ icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-center lg:justify-start gap-4 p-3 rounded-xl transition-all relative group
        ${active ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 hover:text-slate-900'}`}
    >
      <div className={active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-900'}>{icon}</div>
      <span className={`hidden lg:block font-bold text-sm ${active ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-900'}`}>{label}</span>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full"></div>}
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function WizardStep({ step, current, label }: { step: number, current: number, label: string }) {
  const completed = step < current;
  const active = step <= current;
  const isCurrent = step === current;
  return (
    <div className={`flex items-center gap-3 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-30'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold shadow-md transition-all duration-300 ${completed ? 'bg-emerald-500 text-white scale-90' : isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 scale-110' : 'bg-slate-200 text-slate-500'}`}>
        {completed ? <Check className="w-4 h-4" /> : step}
      </div>
      <div className="hidden lg:block">
        <span className={`text-xs font-black uppercase tracking-widest block leading-none ${isCurrent ? 'text-indigo-600' : 'text-slate-400'}`}>Bước {step}</span>
        <span className={`text-sm font-bold ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
      </div>
    </div>
  );
}

function EditableField({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="group flex flex-col md:flex-row md:items-center gap-2 md:gap-4 w-full">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[140px]">{label}</label>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm"
      />
    </div>
  );
}

function DifficultyBtn({ label, active, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full py-4 rounded-xl font-bold transition-all border ${active ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20 transform scale-[1.02]' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
      {label}
    </button>
  );
}

// Re-designed to handle 5 different strict JSON schemas
function QuestionCard({ q, type, number }: { q: any, type: string, number: number | string, key?: React.Key }) {
  const typeLabels: Record<string, string> = {
    multiple_choice: 'Trắc nghiệm (MCQ)',
    true_false: 'Đúng/Sai',
    matching: 'Ghép nối',
    fill_in_the_blanks: 'Điền khuyết',
    essay: 'Tự luận'
  };

  const typeColors: Record<string, string> = {
    multiple_choice: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    true_false: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    matching: 'bg-amber-50 text-amber-600 border-amber-100',
    fill_in_the_blanks: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
    essay: 'bg-rose-50 text-rose-600 border-rose-100'
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-all group relative shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-slate-100 text-slate-800 rounded flex items-center justify-center font-bold text-[11px] ring-1 ring-slate-200">
            {number}
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${typeColors[type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {typeLabels[type] || type}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button className="p-1.5 hover:bg-slate-50 rounded transition-colors text-slate-400 hover:text-indigo-600"><Settings className="w-3.5 h-3.5"/></button>
           <button className="p-1.5 hover:bg-slate-50 rounded transition-colors text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      </div>
      
      <p className="text-slate-800 font-semibold mb-3 leading-snug text-sm">{q.question}</p>

      {/* Multiple Choice Options */}
      {type === 'multiple_choice' && q.options && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {q.options.map((o: string, i: number) => {
             const prefix = String.fromCharCode(65 + i);
             const hasPrefix = o.startsWith(prefix + '.') || o.startsWith(prefix + ')');
             const displayText = hasPrefix ? o : `${prefix}. ${o}`;
             const isAnswer = q.answer && o.startsWith(q.answer);
             return (
               <div key={i} className={`flex items-start gap-2 text-xs text-slate-700 bg-white p-2 rounded-lg border transition-all ${isAnswer ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-300' : 'border-slate-100'}`}>
                 <span className="font-medium text-slate-500">{prefix}.</span>
                 <span className="flex-1">{o.replace(new RegExp(`^${prefix}[.)]\\s*`), '')}</span>
               </div>
             )
          })}
        </div>
      )}

      {/* True / False Statements */}
      {type === 'true_false' && q.statements && (
         <div className="space-y-1.5">
            {q.statements.map((st: any, i: number) => (
               <div key={i} className="flex items-center justify-between text-xs bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                 <span className="text-slate-700">{st.text}</span>
                 <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${st.answer ? 'text-emerald-700' : 'text-rose-700'}`}>
                   {st.answer ? 'Đúng' : 'Sai'}
                 </span>
               </div>
            ))}
         </div>
      )}

      {/* Matching Pairs */}
      {type === 'matching' && q.left && q.right && (
         <div className="flex gap-4">
            <div className="flex-1 space-y-2">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">Cột A</div>
               {q.left.map((l: string, i: number) => <div key={i} className="text-sm bg-white p-3 rounded-xl border border-slate-200 font-medium text-slate-700">{l}</div>)}
            </div>
            <div className="flex-1 space-y-2">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">Cột B</div>
               {q.right.map((r: string, i: number) => <div key={i} className="text-sm bg-white p-3 rounded-xl border border-slate-200 font-medium text-slate-700">{r}</div>)}
            </div>
         </div>
      )}
    </div>
  );
}
