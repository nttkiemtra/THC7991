import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  AppStep,
  InputData,
  GenerationState,
  Lesson,
  Chapter,
  QuestionConfig,
  SavedExam,
  QuestionBankItem,
  VisualConfig,
  ExamError,
} from "./types";
import StepIndicator from "./components/StepIndicator";
import Button from "./components/Button";
import MarkdownView from "./components/MarkdownView";
import HelpModal from "./components/HelpModal";
import QuestionBankModal from "./components/QuestionBankModal";
import {
  generateStep1Matrix,
  generateStep2Specs,
  generateStep3Exam,
  extractInfoFromDocuments,
  convertMatrixFileToHtml,
  configureGenAI,
} from "./services/geminiService";
import {
  ArrowRight,
  RotateCcw,
  FileText,
  Download,
  AlertCircle,
  Upload,
  Clock,
  Check,
  CheckCircle2,
  Target,
  ChevronDown,
  ChevronRight,
  Filter,
  FileUp,
  FileSpreadsheet,
  Beaker,
  Pencil,
  Save,
  X,
  Key,
  LogOut,
  FileSignature,
  Split,
  Code,
  Calculator,
  HelpCircle,
  Archive,
  Plus,
  Minus,
  Search,
  Trash2,
  Database,
  Smartphone,
  Monitor,
  LogIn,
  User as UserIcon,
  Sparkles,
  Zap,
  Grid3X3,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Image as ImageIcon,
  Sigma,
  Table,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  auth,
  googleProvider,
  db,
  handleFirestoreError,
  OperationType,
  onFirestoreStatusChange,
} from "./firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl overflow-hidden relative"
    >
      <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600"
          animate={{ width: ["0%", "100%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="relative z-10">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 rounded-full border-2 border-dashed border-blue-200"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200"
              >
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2 uppercase tracking-tight">
            {message}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed font-medium">
            Hệ thống AI đang xử lý dữ liệu của bạn.
            <br />
            Vui lòng không đóng trình duyệt.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-2 h-2 bg-blue-500 rounded-full"
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest ml-1">
            AI Thinking...
          </span>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase">Pháp sư AI</span>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            Đang xử lý
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.INPUT);
  const [completedSteps, setCompletedSteps] = useState<number>(0);

  // -- Auth State --
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // -- Legacy Auth (Gemini Key) --
  const [apiKey, setApiKey] = useState("");
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [rememberKey, setRememberKey] = useState(true);

  // -- Help Modal State --
  const [showHelp, setShowHelp] = useState(false);

  // -- Saved Exams State --
  const [savedExams, setSavedExams] = useState<SavedExam[]>([]);
  const [showSavedExams, setShowSavedExams] = useState(false);

  // -- Preview States --
  const [isPreviewMobile, setIsPreviewMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // -- Question Bank State --
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [selectionContext, setSelectionContext] = useState<
    "pre-select" | "insert" | null
  >(null);
  const [prefillQuestionContent, setPrefillQuestionContent] = useState("");
  const [dbConnected, setDbConnected] = useState(true);

  // Sync with Firestore connection status
  useEffect(() => {
    return onFirestoreStatusChange(setDbConnected);
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      // Sync profile to Firestore if new user
      if (currentUser) {
        const profileRef = doc(db, "users", currentUser.uid, "profile", "data");
        // Use a simpler set without overwriting createdAt if we can,
        // but for now we'll just keep it simple and rely on the fixed rules.
        // To be extra safe, we only send what's needed.
        const profileData: any = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          updatedAt: new Date().toISOString(),
        };

        // We only set createdAt on first write if we were being fancy,
        // but setDoc with merge is fine now that rules are relaxed.
        setDoc(profileRef, profileData, { merge: true }).catch((err) => {
          console.error("Profile sync error:", err);
          handleFirestoreError(err, OperationType.WRITE, profileRef.path);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync Saved Exams from Firestore
  useEffect(() => {
    if (!isAuthReady || !user) {
      // Fallback to localStorage if not logged in
      const stored = localStorage.getItem("ais_saved_exams");
      if (stored) {
        try {
          setSavedExams(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse saved exams", e);
        }
      } else {
        setSavedExams([]);
      }
      return;
    }

    const examsRef = collection(db, "users", user.uid, "exams");
    const q = query(examsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const exams = snapshot.docs.map((doc) => doc.data() as SavedExam);
        setSavedExams(exams);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, examsRef.path),
    );

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Sync Question Bank handled inside QuestionBankModal

  // -- Data State --
  const [inputData, setInputData] = useState<InputData>({
    subject: "",
    grade: "",
    duration: 45,
    examType: "Giữa kỳ 1",
    topics: "",
    additionalNotes: "",
    chapters: [],
    questionConfig: {
      type1: { biet: 4, hieu: 4, van_dung: 4 },
      type2: { biet: 1, hieu: 0, van_dung: 0 },
      type3: { biet: 0, hieu: 1, van_dung: 0 },
      type4: { biet: 0, hieu: 0, van_dung: 1 },
      essay: { biet: 0, hieu: 0, van_dung: 2 },
    },
    essayScoreDistribution: {
      biet: [],
      hieu: [],
      van_dung: [1.5, 1.5], // Default for 2 VD questions
    },
  });

  // -- UI State --
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    new Set(),
  );

  // -- Editing State --
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  const [genState, setGenState] = useState<GenerationState>({
    matrix: "",
    specs: "",
    exam: "",
    isLoading: false,
    error: null,
  });

  const [visualConfig, setVisualConfig] = useState<VisualConfig>({
    fontFamily: "'Times New Roman', serif",
    fontSize: "14pt",
    lineHeight: "1.2",
    margins: { top: 2, bottom: 2, left: 2, right: 1.5 },
    primaryColor: "#000000",
    headerStyle: "standard",
  });

  const [errorReport, setErrorReport] = useState<ExamError[]>([]);

  // -- Save & Delete UI States --
  const [showSaveNamingModal, setShowSaveNamingModal] = useState(false);
  const [proposedExamTitle, setProposedExamTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Success Toast Auto-hide
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Background error scanner
  useEffect(() => {
    
    // Add Firestore global error listener
    const handleFirestoreErrorEvent = (event: any) => {
      const { message } = event.detail || {};
      if (message && message.includes("Missing or insufficient permissions")) {
         console.warn("Firestore permission issue detected (soft error).");
      } else {
         alert(`Cảnh báo kết nối Database: ${message}`);
      }
    };
    window.addEventListener('firestore-error', handleFirestoreErrorEvent);

    let timeoutId: any;
    if (currentStep === AppStep.EXAM && (genState.exam || isEditing)) {
      const content = isEditing ? editValue : genState.exam;
      timeoutId = setTimeout(() => {
        const errors: ExamError[] = [];

        // 1. Check Total Score
        if (!content.includes("10.0")) {
          errors.push({
            id: "total-score",
            type: "scoring",
            severity: "high",
            message: "Thiếu thông tin tổng điểm 10.0 trong đề thi.",
            suggestedFix:
              'Thêm "Tổng điểm: 10.0" vào phần tiêu đề hoặc cuối đề.',
          });
        }

        // 2. Check for Inconsistent Scoring Patterns
        const partsCount = (content.match(/PHẦN [I|V]+/g) || []).length;
        if (partsCount < 3) {
          errors.push({
            id: "structure-consistency",
            type: "content",
            severity: "medium",
            message:
              "Cấu trúc đề thi có vẻ không đầy đủ (Thiếu các phần I, II, III...).",
            suggestedFix: "Tạo lại đề thi hoặc kiểm tra lại bảng đặc tả.",
          });
        }

        // 3. Check for formatting markers or placeholders
        if (content.match(/\[.*?\]|\{.*?\}|___/)) {
          errors.push({
            id: "placeholders-found",
            type: "formatting",
            severity: "low",
            message:
              "Phát hiện các ký hiệu giữ chỗ hoặc khoảng trống chưa điền.",
            suggestedFix:
              "Kiểm tra và thay thế các ký hiệu [...] hoặc {...} bằng nội dung thật.",
          });
        }

        // 4. Citation check
        if (
          inputData.referenceFiles &&
          inputData.referenceFiles.length > 0 &&
          !content.toLowerCase().includes("nguồn") &&
          !content.toLowerCase().includes("trích dẫn")
        ) {
          errors.push({
            id: "citation-missing",
            type: "citation",
            severity: "medium",
            message:
              "Bạn đã tải lên tài liệu tham khảo nhưng chưa thấy trích dẫn nguồn.",
            suggestedFix:
              'Thêm mục "Nguồn tham khảo" để đảm bảo tính minh bạch.',
          });
        }

        setErrorReport(errors);
      }, 1000); // Debounce scan
    } else {
      setErrorReport([]);
    }

    return () => {
      window.removeEventListener('firestore-error', handleFirestoreErrorEvent);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    currentStep,
    genState.exam,
    editValue,
    isEditing,
    inputData.referenceFiles,
  ]);

  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const matrixUploadRef = useRef<HTMLInputElement>(null);
  const matrixDirectUploadRef = useRef<HTMLInputElement>(null);

  // Load Gemini Key from localStorage (Legacy)
  useEffect(() => {
    const savedKey = localStorage.getItem("GEMINI_API_KEY");
    if (savedKey) {
      configureGenAI(savedKey);
      setApiKey(savedKey);
      setIsKeyConfigured(true);
    }
  }, []);

  // --- Effect to handle Edit Mode vs Loading ---
  useEffect(() => {
    if (genState.isLoading) {
      setIsEditing(false);
    }
  }, [genState.isLoading]);

  const handleSaveKey = () => {
    if (!apiKey.trim()) return;
    configureGenAI(apiKey);
    if (rememberKey) {
      localStorage.setItem("GEMINI_API_KEY", apiKey);
    } else {
      localStorage.removeItem("GEMINI_API_KEY");
    }
    setIsKeyConfigured(true);
  };

  const handleLogout = () => {
    setIsKeyConfigured(false);
    setApiKey("");
    localStorage.removeItem("GEMINI_API_KEY");
    window.location.reload();
  };

  // --- Helpers ---

  const applySmartFilter = (type: string, chapters: Chapter[]) => {
    const lowerType = type.toLowerCase();
    let startWeek = 0;
    let endWeek = 100;

    if (
      lowerType.includes("giữa kỳ 1") ||
      lowerType.includes("giữa học kỳ 1")
    ) {
      startWeek = 1;
      endWeek = 9; // Approx
    } else if (
      lowerType.includes("cuối kỳ 1") ||
      lowerType.includes("cuối học kỳ 1")
    ) {
      startWeek = 1;
      endWeek = 18;
    } else if (
      lowerType.includes("giữa kỳ 2") ||
      lowerType.includes("giữa học kỳ 2")
    ) {
      startWeek = 19;
      endWeek = 27;
    } else if (
      lowerType.includes("cuối kỳ 2") ||
      lowerType.includes("cuối học kỳ 2")
    ) {
      startWeek = 19;
      endWeek = 35;
    }

    const newSelected = new Set<string>();
    const newExpanded = new Set<string>();

    chapters.forEach((chap) => {
      let hasSelectedLesson = false;
      chap.lessons.forEach((lesson) => {
        // If lesson has week info, check range. If not, default to include if logic is vague.
        // Assuming strict filter if weeks exist
        const lStart = lesson.weekStart || 0;
        const lEnd = lesson.weekEnd || 100;

        // Check overlap: start1 <= end2 && start2 <= end1
        if (lStart <= endWeek && lEnd >= startWeek) {
          newSelected.add(lesson.id);
          hasSelectedLesson = true;
        }
      });
      if (hasSelectedLesson) newExpanded.add(chap.id);
    });

    setSelectedLessonIds(newSelected);
    setExpandedChapterIds(newExpanded);
  };

  // --- Score Calculation Logic ---
  const scoreStats = useMemo(() => {
    const q = inputData.questionConfig;

    const type1Count = q.type1.biet + q.type1.hieu + q.type1.van_dung;
    const type2Count = q.type2.biet + q.type2.hieu + q.type2.van_dung;
    const type3Count = q.type3.biet + q.type3.hieu + q.type3.van_dung;
    const type4Count = q.type4.biet + q.type4.hieu + q.type4.van_dung;

    const objScore =
      type1Count * 0.25 +
      type2Count * 1.0 +
      type3Count * 1.0 +
      type4Count * 1.0;

    // Calculate manual essay total
    const dist = inputData.essayScoreDistribution;
    const essayScore =
      (dist.biet?.reduce((a, b) => a + b, 0) || 0) +
      (dist.hieu?.reduce((a, b) => a + b, 0) || 0) +
      (dist.van_dung?.reduce((a, b) => a + b, 0) || 0);

    const essayCount = q.essay.biet + q.essay.hieu + q.essay.van_dung;

    // Avg score per question for the Level summary (Approximate)
    const avgEssay = essayCount > 0 ? essayScore / essayCount : 0;

    const calcLevel = (level: "biet" | "hieu" | "van_dung") => {
      // Accurate Essay part for level
      const essayLevelScore = (
        inputData.essayScoreDistribution[level] || []
      ).reduce((a, b) => a + b, 0);

      return (
        q.type1[level] * 0.25 +
        q.type2[level] * 1.0 +
        q.type3[level] * 1.0 +
        q.type4[level] * 1.0 +
        essayLevelScore
      );
    };

    const nb = calcLevel("biet");
    const th = calcLevel("hieu");
    const vd = calcLevel("van_dung");

    return {
      objScore: Math.round(objScore * 100) / 100,
      essayScore: Math.round(essayScore * 100) / 100,
      essayCount,
      nb: Math.round(nb * 100) / 100,
      th: Math.round(th * 100) / 100,
      vd: Math.round(vd * 100) / 100,
      total: Math.round((objScore + essayScore) * 100) / 100,
    };
  }, [inputData.questionConfig, inputData.essayScoreDistribution]);

  // --- Handlers ---

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "examType") {
      let newDuration = inputData.duration;
      if (value.includes("15 phút")) newDuration = 15;
      else if (value.includes("45 phút")) newDuration = 45;
      else if (value.includes("Giữa") || value.includes("Cuối"))
        newDuration = 60;

      setInputData((prev) => ({
        ...prev,
        [name]: value,
        duration: newDuration,
      }));

      // Auto-filter topics when exam type changes
      if (inputData.chapters.length > 0) {
        applySmartFilter(value, inputData.chapters);
      }
    } else {
      setInputData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const calculateScores = () => {
    const q = inputData.questionConfig;
    const t1 = (q.type1.biet + q.type1.hieu + q.type1.van_dung) * 0.25;
    const t2 = (q.type2.biet + q.type2.hieu + q.type2.van_dung) * 1.0;
    const t3 = (q.type3.biet + q.type3.hieu + q.type3.van_dung) * 1.0;
    const t4 = (q.type4.biet + q.type4.hieu + q.type4.van_dung) * 1.0;
    const tracNghiemScore = t1 + t2 + t3 + t4;

    const essayScore =
      inputData.essayScoreDistribution.biet.reduce((a, b) => a + b, 0) +
      inputData.essayScoreDistribution.hieu.reduce((a, b) => a + b, 0) +
      inputData.essayScoreDistribution.van_dung.reduce((a, b) => a + b, 0);

    return { tracNghiemScore, essayScore, total: tracNghiemScore + essayScore };
  };

  const autoAdjustTracNghiem = () => {
    const { tracNghiemScore } = calculateScores();
    const diff = 7.0 - tracNghiemScore;

    if (diff === 0) return;

    // Adjust Type 1 questions (0.25 points each)
    const numQuestionsToAdjust = Math.round(diff / 0.25);

    setInputData((prev) => {
      const q = prev.questionConfig.type1;
      let newBiet = q.biet;
      let newHieu = q.hieu;
      let newVD = q.van_dung;

      if (numQuestionsToAdjust > 0) {
        // Add questions
        newBiet += Math.ceil(numQuestionsToAdjust / 2);
        newHieu += Math.floor(numQuestionsToAdjust / 2);
      } else {
        // Remove questions
        let toRemove = Math.abs(numQuestionsToAdjust);
        while (toRemove > 0 && (newBiet > 0 || newHieu > 0 || newVD > 0)) {
          if (newBiet > 0 && toRemove > 0) {
            newBiet--;
            toRemove--;
          }
          if (newHieu > 0 && toRemove > 0) {
            newHieu--;
            toRemove--;
          }
          if (newVD > 0 && toRemove > 0) {
            newVD--;
            toRemove--;
          }
        }
      }

      return {
        ...prev,
        questionConfig: {
          ...prev.questionConfig,
          type1: { biet: newBiet, hieu: newHieu, van_dung: newVD },
        },
      };
    });
  };

  const handleConfigChange = (
    type: keyof QuestionConfig,
    level: keyof QuestionConfig["type1"],
    val: string,
  ) => {
    const num = parseInt(val) || 0;

    setInputData((prev) => {
      const newData = {
        ...prev,
        questionConfig: {
          ...prev.questionConfig,
          [type]: {
            ...prev.questionConfig[type],
            [level]: num,
          },
        },
      };

      // If changing Essay config, sync the distribution array
      if (type === "essay") {
        const currentArr = prev.essayScoreDistribution[level];
        let newArr = [...currentArr];
        if (num > currentArr.length) {
          // Added questions -> Init with 0
          newArr = [...newArr, ...Array(num - currentArr.length).fill(0)];
        } else if (num < currentArr.length) {
          // Removed questions
          newArr = newArr.slice(0, num);
        }
        newData.essayScoreDistribution = {
          ...prev.essayScoreDistribution,
          [level]: newArr,
        };
      }

      return newData;
    });
  };

  const handleEssayScoreUpdate = (
    level: "biet" | "hieu" | "van_dung",
    index: number,
    val: string,
  ) => {
    const score = parseFloat(val) || 0;
    setInputData((prev) => {
      const newArr = [...prev.essayScoreDistribution[level]];
      newArr[index] = score;
      return {
        ...prev,
        essayScoreDistribution: {
          ...prev.essayScoreDistribution,
          [level]: newArr,
        },
      };
    });
  };

  const distributeEssayScores = () => {
    const q = inputData.questionConfig.essay;
    const totalQ = q.biet + q.hieu + q.van_dung;
    if (totalQ === 0) return;

    // Weights for different levels
    const weightBiet = 1.0;
    const weightHieu = 1.5;
    const weightVD = 2.0;

    const totalWeight =
      q.biet * weightBiet + q.hieu * weightHieu + q.van_dung * weightVD;

    let pointsLeft = 3.0;

    const assign = (count: number, weight: number, isLastGroup: boolean) => {
      const arr = [];
      for (let i = 0; i < count; i++) {
        if (isLastGroup && i === count - 1) {
          // Last question gets all remaining points to ensure exactly 3.0
          arr.push(Math.max(0.25, Math.round(pointsLeft * 4) / 4));
        } else {
          // Calculate share based on weight, rounded to nearest 0.25
          let share = Math.round((weight / totalWeight) * 3.0 * 4) / 4;
          // Ensure at least 0.25 points
          share = Math.max(0.25, share);
          arr.push(share);
          pointsLeft -= share;
        }
      }
      return arr;
    };

    const newDist = {
      biet: assign(q.biet, weightBiet, q.hieu === 0 && q.van_dung === 0),
      hieu: assign(q.hieu, weightHieu, q.van_dung === 0),
      van_dung: assign(q.van_dung, weightVD, true),
    };

    // If total is not exactly 3.0 due to rounding, adjust the last non-zero element
    const currentTotal =
      newDist.biet.reduce((a, b) => a + b, 0) +
      newDist.hieu.reduce((a, b) => a + b, 0) +
      newDist.van_dung.reduce((a, b) => a + b, 0);
    if (currentTotal !== 3.0) {
      const diff = 3.0 - currentTotal;
      if (q.van_dung > 0) newDist.van_dung[newDist.van_dung.length - 1] += diff;
      else if (q.hieu > 0) newDist.hieu[newDist.hieu.length - 1] += diff;
      else if (q.biet > 0) newDist.biet[newDist.biet.length - 1] += diff;
    }

    setInputData((prev) => ({ ...prev, essayScoreDistribution: newDist }));
  };

  const handleSaveExam = async () => {
    // If we are currently editing, save the content first
    if (isEditing && editorRef.current) {
      const contentToSave = editorRef.current.innerHTML;
      if (currentStep === AppStep.MATRIX) {
        setGenState((prev) => ({ ...prev, matrix: contentToSave }));
      } else if (currentStep === AppStep.SPECS) {
        setGenState((prev) => ({ ...prev, specs: contentToSave }));
      } else if (currentStep === AppStep.EXAM) {
        setGenState((prev) => ({ ...prev, exam: contentToSave }));
      }
      setIsEditing(false);
    }

    if (!genState.exam && !genState.matrix && !genState.specs) return;

    let defaultTitle = `Đề thi ${inputData.subject} - ${inputData.grade} (${inputData.examType})`;
    if (currentStep === AppStep.MATRIX)
      defaultTitle = `Ma trận ${inputData.subject} - ${inputData.grade}`;
    else if (currentStep === AppStep.SPECS)
      defaultTitle = `Đặc tả ${inputData.subject} - ${inputData.grade}`;

    setProposedExamTitle(defaultTitle);
    setShowSaveNamingModal(true);
  };

  const finalizeSaveExam = async () => {
    if (
      (!genState.exam && !genState.matrix && !genState.specs) ||
      !proposedExamTitle.trim()
    )
      return;

    const examId = Date.now().toString();
    const newExam: SavedExam = {
      id: examId,
      title: proposedExamTitle.trim(),
      subject: inputData.subject,
      grade: inputData.grade,
      createdAt: new Date().toISOString(),
      matrix: genState.matrix,
      specs: genState.specs,
      exam: genState.exam,
    };

    setShowSaveNamingModal(false);

    if (user) {
      const examRef = doc(db, "users", user.uid, "exams", examId);
      try {
        await setDoc(examRef, { ...newExam, uid: user.uid });
        setSuccessMessage("Đã lưu đề thi vào kho lưu trữ đám mây!");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, examRef.path);
      }
    } else {
      const updatedExams = [newExam, ...savedExams];
      setSavedExams(updatedExams);
      localStorage.setItem("ais_saved_exams", JSON.stringify(updatedExams));
      setSuccessMessage("Đã lưu đề thi vào trình duyệt!");
    }
  };

  const handleDeleteSavedExam = async (id: string) => {
    if (!showDeleteConfirm) {
      const exam = savedExams.find((e) => e.id === id);
      if (exam) {
        setShowDeleteConfirm({ id, title: exam.title });
      }
      return;
    }

    try {
      if (user) {
        const examRef = doc(db, "users", user.uid, "exams", id);
        await deleteDoc(examRef);
      } else {
        const updatedExams = savedExams.filter((e) => e.id !== id);
        setSavedExams(updatedExams);
        localStorage.setItem("ais_saved_exams", JSON.stringify(updatedExams));
      }
      setSuccessMessage("Đã xóa đề thi thành công!");
      setShowDeleteConfirm(null);
    } catch (err) {
      if (user) {
        const examRef = doc(db, "users", user.uid, "exams", id);
        handleFirestoreError(err, OperationType.DELETE, examRef.path);
      } else {
        alert("Lỗi khi xóa đề thi cục bộ.");
      }
    }
  };

  const handleLoadSavedExam = (exam: SavedExam) => {
    setGenState({
      matrix: exam.matrix,
      specs: exam.specs,
      exam: exam.exam,
      isLoading: false,
      error: null,
    });
    setInputData((prev) => ({
      ...prev,
      subject: exam.subject,
      grade: exam.grade,
    }));
    setCurrentStep(AppStep.EXAM);
    setCompletedSteps(3);
    setShowSavedExams(false);
  };

  const addChapter = () => {
    const newChap: Chapter = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: "Chương mới",
      lessons: [],
      totalPeriods: 0,
    };
    setInputData((prev) => ({
      ...prev,
      chapters: [...prev.chapters, newChap],
    }));
    setExpandedChapterIds((prev) => new Set([...prev, newChap.id]));
  };

  const deleteChapter = (chapId: string) => {
    setInputData((prev) => ({
      ...prev,
      chapters: prev.chapters.filter((c) => c.id !== chapId),
    }));
  };

  const updateChapterName = (chapId: string, name: string) => {
    setInputData((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === chapId ? { ...c, name } : c,
      ),
    }));
  };

  const addLesson = (chapId: string) => {
    const newLesson: Lesson = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: "Bài học mới",
      periods: 1,
      objectives: {},
    };
    setInputData((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === chapId ? { ...c, lessons: [...c.lessons, newLesson] } : c,
      ),
    }));
    setSelectedLessonIds((prev) => new Set([...prev, newLesson.id]));
  };

  const deleteLesson = (chapId: string, lessonId: string) => {
    setInputData((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === chapId
          ? { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) }
          : c,
      ),
    }));
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      next.delete(lessonId);
      return next;
    });
  };

  const updateLesson = (
    chapId: string,
    lessonId: string,
    updates: Partial<Lesson>,
  ) => {
    setInputData((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === chapId
          ? {
              ...c,
              lessons: c.lessons.map((l) =>
                l.id === lessonId ? { ...l, ...updates } : l,
              ),
            }
          : c,
      ),
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > MAX_FILE_SIZE * 2) {
      // Allow up to 20MB total for multiple files
      setGenState((prev) => ({
        ...prev,
        error: `Tổng dung lượng file quá lớn. Vui lòng chọn các file dưới 20MB.`,
      }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsAnalyzingFile(true);
    setUploadedFileName(
      files.length === 1 ? (files[0] as File).name : `${files.length} tài liệu`,
    );
    setGenState((prev) => ({ ...prev, error: null }));

    try {
      const extracted = await extractInfoFromDocuments(files);

      if (!extracted.chapters || extracted.chapters.length === 0) {
        throw new Error(
          "Không tìm thấy thông tin bài học/chương trong các file. Vui lòng kiểm tra nội dung file.",
        );
      }

      // Ensure unique IDs for all extracted chapters and lessons
      const cleanedChapters = (extracted.chapters || []).map((chap, cIdx) => ({
        ...chap,
        id: `c-${Date.now()}-${cIdx}-${Math.random().toString(36).substr(2, 4)}`,
        lessons: (chap.lessons || []).map((lesson, lIdx) => ({
          ...lesson,
          id: `l-${Date.now()}-${cIdx}-${lIdx}-${Math.random().toString(36).substr(2, 4)}`,
        })),
      }));

      setInputData((prev) => {
        const newData = {
          ...prev,
          subject: extracted.subject || prev.subject,
          grade: extracted.grade || prev.grade,
          topics: extracted.topics || prev.topics,
          chapters: cleanedChapters,
          referenceContent: extracted.referenceContent || prev.referenceContent,
          referenceFiles: extracted.referenceFiles || prev.referenceFiles,
        };

        // Auto select based on exam type
        applySmartFilter(prev.examType, newData.chapters);
        return newData;
      });
    } catch (error: any) {
      setGenState((prev) => ({ ...prev, error: error.message }));
      setUploadedFileName(null);
    } finally {
      setIsAnalyzingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleChapter = (chapId: string) => {
    const newSet = new Set(expandedChapterIds);
    if (newSet.has(chapId)) newSet.delete(chapId);
    else newSet.add(chapId);
    setExpandedChapterIds(newSet);
  };

  const toggleLesson = (lessonId: string) => {
    const newSet = new Set(selectedLessonIds);
    if (newSet.has(lessonId)) newSet.delete(lessonId);
    else newSet.add(lessonId);
    setSelectedLessonIds(newSet);
  };

  // --- Generation Steps ---

  const handleGenerateStep1 = async () => {
    setGenState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      if (selectedLessonIds.size === 0)
        throw new Error("Vui lòng chọn ít nhất một bài học.");
      if (Math.abs(scoreStats.essayScore - 3.0) > 0.05)
        throw new Error("Tổng điểm Tự luận phải bằng 3.0 điểm.");

      const matrix = await generateStep1Matrix(inputData, selectedLessonIds);
      setGenState((prev) => ({ ...prev, matrix, isLoading: false }));
      setCurrentStep(AppStep.MATRIX);
      setCompletedSteps(Math.max(completedSteps, 1));
    } catch (e: any) {
      setGenState((prev) => ({ ...prev, isLoading: false, error: e.message }));
    }
  };

  const handleGenerateStep2 = async () => {
    setGenState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const specs = await generateStep2Specs(
        genState.matrix,
        inputData,
        selectedLessonIds,
      );
      setGenState((prev) => ({ ...prev, specs, isLoading: false }));
      setCurrentStep(AppStep.SPECS);
      setCompletedSteps(Math.max(completedSteps, 2));
    } catch (e: any) {
      setGenState((prev) => ({ ...prev, isLoading: false, error: e.message }));
    }
  };

  const handleGenerateStep3 = async () => {
    setGenState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const exam = await generateStep3Exam(genState.specs, inputData);
      setGenState((prev) => ({ ...prev, exam, isLoading: false }));
      setCurrentStep(AppStep.EXAM);
      setCompletedSteps(Math.max(completedSteps, 3));
    } catch (e: any) {
      setGenState((prev) => ({ ...prev, isLoading: false, error: e.message }));
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleEdit = (content: string) => {
    setEditValue(content);
    setIsEditing(true);
  };

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) {
      setEditValue(editorRef.current.innerHTML);
    }
  };

  const insertTable = () => {
    const rows = prompt("Nhập số hàng:", "3") || "3";
    const cols = prompt("Nhập số cột:", "3") || "3";
    let html =
      '<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid black;">';
    for (let i = 0; i < parseInt(rows); i++) {
      html += "<tr>";
      for (let j = 0; j < parseInt(cols); j++) {
        html +=
          '<td style="border: 1px solid black; padding: 5px; text-align: center;">&nbsp;</td>';
      }
      html += "</tr>";
    }
    html += "</table><p>&nbsp;</p>";
    execCmd("insertHTML", html);
  };

  const insertImage = () => {
    const url = prompt("Nhập URL hình ảnh:");
    if (url) {
      execCmd("insertImage", url);
    }
  };

  const insertFormula = () => {
    const formula = prompt("Nhập công thức (Latex/Văn bản):", "\\sqrt{a^2 + b^2}");
    if (formula) {
      // Basic math layout for visual representation
      const html = `<span style="font-family: 'Times New Roman'; font-style: italic; background: #f8fafc; padding: 2px 4px; border-radius: 4px; border: 1px dashed #cbd5e1;">${formula}</span>&nbsp;`;
      execCmd("insertHTML", html);
    }
  };

  const saveEdit = () => {
    // Get content from ref if available (Visual Editor), otherwise fallback to editValue (just in case)
    const contentToSave = editorRef.current
      ? editorRef.current.innerHTML
      : editValue;

    if (currentStep === AppStep.MATRIX) {
      setGenState((prev) => ({
        ...prev,
        matrix: contentToSave,
        specs: "",
        exam: "",
      }));
      setCompletedSteps(1);
    } else if (currentStep === AppStep.SPECS) {
      setGenState((prev) => ({
        ...prev,
        specs: contentToSave,
        exam: "",
      }));
      setCompletedSteps(2);
    } else if (currentStep === AppStep.EXAM) {
      setGenState((prev) => ({ ...prev, exam: contentToSave }));
    }
    setIsEditing(false);
  };

  const handleSaveSelectedToBank = () => {
    const selection = window.getSelection();
    let text = "";
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = document.createElement("div");
      container.appendChild(range.cloneContents());
      text = container.innerHTML || selection.toString();
    }

    if (text.trim().length > 0) {
      setPrefillQuestionContent(text);
      setSelectionContext(null);
      setShowQuestionBank(true);
    } else {
      setGenState((prev) => ({
        ...prev,
        error:
          "Vui lòng bôi đen (chọn) phần nội dung câu hỏi muốn đóng góp vào kho.",
      }));
      setTimeout(() => setGenState((prev) => ({ ...prev, error: null })), 4000);
    }
  };

  const handleMatrixUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGenState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const html = await convertMatrixFileToHtml(file);
      setGenState((prev) => ({ ...prev, matrix: html, isLoading: false }));
      setCurrentStep(AppStep.MATRIX);
      setCompletedSteps(Math.max(completedSteps, 1));
    } catch (err: any) {
      setGenState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message,
      }));
    }
  };

  const getExcelBlob = (htmlContent: string) => {
    try {
      const div = document.createElement("div");
      div.innerHTML = htmlContent;
      const table = div.querySelector("table");
      if (!table) return null;
      const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      return new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (e) {
      console.error("Error creating Excel blob:", e);
      return null;
    }
  };

  const handleDownloadExcel = (htmlContent: string, fileName: string) => {
    const blob = getExcelBlob(htmlContent);
    if (!blob) {
      alert("Không tìm thấy bảng dữ liệu để xuất Excel.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getWordBlob = (
    content: string,
    fileName: string,
    splitMode: "full" | "exam" | "key" = "full",
    orientation: "portrait" | "landscape" = "portrait",
  ) => {
    let contentToExport = content;

    const splitMarker = "HƯỚNG DẪN CHẤM";
    const splitIndex = content.indexOf(splitMarker);

    if (splitIndex !== -1) {
      if (splitMode === "exam") {
        contentToExport = content.substring(0, splitIndex);
      } else if (splitMode === "key") {
        contentToExport =
          `<h2 style="text-align: center; font-weight: bold;">HƯỚNG DẪN CHẤM VÀ THANG ĐIỂM</h2>` +
          content.substring(splitIndex + splitMarker.length);
      }
    }

    const header = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                xmlns:w='urn:schemas-microsoft-com:office:word' 
                xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
              <meta charset='utf-8'>
              <title>${fileName}</title>
              <style>
                  @page WordSection1 {
                      size: ${orientation === "landscape" ? "29.7cm 21.0cm" : "21.0cm 29.7cm"}; /* A4 */
                      margin: 2.0cm 1.5cm 2.0cm 2.0cm; /* top right bottom left */
                      mso-page-orientation: ${orientation};
                  }
                  div.WordSection1 { page: WordSection1; }
                  body { 
                      font-family: 'Times New Roman', serif; 
                      font-size: 14pt; 
                      line-height: 1.0; 
                      text-align: justify;
                      letter-spacing: 0pt;
                      mso-font-kerning: 0pt;
                  }
                  p, div {
                      margin-top: 0pt;
                      margin-bottom: 0pt;
                      text-align: justify;
                      line-height: 1.0;
                  }
                  table, th, td {
                      border: 1pt solid black;
                  }
                  table { 
                      border-collapse: collapse; 
                      width: 100%; 
                      margin: 0pt; 
                      mso-table-lspace: 0pt;
                      mso-table-rspace: 0pt;
                      margin-left: auto;
                      margin-right: auto;
                  }
                  td, th { 
                      padding: 2pt; 
                      vertical-align: top; 
                      mso-border-alt: 0.5pt solid black;
                      text-align: left;
                  }
                  table.options-table, table.options-table td {
                      border: none !important;
                      padding: 2pt;
                      mso-border-alt: none;
                  }
                  .header-table, .header-table td, .header-table th, .header-table p { 
                      border: none !important; 
                      mso-border-alt: none !important; 
                      text-align: left !important;
                  }
                  .question-text {
                      text-align: justify;
                      margin-bottom: 10px;
                  }
                  .options-container {
                      display: flex;
                      flex-wrap: wrap;
                      justify-content: flex-start;
                      margin-bottom: 15px;
                  }
                  .option {
                      flex: 0 0 auto;
                      min-width: 100pt;
                      padding-right: 10px;
                      box-sizing: border-box;
                  }
                  .option.w-1-4 { width: 25%; }
                  .option.w-1-2 { width: 50%; }
                  .option.w-full { width: 100%; flex: 1 1 100%; }
                  h3, h4 { text-align: center; margin: 10px 0; font-weight: bold; text-transform: uppercase; }
                  img { max-width: 100%; height: auto; }
              </style>
          </head>
          <body>
              <div class="WordSection1">
      `;
    const footer = "</div></body></html>";
    const sourceHTML = header + contentToExport + footer;

    return new Blob([sourceHTML], { type: "application/msword" });
  };

  const handleExportWord = (
    content: string,
    fileName: string,
    splitMode: "full" | "exam" | "key" = "full",
  ) => {
    const orientation =
      currentStep === AppStep.MATRIX || currentStep === AppStep.SPECS
        ? "landscape"
        : "portrait";
    const blob = getWordBlob(content, fileName, splitMode, orientation);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}_${splitMode === "full" ? "DayDu" : splitMode === "exam" ? "DeThi" : "DapAn"}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    setGenState((prev) => ({ ...prev, isLoading: true }));
    try {
      const zip = new JSZip();
      const folderName = `Bo_De_Thi_${inputData.subject || "MonHoc"}_Lop${inputData.grade || "Khoi"}`;
      const folder = zip.folder(folderName);

      if (!folder) throw new Error("Could not create zip folder");

      // 1. Matrix Excel
      const matrixBlob = getExcelBlob(genState.matrix);
      if (matrixBlob) folder.file("01_Ma_tran.xlsx", matrixBlob);

      const matrixWord = getWordBlob(
        genState.matrix,
        "Ma_tran",
        "full",
        "landscape",
      );
      folder.file("01_Ma_tran.doc", matrixWord);

      // 2. Specs Excel
      const specsBlob = getExcelBlob(genState.specs);
      if (specsBlob) folder.file("02_Bang_dac_ta.xlsx", specsBlob);

      const specsWord = getWordBlob(
        genState.specs,
        "Bang_dac_ta",
        "full",
        "landscape",
      );
      folder.file("02_Bang_dac_ta.doc", specsWord);

      // 3. Word files
      const examContent = genState.exam || editValue;
      const wordFull = getWordBlob(examContent, "De_Thi_Day_Du", "full");
      folder.file("03_De_Thi_va_Dap_An.doc", wordFull);

      const wordExam = getWordBlob(examContent, "De_Thi_Only", "exam");
      folder.file("04_De_Thi.doc", wordExam);

      const wordKey = getWordBlob(examContent, "Dap_An_Only", "key");
      folder.file("05_Huong_dan_cham.doc", wordKey);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Lỗi khi tạo file Zip: " + e.message);
    } finally {
      setGenState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // --- Rendering ---

  if (!isKeyConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        {/* Auth UI */}
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200">
              <Key className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Cấu hình API</h1>
            <p className="text-slate-500 text-sm mt-1 text-center">
              Vui lòng nhập Gemini API Key để bắt đầu
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Google Gemini API Key
              </label>
              <input
                type="password"
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Nhập API Key của bạn..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-2">
                Bạn có thể lấy key tại{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  className="text-blue-600 hover:underline"
                >
                  aistudio.google.com
                </a>
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                checked={rememberKey}
                onChange={(e) => setRememberKey(e.target.checked)}
              />
              <label
                htmlFor="remember"
                className="ml-2 text-sm text-slate-600 cursor-pointer"
              >
                Lưu khóa này cho lần sau
              </label>
            </div>

            <button
              onClick={handleSaveKey}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!apiKey.trim()}
            >
              Bắt đầu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderNumberInput = (
    type: keyof QuestionConfig,
    level: keyof QuestionConfig["type1"],
    label: string,
  ) => {
    const value = inputData.questionConfig[type][level];
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
          {label}
        </span>
        <div className="flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all hover:border-blue-300 shadow-sm">
          <button
            onClick={() =>
              handleConfigChange(type, level, String(Math.max(0, value - 1)))
            }
            className="px-3 py-2 text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-colors border-right border-slate-100"
            title="Giảm"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="number"
            min="0"
            className="w-full text-center py-2 text-sm font-bold text-slate-800 outline-none bg-transparent"
            value={value}
            onChange={(e) => handleConfigChange(type, level, e.target.value)}
          />
          <button
            onClick={() => handleConfigChange(type, level, String(value + 1))}
            className="px-3 py-2 text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-colors border-left border-slate-100"
            title="Tăng"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderConfigInput = (type: keyof QuestionConfig, label: string) => (
    <div className="mb-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
      <label className="block text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
        {label}
      </label>
      <div className="grid grid-cols-3 gap-4">
        {renderNumberInput(type, "biet", "Nhận biết")}
        {renderNumberInput(type, "hieu", "Thông hiểu")}
        {renderNumberInput(type, "van_dung", "Vận dụng")}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <AnimatePresence mode="wait">
        {!dbConnected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white py-2 px-4 shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>
                <b>LỖI KẾT NỐI:</b> Trình duyệt không thể kết nối với Cơ sở dữ
                liệu Firestore. Hệ thống đang thử lại...
              </span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-xs underline bg-red-700 hover:bg-red-800 px-2 py-1 rounded transition-colors"
            >
              Tải lại trang
            </button>
          </motion.div>
        )}
        {isAnalyzingFile && (
          <LoadingOverlay key="analyzing" message="Đang xử lý tài liệu..." />
        )}
        {genState.isLoading && (
          <LoadingOverlay
            key="generating"
            message={
              currentStep === AppStep.INPUT
                ? "Đang tạo Ma trận..."
                : currentStep === AppStep.MATRIX
                  ? "Đang soạn Bảng đặc tả..."
                  : currentStep === AppStep.SPECS
                    ? "Đang soạn Đề thi..."
                    : currentStep === AppStep.EXAM
                      ? "Đang soạn lại Đề thi..."
                      : "Đang xử lý..."
            }
          />
        )}
      </AnimatePresence>
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
              AI
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800">
              EXAMCRAFT AI
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuestionBank(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-all active:scale-95"
              title="Kho câu hỏi"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Kho câu hỏi</span>
            </button>
            <button
              onClick={() => setShowSavedExams(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-95"
              title="Kho lưu trữ cá nhân"
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">
                Kho lưu trữ ({savedExams.length})
              </span>
            </button>

            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {user ? (
              <div className="flex items-center gap-2 pl-2">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-slate-800 leading-none">
                    {user.displayName || "Giáo viên"}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[120px]">
                    {user.email}
                  </p>
                </div>
                <div className="relative group">
                  <img
                    src={
                      user.photoURL ||
                      `https://ui-avatars.com/api/?name=${user.displayName || "User"}&background=random`
                    }
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border-2 border-white shadow-sm cursor-pointer"
                    alt="Avatar"
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      type="button"
                      onClick={() => signOut(auth)}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Đăng xuất
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  signInWithPopup(auth, googleProvider).catch((err) => {
                    console.error("Auth Error:", err);
                    if (err.code === 'auth/unauthorized-domain') {
                      const currentHostname = window.location.hostname;
                      const sharedHostname = currentHostname.replace('ais-dev-', 'ais-pre-');
                      
                      // Using a nicer modal or at least a very clear message
                      alert(
                        `⚠️ LỖI TÊN MIỀN CHƯA ĐƯỢC CẤP PHÉP (Unauthorized Domain)\n\n` +
                        `Firebase từ chối đăng nhập vì tên miền này chưa có trong danh sách trắng.\n\n` +
                        `CÁCH KHẮC PHỤC:\n` +
                        `1. Truy cập: https://console.firebase.google.com\n` +
                        `2. Chọn dự án của bạn.\n` +
                        `3. Vào Build -> Authentication -> Settings -> Authorized domains.\n` +
                        `4. Nhấp 'Add domain' và thêm 2 tên miền sau:\n` +
                        `   - ${currentHostname}\n` +
                        `   - ${sharedHostname}\n\n` +
                        `Sau đó hãy thử đăng nhập lại!`
                      );
                    } else {
                      alert(`Lỗi đăng nhập: ${err.message}`);
                    }
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
              title="Hướng dẫn sử dụng"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
              title="Đổi API Key"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
              title="Làm mới"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <StepIndicator
        currentStep={currentStep}
        setStep={setCurrentStep}
        completedSteps={completedSteps}
      />

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <QuestionBankModal
        isOpen={showQuestionBank}
        onClose={() => {
          setShowQuestionBank(false);
          setSelectionContext(null);
          setPrefillQuestionContent("");
        }}
        selectionMode={selectionContext !== null}
        multiSelectMode={selectionContext === "pre-select"}
        prefillContent={prefillQuestionContent}
        initialFilters={{
          subject: inputData.subject,
          grade: inputData.grade,
        }}
        onSelectQuestions={(selectedQuestions) => {
          if (selectionContext === "pre-select") {
            setInputData((prev) => ({
              ...prev,
              preSelectedQuestions: [
                ...(prev.preSelectedQuestions || []),
                ...selectedQuestions,
              ],
            }));
            setSuccessMessage(
              `Đã thêm ${selectedQuestions.length} câu hỏi vào danh sách chỉ định!`,
            );
            setShowQuestionBank(false);
            setSelectionContext(null);
          }
        }}
        onSelectQuestion={(q) => {
          if (selectionContext === "pre-select") {
            setInputData((prev) => ({
              ...prev,
              preSelectedQuestions: [...(prev.preSelectedQuestions || []), q],
            }));
            setSuccessMessage("Đã thêm câu hỏi vào danh sách chỉ định!");
            setShowQuestionBank(false);
            setSelectionContext(null);
          } else if (selectionContext === "insert") {
            // Insert into editor
            let answerContent = q.answer || "";

            // If it's an essay and we want a scoring table
            if (q.type === "essay" && answerContent) {
              // Check if it's already a table, if not, let's try to make it one or at least wrap it nicely
              if (!answerContent.includes("<table")) {
                answerContent = `
                  <table border="1" style="width:100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                      <tr style="background-color: #f8fafc;">
                        <th style="width: 20%; padding: 5px; border: 1px solid black;">Ý/Bước giải</th>
                        <th style="padding: 5px; border: 1px solid black;">Nội dung trả lời chi tiết</th>
                        <th style="width: 15%; padding: 5px; border: 1px solid black;">Điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${answerContent
                        .split("\n")
                        .map((line) =>
                          line.trim()
                            ? `
                        <tr>
                          <td style="padding: 5px; border: 1px solid black;">...</td>
                          <td style="padding: 5px; border: 1px solid black;">${line}</td>
                          <td style="padding: 5px; border: 1px solid black;">...</td>
                        </tr>
                      `
                            : "",
                        )
                        .join("")}
                    </tbody>
                  </table>
                  <p style="font-size: 11px; color: #64748b; margin-top: 5px;">* Gợi ý: Hãy phân nhỏ điểm đến 0.25đ hoặc 0.5đ cho từng ý trả lời.</p>
                `;
              }
            }

            const htmlToInsert = `
              <div class="q-block" style="margin-bottom: 2em; border-left: 4px solid #3b82f6; padding-left: 1.5em; padding-top: 0.5em; padding-bottom: 0.5em; background-color: #f8fafc; border-radius: 0 8px 8px 0;">
                <div class="q-content" style="margin-bottom: 1em; font-weight: 500;">${q.content}</div>
                ${
                  answerContent
                    ? `
                  <div class="q-answer" style="font-size: 0.95em; color: #1e293b; background-color: #ffffff; padding: 1em; border-radius: 6px; border: 1px dashed #cbd5e1;">
                    <strong style="display: block; margin-bottom: 0.5em; color: #3b82f6;">Hướng dẫn chấm & Thang điểm:</strong> 
                    ${answerContent}
                  </div>
                `
                    : ""
                }
              </div>
            `;
            document.execCommand("insertHTML", false, htmlToInsert);
            setSuccessMessage("Đã chèn câu hỏi vào đề thi!");
            setShowQuestionBank(false);
            setSelectionContext(null);
          }
        }}
      />

      {/* Saved Exams Modal */}
      {showSavedExams && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Kho lưu trữ cá nhân
                  </h2>
                  <p className="text-sm text-slate-500">
                    Quản lý các đề thi bạn đã tạo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSavedExams(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên đề thi, môn học, lớp..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {savedExams.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <Archive className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">
                    Chưa có đề thi nào
                  </h3>
                  <p className="text-slate-500">
                    Các đề thi bạn lưu sẽ xuất hiện ở đây.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedExams
                    .filter(
                      (e) =>
                        e.title
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        e.subject
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        e.grade
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()),
                    )
                    .map((exam, idx) => (
                      <div
                        key={exam.id || `exam-${idx}`}
                        className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3
                            className="font-bold text-slate-800 line-clamp-2"
                            title={exam.title}
                          >
                            {exam.title}
                          </h3>
                          <button
                            onClick={() => handleDeleteSavedExam(exam.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />{" "}
                            {new Date(exam.createdAt).toLocaleDateString(
                              "vi-VN",
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> {exam.subject}{" "}
                            - {exam.grade}
                          </span>
                        </div>
                        <Button
                          className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border-0"
                          onClick={() => handleLoadSavedExam(exam)}
                        >
                          Mở đề thi này
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main
        className={`flex-1 ${currentStep === AppStep.MATRIX || currentStep === AppStep.SPECS ? "max-w-[98%]" : "max-w-7xl"} mx-auto w-full px-4 pb-12`}
      >
        {/* Progress Bar */}
        <div className="mb-6 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{
              width: `${((currentStep + 1) / (Object.keys(AppStep).length / 2)) * 100}%`,
            }}
          />
        </div>

        {genState.error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p>{genState.error}</p>
          </div>
        )}

        {/* STEP 1: INPUT */}
        {currentStep === AppStep.INPUT && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Config */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                {/* Info Section */}
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Thông tin chung
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      Môn học
                    </label>
                    <input
                      name="subject"
                      value={inputData.subject}
                      onChange={handleInputChange}
                      list="subject-suggestions"
                      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-800"
                      placeholder="VD: Toán, Ngữ Văn, Tin học..."
                    />
                    <datalist id="subject-suggestions">
                      <option value="Toán" />
                      <option value="Ngữ Văn" />
                      <option value="Tiếng Anh" />
                      <option value="Vật lí" />
                      <option value="Hóa học" />
                      <option value="Sinh học" />
                      <option value="Lịch sử" />
                      <option value="Địa lí" />
                      <option value="Tin học" />
                      <option value="Công nghệ" />
                      <option value="GDCD" />
                      <option value="Khoa học tự nhiên" />
                      <option value="Lịch sử và Địa lí" />
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Khối lớp
                      </label>
                      <input
                        name="grade"
                        value={inputData.grade}
                        onChange={handleInputChange}
                        list="grade-suggestions"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-800"
                        placeholder="6, 7, 8..."
                      />
                      <datalist id="grade-suggestions">
                        <option value="6" />
                        <option value="7" />
                        <option value="8" />
                        <option value="9" />
                        <option value="10" />
                        <option value="11" />
                        <option value="12" />
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Thời gian
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="duration"
                          value={inputData.duration}
                          onChange={handleInputChange}
                          list="duration-suggestions"
                          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-800"
                        />
                        <datalist id="duration-suggestions">
                          <option value="15" />
                          <option value="45" />
                          <option value="60" />
                          <option value="90" />
                          <option value="120" />
                        </datalist>
                        <span className="absolute right-4 top-3 text-slate-400 text-sm font-medium">
                          phút
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      Loại bài kiểm tra
                    </label>
                    <select
                      name="examType"
                      value={inputData.examType}
                      onChange={handleInputChange}
                      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-800 cursor-pointer"
                    >
                      <option>GIỮA KÌ I</option>
                      <option>CUỐI KÌ I</option>
                      <option>GIỮA KÌ II</option>
                      <option>CUỐI KÌ II</option>
                      <option>Thường xuyên (15 phút)</option>
                      <option>Định kỳ (45 phút)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-blue-600" />
                  Cấu trúc câu hỏi
                </h2>

                {/* PRE-SELECTED QUESTIONS */}
                <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" /> Câu hỏi chỉ
                      định từ kho
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => {
                        setSelectionContext("pre-select");
                        setShowQuestionBank(true);
                      }}
                      icon={<Plus className="w-3 h-3" />}
                    >
                      Chọn câu hỏi
                    </Button>
                  </div>
                  {inputData.preSelectedQuestions &&
                  inputData.preSelectedQuestions.length > 0 ? (
                    <div className="space-y-2">
                      {inputData.preSelectedQuestions.map((q, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-3 rounded-xl border border-blue-50 flex items-start justify-between gap-3 shadow-sm hover:border-blue-200 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-2 mb-1">
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {q.type}
                              </span>
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                {q.level}
                              </span>
                            </div>
                            <div
                              className="text-xs text-slate-700 line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: q.content }}
                            />
                          </div>
                          <button
                            onClick={() => {
                              setInputData((prev) => ({
                                ...prev,
                                preSelectedQuestions:
                                  prev.preSelectedQuestions?.filter(
                                    (_, i) => i !== idx,
                                  ),
                              }));
                            }}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-blue-500 italic">
                      Chưa có câu hỏi nào được chọn. AI sẽ tự động tạo toàn bộ
                      câu hỏi.
                    </p>
                  )}
                </div>

                {/* SCORE VALIDATION WARNINGS */}
                {(() => {
                  const { tracNghiemScore, essayScore, total } =
                    calculateScores();
                  const hasTracNghiemWarning = tracNghiemScore !== 7.0;
                  const hasEssayWarning = essayScore !== 3.0;

                  if (!hasTracNghiemWarning && !hasEssayWarning) return null;

                  return (
                    <div className="mb-6 space-y-3">
                      {hasTracNghiemWarning && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-amber-800">
                              Cảnh báo điểm Trắc nghiệm
                            </h4>
                            <p className="text-xs text-amber-700 mt-1">
                              Tổng điểm trắc nghiệm hiện tại là{" "}
                              <strong>{tracNghiemScore}đ</strong> (yêu cầu
                              7.0đ).
                            </p>
                            <button
                              onClick={autoAdjustTracNghiem}
                              className="mt-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold py-1 px-3 rounded transition-colors"
                            >
                              Tự động điều chỉnh (Dạng I)
                            </button>
                          </div>
                        </div>
                      )}
                      {hasEssayWarning && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-amber-800">
                              Cảnh báo điểm Tự luận
                            </h4>
                            <p className="text-xs text-amber-700 mt-1">
                              Tổng điểm tự luận hiện tại là{" "}
                              <strong>{essayScore}đ</strong> (yêu cầu 3.0đ).
                            </p>
                            {inputData.questionConfig.essay.biet +
                              inputData.questionConfig.essay.hieu +
                              inputData.questionConfig.essay.van_dung >
                            0 ? (
                              <button
                                onClick={distributeEssayScores}
                                className="mt-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold py-1 px-3 rounded transition-colors"
                              >
                                Tự động phân bổ lại
                              </button>
                            ) : (
                              <p className="text-xs text-red-600 mt-2 font-medium">
                                Vui lòng thêm ít nhất 1 câu tự luận để phân bổ
                                điểm.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {renderConfigInput("type1", "Dạng I: Trắc nghiệm (4 lựa chọn)")}
                {renderConfigInput("type2", "Dạng II: Đúng/Sai")}
                {renderConfigInput("type3", "Dạng III: Ghép nối")}
                {renderConfigInput("type4", "Dạng IV: Điền khuyết")}
                {renderConfigInput("essay", "Dạng V: Tự luận")}

                {/* ESSAY SCORE DISTRIBUTION MANUAL INPUT */}
                {inputData.questionConfig.essay.biet +
                  inputData.questionConfig.essay.hieu +
                  inputData.questionConfig.essay.van_dung >
                  0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm text-slate-700">
                        Phân phối điểm Tự luận
                      </h4>
                      <button
                        onClick={distributeEssayScores}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium bg-white px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                      >
                        <Calculator className="w-3 h-3" /> Chia đều
                      </button>
                    </div>
                    <div className="space-y-3">
                      {/* Mức Biết */}
                      {inputData.essayScoreDistribution.biet.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-500 block">
                            Mức Biết (
                            {inputData.essayScoreDistribution.biet.length} câu)
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {inputData.essayScoreDistribution.biet.map(
                              (score, i) => (
                                <input
                                  key={`biet-${i}`}
                                  type="number"
                                  step="0.25"
                                  className="w-16 text-sm p-1 border rounded text-center"
                                  value={score}
                                  onChange={(e) =>
                                    handleEssayScoreUpdate(
                                      "biet",
                                      i,
                                      e.target.value,
                                    )
                                  }
                                />
                              ),
                            )}
                          </div>
                        </div>
                      )}
                      {/* Mức Hiểu */}
                      {inputData.essayScoreDistribution.hieu.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-500 block">
                            Mức Hiểu (
                            {inputData.essayScoreDistribution.hieu.length} câu)
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {inputData.essayScoreDistribution.hieu.map(
                              (score, i) => (
                                <input
                                  key={`hieu-${i}`}
                                  type="number"
                                  step="0.25"
                                  className="w-16 text-sm p-1 border rounded text-center"
                                  value={score}
                                  onChange={(e) =>
                                    handleEssayScoreUpdate(
                                      "hieu",
                                      i,
                                      e.target.value,
                                    )
                                  }
                                />
                              ),
                            )}
                          </div>
                        </div>
                      )}
                      {/* Mức VD */}
                      {inputData.essayScoreDistribution.van_dung.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-500 block">
                            Mức Vận dụng (
                            {inputData.essayScoreDistribution.van_dung.length}{" "}
                            câu)
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {inputData.essayScoreDistribution.van_dung.map(
                              (score, i) => (
                                <input
                                  key={`vd-${i}`}
                                  type="number"
                                  step="0.25"
                                  className="w-16 text-sm p-1 border rounded text-center"
                                  value={score}
                                  onChange={(e) =>
                                    handleEssayScoreUpdate(
                                      "van_dung",
                                      i,
                                      e.target.value,
                                    )
                                  }
                                />
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      <div
                        className={`flex justify-between items-center text-xs pt-2 border-t border-slate-200 font-bold ${Math.abs(scoreStats.essayScore - 3.0) > 0.05 ? "text-red-600" : "text-blue-600"}`}
                      >
                        <span>Tổng điểm Tự luận:</span>
                        <span>{scoreStats.essayScore} / 3.0đ</span>
                      </div>
                      {Math.abs(scoreStats.essayScore - 3.0) > 0.05 && (
                        <p className="text-xs text-red-500 italic">
                          Vui lòng điều chỉnh sao cho tổng bằng 3.0
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* SUMMARY ROW UPDATED */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-4 gap-2 text-sm mb-2">
                    <div className="font-semibold text-slate-700 flex items-center">
                      Điểm số (Mức độ):
                    </div>
                    <div
                      className={`font-bold ${scoreStats.nb > 4 ? "text-red-500" : "text-blue-600"}`}
                    >
                      NB: {scoreStats.nb}đ
                    </div>
                    <div
                      className={`font-bold ${scoreStats.th > 4 ? "text-red-500" : "text-blue-600"}`}
                    >
                      TH: {scoreStats.th}đ
                    </div>
                    <div
                      className={`font-bold ${scoreStats.vd > 3 ? "text-red-500" : "text-purple-600"}`}
                    >
                      VD: {scoreStats.vd}đ
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-bold">
                        Trắc nghiệm
                      </span>
                      <span
                        className={`font-bold ${scoreStats.objScore !== 7 ? "text-red-600" : "text-slate-800"}`}
                      >
                        {scoreStats.objScore}/7.0đ
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-bold">
                        Tự luận
                      </span>
                      <span
                        className={`font-bold ${Math.abs(scoreStats.essayScore - 3.0) > 0.05 ? "text-red-600" : "text-blue-600"}`}
                      >
                        {scoreStats.essayScore}đ
                      </span>
                      <span className="text-xs text-slate-400 ml-1">
                        ({scoreStats.essayCount} câu)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-xs uppercase font-bold">
                        Tổng
                      </span>
                      <span
                        className={`font-bold ${scoreStats.total !== 10 ? "text-red-600" : "text-slate-800"}`}
                      >
                        {scoreStats.total}/10đ
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 italic">
                    *Quy tắc: Trắc nghiệm (I, II, III, IV) = 7đ. Tự luận (V) =
                    3đ (được chia đều cho số câu).
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-amber-600" /> Ghi chú bổ
                      sung (AI sẽ bám sát yêu cầu này)
                    </label>
                    <textarea
                      className="w-full bg-amber-50/50 border border-amber-100 rounded-lg p-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                      placeholder="Ví dụ: Đề thi tập trung vào phần Scratch, câu hỏi trắc nghiệm có 4 lựa chọn, tự luận yêu cầu vẽ sơ đồ khối..."
                      value={inputData.additionalNotes}
                      onChange={(e) =>
                        setInputData((prev) => ({
                          ...prev,
                          additionalNotes: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Content Selection */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    Nội dung kiến thức
                  </h2>
                  <div className="flex gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.png"
                      multiple
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectionContext("pre-select");
                        setPrefillQuestionContent("");
                        setShowQuestionBank(true);
                      }}
                      icon={<Database className="w-4 h-4" />}
                      className="text-sm shadow-sm hover:shadow"
                    >
                      Tạo đề từ kho câu hỏi
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      isLoading={isAnalyzingFile}
                      icon={<Upload className="w-4 h-4" />}
                      className="text-sm shadow-sm hover:shadow"
                    >
                      {uploadedFileName
                        ? "Chọn file khác"
                        : "Tải MỤC LỤC SGK / Tài liệu"}
                    </Button>
                  </div>
                </div>

                {inputData.chapters.length === 0 ? (
                  <div
                    className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-10 bg-slate-50 transition-colors hover:bg-slate-100 hover:border-blue-300 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                      <FileUp className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-center font-semibold text-slate-600 text-lg">
                      Chưa có dữ liệu bài học
                    </p>
                    <p className="text-sm mt-2 text-center max-w-sm">
                      Nhấp vào đây hoặc nút "Tải MỤC LỤC SGK và Tài liệu" để tải
                      lên file Mục lục, Sách giáo khoa hoặc Tài liệu tham khảo.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 border-blue-200 text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        addChapter();
                      }}
                    >
                      Hoặc tự thêm thủ công
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-[600px] pr-2 space-y-3">
                    <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-lg text-[13px] mb-2 border border-slate-200 shadow-sm">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5 line-clamp-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Đã chọn: {selectedLessonIds.size} bài học
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={addChapter}
                          className="flex items-center gap-1 text-green-600 hover:text-green-700 font-bold px-2.5 py-1.5 bg-white rounded-lg border border-green-200 shadow-sm transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Chương
                        </button>
                        <button
                          onClick={() =>
                            applySmartFilter(
                              inputData.examType,
                              inputData.chapters,
                            )
                          }
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold px-2.5 py-1.5 bg-white rounded-lg border border-blue-200 shadow-sm transition-all active:scale-95"
                        >
                          <Filter className="w-4 h-4" /> Gợi ý
                        </button>
                      </div>
                    </div>

                    {inputData.chapters.map((chap) => (
                      <div
                        key={chap.id}
                        className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-white shadow-sm hover:border-blue-200"
                      >
                        <div className="flex items-center justify-between p-3 bg-slate-50/50">
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              value={chap.name}
                              onChange={(e) =>
                                updateChapterName(chap.id, e.target.value)
                              }
                              className="font-bold text-sm text-slate-800 bg-transparent border-b border-transparent focus:border-blue-400 outline-none flex-1 py-1 transition-all"
                              placeholder="Tên chương..."
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => addLesson(chap.id)}
                              className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                              title="Thêm bài học"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteChapter(chap.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                              title="Xóa chương"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleChapter(chap.id)}
                              className="ml-1 p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              {expandedChapterIds.has(chap.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {expandedChapterIds.has(chap.id) && (
                          <div className="p-3 space-y-3 bg-white border-t border-slate-100">
                            {chap.lessons.length === 0 && (
                              <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                Chưa có bài học nào. Hãy nhấn "+" để thêm mới.
                              </p>
                            )}
                            {chap.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className={`flex flex-col p-3 rounded-xl border transition-all ${selectedLessonIds.has(lesson.id) ? "bg-blue-50/40 border-blue-200 ring-1 ring-blue-100" : "bg-slate-50/30 border-slate-100 hover:border-slate-200"}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    onClick={() => toggleLesson(lesson.id)}
                                    className={`w-6 h-6 mt-0.5 rounded-lg border-2 flex items-center justify-center cursor-pointer shrink-0 transition-all ${selectedLessonIds.has(lesson.id) ? "bg-blue-500 border-blue-500 shadow-sm" : "bg-white border-slate-200 hover:border-blue-400"}`}
                                  >
                                    {selectedLessonIds.has(lesson.id) && (
                                      <Check className="w-4 h-4 text-white stroke-[3px]" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <input
                                      value={lesson.name}
                                      onChange={(e) =>
                                        updateLesson(chap.id, lesson.id, {
                                          name: e.target.value,
                                        })
                                      }
                                      className="w-full font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-blue-400 outline-none transition-all py-1 text-[15px]"
                                      placeholder="Tên bài học..."
                                    />
                                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                                          Số tiết:
                                        </span>
                                        <input
                                          type="number"
                                          value={lesson.periods}
                                          onChange={(e) =>
                                            updateLesson(chap.id, lesson.id, {
                                              periods:
                                                parseInt(e.target.value) || 0,
                                            })
                                          }
                                          className="w-12 text-sm px-2 py-1 bg-white border border-slate-200 rounded-md text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none transition-all shadow-sm"
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                                          Tuần:
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            value={lesson.weekStart || ""}
                                            placeholder="Từ"
                                            onChange={(e) =>
                                              updateLesson(chap.id, lesson.id, {
                                                weekStart:
                                                  parseInt(e.target.value) || 0,
                                              })
                                            }
                                            className="w-11 text-sm px-2 py-1 bg-white border border-slate-200 rounded-md text-center font-semibold text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none transition-all shadow-sm"
                                          />
                                          <span className="text-slate-300 font-bold">
                                            -
                                          </span>
                                          <input
                                            type="number"
                                            value={lesson.weekEnd || ""}
                                            placeholder="Đến"
                                            onChange={(e) =>
                                              updateLesson(chap.id, lesson.id, {
                                                weekEnd:
                                                  parseInt(e.target.value) || 0,
                                              })
                                            }
                                            className="w-11 text-sm px-2 py-1 bg-white border border-slate-200 rounded-md text-center font-semibold text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none transition-all shadow-sm"
                                          />
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          deleteLesson(chap.id, lesson.id)
                                        }
                                        className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all ml-auto border border-transparent hover:border-red-100"
                                        title="Xóa bài"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <Target className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                          Yêu cầu cần đạt:
                                        </span>
                                      </div>
                                      <textarea
                                        placeholder="Nhập yêu cầu cần đạt (AI sẽ bám sát nội dung này để tạo câu hỏi)..."
                                        value={
                                          Object.values(lesson.objectives).join(
                                            "; ",
                                          ) || ""
                                        }
                                        onChange={(e) => {
                                          const currentLesson =
                                            chap.lessons.find(
                                              (l) => l.id === lesson.id,
                                            );
                                          updateLesson(chap.id, lesson.id, {
                                            objectives: {
                                              ...(currentLesson?.objectives ||
                                                {}),
                                              biet: e.target.value,
                                            },
                                          });
                                        }}
                                        className="w-full text-xs text-slate-600 bg-slate-50/50 border border-slate-100 focus:bg-white focus:border-blue-200 focus:ring-2 focus:ring-blue-50/50 rounded-lg p-2.5 min-h-[50px] resize-none outline-none leading-relaxed transition-all italic"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end gap-4">
                  <input
                    type="file"
                    ref={matrixDirectUploadRef}
                    onChange={handleMatrixUpload}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => matrixDirectUploadRef.current?.click()}
                    className="shadow-sm hover:shadow"
                  >
                    Có sẵn Ma trận?
                  </Button>
                  <Button
                    onClick={handleGenerateStep1}
                    disabled={selectedLessonIds.size === 0}
                    isLoading={genState.isLoading}
                    icon={<ArrowRight className="w-5 h-5" />}
                    className="px-6 py-2.5 text-base shadow-md hover:shadow-lg"
                  >
                    Tạo Ma trận
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2, 3, 4: PREVIEW & ACTIONS */}
        {currentStep !== AppStep.INPUT && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)]">
            <div className="lg:col-span-8 h-full flex flex-col">
              <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 p-4 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  {currentStep === AppStep.MATRIX
                    ? "Ma trận đề thi"
                    : currentStep === AppStep.SPECS
                      ? "Bảng đặc tả"
                      : "Đề thi chi tiết"}
                  {isEditing && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal">
                      Chế độ sửa
                    </span>
                  )}
                </h2>
                <div className="flex gap-2">
                  {currentStep === AppStep.EXAM && !isEditing && (
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
                      <button
                        onClick={() => setIsPreviewMobile(false)}
                        className={`p-1.5 rounded-md transition-all ${!isPreviewMobile ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                        title="Xem trên Máy tính"
                      >
                        <Monitor className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsPreviewMobile(true)}
                        className={`p-1.5 rounded-md transition-all ${isPreviewMobile ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                        title="Xem trên Điện thoại"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {!isEditing ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        handleEdit(
                          currentStep === AppStep.MATRIX
                            ? genState.matrix
                            : currentStep === AppStep.SPECS
                              ? genState.specs
                              : genState.exam,
                        )
                      }
                      icon={<Pencil className="w-4 h-4" />}
                    >
                      Chỉnh sửa
                    </Button>
                  ) : (
                    <>
                      {currentStep === AppStep.EXAM && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={handleSaveSelectedToBank}
                            icon={<Save className="w-4 h-4" />}
                          >
                            Lưu phần chọn vào kho
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectionContext("insert");
                              setShowQuestionBank(true);
                            }}
                            icon={<Database className="w-4 h-4" />}
                          >
                            Chèn từ kho
                          </Button>
                        </>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => setIsEditing(false)}
                        icon={<X className="w-4 h-4" />}
                      >
                        Hủy
                      </Button>
                      <Button
                        onClick={saveEdit}
                        icon={<Save className="w-4 h-4" />}
                      >
                        Lưu
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 bg-slate-100 border border-slate-200 overflow-hidden relative">
                {genState.isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <div className="text-center">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-blue-700 font-medium animate-pulse">
                        {currentStep === AppStep.INPUT
                          ? "Đang tạo Ma trận..."
                          : currentStep === AppStep.MATRIX
                            ? "Đang soạn Bảng đặc tả..."
                            : currentStep === AppStep.SPECS
                              ? "Đang soạn Đề thi..."
                              : currentStep === AppStep.EXAM
                                ? "Đang soạn lại Đề thi..."
                                : "Đang xử lý..."}
                      </p>
                    </div>
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="w-full h-full flex flex-col bg-slate-100">
                    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500 shadow-sm z-10">
                      <div className="flex items-center gap-2">
                        {isPreviewMobile ? (
                          <Smartphone className="w-3 h-3 text-blue-600" />
                        ) : (
                          <FileText className="w-3 h-3 text-blue-600" />
                        )}
                        <span className="font-medium text-slate-700">
                          Chế độ chỉnh sửa{" "}
                          {isPreviewMobile ? "Điện thoại" : "Máy tính"} (Layout)
                        </span>
                      </div>
                      <div className="italic text-slate-400">
                        Nhấp trực tiếp vào văn bản để chỉnh sửa
                      </div>
                    </div>

                    {/* Rich Text Toolbar */}
                    <div className="bg-slate-50 border-b border-slate-200 p-1 flex flex-wrap items-center gap-1 z-10">
                      <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 gap-0.5">
                        <button
                          onClick={() => execCmd("bold")}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="In đậm"
                        >
                          <span className="font-bold">B</span>
                        </button>
                        <button
                          onClick={() => execCmd("italic")}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="In nghiêng"
                        >
                          <span className="italic font-serif">I</span>
                        </button>
                        <button
                          onClick={() => execCmd("underline")}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Gạch chân"
                        >
                          <span className="underline font-sans">U</span>
                        </button>
                      </div>

                      <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 gap-0.5">
                        <button
                          onClick={() => execCmd("justifyLeft")}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Căn trái"
                        >
                          <AlignLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => execCmd("justifyCenter")}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Căn giữa"
                        >
                          <AlignCenter className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => execCmd("justifyRight")}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Căn phải"
                        >
                          <AlignRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => execCmd("justifyFull")}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Căn đều"
                        >
                          <AlignJustify className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 gap-0.5">
                        <button
                          onClick={insertTable}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors flex items-center gap-1 text-slate-700"
                          title="Chèn bảng"
                        >
                          <Table className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const node = window.getSelection()?.anchorNode;
                            const table = (node as any)?.closest?.("table");
                            if (table && table.rows.length > 0) {
                              const newRow = table.insertRow();
                              for (let i = 0; i < table.rows[0].cells.length; i++) {
                                const cell = newRow.insertCell();
                                cell.style.border = "1px solid black";
                                cell.style.padding = "5px";
                                cell.style.textAlign = "center";
                                cell.innerHTML = "&nbsp;";
                              }
                              setEditValue(editorRef.current?.innerHTML || "");
                            } else {
                              alert("Vui lòng đặt con trỏ vào trong bảng để thêm hàng.");
                            }
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-600"
                          title="Thêm hàng"
                        >
                          <div className="relative">
                            <Table className="w-4 h-4" />
                            <Plus className="w-2 h-2 absolute -bottom-1 -right-1 bg-white" />
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            const node = window.getSelection()?.anchorNode;
                            const table = (node as any)?.parentElement?.closest?.("table");
                            if (table && table.rows.length > 0) {
                              for (let i = 0; i < table.rows.length; i++) {
                                const row = table.rows[i];
                                const cell = row.insertCell();
                                cell.style.border = "1px solid black";
                                cell.style.padding = "5px";
                                cell.style.textAlign = "center";
                                cell.innerHTML = "&nbsp;";
                              }
                              setEditValue(editorRef.current?.innerHTML || "");
                            } else {
                              alert("Vui lòng đặt con trỏ vào trong bảng để thêm cột.");
                            }
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-600"
                          title="Thêm cột"
                        >
                          <div className="relative">
                            <Grid3X3 className="w-4 h-4" />
                            <Plus className="w-2 h-2 absolute -bottom-1 -right-1 bg-white" />
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            const node = window.getSelection()?.anchorNode;
                            const td = (node as any)?.parentElement?.closest?.("td");
                            const tr = td?.parentElement;
                            const table = tr?.parentElement?.closest?.("table");
                            if (table && tr) {
                              table.deleteRow(tr.rowIndex);
                              setEditValue(editorRef.current?.innerHTML || "");
                            } else {
                              alert("Vui lòng đặt con trỏ vào hàng cần xóa.");
                            }
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors text-red-600"
                          title="Xóa hàng"
                        >
                          <div className="relative">
                            <Table className="w-4 h-4" />
                            <Minus className="w-2 h-2 absolute -bottom-1 -right-1 bg-white" />
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            const node = window.getSelection()?.anchorNode;
                            const td = (node as any)?.parentElement?.closest?.("td");
                            const table = td?.parentElement?.closest?.("table");
                            if (table && td) {
                              const cellIndex = td.cellIndex;
                              for (let i = 0; i < table.rows.length; i++) {
                                table.rows[i].deleteCell(cellIndex);
                              }
                              setEditValue(editorRef.current?.innerHTML || "");
                            } else {
                              alert("Vui lòng đặt con trỏ vào cột cần xóa.");
                            }
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors text-red-600"
                          title="Xóa cột"
                        >
                          <div className="relative">
                            <Grid3X3 className="w-4 h-4" />
                            <Minus className="w-2 h-2 absolute -bottom-1 -right-1 bg-white" />
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 gap-0.5">
                        <button
                          onClick={insertImage}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Chèn ảnh"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={insertFormula}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Chèn công thức"
                        >
                          <Sigma className="w-4 h-4" />
                        </button>
                        <div className="relative group">
                          <button
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            title="Màu chữ"
                          >
                            <Palette className="w-4 h-4" />
                          </button>
                          <div className="absolute top-full left-0 bg-white border border-slate-200 shadow-lg rounded p-2 hidden group-hover:grid grid-cols-4 gap-1 z-20">
                            {[
                              "#000000",
                              "#ef4444",
                              "#22c55e",
                              "#3b82f6",
                              "#f59e0b",
                              "#8b5cf6",
                              "#64748b",
                              "#ec4899",
                            ].map((c) => (
                              <button
                                key={c}
                                onClick={() => execCmd("foreColor", c)}
                                className="w-5 h-5 rounded border border-slate-200"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                      <div
                        className={`bg-white shadow-xl ${isPreviewMobile ? "w-[375px] h-[667px] rounded-[2rem] border-[12px] border-slate-900 overflow-y-auto" : currentStep === AppStep.MATRIX || currentStep === AppStep.SPECS ? "w-[297mm] min-h-[210mm]" : "w-[210mm] min-h-[297mm]"} relative`}
                        style={
                          !isPreviewMobile
                            ? {
                                paddingTop: `${visualConfig.margins.top}cm`,
                                paddingBottom: `${visualConfig.margins.bottom}cm`,
                                paddingLeft: `${visualConfig.margins.left}cm`,
                                paddingRight: `${visualConfig.margins.right}cm`,
                                fontFamily: visualConfig.fontFamily,
                                fontSize: visualConfig.fontSize,
                                lineHeight: visualConfig.lineHeight,
                                color: visualConfig.primaryColor,
                              }
                            : { padding: "1.5rem" }
                        }
                      >
                        <style>{`
                                                .print-editor-content {
                                                    font-family: 'Times New Roman', serif;
                                                    font-size: 13pt;
                                                    line-height: 1.0;
                                                    color: #000;
                                                    outline: none;
                                                    text-align: justify;
                                                }
                                                .print-editor-content p, .print-editor-content div {
                                                    margin-top: 0pt;
                                                    margin-bottom: 0pt;
                                                    line-height: 1.0;
                                                    text-align: justify;
                                                    padding: 0;
                                                }
                                                .print-editor-content table, .print-editor-content th, .print-editor-content td { 
                                                    border: 1px solid black; 
                                                }
                                                .print-editor-content table { 
                                                    border-collapse: collapse; 
                                                    width: 100%; 
                                                    margin: 0pt; 
                                                }
                                                .print-editor-content td, .print-editor-content th { 
                                                    padding: 2px; 
                                                    vertical-align: top; 
                                                    text-align: left;
                                                }
                                                .print-editor-content table.options-table, .print-editor-content table.options-table td {
                                                    border: none !important;
                                                    padding: 2px;
                                                }
                                                .print-editor-content .header-table, .print-editor-content .header-table td, .print-editor-content .header-table p { 
                                                    border: none !important; 
                                                    text-align: left !important;
                                                }
                                                .print-editor-content .question-text {
                                                    text-align: justify;
                                                    margin-bottom: 10px;
                                                    display: block;
                                                }
                                                .print-editor-content .options-container {
                                                    display: flex;
                                                    flex-wrap: wrap;
                                                    justify-content: flex-start;
                                                    margin-bottom: 15px;
                                                    gap: 8px;
                                                }
                                                .print-editor-content .option {
                                                    flex: 0 0 auto;
                                                    min-width: fit-content;
                                                    padding-right: 15px;
                                                    white-space: nowrap;
                                                    box-sizing: border-box;
                                                }
                                                .print-editor-content .option.w-1-4 { width: 25%; }
                                                .print-editor-content .option.w-1-2 { width: 50%; }
                                                .print-editor-content .option.w-full { width: 100%; flex: 1 1 100%; }
                                                .print-editor-content h3, .print-editor-content h4 { text-align: center; margin: 10px 0; font-weight: bold; }
                                                .print-editor-content img { max-width: 100%; height: auto; }
                                                .print-editor-content ul, .print-editor-content ol { padding-left: 20px; }
                                                .print-editor-content p { margin-bottom: 0.5em; }

                                                /* SCRATCH BLOCKS CSS */
                                                .scratch-block { display: inline-flex; align-items: center; padding: 6px 10px; margin: 2px; border-radius: 5px; color: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.2); border: 1px solid rgba(0,0,0,0.1); white-space: nowrap; vertical-align: middle; }
                                                .scratch-bg-motion { background-color: #4C97FF; border-color: #3373CC; }
                                                .scratch-bg-looks { background-color: #9966FF; border-color: #774DCB; }
                                                .scratch-bg-sound { background-color: #CF63CF; border-color: #BD43BD; }
                                                .scratch-bg-events { background-color: #FFBF00; border-color: #CC9900; }
                                                .scratch-bg-control { background-color: #FFAB19; border-color: #CF8B17; }
                                                .scratch-bg-sensing { background-color: #5CB1D6; border-color: #2E8EB8; }
                                                .scratch-bg-operators { background-color: #59C059; border-color: #389438; }
                                                .scratch-bg-variables { background-color: #FF8C1A; border-color: #DB6E00; }
                                                .scratch-bg-myblocks { background-color: #FF6680; border-color: #D94D63; }
                                                .scratch-input { background-color: white; color: black; border-radius: 10px; padding: 2px 8px; margin: 0 4px; font-weight: normal; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1); }
                                                .scratch-dropdown { background-color: rgba(0,0,0,0.1); color: white; border-radius: 10px; padding: 2px 8px; margin: 0 4px; display: inline-flex; align-items: center; }
                                                .scratch-dropdown::after { content: '▼'; font-size: 8px; margin-left: 4px; }
                                                .scratch-c-wrap { display: flex; flex-direction: column; margin: 2px 0; }
                                                .scratch-c-top { border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-bottom-left-radius: 0; padding: 6px 10px; color: white; font-weight: bold; display: inline-flex; align-items: center; }
                                                .scratch-c-mouth { border-left: 12px solid; padding-left: 8px; min-height: 20px; display: flex; flex-direction: column; }
                                                .scratch-c-bottom { height: 12px; border-left: 12px solid; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px; opacity: 0.9; }
                                            `}</style>
                        <div
                          ref={editorRef}
                          className="print-editor-content"
                          contentEditable={true}
                          suppressContentEditableWarning={true}
                          dangerouslySetInnerHTML={{ __html: editValue }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`w-full h-full flex flex-col ${isPreviewMobile ? "items-center justify-center p-8 bg-slate-200/50" : ""}`}
                  >
                    {isPreviewMobile ? (
                      <div className="w-[375px] h-[667px] bg-slate-900 rounded-[3rem] p-3 border-[12px] border-slate-950 shadow-2xl relative flex flex-col focus:outline-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-b-xl z-20"></div>
                        <div className="w-full h-full bg-white rounded-[2rem] overflow-y-auto p-5 pb-10 custom-mobile-preview">
                          <MarkdownView
                            content={genState.exam}
                            config={visualConfig}
                          />
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-2 border-slate-800 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
                        </div>
                      </div>
                    ) : (
                      <MarkdownView
                        content={
                          currentStep === AppStep.MATRIX
                            ? genState.matrix
                            : currentStep === AppStep.SPECS
                              ? genState.specs
                              : genState.exam
                        }
                        config={visualConfig}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Actions (Sidebar) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">Thao tác</h3>
                <div className="space-y-3">
                  {currentStep === AppStep.MATRIX && (
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                          Tiếp tục quy trình
                        </p>
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm"
                          onClick={handleGenerateStep2}
                          isLoading={genState.isLoading}
                        >
                          Tạo Bảng đặc tả{" "}
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                          Xuất dữ liệu & Upload
                        </p>
                        <Button
                          variant="outline"
                          className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 justify-start"
                          onClick={() =>
                            handleDownloadExcel(genState.matrix, "Ma_tran")
                          }
                          icon={<FileSpreadsheet className="w-4 h-4" />}
                        >
                          Xuất Excel Ma trận
                        </Button>
                        <input
                          type="file"
                          ref={matrixUploadRef}
                          onChange={handleMatrixUpload}
                          className="hidden"
                          accept="image/*,.pdf"
                        />
                        <Button
                          variant="secondary"
                          className="w-full bg-slate-50 text-slate-600 border-slate-200"
                          onClick={() => matrixUploadRef.current?.click()}
                          icon={<FileText className="w-4 h-4" />}
                        >
                          Upload Ma trận khác
                        </Button>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <Button
                          variant="secondary"
                          className="w-full bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          onClick={handleGenerateStep1}
                          isLoading={genState.isLoading}
                          icon={<RotateCcw className="w-4 h-4" />}
                        >
                          Tạo lại Ma trận (Xóa hết)
                        </Button>
                      </div>
                    </div>
                  )}

                  {currentStep === AppStep.SPECS && (
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                          Tiếp tục quy trình
                        </p>
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm"
                          onClick={handleGenerateStep3}
                          isLoading={genState.isLoading}
                        >
                          Soạn Đề thi <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                          Xuất dữ liệu
                        </p>
                        <Button
                          variant="outline"
                          className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 justify-start"
                          onClick={() =>
                            handleDownloadExcel(genState.specs, "Bang_dac_ta")
                          }
                          icon={<FileSpreadsheet className="w-4 h-4" />}
                        >
                          Xuất Excel Đặc tả
                        </Button>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <Button
                          variant="secondary"
                          className="w-full bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          onClick={handleGenerateStep2}
                          isLoading={genState.isLoading}
                          icon={<RotateCcw className="w-4 h-4" />}
                        >
                          Tạo lại Đặc tả
                        </Button>
                      </div>
                    </div>
                  )}

                  {currentStep === AppStep.EXAM && (
                    <div className="flex flex-col gap-5">
                      {/* Section 1: Regeneration Notes */}
                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> Ghi chú điều
                          chỉnh (AI bám sát)
                        </label>
                        <textarea
                          className="w-full bg-white border border-amber-200 rounded-lg p-3 text-sm text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none min-h-[100px] shadow-inner"
                          placeholder="Ví dụ: Chuyển 2 câu trắc nghiệm thành tự luận, thêm câu hỏi về phần Scratch..."
                          value={inputData.additionalNotes}
                          onChange={(e) =>
                            setInputData((prev) => ({
                              ...prev,
                              additionalNotes: e.target.value,
                            }))
                          }
                        />
                        <Button
                          variant="secondary"
                          className="w-full mt-3 bg-white border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm"
                          onClick={handleGenerateStep3}
                          isLoading={genState.isLoading}
                          icon={<RotateCcw className="w-4 h-4" />}
                        >
                          Tạo lại Đề thi
                        </Button>
                      </div>

                      {/* Section 2: Storage Actions */}
                      <div className="space-y-2 pb-4 border-b border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1 ml-1">
                          <Save className="w-3 h-3" /> Lưu trữ & Chia sẻ
                        </p>
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm py-2.5"
                          onClick={handleSaveExam}
                          disabled={!genState.exam}
                          icon={<Save className="w-4 h-4" />}
                        >
                          Lưu vào kho cá nhân
                        </Button>
                        <Button
                          className="w-full bg-slate-800 hover:bg-slate-900 shadow-md py-2.5"
                          onClick={handleDownloadAll}
                          isLoading={genState.isLoading}
                          icon={<Archive className="w-4 h-4" />}
                        >
                          Tải toàn bộ (Zip)
                        </Button>
                      </div>

                      {/* Section 3: Word Export */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                          Xuất Word (.docx)
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            variant="outline"
                            className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 justify-start h-auto py-3 px-4"
                            onClick={() =>
                              handleExportWord(
                                genState.exam || editValue,
                                "De_Thi_Full",
                                "full",
                              )
                            }
                            icon={
                              <FileText className="w-5 h-5 flex-shrink-0" />
                            }
                          >
                            <div className="text-left">
                              <div className="font-bold text-sm">
                                Đề thi đầy đủ
                              </div>
                              <div className="text-[10px] opacity-70">
                                Bao gồm cả Đề và Đáp án
                              </div>
                            </div>
                          </Button>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              className="flex-1 min-w-[120px] text-blue-600 border-blue-200 hover:bg-blue-50 py-2.5 px-2 text-xs"
                              onClick={() =>
                                handleExportWord(
                                  genState.exam || editValue,
                                  "De_Thi_Only",
                                  "exam",
                                )
                              }
                              icon={
                                <FileSignature className="w-3 h-3 flex-shrink-0" />
                              }
                            >
                              Chỉ Đề thi
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 min-w-[120px] text-blue-600 border-blue-200 hover:bg-blue-50 py-2.5 px-2 text-xs"
                              onClick={() =>
                                handleExportWord(
                                  genState.exam || editValue,
                                  "Dap_An_Only",
                                  "key",
                                )
                              }
                              icon={<Split className="w-3 h-3 flex-shrink-0" />}
                            >
                              Chỉ Đáp án
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Print & Data */}
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          In ấn & Dữ liệu khác
                        </p>
                        <div className="space-y-2">
                          <Button
                            variant="secondary"
                            className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 border-0"
                            onClick={() => window.print()}
                            icon={<Download className="w-4 h-4" />}
                          >
                            In trực tiếp / Lưu PDF
                          </Button>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              className="flex-1 min-w-[110px] text-[10px] text-slate-600 border-slate-200 hover:bg-slate-50 px-2"
                              onClick={() =>
                                handleDownloadExcel(genState.matrix, "Ma_tran")
                              }
                              icon={
                                <FileSpreadsheet className="w-3 h-3 flex-shrink-0" />
                              }
                            >
                              File Ma trận
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 min-w-[110px] text-[10px] text-slate-600 border-slate-200 hover:bg-slate-50 px-2"
                              onClick={() =>
                                handleDownloadExcel(
                                  genState.specs,
                                  "Bang_dac_ta",
                                )
                              }
                              icon={
                                <FileSpreadsheet className="w-3 h-3 flex-shrink-0" />
                              }
                            >
                              File Đặc tả
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Section 5: Visual Config */}
                      <div className="pt-2 border-t border-slate-100">
                        <details className="group">
                          <summary className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center justify-between cursor-pointer hover:text-blue-600 transition-colors list-none">
                            <span className="flex items-center gap-1">
                              <Pencil className="w-3 h-3" /> Tùy chỉnh hiển thị
                            </span>
                            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                          </summary>
                          <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-100 mt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">
                                  Font chữ
                                </label>
                                <select
                                  className="w-full text-[11px] p-2 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-blue-500"
                                  value={visualConfig.fontFamily}
                                  onChange={(e) =>
                                    setVisualConfig((v) => ({
                                      ...v,
                                      fontFamily: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="'Times New Roman', serif">
                                    Times New Roman
                                  </option>
                                  <option value="'Arial', sans-serif">
                                    Arial
                                  </option>
                                  <option value="'Inter', sans-serif">
                                    Inter
                                  </option>
                                  <option value="'JetBrains Mono', monospace">
                                    Kỹ thuật (Mono)
                                  </option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">
                                  Cỡ chữ
                                </label>
                                <input
                                  type="text"
                                  className="w-full text-[11px] p-2 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-blue-500"
                                  value={visualConfig.fontSize}
                                  onChange={(e) =>
                                    setVisualConfig((v) => ({
                                      ...v,
                                      fontSize: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">
                                  Giãn dòng
                                </label>
                                <input
                                  type="text"
                                  className="w-full text-[11px] p-2 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-blue-500"
                                  value={visualConfig.lineHeight}
                                  onChange={(e) =>
                                    setVisualConfig((v) => ({
                                      ...v,
                                      lineHeight: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">
                                  Lề trái (cm)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-full text-[11px] p-2 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-blue-500"
                                  value={visualConfig.margins.left}
                                  onChange={(e) =>
                                    setVisualConfig((v) => ({
                                      ...v,
                                      margins: {
                                        ...v.margins,
                                        left: parseFloat(e.target.value) || 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </details>
                      </div>

                      {/* Section 6: Error Report */}
                      {errorReport.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                            <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Quét lỗi
                              tự động ({errorReport.length})
                            </p>
                            <div className="space-y-3 max-h-[150px] overflow-y-auto pr-1">
                              {errorReport.map((err) => (
                                <div
                                  key={err.id}
                                  className="text-[11px] border-l-2 border-red-300 pl-3"
                                >
                                  <div className="font-bold text-red-700 flex items-start gap-1">
                                    {err.message}
                                  </div>
                                  {err.suggestedFix && (
                                    <div className="text-slate-600 mt-0.5 italic text-[10px]">
                                      💡 {err.suggestedFix}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleBack}
                      disabled={genState.isLoading}
                    >
                      Quay lại
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                <p className="font-bold mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Mẹo
                </p>
                {currentStep === AppStep.MATRIX &&
                  "Kiểm tra kỹ tỉ lệ nhận thức (Biết/Hiểu/Vận dụng) trước khi sang bước tiếp theo."}
                {currentStep === AppStep.SPECS &&
                  "Bạn có thể chỉnh sửa trực tiếp nội dung đặc tả nếu AI nhận diện chưa chính xác."}
                {currentStep === AppStep.EXAM &&
                  "Sử dụng chức năng 'Xuất File Word' để tải về và chỉnh sửa định dạng sâu hơn trong Microsoft Word."}
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          Tác giả: <span className="font-bold text-blue-600">THC</span>
        </div>
      </footer>

      {/* -- Global Modals & Toasts -- */}
      <AnimatePresence>
        {/* Success Toast */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10"
          >
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white stroke-[3px]" />
            </div>
            <p className="font-bold text-sm whitespace-nowrap">
              {successMessage}
            </p>
          </motion.div>
        )}

        {/* Save Naming Modal */}
        {showSaveNamingModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6 text-blue-600">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Save className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  Đặt tên Đề thi
                </h3>
              </div>

              <p className="text-sm text-slate-500 mb-4 leading-relaxed font-medium">
                Vui lòng nhập tên cho đề thi này để dễ dàng quản lý trong kho
                lưu trữ cá nhân của bạn.
              </p>

              <input
                autoFocus
                type="text"
                placeholder="Ví dụ: Đề cương Tin học 8 Giữa kì I..."
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold mb-6"
                value={proposedExamTitle}
                onChange={(e) => setProposedExamTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && finalizeSaveExam()}
              />

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowSaveNamingModal(false)}
                >
                  Hủy
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={finalizeSaveExam}
                >
                  Lưu lại
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-xs w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Xác nhận xóa?
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Bạn có chắc chắn muốn xóa đề thi <br />
                <span className="font-bold text-slate-800">
                  "{showDeleteConfirm.title}"
                </span>
                ?
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleDeleteSavedExam(showDeleteConfirm.id)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-red-100"
                >
                  Xóa vĩnh viễn
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-all"
                >
                  Bỏ qua
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
