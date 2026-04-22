import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, FileText, Loader2, Save, FolderOpen, 
  LogIn, LogOut, Trash2, Plus, Sparkles, ChevronRight, 
  Layout, Settings, Database, Edit3, Eye, Printer, X, Check, ChevronLeft, Play, AlertCircle,
  Shapes, GraduationCap, BookOpen, Clock, Users, BarChart3, Search, ChevronDown, CheckCircle2, Code
} from 'lucide-react';
import { auth, loginWithGoogle, saveExamConfig, getExamConfigs, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import scratchblocks from 'scratchblocks';
import { processPayloadForScratchImages } from './scratchImageExtractor';

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
const SectionTitle = ({ children, icon: Icon }: { children: React.ReactNode, icon?: any }) => (
  <div className="flex items-center gap-3 mb-6">
    {Icon && <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Icon className="w-5 h-5" /></div>}
    <h3 className="font-serif text-xl font-bold text-slate-800 tracking-tight">
      {children}
    </h3>
    <div className="flex-1 h-[1px] bg-slate-100 ml-4"></div>
  </div>
);

const AcademicCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-3xl border border-slate-200/60 academic-shadow overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/5 ${className}`}>
    {children}
  </div>
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
      <aside className="w-20 lg:w-72 bg-white border-r border-slate-200/60 flex flex-col items-center lg:items-start p-6 transition-all duration-500 z-30 shrink-0 academic-shadow">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 animate-float">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="hidden lg:block leading-tight">
            <span className="text-slate-900 font-serif text-2xl font-black tracking-tighter block">ExamAI</span>
            <span className="text-indigo-600 text-[10px] font-black uppercase tracking-[0.3em]">Hệ thống Giáo dục</span>
          </div>
        </div>

        <div className="w-full space-y-8 flex-1">
          <div>
            <p className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">Menu Chính</p>
            <nav className="space-y-2">
              <SidebarLink icon={<Layout className="w-5 h-5"/>} label="Bảng điều khiển" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
              <SidebarLink 
                icon={<FileText className="w-5 h-5"/>} 
                label="Soạn đề Thông minh" 
                active={currentView === 'workspace'} 
                onClick={() => { setCurrentView('workspace'); setWizardStep(1); }} 
              />
              <SidebarLink icon={<Database className="w-5 h-5"/>} label="Ngân hàng câu hỏi" active={currentView === 'bank'} onClick={() => setCurrentView('bank')} />
            </nav>
          </div>

          <div>
            <p className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">Công cụ AI</p>
            <nav className="space-y-2">
              <SidebarLink icon={<Sparkles className="w-5 h-5"/>} label="Trợ lý Soạn thảo" active={false} />
              <SidebarLink icon={<Search className="w-5 h-5"/>} label="Quét đề cũ" active={false} />
            </nav>
          </div>
        </div>

        <div className="w-full mt-auto">
          {user ? (
             <button 
               onClick={() => signOut(auth)}
               className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all group"
             >
                <div className="relative shrink-0">
                  <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-10 h-10 rounded-xl border-2 border-slate-100 group-hover:border-rose-200 transition-all" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white0 border-2 border-white rounded-full"></div>
                </div>
                <div className="hidden lg:block overflow-hidden text-left">
                  <p className="text-slate-900 text-sm font-bold truncate tracking-tight">{user.displayName}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">Đăng xuất</p>
                </div>
             </button>
          ) : (
            <button onClick={handleLogin} className="w-full flex items-center justify-center lg:justify-start gap-4 p-4 text-white bg-indigo-600 rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
              <LogIn className="w-5 h-5" />
              <span className="hidden lg:block">Đăng nhập</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Navbar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-8 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
             {currentView === 'dashboard' ? (
                <div className="flex items-baseline gap-2">
                  <h1 className="text-xl font-serif font-bold text-slate-900">Chào buổi sáng,</h1>
                  <span className="text-indigo-600 font-bold">{user?.displayName?.split(' ').pop() || 'Giáo viên'}</span>
                </div>
             ) : (
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <span>Trang chủ</span>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-slate-900 font-bold">{currentView === 'workspace' ? 'Soạn thảo Đề thi' : 'Ngân hàng câu hỏi'}</span>
                </div>
             )}
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center bg-slate-100 rounded-xl px-4 py-2 gap-3 text-slate-400 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white focus-within:shadow-inner transition-all">
               <Search className="w-4 h-4 text-slate-400" />
               <input type="text" placeholder="Tìm kiếm đề thi..." className="bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-400 w-48" />
             </div>
             <button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all">
               <Settings className="w-5 h-5" />
             </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex-1 overflow-auto p-8 lg:p-12 custom-scrollbar"
            >
              <div className="max-w-7xl mx-auto space-y-12">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 lg:p-16 text-white shadow-2xl">
                   <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/20 to-transparent"></div>
                   <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                     <div className="max-w-xl">
                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                         <Sparkles className="w-3 h-3" />
                         Công nghệ Gemini AI 1.5 
                       </div>
                       <h2 className="text-4xl lg:text-5xl font-serif font-bold mb-6 leading-tight tracking-tight">Soạn đề thi chuyên nghiệp chỉ trong vài giây.</h2>
                       <p className="text-slate-400 text-lg mb-10 leading-relaxed">Hệ thống thông minh tự động hóa quy trình xây dựng đề thi theo ma trận, đặc tả và ngân hàng câu hỏi đa dạng.</p>
                       <div className="flex flex-wrap items-center gap-4">
                         <button 
                           onClick={() => { setCurrentView('workspace'); setWizardStep(1); }}
                           className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/40 hover:bg-indigo-700 transition-all flex items-center gap-3"
                         >
                           <Plus className="w-5 h-5" /> Soạn Đề Ngay
                         </button>
                         <button 
                           onClick={downloadSampleTemplate}
                           className="px-8 py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all backdrop-blur-md flex items-center gap-3 border border-white/10"
                         >
                           <FileText className="w-5 h-5" /> Tải Đề mẫu chuẩn
                         </button>
                       </div>
                     </div>
                     <div className="hidden lg:block flex-1 max-w-sm">
                        <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 rotate-3 shadow-2xl hover:rotate-0 transition-transform duration-700">
                           <div className="space-y-4">
                              <div className="h-4 bg-white/20 rounded-full w-3/4"></div>
                              <div className="h-4 bg-white/10 rounded-full w-full"></div>
                              <div className="h-4 bg-white/20 rounded-full w-1/2"></div>
                              <div className="h-20 bg-indigo-500/30 rounded-2xl w-full"></div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="h-10 bg-white/10 rounded-xl"></div>
                                <div className="h-10 bg-white/10 rounded-xl"></div>
                              </div>
                           </div>
                        </div>
                     </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  <StatCard label="Đề thi đã lưu" value={savedConfigs.length.toString()} icon={<BookOpen />} trend="+2 tuần qua" />
                  <StatCard label="Ngân hàng câu hỏi" value="5.2k+" icon={<Database />} />
                  <StatCard label="Tổng lượt tải" value="1.8k" icon={<Download />} trend="tăng 12%" />
                  <StatCard label="Tiết kiệm thời gian" value="95%" icon={<Clock />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   <AcademicCard className="lg:col-span-2">
                      <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                             <Clock className="w-5 h-5" />
                           </div>
                           <div>
                             <h3 className="font-serif font-bold text-slate-900">Đề thi gần đây</h3>
                             <p className="text-xs text-slate-500">Các dự án soạn đề bạn mới cập nhật</p>
                           </div>
                         </div>
                         <button className="text-indigo-600 text-sm font-bold hover:underline">Xem tất cả</button>
                      </div>
                      <div className="overflow-x-auto min-h-[300px]">
                        {!user ? (
                          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                             <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6">
                                <FolderOpen className="w-10 h-10 text-slate-300" />
                             </div>
                             <h4 className="text-lg font-bold text-slate-900 mb-2">Đăng nhập để đồng bộ</h4>
                             <p className="text-slate-500 text-sm mb-8 max-w-xs leading-relaxed">Hãy đăng nhập để lưu trữ đề thi lên đám mây và làm việc mọi lúc mọi nơi.</p>
                             <button onClick={handleLogin} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20">
                               Đăng nhập Ngay
                             </button>
                          </div>
                        ) : savedConfigs.length === 0 ? (
                           <div className="flex flex-col items-center justify-center py-20 px-8 text-center text-slate-400">
                             <p className="italic">Bạn chưa có đề thi nào. Hãy bắt đầu tạo một đề thi mới!</p>
                           </div>
                        ) : (
                          <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                              <tr className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">
                                <th className="px-8 py-5">Tên Đề thi</th>
                                <th className="px-8 py-5">Môn học</th>
                                <th className="px-8 py-5">Ngày tạo</th>
                                <th className="px-8 py-5 text-right">Chỉnh sửa</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {savedConfigs.slice(0, 5).map((config) => (
                                <tr key={config.id} className="group hover:bg-slate-50 transition-colors">
                                  <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:scale-110 transition-transform">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <span className="font-bold text-slate-900 text-sm">{config.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-8 py-5">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">{config.data.headerConfig?.subject || 'Tin học'}</span>
                                  </td>
                                  <td className="px-8 py-5 text-slate-400 text-xs font-medium">
                                    {config.createdAt?.toDate ? config.createdAt.toDate().toLocaleDateString('vi-VN') : 'Mới tạo'}
                                  </td>
                                  <td className="px-8 py-5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button 
                                        onClick={() => handleLoad(config)} 
                                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                                        title="Sử dụng cấu hình này"
                                      >
                                        <ChevronRight className="w-5 h-5" />
                                      </button>
                                      <button 
                                        onClick={() => handleDelete(config.id)} 
                                        className="p-2 text-slate-300 hover:text-rose-500 rounded-xl transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                   </AcademicCard>

                   <div className="space-y-8">
                      <AcademicCard className="p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none shadow-indigo-600/30">
                         <h3 className="text-xl font-bold mb-4 font-serif">Nâng cấp Kho lưu trữ</h3>
                         <p className="text-indigo-100 text-sm mb-8 leading-relaxed opacity-80">Kết nối Google Drive để tự động lưu trữ các bản xuất .docx của bạn.</p>
                         <button className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                            <Save className="w-5 h-5" /> Kết nôi Drive
                         </button>
                      </AcademicCard>

                       <AcademicCard className="p-8">
                         <h3 className="text-lg font-bold mb-6 font-serif text-slate-900">Hoạt động Giáo dục</h3>
                          <div className="space-y-6">
                             {[
                               { icon: <GraduationCap />, label: 'Đề thi HK1 Tin học 9', time: '2 giờ trước', color: 'text-indigo-600 bg-indigo-50' },
                               { icon: <Users />, label: 'Bản nháp Đề lớp 7A', time: '1 ngày trước', color: 'text-emerald-600 bg-white' },
                               { icon: <BarChart3 />, label: 'Cập nhật Ma trận mới', time: '3 ngày trước', color: 'text-amber-600 bg-amber-50' }
                             ].map((item, i) => (
                               <div key={i} className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                                    {React.cloneElement(item.icon as React.ReactElement, { className: 'w-5 h-5' })}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900 leading-none mb-1">{item.label}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{item.time}</p>
                                  </div>
                               </div>
                             ))}
                          </div>
                      </AcademicCard>
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
              <header className="h-28 border-b border-slate-200/60 bg-white/80 backdrop-blur-md px-10 flex items-center justify-between gap-8 shrink-0 z-20">
                <div className="flex items-center gap-6">
                  <button onClick={() => setCurrentView('dashboard')} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-slate-200/60">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="hidden lg:block">
                    <h2 className="text-slate-900 font-serif font-bold text-xl tracking-tight">Soạn thảo Đề thi</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Dự án: {saveName || 'Chưa đặt tên'}</p>
                  </div>
                </div>

                {/* Academic Progress Stepper */}
                <div className="flex items-center gap-1">
                  <WizardStep step={1} current={wizardStep} label="Cấu hình" />
                  <div className={`h-0.5 w-12 md:w-20 rounded-full transition-all duration-700 mx-2 ${wizardStep >= 2 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.3)]' : 'bg-slate-100'}`}></div>
                  <WizardStep step={2} current={wizardStep} label="Ma trận" />
                  <div className={`h-0.5 w-12 md:w-20 rounded-full transition-all duration-700 mx-2 ${wizardStep >= 3 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.3)]' : 'bg-slate-100'}`}></div>
                  <WizardStep step={3} current={wizardStep} label="Đặc tả AI" />
                  <div className={`h-0.5 w-12 md:w-20 rounded-full transition-all duration-700 mx-2 ${wizardStep >= 4 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.3)]' : 'bg-slate-100'}`}></div>
                  <WizardStep step={4} current={wizardStep} label="Thành phẩm" />
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-3">
                  {user && (
                    <div className="hidden md:flex items-center bg-slate-50 border border-slate-200/60 rounded-2xl py-2 px-4 gap-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white transition-all">
                      <Save className="w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Tên bản lưu..." 
                        className="bg-transparent text-sm w-36 outline-none font-bold text-slate-900 placeholder:text-slate-400"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                      />
                      <button 
                        onClick={handleSave} 
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-widest pl-2 border-l border-slate-200"
                      >
                        Lưu
                      </button>
                    </div>
                  )}

                  {wizardStep > 1 && (
                    <button 
                      onClick={() => setWizardStep(prev => Math.max(prev - 1, 1))}
                      className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 text-sm"
                    >
                      Quay lại
                    </button>
                  )}

                  {wizardStep === 4 ? (
                    <button onClick={generateWordDoc} className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-5 h-5" />}
                      Xuất file Word
                    </button>
                  ) : (
                    <button 
                      onClick={() => setWizardStep(prev => Math.min(prev + 1, 4))}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95"
                    >
                      Tiếp tục
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </header>


              {/* Dynamic Body Content */}
              <div className="flex-1 overflow-auto flex flex-col">
                  {wizardStep === 1 && (
                    <div className="flex-1 overflow-auto p-8 lg:p-16 custom-scrollbar">
                      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Configuration Column */}
                        <div className="lg:col-span-7 space-y-10">
                           <div>
                             <SectionTitle icon={Settings}>Thông tin Cơ bản</SectionTitle>
                             <AcademicCard className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                  <EditableField label="Tên trường" value={examData.headerConfig.school} onChange={(v) => updateHeader('school', v)} />
                                  <EditableField label="Lớp / Khối" value={examData.headerConfig.class} onChange={(v) => updateHeader('class', v)} />
                                  <EditableField label="Môn học" value={examData.headerConfig.subject} onChange={(v) => updateHeader('subject', v)} />
                                  <EditableField label="Thời gian" value={examData.headerConfig.time} onChange={(v) => updateHeader('time', v)} />
                                </div>
                                <EditableField label="Tiêu đề đề thi" value={examData.headerConfig.examTitle} onChange={(v) => updateHeader('examTitle', v)} />
                                <EditableField label="Ghi chú học sinh" value={examData.headerConfig.student} onChange={(v) => updateHeader('student', v)} />
                             </AcademicCard>
                           </div>

                           <div>
                             <SectionTitle icon={Shapes}>Cấu hình Nâng cao</SectionTitle>
                             <div className="grid grid-cols-2 gap-6">
                                <div 
                                  onClick={() => setExamData((p:any) => ({...p, includeScoreTable: !p.includeScoreTable}))}
                                  className={`p-6 rounded-3xl border-2 cursor-pointer transition-all group ${examData.includeScoreTable ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                     <div className={`p-2 rounded-xl ${examData.includeScoreTable ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'} transition-colors`}>
                                       <BarChart3 className="w-5 h-5" />
                                     </div>
                                     <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${examData.includeScoreTable ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                                        {examData.includeScoreTable && <Check className="w-4 h-4 text-white stroke-[4px]" />}
                                     </div>
                                  </div>
                                  <p className="font-bold text-slate-900 mb-1">Khung ghi điểm</p>
                                  <p className="text-xs text-slate-500 leading-relaxed">Hiển thị bảng tổng hợp điểm số cho giáo viên chấm bài.</p>
                                </div>

                                <div 
                                  onClick={() => setExamData((p:any) => ({...p, includeMatrix: !p.includeMatrix}))}
                                  className={`p-6 rounded-3xl border-2 cursor-pointer transition-all group ${examData.includeMatrix ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                     <div className={`p-2 rounded-xl ${examData.includeMatrix ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'} transition-colors`}>
                                       <Layout className="w-5 h-5" />
                                     </div>
                                     <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${examData.includeMatrix ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                                        {examData.includeMatrix && <Check className="w-4 h-4 text-white stroke-[4px]" />}
                                     </div>
                                  </div>
                                  <p className="font-bold text-slate-900 mb-1">Chèn Ma trận đề</p>
                                  <p className="text-xs text-slate-500 leading-relaxed">In kèm ma trận đề thi vào bản Word để chuẩn hóa quy trình.</p>
                                </div>
                             </div>
                           </div>
                        </div>

                        {/* Templates Column */}
                        <div className="lg:col-span-5 space-y-10">
                           <div>
                             <SectionTitle icon={Sparkles}>Mẫu & AI Quét</SectionTitle>
                             <div className="flex flex-col gap-6">
                               <div className="relative group overflow-hidden bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl transition-all hover:-translate-y-1">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full translate-x-10 -translate-y-10"></div>
                                  <h4 className="font-serif text-2xl font-bold mb-4 tracking-tight">AI Scanner</h4>
                                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">Dán nội dung tiêu đề đề thi cũ của bạn vào đây, AI sẽ tự động trích xuất các thông tin cần thiết.</p>
                                  <button 
                                    onClick={() => setShowScanner(true)}
                                    className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold shadow-lg shadow-black/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                                  >
                                    <Eye className="w-5 h-5" /> Bắt đầu Trích xuất AI
                                  </button>
                               </div>

                               <AcademicCard className="p-8">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Thư viện Mẫu chuẩn</p>
                                  <div className="space-y-3">
                                    {HEADER_TEMPLATES.map(tpl => (
                                      <button 
                                        key={tpl.id}
                                        onClick={() => applyTemplate(tpl.id)}
                                        className={`w-full p-4 rounded-2xl text-left border-2 transition-all relative group
                                          ${examData.templateId === tpl.id ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className={`font-bold text-sm tracking-tight ${examData.templateId === tpl.id ? 'text-indigo-600' : 'text-slate-700'}`}>{tpl.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">Bố cục tiêu chuẩn</p>
                                          </div>
                                          {examData.templateId === tpl.id ? (
                                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                              <Check className="w-3.5 h-3.5 text-white stroke-[4px]" />
                                            </div>
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                  <button 
                                    onClick={downloadSampleTemplate}
                                    className="w-full mt-6 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-all border border-slate-200/60"
                                  >
                                    <Download className="w-4 h-4" /> Tải tài liệu mẫu
                                  </button>
                               </AcademicCard>
                             </div>
                           </div>
                        </div>

                        {/* Scanner Modal Integration */}
                        <AnimatePresence>
                        {showScanner && (
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
                          >
                            <motion.div 
                              initial={{ scale: 0.95, y: 20 }}
                              animate={{ scale: 1, y: 0 }}
                              exit={{ scale: 0.95, y: 20 }}
                              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-10 space-y-8"
                            >
                              <div className="flex items-center justify-between">
                                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                                  <Sparkles className="w-6 h-6" />
                                </div>
                                <button onClick={() => setShowScanner(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400"/></button>
                              </div>
                              
                              <div>
                                <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Quét dữ liệu Đề thi</h3>
                                <p className="text-slate-500 text-sm">AI sẽ tự động nhận diện Trường, Môn học, Thời gian... từ văn bản bạn cung cấp.</p>
                              </div>

                              <textarea 
                                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm text-slate-700 focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all outline-none resize-none placeholder:text-slate-300"
                                placeholder="Dán phần tiêu đề đề thi tại đây... VD: PHÒNG GIÁO DỤC VÀ ĐÀO TẠO QUẬN X... ĐỀ KIỂM TRA HỌC KỲ I..."
                                value={scanText}
                                onChange={(e) => setScanText(e.target.value)}
                              ></textarea>

                              <button 
                                onClick={handleScanTemplate}
                                disabled={isAnalyzingTemplate || !scanText.trim()}
                                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                              >
                                {isAnalyzingTemplate ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                                {isAnalyzingTemplate ? 'Đang phân tích...' : 'Bắt đầu Phân tích AI'}
                              </button>
                            </motion.div>
                          </motion.div>
                        )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div className="flex-1 overflow-auto p-8 lg:p-16 custom-scrollbar animate-in fade-in slide-in-from-right-8 duration-700">
                      <div className="max-w-6xl mx-auto space-y-10">
                        <div className="flex items-center justify-between">
                           <div>
                             <SectionTitle icon={Layout}>Ma trận Phân bổ Ma trận nhận thức</SectionTitle>
                             <p className="text-slate-500 text-sm -mt-2">Xác định số lượng câu hỏi cho từng chủ đề và mức độ nhận thức (NB, TH, VD, VDC).</p>
                           </div>
                           <button 
                             onClick={addMatrixRow}
                             className="px-6 py-3 bg-white text-indigo-600 border border-indigo-100 rounded-2xl font-bold shadow-sm hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm"
                           >
                             <Plus className="w-5 h-5" /> Thêm Chủ đề
                           </button>
                        </div>

                        <AcademicCard className="overflow-hidden p-0 border-none shadow-2xl relative">
                          <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                             <div className="min-w-[800px]">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-800 text-white font-serif tracking-tight">
                                      <th className="px-6 py-5 font-bold text-sm">Nội dung / Chủ đề</th>
                                      <th className="px-4 py-5 font-bold text-sm text-center">Nhận biết</th>
                                      <th className="px-4 py-5 font-bold text-sm text-center">Thông hiểu</th>
                                      <th className="px-4 py-5 font-bold text-sm text-center">Vận dụng</th>
                                      <th className="px-4 py-5 font-bold text-sm text-center">VD Cao</th>
                                      <th className="px-6 py-5 font-bold text-sm text-center w-16"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {examData.matrix.map((row: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                          <input 
                                            type="text" 
                                            value={row.topic} 
                                            onChange={(e) => updateMatrix(idx, 'topic', e.target.value)}
                                            placeholder="Tên chủ đề hoặc bài học..."
                                            className="w-full bg-transparent border-none outline-none font-bold text-slate-700 placeholder:text-slate-300 focus:text-blue-600 transition-colors"
                                          />
                                        </td>
                                        {[
                                          { field: 'nb', color: 'bg-white text-black font-bold ring-emerald-200 focus:ring-emerald-400' },
                                          { field: 'th', color: 'bg-blue-50 text-blue-700 ring-blue-200 focus:ring-blue-400' },
                                          { field: 'vd', color: 'bg-amber-50 text-amber-700 ring-amber-200 focus:ring-amber-400' },
                                          { field: 'vdc', color: 'bg-rose-50 text-rose-700 ring-rose-200 focus:ring-rose-400' }
                                        ].map((col) => (
                                          <td key={col.field} className="px-4 py-4">
                                            <div className="flex items-center justify-center">
                                              <input 
                                                type="number" 
                                                value={row[col.field] === 0 ? '' : row[col.field]} 
                                                onChange={(e) => updateMatrix(idx, col.field, parseInt(e.target.value) || 0)}
                                                className={`w-14 text-center rounded-xl py-2 font-black text-sm outline-none transition-all ring-1 focus:ring-2 focus:bg-white ${col.color}`}
                                                placeholder="0"
                                              />
                                            </div>
                                          </td>
                                        ))}
                                        <td className="px-6 py-4 text-center">
                                          <button 
                                            onClick={() => removeMatrixRow(idx)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-slate-50/80 font-bold backdrop-blur-sm border-t border-slate-200">
                                      <td className="px-6 py-5 text-blue-600 font-serif text-lg">Tổng số câu</td>
                                      {['nb', 'th', 'vd', 'vdc'].map(field => (
                                        <td key={field} className="px-4 py-5 text-center">
                                          <div className="inline-block px-4 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900 font-black text-base">
                                            {examData.matrix.reduce((sum: number, row: any) => sum + (row[field] || 0), 0)}
                                          </div>
                                        </td>
                                      ))}
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                             </div>
                          </div>
                        </AcademicCard>

                        <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 mt-10 shadow-2xl shadow-blue-600/20">
                           <div className="space-y-2">
                              <h3 className="text-2xl font-serif font-bold tracking-tight">Tổng quan Ma trận</h3>
                              <p className="text-blue-100 text-sm font-medium">Bạn đã phân bổ tổng cộng <span className="text-white text-lg font-black underline underline-offset-4 decoration-blue-300">{examData.matrix.reduce((sum: number, row: any) => sum + (row.nb||0) + (row.th||0) + (row.vd||0) + (row.vdc||0), 0)}</span> câu hỏi.</p>
                           </div>
                           <button 
                             onClick={() => setWizardStep(3)}
                             className="px-10 py-5 bg-white text-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                           >
                             Vào phần Đặc tả AI
                           </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="flex-1 overflow-auto p-8 lg:p-16 custom-scrollbar animate-in fade-in slide-in-from-right-8 duration-700">
                       <div className="max-w-4xl mx-auto space-y-10 bg-white p-10 lg:p-14 rounded-[3rem] shadow-2xl border border-slate-100 text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10"></div>
                        
                        <div className="flex items-center gap-6 pb-10 border-b border-slate-100 mb-10">
                          <div className="w-16 h-16 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-600/30 shrink-0 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                            <Sparkles className="w-8 h-8" />
                          </div>
                          <div>
                            <h2 className="text-3xl font-serif font-bold text-slate-900 tracking-tight leading-tight">3. Sinh đề Thông minh</h2>
                            <p className="text-slate-500 text-sm mt-1 max-w-md">Gemini AI sẽ dựa trên ma trận và đặc tả của bạn để xây dựng bộ câu hỏi chuẩn hóa nhất.</p>
                          </div>
                        </div>

                        <div className="space-y-10">
                          <div>
                            <div className="flex items-center justify-between mb-4">
                               <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block">Nội dung Đặc tả chi tiết:</label>
                               <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[9px] font-bold uppercase">AI Recommended</span>
                            </div>
                            <textarea 
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              placeholder="Ví dụ: Đề thi học kỳ 1, khối 9. Tập trung vào lập trình Scratch: biến số, danh sách và vẽ hình cơ bản. Bao gồm 10 câu trắc nghiệm và 2 câu tự luận thực hành..."
                              className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-3xl p-8 text-sm text-slate-700 min-h-[220px] outline-none focus:ring-8 focus:ring-blue-600/5 focus:border-blue-600 transition-all resize-none shadow-inner placeholder:text-slate-300 font-medium"
                            ></textarea>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-10 items-end">
                            <div className="space-y-6">
                               <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block">Mức độ Thử thách:</label>
                               <div className="grid grid-cols-3 gap-3">
                                 <DifficultyBtn label="A (Dễ)" active={aiDifficulty === 'Easy'} onClick={() => setAiDifficulty('Easy')} />
                                 <DifficultyBtn label="B (Vừa)" active={aiDifficulty === 'Medium'} onClick={() => setAiDifficulty('Medium')} />
                                 <DifficultyBtn label="C (Khó)" active={aiDifficulty === 'Hard'} onClick={() => setAiDifficulty('Hard')} />
                                </div>
                            </div>
                            <button 
                              onClick={handleGenerateAI}
                              disabled={isGenerating || !aiPrompt.trim()}
                              className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center justify-center gap-4 disabled:opacity-50 transition-all hover:bg-blue-700 active:scale-95 group relative overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                              <span>{isGenerating ? "Hệ thống đang sinh dữ liệu..." : "Bắt đầu Sinh đề với AI"}</span>
                            </button>
                          </div>
                        </div>
                       </div>
                    </div>
                  )}

                  {wizardStep === 4 && (
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50 animate-in fade-in slide-in-from-right-12 duration-1000">
                       <div className="flex-1 overflow-auto p-10 lg:p-16 custom-scrollbar">
                          <div className="max-w-4xl mx-auto space-y-12">
                             <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
                                <div className="flex items-center gap-5">
                                   <div className="w-12 h-12 bg-white text-emerald-600 rounded-2xl flex items-center justify-center">
                                      <CheckCircle2 className="w-6 h-6" />
                                   </div>
                                   <div>
                                      <h2 className="text-2xl font-serif font-bold text-slate-900 leading-tight">Hoàn tất Đề thi</h2>
                                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Review & Finalize</p>
                                   </div>
                                </div>
                                <div className="flex items-center gap-3">
                                   <button 
                                     onClick={() => {
                                       if (!jsonEditMode) setRawJsonContent(JSON.stringify(examData.sections, null, 2));
                                       else handleSaveParsedJson();
                                       setJsonEditMode(!jsonEditMode);
                                     }}
                                     className={`px-6 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 ${jsonEditMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                   >
                                     {jsonEditMode ? <Save className="w-4 h-4"/> : <Code className="w-4 h-4"/>}
                                     {jsonEditMode ? 'Áp dụng Thay đổi' : 'Sửa JSON Trực tiếp'}
                                   </button>
                                </div>
                             </div>

                             {jsonEditMode ? (
                                <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-800">
                                   <div className="bg-slate-800/80 px-8 py-4 border-b border-white/5 flex items-center gap-3">
                                      <div className="flex gap-1.5">
                                         <div className="w-3 h-3 rounded-full bg-rose-500/80 shadow-lg shadow-rose-500/20"></div>
                                         <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-lg shadow-amber-500/20"></div>
                                         <div className="w-3 h-3 rounded-full bg-white0/80 shadow-lg shadow-emerald-500/20"></div>
                                      </div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Source Code Editor</span>
                                   </div>
                                   <textarea 
                                     value={rawJsonContent}
                                     onChange={(e) => setRawJsonContent(e.target.value)}
                                     className="w-full h-[700px] bg-transparent text-emerald-400 p-10 font-mono text-sm outline-none resize-none scrollbar-invert"
                                     spellCheck={false}
                                   />
                                </div>
                             ) : (
                                <div className="space-y-12 pb-20">
                                   {examData.sections?.map((sec: any, sIdx: number) => (
                                      <div key={sIdx} className="space-y-8">
                                         <div className="flex items-center gap-6">
                                            <div className="h-10 px-6 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest shadow-2xl">
                                               {sec.title}
                                            </div>
                                            <div className="flex-1 h-[2px] bg-slate-100 rounded-full"></div>
                                         </div>
                                         
                                         {sec.type === 'multiple_choice' && sec.questions?.length > 0 && (
                                            <div className="mb-6 px-4">
                                               <p className="italic mb-2 text-sm text-center">Em hãy chọn đáp án đúng nhất và điền vào bảng trả lời dưới đây:</p>
                                               <div className="w-full border-[1.5px] border-black overflow-hidden font-serif">
                                                 <table className="w-full border-collapse text-center table-fixed">
                                                   <tbody>
                                                     <tr className="border-b-[1.5px] border-black">
                                                       <td className="border-r-[1.5px] border-black font-bold p-2 bg-slate-50 w-20">Câu</td>
                                                       {sec.questions.map((_:any, i:number) => (
                                                         <td key={"h-"+i} className="border-r-[1.5px] last:border-r-0 border-black p-2 text-sm font-bold">{i+1}</td>
                                                       ))}
                                                     </tr>
                                                     <tr className="h-10">
                                                       <td className="border-r-[1.5px] border-black font-bold p-2 bg-slate-50">Đáp án</td>
                                                       {sec.questions.map((_:any, i:number) => (
                                                         <td key={"a-"+i} className="border-r-[1.5px] last:border-r-0 border-black p-2"></td>
                                                       ))}
                                                     </tr>
                                                   </tbody>
                                                 </table>
                                               </div>
                                            </div>
                                         )}

                                         <div className="grid grid-cols-1 gap-8">
                                            {sec.questions?.map((q: any, qIdx: number) => (
                                              <QuestionCard key={`${sIdx}-${qIdx}`} q={q} type={sec.type} number={qIdx + 1} />
                                            ))}
                                         </div>
                                      </div>
                                   ))}
                                   
                                   {(!examData.sections || examData.sections.length === 0) && (
                                     <div className="bg-white p-24 rounded-[3.5rem] text-center border-2 border-dashed border-slate-100 shadow-inner">
                                       <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                                          <Sparkles className="w-12 h-12 text-slate-200" />
                                       </div>
                                       <h3 className="text-xl font-bold text-slate-400 mb-2 font-serif">Chưa có nội dung Đề thi</h3>
                                       <p className="text-slate-300 text-sm max-w-xs mx-auto leading-relaxed">Hãy sử dụng bảng đặc tả ở bước 3 để trợ lý AI soạn nội dung cho bạn.</p>
                                     </div>
                                   )}
                                </div>
                             )}
                          </div>
                       </div>

                       {/* Sidebar Panel: Final Actions */}
                       <div className="w-full lg:w-[340px] bg-white border-l border-slate-100 flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.05)] z-20 shrink-0 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>

                          
                          <div className="p-10 border-b border-slate-50 flex items-center justify-between relative z-10">
                             <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-900 text-indigo-400 rounded-2xl shadow-xl">
                                   <Eye className="w-5 h-5" />
                                </div>
                                <div>
                                   <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] block leading-none mb-1">Preview</span>
                                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bản in mô phỏng</span>
                                </div>
                             </div>
                          </div>

                          <div className="flex-1 overflow-auto p-10 bg-slate-50/30 space-y-10 custom-scrollbar relative z-10">
                             {/* Paper Preview Card */}
                             <div className="bg-white aspect-[21/29.7] shadow-[0_30px_70px_rgba(0,0,0,0.1)] rounded-md p-10 origin-top transform transition-all hover:scale-[1.03] cursor-zoom-in relative group overflow-hidden border border-slate-100">
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="h-full bg-white p-4 text-[4.5px] text-black pointer-events-none font-serif leading-relaxed overflow-hidden">
                                   {/* Header Table Simulate */}
                                   <table className="w-full table-fixed border-collapse mb-4">
                                      <tbody>
                                         <tr>
                                            <td className="w-1/2 text-center align-top pr-1">
                                               <p className="font-bold uppercase tracking-tighter text-[5px]">{examData.headerConfig.school}</p>
                                               <p>Lớp: {examData.headerConfig.class}</p>
                                               <p>Họ và tên: ...............................</p>
                                            </td>
                                            <td className="w-1/2 text-center align-top pl-1">
                                               <p className="font-bold uppercase tracking-tighter text-[5px]">{examData.headerConfig.examTitle}</p>
                                               <p>Môn: {examData.headerConfig.subject}</p>
                                               <p className="italic">Thời gian làm bài: 45 Phút</p>
                                            </td>
                                         </tr>
                                      </tbody>
                                   </table>

                                   {/* Score Table Simulate */}
                                   <table className="w-full table-fixed border-collapse border border-black mb-6">
                                      <tbody>
                                         <tr>
                                            <td className="w-1/4 border border-black align-top text-center p-1.5 h-12">
                                               <p className="font-bold italic underline">Điểm</p>
                                            </td>
                                            <td className="w-3/4 border border-black align-top p-1.5 h-12">
                                               <p className="italic underline opacity-80">Lời nhận xét của thầy (cô) giáo:</p>
                                            </td>
                                         </tr>
                                      </tbody>
                                   </table>

                                   <p className="text-center font-bold underline mb-4 tracking-widest text-[6px]">ĐỀ BÀI</p>

                                   <div className="space-y-4">
                                      <p className="font-bold">I. PHẦN TRẮC NGHIỆM NHIỀU LỰA CHỌN</p>
                                      <table className="w-full border-collapse border border-slate-300 text-center mb-4">
                                         <tbody>
                                            <tr className="bg-slate-50"><td className="border border-slate-300 font-bold p-1">Câu</td><td className="border border-slate-300 font-bold p-1 w-6">1</td><td className="border border-slate-300 font-bold p-1 w-6">2</td><td className="border border-slate-300 font-bold p-1 w-6">3</td></tr>
                                            <tr><td className="border border-slate-300 font-bold p-1">Đáp án</td><td className="border border-slate-300 p-1"></td><td className="border border-slate-300 p-1"></td><td className="border border-slate-300 p-1"></td></tr>
                                         </tbody>
                                      </table>
                                      <div className="space-y-2">
                                         <p>Câu 1: Câu hỏi mẫu xuất hiện ở đây...</p>
                                         <div className="grid grid-cols-4 gap-1">
                                            <p><span className="font-bold">A.</span> Đáp án</p>
                                            <p><span className="font-bold">B.</span> Đáp án</p>
                                            <p><span className="font-bold">C.</span> Đáp án</p>
                                            <p><span className="font-bold">D.</span> Đáp án</p>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>

                             <div className="p-6 bg-slate-800 rounded-[2rem] text-white shadow-2xl relative overflow-visible group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700"></div>
                                <div className="relative z-10">
                                   <div className="flex items-center gap-4 mb-4">
                                      <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md"><Download className="w-4 h-4 text-sky-300"/></div>
                                      <div>
                                         <span className="font-serif font-bold text-base block leading-none mb-1">Xuất bản Đề thi</span>
                                      </div>
                                   </div>
                                   
                                   <div className="relative group/dropdown mt-6">
                                     <button 
                                       className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs hover:bg-blue-500 transition-all flex items-center justify-between px-5 shadow-[0_10px_20px_rgba(37,99,235,0.2)] active:scale-95 disabled:opacity-50"
                                     >
                                       <div className="flex items-center gap-2">
                                          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                                          <span>Tải xuống đề thi...</span>
                                       </div>
                                       <ChevronDown className="w-4 h-4 opacity-70 group-hover/dropdown:rotate-180 transition-transform"/>
                                     </button>
                                     
                                     {/* Dropdown Menu */}
                                     <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-100 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all translate-y-2 group-hover/dropdown:translate-y-0 z-50 overflow-hidden">
                                        <button onClick={generateWordDoc} disabled={loading} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 group/btn transition-colors">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover/btn:scale-110 transition-transform"><FileText className="w-4 h-4"/></div>
                                            <div>
                                              <p className="text-sm font-bold text-slate-800">Bản in Word (.docx)</p>
                                              <p className="text-[10px] text-slate-500 font-medium">Định dạng tiêu chuẩn 2026</p>
                                            </div>
                                        </button>
                                        <button onClick={() => {
                                          const blob = new Blob([JSON.stringify(examData, null, 2)], { type: "application/json" });
                                          saveAs(blob, "exam-data-backup.json");
                                        }} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-3 group/btn transition-colors">
                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover/btn:scale-110 transition-transform"><Database className="w-4 h-4"/></div>
                                            <div>
                                              <p className="text-sm font-bold text-slate-800">Dữ liệu thô (.JSON)</p>
                                              <p className="text-[10px] text-slate-500 font-medium">Lưu trữ máy chủ kỹ thuật</p>
                                            </div>
                                        </button>
                                     </div>
                                   </div>
                                </div>
                             </div>

                             {/* Helper Tip */}
                             <div className="p-6 border border-slate-200 rounded-3xl bg-white flex items-start gap-4">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0"><AlertCircle className="w-4 h-4"/></div>
                                <p className="text-[10px] text-slate-500 leading-normal font-medium"><b>Lưu ý:</b> Các khối lệnh Scratch sẽ được hệ thống chuyển đổi tự động thành hình ảnh minh họa độ phân giải cao trong bản in.</p>
                             </div>
                          </div>
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
                  toast.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' :
                  toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
                  'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {toast.type === 'success' && <Check className="w-5 h-5 text-emerald-600" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                {toast.type === 'info' && <Sparkles className="w-5 h-5 text-blue-600" />}
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
      className={`w-full flex items-center justify-center lg:justify-start gap-4 p-3.5 rounded-2xl transition-all relative group
        ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-blue-50 text-slate-500 hover:text-blue-600'}`}
    >
      <div className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'} transition-colors`}>{icon}</div>
      <span className={`hidden lg:block font-bold text-sm tracking-tight ${active ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'} transition-colors`}>{label}</span>
      {active && <motion.div layoutId="activeNav" className="absolute -left-1 w-2 h-8 bg-blue-400 rounded-r-full blur-[1px]" />}
    </button>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: string, icon: any, trend?: string }) {
  return (
    <AcademicCard className="p-6 flex items-start gap-6 group">
      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:rotate-6 transition-transform duration-500 shadow-inner">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
          {trend && <span className="text-[10px] font-bold text-emerald-500 bg-white px-1.5 py-0.5 rounded uppercase">{trend}</span>}
        </div>
      </div>
    </AcademicCard>
  );
}

function WizardStep({ step, current, label }: { step: number, current: number, label: string }) {
  const completed = step < current;
  const active = step <= current;
  const isCurrent = step === current;
  return (
    <div className={`flex flex-col items-center gap-2 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-20'}`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 
        ${completed ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 
          isCurrent ? 'bg-white text-blue-600 ring-2 ring-blue-600 shadow-xl scale-110' : 
          'bg-slate-100 text-slate-400'}`}>
        {completed ? <Check className="w-5 h-5 stroke-[3px]" /> : step}
      </div>
      <div className="hidden md:block text-center">
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-0.5 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`}>Bước {step}</span>
        <span className={`text-xs font-bold whitespace-nowrap ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
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
        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all shadow-sm"
      />
    </div>
  );
}

function DifficultyBtn({ label, active, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full py-4 rounded-xl font-bold transition-all border ${active ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 transform scale-[1.02]' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'}`}>
      {label}
    </button>
  );
}

function QuestionCard({ q, type, number }: { q: any, type: string, number: number | string, key?: React.Key }) {
  const typeLabels: Record<string, string> = {
    multiple_choice: 'Câu hỏi Trắc nghiệm',
    true_false: 'Câu hỏi Đúng/Sai',
    matching: 'Câu hỏi Ghép nối',
    fill_in_the_blanks: 'Câu hỏi Điền khuyết',
    essay: 'Câu hỏi Tự luận'
  };

  const typeColors: Record<string, string> = {
    multiple_choice: 'bg-blue-50 text-blue-700 border-blue-100',
    true_false: 'bg-white text-black font-bold border-emerald-100',
    matching: 'bg-amber-50 text-amber-700 border-amber-100',
    fill_in_the_blanks: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
    essay: 'bg-rose-50 text-rose-700 border-rose-100'
  };

  return (
    <AcademicCard className="p-8 group relative overflow-visible">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-xl shadow-slate-900/10">
            {number}
          </div>
          <div>
            <span className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full border ${typeColors[type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {typeLabels[type] || type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
           <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-indigo-600 border border-transparent hover:border-slate-200"><Settings className="w-4 h-4"/></button>
           <button className="p-2 hover:bg-rose-50 rounded-xl transition-colors text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-200"><Trash2 className="w-4 h-4"/></button>
        </div>
      </div>
      
      <div className="text-slate-900 font-bold text-lg mb-6 leading-relaxed">
        <FormattedText text={q.question} />
      </div>

      {/* Multiple Choice Options */}
      {type === 'multiple_choice' && q.options && (() => {
        const isShort = q.options.join(' ').length < 50;
        const gridCols = isShort && q.options.length === 4 ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-2';
        return (
         <div className={`grid ${gridCols} gap-4`}>
          {q.options.map((o: string, i: number) => {
             const prefix = String.fromCharCode(65 + i);
             const isAnswer = q.answer === prefix || (typeof q.answer === 'string' && q.answer.startsWith(prefix));
             return (
               <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all ${isAnswer ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-slate-50/50 border-slate-100 hover:border-indigo-200'}`}>
                 <span className={`font-black text-sm ${isAnswer ? 'text-black font-bold' : 'text-slate-900'}`}>{prefix}.</span>
                 <span className={`text-sm font-medium ${isAnswer ? 'text-emerald-900' : 'text-slate-700'}`}>{String(o).replace(/^[A-D](\.|\)) /, '')}</span>
               </div>
             )
          })}
        </div>
        )
      })()}

      {/* True / False Statements */}
      {type === 'true_false' && q.statements && (
         <div className="space-y-3">
            {q.statements.map((st: any, i: number) => (
               <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 transition-all">
                 <div className="flex items-center gap-3">
                   <span className="w-6 h-6 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center text-[10px] font-black">{String.fromCharCode(97 + i)}</span>
                   <span className="text-sm font-bold text-slate-700">{st.text}</span>
                 </div>
                 <span className={`font-black px-4 py-1.5 rounded-xl text-[10px] uppercase tracking-widest border-2 ${st.answer ? 'bg-white border-emerald-500 text-black font-bold' : 'bg-rose-50 border-rose-500 text-rose-700'}`}>
                   {st.answer ? 'Đúng' : 'Sai'}
                 </span>
               </div>
            ))}
         </div>
      )}

      {/* Matching Pairs */}
      {type === 'matching' && q.left && q.right && (
         <div className="grid grid-cols-2 gap-8 relative">
            <div className="space-y-3">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2 text-center">Cột A</p>
               {q.left.map((l: string, i: number) => (
                 <div key={i} className="p-4 bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-3">
                   <span className="font-black text-xs text-indigo-600">{i+1}.</span>
                   <span className="text-sm font-bold text-slate-700">{l}</span>
                 </div>
               ))}
            </div>
            <div className="space-y-3">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2 text-center">Cột B</p>
               {q.right.map((r: string, i: number) => (
                 <div key={i} className="p-4 bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-3">
                   <span className="font-black text-xs text-indigo-600">{String.fromCharCode(65 + i)}.</span>
                   <span className="text-sm font-bold text-slate-700">{r}</span>
                 </div>
               ))}
            </div>
         </div>
      )}
    </AcademicCard>
  );
}
