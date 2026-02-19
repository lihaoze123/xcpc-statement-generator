import COS from "cos-js-sdk-v5";
import OSS from "ali-oss";
import { Octokit } from "@octokit/rest";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { OnlineSyncConfig, Contest } from "@/types/contest";

const base64FromString = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  return base64FromBytes(bytes);
};

const base64FromBytes = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const bytesFromBase64 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * 在线同步工具类
 * 支持腾讯云 COS、阿里云 OSS、GitHub、Cloudflare R2
 */

// 获取存储路径
const getStoragePath = (contestTitle: string, directory?: string) => {
  if (!directory) {
    return contestTitle;
  }
  const base = directory.replace(/^\/|\/$/g, "");
  return `${base}/${contestTitle}`;
};

// 通用存储操作接口
interface StorageAdapter {
  putFile(path: string, content: string | Uint8Array | Blob): Promise<void>;
  getFile(path: string): Promise<Uint8Array>;
  headFile(path: string): Promise<boolean>;
  commit?(message: string): Promise<void>;
}

// 创建COS适配器
const createCOSAdapter = (config: OnlineSyncConfig): StorageAdapter => {
  if (config.platform !== "cos") throw new Error("Invalid config for COS");
  const client = new COS({ SecretId: config.secretId, SecretKey: config.secretKey });
  const { bucket, region } = config;
  return {
    putFile: (path, content) => new Promise<void>((resolve, reject) => {
      client.putObject({ Bucket: bucket, Region: region, Key: path, Body: content as any },
        (err) => err ? reject(err) : resolve());
    }),
    getFile: (path) => new Promise<Uint8Array>((resolve, reject) => {
      client.getObject({ Bucket: bucket, Region: region, Key: path }, (err, data) => {
        if (err) return reject(err);
        const body = data.Body;
        if (typeof body === 'string') resolve(new TextEncoder().encode(body));
        else if (body instanceof Blob) body.arrayBuffer().then(ab => resolve(new Uint8Array(ab)));
        else resolve(new Uint8Array(body as any));
      });
    }),
    headFile: (path) => new Promise<boolean>((resolve, reject) => {
      client.headObject({ Bucket: bucket, Region: region, Key: path }, (err) => {
        if (!err) return resolve(true);
        const status = (err as any)?.statusCode;
        const code = (err as any)?.error?.Code || (err as any)?.error?.code;
        if (status === 404 || code === "NoSuchKey") return resolve(false);
        reject(err);
      });
    }),
  };
};

// 创建OSS适配器
// 创建OSS适配器
const createOSSAdapter = (config: OnlineSyncConfig): StorageAdapter => {
  if (config.platform !== "oss") throw new Error("Invalid config for OSS");
  const client = new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
  });
  return {
    async putFile(path, content) {
      const buffer = typeof content === 'string' ? Buffer.from(content)
        : content instanceof Blob ? Buffer.from(await content.arrayBuffer())
        : Buffer.from(content);
      await client.put(path, buffer);
    },
    async getFile(path) {
      const result = await client.get(path);
      return result.content instanceof Buffer ? new Uint8Array(result.content)
        : new Uint8Array(await result.content.arrayBuffer());
    },
    async headFile(path) {
      try {
        await client.head(path);
        return true;
      } catch (err: any) {
        if (err?.status === 404 || err?.code === "NoSuchKey" || err?.code === "NoSuchObject") return false;
        throw err;
      }
    },
  };
};

// 创建GitHub适配器
const createGitHubAdapter = (config: OnlineSyncConfig): StorageAdapter => {
  if (config.platform !== "github") throw new Error("Invalid config for GitHub");
  const octokit = new Octokit({ auth: config.token });
  const [owner, repo] = config.repo.split("/");

  // 待提交的缓存
  const pendingFiles = new Map<string, { content: string; isBlob: boolean }>();

  const getFileSha = async (path: string) => {
    try {
      const res = await octokit.repos.getContent({ owner, repo, path });
      return (res.data as any)?.sha;
    } catch (e: any) {
      if (e?.status === 404) return undefined;
      throw e;
    }
  };

  // 提交所有缓存的文件（单次 commit）
  const commitAll = async (message: string) => {
    if (pendingFiles.size === 0) return;

    const entries = Array.from(pendingFiles.entries());
    // 先创建所有 blobs
    const blobResults = await Promise.all(
      entries.map(async ([path, value]) => {
        const res = await octokit.git.createBlob({ owner, repo, content: value.content, encoding: "base64" });
        return { path, sha: res.data.sha };
      })
    );

    // 构建 tree
    const treeItems = blobResults.map((r) => ({
      path: r.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: r.sha,
    }));

    // 获取当前 commit 的 sha
    const { data: ref } = await octokit.git.getRef({ owner, repo, ref: "heads/main" });
    const currentCommitSha = ref.object.sha;

    // 创建新 tree
    const { data: newTree } = await octokit.git.createTree({
      owner, repo,
      tree: treeItems,
      base_tree: currentCommitSha,
    });

    // 创建 commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner, repo,
      message,
      tree: newTree.sha,
      parents: [currentCommitSha],
      committer: { name: "xcpc-statement-generator", email: "xcpc@generator.local" },
    });

    // 更新 main 分支引用
    await octokit.git.updateRef({
      owner, repo,
      ref: "heads/main",
      sha: newCommit.sha,
    });

    pendingFiles.clear();
  };

  return {
    async putFile(path, content) {
      const base64Content = typeof content === 'string' ? base64FromString(content)
        : content instanceof Blob ? base64FromBytes(new Uint8Array(await content.arrayBuffer()))
        : base64FromBytes(content);
      pendingFiles.set(path, { content: base64Content, isBlob: false });
    },
    async getFile(path) {
      const response = await octokit.repos.getContent({ owner, repo, path });
      return bytesFromBase64((response.data as any).content);
    },
    async headFile(path) {
      try {
        await octokit.repos.getContent({ owner, repo, path });
        return true;
      } catch (err: any) {
        return err?.status !== 404 ? ((): never => { throw err; })() : false;
      }
    },
    async commit(message = "Update files") {
      await commitAll(message);
    },
  };
};

// 创建R2适配器
const createR2Adapter = (config: OnlineSyncConfig): StorageAdapter => {
  if (config.platform !== "r2") throw new Error("Invalid config for R2");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const { bucket } = config;
  return {
    async putFile(path, content) {
      const body = typeof content === 'string' ? content
        : content instanceof Blob ? new Uint8Array(await content.arrayBuffer())
        : content;
      
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: path, Body: body,
        ContentType: path.endsWith('.json') ? 'application/json' : undefined,
      }));
    },
    async getFile(path) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: path }));
      const bytes = await result.Body?.transformToByteArray();
      return new Uint8Array(bytes || []);
    },
    async headFile(path) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
        return true;
      } catch (err: any) {
        const status = err?.$metadata?.httpStatusCode;
        if (status === 404 || err?.name === "NotFound" || err?.Code === "NotFound") return false;
        throw err;
      }
    },
  };
};

// 创建存储适配器
const createStorageAdapter = (config: OnlineSyncConfig): StorageAdapter => {
  switch (config.platform) {
    case "cos": return createCOSAdapter(config);
    case "oss": return createOSSAdapter(config);
    case "github": return createGitHubAdapter(config);
    case "r2": return createR2Adapter(config);
    default: throw new Error("Unsupported platform");
  }
};

// 检查远端是否已有同名数据
export const checkOnlineExists = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<boolean> => {
  const directory = (config as any).directory;
  const basePath = getStoragePath(contestTitle, directory);
  const adapter = createStorageAdapter(config);
  try {
    return await adapter.headFile(`${basePath}/contest.json`);
  } catch (error) {
    console.error("Failed to check online exists:", error);
    throw error;
  }
};

/**
 * 通用上传函数 - 使用适配器模式
 */
const uploadWithAdapter = async (
  config: OnlineSyncConfig,
  contestTitle: string,
  data: {
    contest: Contest;
    images: Map<string, Blob>;
    versions?: any[];
    branches?: any[];
  }
): Promise<void> => {
  const adapter = createStorageAdapter(config);
  const directory = (config as any).directory;
  const basePath = getStoragePath(contestTitle, directory);

  try {
    // 上传配置文件
    const configJson = JSON.stringify(data.contest, null, 2);
    await adapter.putFile(`${basePath}/contest.json`, configJson);

    // 上传图片
    for (const [uuid, blob] of data.images) {
      await adapter.putFile(`${basePath}/images/${uuid}`, blob);
    }

    // 上传版本控制数据
    if (data.versions && data.branches) {
      const versionData = {
        versions: data.versions,
        branches: data.branches,
      };
      const versionJson = JSON.stringify(versionData, null, 2);
      await adapter.putFile(`${basePath}/versions.json`, versionJson);
    }

    // GitHub 适配器：一次性提交所有变更
    if (config.platform === "github" && adapter.commit) {
      await adapter.commit(`Sync contest: ${contestTitle}`);
    }
  } catch (error) {
    console.error(`Failed to upload to ${config.platform}:`, error);
    throw error;
  }
};

/**
 * 通用下载函数 - 使用适配器模式
 */
const downloadWithAdapter = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<{
  contest: Contest;
  images: Map<string, Blob>;
  versions?: any[];
  branches?: any[];
} | null> => {
  const adapter = createStorageAdapter(config);
  const directory = (config as any).directory;
  const basePath = getStoragePath(contestTitle, directory);

  try {
    // 下载配置文件
    const configBytes = await adapter.getFile(`${basePath}/contest.json`);
    const configJson = new TextDecoder().decode(configBytes);
    const contest: Contest = JSON.parse(configJson);

    // 下载图片
    const images = new Map<string, Blob>();
    const imageUuids = contest.images?.map((img) => img.uuid) || [];

    for (const uuid of imageUuids) {
      try {
        const imageBytes = await adapter.getFile(`${basePath}/images/${uuid}`);
        const blob = new Blob([imageBytes as unknown as BlobPart]);
        images.set(uuid, blob);
      } catch (e) {
        console.warn(`Failed to download image ${uuid}:`, e);
      }
    }

    // 下载版本控制数据
    let versions, branches;
    try {
      const versionBytes = await adapter.getFile(`${basePath}/versions.json`);
      const versionJson = new TextDecoder().decode(versionBytes);
      const parsedData = JSON.parse(versionJson);
      versions = parsedData.versions;
      branches = parsedData.branches;
    } catch (e) {
      console.warn("No version data found:", e);
    }

    return { contest, images, versions, branches };
  } catch (error) {
    console.error(`Failed to download from ${config.platform}:`, error);
    throw error;
  }
};

/**
 * 统一的上传接口
 */
export const uploadToOnline = async (
  config: OnlineSyncConfig,
  contestTitle: string,
  data: {
    contest: Contest;
    images: Map<string, Blob>;
    versions?: any[];
    branches?: any[];
  }
): Promise<void> => {
  return uploadWithAdapter(config, contestTitle, data);
};

/**
 * 统一的下载接口
 */
export const downloadFromOnline = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<{
  contest: Contest;
  images: Map<string, Blob>;
  versions?: any[];
  branches?: any[];
} | null> => {
  return downloadWithAdapter(config, contestTitle);
};

/**
 * 测试连接
 */
export const testConnection = async (config: OnlineSyncConfig): Promise<boolean> => {
  try {
    const adapter = createStorageAdapter(config);
    // 尝试执行一个轻量级操作来测试连接
    await adapter.headFile('test-connection-probe');
    return true;
  } catch (error) {
    console.error("Connection test failed:", error);
    return false;
  }
};
