
import React from 'react';

interface Props {
  content: string;
}

const MarkdownView: React.FC<Props> = ({ content }) => {
  // Robust detection of HTML content
  const isHtml = (text: string) => {
    const trimmed = text.trim();
    // Check for doctype, html tag, or table tag anywhere in the string
    return trimmed.includes('<!DOCTYPE html>') || 
           trimmed.includes('<html') || 
           trimmed.includes('<table') ||
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
                    font-family: 'Times New Roman', serif;
                    font-size: 13pt;
                    line-height: 1.3;
                    color: #000;
                }
                
                /* Standard Table Styling */
                .doc-preview-container table { 
                    border-collapse: collapse; 
                    width: 100%; 
                    margin-bottom: 1rem; 
                }
                
                /* Enforce borders for standard tables (Matrix, Specs, Answer Key) */
                .doc-preview-container table th, 
                .doc-preview-container table td { 
                    border: 1px solid black; 
                    padding: 5px; 
                    vertical-align: top;
                }

                /* EXCEPTION: Header Table (Exam Step) must NOT have borders */
                .doc-preview-container table.header-table,
                .doc-preview-container table.header-table td,
                .doc-preview-container table.header-table th {
                    border: none !important;
                    vertical-align: top;
                }

                /* Header Text Styling */
                .doc-preview-container h3, 
                .doc-preview-container h4 { 
                    text-align: center; 
                    font-weight: bold; 
                    margin: 10px 0; 
                    text-transform: uppercase; 
                }
                
                .doc-preview-container p { margin-bottom: 5px; }
            `}</style>
            <div 
                className="doc-preview-container overflow-x-auto p-8 shadow-sm border border-slate-100" 
                dangerouslySetInnerHTML={{ __html: content }} 
            />
        </div>
      );
  };

  if (isHtml(content)) {
      return renderHtmlContent();
  }

  // ... Fallback for non-HTML (Markdown) ...
  // Parsing line by line
  const lines = content.split('\n');
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
            <pre className="p-4 text-sm text-teal-300 font-mono overflow-x-auto whitespace-pre">
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
      elements.push(<h1 key={index} className="text-2xl font-bold text-primary mt-6 mb-3 border-b border-teal-100 pb-2">{line.replace('# ', '')}</h1>);
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={index} className="text-xl font-bold text-teal-800 mt-5 mb-2">{line.replace('## ', '')}</h2>);
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={index} className="text-lg font-semibold text-teal-700 mt-4 mb-2">{line.replace('### ', '')}</h3>);
      return;
    }
    
    // Legacy Markdown Table Row (fallback)
    if (line.trim().startsWith('|')) {
       elements.push(
          <div key={index} className="font-mono text-xs sm:text-sm whitespace-pre text-slate-700 bg-white border-b border-slate-200 hover:bg-teal-50 px-1 overflow-x-auto">
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
            return <strong key={i} className="font-bold text-teal-900">{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  });

  return (
    <div className="prose prose-slate max-w-none p-6 bg-white h-full overflow-auto">
       <div className="text-sm">
         {elements}
       </div>
    </div>
  );
};

export default MarkdownView;
