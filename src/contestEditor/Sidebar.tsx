import { type FC, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faPlus, faFilePdf, faPenToSquare, faImages, faTrash, faEdit, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
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
  exportDisabled: boolean;
  onOpenSettings: () => void;
  onOpenImages: () => void;
  previewVisible: boolean;
  onTogglePreview: () => void;
}

// 简化的题目项组件
const ProblemItem: FC<{
  problem: Problem;
  index: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ problem, index, isActive, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: problem.key! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div className="relative">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`
          flex items-center justify-center w-10 h-10 mx-auto my-0.5 rounded-md cursor-grab active:cursor-grabbing
          transition-all duration-150 text-sm font-medium select-none border-2
          ${isActive
            ? 'border-[#1D71B7] text-[#1D71B7]'
            : 'border-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }
        `}
        onClick={onClick}
        title={`Problem ${String.fromCharCode(65 + index)}: ${problem.problem.display_name}`}
      >
        {String.fromCharCode(65 + index)}
      </div>
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
  exportDisabled,
  onOpenSettings,
  onOpenImages,
  previewVisible,
  onTogglePreview,
}) => {
  const { t } = useTranslation();
  const [menuState, setMenuState] = useState<{ open: boolean; x: number; y: number; problemKey: string }>({
    open: false,
    x: 0,
    y: 0,
    problemKey: "",
  });

  const handleContextMenu = (e: React.MouseEvent, problemKey: string) => {
    e.preventDefault();
    setMenuState({ open: true, x: e.clientX, y: e.clientY, problemKey });
  };

  const closeMenu = () => setMenuState((s) => ({ ...s, open: false }));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top: Contest Config + Preview Toggle */}
      <div className="flex flex-col items-center py-2 border-b border-gray-100 gap-1">
        <button
          className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors select-none border-2 ${
            activeId === 'config'
              ? 'border-[#1D71B7] text-[#1D71B7]'
              : 'border-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }`}
          onClick={() => setActiveId('config')}
          title={t('editor:contestConfig')}
        >
          <FontAwesomeIcon icon={faPenToSquare} className="text-lg" />
        </button>
        <button
          className="w-10 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors select-none"
          onClick={onTogglePreview}
          title={previewVisible ? t('editor:hidePreview') : t('editor:showPreview')}
        >
          <FontAwesomeIcon icon={previewVisible ? faEye : faEyeSlash} className="text-base" />
        </button>
      </div>

      {/* Middle: Problem List */}
      <div className="flex-1 overflow-y-auto py-2 custom-scroll">
        <SortableContext items={contestData.problems.map((p) => p.key!)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col">
            {contestData.problems.map((problem, index) => (
              <div key={problem.key} onContextMenu={(e) => handleContextMenu(e, problem.key!)}>
                <ProblemItem
                  problem={problem}
                  index={index}
                  isActive={activeId === problem.key}
                  onClick={() => { setActiveId(problem.key!); closeMenu(); }}
                />
              </div>
            ))}
          </div>
        </SortableContext>

        {/* Add Problem */}
        <div className="flex justify-center py-2 mt-1">
          <button
            className="w-10 h-10 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1D71B7] transition-colors select-none"
            onClick={onAddProblem}
            title={t('editor:addProblem')}
          >
            <FontAwesomeIcon icon={faPlus} className="text-base" />
          </button>
        </div>
      </div>

      {/* Bottom: Actions */}
      <div className="flex flex-col items-center gap-1 py-2 border-t border-gray-100">
        <button
          className="w-10 h-10 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50 select-none"
          onClick={onExportPdf}
          disabled={exportDisabled}
          title={t('common:exportPdf')}
        >
          <FontAwesomeIcon icon={faFilePdf} className="text-lg" />
        </button>
        <button
          className="w-10 h-10 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors select-none"
          onClick={onOpenImages}
          title={t('editor:imageManagement')}
        >
          <FontAwesomeIcon icon={faImages} className="text-lg" />
        </button>
        <button
          className="w-10 h-10 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors select-none"
          onClick={onOpenSettings}
          title={t('common:settings')}
        >
          <FontAwesomeIcon icon={faGear} className="text-lg" />
        </button>
      </div>

      {/* Context Menu */}
      {menuState.open && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[120px]"
            style={{ left: menuState.x, top: menuState.y }}
          >
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => { setActiveId(menuState.problemKey); closeMenu(); }}
            >
              <FontAwesomeIcon icon={faEdit} className="w-4" />
              <span>编辑</span>
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-500"
              onClick={() => { onDeleteProblem(menuState.problemKey); closeMenu(); }}
            >
              <FontAwesomeIcon icon={faTrash} className="w-4" />
              <span>删除</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;
