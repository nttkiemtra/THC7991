import fs from 'fs';
const f = 'app/applet/src/App.tsx';
let code = fs.readFileSync(f, 'utf8');

// Regex cũ của bạn
const regex = /<div className="flex-1 h-\[2px\] bg-slate-100 rounded-full"><\/div>\n\s*<\/div>\n\s*<div className="grid grid-cols-1 gap-8">/g;

// Nội dung thay thế đã được chuẩn hóa theo phong cách "Bản in sư phạm"
const replace = `<div className="flex-1 h-[2px] bg-slate-100 rounded-full"></div>
                                         </div>
                                         
                                         {sec.type === 'multiple_choice' && sec.questions?.length > 0 && (
                                           <div className="mb-6 px-4">
                                              <p className="italic mb-2 text-sm">Em hãy chọn đáp án đúng nhất và điền vào bảng trả lời dưới đây:</p>
                                              <div className="w-full border-[1pt] border-black overflow-hidden">
                                                <table className="w-full border-collapse text-center table-fixed font-['Times_New_Roman']">
                                                  <tbody>
                                                    <tr className="border-b-[1pt] border-black">
                                                      <td className="border-r-[1pt] border-black font-bold p-1 bg-slate-100 w-20">Câu</td>
                                                      {sec.questions.map((_:any, i:number) => (
                                                        <td key={\`h-\${i}\`} className="border-r-[1pt] last:border-r-0 border-black p-1 text-sm font-bold">{i+1}</td>
                                                      ))}
                                                    </tr>
                                                    <tr className="h-10">
                                                      <td className="border-r-[1pt] border-black font-bold p-1 bg-slate-100">Chọn</td>
                                                      {sec.questions.map((_:any, i:number) => (
                                                        <td key={\`a-\${i}\`} className="border-r-[1pt] last:border-r-0 border-black p-1"></td>
                                                      ))}
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>
                                           </div>
                                         )}

                                         <div className="grid grid-cols-1 gap-8">`;

code = code.replace(regex, replace);
fs.writeFileSync(f, code);
console.log('✅ Fixed Web Preview JSX: Bảng đáp án đã chuẩn hóa theo phong cách in ấn!');