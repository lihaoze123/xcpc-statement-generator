import type { FC } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faImages, faPlus, faTrash, faFilePdf, faFileCode, faBars, faLanguage, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ContestWithImages, Problem } from "@/types/contest";

interface SidebarProps {
  contestData: ContestWithImages;
  activeId: string;
  setActiveId: (id: string) => void;
  onAddProblem: () => void;
  onDeleteProblem: (key: string) => void;
  onExportPdf: () => void;
  onExportConfig: () => void;
  onImportConfig: () => void;
  onImportPolygon: () => void;
  onLoadExample: (key: string) => void;
  exportDisabled: boolean;
  toggleLanguage: () => void;
  examples: string[];
}

const SortableProblemItem: FC<{
  problem: Problem;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = ({ problem, index, isActive, onClick, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: problem.key! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md mb-1 transition-colors ${
        isActive ? 'bg-[#1D71B7] text-white' : 'hover:bg-gray-100 text-gray-700'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing ${isActive ? 'text-white/70' : 'text-gray-400'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <FontAwesomeIcon icon={faBars} className="text-xs" />
        </div>
        <span className="truncate">{String.fromCharCode(65 + index)}. {problem.problem.display_name}</span>
      </div>
      <button
        className={`p-1 rounded opacity-0 hover:opacity-100 ${isActive ? 'text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'}`}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{ opacity: isActive ? 1 : undefined }}
      >
        <FontAwesomeIcon icon={faTrash} className="text-xs" />
      </button>
    </div>
  );
};

const Sidebar: FC<SidebarProps> = ({
  contestData,
  activeId,
  setActiveId,
  onAddProblem,
  onDeleteProblem,
  onExportPdf,
  onExportConfig,
  onImportConfig,
  onImportPolygon,
  onLoadExample,
  exportDisabled,
  toggleLanguage,
  examples,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 custom-scroll">
        {/* Config Section */}
        <div className="mb-4">
          <div
            className={`px-3 py-2 cursor-pointer text-sm rounded-md mb-1 flex items-center gap-2 transition-colors ${activeId === 'config' ? 'bg-[#1D71B7] text-white' : 'hover:bg-gray-100 text-gray-700'}`}
            onClick={() => setActiveId('config')}
          >
            <FontAwesomeIcon icon={faCog} className="w-4" />
            <span>{t('editor:contestConfig')}</span>
          </div>
          <div
            className={`px-3 py-2 cursor-pointer text-sm rounded-md mb-1 flex items-center gap-2 transition-colors ${activeId === 'images' ? 'bg-[#1D71B7] text-white' : 'hover:bg-gray-100 text-gray-700'}`}
            onClick={() => setActiveId('images')}
          >
            <FontAwesomeIcon icon={faImages} className="w-4" />
            <span>{t('editor:imageManagement')}</span>
          </div>
        </div>

        {/* Problem List Section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-xs font-medium text-gray-500 uppercase">{t('editor:problemList')}</div>
            <button
              className="text-gray-400 hover:text-[#1D71B7] transition-colors p-1"
              onClick={onAddProblem}
              title={t('editor:addProblem')}
            >
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
            </button>
          </div>
          <SortableContext items={contestData.problems.map((p) => p.key!)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {contestData.problems.map((problem, index) => (
                <SortableProblemItem
                  key={problem.key}
                  problem={problem}
                  index={index}
                  isActive={activeId === problem.key}
                  onClick={() => setActiveId(problem.key!)}
                  onDelete={() => onDeleteProblem(problem.key!)}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 flex flex-col gap-2">
        <button
          className="btn btn-primary btn-sm w-full flex justify-center items-center gap-2"
          onClick={onExportPdf}
          disabled={exportDisabled}
        >
          <FontAwesomeIcon icon={faFilePdf} />
          <span>{t('common:exportPdf')}</span>
        </button>
        <div className="flex gap-2">
          <button
            className="btn btn-outline btn-sm flex-1 flex justify-center items-center gap-2 bg-white"
            onClick={onExportConfig}
          >
            <FontAwesomeIcon icon={faFileCode} />
            <span>{t('common:exportConfig')}</span>
          </button>
          <button
            className="btn btn-outline btn-sm w-10 flex justify-center items-center bg-white p-0"
            onClick={toggleLanguage}
            title={i18n.language === "zh" ? "English" : "中文"}
          >
            <FontAwesomeIcon icon={faLanguage} />
          </button>
        </div>

        {/* Settings Dropdown */}
        <div className="dropdown dropdown-top w-full">
          <button tabIndex={0} className="btn btn-ghost btn-sm w-full flex justify-center items-center gap-1 text-gray-500">
            <span>{t('common:settings')}</span>
            <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
          </button>
          <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-white rounded-lg w-full border border-gray-200 mt-1">
            <li className="menu-title px-2 py-1"><span>{t('common:loadExample')}</span></li>
            {examples.map((key) => (
              <li key={key}><a onClick={() => onLoadExample(key)} className="text-sm">{key}</a></li>
            ))}
            <li className="divider my-1"></li>
            <li><a onClick={onImportPolygon} className="text-sm">{t('common:importPolygonPackage')}</a></li>
            <li><a onClick={onImportConfig} className="text-sm">{t('common:importConfig')}</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
