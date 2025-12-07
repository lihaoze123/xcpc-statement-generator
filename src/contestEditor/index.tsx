import { type FC, useEffect, useState, useMemo, Suspense, use } from "react";
import { useImmer } from "use-immer";
import { App, Button, Space, Dropdown, Splitter } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileArrowDown, faFileImport, faFileExport, faChevronDown, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { debounce } from "lodash";

import type { ContestWithImages, ImageData } from "@/types/contest";
import { exampleStatements } from "./exampleStatements";
import { compileToPdf, typstInitPromise, registerImages } from "@/compiler";
import { saveConfigToDB, loadConfigFromDB, exportConfig, importConfig, clearDB, saveImageToDB } from "@/utils/indexedDBUtils";
import { loadPolygonPackage } from "@/utils/polygonConverter";
import ConfigPanel from "./ConfigPanel";
import Preview from "./Preview";

import "./index.css";

const ContestEditorImpl: FC<{ initialData: ContestWithImages }> = ({ initialData }) => {
  const [contestData, updateContestData] = useImmer<ContestWithImages>(initialData);
  const [exportDisabled, setExportDisabled] = useState(true);
  const { modal, notification, message } = App.useApp();

  // Debounced auto-save
  const debouncedSave = useMemo(() =>
    debounce(async (data: ContestWithImages) => {
      try { await saveConfigToDB(data); }
      catch (e) { console.error("Auto-save failed:", e); }
    }, 500),
    []
  );

  useEffect(() => { debouncedSave(contestData); }, [contestData, debouncedSave]);

  // Register images with compiler when images change
  useEffect(() => {
    registerImages(contestData.images).catch((e) =>
      console.error("Failed to register images:", e)
    );
  }, [contestData.images]);

  // Enable export after Typst init
  useEffect(() => {
    let mounted = true;
    typstInitPromise.then(() => { if (mounted) setExportDisabled(false); });
    return () => { mounted = false; };
  }, []);

  const handleLoadExample = async (key: string) => {
    const confirmed = await modal.confirm({
      title: "载入示例配置",
      content: "载入示例配置将覆盖当前所有配置，是否继续？",
      okText: "继续",
      cancelText: "取消",
    });
    if (!confirmed) return;

    // Revoke old blob URLs
    for (const img of contestData.images) {
      URL.revokeObjectURL(img.url);
    }

    const exampleData: ContestWithImages = { ...exampleStatements[key], images: [] };
    updateContestData(() => exampleData);
    await clearDB();
    await saveConfigToDB(exampleData);
    message.success("示例配置已载入");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const { data, images } = importConfig(text);

        // Revoke old blob URLs
        for (const img of contestData.images) {
          URL.revokeObjectURL(img.url);
        }

        // Create blob URLs for imported images and save to DB
        const imageList: ImageData[] = [];
        for (const imgMeta of data.images || []) {
          const blob = images.get(imgMeta.uuid);
          if (blob) {
            const url = URL.createObjectURL(blob);
            imageList.push({ uuid: imgMeta.uuid, name: imgMeta.name, url });
            await saveImageToDB(imgMeta.uuid, blob);
          }
        }

        const contestWithImages: ContestWithImages = {
          meta: data.meta,
          problems: data.problems,
          images: imageList,
        };

        updateContestData(() => contestWithImages);
        await saveConfigToDB(contestWithImages);
        message.success("配置导入成功");
      } catch (err) {
        (notification as any).open({
          type: "error",
          message: "导入失败",
          description: err instanceof Error ? err.message : String(err),
          placement: "bottomRight",
        });
      }
    };
    input.click();
  };

  const handleImportPolygonPackage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    // @ts-ignore - webkitdirectory is not in the type definition
    input.webkitdirectory = false;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const loadingMessage = message.loading("正在解析 Polygon 比赛包...", 0);
      try {
        // Revoke old blob URLs
        for (const img of contestData.images) {
          URL.revokeObjectURL(img.url);
        }

        const data = await loadPolygonPackage([file]);
        const contestWithImages: ContestWithImages = { ...data, images: [] };
        updateContestData(() => contestWithImages);
        await saveConfigToDB(contestWithImages);
        loadingMessage();
        message.success("Polygon 比赛包导入成功");
      } catch (err) {
        loadingMessage();
        (notification as any).open({
          type: "error",
          message: "导入失败",
          description: err instanceof Error ? err.message : String(err),
          placement: "bottomRight",
        });
      }
    };
    input.click();
  };

  const handleExport = async () => {
    try {
      const json = await exportConfig(contestData);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contestData.meta.title || "contest"}-config.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success("配置导出成功");
    } catch (err) {
      (notification as any).open({
        type: "error",
        message: "导出失败",
        description: err instanceof Error ? err.message : String(err),
        placement: "bottomRight",
      });
    }
  };

  const handleExportPdf = async () => {
    if (exportDisabled) return;
    setExportDisabled(true);
    try {
      const pdf = await compileToPdf(contestData);
      if (!pdf) throw new Error("编译返回空数据");

      const blob = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contestData.meta.title || "statement"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      (notification as any).open({
        type: "error",
        message: "PDF 导出失败",
        description: err instanceof Error ? err.message : String(err),
        placement: "bottomRight",
      });
    }
    setExportDisabled(false);
  };

  return (
    <div className="contest-editor">
      <div className="toolbar">
        <Space>
          <Dropdown
            menu={{
              items: Object.keys(exampleStatements).map((k) => ({ key: k, label: k })),
              onClick: ({ key }) => handleLoadExample(key),
            }}
            trigger={["click"]}
          >
            <Button>
              载入示例 <FontAwesomeIcon icon={faChevronDown} />
            </Button>
          </Dropdown>
          <Button icon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={handleImportPolygonPackage}>
            导入 Polygon 比赛包
          </Button>
          <Button icon={<FontAwesomeIcon icon={faFileImport} />} onClick={handleImport}>
            导入配置
          </Button>
          <Button icon={<FontAwesomeIcon icon={faFileExport} />} onClick={handleExport}>
            导出配置
          </Button>
          <Button
            type="primary"
            icon={<FontAwesomeIcon icon={faFileArrowDown} />}
            disabled={exportDisabled}
            onClick={handleExportPdf}
          >
            导出 PDF
          </Button>
        </Space>
      </div>

      <Splitter className="editor-body">
        <Splitter.Panel min={300} defaultSize="50%">
          <ConfigPanel contestData={contestData} updateContestData={updateContestData} />
        </Splitter.Panel>
        <Splitter.Panel min={300} collapsible>
          <Preview data={contestData} />
        </Splitter.Panel>
      </Splitter>
    </div>
  );
};

const ContestEditorWithPromise: FC<{ promise: Promise<ContestWithImages> }> = ({ promise }) => {
  const initialData = use(promise);
  return <ContestEditorImpl initialData={initialData} />;
};

const ContestEditor: FC = () => {
  const initialPromise = useMemo(() =>
    loadConfigFromDB()
      .then((stored) => {
        if (!stored) {
          return { ...exampleStatements.SupportedGrammar, images: [] } as ContestWithImages;
        }

        // Create blob URLs for loaded images
        const imageList: ImageData[] = [];
        for (const imgMeta of stored.data.images || []) {
          const blob = stored.images.get(imgMeta.uuid);
          if (blob) {
            const url = URL.createObjectURL(blob);
            imageList.push({ uuid: imgMeta.uuid, name: imgMeta.name, url });
          }
        }

        return {
          meta: stored.data.meta,
          problems: stored.data.problems,
          images: imageList,
        } as ContestWithImages;
      })
      .catch(() => ({ ...exampleStatements.SupportedGrammar, images: [] } as ContestWithImages)),
    []
  );

  return (
    <Suspense fallback={<div className="contest-editor loading">加载中...</div>}>
      <ContestEditorWithPromise promise={initialPromise} />
    </Suspense>
  );
};

export default ContestEditor;
