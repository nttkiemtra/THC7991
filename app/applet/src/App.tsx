import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, FileText, Loader2, Save, FolderOpen, 
  LogIn, LogOut, Trash2, Plus, Sparkles, ChevronRight, 
  Layout, Settings, Database, Edit3, Eye, Printer, X, Check, ChevronLeft, Play, AlertCircle,
  Shapes, GraduationCap, BookOpen, Clock, Users, BarChart3, Search, ChevronDown, CheckCircle2, Code,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Image as ImageIcon, Table as TableIcon,
  Copy, CheckSquare, Info, ClipboardCopy, HelpCircle, ArrowRight, Sliders, Settings2, Trash
} from 'lucide-react';
import { auth, loginWithGoogle, saveExamConfig, getExamConfigs, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import scratchblocks from 'scratchblocks';
import { processPayloadForScratchImages } from './scratchImageExtractor';
import { saveAs } from 'file-saver';

// --- COMPONENTS HỖ TRỢ ---
const ScratchBlock = ({ code }: { code: string; key?: string | number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
       containerRef.current.innerHTML = '';
       try {
           const parsed = scratchblocks.parse(code, { languages: ['en'] });
           const view = scratchblocks.newView(parsed, { style: 'scratch3' });
           const svg = view.render();
           svg.style.display = 'block';
           svg.style.margin = '10px 0';
           svg.style.maxWidth = '100%';
           containerRef.current.appendChild(svg);
       } catch (e) {
           console.error("Scratch render error", e);
           const pre = document.createElement('pre');
           pre.className = "bg-red-50 text-red-600 p-2 text-xs rounded border border-red-200 font-mono";
           pre.innerText = code;
           containerRef.current.appendChild(pre);
       }
    }
  }, [code]);
  return <div ref={containerRef} className="scratch-container my-2 text-left" />;
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
          return <span key={idx} dangerouslySetInnerHTML={{ __html: part }} />;
       })}
    </>
  );
};

const HEADER_TEMPLATES = [
  {
    id: 'standard_thcs',
    name: 'THCS Chuẩn',
    config: {
      school: "TRƯỜNG THCS CHU VĂN AN",
      class: "Lớp: 6A...",
      student: "Họ và tên học sinh: ..........................................",
      examTitle: "BÀI KIỂM TRA ĐỊNH KỲ CUỐI HỌC KỲ II",
      subject: "MÔN: TIN HỌC 6",
      time: "Thời gian làm bài: 45 Phút (Không kể thời gian phát đề)"
    }
  },
  {
    id: 'primary',
    name: 'Tiểu học',
    config: {
      school: "TRƯỜNG TIỂU HỌC NGUYỄN DU",
      class: "Lớp: 4...",
      student: "Họ và tên học sinh: .................................",
      examTitle: "KIỂM TRA ĐỊNH KỲ CUỐI HỌC KỲ I",
      subject: "MÔN: TIN HỌC KHỐI 4",
      time: "Thời gian: 35 Phút"
    }
  },
  {
    id: 'highschool',
    name: 'THPT Chuẩn',
    config: {
      school: "TRƯỜNG THPT CHUYÊN HÀ NỘI - AMSTERDAM",
      class: "Lớp: 10 Tin...",
      student: "Họ và tên học sinh: ..........................................",
      examTitle: "BÀI KIỂM TRA HỌC KỲ II",
      subject: "MÔN: TIN HỌC LỚP 10",
      time: "Thời gian làm bài: 45 Phút"
    }
  }
];

const QUICK_PROMPTS = [
  {
    title: "Sơ tư duy & Vẽ tranh cơ bản (Tin 6)",
    text: "Tạo 4 câu trắc nghiệm và 2 câu đúng sai về Khái niệm sơ đồ tư duy, các thành phần của sơ đồ tư duy (Chủ đề chính, nhánh, từ khóa). Kèm theo 1 câu lập trình kéo thả Scratch đơn giản di chuyển nhân vật vẽ hình tam giác đều."
  },
  {
    title: "Thuật toán & Scratch vẽ hình (Tin 7)",
    text: "Tạo đề thi tin học lớp 7 học kỳ 2: Lý thuyết thuật toán tuần tự, rẽ nhánh, lặp. Thêm code Scratch [scratch] when green flag clicked \n repeat 4 \n move 100 steps \n turn 90 degrees [/scratch] hỏi xem hình gì được vẽ ra và cách tính biến số điểm."
  },
  {
    title: "Bảng tính điện tử Excel cơ bản (Tin 8)",
    text: "Đề kiểm tra Tin học 8: Cách sử dụng các hàm SUM, AVERAGE, MIN, MAX trong Excel. Thêm bảng số liệu mô tả 4 hàng 3 cột để học sinh tính toán."
  },
  {
    title: "Mạng máy tính & Internet (Tin 9)",
    text: "Bộ câu hỏi trắc nghiệm khách quan kết hợp tự luận về Khái niệm thư điện tử, cách hoạt động của mạng LAN, cấu trúc của một địa chỉ website URL chính xác."
  }
];

const SAMPLE_NUMERIC_MATRIX = [
  {
    tt: "1",
    topic: "Chủ đề A. Máy tính và cộng đồng",
    knowledgeUnit: "Lịch sử và sự phát triển của máy tính",
    assessmentLevel: "Nhận biết các mốc lịch sử phát triển của máy tính; thông hiểu sự thay đổi về kích thước và tốc độ xử lý.",
    levels: {
      d1: { nb: "3", th: "2", vd: "1" },
      d2: { nb: "0", th: "0", vd: "0" },
      d3: { nb: "0", th: "0", vd: "0" },
      d4: { nb: "0", th: "0", vd: "0" },
      d5: { nb: "0", th: "0", vd: "1" }
    }
  },
  {
    tt: "2",
    topic: "Chủ đề D. Đạo đức, pháp luật và văn hóa trong môi trường số",
    knowledgeUnit: "Bản quyền và an toàn thông tin khi chia sẻ",
    assessmentLevel: "Nhận biết hành vi vi phạm bản quyền thông tin số; thông hiểu các biện pháp bảo vệ mật khẩu cá nhân.",
    levels: {
      d1: { nb: "2", th: "2", vd: "0" },
      d2: { nb: "1", th: "1", vd: "0" },
      d3: { nb: "0", th: "0", vd: "0" },
      d4: { nb: "0", th: "0", vd: "0" },
      d5: { nb: "1", th: "0", vd: "0" }
    }
  },
  {
    tt: "3",
    topic: "Chủ đề F. Giải quyết vấn đề với máy tính",
    knowledgeUnit: "Sử dụng bảng tính nâng cao (Excel)",
    assessmentLevel: "Nhận biết các hàm đếm điều kiện COUNTIF, SUMIF; thông hiểu cách phối hợp lọc và sắp xếp dữ liệu; vận dụng tính điểm trung bình học kỳ.",
    levels: {
      d1: { nb: "3", th: "2", vd: "1" },
      d2: { nb: "0", th: "1", vd: "0" },
      d3: { nb: "1", th: "0", vd: "0" },
      d4: { nb: "1", th: "0", vd: "0" },
      d5: { nb: "0", th: "1", vd: "1" }
    }
  }
];

const SAMPLE_DESC_MATRIX = [
  {
    tt: "1",
    topic: "Chủ đề A. Máy tính và cộng đồng",
    knowledgeUnit: "Sự phát triển của máy tính",
    assessmentLevel: "Nhận biết (d1: C1); Thông hiểu (d1: C5); Vận dụng thấp (d1: C9)",
    levels: {
      d1: { nb: "C1", th: "C5", vd: "C9" },
      d2: { nb: "", th: "", vd: "" },
      d3: { nb: "", th: "", vd: "" },
      d4: { nb: "", th: "", vd: "" },
      d5: { nb: "", th: "", vd: "" }
    }
  },
  {
    tt: "2",
    topic: "Chủ đề B. Lưu trữ và chia sẻ thông tin",
    knowledgeUnit: "Thông tin trên trang web",
    assessmentLevel: "Nhận biết cấu trúc địa chỉ web (d1: C2, d4: C16*); Thông hiểu tìm kiếm nâng cao (d1: C6)",
    levels: {
      d1: { nb: "C2", th: "C6", vd: "" },
      d2: { nb: "", th: "", vd: "" },
      d3: { nb: "", th: "", vd: "" },
      d4: { nb: "C16*", th: "", vd: "" },
      d5: { nb: "", th: "", vd: "" }
    }
  },
  {
    tt: "3",
    topic: "Chủ đề D. Đạo đức, pháp luật và văn hóa trong môi trường số",
    knowledgeUnit: "Bản quyền thông tin số",
    assessmentLevel: "Nhận biết vi phạm bản quyền (d1: C3); Thông hiểu bảo mật tài sản trí tuệ (d1: C7, d3: C15*)",
    levels: {
      d1: { nb: "C3", th: "C7", vd: "" },
      d2: { nb: "", th: "", vd: "" },
      d3: { nb: "", th: "C15*", vd: "" },
      d4: { nb: "", th: "", vd: "" },
      d5: { nb: "", th: "", vd: "" }
    }
  },
  {
    tt: "4",
    topic: "Chủ đề F. Giải quyết vấn đề với máy tính",
    knowledgeUnit: "Làm quen với sơ đồ tư duy",
    assessmentLevel: "Nhận biết khái niệm phần mềm sơ đồ tư duy (d2: C13*); Vận dụng công cụ phác thảo (d1: C10)",
    levels: {
      d1: { nb: "", th: "", vd: "C10" },
      d2: { nb: "C13*", th: "", vd: "" },
      d3: { nb: "", th: "", vd: "" },
      d4: { nb: "", th: "", vd: "" },
      d5: { nb: "", th: "", vd: "" }
    }
  },
  {
    tt: "5",
    topic: "Chủ đề F. Giải quyết vấn đề với máy tính",
    knowledgeUnit: "Sử dụng bảng tính nâng cao",
    assessmentLevel: "Nhận biết các hàm số (d1: C4); Thông hiểu bộ lọc dữ liệu (d1: C8, d2: C14*)",
    levels: {
      d1: { nb: "C4", th: "C8", vd: "" },
      d2: { nb: "", th: "C14*", vd: "" },
      d3: { nb: "", th: "", vd: "" },
      d4: { nb: "", th: "", vd: "" },
      d5: { nb: "", th: "", vd: "" }
    }
  },
  {
    tt: "6",
    topic: "Chủ đề F. Giải quyết vấn đề với máy tính",
    knowledgeUnit: "Lập trình trực quan Scratch",
    assessmentLevel: "Nhận biết kịch bản chuyển động (d5: C17 1.0đ); Thông hiểu khối lệnh repeat lặp (d1: C11)",
    levels: {
      d1: { nb: "", th: "C11", vd: "" },
      d2: { nb: "", th: "", vd: "" },
      d3: { nb: "", th: "", vd: "" },
      d4: { nb: "", th: "", vd: "" },
      d5: { nb: "C17 1.0đ", th: "", vd: "" }
    }
  },
  {
    tt: "7",
    topic: "Chủ đề F. Giải quyết vấn đề với máy tính",
    knowledgeUnit: "Phát triển chương trình trò chơi",
    assessmentLevel: "Vận dụng cao lập trình thuật toán điều khiển sự rẽ nhánh (d1: C12, d5: C18 2.0đ)",
    levels: {
      d1: { nb: "", th: "", vd: "C12" },
      d2: { nb: "", th: "", vd: "" },
      d3: { nb: "", th: "", vd: "" },
      d4: { nb: "", th: "", vd: "" },
      d5: { nb: "", th: "", vd: "C18 2.0đ" }
    }
  }
];

const INITIAL_EXAM_DATA = {
  templateId: 'standard_thcs',
  includeScoreTable: true,
  includeMatrix: true,
  headerConfig: HEADER_TEMPLATES[0].config,
  matrix: [
    { 
      tt: "1", 
      topic: "Ứng dụng tin học", 
      knowledgeUnit: "Sơ đồ tư duy",
      assessmentLevel: "Biết: Khái niệm sơ đồ tư duy; Các thành phần cơ bản của sơ đồ tư duy...",
      levels: {
        d1: { nb: "2", th: "1", vd: "0" },
        d2: { nb: "1", th: "0", vd: "0" },
        d3: { nb: "0", th: "0", vd: "0" },
        d4: { nb: "0", th: "0", vd: "0" },
        d5: { nb: "0", th: "0", vd: "0" }
      }
    },
    { 
      tt: "2", 
      topic: "Thuật toán & Lập trình", 
      knowledgeUnit: "Ngôn ngữ kéo thả Scratch",
      assessmentLevel: "Hiểu: Cấu trúc biến lặp; Vận dụng vẽ hình học hình vuông, hình tam giác đều...",
      levels: {
        d1: { nb: "1", th: "2", vd: "0" },
        d2: { nb: "0", th: "1", vd: "1" },
        d3: { nb: "0", th: "0", vd: "0" },
        d4: { nb: "0", th: "0", vd: "0" },
        d5: { nb: "0", th: "0", vd: "1" }
      }
    }
  ],
  sections: [
    {
      title: "PHẦN I. CÂU HỎI TRẮC NGHIỆM KHÁCH QUAN (Chọn đáp án đúng nhất)",
      type: "multiple_choice",
      questions: [
        {
          question: "Sơ đồ tư duy là gì?",
          options: [
            "Là một công cụ trực quan để biểu diễn ý tưởng và thông tin dưới dạng sơ đồ hình nhánh",
            "Là một phần mềm vẽ tranh nghệ thuật chuyên nghiệp",
            "Là một loại sơ đồ cấu trúc của linh kiện máy vi tính",
            "Là tệp lưu trữ các câu lệnh lập trình Scratch"
          ],
          answer: "A",
          explanation: "Sơ đồ tư duy (Mindmap) giúp bộ não ghi nhớ và liên kết ý tưởng dựa trên các nhánh chính phụ và từ khóa trực quan."
        },
        {
          question: "Trong lập trình Scratch, khối lệnh nào dùng để thực hiện lặp lại một hành động với số lần cố định?",
          options: [
            "Khối lệnh [scratch] repeat 10 [/scratch]",
            "Khối lệnh [scratch] forever [/scratch]",
            "Khối lệnh [scratch] wait 1 seconds [/scratch]",
            "Khối lệnh [scratch] move 10 steps [/scratch]"
          ],
          answer: "A",
          explanation: "Repeat là khối điều khiển cấu trúc lặp với số lần chỉ định sẵn."
        }
      ]
    },
    {
      title: "PHẦN II. CÂU HỎI ĐÚNG SAI (Chọn Đúng hoặc Sai cho mỗi phát biểu)",
      type: "true_false",
      questions: [
        {
          question: "Khi thiết kế một sơ đồ tư duy bằng tay hoặc bằng phần mềm:",
          statements: [
            { text: "Bắt buộc phải vẽ chủ đề chính nằm ở góc trên cùng bên trái của trang giấy.", answer: false },
            { text: "Mỗi nhánh nhánh con nên đi kèm từ khóa và màu sắc nổi bật để dễ ghi nhớ.", answer: true },
            { text: "Có thể chèn thêm hình vẽ minh họa sinh động vào nhánh con.", answer: true }
          ]
        }
      ]
    }
  ] 
};

// HELPER: Parse cells (counts or question codes)
const parseMatrixCell = (val: any) => {
  if (val === undefined || val === null) return { count: 0, text: "" };
  const textStr = String(val).trim();
  if (textStr === "" || textStr === "0" || textStr === "0.0") return { count: 0, text: "" };
  
  const num = Number(textStr);
  if (!isNaN(num)) {
      return { count: num, text: textStr };
  }
  
  const parts = textStr.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
  return { count: parts.length, text: textStr, parts };
};

const getMatrixCellPoints = (dk: string, levelKey: string, cellVal: any, pointsPerQuestion: number = 0.25) => {
  const parsed = parseMatrixCell(cellVal);
  if (parsed.count === 0) return 0;
  
  if (parsed.parts) {
      let totalPoints = 0;
      parsed.parts.forEach(part => {
          const match = part.match(/(\d+\.?\d*)\s*(?:đ|điểm|pt|pts)/i);
          if (match) {
              totalPoints += parseFloat(match[1]);
          } else {
              if (dk === 'd1') {
                  totalPoints += pointsPerQuestion;
              } else if (dk === 'd2' || dk === 'd3' || dk === 'd4') {
                  totalPoints += 1.0;
              } else if (dk === 'd5') {
                  if (levelKey === 'nb') totalPoints += 1.0;
                  else if (levelKey === 'th') totalPoints += 1.0;
                  else if (levelKey === 'vd') totalPoints += 2.0;
                  else totalPoints += 1.5;
              } else {
                  totalPoints += 1.0;
              }
          }
      });
      return totalPoints;
  } else {
      const count = parsed.count;
      if (dk === 'd1') return count * pointsPerQuestion;
      if (dk === 'd2' || dk === 'd3' || dk === 'd4') return count * 1.0;
      if (dk === 'd5') {
          if (levelKey === 'nb') return count * 1.0;
          if (levelKey === 'th') return count * 1.0;
          if (levelKey === 'vd') return count * 2.0;
          return count * 1.5;
      }
      return count * 1.0;
  }
};

// HELPER: Tính toán tổng cho ma trận
const calculateMatrixTotals = (matrix: any[], pointsPerQuestion: number = 0.25) => {
  const totals = {
    d1: { nb: 0, th: 0, vd: 0, points: 0 },
    d2: { nb: 0, th: 0, vd: 0, points: 0 },
    d3: { nb: 0, th: 0, vd: 0, points: 0 },
    d4: { nb: 0, th: 0, vd: 0, points: 0 },
    d5: { nb: 0, th: 0, vd: 0, points: 0 },
    sumNb: 0, sumTh: 0, sumVd: 0,
    sumNbPoints: 0, sumThPoints: 0, sumVdPoints: 0,
    totalQuestions: 0,
    totalPoints: 0
  };

  matrix.forEach(row => {
    ['d1', 'd2', 'd3', 'd4', 'd5'].forEach((dk) => {
      const level = row.levels[dk];
      if (!level) return;
      const nbCell = parseMatrixCell(level.nb);
      const thCell = parseMatrixCell(level.th);
      const vdCell = parseMatrixCell(level.vd);
      
      const nbPoints = getMatrixCellPoints(dk, 'nb', level.nb, pointsPerQuestion);
      const thPoints = getMatrixCellPoints(dk, 'th', level.th, pointsPerQuestion);
      const vdPoints = getMatrixCellPoints(dk, 'vd', level.vd, pointsPerQuestion);
      
      const subTotalPoints = nbPoints + thPoints + vdPoints;
      
      totals[dk as keyof typeof totals as any].nb += nbCell.count;
      totals[dk as keyof typeof totals as any].th += thCell.count;
      totals[dk as keyof typeof totals as any].vd += vdCell.count;
      totals[dk as keyof typeof totals as any].points += subTotalPoints;
      
      totals.sumNb += nbCell.count;
      totals.sumTh += thCell.count;
      totals.sumVd += vdCell.count;
      
      totals.sumNbPoints += nbPoints;
      totals.sumThPoints += thPoints;
      totals.sumVdPoints += vdPoints;
      
      totals.totalQuestions += (nbCell.count + thCell.count + vdCell.count);
      totals.totalPoints += subTotalPoints;
    });
  });

  return totals;
};

// --- MAIN APP ---
export default function App() {
  const [loading, setLoading] = useState(false);
  const [examData, setExamData] = useState<any>(INITIAL_EXAM_DATA);
  const [user, setUser] = useState<User | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'bank'>('dashboard');
  const [wizardStep, setWizardStep] = useState(1);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("Medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // UX State mới bổ sung
  const [zoomScale, setZoomScale] = useState(100); // Đơn vị %
  const [showSolutions, setShowSolutions] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pointsPerQuestion, setPointsPerQuestion] = useState(0.25);
  const [activePreviewTab, setActivePreviewTab] = useState<'paper' | 'matrix'>('paper');
  const [editingQuestion, setEditingQuestion] = useState<{secIdx: number, qIdx: number} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        fetchConfigs();
      }
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

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      showToast("Đăng nhập thành công!", "success");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveToCloud = async () => {
    if (!user) {
      showToast("Vui lòng đăng nhập Google để lưu trữ trực tuyến!", "error");
      return;
    }
    const nameToSave = saveName.trim() || `Đề thi ${examData.headerConfig.subject || "Tin học"} - ${new Date().toLocaleDateString('vi-VN')}`;
    setIsSaving(true);
    try {
      await saveExamConfig(nameToSave, examData);
      showToast("Đã lưu đề thi thành công vào Thư viện Thầy Cô!", "success");
      setSaveName("");
      fetchConfigs();
    } catch (err) {
      console.error(err);
      showToast("Không thể lưu đề thi vào đám mây.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Thầy/Cô có chắc chắn muốn xóa cấu hình đề thi này khỏi thư viện?")) return;
    try {
      await deleteDoc(doc(db, "examConfigurations", id));
      showToast("Đã xóa đề thi khỏi cơ sở dữ liệu!", "success");
      fetchConfigs();
      if (examData.id === id) {
        setExamData(INITIAL_EXAM_DATA);
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi xóa tài nguyên.", "error");
    }
  };

  const handleLoadConfig = (config: any) => {
    setExamData(config.data);
    setCurrentView('workspace');
    setWizardStep(4);
    showToast(`Đã khôi phục thành công đề: ${config.name}`, "success");
  };

  const updateHeader = (key: string, value: string) => {
    setExamData((prev: any) => ({
      ...prev,
      headerConfig: { ...prev.headerConfig, [key]: value }
    }));
  };

  const updateMatrix = (idx: number, field: string, value: any, subField?: string, dKey?: string) => {
    const newMatrix = [...examData.matrix];
    if (subField && dKey) {
      newMatrix[idx].levels[dKey][subField] = value;
    } else {
      newMatrix[idx][field] = value;
    }
    setExamData({ ...examData, matrix: newMatrix });
  };

  const addMatrixRow = () => {
    setExamData({
      ...examData,
      matrix: [
        ...examData.matrix,
        { 
          tt: (examData.matrix.length + 1).toString(), 
          topic: "Chủ đề học máy mới", 
          knowledgeUnit: "Bài học mới", 
          assessmentLevel: "Biết khái niệm cơ bản, hiểu phương thức xử lý dữ liệu thuật toán...",
          levels: {
            d1: { nb: "0", th: "0", vd: "0" },
            d2: { nb: "0", th: "0", vd: "0" },
            d3: { nb: "0", th: "0", vd: "0" },
            d4: { nb: "0", th: "0", vd: "0" },
            d5: { nb: "0", th: "0", vd: "0" }
          }
        }
      ]
    });
    showToast("Đã thêm một hàng ma trận mới!", "info");
  };

  const removeMatrixRow = (idx: number) => {
    if (examData.matrix.length <= 1) {
      showToast("Ma trận phải sở hữu ít nhất một dòng đơn vị kiến thức!", "error");
      return;
    }
    const newMatrix = examData.matrix.filter((_: any, i: number) => i !== idx);
    // Cập nhật lại số thứ tự TT
    const updated = newMatrix.map((item: any, i: number) => ({
      ...item,
      tt: (i + 1).toString()
    }));
    setExamData({ ...examData, matrix: updated });
    showToast("Đã xóa dòng ma trận tương phẩm.", "info");
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      showToast("Vui lòng ghi yêu cầu soạn thảo cụ thể của Thầy/Cô!", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: aiPrompt, matrix: examData.matrix, difficulty: aiDifficulty })
      });
      const data = await res.json();
      if (res.ok && data.sections) {
        setExamData((prev: any) => ({ ...prev, sections: data.sections }));
        setWizardStep(4);
        showToast("AI đã sinh thành công đề thi theo đúng ma trận & đặc tả!", "success");
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (err: any) { 
      console.error(err);
      showToast(`Không thể tạo đề thi: ${err.message || "Lỗi máy chủ"}`, "error"); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const generateWordDoc = async () => {
    setLoading(true);
    try {
      let payload = {
        header: {
          left: [examData.headerConfig.school, examData.headerConfig.class, examData.headerConfig.student],
          center: [examData.headerConfig.examTitle, examData.headerConfig.subject, examData.headerConfig.time]
        },
        settings: { includeScoreTable: examData.includeScoreTable, includeMatrix: examData.includeMatrix, matrix: examData.matrix },
        sections: examData.sections
      };
      const response = await fetch('/api/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const blob = await response.blob();
      saveAs(blob, `De_Thi_Va_Ma_Tran_${examData.headerConfig.subject.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
      showToast("Đã xuất Microsoft Word (.docx) chất lượng cao thành công!", "success");
    } catch (err) { 
      console.error(err);
      showToast("Lỗi khi kết nối máy chủ tạo file DOCX.", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleCopyText = () => {
    try {
      let text = `========= ${examData.headerConfig.examTitle.toUpperCase()} =========\n`;
      text += `Đơn vị: ${examData.headerConfig.school}\n`;
      text += `Môn thi: ${examData.headerConfig.subject} | Thời gian: ${examData.headerConfig.time}\n`;
      text += `=====================================\n\n`;
      
      examData.sections.forEach((sec: any, sIdx: number) => {
        text += `\n${sec.title.toUpperCase()}\n`;
        if (sec.description) text += `(${sec.description})\n`;
        
        sec.questions.forEach((q: any, qIdx: number) => {
          text += `Câu ${qIdx + 1}: ${q.text || q.question || ""}\n`;
          if (sec.type === 'multiple_choice' && q.options) {
            const prefixes = ['A', 'B', 'C', 'D', 'E', 'F'];
            q.options.forEach((o: string, oIdx: number) => {
              text += `   ${prefixes[oIdx]}. ${o}\n`;
            });
            if (showSolutions && q.answer) {
              text += `   => Đáp án đúng: ${q.answer}\n`;
            }
          } else if (sec.type === 'true_false' && q.statements) {
            q.statements.forEach((st: any, stIdx: number) => {
              text += `   ${String.fromCharCode(97 + stIdx)}. ${st.text} [${showSolutions ? (st.answer ? "ĐÚNG" : "SAI") : "..."}]\n`;
            });
          }
          if (showSolutions && q.explanation) {
            text += `   * Giải thích: ${q.explanation}\n`;
          }
          text += `\n`;
        });
      });
      
      navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Đã sao chép nội dung đề dạng văn bản thành công!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      showToast("Lỗi sao chép, vui lòng thử lại.", "error");
    }
  };

  // Áp dụng biểu mẫu tiêu chuẩn nhanh nhanh chống từ template
  const handleApplyTemplate = (tpl: any) => {
    setExamData((prev: any) => ({
      ...prev,
      templateId: tpl.id,
      headerConfig: tpl.config
    }));
    showToast(`Đã áp dụng mẫu đầu trang: ${tpl.name}`, "success");
  };

  // Cập nhật câu hỏi trực quan thủ công
  const handleSaveQuestionEdit = (secIdx: number, qIdx: number, updatedField: string, value: any) => {
    const updatedSections = [...examData.sections];
    updatedSections[secIdx].questions[qIdx] = {
      ...updatedSections[secIdx].questions[qIdx],
      [updatedField]: value
    };
    setExamData({ ...examData, sections: updatedSections });
    showToast("Đã lưu chỉnh sửa câu hỏi trực tiếp!", "success");
  };

  const handleUpdateOption = (secIdx: number, qIdx: number, optIdx: number, value: string) => {
    const updatedSections = [...examData.sections];
    const q = updatedSections[secIdx].questions[qIdx];
    if (q.options) {
      const newOpts = [...q.options];
      newOpts[optIdx] = value;
      q.options = newOpts;
      setExamData({ ...examData, sections: updatedSections });
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* CORNER TOASTS WRAPPER */}
      <div className="fixed bottom-6 right-6 z-[999] space-y-3 pointer-events-none">
        {toasts.map(t => (
          <motion.div 
            key={t.id} 
            initial={{ opacity: 0, y: 30, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            className={`p-4 rounded-2xl shadow-xl border flex items-center gap-3 bg-white pointer-events-auto transition-all max-w-sm ${
              t.type === 'error' ? 'border-red-200 text-red-700' : 
              t.type === 'success' ? 'border-emerald-200 text-emerald-700' : 
              'border-slate-200 text-slate-700'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0"/> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0"/>}
            <span className="font-semibold text-sm">{t.message}</span>
          </motion.div>
        ))}
      </div>

      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden md:flex w-72 bg-slate-900 text-white flex-col p-6 z-40 shrink-0 relative shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        
        {/* LOGO AREA */}
        <div className="flex items-center gap-3 mb-10 px-2 mt-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 animate-pulse">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <span className="text-white font-serif text-2xl font-black tracking-tight block">Exam AI</span>
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block">Vietnamese Teachers</span>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="w-full space-y-2 flex-1">
          <button 
            onClick={() => setCurrentView('dashboard')} 
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-semibold text-sm ${
              currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Layout className="w-5 h-5" /> <span>Hệ thống chung</span>
          </button>
          
          <button 
            onClick={() => { setCurrentView('workspace'); setWizardStep(1); }} 
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-semibold text-sm ${
              currentView === 'workspace' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" /> <span>Soạn đề Thông minh AI</span>
          </button>

          <button 
            onClick={() => setCurrentView('bank')} 
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-semibold text-sm ${
              currentView === 'bank' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Database className="w-5 h-5" /> <span>Thư viện đề thi ({savedConfigs.length})</span>
          </button>
        </nav>

        {/* LOGGED IN USER PROFILE / AUTH ACTIONS */}
        <div className="pt-6 border-t border-slate-800/80 space-y-3">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-2xl">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "Avatar"} className="w-9 h-9 rounded-full object-cover border border-indigo-500" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white text-sm">{user.displayName?.charAt(0) || "GV"}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate text-slate-200">{user.displayName || "Giáo viên VN"}</p>
                  <p className="text-[10px] text-indigo-400 truncate font-semibold">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={() => signOut(auth).then(() => { showToast("Đã đăng xuất tài khoản.", "info"); })} 
                className="w-full flex items-center justify-center gap-2 py-3 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950 rounded-xl transition-all text-xs font-semibold"
              >
                <LogOut size={14} /> <span>Đăng xuất Thầy Cô</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin} 
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-indigo-900/10"
            >
              <LogIn size={16} /> <span>Đăng nhập để lưu trực tuyến</span>
            </button>
          )}

          <div className="text-center text-[10px] text-slate-500 font-semibold pt-1">
            Exam AI Education v2.4
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around p-3 z-50 shadow-2xl">
        <button 
          onClick={() => setCurrentView('dashboard')} 
          className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <Layout className="w-5 h-5" />
          <span className="text-[10px] font-bold">Hệ thống</span>
        </button>
        <button 
          onClick={() => { setCurrentView('workspace'); setWizardStep(1); }} 
          className={`flex flex-col items-center gap-1 ${currentView === 'workspace' ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold">Soạn đề</span>
        </button>
        <button 
          onClick={() => setCurrentView('bank')} 
          className={`flex flex-col items-center gap-1 ${currentView === 'bank' ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <Database className="w-5 h-5" />
          <span className="text-[10px] font-bold">Thư viện</span>
        </button>
        {user ? (
          <button 
            onClick={() => { signOut(auth); showToast("Đã đăng xuất.", "info"); }} 
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <LogOut className="w-5 h-5 text-rose-400" />
            <span className="text-[10px] font-bold text-rose-400">Đăng xuất</span>
          </button>
        ) : (
          <button 
            onClick={handleLogin} 
            className="flex flex-col items-center gap-1 text-indigo-400"
          >
            <LogIn className="w-5 h-5" />
            <span className="text-[10px] font-bold">Đăng nhập</span>
          </button>
        )}
      </nav>

      {/* MAIN MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden pb-16 md:pb-0">
        
        {/* TOP STATUS BAR & HEADER */}
        <header className="h-20 bg-white border-b border-slate-100 px-6 md:px-8 flex items-center justify-between z-20 shrink-0 shadow-sm">
          
          <div className="flex items-center gap-3">
            <h1 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              {currentView === 'dashboard' && <span className="text-slate-900 font-serif">Bảng Điều Khiển Học Vụ</span>}
              {currentView === 'workspace' && <span className="text-slate-900 font-serif">Khu vực Soạn Thảo Đề Thi {!isGenerating && `(Bước ${wizardStep}/4)`}</span>}
              {currentView === 'bank' && <span className="text-indigo-600 font-serif">Ngân Hàng Đề Thi Học Hiệu</span>}
            </h1>
            {currentView === 'workspace' && isGenerating && (
              <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Đang phân tích...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
             {/* Dynamic Controller buttons for Workspace Wizard */}
             {currentView === 'workspace' && wizardStep > 1 && (
               <button 
                 onClick={() => setWizardStep(wizardStep - 1)} 
                 className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-700 font-semibold text-xs md:text-sm hover:bg-slate-200 transition-all rounded-xl active:scale-95"
               >
                 <ChevronLeft className="w-4 h-4" /> Quay lại
               </button>
             )}

             {currentView === 'workspace' && wizardStep < 4 && (
               <button 
                 onClick={() => {
                   if (wizardStep === 2 && examData.matrix.length === 0) {
                     showToast("Vui lòng cấu hình ít nhất một dòng ma trận đơn vị kiến thức!", "error");
                     return;
                   }
                   setWizardStep(wizardStep + 1);
                 }} 
                 className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-xs md:text-sm shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
               >
                 Tiếp theo <ChevronRight className="w-4 h-4" />
               </button>
             )}

             {currentView === 'workspace' && wizardStep === 4 && (
               <div className="flex items-center gap-2">
                 <button 
                   onClick={generateWordDoc} 
                   className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
                 >
                   <Download size={15}/> <span>Tải Word (.docx)</span>
                 </button>
               </div>
             )}
          </div>
        </header>

        {/* WORKSPACE STEPPERS IF APPLICABLE */}
        {currentView === 'workspace' && (
          <div className="bg-white border-b border-slate-150 py-3.5 px-6 md:px-8 shrink-0 flex items-center justify-between overflow-x-auto gap-4 scrollbar-none shadow-inner bg-slate-50/50">
            <div className="flex items-center gap-3 md:gap-6 mx-auto w-full max-w-4xl text-xs md:text-sm">
              {[
                { step: 1, label: "Thông tin chung" },
                { step: 2, label: "Ma trận đề" },
                { step: 3, label: "Trợ lý AI Soạn đề" },
                { step: 4, label: "Đề bài hoàn chỉnh" }
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    wizardStep === item.step ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' :
                    wizardStep > item.step ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {wizardStep > item.step ? <Check className="w-4 h-4" /> : item.step}
                  </div>
                  <span className={`font-semibold text-xs ${
                    wizardStep === item.step ? 'text-indigo-600 font-bold' :
                    wizardStep > item.step ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {item.label}
                  </span>
                  {item.step < 4 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DYNAMIC SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            
            {/* === 1. DASHBOARD VIEW === */}
            {currentView === 'dashboard' && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }} 
                className="max-w-6xl mx-auto space-y-8 pb-10"
              >
                {/* HERO WELCOME GREETING */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-[2.5rem] p-8 md:p-14 text-white relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>
                   <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-500/15 rounded-full blur-[90px] pointer-events-none"></div>
                   
                   <div className="relative z-10 space-y-6 max-w-3xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full text-[11px] font-black uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" /> Hệ Thống Giáo Trình & Tạo Đề Thi AI Quốc Gia 🇻🇳
                      </div>
                      <h2 className="text-3xl md:text-5xl font-serif font-black leading-tight tracking-tight">
                        Kiến tạo ma trận, đặc tả & soạn đề thi chuẩn học hiệu chỉ trong vài giây.
                      </h2>
                      <p className="text-slate-300 text-sm md:text-base max-w-xl font-medium leading-relaxed">
                        Tích hợp và tự động chuẩn hóa đáp án tự luận, trắc nghiệm, đúng sai và ghép hợp. Hỗ trợ đắc lực giáo viên lưu trữ cấu trúc thư viện số.
                      </p>
                      
                      <div className="pt-4 flex flex-wrap gap-4">
                        <button 
                          onClick={() => { setCurrentView('workspace'); setWizardStep(1); }} 
                          className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-extrabold text-sm md:text-base flex items-center gap-2 hover:bg-slate-100 transition-all hover:translate-y-[-2px] hover:shadow-xl shadow-md cursor-pointer active:scale-95"
                        >
                          <Plus className="w-5 h-5 text-indigo-600" /> Bắt đầu Soạn đề mới
                        </button>
                        <button 
                          onClick={() => setCurrentView('bank')} 
                          className="px-6 py-4 bg-slate-800/80 border border-slate-700/80 text-white rounded-2xl font-bold text-sm md:text-base flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
                        >
                          <Database className="w-5 h-5 text-indigo-300" /> Thư viện đề đã lưu
                        </button>
                      </div>
                   </div>
                </div>

                {/* VISUAL BENTO GRADIENT METRICS STATS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                   <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><BookOpen className="w-6 h-6"/></div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Dự án đã lưu</p>
                         <p className="text-xl md:text-2xl font-serif font-black text-slate-900">{savedConfigs.length}</p>
                      </div>
                   </div>
                   <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Layout className="w-6 h-6"/></div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cấp mẫu đầu trang</p>
                         <p className="text-xl md:text-2xl font-serif font-black text-slate-900">3 Mẫu gốc</p>
                      </div>
                   </div>
                   <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0"><Sparkles className="w-6 h-6"/></div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">AI Trợ lý</p>
                         <p className="text-xl md:text-2xl font-serif font-black text-slate-900">Gemini Pro</p>
                      </div>
                   </div>
                   <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0"><Clock className="w-6 h-6"/></div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hiệu năng</p>
                         <p className="text-xl md:text-2xl font-serif font-black text-slate-900">Tiết kiệm 95%</p>
                      </div>
                   </div>
                </div>

                {/* TWO-COLUMN QUICK LAUNCH & INSTRUCTIONS GUIDE */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                  
                  {/* MAIN COLUMN: QUICK START TEMPLATE SELECTION CARD */}
                  <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg md:text-xl font-serif font-black text-slate-900">Chọn mẫu cấu hình trường thi</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-1">Chọn nhanh mẫu đầu trang giúp điền tự động dữ liệu trước khi soạn đề.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {HEADER_TEMPLATES.map((tpl) => (
                        <div 
                          key={tpl.id}
                          className="group border border-slate-150 rounded-2xl p-4 hover:border-indigo-500 hover:bg-slate-50/50 transition-all cursor-pointer relative"
                          onClick={() => {
                            handleApplyTemplate(tpl);
                            setCurrentView('workspace');
                            setWizardStep(1);
                          }}
                        >
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all">
                            <ChevronRight className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="w-9 h-9 bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-600 rounded-lg flex items-center justify-center text-slate-600 transition-all mb-3">
                            <FileText size={16} />
                          </div>
                          <p className="text-[13px] font-bold text-slate-800">{tpl.name}</p>
                          <p className="text-[11px] text-slate-400 mt-1 lines-clamp-2 leading-relaxed">{tpl.config.school}</p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400">
                      <span>* Các mẫu đầu đề thi hỗ trợ tương thích Microsoft Word phông Times New Roman 13pt đạt quy chuẩn của Bộ.</span>
                    </div>
                  </div>

                  {/* SIDE COLUMN: QUICK STEP GUIDE (HƯỚNG DẪN SỬ DỤNG NHANH) */}
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg md:text-xl font-serif font-black text-slate-900 inline-flex items-center gap-2"><HelpCircle className="text-indigo-500 w-5 h-5" /> Hướng dẫn nhanh</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-1">4 bước tạo đề thi tự động hoàn chỉnh.</p>
                    </div>

                    <div className="space-y-4">
                      {[
                        { step: 1, text: "Khai báo Thông tin đầu trang của trường thi và môn học." },
                        { step: 2, text: "Nhập số lượng câu hỏi nhận biết, thông hiểu, vận dụng vào bảng Ma trận." },
                        { step: 3, text: "Nhập yêu cầu giáo trình (hoặc kéo thả SGK) để Trợ lý AI Gemini soạn đề." },
                        { step: 4, text: "Xem trước trực tiếp A4, sửa nhanh nếu muốn, rồi tải file Word .docx" }
                      ].map((item) => (
                        <div key={item.step} className="flex gap-3 text-[12px] leading-relaxed">
                          <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                            {item.step}
                          </div>
                          <span className="text-slate-600 font-medium">{item.text}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-[11px] text-amber-700 font-semibold leading-normal">
                      💡 Mẹo: Giáo viên nên đăng nhập Google để lưu khóa cấu hình và chỉnh sửa lại bất cứ lúc nào trong tương lai.
                    </div>
                  </div>
                </div>

                {/* RECENT CONFIGURATIONS LIST Table view on Dashboard */}
                {savedConfigs.length > 0 && (
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-serif font-black text-slate-900">Danh sách đề thi vừa sao lưu</h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">Nơi quản lý dữ liệu cấu hình lưu trữ của Thầy/Cô.</p>
                      </div>
                      <button onClick={() => setCurrentView('bank')} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1">
                        Xem tất cả ({savedConfigs.length}) <ArrowRight size={14} />
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">Tên đề trữ</th>
                            <th className="p-3">Môn học</th>
                            <th className="p-3">Cấp học hiệu</th>
                            <th className="p-3">Ngày tạo</th>
                            <th className="p-3 text-right">Lựa chọn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {savedConfigs.slice(0, 3).map((cfg) => (
                            <tr key={cfg.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-bold text-slate-800">{cfg.name}</td>
                              <td className="p-3 text-slate-600 font-medium">{cfg.data?.headerConfig?.subject || "Chưa rõ"}</td>
                              <td className="p-3 text-slate-400 font-semibold">{cfg.data?.headerConfig?.school || "..."}</td>
                              <td className="p-3 text-slate-400">
                                {cfg.createdAt?.seconds ? new Date(cfg.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : "Mới đây"}
                              </td>
                              <td className="p-3 text-right space-x-2">
                                <button 
                                  onClick={() => handleLoadConfig(cfg)}
                                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg transition-all"
                                >
                                  Mở soạn thảo
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteConfig(cfg.id, e)}
                                  className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all inline-flex align-middle"
                                  title="Xóa đề lưu"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* === 2. WORKSPACE CONTAINER === */}
            
            {/* STEP 1: THÔNG TIN HEADER */}
            {currentView === 'workspace' && wizardStep === 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }} 
                className="max-w-4xl mx-auto space-y-6 pb-20"
              >
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Settings className="w-5 h-5"/></div>
                    <div>
                      <h3 className="font-serif text-lg md:text-xl font-bold text-slate-800 tracking-tight">Khai báo cấu hình đầu đề chuẩn</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Xác định học hiệu trường lớp, tiêu đề đề kiểm tra, và thời gian làm bài chính xác.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <EditableField label="Tên trường / Học viện" value={examData.headerConfig.school} onChange={(v) => updateHeader('school', v)} />
                    <EditableField label="Môn học chuẩn hóa" value={examData.headerConfig.subject} onChange={(v) => updateHeader('subject', v)} />
                    <EditableField label="Lớp / Khối lớp" value={examData.headerConfig.class} onChange={(v) => updateHeader('class', v)} />
                    <EditableField label="Thời gian làm bài" value={examData.headerConfig.time} onChange={(v) => updateHeader('time', v)} />
                    <div className="md:col-span-2">
                      <EditableField label="Tiêu đề chính của Đề thi" value={examData.headerConfig.examTitle} onChange={(v) => updateHeader('examTitle', v)} />
                    </div>
                  </div>
                </div>

                {/* TEMPLATE TOGGLE CONTROLLERS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div 
                     onClick={() => {
                       setExamData({...examData, includeScoreTable: !examData.includeScoreTable});
                       showToast("Đã thay đổi trạng thái bao gồm bảng ghi điểm!", "info");
                     }} 
                     className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                       examData.includeScoreTable ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                     }`}
                   >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-slate-800">Khung chấm điểm của Giáo viên</p>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                          examData.includeScoreTable ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {examData.includeScoreTable && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">Tự động chèn bảng điểm của hội đồng khảo thí và ô lời phê chi tiết của Thầy/Cô lên đầu trang giấy đề bài.</p>
                   </div>

                   <div 
                     onClick={() => {
                       setExamData({...examData, includeMatrix: !examData.includeMatrix});
                       showToast("Đã cập nhật tùy chọn hiển thị ma trận!", "info");
                     }} 
                     className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                       examData.includeMatrix ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                     }`}
                   >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-slate-800">In kèm bảng Ma trận & Đặc tả</p>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                          examData.includeMatrix ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {examData.includeMatrix && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">Chèn trực tiếp bảng ma trận tỷ lệ phần trăm nhận biết/thông hiểu/vận dụng và các cột văn bản đặc tả chi tiết cuối tài liệu Word (.docx).</p>
                   </div>
                </div>

                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex gap-4 items-center">
                  <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm"><Info className="w-6 h-6"/></div>
                  <div className="text-xs text-indigo-750 font-medium leading-relaxed">
                    <strong>Thông tin hữu ích:</strong> Cấp học hiệu có thể tùy chỉnh in đậm, phông chữ Times New Roman sẽ được tự động kích hoạt chuẩn chỉ phục vụ cho việc in ấn của các trường Tiểu học, Trung học cơ sở và Trung học phổ thông toàn quốc.
                  </div>
                </div>

                {/* SAMPLE DATA QUICK ACTIONS */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="text-left">
                    <p className="font-bold text-slate-800 text-sm">Dữ liệu ma trận thi thiết kế sẵn</p>
                    <p className="text-xs text-slate-500 mt-0.5">Khởi tạo nhanh cấu trúc bảng bằng một lần nhấn để thử nghiệm tức thì.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                      onClick={() => {
                        setExamData((prev: any) => ({
                          ...prev,
                          matrix: SAMPLE_NUMERIC_MATRIX,
                          includeMatrix: true
                        }));
                        showToast("Khởi tạo Ma trận tỉ lệ mẫu thành công!", "success");
                      }}
                      className="px-5 py-3 bg-white hover:bg-slate-100/60 text-indigo-600 hover:text-indigo-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4 mr-1 text-indigo-500" /> Tải Ma trận mẫu
                    </button>
                    <button
                      onClick={() => {
                        setExamData((prev: any) => ({
                          ...prev,
                          matrix: SAMPLE_DESC_MATRIX,
                          includeMatrix: true
                        }));
                        showToast("Khởi tạo Ma trận đặc tả mẫu thành công!", "success");
                      }}
                      className="px-5 py-3 bg-white hover:bg-slate-100/60 text-indigo-600 hover:text-indigo-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap active:scale-[0.98]"
                    >
                      <FileText className="w-4 h-4 mr-1 text-indigo-500" /> Tải Bảng đặc tả mẫu
                    </button>
                  </div>
                </div>

                {/* STEER ACTION FOOTER */}
                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setWizardStep(2)}
                    className="px-8 py-3.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-150 transition-all active:scale-95"
                  >
                    Tiếp lập Ma Trận <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: THIẾT LẬP MA TRẬN PHỨC HỢP */}
            {currentView === 'workspace' && wizardStep === 2 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0 }} 
                className="max-w-full space-y-6 pb-20"
              >
                {/* TOOLBAR FOR MATRIX ACTIONS */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-100 gap-4 shadow-sm">
                  <div>
                    <h3 className="text-base md:text-lg font-serif font-black text-slate-800 flex items-center gap-2">
                      <Layout className="w-5 h-5 text-indigo-600"/> Ma Trận Câu Hỏi 5 Dạng Chuẩn Hóa
                    </h3>
                    <p className="text-slate-400 text-xs font-semibold mt-0.5">Đặt số lượng câu hỏi cần AI phát triển theo từng dạng bài và mức độ tương ứng.</p>
                  </div>
                  <button 
                    onClick={addMatrixRow} 
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs md:text-sm transition-all active:scale-95 border border-indigo-200"
                  >
                    <Plus size={16}/> Thêm một nội dung kiến thức
                  </button>
                </div>
                
                {/* COMPLEX MATRIX TABLE WITH ADVANCED CONTROLS */}
                <div className="bg-white rounded-2xl shadow-xl overflow-x-auto border border-slate-150 custom-scrollbar">
                  <table className="w-full text-xs border-collapse min-w-[1300px]">
                    <thead className="bg-slate-900 text-white text-center">
                      <tr className="divide-x divide-slate-800">
                        <th rowSpan={3} className="p-3 w-10">TT</th>
                        <th rowSpan={3} className="p-3 w-48">Chủ đề học phần</th>
                        <th rowSpan={3} className="p-3 w-48">Nội dung / Đơn vị kiến thức</th>
                        <th colSpan={15} className="p-2 bg-slate-800">Cơ cấu số câu hỏi theo từng mức độ khảo thí</th>
                        <th colSpan={3} rowSpan={2} className="p-2">Tổng số câu</th>
                        <th rowSpan={3} className="p-3 w-20">Tỷ lệ (%)</th>
                        <th rowSpan={3} className="p-3 w-12 text-center text-rose-400">Xóa</th>
                      </tr>
                      <tr className="divide-x divide-slate-800">
                        <th colSpan={3} className="p-2 bg-slate-800/80">Dạng I (Trắc nghiệm)</th>
                        <th colSpan={3} className="p-2 bg-slate-800/80">Dạng II (Đúng / Sai)</th>
                        <th colSpan={3} className="p-2 bg-slate-800/80">Dạng III (Ghép hợp)</th>
                        <th colSpan={3} className="p-2 bg-slate-800/80">Dạng IV (Điền khuyết)</th>
                        <th colSpan={3} className="p-2 bg-slate-800/80">Dạng V (Tự luận)</th>
                      </tr>
                      <tr className="bg-slate-800 text-slate-300 divide-x divide-slate-700">
                        {/* Dạng I - V & Tổng */}
                        {[1, 2, 3, 4, 5, 6].map(i => (
                          <React.Fragment key={i}>
                            <th className="p-1 text-[11px] font-bold">Biết</th>
                            <th className="p-1 text-[11px] font-bold">Hiểu</th>
                            <th className="p-1 text-[11px] font-bold">VD</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {examData.matrix.map((row: any, idx: number) => {
                        const rowTotalNb = ['d1', 'd2', 'd3', 'd4', 'd5'].reduce((sum: number, dk: string) => sum + parseMatrixCell(row.levels[dk]?.nb).count, 0);
                        const rowTotalTh = ['d1', 'd2', 'd3', 'd4', 'd5'].reduce((sum: number, dk: string) => sum + parseMatrixCell(row.levels[dk]?.th).count, 0);
                        const rowTotalVd = ['d1', 'd2', 'd3', 'd4', 'd5'].reduce((sum: number, dk: string) => sum + parseMatrixCell(row.levels[dk]?.vd).count, 0);
                        const rowPoints = ['d1', 'd2', 'd3', 'd4', 'd5'].reduce((sum: number, dk: string) => {
                          return sum + 
                            getMatrixCellPoints(dk, 'nb', row.levels[dk]?.nb, pointsPerQuestion) +
                            getMatrixCellPoints(dk, 'th', row.levels[dk]?.th, pointsPerQuestion) +
                            getMatrixCellPoints(dk, 'vd', row.levels[dk]?.vd, pointsPerQuestion);
                        }, 0);
                        const rowTotalCount = rowTotalNb + rowTotalTh + rowTotalVd;
                        
                        return (
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-indigo-50/20 transition-all divide-x divide-slate-100">
                              <td className="p-2 text-center font-bold text-slate-500 bg-slate-50/50">
                                <input className="w-full text-center outline-none bg-transparent font-bold" value={row.tt} onChange={e=>updateMatrix(idx, 'tt', e.target.value)} />
                              </td>
                              <td className="p-2 bg-indigo-50/10">
                                <input className="w-full outline-none bg-transparent font-bold text-slate-800 px-1 placeholder-slate-300" value={row.topic} placeholder="Chủ đề chính..." onChange={e=>updateMatrix(idx, 'topic', e.target.value)} />
                              </td>
                              <td className="p-2">
                                <input className="w-full outline-none bg-transparent text-slate-600 px-1 placeholder-slate-300 font-medium" value={row.knowledgeUnit} placeholder="Đơn vị kiến thức..." onChange={e=>updateMatrix(idx, 'knowledgeUnit', e.target.value)} />
                              </td>
                              
                              {['d1', 'd2', 'd3', 'd4', 'd5'].map(dk => (
                                <React.Fragment key={dk}>
                                  <td className="p-1 text-center bg-slate-100/20">
                                    <input className="w-full text-center outline-none bg-transparent font-bold text-slate-700 text-xs" type="text" value={row.levels[(dk as any)].nb} onChange={e=>updateMatrix(idx, '', e.target.value, 'nb', dk)} />
                                  </td>
                                  <td className="p-1 text-center bg-slate-100/20">
                                    <input className="w-full text-center outline-none bg-transparent font-bold text-slate-700 text-xs" type="text" value={row.levels[(dk as any)].th} onChange={e=>updateMatrix(idx, '', e.target.value, 'th', dk)} />
                                  </td>
                                  <td className="p-1 text-center bg-slate-100/20">
                                    <input className="w-full text-center outline-none bg-transparent font-bold text-slate-700 text-xs" type="text" value={row.levels[(dk as any)].vd} onChange={e=>updateMatrix(idx, '', e.target.value, 'vd', dk)} />
                                  </td>
                                </React.Fragment>
                              ))}

                              {/* TỔNG CỘT CỦA DÒNG */}
                              <td className="p-2 text-center font-bold bg-amber-50 text-amber-800">{rowTotalNb || "-"}</td>
                              <td className="p-2 text-center font-bold bg-amber-50 text-amber-800">{rowTotalTh || "-"}</td>
                              <td className="p-2 text-center font-bold bg-amber-50 text-amber-800">{rowTotalVd || "-"}</td>
                              
                              {/* Ratios */}
                              <td className="p-2 text-center font-extrabold bg-indigo-50/50 text-indigo-700">{rowPoints.toFixed(2).replace(/\.00$/, '')}đ</td>
                              
                              {/* Xóa dòng */}
                              <td className="p-2 text-center bg-white">
                                <button 
                                  onClick={() => removeMatrixRow(idx)}
                                  className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
                                  title="Xóa kiến thức này"
                                >
                                  <Trash size={14} />
                                </button>
                              </td>
                            </tr>
                            
                            {/* Mức độ kiểm định đặc tả */}
                            <tr className="bg-slate-50/30">
                              <td colSpan={3} className="p-1.5 text-[10px] font-bold text-slate-400 pl-4 uppercase bg-slate-100/50">Mức độ kiểm tra, đánh giá (Chuyển sang bảng Đặc tả ma trận thi):</td>
                              <td colSpan={20} className="p-1">
                                 <textarea 
                                   className="w-full bg-white border border-slate-200 rounded-lg p-2.5 h-12 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-150 text-[11px] font-medium text-slate-600 leading-normal" 
                                   value={row.assessmentLevel} 
                                   onChange={e => updateMatrix(idx, 'assessmentLevel', e.target.value)}
                                   placeholder="Nhập nội dung đặc tả hành vi của câu hỏi (VD: Biết khái niệm sơ đồ tư duy, các thành phần chính...)"
                                 />
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                      
                      {/* STATS MATRIX FOOTER ROWS */}
                      {(() => {
                        const totals = calculateMatrixTotals(examData.matrix, pointsPerQuestion);
                        return (
                          <>
                            {/* Dòng 1: Tổng số câu hỏi */}
                            <tr className="bg-slate-900 text-white font-bold text-[11px] divide-x divide-slate-800">
                              <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-slate-300">Tổng số câu hỏi</td>
                              {['d1', 'd2', 'd3', 'd4', 'd5'].map(dk => (
                                <React.Fragment key={dk}>
                                  <td className="p-1.5 text-center text-indigo-300 font-bold">{totals[(dk as any)].nb || 0}</td>
                                  <td className="p-1.5 text-center text-indigo-300 font-bold">{totals[(dk as any)].th || 0}</td>
                                  <td className="p-1.5 text-center text-indigo-300 font-bold">{totals[(dk as any)].vd || 0}</td>
                                </React.Fragment>
                              ))}
                              <td className="p-2 text-center text-amber-400">{totals.sumNb}</td>
                              <td className="p-2 text-center text-amber-400">{totals.sumTh}</td>
                              <td className="p-2 text-center text-amber-400">{totals.sumVd}</td>
                              <td className="p-2 text-center bg-indigo-600 font-black">{totals.totalQuestions} câu</td>
                              <td colSpan={2}></td>
                            </tr>
                            
                            {/* Dòng 2: Tổng số điểm */}
                            <tr className="bg-white font-bold text-slate-700 divide-x divide-slate-100">
                              <td colSpan={3} className="p-2.5 text-right uppercase tracking-wider bg-slate-50/50">Tổng điểm quy cách</td>
                              {['d1', 'd2', 'd3', 'd4', 'd5'].map(dk => {
                                const dkNbPoints = examData.matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'nb', r.levels[dk]?.nb, pointsPerQuestion), 0);
                                const dkThPoints = examData.matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'th', r.levels[dk]?.th, pointsPerQuestion), 0);
                                const dkVdPoints = examData.matrix.reduce((sum: number, r: any) => sum + getMatrixCellPoints(dk, 'vd', r.levels[dk]?.vd, pointsPerQuestion), 0);
                                return (
                                  <React.Fragment key={dk}>
                                    <td className="p-1 text-center text-slate-600 bg-slate-50/20">{dkNbPoints > 0 ? dkNbPoints.toFixed(1) : "0"}</td>
                                    <td className="p-1 text-center text-slate-600 bg-slate-50/20">{dkThPoints > 0 ? dkThPoints.toFixed(1) : "0"}</td>
                                    <td className="p-1 text-center text-slate-600 bg-slate-50/20">{dkVdPoints > 0 ? dkVdPoints.toFixed(1) : "0"}</td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="p-2 text-center text-slate-900 bg-slate-50">{totals.sumNbPoints.toFixed(1)}đ</td>
                              <td className="p-2 text-center text-slate-900 bg-slate-50">{totals.sumThPoints.toFixed(1)}đ</td>
                              <td className="p-2 text-center text-slate-900 bg-slate-50">{totals.sumVdPoints.toFixed(1)}đ</td>
                              <td className="p-2 text-center bg-slate-100 font-black text-slate-900">{totals.totalPoints.toFixed(1)}đ</td>
                              <td colSpan={2}></td>
                            </tr>

                            {/* Dòng Mới: Tổng câu hỏi & điểm theo từng dạng đề */}
                            <tr className="bg-amber-50/60 font-bold text-slate-800 divide-x divide-slate-200">
                              <td colSpan={3} className="p-2.5 text-right uppercase tracking-wider text-amber-900 bg-amber-100/50">Tổng cộng theo dạng</td>
                              {['d1', 'd2', 'd3', 'd4', 'd5'].map(dk => {
                                const dCount = totals[dk as any].nb + totals[dk as any].th + totals[dk as any].vd;
                                const dPoints = totals[dk as any].points;
                                return (
                                  <td key={dk} colSpan={3} className="p-2 text-center bg-amber-50/40 text-slate-900 text-[11px]">
                                    <span className="font-extrabold text-amber-900">{dCount} câu</span>
                                    <span className="text-slate-400 font-normal mx-1">/</span>
                                    <span className="font-extrabold text-indigo-700">{dPoints.toFixed(1)}đ</span>
                                  </td>
                                );
                              })}
                              <td className="p-2 text-center bg-amber-100/30 font-bold text-amber-950">{totals.sumNb} câu<br/><span className="text-[10px] text-slate-500">({totals.sumNbPoints.toFixed(1)}đ)</span></td>
                              <td className="p-2 text-center bg-amber-100/30 font-bold text-amber-950">{totals.sumTh} câu<br/><span className="text-[10px] text-slate-500">({totals.sumThPoints.toFixed(1)}đ)</span></td>
                              <td className="p-2 text-center bg-amber-100/30 font-bold text-amber-950">{totals.sumVd} câu<br/><span className="text-[10px] text-slate-500">({totals.sumVdPoints.toFixed(1)}đ)</span></td>
                              <td className="p-2 text-center bg-indigo-600 text-white font-black text-[12px] leading-tight">{totals.totalQuestions} câu<br/><span className="text-[10px] text-indigo-200">({totals.totalPoints.toFixed(1)}đ)</span></td>
                              <td colSpan={2}></td>
                            </tr>

                            {/* Dòng 3: Tỉ lệ (%) điểm */}
                            <tr className="bg-indigo-50/30 font-bold text-indigo-950 divide-x divide-slate-100">
                              <td colSpan={3} className="p-2.5 text-right uppercase tracking-wider text-indigo-700">Tỷ lệ theo định dạng (%)</td>
                              {['d1', 'd2', 'd3', 'd4', 'd5'].map(dk => {
                                const dTotal = totals[dk as any].points;
                                const ratio = totals.totalPoints > 0 ? (dTotal / totals.totalPoints) * 100 : 0;
                                return (
                                  <td key={dk} colSpan={3} className="p-1.5 text-center text-indigo-800 font-extrabold">{ratio.toFixed(0)}%</td>
                                );
                              })}
                              <td className="p-2 text-center font-black text-indigo-600">{(totals.totalPoints > 0 ? (totals.sumNbPoints / totals.totalPoints * 100) : 0).toFixed(0)}%</td>
                              <td className="p-2 text-center font-black text-indigo-600">{(totals.totalPoints > 0 ? (totals.sumThPoints / totals.totalPoints * 100) : 0).toFixed(0)}%</td>
                              <td className="p-2 text-center font-black text-indigo-600">{(totals.totalPoints > 0 ? (totals.sumVdPoints / totals.totalPoints * 100) : 0).toFixed(0)}%</td>
                              <td className="p-2 text-center bg-indigo-600 text-white font-black text-[12px]">100%</td>
                              <td colSpan={2}></td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* SLIDER TO MANAGE QUESTION VALUE / POINTS WEIGHTING */}
                <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1 text-left flex-1">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5"><Sliders className="w-4 h-4 text-indigo-600"/> Tùy chỉnh trọng số điểm từng câu hỏi</p>
                    <p className="text-slate-400 text-xs">Mặc định là 0.25 điểm mỗi câu trắc nghiệm/tự luận ngắn (40 câu = 10 điểm). Điều chỉnh thanh trượt để thay đổi trọng số tương thích cấu trúc trường thi.</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500">Mức điểm câu hỏi:</span>
                    <select 
                      value={pointsPerQuestion} 
                      onChange={(e) => {
                        setPointsPerQuestion(Number(e.target.value));
                        showToast(`Đã thay đổi trọng số điểm câu hỏi thành ${e.target.value}đ!`, "info");
                      }}
                      className="bg-white border border-slate-300 rounded font-bold text-sm px-3 py-1.5 text-indigo-600 outline-none"
                    >
                      <option value="0.2">0.20 điểm / Câu</option>
                      <option value="0.25">0.25 điểm / Câu (Khuyên dùng)</option>
                      <option value="0.5">0.50 điểm / Câu</option>
                      <option value="1.0">1.00 điểm / Câu</option>
                    </select>
                  </div>
                </div>

                {/* STEER ACTIONS FOOTER */}
                <div className="flex justify-between pt-4">
                  <button 
                    onClick={() => setWizardStep(1)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold transition-all text-sm active:scale-95"
                  >
                    Cấu hình chung
                  </button>
                  <button 
                    onClick={() => setWizardStep(3)}
                    className="px-8 py-3.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-150 transition-all active:scale-95"
                  >
                    Viết mô tả AI soạn đề <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: ĐẶC TẢ CHI TIẾT AI */}
            {currentView === 'workspace' && wizardStep === 3 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0 }} 
                className="max-w-4xl mx-auto space-y-8 pb-20"
              >
                {/* PROMPT HEADER */}
                <div className="text-center space-y-3">
                   <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-150"><Sparkles size={32}/></div>
                   <h2 className="text-2xl md:text-3xl font-serif font-black text-slate-900">Trợ lý Trí tuệ Nhân tạo AI Soạn đề</h2>
                   <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">AI sẽ dựa vào số lượng câu hỏi đã ghi trong Ma trận và phần thuyết minh chỉ định bài học của Thầy Cô dưới đây để biên tập đề hoàn hảo nhất.</p>
                </div>
                
                {/* INTERACTIVE MOTIVATIONAL PROMPT SHORTCUT CARDS */}
                <div className="space-y-3 text-left">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">📚 Gợi ý mẫu đề viết nhanh</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {QUICK_PROMPTS.map((qp, qpIdx) => (
                      <div 
                        key={qpIdx}
                        className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-indigo-600 hover:bg-indigo-50/10 cursor-pointer transition-all text-xs leading-relaxed"
                        onClick={() => {
                          setAiPrompt(qp.text);
                          showToast("Đã nhập mẫu mô tả AI hoàn chỉnh!", "success");
                        }}
                      >
                        <p className="font-extrabold text-indigo-700 mb-1 flex items-center gap-1">✨ {qp.title}</p>
                        <p className="text-slate-500 lines-clamp-2 leading-relaxed font-medium">{qp.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DRAG-DROP AREA */}
                <div className="space-y-3 text-left">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">🗄️ Đọc tài liệu đính kèm (Tính năng thông minh)</span>
                  <DragDropZone onFileDrop={(file) => showToast(`Hệ thống đã phân tích nội dung tệp: ${file.name}!`, 'success')} />
                </div>
                
                {/* RICH PROMPT EDITOR */}
                <div className="space-y-3 text-left relative z-10">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">📝 Nội dung giáo án hoặc các yêu cầu chi tiết khác của đề:</span>
                  <RichTextEditor value={aiPrompt} onChange={setAiPrompt} />
                </div>

                {/* AI DIFFICULTY SELECTION */}
                <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Sliders className="w-4 h-4 text-indigo-500"/> Thiết đặt độ khó mặc định của đề:</span>
                  <div className="flex gap-2">
                    {['Dễ', 'Trung bình', 'Khó nâng cao'].map((dif) => (
                      <button 
                        key={dif}
                        onClick={() => {
                          setAiDifficulty(dif);
                          showToast(`Đã chọn mức độ khó: ${dif}`, "info");
                        }}
                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                          aiDifficulty === dif ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {dif}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BIG CALL TO ACTION SUBMIT BUTTON */}
                <button 
                  onClick={handleGenerateAI} 
                  disabled={isGenerating} 
                  className={`w-full py-5 text-white rounded-3xl font-black text-base md:text-lg shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                    isGenerating ? 'bg-slate-600 pointer-events-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10'
                  }`}
                >
                  {isGenerating ? <Loader2 className="animate-spin w-5 h-5"/> : <Play className="w-5 h-5 fill-current"/>} 
                  {isGenerating ? 'Trí tuệ nhân tạo đang biên tập câu hỏi (Có thể cần tới 15 - 30 giây)...' : 'Bắt đầu Sinh đề với AI'}
                </button>

                {/* WORKSPACE BACK FOOTER */}
                <div className="flex justify-start">
                  <button 
                    onClick={() => setWizardStep(2)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold transition-all text-sm active:scale-95 text-slate-600"
                  >
                    Trở lại Ma trận tỉ lệ
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: THÀNH PHẨM (PRO VISUAL A4 PREVIEW) */}
            {currentView === 'workspace' && wizardStep === 4 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 md:gap-8 pb-32 text-left"
              >
                {/* MAIN LARGE COLUMN - SIMULATED PAPER AREA */}
                <div className="flex-1 bg-slate-200/50 p-4 md:p-8 rounded-[2rem] border border-slate-150 shadow-inner overflow-x-auto relative min-h-[600px] flex flex-col items-center">
                  
                  {/* FLOATING ACTION TOOLBAR OVER PREVIEW */}
                  <div className="w-full max-w-[210mm] flex flex-wrap items-center justify-between mb-4 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 gap-3 text-xs font-semibold text-slate-600 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-indigo-700">🔍 Phóng to/Thu nhỏ giấy:</span>
                      <input 
                        type="range" 
                        min="50" 
                        max="140" 
                        value={zoomScale} 
                        onChange={(e) => setZoomScale(Number(e.target.value))} 
                        className="w-24 md:w-32 accent-indigo-600 cursor-pointer"
                      />
                      <span className="font-bold text-[11px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{zoomScale}%</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={showSolutions} onChange={() => setShowSolutions(!showSolutions)} className="accent-indigo-600 w-4 h-4 rounded cursor-pointer" />
                        <span className="font-bold">Hiện đáp án/Giải thích</span>
                      </label>
                    </div>
                  </div>

                  {/* HIGH-FIDELITY SIMULATED PAPER SHEET (A4) */}
                  <div className="w-full overflow-x-auto flex justify-center py-4">
                    <div 
                       className="bg-white shadow-[0_12px_45px_-12px_rgba(0,0,0,0.15)] transition-all origin-top shrink-0 text-left border border-slate-300"
                       style={{ 
                          width: '210mm', 
                          minHeight: '297mm', 
                          paddingTop: '20mm', 
                          paddingBottom: '20mm', 
                          paddingLeft: '20mm', 
                          paddingRight: '15mm',
                          fontFamily: '"Times New Roman", Times, serif',
                          fontSize: '13pt',
                          lineHeight: '1.25',
                          color: '#000000',
                          boxSizing: 'border-box',
                          transform: `scale(${zoomScale / 100})`,
                          marginBottom: `${Math.max(0, (zoomScale - 100) * 3.5)}px` // Đảm bảo khoảng cách footer khi zoom lớn
                       }}
                    >
                       {/* HEADER PREVIEW */}
                       <div className="w-full mb-6">
                          <table className="w-full text-center border-none" style={{ borderCollapse: 'collapse', width: '100%' }}>
                             <tbody>
                               <tr>
                                 <td className="w-1/2 align-top pb-4 px-2 text-center" style={{ fontSize: '12pt', lineHeight: '1.2' }}>
                                   <div className="font-bold uppercase">{examData.headerConfig.school}</div>
                                   <div className="font-bold">------------------</div>
                                   <div className="text-[11pt] mt-1">Lớp: {examData.headerConfig.class}</div>
                                   <div className="text-[11pt] mt-1">Họ tên: ....................................................</div>
                                 </td>
                                 <td className="w-1/2 align-top pb-4 px-2 text-center" style={{ fontSize: '12pt', lineHeight: '1.2' }}>
                                   <div className="font-bold uppercase">{examData.headerConfig.examTitle}</div>
                                   <div className="font-bold">------------------</div>
                                   <div className="font-bold mt-1 uppercase" style={{ fontSize: '13pt' }}>{examData.headerConfig.subject}</div>
                                   <div className="italic mt-1" style={{ fontSize: '11pt' }}>{examData.headerConfig.time}</div>
                                 </td>
                               </tr>
                             </tbody>
                          </table>
                       </div>

                       {/* BẢNG ĐIỂM CHUẨN */}
                       {examData.includeScoreTable && (
                          <div className="mb-6 mx-auto w-full">
                            <table className="w-full border-collapse border-[1.5px] border-black text-center" style={{ borderWidth: '1.5px' }}>
                              <tbody>
                                <tr>
                                  <td className="w-1/4 border border-black font-bold align-top pt-2 pb-16" style={{ borderWidth: '1.5px' }}>Điểm số</td>
                                  <td className="w-3/4 border border-black align-top pt-3 text-left px-4 font-bold" style={{ borderWidth: '1.5px', fontSize: '12pt' }}>
                                    Lời phê của thầy (cô) giáo:
                                    <div className="mt-4 font-normal text-slate-300 italic">.........................................................................................................</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                       )}

                       <div className="text-center font-bold underline mb-6 text-[14pt] tracking-widest">ĐỀ BÀI</div>

                       {/* SECTIONS LOOP */}
                       {examData.sections && examData.sections.length > 0 ? (
                         examData.sections.map((sec: any, sIdx: number) => (
                           <div key={sIdx} className="mb-6">
                             <div className="font-bold uppercase mb-1" style={{ fontSize: '13pt' }}>{sec.title}</div>
                             {sec.description && <div className="italic mb-3 pl-2" style={{ fontSize: '11.5pt' }}>({sec.description})</div>}

                             <div className="space-y-4 mt-2">
                               {sec.questions && sec.questions.map((q: any, qIdx: number) => (
                                  <div key={qIdx} className="text-justify relative group">
                                     
                                     {/* SỬA NHANH CÂU HỎI TRỰC TIẾP TRỞ THÀNH CARD EDITABLE KHI CLICK */}
                                     {editingQuestion?.secIdx === sIdx && editingQuestion?.qIdx === qIdx ? (
                                       <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3 font-sans text-xs relative z-50">
                                         <div className="flex justify-between items-center bg-indigo-100 p-2 rounded">
                                            <span className="font-bold text-indigo-900">✏️ Chỉnh sửa Câu hỏi #{qIdx+1}</span>
                                            <button onClick={() => setEditingQuestion(null)} className="p-1 hover:bg-slate-200 rounded text-indigo-950 font-bold">Lưu & Đóng</button>
                                         </div>
                                         <div className="space-y-1">
                                           <label className="font-bold">Nội dung đề bài:</label>
                                           <textarea 
                                             value={q.text || q.question || ""} 
                                             onChange={(e) => handleSaveQuestionEdit(sIdx, qIdx, q.text ? 'text' : 'question', e.target.value)}
                                             className="w-full border p-2 rounded bg-white font-serif text-[13pt] h-16 outline-none focus:ring-1 focus:ring-indigo-500"
                                           />
                                         </div>

                                         {sec.type === 'multiple_choice' && q.options && (
                                           <div className="space-y-2 mt-2">
                                             <label className="font-bold block">Phương án lựa chọn:</label>
                                             {q.options.map((opt: string, optIdx: number) => (
                                               <div key={optIdx} className="flex gap-2">
                                                 <span className="font-extrabold">{String.fromCharCode(65+optIdx)}:</span>
                                                 <input 
                                                   type="text" 
                                                   value={opt} 
                                                   onChange={(e) => handleUpdateOption(sIdx, qIdx, optIdx, e.target.value)}
                                                   className="flex-1 w-full border px-2 py-1 rounded bg-white font-serif text-[12pt]"
                                                 />
                                               </div>
                                             ))}
                                           </div>
                                         )}
                                       </div>
                                     ) : (
                                       <div className="pl-1 hover:bg-indigo-50/40 rounded transition-all group-hover:ring-1 group-hover:ring-indigo-100 p-1">
                                         
                                         {/* Floating edit button on hover */}
                                         <button 
                                           onClick={() => setEditingQuestion({ secIdx: sIdx, qIdx })}
                                           className="absolute right-2 top-0.5 opacity-0 group-hover:opacity-100 bg-white/95 border px-2.5 py-1 text-[10px] text-indigo-700 font-bold rounded shadow-lg transition-all flex items-center gap-1 cursor-pointer font-sans"
                                         >
                                           <Edit3 size={11}/> Sửa nhanh câu #{qIdx+1}
                                         </button>

                                         <div className="text-justify leading-relaxed" style={{ fontSize: '13pt' }}>
                                            <span className="font-bold mr-1.5">Câu {qIdx + 1}:</span>
                                            <span ><FormattedText text={q.text || q.question} /></span>
                                         </div>

                                         {sec.type === 'multiple_choice' && q.options && (
                                            <div className="flex flex-wrap mt-1.5 pl-6" style={{ fontSize: '12pt' }}>
                                            {(() => {
                                               const isShort = q.options.join(' ').length < 50 && q.options.length === 4;
                                               const prefixes = ['A', 'B', 'C', 'D', 'E', 'F'];
                                               return q.options.map((o: string, i: number) => (
                                                  <div key={i} className={isShort ? "w-1/4 pr-2 text-justify" : "w-full mb-1 text-justify"}>
                                                     <span className="font-bold mr-1">{prefixes[i]}.</span> <span><FormattedText text={o} /></span>
                                                  </div>
                                               ));
                                            })()}
                                            </div>
                                         )}

                                         {sec.type === 'true_false' && q.statements && (
                                            <div className="mt-2 ml-6 space-y-1.5" style={{ fontSize: '12pt' }}>
                                               {q.statements.map((st: any, i: number) => (
                                                  <div key={i} className="flex gap-2">
                                                     <span className="font-bold mr-1.5">{String.fromCharCode(97+i)}.</span> 
                                                     <span className="flex-1 text-justify">{st.text}</span>
                                                     {showSolutions && (
                                                       <span className={`inline-block font-black text-[10px] uppercase px-1.5 py-0.5 rounded ml-2 ${
                                                         st.answer === true ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                       }`}>
                                                         {st.answer === true ? "Đúng" : "Sai"}
                                                       </span>
                                                     )}
                                                  </div>
                                               ))}
                                            </div>
                                         )}

                                         {/* SHOW PREVIEW SOLUTIONS & EXPLANATIONS IF TOGGLED */}
                                         {showSolutions && (q.answer || q.explanation) && (
                                           <div className="mt-2.5 ml-6 p-2.5 bg-slate-50 rounded border-l-2 border-indigo-500 font-sans text-[11.5pt] space-y-1">
                                             {q.answer && <p className="font-extrabold text-indigo-800">👉 Đáp án đúng chọn: {q.answer}</p>}
                                             {q.explanation && <p className="text-slate-600 font-medium leading-relaxed"><span className="underline font-semibold">Lời giải chi tiết:</span> <FormattedText text={q.explanation}/></p>}
                                           </div>
                                         )}

                                       </div>
                                     )}

                                  </div>
                               ))}
                             </div>
                           </div>
                         ))
                       ) : (
                         <div className="py-20 text-center text-slate-400 italic">
                            Chưa có câu hỏi nào được soạn thảo. Hãy viết prompt yêu cầu AI soạn ở Bước 3.
                         </div>
                       )}

                       {/* LƯU Ý MA TRẬN IN TRONG DOCX */}
                       {examData.includeMatrix && (
                          <div className="mt-12 pt-6 border-t border-dashed border-slate-300 text-center italic text-slate-400" style={{ fontSize: '10.5pt' }}>
                            [Hệ thống sẽ tự động ghép Bảng Ma Trận & Bảng Đặc tả chất lượng cao vào trang cuối của tài liệu Word khi tải xuống]
                          </div>
                       )}

                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN - SIDE CONTROL BAR */}
                <div className="w-full lg:w-96 space-y-6">
                   
                   {/* ACTION CARD 1: WORD DOWNLOAD & COPY */}
                   <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bảng xuất dữ liệu</p>
                      
                      <button 
                        onClick={generateWordDoc} 
                        disabled={loading}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 active:scale-95 transition-all text-sm cursor-pointer"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : <Download size={18}/>} 
                        {loading ? "Đang xử lý nội dung..." : "TẢI FILE WORD (.DOCX)"}
                      </button>

                      {/* OUTSTANDING GLOWING HIGHLIGHTED COPY BUTTON */}
                      <button 
                        onClick={handleCopyText}
                        className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 active:scale-95 transition-all text-sm ${
                          copied ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-emerald-50' : 'bg-white border-indigo-150 text-indigo-700 hover:border-indigo-600 hover:bg-indigo-50/10'
                        }`}
                      >
                        {copied ? <CheckSquare size={16}/> : <ClipboardCopy size={16}/>} 
                        {copied ? "ĐÃ SAO CHÉP ĐỀ THI!" : "SAO CHÉP TOÀN BỘ ĐỀ THI VĂN BẢN"}
                      </button>

                      <div className="pt-2 text-[11px] text-slate-400 leading-normal text-center">
                        * Tệp DOCX được định dạng sẵn với bảng lề lùi đầu dòng, bảng chấm điểm chuẩn khung của Sở GD&ĐT.
                      </div>
                   </div>

                   {/* ACTION CARD 2: DOCUMENT SACH / SAVE TO LIBRARY CLOUD */}
                   <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sao lưu thư viện cá nhân</p>
                      
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 pl-1">Tên lưu trữ lưu niệm đề thi:</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: Đề thi Tin 6 Cuối Kỳ II" 
                          value={saveName} 
                          onChange={(e) => setSaveName(e.target.value)}
                          className="w-full border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
                        />
                      </div>

                      <button 
                        onClick={handleSaveToCloud}
                        disabled={isSaving}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        {isSaving ? <Loader2 className="animate-spin w-4 h-4"/> : <Save size={14}/>} 
                        <span>Lưu đề này vào thư viện đám mây</span>
                      </button>

                      {!user && (
                        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 p-2.5 rounded-xl leading-normal font-semibold">
                          ⚠️ Chú ý: Thầy/Cô cần đăng nhập Google bằng nút bấm ở thanh điều khiển bên trái để kích hoạt lưu trữ đám mây.
                        </p>
                      )}
                   </div>

                   {/* ACTION CARD 3: EDIT TRỢ LÝ DIRECT SHORTCUT TO RETAKE OR CORRECT */}
                   <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-slate-800">
                        <Settings2 className="w-5 h-5 text-indigo-500"/>
                        <p className="font-bold text-xs uppercase tracking-wider text-slate-400">Các tiện ích khác</p>
                      </div>

                      <div className="space-y-2 text-xs">
                        <button 
                          onClick={() => {
                            setWizardStep(3);
                            showToast("Đã quay lại bước Trợ lý AI để Thầy Cô viết lại prompt bám sát giáo án mới!", "info");
                          }}
                          className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-all text-xs"
                        >
                          <Sparkles size={13} className="text-indigo-600" /> 
                          <span>Yêu cầu AI điều chỉnh lại đề thi</span>
                        </button>

                        <button 
                          onClick={() => {
                            if(window.confirm("Thầy/Cô muốn làm mới xóa sạch mọi câu hỏi và cấu hình để bắt đầu lại?")) {
                              setExamData(INITIAL_EXAM_DATA);
                              setWizardStep(1);
                              showToast("Đã thiết lập lại sạch sẽ form cấu hình!", "info");
                            }
                          }}
                          className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer"
                        >
                          <Trash size={13}/>
                          <span>Xóa trắng làm lại từ đầu</span>
                        </button>
                      </div>
                   </div>

                </div>
              </motion.div>
            )}

            {/* === 3. SAVED EXAM BANK VIEW === */}
            {currentView === 'bank' && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }} 
                className="max-w-6xl mx-auto space-y-6 pb-20 text-left"
              >
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-xl font-serif font-black text-slate-900 inline-flex items-center gap-2"><Database className="text-indigo-600 w-6 h-6"/> Ngân hàng đề thi cá nhân ({savedConfigs.length})</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-1">Nơi lưu giữ các mẫu đề thi và cấu hình ma trận đã lưu trữ của Thầy/Cô. Thầy Cô có thể kích hoạt tải phôi Word hoặc mở lại soạn thảo nhanh.</p>
                  </div>

                  {savedConfigs.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 space-y-4">
                      <FolderOpen className="w-16 h-16 text-slate-300 mx-auto" />
                      <div>
                        <p className="font-bold text-slate-700 text-lg">Hộp lưu trữ đang trống rỗng</p>
                        <p className="text-sm text-slate-400 mt-1">Đăng nhập tài khoản Google để giữ các tác phẩm khảo thí của mình và bắt đầu soạn thảo đề thi đầu tiên!</p>
                      </div>
                      <button 
                        onClick={() => { setCurrentView('workspace'); setWizardStep(1); }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-md transition-all active:scale-95 inline-flex"
                      >
                        Bắt đầu tạo đề ngay
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {savedConfigs.map((cfg) => (
                        <div 
                          key={cfg.id}
                          className="bg-white border border-slate-200 hover:border-indigo-500 rounded-2xl p-6 hover:shadow-xl transition-all flex flex-col justify-between h-56 group relative"
                        >
                          <div className="space-y-2">
                            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-[10px] font-black uppercase text-indigo-700 rounded-full">
                              {cfg.data?.headerConfig?.subject || "Trắc nghiệm / Tự luận"}
                            </span>
                            <h4 className="font-serif font-bold text-slate-800 text-[15px] group-hover:text-indigo-600 transition-colors leading-snug truncate">{cfg.name}</h4>
                            <p className="text-xs text-slate-400 leading-normal font-semibold truncate">Trường: {cfg.data?.headerConfig?.school || "..."}</p>
                            <p className="text-[11px] text-slate-400 font-medium">Lớp: {cfg.data?.headerConfig?.class || "Chưa thiết lập"} - Thời lượng: {cfg.data?.headerConfig?.time || "..."}</p>
                          </div>

                          <div className="pt-4 border-t border-slate-100/80 flex items-center justify-between gap-2">
                            <button 
                              onClick={() => handleLoadConfig(cfg)}
                              className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                              Mở lại Soạn
                            </button>
                            
                            <div className="flex gap-1.5">
                              <button 
                                onClick={async () => {
                                  // Nạp cấu hình tạm của dòng và gọi xuất bản DOCX
                                  setExamData(cfg.data);
                                  setTimeout(() => generateWordDoc(), 200);
                                }}
                                className="p-2 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-xl transition-all"
                                title="Tải nhanh tệp Word (.docx)"
                              >
                                <Download size={16} />
                              </button>
                              
                              <button 
                                onClick={(e) => handleDeleteConfig(cfg.id, e)}
                                className="p-2 hover:bg-rose-50 text-slate-350 hover:text-rose-600 rounded-xl transition-all"
                                title="Xóa đề này"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">{label}</label>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all shadow-sm"
      />
    </div>
  );
}

function DragDropZone({ onFileDrop }: { onFileDrop: (file: File) => void }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={`w-full p-8 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center transition-all cursor-pointer ${dragActive ? 'border-indigo-600 bg-indigo-50' : 'border-slate-350 bg-white hover:bg-slate-50'}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <FolderOpen className="w-10 h-10 text-slate-400 mb-4" />
      <p className="font-bold text-slate-600 text-lg">Kéo thả MỤC LỤC SGK / Tài liệu vào đây</p>
      <p className="text-sm text-slate-400 mt-2">hoặc click để chọn file từ máy tính</p>
      <input id="file-upload" type="file" className="hidden" onChange={(e) => e.target.files && onFileDrop(e.target.files[0])} />
    </div>
  );
}

function RichTextEditor({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showColorMenu, setShowColorMenu] = useState(false);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertTable = () => {
    let ht = '<table class="border-collapse border border-slate-400 w-full mb-4"><tbody>';
    for (let r = 0; r < tableRows; r++) {
      ht += '<tr>';
      for (let c = 0; c < tableCols; c++) {
        ht += '<td class="border border-slate-400 p-2 min-w-[50px]"><br></td>';
      }
      ht += '</tr>';
    }
    ht += '</tbody></table><p><br></p>';
    execCmd('insertHTML', ht);
    setShowTableMenu(false);
  };

  const insertLatex = () => {
    const latex = prompt("Nhập mã LaTeX:\n(Ví dụ: \\frac{a}{b} hoặc a^2 + b^2 = c^2)");
    if (latex) {
      execCmd('insertHTML', `<span class="latex-math text-indigo-600 bg-indigo-50 px-1 rounded font-mono" data-latex="${latex}">\\(${latex}\\)</span>&nbsp;`);
    }
  };

  const insertImage = () => {
    const url = prompt("Nhập URL Ảnh:");
    if (url) {
      execCmd('insertImage', url);
    }
  };

  return (
    <div className="w-full bg-white border-2 border-slate-200 rounded-[2.5rem] shadow-sm overflow-visible focus-within:border-indigo-600 transition-all text-left">
      <div className="bg-slate-50 border-b-2 border-slate-200 p-3 flex flex-wrap items-center gap-2 relative rounded-t-[2.5rem]">
        <button className="p-2 hover:bg-slate-200 rounded" onClick={() => execCmd('bold')} title="In đậm"><strong className="font-serif">B</strong></button>
        <button className="p-2 hover:bg-slate-200 rounded" onClick={() => execCmd('italic')} title="In nghiêng"><i className="font-serif">I</i></button>
        <button className="p-2 hover:bg-slate-200 rounded" onClick={() => execCmd('underline')} title="Gạch chân"><u className="font-serif">U</u></button>
        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        <button className="p-2 hover:bg-slate-200 rounded" onClick={() => execCmd('justifyLeft')} title="Cần trái"><AlignLeft className="w-4 h-4"/></button>
        <button className="p-2 hover:bg-slate-200 rounded" onClick={() => execCmd('justifyCenter')} title="Cần giữa"><AlignCenter className="w-4 h-4"/></button>
        <button className="p-2 hover:bg-slate-200 rounded" onClick={() => execCmd('justifyRight')} title="Cần phải"><AlignRight className="w-4 h-4"/></button>
        <button className="p-2 hover:bg-slate-200 rounded" onClick={() => execCmd('justifyFull')} title="Cần đều hai bên"><AlignJustify className="w-4 h-4"/></button>
        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        
        <div className="relative z-50">
          <button className="p-2 hover:bg-slate-200 rounded flex items-center gap-1" onClick={() => { setShowColorMenu(!showColorMenu); setShowTableMenu(false); }} title="Màu chữ">
             <div className="w-4 h-4 bg-red-400 rounded-full"></div> <ChevronDown className="w-3 h-3"/>
          </button>
          {showColorMenu && (
             <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl p-2 flex gap-2 w-32 flex-wrap">
               {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'].map(c => (
                 <button key={c} className="w-6 h-6 rounded-full border border-slate-200" style={{backgroundColor: c}} onClick={() => { execCmd('foreColor', c); setShowColorMenu(false); }} />
               ))}
             </div>
          )}
        </div>

        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        <button className="p-2 hover:bg-slate-200 rounded text-sm font-bold flex items-center gap-1" onClick={insertLatex} title="Chèn công thức Toán học">
           <span>&sum;</span> Latex
        </button>
        <button className="p-2 hover:bg-slate-200 rounded text-sm font-bold flex items-center gap-1" onClick={() => {
          const code = prompt("Nhập mã lệnh Scratch:\n(Ví dụ: move 10 steps)");
          if (code) {
             try {
                const parsed = (window as any).scratchblocks?.parse(code) || code;
                const view = (window as any).scratchblocks?.newView(parsed, { style: 'scratch3' });
                const svg = view?.render();
                const wrapper = document.createElement('div');
                wrapper.className = "scratch-wrapper inline-block m-2 border rounded";
                if (svg) wrapper.appendChild(svg);
                execCmd('insertHTML', `[scratch]${code}[/scratch]<br/>` + wrapper.outerHTML + "&nbsp;");
             } catch(e) { alert("Lỗi khi tạo hình ảnh khối Scratch"); }
          }
        }} title="Chèn khối Scratch">
           <Shapes className="w-4 h-4"/> Scratch
        </button>
        <button className="p-2 hover:bg-slate-200 rounded" onClick={insertImage} title="Chèn ảnh"><ImageIcon className="w-4 h-4"/></button>
        
        <div className="relative z-50">
           <button className="p-2 hover:bg-slate-200 rounded" onClick={() => { setShowTableMenu(!showTableMenu); setShowColorMenu(false); }} title="Chèn bảng">
             <TableIcon className="w-4 h-4"/>
           </button>
           {showTableMenu && (
             <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl p-4 w-48 space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase">Chèn Bảng</p>
                <div className="flex items-center gap-2">
                   <input type="number" min="1" max="10" className="w-16 border rounded p-1" value={tableRows} onChange={e=>setTableRows(Number(e.target.value))} /> <span className="text-sm">Hàng</span>
                </div>
                <div className="flex items-center gap-2">
                   <input type="number" min="1" max="10" className="w-16 border rounded p-1" value={tableCols} onChange={e=>setTableCols(Number(e.target.value))} /> <span className="text-sm">Cột</span>
                </div>
                <button className="w-full bg-indigo-600 text-white rounded p-2 text-sm font-bold" onClick={insertTable}>Tạo bảng</button>
             </div>
           )}
        </div>

      </div>
      <div 
         ref={editorRef}
         contentEditable 
         className="w-full h-48 md:h-64 p-6 outline-none overflow-auto text-lg document-editor prose"
         onInput={(e) => onChange(e.currentTarget.innerHTML)}
         placeholder="Nhập yêu cầu đặc tả của bạn tại đây..."
      >
      </div>
    </div>
  );
}
