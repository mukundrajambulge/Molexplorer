import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen } from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserManualModal({ isOpen, onClose }: UserManualModalProps) {
  const [markdownContent, setMarkdownContent] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // In a real Vite app, we can fetch the markdown file or just import it as raw.
      fetch('/UserManual.md')
        .then(res => res.text())
        .then(text => setMarkdownContent(text))
        .catch(err => setMarkdownContent('# Error loading manual\nCould not load UserManual.md'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#4A90E2]/20 flex items-center justify-center text-[#4A90E2]">
              <BookOpen size={18} />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-wide">MolStudio User Manual</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar" style={{ fontSize: '14px' }}>
          <div className="prose prose-invert prose-blue max-w-none 
                          prose-headings:text-white prose-headings:font-medium 
                          prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2
                          prose-p:text-white/70 prose-p:leading-relaxed
                          prose-a:text-[#4A90E2] prose-a:no-underline hover:prose-a:underline
                          prose-li:text-white/70 prose-li:marker:text-[#4A90E2]
                          prose-strong:text-white prose-strong:font-semibold
                          prose-code:text-[#F27D26] prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdownContent}
            </ReactMarkdown>
          </div>
        </div>

      </div>
    </div>
  );
}
