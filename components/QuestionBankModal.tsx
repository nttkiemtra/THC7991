import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, Trash2, Edit, Check, Database, FileUp, AlertCircle, Loader2, SortAsc } from 'lucide-react';
import { QuestionBankItem, QuestionConfig } from '../types';
import Button from './Button';
import { batchExtractQuestions } from '../services/geminiService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectionMode?: boolean;
  multiSelectMode?: boolean;
  prefillContent?: string;
  onSelectQuestion?: (question: QuestionBankItem) => void;
  onSelectQuestions?: (questions: QuestionBankItem[]) => void;
  initialFilters?: {
    subject?: string;
    grade?: string;
    level?: string;
  };
}

const STANDARD_SUBJECTS = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí', 'Tin học', 'Công nghệ', 'GDCD', 'GD Kinh tế và Pháp luật', 'KHTN', 'Lịch sử và Địa lí', 'GD địa phương', 'Khác'];
const STANDARD_GRADES = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12', 'Đại học', 'Khác'];

export default function QuestionBankModal({ 
  isOpen, 
  onClose, 
  onSelectQuestion, 
  onSelectQuestions,
  selectionMode = false, 
  multiSelectMode = false,
  prefillContent = '', 
  initialFilters 
}: QuestionBankModalProps) {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterLesson, setFilterLesson] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'type' | 'level'>('newest');
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedQuestions, setExtractedQuestions] = useState<Partial<QuestionBankItem>[]>([]);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<Partial<QuestionBankItem>>({
    subject: '',
    grade: '',
    lesson: '',
    type: 'type1',
    level: 'biet',
    content: '',
    answer: ''
  });
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        // Sync from Firestore
        const questionsRef = collection(db, 'users', user.uid, 'questions');
        const q = query(questionsRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(doc => doc.data() as QuestionBankItem);
          setQuestions(fetched);
        }, (err) => handleFirestoreError(err, OperationType.LIST, questionsRef.path));
        
        return () => unsubscribe();
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem('ais_question_bank');
        if (stored) {
          try {
            setQuestions(JSON.parse(stored));
          } catch (e) {
            console.error('Failed to parse question bank', e);
          }
        }
      }
      
      if (prefillContent) {
        setIsAdding(true);
        setFormData(prev => ({ 
          ...prev, 
          content: prefillContent,
          subject: initialFilters?.subject || prev.subject,
          grade: initialFilters?.grade || prev.grade
        }));
      }

      if (initialFilters) {
        if (initialFilters.subject) setFilterSubject(initialFilters.subject);
        if (initialFilters.grade) setFilterGrade(initialFilters.grade);
        if (initialFilters.level) setFilterLevel(initialFilters.level);
      }
      setSelectedIds(new Set());
    } else {
      setIsAdding(false);
      setEditingId(null);
      setFormData({ subject: '', grade: '', lesson: '', type: 'type1', level: 'biet', content: '', answer: '' });
    }
  }, [isOpen, prefillContent, user]);

  const saveQuestionToStore = async (q: QuestionBankItem) => {
    if (user) {
      const qRef = doc(db, 'users', user.uid, 'questions', q.id);
      try {
        await setDoc(qRef, { ...q, uid: user.uid });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, qRef.path);
      }
    } else {
      const stored = localStorage.getItem('ais_question_bank');
      let current = stored ? JSON.parse(stored) : [];
      const updated = [q, ...current.filter((item: any) => item.id !== q.id)];
      setQuestions(updated);
      localStorage.setItem('ais_question_bank', JSON.stringify(updated));
    }
  };

  const deleteQuestionFromStore = async (id: string) => {
    if (user) {
      const qRef = doc(db, 'users', user.uid, 'questions', id);
      try {
        await deleteDoc(qRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, qRef.path);
      }
    } else {
      const stored = localStorage.getItem('ais_question_bank');
      if (stored) {
        const updated = JSON.parse(stored).filter((q: any) => q.id !== id);
        setQuestions(updated);
        localStorage.setItem('ais_question_bank', JSON.stringify(updated));
      }
    }
  };

  const handleSave = async () => {
    if (!formData.content || !formData.subject || !formData.grade || !formData.type || !formData.level) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc (Môn, Khối, Dạng, Mức độ, Nội dung).');
      return;
    }

    const qId = editingId || Date.now().toString();
    const newQuestion: QuestionBankItem = {
      ...(formData as Omit<QuestionBankItem, 'id' | 'createdAt'>),
      id: qId,
      createdAt: formData.createdAt || new Date().toISOString()
    };

    await saveQuestionToStore(newQuestion);
    
    alert('Đã thêm câu hỏi vào kho thành công!');
    setIsAdding(false);
    setEditingId(null);
    setFormData({ subject: '', grade: '', lesson: '', type: 'type1', level: 'biet', content: '', answer: '' });
  };

  const handleEdit = (q: QuestionBankItem) => {
    setFormData(q);
    setEditingId(q.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) {
      await deleteQuestionFromStore(id);
    }
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsExtracting(true);
    try {
      const results = await batchExtractQuestions(files);
      setExtractedQuestions(results);
      setIsBatchImporting(true);
    } catch (error) {
      alert('Lỗi khi trích xuất câu hỏi. Vui lòng thử lại.');
    } finally {
      setIsExtracting(false);
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
    }
  };

  const handleSaveBatch = async () => {
    if (user) {
      const batch = writeBatch(db);
      extractedQuestions.forEach(q => {
        const qId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const qRef = doc(db, 'users', user.uid, 'questions', qId);
        batch.set(qRef, {
          ...q,
          id: qId,
          uid: user.uid,
          createdAt: new Date().toISOString()
        });
      });
      try {
        await batch.commit();
        alert(`Đã lưu ${extractedQuestions.length} câu hỏi lên đám mây!`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'batch-save');
      }
    } else {
      const newQuestions: QuestionBankItem[] = extractedQuestions.map(q => ({
        ...q,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      } as QuestionBankItem));

      const updated = [...newQuestions, ...questions];
      setQuestions(updated);
      localStorage.setItem('ais_question_bank', JSON.stringify(updated));
      alert(`Đã lưu ${extractedQuestions.length} câu hỏi vào trình duyệt!`);
    }

    setIsBatchImporting(false);
    setExtractedQuestions([]);
  };

  const updateExtractedQuestion = (index: number, field: keyof QuestionBankItem, value: string) => {
    const updated = [...extractedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedQuestions(updated);
  };

  const removeExtractedQuestion = (index: number) => {
    setExtractedQuestions(extractedQuestions.filter((_, i) => i !== index));
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleMultiSelectConfirm = () => {
    const selectedItems = questions.filter(q => selectedIds.has(q.id));
    onSelectQuestions?.(selectedItems);
  };

  if (!isOpen) return null;

  const filteredQuestions = questions.filter(q => {
    const matchSearch = q.content.toLowerCase().includes(searchQuery.toLowerCase()) || q.lesson.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSubject = filterSubject ? q.subject === filterSubject : true;
    const matchGrade = filterGrade ? q.grade === filterGrade : true;
    const matchType = filterType ? q.type === filterType : true;
    const matchLevel = filterLevel ? q.level === filterLevel : true;
    const matchLesson = filterLesson ? q.lesson === filterLesson : true;
    return matchSearch && matchSubject && matchGrade && matchType && matchLevel && matchLesson;
  });

  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === 'type') return a.type.localeCompare(b.type);
    if (sortBy === 'level') {
      const levels = { 'biet': 1, 'hieu': 2, 'van_dung': 3, 'van_dung_cao': 4 };
      return (levels[a.level as keyof typeof levels] || 0) - (levels[b.level as keyof typeof levels] || 0);
    }
    return 0;
  });

  const uniqueSubjects: string[] = Array.from(new Set(questions.map(q => q.subject)));
  const uniqueGrades: string[] = Array.from(new Set(questions.map(q => q.grade)));
  const uniqueLessons: string[] = Array.from(new Set(questions.map(q => q.lesson).filter(Boolean) as string[]));

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'type1': return 'Trắc nghiệm 4 lựa chọn';
      case 'type2': return 'Đúng/Sai';
      case 'type3': return 'Ghép nối';
      case 'type4': return 'Điền khuyết';
      case 'essay': return 'Tự luận';
      default: return type;
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'biet': return 'Nhận biết';
      case 'hieu': return 'Thông hiểu';
      case 'van_dung': return 'Vận dụng';
      case 'van_dung_cao': return 'Vận dụng cao';
      default: return level;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Kho câu hỏi</h2>
              <p className="text-sm text-slate-500">Quản lý và sử dụng lại các câu hỏi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {isAdding ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto">
              <h3 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Môn học *</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.subject} 
                    onChange={e => setFormData({...formData, subject: e.target.value})}
                  >
                    <option value="">-- Chọn môn học --</option>
                    {STANDARD_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    {uniqueSubjects.filter((s: string) => !STANDARD_SUBJECTS.includes(s)).map((s: string) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Khối lớp *</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.grade} 
                    onChange={e => setFormData({...formData, grade: e.target.value})}
                  >
                    <option value="">-- Chọn khối lớp --</option>
                    {STANDARD_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    {uniqueGrades.filter((g: string) => !STANDARD_GRADES.includes(g)).map((g: string) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bài học / Chủ đề</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} placeholder="VD: Bài 1: Mệnh đề..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dạng câu hỏi *</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    <option value="type1">Trắc nghiệm 4 lựa chọn</option>
                    <option value="type2">Đúng/Sai</option>
                    <option value="type3">Ghép nối</option>
                    <option value="type4">Điền khuyết</option>
                    <option value="essay">Tự luận</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mức độ *</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value as any})}>
                    <option value="biet">Nhận biết</option>
                    <option value="hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                    <option value="van_dung_cao">Vận dụng cao</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung câu hỏi (Hỗ trợ HTML) *</label>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[150px]" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Nhập nội dung câu hỏi..." />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Đáp án / Hướng dẫn giải (Hỗ trợ HTML)</label>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]" value={formData.answer} onChange={e => setFormData({...formData, answer: e.target.value})} placeholder="Nhập đáp án..." />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setIsAdding(false); setEditingId(null); }}>Hủy</Button>
                <Button onClick={handleSave}>Lưu câu hỏi</Button>
              </div>
            </div>
          </div>
        ) : isBatchImporting ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Kiểm tra câu hỏi trích xuất</h3>
                  <p className="text-sm text-slate-500">AI đã tìm thấy {extractedQuestions.length} câu hỏi. Vui lòng kiểm tra và chỉnh sửa trước khi lưu.</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => { setIsBatchImporting(false); setExtractedQuestions([]); }}>Hủy bỏ</Button>
                  <Button onClick={handleSaveBatch} icon={<Check className="w-4 h-4" />}>Lưu tất cả vào kho</Button>
                </div>
              </div>

              <div className="space-y-6">
                {extractedQuestions.map((q, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group">
                    <button 
                      onClick={() => removeExtractedQuestion(idx)}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa câu này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pr-10">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Môn</label>
                        <select 
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" 
                          value={q.subject} 
                          onChange={e => updateExtractedQuestion(idx, 'subject', e.target.value)}
                        >
                          {STANDARD_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          {uniqueSubjects.filter((s: string) => !STANDARD_SUBJECTS.includes(s)).map((s: string) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Khối</label>
                        <select 
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" 
                          value={q.grade} 
                          onChange={e => updateExtractedQuestion(idx, 'grade', e.target.value)}
                        >
                          {STANDARD_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                          {uniqueGrades.filter((g: string) => !STANDARD_GRADES.includes(g)).map((g: string) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dạng</label>
                        <select className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" value={q.type} onChange={e => updateExtractedQuestion(idx, 'type', e.target.value)}>
                          <option value="type1">Trắc nghiệm</option>
                          <option value="type2">Đúng/Sai</option>
                          <option value="type3">Ghép nối</option>
                          <option value="type4">Điền khuyết</option>
                          <option value="essay">Tự luận</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mức độ</label>
                        <select className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" value={q.level} onChange={e => updateExtractedQuestion(idx, 'level', e.target.value)}>
                          <option value="biet">Nhận biết</option>
                          <option value="hieu">Thông hiểu</option>
                          <option value="van_dung">Vận dụng</option>
                          <option value="van_dung_cao">Vận dụng cao</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nội dung câu hỏi</label>
                      <textarea className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:border-blue-500 min-h-[80px]" value={q.content} onChange={e => updateExtractedQuestion(idx, 'content', e.target.value)} />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Đáp án</label>
                      <textarea className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:border-blue-500 min-h-[60px]" value={q.answer} onChange={e => updateExtractedQuestion(idx, 'answer', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm nội dung..." 
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                <option value="">Tất cả môn</option>
                {uniqueSubjects.map((s, idx) => <option key={s || `subj-${idx}`} value={s}>{s}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
                <option value="">Tất cả khối</option>
                {uniqueGrades.map((g, idx) => <option key={g || `grade-${idx}`} value={g}>{g}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={filterLesson} onChange={e => setFilterLesson(e.target.value)}>
                <option value="">Tất cả bài học</option>
                {uniqueLessons.map((l, idx) => <option key={l || `lesson-${idx}`} value={l!}>{l}</option>)}
              </select>

              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">Tất cả dạng</option>
                <option value="type1">Trắc nghiệm</option>
                <option value="type2">Đúng/Sai</option>
                <option value="type3">Ghép nối</option>
                <option value="type4">Điền khuyết</option>
                <option value="essay">Tự luận</option>
              </select>

              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
                <option value="">Tất cả mức độ</option>
                <option value="biet">Nhận biết</option>
                <option value="hieu">Thông hiểu</option>
                <option value="van_dung">Vận dụng</option>
                <option value="van_dung_cao">Vận dụng cao</option>
              </select>

              <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
                <SortAsc className="w-4 h-4 text-slate-400" />
                <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="type">Theo Dạng</option>
                  <option value="level">Theo Mức độ</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                {multiSelectMode && selectedIds.size > 0 && (
                  <Button 
                    onClick={handleMultiSelectConfirm} 
                    className="bg-green-600 hover:bg-green-700" 
                    icon={<Check className="w-4 h-4" />}
                  >
                    Thêm đã chọn ({selectedIds.size})
                  </Button>
                )}
                
                {!selectionMode && !multiSelectMode && (
                  <>
                    <input 
                      type="file" 
                      ref={batchFileInputRef} 
                      onChange={handleBatchUpload} 
                      className="hidden" 
                      multiple 
                      accept="image/*,application/pdf,text/plain,.docx" 
                    />
                    <Button 
                      variant="secondary" 
                      onClick={() => batchFileInputRef.current?.click()} 
                      isLoading={isExtracting}
                      icon={isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                    >
                      Quét từ file/ảnh
                    </Button>
                    <Button onClick={() => setIsAdding(true)} icon={<Plus className="w-4 h-4" />}>Thêm câu hỏi</Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {sortedQuestions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Không tìm thấy câu hỏi nào.</div>
              ) : (
                <div className="space-y-4">
                  {sortedQuestions.map((q) => (
                    <div 
                      key={q.id} 
                      onClick={() => multiSelectMode && toggleSelection(q.id)}
                      className={`bg-white border-2 rounded-xl p-4 transition-all flex gap-4 cursor-pointer ${
                        selectedIds.has(q.id) ? 'border-green-500 bg-green-50/30 shadow-md' : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {multiSelectMode && (
                        <div className="pt-1">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedIds.has(q.id) ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {selectedIds.has(q.id) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{q.subject} - {q.grade}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">{getTypeLabel(q.type)}</span>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-xs font-medium">{getLevelLabel(q.level)}</span>
                          {q.lesson && <span className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-xs truncate max-w-[200px]">{q.lesson}</span>}
                        </div>
                        <div className="text-sm text-slate-800 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: q.content }} />
                        {q.answer && (
                          <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-600">
                            <span className="font-bold">Đáp án: </span>
                            <span dangerouslySetInnerHTML={{ __html: q.answer }} />
                          </div>
                        )}
                      </div>
                       <div className="flex flex-col gap-2 justify-start">
                        {multiSelectMode ? (
                          null // Handled by clicking the entire card
                        ) : selectionMode ? (
                          <Button size="sm" onClick={() => onSelectQuestion?.(q)} icon={<Check className="w-4 h-4" />}>Chọn</Button>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(q)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(q.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
