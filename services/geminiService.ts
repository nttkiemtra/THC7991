
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION, MODEL_NAME } from '../constants';
import { InputData, Chapter, Lesson, QuestionConfig, QuestionBankItem } from '../types';
import { INFORMATICS_SPECS_REFERENCE } from './informaticsSpecs';

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
      model: MODEL_NAME, 
      contents: {
        parts: [
          { inlineData: { mimeType: file.type || 'application/pdf', data: base64Data } }, 
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

export const extractInfoFromDocuments = async (files: File[]): Promise<Partial<InputData>> => {
  const fileData = await Promise.all(files.map(async f => ({
    base64: await fileToBase64(f),
    type: f.type,
    name: f.name
  })));
  
  const prompt = `
    Bạn là chuyên gia phân tích chương trình giáo dục và biên soạn tài liệu. Hãy đọc các file đính kèm và thực hiện nhiệm vụ sau:

    NHIỆM VỤ: TRÍCH XUẤT CẤU TRÚC (MỤC LỤC)
    - Tìm kiếm thông tin về môn học, khối lớp và danh sách các chương/bài học.
    - Nếu không có file mục lục rõ ràng, hãy tự suy luận từ nội dung tài liệu.
    - Với mỗi bài học, hãy trích xuất hoặc tự soạn thảo "objectives" (Yêu cầu cần đạt) chi tiết cho 3 mức độ: Biết, Hiểu, Vận dụng. KHÔNG ĐƯỢC để trống.

    Yêu cầu đầu ra: JSON Object (không markdown) với cấu trúc sau:
    {
      "subject": "Tên môn học",
      "grade": "Khối lớp",
      "chapters": [
        {
          "id": "c1",
          "name": "Tên chương",
          "totalPeriods": 10,
          "lessons": [
            {
              "id": "c1_l1",
              "name": "Tên bài học",
              "periods": 2,
              "objectives": {
                "biet": "...",
                "hieu": "...",
                "van_dung": "..."
              }
            }
          ]
        }
      ]
    }
  `;

  try {
    const response = await getAI().models.generateContent({
      model: MODEL_NAME, 
      contents: {
        parts: [
          ...fileData.map(f => {
              let mimeType = f.type;
              if (f.name.toLowerCase().endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              else if (f.name.toLowerCase().endsWith('.doc')) mimeType = 'application/msword';
              else if (f.name.toLowerCase().endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              else if (f.name.toLowerCase().endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
              else if (f.type.startsWith('image/')) mimeType = 'image/jpeg';
              else if (!mimeType || mimeType === 'application/octet-stream') mimeType = 'text/plain';

              return { 
                inlineData: { 
                  mimeType: mimeType, 
                  data: f.base64 
                } 
              };
          }),
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

    return {
        subject: parsed.subject || "",
        grade: parsed.grade || "",
        referenceContent: "", // We no longer extract this as text
        referenceFiles: fileData, // Store the files for later use
        chapters: parsed.chapters
    };
  } catch (error: any) {
    console.error("Error extracting info:", error);
    throw new Error(`Lỗi phân tích tài liệu: ${error.message}`);
  }
};

export const batchExtractQuestions = async (files: File[]): Promise<Partial<QuestionBankItem>[]> => {
  const fileData = await Promise.all(files.map(async f => ({
    base64: await fileToBase64(f),
    type: f.type,
    name: f.name
  })));
  
  const prompt = `
    Bạn là chuyên gia số hóa học liệu. Hãy đọc các file đính kèm (có thể là văn bản hoặc hình ảnh chụp từ bản in/giấy) và thực hiện nhiệm vụ sau:

    NHIỆM VỤ: TRÍCH XUẤT CÂU HỎI
    - Nhận diện tất cả các câu hỏi có trong tài liệu.
    - Phân loại từng câu hỏi theo:
      + Dạng (type): type1 (Trắc nghiệm 4 lựa chọn), type2 (Đúng/Sai), type3 (Ghép nối), type4 (Điền khuyết), essay (Tự luận).
      + Mức độ (level): biet (Nhận biết), hieu (Thông hiểu), van_dung (Vận dụng), van_dung_cao (Vận dụng cao).
      + Môn học (subject) và Khối lớp (grade) nếu có thông tin, nếu không hãy để trống.
      + Bài học/Chủ đề (lesson) nếu có thông tin.
    - Trích xuất nội dung câu hỏi (content) và đáp án/hướng dẫn giải (answer) nếu có.
    - Giữ nguyên định dạng HTML cơ bản cho nội dung (ví dụ: công thức, in đậm, xuống dòng).

    Yêu cầu đầu ra: JSON Array (không markdown) chứa các đối tượng có cấu trúc sau:
    [
      {
        "subject": "...",
        "grade": "...",
        "lesson": "...",
        "type": "type1" | "type2" | "type3" | "type4" | "essay",
        "level": "biet" | "hieu" | "van_dung" | "van_dung_cao",
        "content": "Nội dung câu hỏi...",
        "answer": "Đáp án..."
      },
      ...
    ]
  `;

  try {
    const response = await getAI().models.generateContent({
      model: MODEL_NAME, 
      contents: {
        parts: [
          ...fileData.map(f => {
              let mimeType = f.type;
              if (f.name.toLowerCase().endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              else if (f.name.toLowerCase().endsWith('.doc')) mimeType = 'application/msword';
              else if (f.name.toLowerCase().endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              else if (f.name.toLowerCase().endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
              else if (f.type.startsWith('image/')) mimeType = 'image/jpeg';
              else if (!mimeType || mimeType === 'application/octet-stream') mimeType = 'text/plain';
              
              return { 
                inlineData: { 
                  mimeType: mimeType, 
                  data: f.base64 
                } 
              };
          }),
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "[]";
    try {
        return JSON.parse(text);
    } catch (e) {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(cleaned);
    }
  } catch (error) {
    console.error("Error batch extracting questions:", error);
    return [];
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
            periods: l.periods,
            objectives: l.objectives
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
  
  ${data.additionalNotes ? `**GHI CHÚ BỔ SUNG TỪ NGƯỜI DÙNG (RÀNG BUỘC BẮT BUỘC):**
  "${data.additionalNotes}"
  
  **QUY TẮC THIẾT KẾ MA TRẬN PHẢI TUÂN THỦ:**
  1. ƯU TIÊN TUYỆT ĐỐI các yêu cầu trong Ghi chú bổ sung trên. Bạn phải bám sát các yêu cầu này để phân bổ nội dung và mức độ nhận thức.
  2. NẾU ghi chú yêu cầu tập trung vào một chương/bài cụ thể, hãy dồn số lượng câu hỏi nhiều hơn vào đó.
  3. CHỈ KHI các yêu cầu trong ghi chú không thể thực hiện được (ví dụ: mâu thuẫn logic hoặc thiếu thông tin), bạn mới được phép tự sinh nội dung theo logic sư phạm thông thường.
  4. Đảm bảo tổng điểm và tỷ lệ vẫn cân đối theo các ràng buộc kỹ thuật khác.` : ""}

  **TÔ MÀU CỘT (QUAN TRỌNG):**
  Để dễ quan sát, hãy tô màu nền cho các cột mức độ nhận thức như sau:
  - Cột **Biết**: Màu xanh dương nhạt (background-color: #e0f2fe)
  - Cột **Hiểu**: Màu xanh lá nhạt (background-color: #f0fdf4)
  - Cột **Vận dụng (VD)**: Màu vàng nhạt (background-color: #fefce8)
  Áp dụng style này vào các thẻ <th> và <td> tương ứng.

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
  
  ${data.additionalNotes ? `**GHI CHÚ BỔ SUNG TỪ NGƯỜI DÙNG (YÊU CẦU ƯU TIÊN):**
  "${data.additionalNotes}"
  -> Hãy đảm bảo các mô tả trong Bảng đặc tả phản ánh đúng các yêu cầu bổ sung này.` : ""}

  **TÔ MÀU CỘT (QUAN TRỌNG):**
  Để dễ quan sát, hãy tô màu nền cho các cột mức độ nhận thức như sau:
  - Cột **Biết**: Màu xanh dương nhạt (background-color: #e0f2fe)
  - Cột **Hiểu**: Màu xanh lá nhạt (background-color: #f0fdf4)
  - Cột **Vận dụng (VD)**: Màu vàng nhạt (background-color: #fefce8)
  Áp dụng style này vào các thẻ <th> và <td> tương ứng.

  **DỮ LIỆU ĐẦU VÀO:**
  1. THÔNG TIN CHUNG: Môn ${data.subject}, Khối ${data.grade}.
  2. MA TRẬN ĐỀ THI:
  ${matrixContent}
  
  3. YÊU CẦU CẦN ĐẠT (Objectives):
  ${objectivesMap.join('\n')}

  ${data.subject.toLowerCase().includes('tin học') ? `
  **TÀI LIỆU THAM KHẢO ĐẶC TẢ MÔN TIN HỌC:**
  ${INFORMATICS_SPECS_REFERENCE}
  ` : ''}

  **YÊU CẦU OUTPUT QUAN TRỌNG:**
  1. Xuất ra Full HTML Document (<!DOCTYPE html>...). Font Times New Roman 13pt.
  2. **CẤU TRÚC BẢNG BẮT BUỘC:**
     Sử dụng chính xác cấu trúc Header sau:
     ${headerStructure}
  3. **NỘI DUNG CỘT "Mức độ kiểm tra, đánh giá":**
     - PHẢI điền nội dung chi tiết cho từng mức độ: **Biết**, **Hiểu**, **Vận dụng**.
     - ${data.subject.toLowerCase().includes('tin học') ? 'ƯU TIÊN sử dụng nội dung từ "TÀI LIỆU THAM KHẢO ĐẶC TẢ MÔN TIN HỌC" ở trên nếu bài học tương ứng có trong tài liệu.' : 'Dựa vào kiến thức chuyên môn của môn học để soạn thảo nội dung chi tiết.'}
     - Nếu dữ liệu đầu vào (Yêu cầu cần đạt) bị thiếu hoặc chỉ có dấu "...", bạn CÓ TRÁCH NHIỆM tự soạn thảo nội dung Yêu cầu cần đạt chuẩn kiến thức kỹ năng cho bài học đó dựa trên tên bài, môn học và khối lớp.
     - TUYỆT ĐỐI KHÔNG ĐƯỢC để trống hoặc chỉ ghi dấu ba chấm "...".
     - Định dạng: 
       **Biết:** [Nội dung chi tiết]
       **Hiểu:** [Nội dung chi tiết]
       **Vận dụng:** [Nội dung chi tiết]
  4. **CÁC CỘT DẠNG I, II, III...:**
     - Điền CHÍNH XÁC mã câu hỏi (C1, C2...) lấy từ Ma trận sang.
  5. **FOOTER (TỔNG KẾT):**
     Hiển thị tổng số câu và phân phối điểm số (Trắc nghiệm 7.0 - Tự luận 3.0).
  6. KHÔNG trả về markdown fences. Border 1px solid black.
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
    
    /* Screenshot Container */
    .scratch-canvas {
      background-color: #F9F9F9;
      border: 1px solid #D0D0D0;
      border-radius: 8px;
      padding: 15px;
      margin: 10px 0;
      display: inline-block;
      min-width: 300px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      position: relative;
    }
    .scratch-canvas::before {
      content: 'Scratch Capture';
      position: absolute;
      top: 0;
      right: 10px;
      font-size: 8px;
      color: #999;
      text-transform: uppercase;
    }
  `;

  // Enhanced Scratch Instruction with strict formatting for E-Blocks and Repeat Until
  const scratchInstruction = isIT 
    ? `**YÊU CẦU VỀ SCRATCH VÀ TRÌNH BÀY (QUAN TRỌNG - BẮT BUỘC TUÂN THỦ):**
       1. **CHỦ ĐỀ:** Nếu câu hỏi thuộc chủ đề "Giải quyết vấn đề với sự trợ giúp của máy tính", **BẮT BUỘC CHỈ ĐƯỢC PHÉP** sử dụng ngôn ngữ lập trình **SCRATCH**. Tuyệt đối **KHÔNG** dùng Python, Pascal, hay C++.
       
       2. **TRÌNH BÀY DẠNG ẢNH CHỤP MÀN HÌNH (SCREENSHOT):**
          - **BẮT BUỘC** bọc toàn bộ các khối lệnh Scratch trong một thẻ <div class="scratch-canvas">.
          - Thẻ này sẽ giả lập một khung hình chụp màn hình (screenshot) giúp câu hỏi trực quan hơn.

       3. **HÌNH ẢNH CÂU LỆNH (Sử dụng HTML/CSS chuẩn):**
          - Tuyệt đối KHÔNG mô tả lệnh bằng lời (VD: "Khối di chuyển 10 bước").
          - **BẮT BUỘC** phải tạo hình ảnh khối lệnh bằng các thẻ HTML với Class CSS mới đã định nghĩa.
          - Sử dụng **BIẾN CSS** thông qua các class chủ đề (sc-motion, sc-control, sc-events, sc-looks, sc-sensing, sc-operators, sc-variables, sc-custom) để đảm bảo màu sắc chuẩn xác.

       3. **CẤU TRÚC BLOCK NÂNG CAO (MẪU CHUẨN BẰNG TIẾNG VIỆT - STRICT RULE):**
          
          **A. Khối đơn giản (Simple Block):**
          <span class="scratch-block sc-motion">di chuyển <span class="scratch-input">10</span> bước</span>
          <span class="scratch-block sc-events">khi bấm vào cờ xanh</span>
          <span class="scratch-block sc-looks">nói <span class="scratch-input">Xin chào!</span> trong <span class="scratch-input">2</span> giây</span>
          <span class="scratch-block sc-variables">đặt <span class="scratch-dropdown">my variable</span> thành <span class="scratch-input">0</span></span>

          **B. Vòng lặp (C-Block):**
          <!-- Lặp lại số lần -->
          <div class="scratch-c-block sc-control">
            <div class="scratch-c-header">lặp lại <span class="scratch-input">10</span></div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-motion">di chuyển <span class="scratch-input">10</span> bước</span>
            </div>
            <div class="scratch-c-footer"></div>
          </div>
          
          <!-- Lặp lại cho đến khi (Lặp có điều kiện) -->
          <div class="scratch-c-block sc-control">
            <div class="scratch-c-header">lặp lại cho đến khi <span class="scratch-hex sc-sensing">đang chạm <span class="scratch-dropdown">cạnh</span> ?</span></div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-motion">di chuyển <span class="scratch-input">10</span> bước</span>
            </div>
            <div class="scratch-c-footer"></div>
          </div>

          **C. Điều kiện Nếu ... thì / Nếu không thì (E-Block):**
          <!-- Nếu ... thì -->
          <div class="scratch-c-block sc-control">
            <div class="scratch-c-header">nếu <span class="scratch-hex sc-operators"><span class="scratch-variable">điểm</span> > <span class="scratch-input">50</span></span> thì</div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-looks">nói <span class="scratch-input">Bạn đã thắng!</span></span>
            </div>
            <div class="scratch-c-footer"></div>
          </div>

          <!-- Nếu ... thì ... nếu không thì -->
          <div class="scratch-c-block sc-control">
            <div class="scratch-c-header">nếu <span class="scratch-hex sc-sensing">phím <span class="scratch-dropdown">trắng</span> được bấm?</span> thì</div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-motion">thay đổi y một lượng <span class="scratch-input">10</span></span>
            </div>
            <div class="scratch-c-else">nếu không thì</div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-motion">thay đổi y một lượng <span class="scratch-input">-10</span></span>
            </div>
            <div class="scratch-c-footer"></div>
          </div>
          
          **D. Khối lệnh tùy chỉnh (Custom Block / My Blocks):**
          <span class="scratch-block sc-custom">Định nghĩa <span class="scratch-input">Nhảy</span> <span class="scratch-input">độ cao</span></span>
          <div class="scratch-c-block sc-control">
            <div class="scratch-c-header">lặp lại <span class="scratch-input">10</span></div>
            <div class="scratch-c-body">
               <span class="scratch-block sc-motion">thay đổi y một lượng <span class="scratch-variable">độ cao</span></span>
            </div>
            <div class="scratch-c-footer"></div>
          </div>

          **E. INPUT SHAPES:**
          - Số/Chữ (Trắng): <span class="scratch-input">10</span>
          - Dropdown (Có mũi tên): <span class="scratch-dropdown">vị trí ngẫu nhiên</span>
          - Điều kiện (Lục giác): <span class="scratch-hex sc-sensing">đang chạm <span class="scratch-dropdown">con trỏ chuột</span> ?</span>
          - Biến/Toán tử (Tròn): <span class="scratch-variable">my variable</span> hoặc <span class="scratch-variable sc-operators"><span class="scratch-input">1</span> + <span class="scratch-input">1</span></span>

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

  const allEssayScores = [
      ...data.essayScoreDistribution.biet,
      ...data.essayScoreDistribution.hieu,
      ...data.essayScoreDistribution.van_dung
  ];
  const essayScoreText = allEssayScores.length > 0 ? `Chi tiết điểm từng câu tự luận: ${allEssayScores.map(s => s + 'đ').join(', ')}.` : '';

  const validationInstructions = `
  **KIỂM TRA TÍNH NHẤT QUÁN (BẮT BUỘC TRƯỚC KHI TRẢ VỀ KẾT QUẢ):**
  - Bạn PHẢI đếm chính xác số lượng câu hỏi được tạo ra cho từng phần và đối chiếu với Bảng đặc tả.
  ${counts.type1 > 0 ? `- PHẦN I phải có ĐÚNG ${counts.type1} câu. Tổng điểm: ${counts.type1 * 0.25} điểm.` : ''}
  ${counts.type2 > 0 ? `- PHẦN II phải có ĐÚNG ${counts.type2} câu. Tổng điểm: ${counts.type2 * 1.0} điểm.` : ''}
  ${counts.type3 > 0 ? `- PHẦN III phải có ĐÚNG ${counts.type3} câu. Tổng điểm: ${counts.type3 * 1.0} điểm.` : ''}
  ${counts.type4 > 0 ? `- PHẦN IV phải có ĐÚNG ${counts.type4} câu. Tổng điểm: ${counts.type4 * 1.0} điểm.` : ''}
  ${counts.essay > 0 ? `- PHẦN V (Tự luận) phải có ĐÚNG ${counts.essay} câu. Tổng điểm: 3.0 điểm. ${essayScoreText}` : ''}
  - TỔNG ĐIỂM TOÀN BÀI PHẢI CHÍNH XÁC LÀ 10.0 ĐIỂM.
  - KHÔNG ĐƯỢC TỰ Ý THÊM HOẶC BỚT CÂU HỎI SO VỚI BẢNG ĐẶC TẢ. NẾU THẤY LỆCH, HÃY TỰ ĐỘNG SỬA LẠI CHO KHỚP.
  `;

  let preSelectedQuestionsText = "";
  if (data.preSelectedQuestions && data.preSelectedQuestions.length > 0) {
    preSelectedQuestionsText = `\n**CÂU HỎI CHỈ ĐỊNH TỪ KHO (BẮT BUỘC SỬ DỤNG):**\nBạn BẮT BUỘC phải đưa các câu hỏi sau vào đúng phần tương ứng trong đề thi:\n`;
    data.preSelectedQuestions.forEach((q, idx) => {
      preSelectedQuestionsText += `\n--- Câu chỉ định ${idx + 1} (Dạng: ${q.type}, Mức độ: ${q.level}) ---\nNội dung: ${q.content}\nĐáp án: ${q.answer || 'Không có'}\n`;
    });
  }

  const prompt = `
  Dựa trên **Bảng đặc tả** sau (HTML):
  ${specsContent}

  ${data.referenceFiles && data.referenceFiles.length > 0 ? `**NỘI DUNG THAM KHẢO TỪ TÀI LIỆU ĐÍNH KÈM (ƯU TIÊN SỬ DỤNG ĐỂ TẠO CÂU HỎI).**` : ""}
  ${data.additionalNotes ? `**GHI CHÚ BỔ SUNG TỪ NGƯỜI DÙNG (BẮT BUỘC TUÂN THỦ):**\n${data.additionalNotes}` : ""}
  ${preSelectedQuestionsText}

  Hãy soạn thảo **ĐỀ THI HOÀN CHỈNH** và **HƯỚNG DẪN CHẤM** (Đáp án) tuân thủ nghiêm ngặt định dạng văn bản mẫu (MAU DE.pdf).
  
  ${scratchInstruction}
  ${structureInstructions}
  ${validationInstructions}

  **YÊU CẦU ĐỊNH DẠNG BẢNG (TABLE GRID):**
  - Tất cả các bảng trong đề (Bảng Ma trận, Bảng Đặc tả, Bảng trong nội dung câu hỏi) **BẮT BUỘC** sử dụng định dạng **Table Grid** (đường kẻ đơn, liền mạch, màu đen).
  - Sử dụng CSS: border: 1px solid black; border-collapse: collapse;

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
    A. ...
    B. ...
    C. ...
    D. ...
    (Mỗi đáp án trắc nghiệm nằm trên 1 dòng riêng biệt)
    
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
  - Phần V: **BẮT BUỘC** kẻ bảng 3 cột cho mỗi câu tự luận: | Ý/Bước giải | Nội dung trả lời chi tiết | Điểm |.
    - **YÊU CẦU CHI TIẾT (QUAN TRỌNG):** Thang điểm phải được chia nhỏ chi tiết nhất có thể, ưu tiên mức **0.25 điểm** cho mỗi ý nhỏ (nếu câu hỏi ngắn thì tối thiểu **0.5 điểm**). KHÔNG ĐƯỢC chấm điểm nguyên câu 1.0đ hay 2.0đ mà không có breakdown chi tiết.
    - Tổng điểm phần này là 3.0 điểm.
  
  **7. ĐỊNH DẠNG CÂU HỎI CÓ BẢNG:**
  - Với bất kỳ câu hỏi nào có chứa bảng dữ liệu, bảng đó phải được kẻ khung rõ ràng (Table Grid). Tuyệt đối không để ẩn viền.

  **YÊU CẦU OUTPUT:**
  1. Chỉ xuất ra Full HTML Document (<!DOCTYPE html>...). 
  2. Font Times New Roman, size 14pt, line-height 1.0.
  3. KHÔNG trả về markdown.
  4. CSS quan trọng:
     - body, p { text-align: justify; margin-top: 0pt; margin-bottom: 0pt; line-height: 1.0; }
     - .header-table td { border: none !important; padding: 2px; text-align: left; vertical-align: top; }
     - table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid black; }
     - td, th { border: 1px solid black; padding: 5px; vertical-align: top; }
  `;

  try {
    let contents: any = prompt;
    
    if (data.referenceFiles && data.referenceFiles.length > 0) {
      contents = {
        parts: [
          ...data.referenceFiles.map(f => {
              let mimeType = f.type;
              if (f.name.toLowerCase().endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              else if (f.name.toLowerCase().endsWith('.doc')) mimeType = 'application/msword';
              else if (f.name.toLowerCase().endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              else if (f.name.toLowerCase().endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
              else if (f.type.startsWith('image/')) mimeType = 'image/jpeg';
              else if (!mimeType || mimeType === 'application/octet-stream') mimeType = 'text/plain';
              
              return { 
                inlineData: { 
                  mimeType: mimeType, 
                  data: f.base64 
                } 
              };
          }),
          { text: prompt }
        ]
      };
    }

    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: contents,
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
