import { type FC, useEffect, useState, useMemo, Suspense, use } from "react";
import { useImmer } from "use-immer";
import { App, Button, Space, Dropdown, Splitter } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileArrowDown, faFileImport, faFileExport, faChevronDown, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
      title: t('messages:loadExampleConfirm.title'),
      content: t('messages:loadExampleConfirm.content'),
      okText: t('common:continue'),
      cancelText: t('common:cancel'),
    });
    if (!confirmed) return;

    // Revoke old blob URLs
    for (const img of contestData.images) {
      URL.revokeObjectURL(img.url);
    }

    const problemsWithKeys = exampleStatements[key].problems.map((problem) => ({
      ...problem,
      key: problem.key || crypto.randomUUID(),
    }));

    const exampleData: ContestWithImages = {
      ...exampleStatements[key],
      problems: problemsWithKeys,
      images: []
    };
    updateContestData(() => exampleData);
    await clearDB();
    await saveConfigToDB(exampleData);
    message.success(t('messages:exampleLoaded'));
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

        const problemsWithKeys = data.problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));

        const contestWithImages: ContestWithImages = {
          meta: data.meta,
          problems: problemsWithKeys,
          images: imageList,
        };

        // Register images with compiler first to avoid race condition
        await registerImages(imageList);

        updateContestData(() => contestWithImages);
        await saveConfigToDB(contestWithImages);
        message.success(t('messages:configImportSuccess'));
      } catch (err) {
        (notification as any).open({
          type: "error",
          message: t('messages:importFailed'),
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

      const loadingMessage = message.loading(t('messages:parsingPolygonPackage'), 0);
      try {
        // Revoke old blob URLs
        for (const img of contestData.images) {
          URL.revokeObjectURL(img.url);
        }

        const data = await loadPolygonPackage([file]);

        const problemsWithKeys = data.problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));

        const contestWithImages: ContestWithImages = {
          ...data,
          problems: problemsWithKeys,
          images: []
        };
        updateContestData(() => contestWithImages);
        await saveConfigToDB(contestWithImages);
        loadingMessage();
        message.success(t('messages:polygonImportSuccess'));
      } catch (err) {
        loadingMessage();
        (notification as any).open({
          type: "error",
          message: t('messages:importFailed'),
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
      message.success(t('messages:configExportSuccess'));
    } catch (err) {
      (notification as any).open({
        type: "error",
        message: t('messages:exportFailed'),
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
      if (!pdf) throw new Error(t('messages:compilationError'));

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
        message: t('messages:pdfExportFailed'),
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
              {t('common:loadExample')} <FontAwesomeIcon icon={faChevronDown} />
            </Button>
          </Dropdown>
          <Button icon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={handleImportPolygonPackage}>
            {t('common:importPolygonPackage')}
          </Button>
          <Button icon={<FontAwesomeIcon icon={faFileImport} />} onClick={handleImport}>
            {t('common:importConfig')}
          </Button>
          <Button icon={<FontAwesomeIcon icon={faFileExport} />} onClick={handleExport}>
            {t('common:exportConfig')}
          </Button>
          <Button
            type="primary"
            icon={<FontAwesomeIcon icon={faFileArrowDown} />}
            disabled={exportDisabled}
            onClick={handleExportPdf}
          >
            {t('common:exportPdf')}
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
      .then(async (stored) => {
        if (!stored) {
          const problemsWithKeys = exampleStatements["English Example"].problems.map((problem) => ({
            ...problem,
            key: problem.key || crypto.randomUUID(),
          }));
          return {
            ...exampleStatements["English Example"],
            problems: problemsWithKeys,
            images: []
          } as ContestWithImages;
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

        const problemsWithKeys = stored.data.problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));

        const contestWithImages = {
          meta: stored.data.meta,
          problems: problemsWithKeys,
          images: imageList,
        } as ContestWithImages;

        // Register images with compiler first to avoid race condition
        await registerImages(imageList);

        return contestWithImages;
      })
      .catch(() => {
        const problemsWithKeys = exampleStatements["English Example"].problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));
        return {
          ...exampleStatements["English Example"],
          problems: problemsWithKeys,
          images: []
        } as ContestWithImages;
      }),
    []
  );

  return (
    <Suspense fallback={<div className="contest-editor loading"><LoadingFallback /></div>}>
      <ContestEditorWithPromise promise={initialPromise} />
    </Suspense>
  );
};

const LoadingFallback = () => {
  const { t } = useTranslation();
  return <>{t('common:loading')}</>;
};

export default ContestEditor;
