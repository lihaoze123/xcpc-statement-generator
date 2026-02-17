import { type FC, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faPlus, faFilePdf, faPenToSquare, faImages, faTrash, faEdit } from "@fortawesome/free-solid-svg-icons";
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
}

// 简化的题目项组件
const ProblemItem: FC<{
  problem: Problem;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = ({ problem, index, isActive, onClick, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: problem.key! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
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
        onContextMenu={handleContextMenu}
        title={`Problem ${String.fromCharCode(65 + index)}: ${problem.problem.display_name}`}
      >
        {String.fromCharCode(65 + index)}
      </div>
      {/* Context Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute left-12 top-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[120px]">
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => { onClick(); setShowMenu(false); }}
            >
              <FontAwesomeIcon icon={faEdit} className="w-4" />
              <span>编辑</span>
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-500"
              onClick={() => { onDelete(); setShowMenu(false); }}
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
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top: Contest Config */}
      <div className="flex justify-center py-2 border-b border-gray-100">
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
      </div>

      {/* Middle: Problem List */}
      <div className="flex-1 overflow-y-auto py-2 custom-scroll">
        <SortableContext items={contestData.problems.map((p) => p.key!)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col">
            {contestData.problems.map((problem, index) => (
              <ProblemItem
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
    </div>
  );
};

export default Sidebar;
