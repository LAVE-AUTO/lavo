'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import DOMPurify from 'dompurify';

interface Props {
  pageKey: string;
  html: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-bold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B]/40',
        active
          ? 'bg-[#001201] text-[#FFF9EC] shadow-[0_6px_12px_rgba(26,26,10,0.18)] dark:bg-[#FFF9EC] dark:text-[#001201]'
          : 'text-[#5A554B] hover:bg-[#EFE8D7] hover:text-[#001201] dark:text-[#A6A091] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]',
        'disabled:cursor-not-allowed disabled:opacity-40',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 inline-block h-5 w-px bg-[#E1DBCF] dark:bg-[#001A05]" aria-hidden="true" />;
}

/**
 * Returns the HTML body content normalized and sanitized for comparison
 * (Tiptap may emit empty-doc markup like '<p></p>' for blank input).
 */
function normalize(html: string): string {
  const trimmed = (html ?? '').trim();
  if (trimmed === '' || trimmed === '<p></p>' || trimmed === '<p><br></p>') return '';
  return DOMPurify.sanitize(trimmed);
}

function Toolbar({ editor, t }: { editor: Editor; t: ReturnType<typeof useTranslations<'admin_legal'>> }) {
  function handleLink() {
    const previous = editor.getAttributes('link').href ?? '';
    const url = typeof window !== 'undefined' ? window.prompt(t('toolbar_link_prompt'), previous) : null;
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const safe = /^(https?:|mailto:|tel:)/.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe, target: '_blank', rel: 'noopener noreferrer ugc' }).run();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-[#E7E1D5] bg-[#FCFBF8]/95 px-3 py-2 backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/95">

      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })} label={t('toolbar_h2')}>
        H2
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })} label={t('toolbar_h3')}>
        H3
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph')} label={t('toolbar_paragraph')}>
        ¶
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')} label={t('toolbar_bold')}>
        <span className="font-extrabold">B</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')} label={t('toolbar_italic')}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')} label={t('toolbar_underline')}>
        <span className="underline underline-offset-2">U</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')} label={t('toolbar_strike')}>
        <span className="line-through">S</span>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')} label={t('toolbar_ul')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3.5" cy="6" r="1.5" fill="currentColor" /><circle cx="3.5" cy="12" r="1.5" fill="currentColor" /><circle cx="3.5" cy="18" r="1.5" fill="currentColor" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')} label={t('toolbar_ol')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
          <path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')} label={t('toolbar_blockquote')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21v-7a4 4 0 0 1 4-4" /><path d="M14 21v-7a4 4 0 0 1 4-4" />
          <path d="M3 14h4v-4H3z" /><path d="M14 14h4v-4h-4z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')} label={t('toolbar_code')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })} label={t('toolbar_align_left')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })} label={t('toolbar_align_center')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })} label={t('toolbar_align_right')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={handleLink}
        active={editor.isActive('link')} label={t('toolbar_link')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label={t('toolbar_hr')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6"  x2="6"  y2="6"  /><line x1="18" y1="6"  x2="21" y2="6"  /><line x1="3" y1="18" x2="6"  y2="18" /><line x1="18" y1="18" x2="21" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} label={t('toolbar_clear')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 3h5v5" /><path d="M21 3l-7 7" /><path d="M8 21H3v-5" /><path d="M3 21l7-7" />
        </svg>
      </ToolbarButton>

      <div className="ml-auto inline-flex items-center gap-0.5">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()} label={t('toolbar_undo')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13" />
          </svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()} label={t('toolbar_redo')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 13" />
          </svg>
        </ToolbarButton>
      </div>
    </div>
  );
}

export function LegalEditor({ pageKey, html, onChange, disabled = false, placeholder }: Props) {
  const t = useTranslations('admin_legal');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      bulletList: { keepMarks: true, keepAttributes: false },
      orderedList: { keepMarks: true, keepAttributes: false },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer ugc', target: '_blank', class: 'text-[#9A7A13] underline underline-offset-2' },
    }),
    Placeholder.configure({ placeholder: placeholder ?? t('editor_placeholder') }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
  ], [placeholder, t]);

  const editor = useEditor({
    extensions,
    content: html,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: [
          'tiptap min-h-[420px] max-h-[640px] overflow-y-auto p-6 text-[14px] leading-[1.7] outline-none',
          'text-[#001201] dark:text-[#FFF9EC]',
          'prose prose-sm max-w-none',
          '[&_h1]:text-[22px] [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-[#001201] dark:[&_h1]:text-[#FFF9EC]',
          '[&_h2]:text-[18px] [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:mt-5 [&_h2]:mb-2.5 [&_h2]:text-[#001201] dark:[&_h2]:text-[#FFF9EC]',
          '[&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-[#001201] dark:[&_h3]:text-[#FFF9EC]',
          '[&_p]:mb-3',
          '[&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc',
          '[&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal',
          '[&_li]:mb-1',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-[#DDAF3B] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#5A554B] dark:[&_blockquote]:text-[#A6A091] [&_blockquote]:my-4',
          '[&_a]:text-[#9A7A13] [&_a]:underline [&_a]:underline-offset-2',
          '[&_code]:bg-[#FFF9EC] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12.5px] [&_code]:font-mono dark:[&_code]:bg-[#171F12]',
          '[&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#E1DBCF] [&_hr]:my-6 dark:[&_hr]:border-[#001A05]',
          '[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:text-[#BBB6A7] [&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:h-0',
        ].join(' '),
        'aria-label': t('editor_aria_label'),
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const next = normalize(ed.getHTML());
      onChange(next);
    },
  });

  /* Reset editor content when switching pages */
  useEffect(() => {
    if (!editor) return;
    const current = normalize(editor.getHTML());
    const incoming = normalize(html);
    if (current !== incoming) {
      editor.commands.setContent(incoming || '', { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, editor]);

  /* Toggle editable state */
  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#E1DBCF] bg-white shadow-[0_4px_12px_rgba(26,26,10,0.04)] dark:border-[#1E2E18] dark:bg-[#0E170C]">
      {!mounted || !editor ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
        </div>
      ) : (
        <>
          <Toolbar editor={editor} t={t} />
          <EditorContent editor={editor} />
        </>
      )}
    </div>
  );
}
