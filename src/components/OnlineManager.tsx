import { type FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faX,
  faCloudArrowUp,
  faCloudArrowDown,
  faGear,
} from "@fortawesome/free-solid-svg-icons";
import type { OnlineSyncConfig, OnlineSyncSettings, ContestWithImages } from "@/types/contest";
import {
  uploadToOnline,
  downloadFromOnline,
  testConnection,
  checkOnlineExists,
} from "@/utils/onlineSync";
import { getAllVersions, getAllBranches, saveVersion, saveBranch } from "@/utils/versionControl";
import { saveConfigToDB, saveImageToDB } from "@/utils/indexedDBUtils";
import { useToast } from "./ToastProvider";

interface OnlineManagerProps {
  isOpen: boolean;
  onClose: () => void;
  contestData: ContestWithImages;
  onDataImported: (data: ContestWithImages) => void;
  onSyncComplete?: (syncedAt: number) => void;
}

const OnlineManager: FC<OnlineManagerProps> = ({
  isOpen,
  onClose,
  contestData,
  onDataImported,
  onSyncComplete,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // 状�?
  const [settings, setSettings] = useState<OnlineSyncSettings>({
    enabled: false,
    autoSync: false,
    config: null,
    lastSyncTime: undefined,
  });

  const [showConfig, setShowConfig] = useState(false);
  const [platform, setPlatform] = useState<"cos" | "oss" | "github" | "r2">("cos");
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showConflictPrompt, setShowConflictPrompt] = useState(false);
  const conflictResolverRef = useRef<((choice: "cloud" | "local" | "cancel") => void) | null>(null);

  // COS 配置
  const [cosSecretId, setCosSecretId] = useState("");
  const [cosSecretKey, setCosSecretKey] = useState("");
  const [cosBucket, setCosBucket] = useState("");
  const [cosRegion, setCosRegion] = useState("");

  // OSS 配置
  const [ossAccessKeyId, setOssAccessKeyId] = useState("");
  const [ossAccessKeySecret, setOssAccessKeySecret] = useState("");
  const [ossBucket, setOssBucket] = useState("");
  const [ossRegion, setOssRegion] = useState("");

  // GitHub 配置
  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubDirectory, setGithubDirectory] = useState("");

  // Cloudflare R2 配置
  const [r2AccessKeyId, setR2AccessKeyId] = useState("");
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState("");
  const [r2Bucket, setR2Bucket] = useState("");
  const [r2AccountId, setR2AccountId] = useState("");

  const readConfigCache = () => {
    try {
      return JSON.parse(localStorage.getItem("onlineSyncConfigCache") || "{}") as Record<string, any>;
    } catch {
      return {} as Record<string, any>;
    }
  };

  const writeConfigCache = (cache: Record<string, any>) => {
    localStorage.setItem("onlineSyncConfigCache", JSON.stringify(cache));
  };

  const snapshotCurrentPlatform = () => {
    switch (platform) {
      case "cos":
        return { secretId: cosSecretId, secretKey: cosSecretKey, bucket: cosBucket, region: cosRegion };
      case "oss":
        return { accessKeyId: ossAccessKeyId, accessKeySecret: ossAccessKeySecret, bucket: ossBucket, region: ossRegion };
      case "github":
        return { token: githubToken, repo: githubRepo, directory: githubDirectory };
      case "r2":
        return { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket: r2Bucket, accountId: r2AccountId };
    }
  };

  const applyPlatformDraft = (nextPlatform: "cos" | "oss" | "github" | "r2", draft?: any) => {
    if (nextPlatform === "cos") {
      setCosSecretId(draft?.secretId || "");
      setCosSecretKey(draft?.secretKey || "");
      setCosBucket(draft?.bucket || "");
      setCosRegion(draft?.region || "");
    } else if (nextPlatform === "oss") {
      setOssAccessKeyId(draft?.accessKeyId || "");
      setOssAccessKeySecret(draft?.accessKeySecret || "");
      setOssBucket(draft?.bucket || "");
      setOssRegion(draft?.region || "");
    } else if (nextPlatform === "github") {
      setGithubToken(draft?.token || "");
      setGithubRepo(draft?.repo || "");
      setGithubDirectory(draft?.directory || "");
    } else if (nextPlatform === "r2") {
      setR2AccessKeyId(draft?.accessKeyId || "");
      setR2SecretAccessKey(draft?.secretAccessKey || "");
      setR2Bucket(draft?.bucket || "");
      setR2AccountId(draft?.accountId || "");
    }
  };

  const handlePlatformChange = (nextPlatform: "cos" | "oss" | "github" | "r2") => {
    const cache = readConfigCache();
    cache[platform] = snapshotCurrentPlatform();
    writeConfigCache(cache);

    setPlatform(nextPlatform);

    if (settings.config && settings.config.platform === nextPlatform) {
      applyPlatformDraft(nextPlatform, settings.config);
      return;
    }

    applyPlatformDraft(nextPlatform, cache[nextPlatform]);
  };

  const requestConflictChoice = () =>
    new Promise<"cloud" | "local" | "cancel">((resolve) => {
      conflictResolverRef.current = resolve;
      setShowConflictPrompt(true);
    });

  // �?localStorage 加载配置
  useEffect(() => {
    const savedSettings = localStorage.getItem("onlineSyncSettings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      // 过滤掉 webdav 配置
      if (parsed.config?.platform === "webdav") {
        parsed.config = null;
        parsed.enabled = false;
      }
      setSettings(parsed);
      if (parsed.config) {
        const cfg = parsed.config;
        if (cfg.platform === "cos") {
          setPlatform("cos");
          setCosSecretId(cfg.secretId || "");
          setCosSecretKey(cfg.secretKey || "");
          setCosBucket(cfg.bucket || "");
          setCosRegion(cfg.region || "");
        } else if (cfg.platform === "oss") {
          setPlatform("oss");
          setOssAccessKeyId(cfg.accessKeyId || "");
          setOssAccessKeySecret(cfg.accessKeySecret || "");
          setOssBucket(cfg.bucket || "");
          setOssRegion(cfg.region || "");
        } else if (cfg.platform === "github") {
          setPlatform("github");
          setGithubToken(cfg.token || "");
          setGithubRepo(cfg.repo || "");
          setGithubDirectory(cfg.directory || "");
        } else if (cfg.platform === "r2") {
          setPlatform("r2");
          setR2AccessKeyId(cfg.accessKeyId || "");
          setR2SecretAccessKey(cfg.secretAccessKey || "");
          setR2Bucket(cfg.bucket || "");
          setR2AccountId(cfg.accountId || "");
        }
      }
    }
  }, []);

  // 保存配置
  const saveSettings = () => {
    let config: OnlineSyncConfig | null = null;

    if (platform === "cos") {
      if (!cosSecretId || !cosSecretKey || !cosBucket || !cosRegion) {
        showToast(t("online:error.incomplete_config"), "error");
        return;
      }
      config = {
        platform: "cos",
        secretId: cosSecretId,
        secretKey: cosSecretKey,
        bucket: cosBucket,
        region: cosRegion,
      };
    } else if (platform === "oss") {
      if (!ossAccessKeyId || !ossAccessKeySecret || !ossBucket || !ossRegion) {
        showToast(t("online:error.incomplete_config"), "error");
        return;
      }
      config = {
        platform: "oss",
        accessKeyId: ossAccessKeyId,
        accessKeySecret: ossAccessKeySecret,
        bucket: ossBucket,
        region: ossRegion,
      };
    } else if (platform === "github") {
      if (!githubToken || !githubRepo) {
        showToast(t("online:error.incomplete_config"), "error");
        return;
      }
      config = {
        platform: "github",
        token: githubToken,
        repo: githubRepo,
        directory: githubDirectory || undefined,
      };
    } else if (platform === "r2") {
      if (!r2AccessKeyId || !r2SecretAccessKey || !r2Bucket || !r2AccountId) {
        showToast(t("online:error.incomplete_config"), "error");
        return;
      }
      config = {
        platform: "r2",
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
        bucket: r2Bucket,
        accountId: r2AccountId,
      };
    } else {
      showToast(t("online:error.not_implemented"), "error");
      return;
    }

    const newSettings: OnlineSyncSettings = {
      ...settings,
      config,
      enabled: true,
    };

    const cache = readConfigCache();
    cache[platform] = config;
    writeConfigCache(cache);

    setSettings(newSettings);
    localStorage.setItem("onlineSyncSettings", JSON.stringify(newSettings));
    setShowConfig(false);
    showToast(t("online:config_saved"), "success");
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!settings.config) {
      showToast(t("online:error.no_config"), "error");
      return;
    }

    setIsTesting(true);
    try {
      const success = await testConnection(settings.config);
      if (success) {
        showToast(t("online:test_success"), "success");
      } else {
        showToast(t("online:test_failed"), "error");
      }
    } catch (error: any) {
      console.error("Test connection error:", error);
      showToast(t("online:test_failed"), "error");
    } finally {
      setIsTesting(false);
    }
  };

  // 上传到云�?
  const handleUpload = async () => {
    if (!settings.config) {
      showToast(t("online:error.no_config"), "error");
      setShowConfig(true);
      return;
    }

    try {
      const exists = await checkOnlineExists(settings.config, contestData.meta.title);
      if (exists) {
        const choice = await requestConflictChoice();
        setShowConflictPrompt(false);
        conflictResolverRef.current = null;

        if (choice === "cloud") {
          await handleDownload();
          return;
        }
        if (choice !== "local") {
          return;
        }
      }
    } catch (error: any) {
      console.error("Check online exists error:", error);
      showToast(t("online:upload_failed"), "error");
      return;
    }

    setIsUploading(true);
    try {
      // 获取所有版本和分支
      const versions = await getAllVersions();
      const branches = await getAllBranches();

      // 准备图片 Map
      const images = new Map<string, Blob>();
      for (const img of contestData.images) {
        const response = await fetch(img.url);
        const blob = await response.blob();
        images.set(img.uuid, blob);
      }

      // 上传数据
      await uploadToOnline(settings.config, contestData.meta.title, {
        contest: {
          meta: contestData.meta,
          problems: contestData.problems.map(({ key, ...rest }) => rest),
          images: contestData.images.map((img) => ({ uuid: img.uuid, name: img.name })),
          template: contestData.template,
        },
        images,
        versions,
        branches,
      });

      // 更新最后同步时�?
      const newSettings = {
        ...settings,
        lastSyncTime: Date.now(),
      };
      setSettings(newSettings);
      localStorage.setItem("onlineSyncSettings", JSON.stringify(newSettings));

      onSyncComplete?.(newSettings.lastSyncTime);

      showToast(t("online:upload_success"), "success");
    } catch (error: any) {
      console.error("Upload error:", error);
      showToast(t("online:upload_failed"), "error");
    } finally {
      setIsUploading(false);
    }
  };

  // 从云端下�?
  const handleDownload = async () => {
    if (!settings.config) {
      showToast(t("online:error.no_config"), "error");
      setShowConfig(true);
      return;
    }

    setIsDownloading(true);
    try {
      const data = await downloadFromOnline(settings.config, contestData.meta.title);

      if (!data) {
        showToast(t("online:no_data_found"), "warning");
        return;
      }

      // 保存配置到数据库
      await saveConfigToDB({
        meta: data.contest.meta,
        problems: data.contest.problems.map((p) => ({
          ...p,
          key: p.key || crypto.randomUUID(),
        })),
        images: Array.from(data.images.entries() as IterableIterator<[string, Blob]>).map(([uuid, blob]) => ({
          uuid,
          name: data.contest.images?.find((img) => img.uuid === uuid)?.name || uuid,
          url: URL.createObjectURL(blob),
        })),
        template: data.contest.template,
      });

      // 保存图片
      for (const [uuid, blob] of data.images) {
        await saveImageToDB(uuid, blob);
      }

      // 恢复版本控制数据
      if (data.versions && data.branches) {
        for (const branch of data.branches) {
          await saveBranch(branch);
        }
        for (const version of data.versions) {
          await saveVersion(version);
        }
      }

      // 通知父组件刷�?
      const imageData = Array.from(data.images.entries() as IterableIterator<[string, Blob]>).map(([uuid, blob]) => ({
        uuid,
        name: data.contest.images?.find((img) => img.uuid === uuid)?.name || uuid,
        url: URL.createObjectURL(blob),
      }));

      onDataImported({
        meta: data.contest.meta,
        problems: data.contest.problems.map((p) => ({
          ...p,
          key: p.key || crypto.randomUUID(),
        })),
        images: imageData,
        template: data.contest.template,
      });

      // 更新最后同步时�?
      const newSettings = {
        ...settings,
        lastSyncTime: Date.now(),
      };
      setSettings(newSettings);
      localStorage.setItem("onlineSyncSettings", JSON.stringify(newSettings));

      onSyncComplete?.(newSettings.lastSyncTime);

      showToast(t("online:download_success"), "success");
    } catch (error: any) {
      console.error("Download error:", error);
      showToast(t("online:download_failed"), "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // 切换自动同步
  const toggleAutoSync = () => {
    const newSettings = {
      ...settings,
      autoSync: !settings.autoSync,
    };
    setSettings(newSettings);
    localStorage.setItem("onlineSyncSettings", JSON.stringify(newSettings));
  };

  if (!isOpen) return null;

  const platformName = (p: string) => {
    switch (p) {
      case "cos": return t("online:tencent_cos");
      case "oss": return "阿里云 OSS";
      case "github": return "GitHub";
      case "r2": return "Cloudflare R2";
      default: return p;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{t("online:title")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FontAwesomeIcon icon={faX} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 状态显示 */}
          <div className="text-sm">
            {settings.enabled && settings.config ? (
              <div className="text-green-600 flex items-center gap-2">
                <span>{platformName(settings.config.platform)}</span>
                {settings.lastSyncTime && (
                  <span className="text-gray-400">· {new Date(settings.lastSyncTime).toLocaleDateString()}</span>
                )}
              </div>
            ) : (
              <span className="text-gray-400">{t("online:not_configured")}</span>
            )}
          </div>

          {/* 配置区域 */}
          {!showConfig ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowConfig(true)}
                className="w-full py-2 px-4 border rounded hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faGear} />
                {settings.enabled ? t("online:edit_config") : t("online:configure")}
              </button>
              {settings.enabled && settings.config && (
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="w-full py-2 px-4 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {isTesting ? t("online:testing") : t("online:test_connection")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">{t("online:select_platform")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {["cos", "oss", "github", "r2"].map((p) => (
                    <label key={p} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        value={p}
                        checked={platform === p}
                        onChange={(e) => handlePlatformChange(e.target.value as any)}
                        className="mr-2"
                      />
                      <span className="text-sm">{platformName(p)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* COS 配置 */}
              {platform === "cos" && (
                <div className="space-y-2">
                  <input type="text" placeholder="Secret ID" value={cosSecretId} onChange={(e) => setCosSecretId(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="password" placeholder="Secret Key" value={cosSecretKey} onChange={(e) => setCosSecretKey(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Bucket" value={cosBucket} onChange={(e) => setCosBucket(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Region (如 ap-guangzhou)" value={cosRegion} onChange={(e) => setCosRegion(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
              )}

              {/* OSS 配置 */}
              {platform === "oss" && (
                <div className="space-y-2">
                  <input type="text" placeholder="Access Key ID" value={ossAccessKeyId} onChange={(e) => setOssAccessKeyId(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="password" placeholder="Access Key Secret" value={ossAccessKeySecret} onChange={(e) => setOssAccessKeySecret(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Bucket" value={ossBucket} onChange={(e) => setOssBucket(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Region (如 oss-cn-hangzhou)" value={ossRegion} onChange={(e) => setOssRegion(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
              )}

              {/* GitHub 配置 */}
              {platform === "github" && (
                <div className="space-y-2">
                  <input type="password" placeholder="Personal Access Token" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Repository (owner/repo)" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Directory (可选, 如 my-contests)" value={githubDirectory} onChange={(e) => setGithubDirectory(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
              )}

              {/* R2 配置 */}
              {platform === "r2" && (
                <div className="space-y-2">
                  <input type="text" placeholder="Access Key ID" value={r2AccessKeyId} onChange={(e) => setR2AccessKeyId(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="password" placeholder="Secret Access Key" value={r2SecretAccessKey} onChange={(e) => setR2SecretAccessKey(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Bucket" value={r2Bucket} onChange={(e) => setR2Bucket(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                  <input type="text" placeholder="Account ID" value={r2AccountId} onChange={(e) => setR2AccountId(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={saveSettings} className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                  {t("online:save_config")}
                </button>
                <button onClick={() => setShowConfig(false)} className="flex-1 py-2 border rounded hover:bg-gray-50 text-sm">
                  {t("common:cancel")}
                </button>
              </div>
            </div>
          )}

          {/* 自动同步 */}
          {settings.enabled && settings.config && (
            <div className="flex items-center justify-between py-2 border-t">
              <span className="text-sm">{t("online:auto_sync")}</span>
              <input type="checkbox" checked={settings.autoSync} onChange={toggleAutoSync} className="toggle toggle-sm" />
            </div>
          )}

          {/* 同步操作按钮 */}
          {settings.enabled && settings.config && (
            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                {isUploading ? t("online:uploading") : t("online:upload_to_cloud")}
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex-1 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                {isDownloading ? t("online:downloading") : t("online:download_from_cloud")}
              </button>
            </div>
          )}
        </div>
      </div>

      {showConflictPrompt && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-full max-w-sm p-4">
            <h3 className="font-semibold mb-2">检测到云端已有同名数据</h3>
            <p className="text-sm text-gray-600 mb-4">请选择使用云端内容，或用本地内容覆盖云端。</p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                onClick={() => {
                  setShowConflictPrompt(false);
                  conflictResolverRef.current?.("cancel");
                  conflictResolverRef.current = null;
                }}
              >
                {t("common:cancel")}
              </button>
              <button
                className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                onClick={() => {
                  setShowConflictPrompt(false);
                  conflictResolverRef.current?.("cloud");
                  conflictResolverRef.current = null;
                }}
              >
                使用云端
              </button>
              <button
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                onClick={() => {
                  setShowConflictPrompt(false);
                  conflictResolverRef.current?.("local");
                  conflictResolverRef.current = null;
                }}
              >
                本地覆盖云端
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineManager;

