
export enum AppStep {
  INPUT = 0,
  MATRIX = 1,
  SPECS = 2,
  EXAM = 3,
}

export interface LearningObjectives {
  biet?: string;
  hieu?: string;
  van_dung?: string;
  van_dung_cao?: string;
}

export interface Lesson {
  id: string;
  name: string;
  periods: number;
  weekStart?: number;
  weekEnd?: number;
  objectives: LearningObjectives; // Yêu cầu cần đạt
}

export interface Chapter {
  id: string;
  name: string;
  lessons: Lesson[];
  totalPeriods: number;
}

// Configuration for question counts per Type and Level
export interface QuestionConfig {
  type1: { biet: number; hieu: number; van_dung: number }; // Dạng I: Trắc nghiệm 4 lựa chọn
  type2: { biet: number; hieu: number; van_dung: number }; // Dạng II: Đúng/Sai
  type3: { biet: number; hieu: number; van_dung: number }; // Dạng III: Ghép nối
  type4: { biet: number; hieu: number; van_dung: number }; // Dạng IV: Điền khuyết
  essay: { biet: number; hieu: number; van_dung: number }; // Dạng V: Tự luận
}

export interface EssayScoreDistribution {
  biet: number[];
  hieu: number[];
  van_dung: number[];
}

export interface SavedExam {
  id: string;
  uid?: string;
  title: string;
  subject: string;
  grade: string;
  createdAt: string;
  matrix: string;
  specs: string;
  exam: string;
}

export interface QuestionBankItem {
  id: string;
  uid?: string;
  subject: string;
  grade: string;
  lesson: string;
  type: keyof QuestionConfig;
  level: 'biet' | 'hieu' | 'van_dung' | 'van_dung_cao';
  content: string;
  answer?: string;
  createdAt: string;
}

export interface InputData {
  subject: string;
  grade: string;
  duration: number;
  examType: string;
  topics: string; // Legacy field, kept for fallback
  additionalNotes: string;
  referenceContent: string; // Combined text content from uploaded files for question generation
  referenceFiles?: { name: string, type: string, base64: string }[]; // Store files for later use
  preSelectedQuestions?: QuestionBankItem[]; // Questions selected from the bank
  
  // New structured data
  chapters: Chapter[]; 
  questionConfig: QuestionConfig;
  essayScoreDistribution: EssayScoreDistribution;
}

export interface GenerationState {
  matrix: string;
  specs: string;
  exam: string;
  isLoading: boolean;
  error: string | null;
}

export type Role = 'user' | 'model';

export interface ChatMessage {
  role: Role;
  text: string;
}

export interface VisualConfig {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  primaryColor: string;
  headerStyle: 'standard' | 'minimal' | 'boxed';
}

export interface ExamError {
  id: string;
  type: 'scoring' | 'formatting' | 'citation' | 'content';
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestedFix?: string;
}
