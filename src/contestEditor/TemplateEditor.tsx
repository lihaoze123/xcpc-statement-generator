import { type FC, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight, faSave } from "@fortawesome/free-solid-svg-icons";
import TypstTemplateLib from "typst-template/lib.typ?raw";
import { insertFourSpaces, outdentFourSpaces } from "@/utils/codemirrorTab";

interface TemplateEditorProps {
  template: string | undefined;
  onSave: (template: string) => void;
  onClose: () => void;
}

const TemplateEditor: FC<TemplateEditorProps> = ({ template, onSave }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(template || TypstTemplateLib);
  const [showDefault, setShowDefault] = useState(false);

  const handleReset = () => {
    setContent(TypstTemplateLib);
  };

  const handleSave = () => {
    onSave(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{t('editor:templateEditor')}</h2>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-md flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors"
            onClick={() => setShowDefault(!showDefault)}
          >
            {showDefault ? t('editor:hideDefaultTemplate') : t('editor:showDefaultTemplate')}
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors"
            onClick={handleReset}
          >
            <FontAwesomeIcon icon={faRotateRight} />
            {t('editor:resetToDefault')}
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md flex items-center gap-2 bg-[#1D71B7] text-white hover:bg-[#1a5ea4] transition-colors"
            onClick={handleSave}
          >
            <FontAwesomeIcon icon={faSave} />
            {t('common:save')}
          </button>
        </div>
      </div>

      {/* Default template reference */}
      {showDefault && (
        <div className="mb-3 p-3 bg-gray-50 rounded-md max-h-[200px] overflow-auto">
          <h3 className="text-sm font-medium mb-2 text-gray-600">{t('editor:defaultTemplate')}</h3>
          <pre className="text-xs font-mono whitespace-pre-wrap">{TypstTemplateLib}</pre>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 border border-gray-200 rounded-md overflow-hidden">
        <CodeMirror
          value={content}
          height="100%"
          extensions={[
            markdown(),
            Prec.highest(keymap.of([
              { key: "Tab", run: insertFourSpaces, preventDefault: true },
              { key: "Shift-Tab", run: outdentFourSpaces, preventDefault: true },
            ])),
          ]}
          onChange={(value) => setContent(value)}
          className="h-full"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>

      {/* Help text */}
      <div className="mt-2 p-3 bg-blue-50 rounded-md text-xs text-gray-600">
        <p className="font-medium mb-1">contest-conf 参数说明：</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><code>title</code> - 比赛标题</li>
          <li><code>subtitle</code> - 副标题（默认：试题册）</li>
          <li><code>author</code> - 作者/主办方</li>
          <li><code>date</code> - 比赛日期</li>
          <li><code>problems</code> - 题目数组，每个包含 problem 和 statement</li>
          <li><code>language</code> - 语言 (zh/en)</li>
          <li><code>enable-titlepage</code> - 是否生成标题页</li>
          <li><code>enable-header-footer</code> - 是否显示页眉页脚</li>
          <li><code>enable-problem-list</code> - 是否显示题号列表</li>
        </ul>
      </div>
    </div>
  );
};

export default TemplateEditor;
