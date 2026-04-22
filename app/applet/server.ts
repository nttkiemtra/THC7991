import express from 'express';
import { createServer as createViteServer } from 'vite';
import { exec, execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import cors from 'cors';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { generateWordDocx } from './generate_docx';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/generate-docx', async (req, res) => {
    try {
      const data = req.body;
      const tmpDir = os.tmpdir();
      const uniqueId = Date.now().toString();
      const docxPath = path.join(tmpDir, `output_${uniqueId}.docx`);

      await generateWordDocx(data, docxPath);

      if (fs.existsSync(docxPath)) {
        console.log('Generated DOCX using Node AST at', docxPath);
        res.download(docxPath, 'De_Kiem_Tra.docx', (err) => {
          // Cleanup after download
          try {
            if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
          } catch (cleanupErr) {
            console.error('Cleanup error:', cleanupErr);
          }
        });
      } else {
        res.status(500).json({ error: 'Không tìm thấy file kết quả DOCX' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi sinh file Word nội bộ' });
    }
  });

  app.post('/api/analyze-template', async (req, res) => {
    try {
      const { rawText } = req.body;
      if (!rawText) return res.status(400).json({ error: 'Missing rawText' });

      const prompt = `Analyze the following text from an exam paper and extract these fields in JSON format: school (Tên trường), class (Lớp), student (Dòng tên học sinh), examTitle (Tên kỳ thi/kiểm tra), subject (Môn học), time (Thời gian làm bài).
TEXT:
${rawText}

OUTPUT JSON FORMAT:
{
  "school": "string",
  "class": "string",
  "student": "string",
  "examTitle": "string",
  "subject": "string",
  "time": "string"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      res.json(JSON.parse(response.text));
    } catch (err: any) {
      console.error('Template Analysis Error:', err);
      res.status(500).json({ error: 'Failed to analyze template', details: err.message });
    }
  });

  app.post('/api/generate-exam', async (req, res) => {
    try {
      const { userPrompt } = req.body;

      if (!userPrompt) {
        return res.status(400).json({ error: 'Missing userPrompt' });
      }

      const systemInstruction = `Bạn là một hệ thống AI đa vai trò gồm:
* Educational Assessment Designer (chuyên thiết kế đề kiểm tra)
* Curriculum Analyst (phân tích SGK/tài liệu)

NHIỆM VỤ CHÍNH:
Phân tích tài liệu người dùng cung cấp → trích xuất bài học → cho phép người dùng chọn nội dung → thiết kế đề kiểm tra → sinh ma trận → sinh đặc tả → sinh đề

=====================
I. QUY TRÌNH XỬ LÝ
==================
Bước 1: PHÂN TÍCH TÀI LIỆU
* Trích xuất: Danh sách bài học, Nội dung kiến thức chính, Mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng)
Bước 2: NGƯỜI DÙNG CHỌN
* Bài học, Cấu trúc đề (số câu, điểm từng phần)
Bước 3: SINH MA TRẬN (Exam Blueprint Matrix)
* Dạng bảng: Hàng: nội dung/chủ đề, Cột: mức độ nhận thức, Có phân bổ điểm rõ ràng
Bước 4: SINH ĐẶC TẢ (Specification Table)
* Chi tiết: Mục tiêu câu hỏi, Dạng câu hỏi, Kiến thức áp dụng
Bước 5: SINH ĐỀ KIỂM TRA
Bao gồm: Trắc nghiệm, Đúng/Sai, Ghép nối, Điền khuyết, Tự luận

=====================
II. QUY TẮC CÚ PHÁP SCRATCH
========================================
Nếu bất kỳ câu hỏi hoặc đáp án nào liên quan đến mã nguồn Scratch (Scratch blocks), bạn BẮT BUỘC phải bọc phần mã Scratch trong the [scratch] và [/scratch]. Ví dụ:
[scratch]
nếu <số cần tìm < phần tử thứ giữa của [danh sách v]> thì
  đặt [cuối v] thành (giữa - (1))
[/scratch]
Đảm bảo cú pháp bên trong hoàn toàn tương thích với chuẩn Scratch 3.0.

=====================
III. ĐỊNH DẠNG OUTPUT (JSON)
========================================
Luôn xuất trực tiếp JSON. Dữ liệu logic (JSON) - ĐÂY LÀ LỚP QUAN TRỌNG NHẤT ĐỂ HỆ THỐNG PARSE DOCX.

BẠN BẮT BUỘC PHẢI TRẢ VỀ JSON VỚI SCHEMA SAU ĐÂY:
{
  "header": { "left": ["string"], "center": ["string"] },
  "sections": [
    {
      "title": "string",
      "type": "multiple_choice | true_false | matching | fill_in_the_blanks | essay",
      "questions": [
        {
          "id": 1,
          "question": "string chứa nội dung câu hỏi, chứa hình ảnh Scratch nếu có (bọc [scratch]...[/scratch])",
          "options": ["string bọc [scratch] nếu cần"], // if multiple choice
          "answer": "string", // if multiple choice
          "statements": [{"text": "string", "answer": true}], // if true_false
          "left": ["string"], "right": ["string"] // if matching
        }
      ],
      "answer_table": true
    }
  ],
  "scoring": {}
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: `INPUT:\n${userPrompt}`,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const textResult = response.text;
      if (typeof textResult !== 'string') {
        throw new Error("Invalid response format from Gemini");
      }

      let jsonData;
      try {
        jsonData = JSON.parse(textResult);
      } catch (normErr) {
         console.error("JSON parse error:", normErr);
         return res.status(400).json({ error: 'JSON_PARSE_ERROR', rawText: textResult });
      }

      res.json(jsonData);
    } catch (err: any) {
      console.error('Gemini Generate Error:', err);
      res.status(500).json({ error: 'Lỗi sinh đề thi từ AI', details: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
