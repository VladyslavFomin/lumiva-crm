import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';

const TEAL = '#45a094';
const BTN_DARK = '#222222';

export type EmailRichEditorProps = {
  content: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
  className?: string;
  /** Светлая тема — окно «Написать»; тёмная — подпись в настройках аккаунта */
  variant?: 'light' | 'dark';
};

export const EmailRichEditor: React.FC<EmailRichEditorProps> = ({
  content,
  onChange,
  placeholder,
  className = '',
  variant = 'dark',
}) => {
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [
      // StarterKit v3 уже включает Link и Underline — не подключать их повторно
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: content || '<p></p>',
    editorProps: {
      attributes: {
        class:
          variant === 'light'
            ? 'prose max-w-none min-h-[140px] px-3 py-2 text-sm text-slate-900 focus:outline-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1'
            : 'prose prose-invert max-w-none min-h-[140px] px-3 py-2 text-sm text-slate-100 focus:outline-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML(), ed.getText({ blockSeparator: '\n' }));
    },
  });

  if (!editor) {
    return (
      <div
        className={`min-h-[140px] animate-pulse rounded-xl ${variant === 'light' ? 'bg-slate-100' : 'bg-slate-800/50'} ${className}`}
      />
    );
  }

  const btn = (active: boolean) => {
    if (variant === 'light') {
      return `rounded-lg px-2 py-1 text-[11px] font-medium transition ${
        active ? 'bg-slate-200 text-[#222]' : 'text-slate-600 hover:bg-slate-100'
      }`;
    }
    return `rounded-lg px-2 py-1 text-[11px] font-medium transition ${
      active ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
    }`;
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const wrap =
    variant === 'light'
      ? 'flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
      : 'flex flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-950/80';

  const toolbar =
    variant === 'light'
      ? 'flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1'
      : 'flex flex-wrap items-center gap-0.5 border-b border-slate-700/80 bg-slate-900/90 px-1.5 py-1';

  const sep = variant === 'light' ? 'mx-0.5 h-4 w-px bg-slate-300' : 'mx-0.5 h-4 w-px bg-slate-600';

  return (
    <div className={`${wrap} ${className}`}>
      <div className={toolbar}>
        <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
          {t('crm.email.richEditor.bold')}
        </button>
        <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          {t('crm.email.richEditor.italic')}
        </button>
        <button type="button" className={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          {t('crm.email.richEditor.underline')}
        </button>
        <button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}>
          S̶
        </button>
        <span className={sep} />
        <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </button>
        <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </button>
        <span className={sep} />
        <button type="button" className={btn(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          ≡
        </button>
        <button type="button" className={btn(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          ≡
        </button>
        <button type="button" className={btn(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          ≡
        </button>
        <span className={sep} />
        <button type="button" className={btn(editor.isActive('link'))} onClick={setLink}>
          🔗
        </button>
        <button
          type="button"
          className={btn(false)}
          style={{ color: variant === 'light' ? BTN_DARK : TEAL }}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().undo().run()}>
          ↺
        </button>
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().redo().run()}>
          ↻
        </button>
      </div>
      <EditorContent
        editor={editor}
        className={`tiptap-email max-h-[min(40vh,320px)] min-h-[120px] overflow-y-auto ${variant === 'light' ? 'bg-white' : ''}`}
      />
    </div>
  );
};
