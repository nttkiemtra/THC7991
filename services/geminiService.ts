
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION, MODEL_NAME } from '../constants';
import { InputData, Chapter, Lesson, QuestionConfig } from '../types';

let ai: GoogleGenAI | null = null;

export const configureGenAI = (apiKey: string) => {
  ai = new GoogleGenAI({ apiKey });
};

const getAI = () => {
  if (!ai) {
    if (process.env.API_KEY) {
      ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      throw new Error("Chưa cấu hình API Key. Vui lòng nhập Key.");
    }
  }
  return ai;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result || !result.includes(',')) {
        reject(new Error("Lỗi đọc file: Dữ liệu không hợp lệ."));
        return;
      }
      const base64String = result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error("Không thể đọc file. Vui lòng thử file khác."));
    reader.readAsDataURL(file);
  });
};

export const convertMatrixFileToHtml = async (file: File): Promise<string> => {
  const base64Data = await fileToBase64(file);
  
  const prompt = `
    Bạn là một chuyên gia chuyển đổi dữ liệu.
    Tài liệu đính kèm là một **MA TRẬN ĐỀ THI** (dạng ảnh, PDF hoặc Word).
    Nhiệm vụ của bạn là:
    1. Đọc nội dung bảng ma trận trong tài liệu.
    2. Chuyển đổi toàn bộ nội dung đó thành một bảng **HTML Table** chuẩn.
    
    YÊU CẦU KỸ THUẬT:
    - Giữ nguyên cấu trúc merge cells (rowspan, colspan) của bản gốc.
    - Font chữ: Times New Roman, size 13pt.
    - Table border: 1px solid black.
    - Output: Chỉ trả về mã HTML của bảng (<table>...</table>) hoặc (<!DOCTYPE html>...), KHÔNG bao gồm markdown \`\`\`.
    - Nếu không đọc được, hãy trả về thông báo lỗi trong thẻ <p>.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: {
        parts: [
          { inlineData: { mimeType: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg', data: base64Data } }, 
          { text: prompt }
        ]
      },
    });
    const text = response.text || "";
    if (!text || text.length < 50) {
        throw new Error("Nội dung phản hồi quá ngắn hoặc không đọc được file.");
    }
    // Clean up markdown if present
    return text.replace(/```html/g, '').replace(/```/g, '');
  } catch (error: any) {
    console.error("Error converting matrix:", error);
    throw new Error(`Lỗi xử lý file ma trận: ${error.message || "Không xác định"}`);
  }
};

export const extractInfoFromDocument = async (file: File): Promise<Partial<InputData>> => {
  const base64Data = await fileToBase64(file);
  
  const prompt = `
    Bạn là chuyên gia phân tích chương trình giáo dục. Hãy đọc file đính kèm (Kế hoạch dạy học/PPCT) và trích xuất dữ liệu cấu trúc cực kỳ chi tiết.

    Yêu cầu đầu ra: JSON Object (không markdown) với cấu trúc sau:
    {
      "subject": "Tên môn học",
      "grade": "Khối lớp",
      "chapters": [
        {
          "id": "c1",
          "name": "Tên chương đầy đủ",
          "totalPeriods": 10,
          "lessons": [
            {
              "id": "c1_l1",
              "name": "Tên bài học",
              "periods": 2,
              "weekStart": 1,
              "weekEnd": 1,
              "objectives": {
                "biet": "Nội dung yêu cầu cần đạt mức Biết...",
                "hieu": "Nội dung yêu cầu cần đạt mức Hiểu...",
                "van_dung": "Nội dung yêu cầu cần đạt mức Vận dụng..."
              }
            }
          ]
        }
      ]
    }
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: {
        parts: [
          { inlineData: { mimeType: file.type === 'application/pdf' ? 'application/pdf' : 'text/plain', data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    let parsed: any = {};
    
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        // Fallback cleanup
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '');
        try {
            parsed = JSON.parse(cleaned);
        } catch (e2) {
            throw new Error("AI không trả về đúng định dạng JSON. Vui lòng thử file rõ ràng hơn.");
        }
    }

    // Strict validation
    if (!parsed.chapters || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
        throw new Error("Không tìm thấy nội dung bài học/chương trong tài liệu. Hãy kiểm tra lại file đầu vào.");
    }

    return parsed;
  } catch (error: any) {
    console.error("Error extracting info:", error);
    throw new Error(`Lỗi phân tích tài liệu: ${error.message}`);
  }
};

export const generateStep1Matrix = async (
  data: InputData, 
  selectedLessonIds: Set<string>
): Promise<string> => {
  
  const selectedChapters: any[] = [];
  let totalSelectedPeriods = 0;

  data.chapters.forEach(chap => {
    const activeLessons = chap.lessons.filter(l => selectedLessonIds.has(l.id));
    if (activeLessons.length > 0) {
      selectedChapters.push({
        name: chap.name,
        lessons: activeLessons.map(l => ({
            name: l.name,
            periods: l.periods
        }))
      });
      totalSelectedPeriods += activeLessons.reduce((sum, l) => sum + (l.periods || 1), 0);
    }
  });

  const config = data.questionConfig;

  // Construct specific essay scoring instructions
  let essayDetails = "";
  const essayDist = data.essayScoreDistribution;
  
  if (essayDist) {
      const parts: string[] = [];
      if (essayDist.biet && essayDist.biet.length > 0) {
          parts.push(`- Mức Biết (${essayDist.biet.length} câu): ${essayDist.biet.map(s => s + 'đ').join(', ')}`);
      }
      if (essayDist.hieu && essayDist.hieu.length > 0) {
          parts.push(`- Mức Hiểu (${essayDist.hieu.length} câu): ${essayDist.hieu.map(s => s + 'đ').join(', ')}`);
      }
      if (essayDist.van_dung && essayDist.van_dung.length > 0) {
          parts.push(`- Mức Vận dụng (${essayDist.van_dung.length} câu): ${essayDist.van_dung.map(s => s + 'đ').join(', ')}`);
      }
      if (parts.length > 0) essayDetails = parts.join('\n       ');
  }

  // Calculate totals to enforce in prompt
  const stats = {
      biet: config.type1.biet + config.type2.biet + config.type3.biet + config.type4.biet + config.essay.biet,
      hieu: config.type1.hieu + config.type2.hieu + config.type3.hieu + config.type4.hieu + config.essay.hieu,
      vd: config.type1.van_dung + config.type2.van_dung + config.type3.van_dung + config.type4.van_dung + config.essay.van_dung,
  };
  
  const scoringInstructions = `
    **CƠ CHẾ TÍNH ĐIỂM NGHIÊM NGẶT:**
    1. **PHẦN TRẮC NGHIỆM (7.0 điểm):**
       - Dạng I: 0.25đ/câu.
       - Dạng II, III, IV: 1.0đ/câu.
    2. **PHẦN TỰ LUẬN (3.0 điểm):**
       - Tổng điểm phần tự luận BẮT BUỘC là 3.0 điểm.
       - **CHI TIẾT ĐIỂM TỰ LUẬN (BẮT BUỘC TUÂN THỦ):**
       ${essayDetails || 'Tự phân phối sao cho tổng 3.0 điểm.'}
    3. **TỈ LỆ NHẬN THỨC:**
       - **Vận dụng:** Tổng điểm (Trắc nghiệm + Tự luận) mức Vận dụng PHẢI BẰNG **3.0 điểm (30%)**.
  `;

  // Strict HTML Template for the Header
  const headerStructure = `
    <thead>
        <tr>
            <th rowspan="3" style="width:5%">STT</th>
            <th rowspan="3" style="width:15%">Chủ đề</th>
            <th rowspan="3" style="width:20%">Nội dung/Đơn vị kiến thức</th>
            <th colspan="15">Mức độ nhận thức</th>
            <th rowspan="3" style="width:5%">Tổng</th>
            <th rowspan="3" style="width:5%">Tổng điểm</th>
        </tr>
        <tr>
            <th colspan="3">Dạng I (Trắc nghiệm)</th>
            <th colspan="3">Dạng II (Đúng/Sai)</th>
            <th colspan="3">Dạng III (Ghép nối)</th>
            <th colspan="3">Dạng IV (Điền khuyết)</th>
            <th colspan="3">Dạng V (Tự luận)</th>
        </tr>
        <tr>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
        </tr>
    </thead>
  `;

  const prompt = `
  Hãy tạo **MA TRẬN ĐỀ THI** (HTML Table) cho môn **${data.subject}**, khối **${data.grade}**.
  
  **CẤU HÌNH ĐỀ THI:**
  - Loại đề: ${data.examType}
  - Thời gian: ${data.duration} phút
  - Tổng số tiết trọng tâm: ${totalSelectedPeriods} tiết
  
  **SỐ LƯỢNG CÂU HỎI MỤC TIÊU:**
  - Dạng I: Biết ${config.type1.biet}, Hiểu ${config.type1.hieu}, VD ${config.type1.van_dung}
  - Dạng II: Biết ${config.type2.biet}, Hiểu ${config.type2.hieu}, VD ${config.type2.van_dung}
  - Dạng III: Biết ${config.type3.biet}, Hiểu ${config.type3.hieu}, VD ${config.type3.van_dung}
  - Dạng IV: Biết ${config.type4.biet}, Hiểu ${config.type4.hieu}, VD ${config.type4.van_dung}
  - Dạng V: Biết ${config.essay.biet}, Hiểu ${config.essay.hieu}, VD ${config.essay.van_dung}
  
  ${scoringInstructions}

  **DỮ LIỆU ĐẦU VÀO:**
  ${JSON.stringify(selectedChapters, null, 2)}

  **YÊU CẦU OUTPUT:**
  1. Xuất ra một Full HTML Document (<!DOCTYPE html>...). Font Times New Roman 13pt.
  2. **CẤU TRÚC BẢNG BẮT BUỘC:**
     Sử dụng chính xác cấu trúc Header sau:
     ${headerStructure}
  3. **NỘI DUNG:**
     - Merge cells (rowspan) cho cột "Chủ đề".
     - Phân phối các mã câu hỏi (VD: C1, C2, C13(4ý), C17(1.0đ)) vào đúng ô mức độ.
     - **QUAN TRỌNG:** Với câu tự luận, hãy ghi rõ điểm số bên cạnh mã câu. Ví dụ: C15(1.0đ).
     - **Tính toán:** Cột "Tổng" là tổng số câu (tính theo đơn vị câu lớn). Cột "Tổng điểm" tính theo cơ chế điểm số.
  4. **FOOTER (TỔNG KẾT) - BẮT BUỘC:**
     Phải tính toán và hiển thị chính xác các số liệu sau ở cuối bảng (trong thẻ tfoot hoặc row cuối):
     - **Tỉ lệ % điểm:** Biết ...% - Hiểu ...% - Vận dụng 30%.
     - **Tổng điểm:** Trắc nghiệm 7.0 - Tự luận 3.0.
  5. KHÔNG trả về markdown fences. Border 1px solid black.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, 
      },
    });
    const text = response.text || "Lỗi tạo ma trận.";
    return text.replace(/```html/g, '').replace(/```/g, '');
  } catch (error) {
    throw new Error("Lỗi API Gemini.");
  }
};

export const generateStep2Specs = async (
    matrixContent: string,
    data: InputData,
    selectedLessonIds: Set<string>
): Promise<string> => {
    
    const objectivesMap: string[] = [];
    data.chapters.forEach(c => c.lessons.forEach(l => {
        if (selectedLessonIds.has(l.id)) {
            objectivesMap.push(`- Bài "${l.name}": \n   + Biết: ${l.objectives.biet || '...'}\n   + Hiểu: ${l.objectives.hieu || '...'}\n   + Vận dụng: ${l.objectives.van_dung || '...'}`);
        }
    }));
    
  const config = data.questionConfig;
  const stats = {
      biet: config.type1.biet + config.type2.biet + config.type3.biet + config.type4.biet + config.essay.biet,
      hieu: config.type1.hieu + config.type2.hieu + config.type3.hieu + config.type4.hieu + config.essay.hieu,
      vd: config.type1.van_dung + config.type2.van_dung + config.type3.van_dung + config.type4.van_dung + config.essay.van_dung,
  };
  const totalQuestions = stats.biet + stats.hieu + stats.vd;

  const headerStructure = `
    <thead>
        <tr>
            <th rowspan="3" style="width:5%">STT</th>
            <th rowspan="3" style="width:15%">Chủ đề</th>
            <th rowspan="3" style="width:15%">Nội dung/Đơn vị kiến thức</th>
            <th rowspan="3" style="width:25%">Mức độ kiểm tra, đánh giá</th>
            <th colspan="15">Số câu hỏi theo mức độ nhận thức</th>
        </tr>
        <tr>
            <th colspan="3">Dạng I (Trắc nghiệm)</th>
            <th colspan="3">Dạng II (Đúng/Sai)</th>
            <th colspan="3">Dạng III (Ghép nối)</th>
            <th colspan="3">Dạng IV (Điền khuyết)</th>
            <th colspan="3">Dạng V (Tự luận)</th>
        </tr>
        <tr>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
            <th>Biết</th><th>Hiểu</th><th>VD</th>
        </tr>
    </thead>
  `;

  const prompt = `
  Hãy tạo **BẢNG ĐẶC TẢ CHI TIẾT** (Full HTML Document).
  
  **DỮ LIỆU ĐẦU VÀO:**
  1. MA TRẬN ĐỀ THI:
  ${matrixContent}
  
  2. YÊU CẦU CẦN ĐẠT (Objectives):
  ${objectivesMap.join('\n')}

  **YÊU CẦU OUTPUT:**
  1. Xuất ra Full HTML Document (<!DOCTYPE html>...). Font Times New Roman 13pt.
  2. **CẤU TRÚC BẢNG BẮT BUỘC:**
     Sử dụng chính xác cấu trúc Header sau:
     ${headerStructure}
  3. **NỘI DUNG:**
     - Cột "Mức độ kiểm tra, đánh giá": Điền nội dung YCCĐ (Biết:..., Hiểu:..., Vận dụng:...) tương ứng với bài học.
     - Các cột Dạng I, II, III...: Điền CHÍNH XÁC mã câu hỏi (C1, C2...) lấy từ Ma trận sang.
  4. **FOOTER (TỔNG KẾT):**
     Hiển thị tổng số câu và phân phối điểm số (Trắc nghiệm 7.0 - Tự luận 3.0).
  5. KHÔNG trả về markdown fences. Border 1px solid black.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    });
    const text = response.text || "Lỗi tạo đặc tả.";
    return text.replace(/```html/g, '').replace(/```/g, '');
  } catch (error) {
    throw new Error("Lỗi API Gemini.");
  }
};

export const generateStep3Exam = async (
    specsContent: string, 
    data: InputData
): Promise<string> => {
    
  const questionConfig = data.questionConfig;
  const counts = {
      type1: questionConfig.type1.biet + questionConfig.type1.hieu + questionConfig.type1.van_dung,
      type2: questionConfig.type2.biet + questionConfig.type2.hieu + questionConfig.type2.van_dung,
      type3: questionConfig.type3.biet + questionConfig.type3.hieu + questionConfig.type3.van_dung,
      type4: questionConfig.type4.biet + questionConfig.type4.hieu + questionConfig.type4.van_dung,
      essay: questionConfig.essay.biet + questionConfig.essay.hieu + questionConfig.essay.van_dung,
  };

  // Logic for specific Informatics constraint
  const subjectLower = data.subject.toLowerCase();
  const isIT = subjectLower.includes('tin') || subjectLower.includes('informatics') || subjectLower.includes('công nghệ') || subjectLower.includes('computer');
  
  // Enhanced CSS definition for Scratch 3.0 visual fidelity with C-Blocks
  const scratchCssDef = `
    :root {
      --sc-motion: #4C97FF; --sc-motion-brd: #3373CC;
      --sc-looks: #9966FF; --sc-looks-brd: #774DCB;
      --sc-sound: #CF63CF; --sc-sound-brd: #BD43BD;
      --sc-events: #FFBF00; --sc-events-brd: #CC9900;
      --sc-control: #FFAB19; --sc-control-brd: #CF8B17;
      --sc-sensing: #5CB1D6; --sc-sensing-brd: #2E8EB8;
      --sc-operators: #59C059; --sc-operators-brd: #389438;
      --sc-variables: #FF8C1A; --sc-variables-brd: #DB6E00;
      --sc-myblocks: #FF6680; --sc-myblocks-brd: #D94D63;
    }
    
    .scratch-font { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 12px; font-weight: bold; color: white; white-space: nowrap; cursor: default; }

    /* Theme Classes */
    .sc-motion { --bg: var(--sc-motion); --brd: var(--sc-motion-brd); }
    .sc-looks { --bg: var(--sc-looks); --brd: var(--sc-looks-brd); }
    .sc-sound { --bg: var(--sc-sound); --brd: var(--sc-sound-brd); }
    .sc-events { --bg: var(--sc-events); --brd: var(--sc-events-brd); }
    .sc-control { --bg: var(--sc-control); --brd: var(--sc-control-brd); }
    .sc-sensing { --bg: var(--sc-sensing); --brd: var(--sc-sensing-brd); }
    .sc-operators { --bg: var(--sc-operators); --brd: var(--sc-operators-brd); }
    .sc-variables { --bg: var(--sc-variables); --brd: var(--sc-variables-brd); }
    .sc-myblocks { --bg: var(--sc-myblocks); --brd: var(--sc-myblocks-brd); }

    /* Simple Block */
    .scratch-block {
      display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; margin: 2px;
      border-radius: 4px; border: 1px solid rgba(0,0,0,0.15);
      background-color: var(--bg); border-color: var(--brd);
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      color: white; font-weight: bold; font-family: sans-serif; font-size: 12px;
    }

    /* C-Block Structure */
    .scratch-c-block { display: flex; flex-direction: column; align-items: flex-start; margin: 2px 0; color: white; font-family: sans-serif; font-size: 12px; font-weight: bold; }
    
    .scratch-c-header {
      background-color: var(--bg); border: 1px solid var(--brd); border-bottom: none;
      padding: 6px 10px; border-top-left-radius: 4px; border-top-right-radius: 4px; border-bottom-right-radius: 4px;
      display: inline-flex; align-items: center; gap: 4px;
      min-height: 28px; box-sizing: border-box;
    }
    
    .scratch-c-body {
      border-left: 16px solid var(--bg); /* The spine */
      padding-left: 8px; /* Indent for inner blocks */
      min-height: 24px; display: flex; flex-direction: column; align-items: flex-start;
      border-left-color: var(--bg);
      background-color: transparent;
      box-sizing: border-box;
    }

    .scratch-c-else {
      background-color: var(--bg); border: 1px solid var(--brd);
      padding: 6px 10px; margin-top: -1px; width: auto; min-width: 80px;
      border-top-right-radius: 4px; border-bottom-right-radius: 4px;
      display: flex; align-items: center;
      position: relative;
    }
    /* Fix alignment for Else spine connection */
    .scratch-c-else::before {
        content: ''; position: absolute; left: -1px; top: -5px; height: 5px; width: 16px; background-color: var(--bg);
    }

    .scratch-c-footer {
      background-color: var(--bg); border: 1px solid var(--brd); border-top: none;
      height: 16px; width: 48px; 
      border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;
      position: relative;
    }
    /* Fix spine connection for footer */
    .scratch-c-footer::before {
        content: ''; position: absolute; left: -1px; top: -5px; height: 5px; width: 16px; background-color: var(--bg);
    }

    /* Input Shapes */
    .scratch-input { background: white; color: black; border-radius: 12px; padding: 2px 8px; min-width: 16px; text-align: center; border: 1px solid rgba(0,0,0,0.1); font-weight: normal; }
    .scratch-hex { background: rgba(0,0,0,0.2); padding: 0 8px; clip-path: polygon(15% 0, 85% 0, 100% 50%, 85% 100%, 15% 100%, 0 50%); min-width: 24px; height: 20px; display: inline-flex; align-items: center; justify-content: center; }
    .scratch-dropdown { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; }
    .scratch-dropdown::after { content: '▼'; font-size: 8px; opacity: 0.8; }
    .scratch-variable { background-color: var(--sc-variables); border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; }
    
    /* Utility */
    .scratch-icon { width: 16px; height: 16px; margin-right: 4px; }
  `;

  // Enhanced Scratch Instruction with strict formatting for E-Blocks and Repeat Until
  const scratchInstruction = isIT 
    ? `**YÊU CẦU VỀ SCRATCH (QUAN TRỌNG - BẮT BUỘC TUÂN THỦ):**
       1. **CHỦ ĐỀ:** Nếu câu hỏi thuộc chủ đề "Giải quyết vấn đề với sự trợ giúp của máy tính", **BẮT BUỘC CHỈ ĐƯỢC PHÉP** sử dụng ngôn ngữ lập trình **SCRATCH**. Tuyệt đối **KHÔNG** dùng Python, Pascal, hay C++.
       
       2. **HÌNH ẢNH CÂU LỆNH (Sử dụng HTML/CSS chuẩn):**
          - Tuyệt đối KHÔNG mô tả lệnh bằng lời (VD: "Khối di chuyển 10 bước").
          - **BẮT BUỘC** phải tạo hình ảnh khối lệnh bằng các thẻ HTML với Class CSS mới đã định nghĩa.
          - Sử dụng **BIẾN CSS** thông qua các class chủ đề (sc-motion, sc-control, sc-events...) để đảm bảo màu sắc chuẩn xác.

       3. **CẤU TRÚC BLOCK NÂNG CAO (MẪU CHUẨN - STRICT RULE):**
          
          **A. Khối đơn giản (Simple Block):**
          <span class="scratch-block sc-motion">move <span class="scratch-input">10</span> steps</span>
          <span class="scratch-block sc-events">when flag clicked</span>

          **B. Vòng lặp Repeat / Forever (C-Block):**
          <div class="scratch-c-block sc-control">
            <div class="scratch-c-header">repeat <span class="scratch-input">10</span></div>
            <div class="scratch-c-body">
               <!-- Các khối con BẮT BUỘC phải nằm trong body này -->
               <span class="scratch-block sc-motion">move <span class="scratch-input">10</span> steps</span>
            </div>
            <div class="scratch-c-footer"></div>
          </div>

          **C. Điều kiện If / Else (E-Block):**
          <div class="scratch-c-block sc-control">
            <div class="scratch-c-header">if <span class="scratch-hex sc-sensing">key <span class="scratch-dropdown">space</span> pressed?</span> then</div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-looks">say <span class="scratch-input">Hello!</span></span>
            </div>
            <div class="scratch-c-else">else</div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-looks">think <span class="scratch-input">Hmm...</span></span>
            </div>
            <div class="scratch-c-footer"></div>
          </div>

          **D. INPUT SHAPES:**
          - Số/Chữ: <span class="scratch-input">10</span>
          - Dropdown: <span class="scratch-dropdown">meow</span>
          - Điều kiện (Lục giác): <span class="scratch-hex sc-sensing">...</span>
          - Biến (Tròn): <span class="scratch-variable">my variable</span>

       4. **BẮT BUỘC:** Chèn đoạn CSS sau vào thẻ <style> trong <head> của file HTML trả về:
          ${scratchCssDef}
      ` 
    : "";

  let structureInstructions = "**CẤU TRÚC ĐỀ THI:**\n";
  if (counts.type1 > 0) structureInstructions += `- PHẦN I (Trắc nghiệm): ${counts.type1} câu (0.25đ/câu).\n`;
  if (counts.type2 > 0) structureInstructions += `- PHẦN II (Đúng/Sai): ${counts.type2} câu (1.0đ/câu).\n`;
  if (counts.type3 > 0) structureInstructions += `- PHẦN III (Ghép nối): ${counts.type3} câu (1.0đ/câu).\n`;
  if (counts.type4 > 0) structureInstructions += `- PHẦN IV (Điền khuyết): ${counts.type4} câu (1.0đ/câu).\n`;
  structureInstructions += `- PHẦN V (Tự luận): ${counts.essay} câu (Tổng 3.0 điểm).\n`;

  const prompt = `
  Dựa trên **Bảng đặc tả** sau (HTML):
  ${specsContent}

  Hãy soạn thảo **ĐỀ THI HOÀN CHỈNH** và **HƯỚNG DẪN CHẤM** (Đáp án) tuân thủ nghiêm ngặt định dạng văn bản mẫu (MAU DE.pdf).
  
  ${scratchInstruction}
  ${structureInstructions}

  **YÊU CẦU HÌNH THỨC & NỘI DUNG:**

  **1. HEADER ĐỀ THI:**
  - Kẻ bảng không viền (class="header-table" width="100%"):
    + Cột Trái (40%): TRƯỜNG THCS ........................<br>Lớp: ........................<br>Họ và tên: ........................
    + Cột Phải (60%): **BÀI KIỂM TRA ........................**<br>MÔN: ${data.subject.toUpperCase()}<br>Thời gian làm bài: ${data.duration} Phút
  - **KHUNG ĐIỂM & NHẬN XÉT (BẮT BUỘC):**
    Ngay dưới Header, kẻ bảng (border="1" width="100%"):
    + Cột 1 (30% width, cao 80px): **Điểm**
    + Cột 2 (70% width, cao 80px): **Lời nhận xét của thầy (cô) giáo:** (Để trống)
  - Tiêu đề giữa: **ĐỀ BÀI**

  **2. PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN:**
  - **BẮT BUỘC:** Ngay dưới tiêu đề Phần I, tạo **KHUNG TRẢ LỜI CHO HỌC SINH**:
    (Kẻ bảng 2 dòng. Dòng 1: Câu 1, 2, ... [số lượng câu]. Dòng 2: Để trống "Đáp án").
  - Sau đó mới đến danh sách câu hỏi.
  - **ĐỊNH DẠNG CÂU HỎI (QUAN TRỌNG):**
    Câu X. (Mức độ - Bài Y) [Nội dung câu hỏi]?
    A. ... B. ... C. ... D. ...
    
    *Ví dụ: Câu 1. (NB - Bài 10) Thiết bị nào sau đây là thiết bị vào?*
    *(Chú thích Mức độ: NB=Biết, TH=Hiểu, VD=Vận dụng, VDC=Vận dụng cao)*

  **3. PHẦN II. ĐÚNG/SAI:**
  - Tiêu đề: PHẦN II. ĐÚNG/SAI...
  - Với mỗi câu hỏi (VD: Câu 13):
    + Viết lời dẫn (Scenario).
    + Kẻ **BẢNG 3 CỘT** (bắt buộc): | Lệnh hỏi | Đ | S |
    + Các dòng: a), b), c), d) [Nội dung mệnh đề] | | |

  **4. PHẦN III. GHÉP NỐI:**
  - Tiêu đề: PHẦN III. GHÉP NỐI...
  - Kẻ **BẢNG 3 CỘT**: | Cột A | Cột B | Ghép nối |
    + Nội dung cột A | Nội dung cột B | 1 - ... |
    + ... | ... | 2 - ... |

  **5. PHẦN IV (Điền khuyết) & V (Tự luận):** 
  - Trình bày như văn bản thông thường.

  **6. HƯỚNG DẪN CHẤM VÀ THANG ĐIỂM (Cuối tài liệu):**
  - Tiêu đề: HƯỚNG DẪN CHẤM VÀ THANG ĐIỂM.
  - Phần I: Bảng đáp án ngang (Câu | 1 | 2 ... | Đáp án | A | B ...).
  - Phần II: Với mỗi câu hỏi, kẻ bảng 3 cột (Phương án | Đúng | Sai) và đánh dấu X vào ô tương ứng.
  - Phần III: Đáp án dạng liệt kê (VD: 1-B, 2-A...) hoặc bảng.
  - Phần IV: Đáp án từ khóa.
  - Phần V: Kẻ **BẢNG 3 CỘT**: | Câu | Nội dung | Điểm |. Tổng điểm phần này là 3.0 điểm.
  
  **YÊU CẦU OUTPUT:**
  1. Chỉ xuất ra Full HTML Document (<!DOCTYPE html>...). 
  2. Font Times New Roman, size 13pt, line-height 1.2.
  3. KHÔNG trả về markdown.
  4. CSS quan trọng:
     - .header-table td { border: none !important; padding: 2px; text-align: left; vertical-align: top; }
     - table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
     - td, th { border: 1px solid black; padding: 5px; vertical-align: top; }
  `;

  try {
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7, 
      },
    });
    const text = response.text || "Lỗi tạo đề thi.";
    return text.replace(/```html/g, '').replace(/```/g, '');
  } catch (error) {
    throw new Error("Lỗi API Gemini.");
  }
};
