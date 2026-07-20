import { type FC } from "react";
import { useTranslation } from "react-i18next";
import type { ContestWithImages } from "@/types/contest";
import { useToast } from "./ToastProvider";

interface ProblemMergeDialogProps {
  isOpen: boolean;
  conflicts: Array<{
    index: number;
    local?: ContestWithImages['problems'][0];
    cloud?: ContestWithImages['problems'][0];
  }>;
  selectedChoices: Record<number, "local" | "cloud">;
  rememberChoices: Record<number, boolean>;
  onSelectedChoicesChange: (choices: Record<number, "local" | "cloud">) => void;
  onRememberChoicesChange: (remember: Record<number, boolean>) => void;
  onConfirm: (choices: Record<number, "local" | "cloud">) => void;
  onCancel: () => void;
  onRemembered: (choices: Record<number, "local" | "cloud">) => void;
  getProblemDetail: (problem?: ContestWithImages['problems'][0]) => {
    title: string;
    format: string;
    samples: number;
    description: string;
    input: string;
    output: string;
    notes: string;
  } | null;
}

const ProblemMergeDialog: FC<ProblemMergeDialogProps> = ({
  isOpen,
  conflicts,
  selectedChoices,
  rememberChoices,
  onSelectedChoicesChange,
  onRememberChoicesChange,
  onConfirm,
  onCancel,
  onRemembered,
  getProblemDetail,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleConfirm = () => {
    const missing = conflicts.some((conflict) => !selectedChoices[conflict.index]);
    if (missing) {
      showToast("请先选择每道题目的版本", "error");
      return;
    }
    const toRemember: Record<number, "local" | "cloud"> = {};
    for (const conflict of conflicts) {
      if (rememberChoices[conflict.index] && selectedChoices[conflict.index]) {
        toRemember[conflict.index] = selectedChoices[conflict.index];
      }
    }
    onRemembered(toRemember);
    onSelectedChoicesChange({});
    onRememberChoicesChange({});
    onConfirm(selectedChoices);
  };

  const handleClose = () => {
    onSelectedChoicesChange({});
    onRememberChoicesChange({});
    onCancel();
  };

  const handleSelectAllLocal = () => {
    const allLocal: Record<number, "local" | "cloud"> = {};
    for (const conflict of conflicts) {
      allLocal[conflict.index] = "local";
    }
    onSelectedChoicesChange(allLocal);
  };

  const handleSelectAllCloud = () => {
    const allCloud: Record<number, "local" | "cloud"> = {};
    for (const conflict of conflicts) {
      allCloud[conflict.index] = "cloud";
    }
    onSelectedChoicesChange(allCloud);
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg">检测到题目冲突</h3>
        <p className="py-2 text-sm text-gray-600">请选择每道题目使用云端版本或本地版本。</p>
        <div className="max-h-[50vh] overflow-y-auto space-y-4">
          {conflicts.map((conflict) => {
            const indexLabel = String.fromCharCode(65 + conflict.index);
            const localDetail = getProblemDetail(conflict.local);
            const cloudDetail = getProblemDetail(conflict.cloud);
            const selectedChoice = selectedChoices[conflict.index];
            return (
              <div key={conflict.index} className="border rounded-lg p-5 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">题目 {indexLabel}</div>
                  <div className="flex items-center gap-2">
                    {selectedChoice && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={!!rememberChoices[conflict.index]}
                          onChange={(e) =>
                            onRememberChoicesChange({ ...rememberChoices, [conflict.index]: e.target.checked })
                          }
                        />
                        <span>记住此选择</span>
                        <span
                          className="text-gray-400 cursor-help leading-none"
                          title="仅在本页面会话中有效，刷新或新开页面后将失效"
                        >ⓘ</span>
                      </label>
                    )}
                    {selectedChoice && (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => {
                          const newChoices = { ...selectedChoices };
                          delete newChoices[conflict.index];
                          onSelectedChoicesChange(newChoices);
                          const newRemember = { ...rememberChoices };
                          delete newRemember[conflict.index];
                          onRememberChoicesChange(newRemember);
                        }}
                      >
                        取消选择
                      </button>
                    )}
                  </div>
                </div>
                <div className={`${selectedChoice ? "grid grid-cols-1" : "grid grid-cols-2"} gap-5 text-sm`}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectedChoicesChange({ ...selectedChoices, [conflict.index]: "local" });
                    }}
                    className={`group text-left rounded-lg border p-5 transform-gpu origin-center transition-[transform,box-shadow,background-color,border-color] duration-220 ease-out ${
                      selectedChoice === "local"
                        ? "border-gray-500 bg-gray-100 shadow-sm col-span-2"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                    } ${selectedChoice === "local" ? "scale-[1.02] ring-1 ring-gray-300 shadow-md" : ""} ${
                      selectedChoice && selectedChoice !== "local" ? "hidden" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-700">本地版本</div>
                    <div className="text-gray-600">
                      {conflict.local ? conflict.local.problem.display_name : "（本地无）"}
                    </div>
                    {selectedChoice === "local" && (
                      <div className="mt-4 text-xs text-gray-500 space-y-1">
                        <div>格式：{localDetail?.format || "-"} · 样例：{localDetail?.samples ?? 0}</div>
                        <div>描述：{localDetail?.description ? `${localDetail.description.slice(0, 80)}...` : "-"}</div>
                        {localDetail?.input && <div>输入：{localDetail.input.slice(0, 60)}...</div>}
                        {localDetail?.output && <div>输出：{localDetail.output.slice(0, 60)}...</div>}
                        {localDetail?.notes && <div>备注：{localDetail.notes.slice(0, 60)}...</div>}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectedChoicesChange({ ...selectedChoices, [conflict.index]: "cloud" });
                    }}
                    className={`group text-left rounded-lg border p-5 transform-gpu origin-center transition-[transform,box-shadow,background-color,border-color] duration-220 ease-out ${
                      selectedChoice === "cloud"
                        ? "border-gray-500 bg-gray-100 shadow-sm col-span-2"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                    } ${selectedChoice === "cloud" ? "scale-[1.02] ring-1 ring-gray-300 shadow-md" : ""} ${
                      selectedChoice && selectedChoice !== "cloud" ? "hidden" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-700">云端版本</div>
                    <div className="text-gray-600">
                      {conflict.cloud ? conflict.cloud.problem.display_name : "（云端无）"}
                    </div>
                    {selectedChoice === "cloud" && (
                      <div className="mt-4 text-xs text-gray-500 space-y-1">
                        <div>格式：{cloudDetail?.format || "-"} · 样例：{cloudDetail?.samples ?? 0}</div>
                        <div>描述：{cloudDetail?.description ? `${cloudDetail.description.slice(0, 80)}...` : "-"}</div>
                        {cloudDetail?.input && <div>输入：{cloudDetail.input.slice(0, 60)}...</div>}
                        {cloudDetail?.output && <div>输出：{cloudDetail.output.slice(0, 60)}...</div>}
                        {cloudDetail?.notes && <div>备注：{cloudDetail.notes.slice(0, 60)}...</div>}
                      </div>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="modal-action flex justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleSelectAllLocal}
            >
              全选本地版本
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleSelectAllCloud}
            >
              全选云端版本
            </button>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              onClick={handleClose}
            >
              {t('common:cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
            >
              {t('common:continue')}
            </button>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop"
        onClick={handleClose}
      ></div>
    </div>
  );
};

export default ProblemMergeDialog;
