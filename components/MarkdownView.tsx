
import React from 'react';

import { VisualConfig } from '../types';

export function parsePlainScratchToHtml(scratchCode: string): string {
  const lines = scratchCode.split('\n');
  let html = '';
  const stack: { indent: number; category: string }[] = [];

  const getCategory = (line: string): string => {
    const lower = line.toLowerCase();
    if (lower.includes('di chuyển') || lower.includes('xoay') || lower.includes('đi tới') || lower.includes('tọa độ') || lower.includes('hướng')) {
      return 'sc-motion';
    }
    if (lower.includes('nói') || lower.includes('nghĩ') || lower.includes('trang phục') || lower.includes('kích thước') || lower.includes('hiện') || lower.includes('ẩn')) {
      return 'sc-looks';
    }
    if (lower.includes('âm thanh') || lower.includes('tiếng') || lower.includes('phát nốt')) {
      return 'sc-sound';
    }
    if (lower.includes('khi nhận') || lower.includes('phát tin') || lower.includes('khi bấm vào') || lower.includes('khi click') || lower.includes('khi nhấn')) {
      return 'sc-events';
    }
    if (lower.includes('đặt') || lower.includes('thành') || lower.includes('thay đổi') || lower.includes('biến')) {
      return 'sc-variables';
    }
    if (lower.includes('chạm') || lower.includes('khoảng cách') || lower.includes('hỏi') || lower.includes('chuột')) {
      return 'sc-sensing';
    }
    if (lower.includes('+') || lower.includes('-') || lower.includes('*') || lower.includes('/') || lower.includes('>') || lower.includes('<') || lower.includes('=') || lower.includes('và') || lower.includes('hoặc') || lower.includes('không')) {
      return 'sc-operators';
    }
    return 'sc-control';
  };

  const parseInputs = (text: string): string => {
    let result = text;
    // Replace <condition> with hex-shape
    result = result.replace(/<([^>]+)>/g, '<span class="scratch-hex">$1</span>');
    // Replace [dropdown] with dropdown-shape
    result = result.replace(/\[([^\]]+)\]/g, '<span class="scratch-dropdown">$1</span>');
    // Replace (input) with input-shape
    result = result.replace(/\(([^)]+)\)/g, '<span class="scratch-input">$1</span>');
    return result;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Calculate current line indent
    const lineIndent = line.length - line.trimStart().length;

    // Pop any open blocks that have greater or equal indentation
    while (stack.length > 0 && stack[stack.length - 1].indent >= lineIndent && !trimmed.toLowerCase().startsWith('nếu không thì') && !trimmed.toLowerCase().startsWith('else')) {
      stack.pop();
      html += '</div><div class="scratch-c-footer"></div></div>';
    }

    const lower = trimmed.toLowerCase();

    // Check for explicit end markers
    if (lower.startsWith('hết lặp') || lower.startsWith('hết nếu') || lower.startsWith('end') || lower.startsWith('đóng') || lower.startsWith('hết')) {
      if (stack.length > 0) {
        stack.pop();
        html += '</div><div class="scratch-c-footer"></div></div>';
      }
      return;
    }

    // Check for else
    if (lower.startsWith('nếu không thì') || lower.startsWith('else')) {
      const parentCat = stack.length > 0 ? stack[stack.length - 1].category : 'sc-control';
      html += `</div><div class="scratch-c-else ${parentCat}">nếu không thì</div><div class="scratch-c-body ${parentCat}">`;
      return;
    }

    // Check for C-block (Control blocks like Repeat, If)
    const isCBlock = lower.startsWith('lặp lại') || lower.startsWith('nếu') || lower.startsWith('repeat') || lower.startsWith('if');
    const category = getCategory(trimmed);
    const parsedText = parseInputs(trimmed);

    if (isCBlock) {
      html += `<div class="scratch-c-block ${category}"><div class="scratch-c-header">${parsedText}</div><div class="scratch-c-body ${category}">`;
      stack.push({ indent: lineIndent, category });
    } else {
      html += `<span class="scratch-block ${category}">${parsedText}</span>`;
    }
  });

  // Close any unclosed blocks
  while (stack.length > 0) {
    stack.pop();
    html += '</div><div class="scratch-c-footer"></div></div>';
  }

  return `<div class="scratch-canvas">${html}</div>`;
}

export function injectScratchInlineStyles(html: string): string {
  const colors: Record<string, { bg: string, brd: string }> = {
    'sc-motion': { bg: '#4C97FF', brd: '#3373CC' },
    'sc-looks': { bg: '#9966FF', brd: '#774DCB' },
    'sc-sound': { bg: '#CF63CF', brd: '#BD43BD' },
    'sc-events': { bg: '#FFBF00', brd: '#CC9900' },
    'sc-control': { bg: '#FFAB19', brd: '#CF8B17' },
    'sc-sensing': { bg: '#5CB1D6', brd: '#2E8EB8' },
    'sc-operators': { bg: '#59C059', brd: '#389438' },
    'sc-variables': { bg: '#FF8C1A', brd: '#DB6E00' },
    'sc-myblocks': { bg: '#FF6680', brd: '#D94D63' }
  };

  const tagRegex = /<([a-z1-6]+)\s+([^>]*?)class=(['"])(.*?)\3([^>]*?)>/gi;

  return html.replace(tagRegex, (match, tagName, before, quote, classStr, after) => {
    const classes = classStr.split(/\s+/);
    
    // Determine category color
    let bg = '#cccccc';
    let brd = '#aaaaaa';
    for (const cls of classes) {
      if (colors[cls]) {
        bg = colors[cls].bg;
        brd = colors[cls].brd;
        break;
      }
    }

    let addedStyles = '';

    if (classes.includes('scratch-canvas')) {
      addedStyles += `background-color: #f9f9f9; border: 2px solid #d0d0d0; border-radius: 8px; padding: 15px; margin: 10px 0; display: block; font-family: Arial, Helvetica, sans-serif; min-width: 300px; text-align: left;`;
    }
    if (classes.includes('scratch-block')) {
      addedStyles += `display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; margin: 3px; border-radius: 4px; border: 2px solid ${brd}; background-color: ${bg}; color: #ffffff; font-weight: bold; font-family: Arial, Helvetica, sans-serif; font-size: 11px; white-space: nowrap;`;
    }
    if (classes.includes('scratch-c-block')) {
      addedStyles += `display: block; margin: 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; text-align: left;`;
    }
    if (classes.includes('scratch-c-header')) {
      addedStyles += `background-color: ${bg}; border: 2px solid ${brd}; border-bottom: none; padding: 5px 10px; border-top-left-radius: 4px; border-top-right-radius: 4px; border-bottom-right-radius: 4px; display: inline-flex; align-items: center; gap: 4px; min-height: 26px; color: #ffffff;`;
    }
    if (classes.includes('scratch-c-body')) {
      addedStyles += `border-left: 14px solid ${bg}; padding-left: 10px; min-height: 18px; display: block; margin-top: -2px; margin-bottom: -2px;`;
    }
    if (classes.includes('scratch-c-else')) {
      addedStyles += `background-color: ${bg}; border: 2px solid ${brd}; padding: 5px 10px; margin-top: -2px; margin-bottom: -2px; display: inline-flex; align-items: center; border-top-right-radius: 4px; border-bottom-right-radius: 4px; color: #ffffff; min-width: 80px;`;
    }
    if (classes.includes('scratch-c-footer')) {
      addedStyles += `background-color: ${bg}; border: 2px solid ${brd}; border-top: none; height: 12px; width: 45px; border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; display: block; margin-top: -2px;`;
    }
    if (classes.includes('scratch-input')) {
      addedStyles += `background-color: #ffffff; color: #000000; border-radius: 10px; padding: 1px 6px; min-width: 15px; text-align: center; border: 1px solid rgba(0,0,0,0.15); font-weight: bold; font-size: 10px; display: inline-block;`;
    }
    if (classes.includes('scratch-dropdown')) {
      addedStyles += `background-color: rgba(0,0,0,0.15); color: #ffffff; border-radius: 10px; padding: 1px 6px; display: inline-block; font-size: 10px; font-weight: bold;`;
    }
    if (classes.includes('scratch-hex')) {
      addedStyles += `background-color: rgba(0,0,0,0.2); color: #ffffff; padding: 1px 6px; border-radius: 4px; display: inline-block; font-size: 10px; font-weight: bold;`;
    }
    if (classes.includes('scratch-variable')) {
      addedStyles += `background-color: #ff8c1a; border: 1px solid rgba(0,0,0,0.15); border-radius: 10px; padding: 1px 6px; display: inline-block; font-size: 10px; font-weight: bold;`;
    }

    if (!addedStyles) {
      return match;
    }

    // Now merge with any existing style attribute
    const rest = (before + ' ' + after).trim();
    const styleMatch = rest.match(/style=(['"])(.*?)\1/i);
    if (styleMatch) {
      const existingStyle = styleMatch[2];
      const mergedStyle = `${existingStyle}${existingStyle.endsWith(';') ? '' : ';'} ${addedStyles}`;
      const newRest = rest.replace(/style=(['"])(.*?)\1/gi, `style=$1${mergedStyle}$1`);
      return `<${tagName} ${newRest} class=${quote}${classStr}${quote}>`;
    } else {
      return `<${tagName} style="${addedStyles}" ${rest} class=${quote}${classStr}${quote}>`;
    }
  });
}

export function preprocessScratchMarkdown(content: string): string {
  if (!content) return content;
  let result = content;

  // 1. Process ```scratch code blocks
  const scratchBlockRegex = /```scratch\s*([\s\S]*?)```/g;
  result = result.replace(scratchBlockRegex, (match, code) => {
    return parsePlainScratchToHtml(code);
  });

  // 2. Process SCRATCH CAPTURE blocks
  const scratchCaptureRegex = /SCRATCH CAPTURE:\s*\n?([\s\S]*?)(?=(?:\n\s*\n|\n[A-Z\d\s]{3,}:|$))/gi;
  result = result.replace(scratchCaptureRegex, (match, code) => {
    return parsePlainScratchToHtml(code);
  });

  // 3. Inject inline styles for any scratch elements
  result = injectScratchInlineStyles(result);

  return result;
}

interface Props {
  content: string;
  config?: VisualConfig;
  isMatrixOrSpecs?: boolean;
}

const MarkdownView: React.FC<Props> = ({ content, config, isMatrixOrSpecs }) => {
  const processedContent = React.useMemo(() => {
    return preprocessScratchMarkdown(content);
  }, [content]);

  // Robust detection of HTML content
  const isHtml = (text: string) => {
    const trimmed = text.trim();
    // Check for doctype, html tag, or table tag anywhere in the string
    return trimmed.includes('<!DOCTYPE html>') || 
           trimmed.includes('<html') || 
           trimmed.includes('<table') ||
           trimmed.includes('class="scratch-canvas"') ||
           trimmed.includes('class="scratch-block"') ||
           // Also check for common table row start if Gemini omits table tags but sends row data
           (trimmed.includes('<tr>') && trimmed.includes('</tr>'));
  };

  const renderHtmlContent = () => {
      // Normalize content: If it's a full doc, we rely on its internal styles + our overrides.
      // We wrap it in a div with specific class to scope styles and enforce the "document" look.
      return (
        <div className="w-full bg-white text-black leading-normal">
            <style>{`
                /* Scoped styles for the document preview */
                .doc-preview-container {
                    font-family: ${config?.fontFamily || "'Times New Roman', serif"};
                    font-size: ${isMatrixOrSpecs ? '11px' : (config?.fontSize || '13pt')};
                    line-height: ${config?.lineHeight || '1.0'};
                    color: ${config?.primaryColor || '#000'};
                }
                
                /* Standard Table Styling */
                .doc-preview-container table { 
                    border-collapse: collapse !important; 
                    width: 100% !important; 
                    margin-bottom: 1rem; 
                    margin-left: auto;
                    margin-right: auto;
                    border: 1px solid black !important;
                    ${isMatrixOrSpecs ? 'table-layout: fixed !important;' : ''}
                }
                
                /* Enforce borders for standard tables (Matrix, Specs, Answer Key) */
                .doc-preview-container table th, 
                .doc-preview-container table td { 
                    border: 1px solid black !important; 
                    padding: ${isMatrixOrSpecs ? '2px 3px' : '5px'} !important; 
                    vertical-align: top;
                    text-align: justify;
                    ${isMatrixOrSpecs ? 'font-size: 11px !important; word-break: break-word !important; white-space: normal !important;' : ''}
                }

                /* Table header row (thead or first tr) must be absolutely centered */
                .doc-preview-container table thead tr,
                .doc-preview-container table tr:first-child {
                    text-align: center !important;
                }
                .doc-preview-container table thead th,
                .doc-preview-container table thead td,
                .doc-preview-container table tr:first-child th,
                .doc-preview-container table tr:first-child td {
                    text-align: center !important;
                    vertical-align: middle !important;
                }

                /* Khối Tiêu đề: Bọc toàn bộ phần thông tin từ đầu trang cho đến chữ 'ĐỀ BÀI' */
                .doc-preview-container .exam-header-block,
                .doc-preview-container .exam-header-block p,
                .doc-preview-container .exam-header-block td,
                .doc-preview-container .exam-header-block th {
                    text-align: center !important;
                }

                /* EXCEPTION: Header Table (Exam Step) must NOT have borders and should be left-aligned */
                .doc-preview-container table.header-table,
                .doc-preview-container table.header-table td,
                .doc-preview-container table.header-table th,
                .doc-preview-container table.header-table p {
                    border: none !important;
                    vertical-align: top;
                    text-align: left !important;
                }

                /* Header Text Styling */
                .doc-preview-container h1,
                .doc-preview-container h2,
                .doc-preview-container h3, 
                .doc-preview-container h4 { 
                    text-align: center !important; 
                    font-weight: bold !important; 
                    margin: 10px 0; 
                    text-transform: uppercase; 
                }
                
                .doc-preview-container p { 
                    margin-bottom: 0px; 
                    text-align: justify !important;
                    line-height: 1.0;
                }
            `}</style>
            <div 
                className={`doc-preview-container p-8 shadow-sm border border-slate-100 ${isMatrixOrSpecs ? 'overflow-x-hidden' : 'overflow-x-auto'}`} 
                dangerouslySetInnerHTML={{ __html: processedContent }} 
            />
        </div>
      );
  };

  if (isHtml(processedContent)) {
      return renderHtmlContent();
  }

  // ... Fallback for non-HTML (Markdown) ...
  // Parsing line by line
  const lines = processedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLanguage = '';

  lines.forEach((line, index) => {
    // 1. Handle Code Blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${index}`} className="my-4 bg-slate-900 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-slate-800 px-4 py-1 text-xs text-slate-400 font-mono uppercase tracking-wider border-b border-slate-700">
              {codeBlockLanguage || 'Code'}
            </div>
            <pre className="p-4 text-sm text-blue-300 font-mono overflow-x-auto whitespace-pre">
              {codeBlockContent.join('\n')}
            </pre>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.replace('```', '').trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // 2. Normal Markdown Rendering
    if (line.startsWith('# ')) {
      elements.push(<h1 key={index} className="text-2xl font-bold text-primary mt-6 mb-3 border-b border-blue-100 pb-2">{line.replace('# ', '')}</h1>);
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={index} className="text-xl font-bold text-blue-800 mt-5 mb-2">{line.replace('## ', '')}</h2>);
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={index} className="text-lg font-semibold text-blue-700 mt-4 mb-2">{line.replace('### ', '')}</h3>);
      return;
    }
    
    // Legacy Markdown Table Row (fallback)
    if (line.trim().startsWith('|')) {
       elements.push(
          <div key={index} className="font-mono text-xs sm:text-sm whitespace-pre text-slate-700 bg-white border-b border-slate-200 hover:bg-blue-50 px-1 overflow-x-auto">
            {line}
          </div>
       );
       return;
    }

    if (line.trim() === '') {
      elements.push(<div key={index} className="h-2"></div>);
      return;
    }

    const parts = line.split(/(\*\*.*?\*\*)/g);
    elements.push(
      <div key={index} className="min-h-[1.5em] mb-1 leading-relaxed text-slate-800 font-sans">
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-blue-900">{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  });

  return (
    <div className="prose prose-slate max-w-none p-6 bg-white h-auto overflow-visible">
       <div className="text-sm">
         {elements}
       </div>
    </div>
  );
};

export default MarkdownView;
