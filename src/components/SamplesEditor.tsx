import { useState } from "react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import CodeMirrorEditor from "./CodeMirrorEditor";
import type { Sample } from "@/types/contest";

interface SamplesEditorProps {
  samples: Sample[];
  onUpdate: (samples: Sample[]) => void;
  vimMode?: boolean;
}

const SamplesEditor: FC<SamplesEditorProps> = ({ samples, onUpdate, vimMode = false }) => {
  const { t } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handleAddSample = () => {
    onUpdate([...samples, { input: "", output: "" }]);
    setExpandedIndex(samples.length);
  };

  const handleDeleteSample = (index: number) => {
    const newSamples = samples.filter((_, i) => i !== index);
    onUpdate(newSamples);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleUpdateSample = (index: number, field: "input" | "output", value: string) => {
    const newSamples = [...samples];
    newSamples[index] = { ...newSamples[index], [field]: value };
    onUpdate(newSamples);
  };

  return (
    <div className="space-y-4">
      {samples.map((sample, index) => (
        <div key={index}>
          <div
            className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-50 rounded"
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <span className="font-medium text-sm text-gray-700">
              {t('editor:sampleNumber', { number: index + 1 })}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-xs text-gray-400 hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); handleDeleteSample(index); }}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <FontAwesomeIcon
                icon={expandedIndex === index ? faChevronUp : faChevronDown}
                className="text-gray-400 w-3"
              />
            </div>
          </div>
          {expandedIndex === index && (
            <div className="space-y-2 pt-2">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('editor:input')}</label>
                <CodeMirrorEditor
                  value={sample.input}
                  onChange={(val) => handleUpdateSample(index, "input", val)}
                  language="plaintext"
                  minHeight="120px"
                  vimMode={vimMode}
                  showLineNumbers={true}
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('editor:output')}</label>
                <CodeMirrorEditor
                  value={sample.output}
                  onChange={(val) => handleUpdateSample(index, "output", val)}
                  language="plaintext"
                  minHeight="120px"
                  vimMode={vimMode}
                  showLineNumbers={true}
                />
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        className="btn btn-ghost btn-sm"
        onClick={handleAddSample}
      >
        <FontAwesomeIcon icon={faPlus} className="mr-1" />
        {t('editor:addSample')}
      </button>
    </div>
  );
};

export default SamplesEditor;
