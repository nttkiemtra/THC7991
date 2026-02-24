
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppStep, InputData, GenerationState, Lesson, Chapter, QuestionConfig } from './types';
import StepIndicator from './components/StepIndicator';
import Button from './components/Button';
import MarkdownView from './components/MarkdownView';
import HelpModal from './components/HelpModal';
import { generateStep1Matrix, generateStep2Specs, generateStep3Exam, extractInfoFromDocument, convertMatrixFileToHtml, configureGenAI } from './services/geminiService';
import { ArrowRight, RotateCcw, FileText, Download, AlertCircle, Upload, Clock, Check, ChevronDown, ChevronRight, Filter, FileUp, FileSpreadsheet, Beaker, Pencil, Save, X, Key, LogOut, FileSignature, Split, Code, Calculator, HelpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.INPUT);
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  
  // -- Auth State --
  const [apiKey, setApiKey] = useState('');
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [rememberKey, setRememberKey] = useState(true);

  // -- Help Modal State --
  const [showHelp, setShowHelp] = useState(false);

  // -- Data State --
  const [inputData, setInputData] = useState<InputData>({
    subject: '',
    grade: '',
    duration: 45,
    examType: 'Giữa kỳ 1',
    topics: '',
    additionalNotes: '',
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
    }
  });

  // -- UI State --
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());
  
  // -- Editing State --
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  const [genState, setGenState] = useState<GenerationState>({
    matrix: '',
    specs: '',
    exam: '',
    isLoading: false,
    error: null
  });

  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const matrixUploadRef = useRef<HTMLInputElement>(null);
  const matrixDirectUploadRef = useRef<HTMLInputElement>(null);

  // --- Auth Logic ---
  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
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
          localStorage.setItem('GEMINI_API_KEY', apiKey);
      } else {
          localStorage.removeItem('GEMINI_API_KEY');
      }
      setIsKeyConfigured(true);
  };

  const handleLogout = () => {
      setIsKeyConfigured(false);
      setApiKey('');
      localStorage.removeItem('GEMINI_API_KEY');
      window.location.reload();
  };

  // --- Helpers ---

  const applySmartFilter = (type: string, chapters: Chapter[]) => {
    const lowerType = type.toLowerCase();
    let startWeek = 0;
    let endWeek = 100;

    if (lowerType.includes('giữa kỳ 1') || lowerType.includes('giữa học kỳ 1')) {
      startWeek = 1; endWeek = 9; // Approx
    } else if (lowerType.includes('cuối kỳ 1') || lowerType.includes('cuối học kỳ 1')) {
      startWeek = 1; endWeek = 18;
    } else if (lowerType.includes('giữa kỳ 2') || lowerType.includes('giữa học kỳ 2')) {
      startWeek = 19; endWeek = 27;
    } else if (lowerType.includes('cuối kỳ 2') || lowerType.includes('cuối học kỳ 2')) {
      startWeek = 19; endWeek = 35;
    }

    const newSelected = new Set<string>();
    const newExpanded = new Set<string>();

    chapters.forEach(chap => {
      let hasSelectedLesson = false;
      chap.lessons.forEach(lesson => {
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
      
      const objScore = (type1Count * 0.25) + (type2Count * 1.0) + (type3Count * 1.0) + (type4Count * 1.0);
      
      // Calculate manual essay total
      const dist = inputData.essayScoreDistribution;
      const essayScore = 
          (dist.biet?.reduce((a, b) => a + b, 0) || 0) +
          (dist.hieu?.reduce((a, b) => a + b, 0) || 0) +
          (dist.van_dung?.reduce((a, b) => a + b, 0) || 0);

      const essayCount = q.essay.biet + q.essay.hieu + q.essay.van_dung;

      // Avg score per question for the Level summary (Approximate)
      const avgEssay = essayCount > 0 ? essayScore / essayCount : 0;
      
      const calcLevel = (level: 'biet' | 'hieu' | 'van_dung') => {
          // Accurate Essay part for level
          const essayLevelScore = (inputData.essayScoreDistribution[level] || []).reduce((a, b) => a + b, 0);

          return (q.type1[level] * 0.25) +
                 (q.type2[level] * 1.0) +
                 (q.type3[level] * 1.0) +
                 (q.type4[level] * 1.0) +
                 essayLevelScore;
      };

      const nb = calcLevel('biet');
      const th = calcLevel('hieu');
      const vd = calcLevel('van_dung');
      
      return {
          objScore: Math.round(objScore * 100) / 100,
          essayScore: Math.round(essayScore * 100) / 100,
          essayCount,
          nb: Math.round(nb * 100) / 100,
          th: Math.round(th * 100) / 100,
          vd: Math.round(vd * 100) / 100,
          total: Math.round((objScore + essayScore) * 100) / 100
      };
  }, [inputData.questionConfig, inputData.essayScoreDistribution]);

  // --- Handlers ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'examType') {
      let newDuration = inputData.duration;
      if (value.includes('15 phút')) newDuration = 15;
      else if (value.includes('45 phút')) newDuration = 45;
      else if (value.includes('Giữa') || value.includes('Cuối')) newDuration = 60; 
      
      setInputData(prev => ({ ...prev, [name]: value, duration: newDuration }));
      
      // Auto-filter topics when exam type changes
      if (inputData.chapters.length > 0) {
          applySmartFilter(value, inputData.chapters);
      }

    } else {
      setInputData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleConfigChange = (type: keyof QuestionConfig, level: keyof QuestionConfig['type1'], val: string) => {
      const num = parseInt(val) || 0;
      
      setInputData(prev => {
          const newData = {
              ...prev,
              questionConfig: {
                  ...prev.questionConfig,
                  [type]: {
                      ...prev.questionConfig[type],
                      [level]: num
                  }
              }
          };

          // If changing Essay config, sync the distribution array
          if (type === 'essay') {
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
                  [level]: newArr
              };
          }

          return newData;
      });
  };

  const handleEssayScoreUpdate = (level: 'biet' | 'hieu' | 'van_dung', index: number, val: string) => {
      const score = parseFloat(val) || 0;
      setInputData(prev => {
          const newArr = [...prev.essayScoreDistribution[level]];
          newArr[index] = score;
          return {
              ...prev,
              essayScoreDistribution: {
                  ...prev.essayScoreDistribution,
                  [level]: newArr
              }
          };
      });
  };

  const distributeEssayScores = () => {
      const q = inputData.questionConfig.essay;
      const totalQ = q.biet + q.hieu + q.van_dung;
      if (totalQ === 0) return;

      let pointsLeft = 3.0;
      let questionsLeft = totalQ;

      const assign = (count: number) => {
          const arr = [];
          for (let i = 0; i < count; i++) {
              const share = Math.round((pointsLeft / questionsLeft) * 100) / 100;
              arr.push(share);
              pointsLeft -= share;
              questionsLeft--;
          }
          return arr;
      };
      
      const newDist = {
          biet: assign(q.biet),
          hieu: assign(q.hieu),
          van_dung: assign(q.van_dung)
      };

      setInputData(prev => ({ ...prev, essayScoreDistribution: newDist }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
        setGenState(prev => ({ ...prev, error: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn file dưới 10MB.` }));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    setIsAnalyzingFile(true);
    setUploadedFileName(file.name);
    setGenState(prev => ({ ...prev, error: null }));

    try {
      const extracted = await extractInfoFromDocument(file);
      
      if (!extracted.chapters || extracted.chapters.length === 0) {
         throw new Error("Không tìm thấy thông tin bài học/chủ đề trong file. Vui lòng kiểm tra nội dung file.");
      }

      setInputData(prev => {
        const newData = {
          ...prev,
          subject: extracted.subject || prev.subject,
          grade: extracted.grade || prev.grade,
          topics: extracted.topics || prev.topics,
          chapters: extracted.chapters || [],
        };
        
        // Auto select based on exam type
        applySmartFilter(prev.examType, newData.chapters);
        return newData;
      });

    } catch (error: any) {
      setGenState(prev => ({ ...prev, error: error.message }));
      setUploadedFileName(null);
    } finally {
      setIsAnalyzingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    setGenState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
        if (selectedLessonIds.size === 0) throw new Error("Vui lòng chọn ít nhất một bài học.");
        if (Math.abs(scoreStats.essayScore - 3.0) > 0.05) throw new Error("Tổng điểm Tự luận phải bằng 3.0 điểm.");
        
        const matrix = await generateStep1Matrix(inputData, selectedLessonIds);
        setGenState(prev => ({ ...prev, matrix, isLoading: false }));
        setCurrentStep(AppStep.MATRIX);
        setCompletedSteps(Math.max(completedSteps, 1));
    } catch (e: any) {
        setGenState(prev => ({ ...prev, isLoading: false, error: e.message }));
    }
  };

  const handleGenerateStep2 = async () => {
    setGenState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
        const specs = await generateStep2Specs(genState.matrix, inputData, selectedLessonIds);
        setGenState(prev => ({ ...prev, specs, isLoading: false }));
        setCurrentStep(AppStep.SPECS);
        setCompletedSteps(Math.max(completedSteps, 2));
    } catch (e: any) {
        setGenState(prev => ({ ...prev, isLoading: false, error: e.message }));
    }
  };

  const handleGenerateStep3 = async () => {
    setGenState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
        const exam = await generateStep3Exam(genState.specs, inputData);
        setGenState(prev => ({ ...prev, exam, isLoading: false }));
        setCurrentStep(AppStep.EXAM);
        setCompletedSteps(Math.max(completedSteps, 3));
    } catch (e: any) {
        setGenState(prev => ({ ...prev, isLoading: false, error: e.message }));
    }
  };

  const handleBack = () => {
      if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleEdit = (content: string) => {
      setEditValue(content);
      setIsEditing(true);
  };

  const saveEdit = () => {
      // Get content from ref if available (Visual Editor), otherwise fallback to editValue (just in case)
      const contentToSave = editorRef.current ? editorRef.current.innerHTML : editValue;

      if (currentStep === AppStep.MATRIX) {
        setGenState(prev => ({ 
            ...prev, 
            matrix: contentToSave,
            specs: '',
            exam: ''
        }));
        setCompletedSteps(1); 
      } else if (currentStep === AppStep.SPECS) {
        setGenState(prev => ({ 
            ...prev, 
            specs: contentToSave,
            exam: ''
        }));
        setCompletedSteps(2);
      } else if (currentStep === AppStep.EXAM) {
        setGenState(prev => ({ ...prev, exam: contentToSave }));
      }
      setIsEditing(false);
  };

  const handleMatrixUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setGenState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
          const html = await convertMatrixFileToHtml(file);
          setGenState(prev => ({ ...prev, matrix: html, isLoading: false }));
          setCurrentStep(AppStep.MATRIX);
          setCompletedSteps(Math.max(completedSteps, 1));
      } catch (err: any) {
          setGenState(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
  };

  const handleDownloadExcel = (htmlContent: string, fileName: string) => {
    try {
        const div = document.createElement('div');
        div.innerHTML = htmlContent;
        const table = div.querySelector('table');
        if (!table) {
            alert("Không tìm thấy bảng dữ liệu để xuất Excel.");
            return;
        }
        const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    } catch (e: any) {
        alert("Lỗi khi tạo file Excel: " + e.message);
    }
  };

  const handleExportWord = (content: string, fileName: string, splitMode: 'full' | 'exam' | 'key' = 'full') => {
      let contentToExport = content;
      
      const splitMarker = "HƯỚNG DẪN CHẤM";
      const splitIndex = content.indexOf(splitMarker);

      if (splitIndex !== -1) {
          if (splitMode === 'exam') {
              contentToExport = content.substring(0, splitIndex);
          } else if (splitMode === 'key') {
              contentToExport = `<h2 style="text-align: center; font-weight: bold;">HƯỚNG DẪN CHẤM VÀ THANG ĐIỂM</h2>` + content.substring(splitIndex + splitMarker.length);
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
                  body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; }
                  table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
                  td, th { border: 1px solid black; padding: 5px; vertical-align: top; }
                  .header-table td { border: none !important; }
                  h3, h4 { text-align: center; margin: 10px 0; }
                  img { max-width: 100%; height: auto; }
              </style>
          </head>
          <body>
      `;
      const footer = "</body></html>";
      const sourceHTML = header + contentToExport + footer;

      const blob = new Blob([sourceHTML], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}_${splitMode === 'full' ? 'DayDu' : splitMode === 'exam' ? 'DeThi' : 'DapAn'}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  // --- Rendering ---
  
  if (!isKeyConfigured) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
             {/* Auth UI */}
             <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200">
                 <div className="flex flex-col items-center mb-8">
                     <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-teal-200">
                         <Key className="w-8 h-8" />
                     </div>
                     <h1 className="text-2xl font-bold text-slate-800">Cấu hình API</h1>
                     <p className="text-slate-500 text-sm mt-1 text-center">Vui lòng nhập Gemini API Key để bắt đầu</p>
                 </div>
                 
                 <div className="space-y-4">
                     <div>
                         <label className="block text-sm font-semibold text-slate-700 mb-2">Google Gemini API Key</label>
                         <input 
                             type="password" 
                             className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                             placeholder="Nhập API Key của bạn..."
                             value={apiKey}
                             onChange={(e) => setApiKey(e.target.value)}
                         />
                         <p className="text-xs text-slate-400 mt-2">
                            Bạn có thể lấy key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-teal-600 hover:underline">aistudio.google.com</a>
                         </p>
                     </div>
                     
                     <div className="flex items-center">
                         <input 
                            type="checkbox" 
                            id="remember" 
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            checked={rememberKey}
                            onChange={(e) => setRememberKey(e.target.checked)}
                         />
                         <label htmlFor="remember" className="ml-2 text-sm text-slate-600 cursor-pointer">Lưu khóa này cho lần sau</label>
                     </div>
                     
                     <button 
                        onClick={handleSaveKey}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!apiKey.trim()}
                     >
                        Bắt đầu
                     </button>
                 </div>
             </div>
        </div>
      );
  }

  const renderConfigInput = (type: keyof QuestionConfig, label: string) => (
      <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
          <div className="grid grid-cols-3 gap-2">
              <div>
                  <span className="text-xs text-slate-500 block mb-1">Biết</span>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm"
                      value={inputData.questionConfig[type].biet}
                      onChange={(e) => handleConfigChange(type, 'biet', e.target.value)} />
              </div>
              <div>
                  <span className="text-xs text-slate-500 block mb-1">Hiểu</span>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm"
                      value={inputData.questionConfig[type].hieu}
                      onChange={(e) => handleConfigChange(type, 'hieu', e.target.value)} />
              </div>
              <div>
                  <span className="text-xs text-slate-500 block mb-1">Vận dụng</span>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm"
                      value={inputData.questionConfig[type].van_dung}
                      onChange={(e) => handleConfigChange(type, 'van_dung', e.target.value)} />
              </div>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">AI</div>
                  <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600">
                      TẠO ĐỀ KIỂM TRA
                  </h1>
              </div>
              <div className="flex items-center gap-2">
                  <button onClick={() => setShowHelp(true)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500" title="Hướng dẫn sử dụng">
                      <HelpCircle className="w-5 h-5" />
                  </button>
                  <button onClick={handleLogout} className="p-2 hover:bg-slate-100 rounded-full text-slate-500" title="Đổi API Key">
                      <LogOut className="w-5 h-5" />
                  </button>
                  <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500" title="Làm mới">
                      <RotateCcw className="w-5 h-5" />
                  </button>
              </div>
          </div>
      </div>

      <StepIndicator currentStep={currentStep} setStep={setCurrentStep} completedSteps={completedSteps} />
      
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 pb-12">
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
                              <FileText className="w-5 h-5 text-teal-600" />
                              Thông tin chung
                          </h2>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">Môn học</label>
                                  <input name="subject" value={inputData.subject} onChange={handleInputChange} 
                                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" 
                                      placeholder="VD: Toán, Ngữ Văn, Tin học..." />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-sm font-medium text-slate-700 mb-1">Khối lớp</label>
                                      <input name="grade" value={inputData.grade} onChange={handleInputChange}
                                          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                                          placeholder="6, 7, 8..." />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian</label>
                                      <div className="relative">
                                          <input type="number" name="duration" value={inputData.duration} onChange={handleInputChange}
                                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none" />
                                          <span className="absolute right-3 top-2 text-slate-400 text-sm">phút</span>
                                      </div>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">Loại bài kiểm tra</label>
                                  <select name="examType" value={inputData.examType} onChange={handleInputChange}
                                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
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
                              <Beaker className="w-5 h-5 text-teal-600" />
                              Cấu trúc câu hỏi
                          </h2>
                          {renderConfigInput('type1', 'Dạng I: Trắc nghiệm (4 lựa chọn)')}
                          {renderConfigInput('type2', 'Dạng II: Đúng/Sai')}
                          {renderConfigInput('type3', 'Dạng III: Ghép nối')}
                          {renderConfigInput('type4', 'Dạng IV: Điền khuyết')}
                          {renderConfigInput('essay', 'Dạng V: Tự luận')}

                          {/* ESSAY SCORE DISTRIBUTION MANUAL INPUT */}
                          {(inputData.questionConfig.essay.biet + inputData.questionConfig.essay.hieu + inputData.questionConfig.essay.van_dung) > 0 && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-sm text-slate-700">Phân phối điểm Tự luận</h4>
                                    <button onClick={distributeEssayScores} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 font-medium bg-white px-2 py-1 rounded border border-teal-200 hover:bg-teal-50">
                                        <Calculator className="w-3 h-3"/> Chia đều
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {/* Mức Biết */}
                                    {inputData.essayScoreDistribution.biet.length > 0 && (
                                        <div className="space-y-1">
                                            <span className="text-xs font-semibold text-slate-500 block">Mức Biết ({inputData.essayScoreDistribution.biet.length} câu)</span>
                                            <div className="flex flex-wrap gap-2">
                                                {inputData.essayScoreDistribution.biet.map((score, i) => (
                                                    <input key={`biet-${i}`} type="number" step="0.25" className="w-16 text-sm p-1 border rounded text-center" 
                                                        value={score} onChange={(e) => handleEssayScoreUpdate('biet', i, e.target.value)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Mức Hiểu */}
                                    {inputData.essayScoreDistribution.hieu.length > 0 && (
                                        <div className="space-y-1">
                                            <span className="text-xs font-semibold text-slate-500 block">Mức Hiểu ({inputData.essayScoreDistribution.hieu.length} câu)</span>
                                            <div className="flex flex-wrap gap-2">
                                                {inputData.essayScoreDistribution.hieu.map((score, i) => (
                                                    <input key={`hieu-${i}`} type="number" step="0.25" className="w-16 text-sm p-1 border rounded text-center" 
                                                        value={score} onChange={(e) => handleEssayScoreUpdate('hieu', i, e.target.value)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Mức VD */}
                                    {inputData.essayScoreDistribution.van_dung.length > 0 && (
                                        <div className="space-y-1">
                                            <span className="text-xs font-semibold text-slate-500 block">Mức Vận dụng ({inputData.essayScoreDistribution.van_dung.length} câu)</span>
                                            <div className="flex flex-wrap gap-2">
                                                {inputData.essayScoreDistribution.van_dung.map((score, i) => (
                                                    <input key={`vd-${i}`} type="number" step="0.25" className="w-16 text-sm p-1 border rounded text-center" 
                                                        value={score} onChange={(e) => handleEssayScoreUpdate('van_dung', i, e.target.value)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className={`flex justify-between items-center text-xs pt-2 border-t border-slate-200 font-bold ${Math.abs(scoreStats.essayScore - 3.0) > 0.05 ? 'text-red-600' : 'text-teal-600'}`}>
                                        <span>Tổng điểm Tự luận:</span>
                                        <span>{scoreStats.essayScore} / 3.0đ</span>
                                    </div>
                                    {Math.abs(scoreStats.essayScore - 3.0) > 0.05 && (
                                        <p className="text-xs text-red-500 italic">Vui lòng điều chỉnh sao cho tổng bằng 3.0</p>
                                    )}
                                </div>
                            </div>
                          )}

                          {/* SUMMARY ROW UPDATED */}
                          <div className="mt-4 pt-4 border-t border-slate-100">
                              <div className="grid grid-cols-4 gap-2 text-sm mb-2">
                                  <div className="font-semibold text-slate-700 flex items-center">Điểm số (Mức độ):</div>
                                  <div className={`font-bold ${scoreStats.nb > 4 ? 'text-red-500' : 'text-emerald-600'}`}>
                                      NB: {scoreStats.nb}đ
                                  </div>
                                  <div className={`font-bold ${scoreStats.th > 4 ? 'text-red-500' : 'text-blue-600'}`}>
                                      TH: {scoreStats.th}đ
                                  </div>
                                  <div className={`font-bold ${scoreStats.vd > 3 ? 'text-red-500' : 'text-purple-600'}`}>
                                      VD: {scoreStats.vd}đ
                                  </div>
                              </div>
                              <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                                  <div>
                                      <span className="text-slate-500 block text-xs uppercase font-bold">Trắc nghiệm</span>
                                      <span className={`font-bold ${scoreStats.objScore !== 7 ? 'text-red-600' : 'text-slate-800'}`}>
                                          {scoreStats.objScore}/7.0đ
                                      </span>
                                  </div>
                                  <div>
                                      <span className="text-slate-500 block text-xs uppercase font-bold">Tự luận</span>
                                      <span className={`font-bold ${Math.abs(scoreStats.essayScore - 3.0) > 0.05 ? 'text-red-600' : 'text-teal-600'}`}>
                                          {scoreStats.essayScore}đ
                                      </span>
                                      <span className="text-xs text-slate-400 ml-1">
                                          ({scoreStats.essayCount} câu)
                                      </span>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-slate-500 block text-xs uppercase font-bold">Tổng</span>
                                      <span className={`font-bold ${scoreStats.total !== 10 ? 'text-red-600' : 'text-slate-800'}`}>
                                          {scoreStats.total}/10đ
                                      </span>
                                  </div>
                              </div>
                              <div className="text-xs text-slate-400 mt-2 italic">
                                  *Quy tắc: Trắc nghiệm (I, II, III, IV) = 7đ. Tự luận (V) = 3đ (được chia đều cho số câu).
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Content Selection */}
                  <div className="lg:col-span-7 space-y-6">
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                  <FileSpreadsheet className="w-5 h-5 text-teal-600" />
                                  Nội dung kiến thức
                              </h2>
                              <div className="flex gap-2">
                                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.jpg,.png" className="hidden" />
                                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()} isLoading={isAnalyzingFile} icon={<Upload className="w-4 h-4"/>} className="text-sm">
                                      {uploadedFileName ? 'Chọn file khác' : 'Tải lên KHDH'}
                                  </Button>
                              </div>
                          </div>

                          {inputData.chapters.length === 0 ? (
                              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-8">
                                  <FileUp className="w-12 h-12 mb-3 opacity-50" />
                                  <p className="text-center">Chưa có dữ liệu bài học.</p>
                                  <p className="text-sm mt-1">Vui lòng tải lên file Kế hoạch dạy học hoặc Phân phối chương trình.</p>
                              </div>
                          ) : (
                              <div className="flex-1 overflow-y-auto max-h-[600px] pr-2 space-y-2">
                                  <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg text-sm mb-4">
                                      <span className="font-medium text-slate-700">Đã chọn: {selectedLessonIds.size} bài học</span>
                                      <button onClick={() => applySmartFilter(inputData.examType, inputData.chapters)} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium">
                                          <Filter className="w-4 h-4" /> Gợi ý tự động
                                      </button>
                                  </div>
                                  
                                  {inputData.chapters.map(chap => (
                                      <div key={chap.id} className="border border-slate-200 rounded-lg overflow-hidden">
                                          <div 
                                              className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                              onClick={() => toggleChapter(chap.id)}
                                          >
                                              <span className="font-semibold text-sm text-slate-800 flex-1">{chap.name}</span>
                                              {expandedChapterIds.has(chap.id) ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                          </div>
                                          
                                          {expandedChapterIds.has(chap.id) && (
                                              <div className="p-2 space-y-1 bg-white border-t border-slate-200">
                                                  {chap.lessons.map(lesson => (
                                                      <div 
                                                          key={lesson.id} 
                                                          onClick={() => toggleLesson(lesson.id)}
                                                          className={`flex items-start p-2 rounded cursor-pointer text-sm transition-all ${selectedLessonIds.has(lesson.id) ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50 border border-transparent'}`}
                                                      >
                                                          <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center mr-3 ${selectedLessonIds.has(lesson.id) ? 'bg-teal-500 border-teal-500' : 'border-slate-300'}`}>
                                                              {selectedLessonIds.has(lesson.id) && <Check className="w-3 h-3 text-white" />}
                                                          </div>
                                                          <div className="flex-1">
                                                              <div className="font-medium text-slate-900">{lesson.name}</div>
                                                              <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                                                  {lesson.periods && <span>{lesson.periods} tiết</span>}
                                                                  {lesson.weekStart && <span>Tuần {lesson.weekStart}{lesson.weekEnd && lesson.weekEnd !== lesson.weekStart ? `-${lesson.weekEnd}` : ''}</span>}
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
                          
                          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                               <input type="file" ref={matrixDirectUploadRef} onChange={handleMatrixUpload} accept="image/*,.pdf" className="hidden" />
                               <Button variant="secondary" onClick={() => matrixDirectUploadRef.current?.click()}>
                                   Có sẵn Ma trận?
                               </Button>
                               <Button 
                                  onClick={handleGenerateStep1} 
                                  disabled={selectedLessonIds.size === 0}
                                  isLoading={genState.isLoading}
                                  icon={<ArrowRight className="w-4 h-4" />}
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
                   <div className="lg:col-span-9 h-full flex flex-col">
                       <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 p-4 flex items-center justify-between">
                           <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                               {currentStep === AppStep.MATRIX ? 'Ma trận đề thi' : currentStep === AppStep.SPECS ? 'Bảng đặc tả' : 'Đề thi chi tiết'}
                               {isEditing && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal">Chế độ sửa</span>}
                           </h2>
                           <div className="flex gap-2">
                               {!isEditing ? (
                                   <Button variant="secondary" onClick={() => handleEdit(
                                       currentStep === AppStep.MATRIX ? genState.matrix : 
                                       currentStep === AppStep.SPECS ? genState.specs : genState.exam
                                   )} icon={<Pencil className="w-4 h-4" />}>Chỉnh sửa</Button>
                               ) : (
                                   <>
                                     <Button variant="secondary" onClick={() => setIsEditing(false)} icon={<X className="w-4 h-4" />}>Hủy</Button>
                                     <Button onClick={saveEdit} icon={<Save className="w-4 h-4" />}>Lưu</Button>
                                   </>
                               )}
                           </div>
                       </div>
                       
                       <div className="flex-1 bg-slate-100 border border-slate-200 overflow-hidden relative">
                           {genState.isLoading ? (
                               <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                   <div className="text-center">
                                       <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                       <p className="text-teal-700 font-medium animate-pulse">Đang xử lý...</p>
                                   </div>
                               </div>
                           ) : null}
                           
                           {isEditing ? (
                               <div className="w-full h-full flex flex-col bg-slate-100">
                                   <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500 shadow-sm z-10">
                                       <div className="flex items-center gap-2">
                                           <FileText className="w-3 h-3 text-teal-600" />
                                           <span className="font-medium text-slate-700">Chế độ chỉnh sửa văn bản (Print Layout)</span>
                                       </div>
                                       <div className="italic text-slate-400">Nhấp trực tiếp vào văn bản để chỉnh sửa</div>
                                   </div>
                                   
                                   <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                                        <div className="bg-white shadow-xl w-[210mm] min-h-[297mm] p-[2cm] relative">
                                            <style>{`
                                                .print-editor-content {
                                                    font-family: 'Times New Roman', serif;
                                                    font-size: 13pt;
                                                    line-height: 1.3;
                                                    color: #000;
                                                    outline: none;
                                                }
                                                .print-editor-content table { 
                                                    border-collapse: collapse; 
                                                    width: 100%; 
                                                    margin-bottom: 1rem; 
                                                }
                                                .print-editor-content td, .print-editor-content th { 
                                                    border: 1px solid black; 
                                                    padding: 5px; 
                                                    vertical-align: top; 
                                                }
                                                .print-editor-content .header-table td { border: none !important; }
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
                               <MarkdownView content={
                                   currentStep === AppStep.MATRIX ? genState.matrix : 
                                   currentStep === AppStep.SPECS ? genState.specs : genState.exam
                               } />
                           )}
                       </div>
                   </div>

                   {/* Right Column: Actions (Sidebar) */}
                   <div className="lg:col-span-3 flex flex-col gap-4">
                       <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                           <h3 className="font-bold text-slate-800 mb-4">Thao tác</h3>
                           <div className="space-y-3">
                               {currentStep === AppStep.MATRIX && (
                                   <>
                                     <Button className="w-full" onClick={handleGenerateStep2} isLoading={genState.isLoading}>
                                         Tạo Bảng đặc tả <ArrowRight className="w-4 h-4 ml-1" />
                                     </Button>
                                     <Button variant="outline" className="w-full" onClick={() => handleDownloadExcel(genState.matrix, 'Ma_tran')} icon={<FileSpreadsheet className="w-4 h-4" />}>
                                         Xuất Excel Ma trận
                                     </Button>
                                     <input type="file" ref={matrixUploadRef} onChange={handleMatrixUpload} className="hidden" accept="image/*,.pdf" />
                                     <Button variant="secondary" className="w-full" onClick={() => matrixUploadRef.current?.click()}>
                                         Upload Ma trận khác
                                     </Button>
                                     <Button variant="secondary" className="w-full" onClick={handleGenerateStep1} isLoading={genState.isLoading} icon={<RotateCcw className="w-4 h-4"/>}>
                                         Tạo lại Ma trận
                                     </Button>
                                   </>
                               )}

                               {currentStep === AppStep.SPECS && (
                                   <>
                                     <Button className="w-full" onClick={handleGenerateStep3} isLoading={genState.isLoading}>
                                         Soạn Đề thi <ArrowRight className="w-4 h-4 ml-1" />
                                     </Button>
                                     <Button variant="outline" className="w-full" onClick={() => handleDownloadExcel(genState.specs, 'Bang_dac_ta')} icon={<FileSpreadsheet className="w-4 h-4" />}>
                                         Xuất Excel Đặc tả
                                     </Button>
                                     <Button variant="secondary" className="w-full" onClick={handleGenerateStep2} isLoading={genState.isLoading} icon={<RotateCcw className="w-4 h-4"/>}>
                                         Tạo lại Đặc tả
                                     </Button>
                                   </>
                               )}

                               {currentStep === AppStep.EXAM && (
                                   <>
                                     <div className="space-y-2 pb-2 border-b border-slate-100">
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleExportWord(genState.exam || editValue, 'De_Thi', 'full')} icon={<FileText className="w-4 h-4" />}>
                                            Xuất File Word (.doc)
                                        </Button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="outline" className="text-xs px-1" onClick={() => handleExportWord(genState.exam || editValue, 'De_Thi_Only', 'exam')} icon={<FileSignature className="w-3 h-3" />}>
                                                Xuất Đề
                                            </Button>
                                            <Button variant="outline" className="text-xs px-1" onClick={() => handleExportWord(genState.exam || editValue, 'Dap_An_Only', 'key')} icon={<Split className="w-3 h-3" />}>
                                                Xuất Đáp án
                                            </Button>
                                        </div>
                                     </div>

                                     <Button variant="secondary" className="w-full" onClick={() => window.print()} icon={<Download className="w-4 h-4" />}>
                                         In / Lưu PDF
                                     </Button>

                                     <div className="border-t border-slate-100 my-2 pt-2 space-y-2">
                                        <Button variant="outline" className="w-full text-xs" onClick={() => handleDownloadExcel(genState.matrix, 'Ma_tran')} icon={<FileSpreadsheet className="w-3 h-3" />}>
                                            Tải Excel Ma trận
                                        </Button>
                                        <Button variant="outline" className="w-full text-xs" onClick={() => handleDownloadExcel(genState.specs, 'Bang_dac_ta')} icon={<FileSpreadsheet className="w-3 h-3" />}>
                                            Tải Excel Đặc tả
                                        </Button>
                                     </div>
                                     <Button variant="secondary" className="w-full" onClick={handleGenerateStep3} isLoading={genState.isLoading} icon={<RotateCcw className="w-4 h-4"/>}>
                                         Tạo lại Đề thi
                                     </Button>
                                   </>
                               )}
                               
                               <div className="pt-4 border-t border-slate-100">
                                   <Button variant="outline" className="w-full" onClick={handleBack} disabled={genState.isLoading}>
                                       Quay lại
                                   </Button>
                               </div>
                           </div>
                       </div>
                       
                       <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                           <p className="font-bold mb-1 flex items-center gap-2">
                               <Clock className="w-4 h-4" /> Mẹo
                           </p>
                           {currentStep === AppStep.MATRIX && "Kiểm tra kỹ tỉ lệ nhận thức (Biết/Hiểu/Vận dụng) trước khi sang bước tiếp theo."}
                           {currentStep === AppStep.SPECS && "Bạn có thể chỉnh sửa trực tiếp nội dung đặc tả nếu AI nhận diện chưa chính xác."}
                           {currentStep === AppStep.EXAM && "Sử dụng chức năng 'Xuất File Word' để tải về và chỉnh sửa định dạng sâu hơn trong Microsoft Word."}
                       </div>
                   </div>
              </div>
          )}
      </main>
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
              Tác giả: <span className="font-bold text-teal-600">THC</span>
          </div>
      </footer>
    </div>
  );
};

export default App;
