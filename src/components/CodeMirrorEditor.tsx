import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { vim } from "@replit/codemirror-vim";

import "./CodeMirrorEditor.css";

interface CodeMirrorEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: "markdown" | "latex" | "typst" | "plaintext";
  placeholder?: string;
  minHeight?: string;
  vimMode?: boolean;
  showLineNumbers?: boolean;
}

const getLanguageExtension = (lang: string) => {
  switch (lang) {
    case "markdown": return markdown();
    case "latex": return markdown(); // Use markdown with LaTeX math support
    case "typst": return markdown(); // Use markdown with LaTeX math support
    default: return [];
  }
};

const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  language,
  minHeight = "200px",
  vimMode = false,
  showLineNumbers = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef<typeof onChange>(onChange);
  const isApplyingExternalValueRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      if (isApplyingExternalValueRef.current) {
        isApplyingExternalValueRef.current = false;
        return;
      }
      onChangeRef.current?.(update.state.doc.toString());
    });

    const extensions: any[] = [
      showLineNumbers ? lineNumbers() : null,
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),
      drawSelection(),
      history(),
      getLanguageExtension(language),
      updateListener,
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { minHeight },
        ".cm-scroller": { overflow: "auto" },
        ".cm-content": { fontSize: "14px", fontFamily: "monospace" },
      }),
    ].filter((ext): ext is any => ext !== null);

    if (vimMode) {
      extensions.unshift(vim());
    } else {
      extensions.push(keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [language, vimMode, minHeight, showLineNumbers]);

  // Update content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        isApplyingExternalValueRef.current = true;
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value }
        });
      }
    }
  }, [value]);

  return <div ref={containerRef} className="codemirror-container border border-gray-300 rounded-lg overflow-hidden" />;
};

export default CodeMirrorEditor;
