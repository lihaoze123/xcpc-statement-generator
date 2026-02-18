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

const stringFromBase64 = (base64: string): string => {
  const bytes = bytesFromBase64(base64);
  return new TextDecoder().decode(bytes);
};

/**
 * 在线同步工具类
 * 支持腾讯云 COS、阿里云 OSS、GitHub、Cloudflare R2
 */

// 获取存储路径
const getStoragePath = (contestTitle: string) => {
  return `xcpc-statement-generator/${contestTitle}`;
};

// 检查远端是否已有同名数据
export const checkOnlineExists = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<boolean> => {
  const basePath = getStoragePath(contestTitle);

  switch (config.platform) {
    case "cos": {
      const client = getCOSClient(config);
      return await new Promise<boolean>((resolve, reject) => {
        client.headObject(
          {
            Bucket: config.bucket,
            Region: config.region,
            Key: `${basePath}/contest.json`,
          },
          (err) => {
            if (!err) return resolve(true);
            const status = (err as any)?.statusCode;
            const code = (err as any)?.error?.Code || (err as any)?.error?.code;
            if (status === 404 || code === "NoSuchKey") return resolve(false);
            reject(err);
          }
        );
      });
    }
    case "oss": {
      const client = new OSS({
        region: config.region,
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        bucket: config.bucket,
      });
      try {
        await client.head(`${basePath}/contest.json`);
        return true;
      } catch (err: any) {
        if (err?.status === 404 || err?.code === "NoSuchKey" || err?.code === "NoSuchObject") {
          return false;
        }
        throw err;
      }
    }
    case "github": {
      const octokit = new Octokit({ auth: config.token });
      const [owner, repo] = config.repo.split("/");
      try {
        await octokit.repos.getContent({
          owner,
          repo,
          path: `${basePath}/contest.json`,
        });
        return true;
      } catch (err: any) {
        if (err?.status === 404) return false;
        throw err;
      }
    }
    case "r2": {
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: config.bucket,
            Key: `${basePath}/contest.json`,
          })
        );
        return true;
      } catch (err: any) {
        const status = err?.$metadata?.httpStatusCode;
        if (status === 404 || err?.name === "NotFound" || err?.Code === "NotFound") return false;
        throw err;
      }
    }
    default:
      throw new Error("Unsupported platform");
  }
};

// 腾讯云 COS 客户端
let cosClient: COS | null = null;

const getCOSClient = (config: OnlineSyncConfig): COS => {
  if (config.platform !== "cos") {
    throw new Error("Invalid config for COS");
  }
  
  if (!cosClient) {
    cosClient = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    });
  }
  
  return cosClient;
};

/**
 * 上传数据到腾讯云 COS
 */
export const uploadToCOS = async (
  config: OnlineSyncConfig,
  contestTitle: string,
  data: {
    contest: Contest;
    images: Map<string, Blob>;
    versions?: any[];
    branches?: any[];
  }
): Promise<void> => {
  if (config.platform !== "cos") {
    throw new Error("Invalid platform");
  }

  const client = getCOSClient(config);
  const basePath = getStoragePath(contestTitle);

  // 上传配置文件
  const configJson = JSON.stringify(data.contest, null, 2);
  await new Promise<void>((resolve, reject) => {
    client.putObject(
      {
        Bucket: config.bucket,
        Region: config.region,
        Key: `${basePath}/contest.json`,
        Body: configJson,
      },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  // 上传图片
  for (const [uuid, blob] of data.images) {
    await new Promise<void>((resolve, reject) => {
      client.putObject(
        {
          Bucket: config.bucket,
          Region: config.region,
          Key: `${basePath}/images/${uuid}`,
          Body: blob,
        },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // 上传版本控制数据
  if (data.versions && data.branches) {
    const versionData = {
      versions: data.versions,
      branches: data.branches,
    };
    const versionJson = JSON.stringify(versionData, null, 2);
    await new Promise<void>((resolve, reject) => {
      client.putObject(
        {
          Bucket: config.bucket,
          Region: config.region,
          Key: `${basePath}/versions.json`,
          Body: versionJson,
        },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

/**
 * 从腾讯云 COS 下载数据
 */
export const downloadFromCOS = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<{
  contest: Contest;
  images: Map<string, Blob>;
  versions?: any[];
  branches?: any[];
} | null> => {
  if (config.platform !== "cos") {
    throw new Error("Invalid platform");
  }

  const client = getCOSClient(config);
  const basePath = getStoragePath(contestTitle);

  try {
    // 下载配置文件
    const configData = await new Promise<string>((resolve, reject) => {
      client.getObject(
        {
          Bucket: config.bucket,
          Region: config.region,
          Key: `${basePath}/contest.json`,
        },
        (err, data) => {
          if (err) reject(err);
          else resolve(data.Body as string);
        }
      );
    });
    const contest: Contest = JSON.parse(configData);

    // 下载图片
    const images = new Map<string, Blob>();
    const imageUuids = contest.images?.map((img) => img.uuid) || [];

    for (const uuid of imageUuids) {
      try {
        const imageData = await new Promise<Blob>((resolve, reject) => {
          client.getObject(
            {
              Bucket: config.bucket,
              Region: config.region,
              Key: `${basePath}/images/${uuid}`,
            },
            (err, data) => {
              if (err) reject(err);
              else resolve(data.Body as Blob);
            }
          );
        });
        images.set(uuid, imageData);
      } catch (e) {
        console.warn(`Failed to download image ${uuid}:`, e);
      }
    }

    // 下载版本控制数据
    let versions, branches;
    try {
      const versionData = await new Promise<string>((resolve, reject) => {
        client.getObject(
          {
            Bucket: config.bucket,
            Region: config.region,
            Key: `${basePath}/versions.json`,
          },
          (err, data) => {
            if (err) reject(err);
            else resolve(data.Body as string);
          }
        );
      });
      const parsedData = JSON.parse(versionData);
      versions = parsedData.versions;
      branches = parsedData.branches;
    } catch (e) {
      console.warn("No version data found:", e);
    }

    return { contest, images, versions, branches };
  } catch (error) {
    console.error("Failed to download from COS:", error);
    throw error;
  }
};

/**
 * 上传数据到阿里云 OSS
 */
export const uploadToOSS = async (
  config: OnlineSyncConfig,
  contestTitle: string,
  data: {
    contest: Contest;
    images: Map<string, Blob>;
    versions?: any[];
    branches?: any[];
  }
): Promise<void> => {
  if (config.platform !== "oss") {
    throw new Error("Invalid platform");
  }

  const client = new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
  });

  const basePath = getStoragePath(contestTitle);

  try {
    // 上传配置文件
    const configJson = JSON.stringify(data.contest, null, 2);
    await client.put(`${basePath}/contest.json`, Buffer.from(configJson));

    // 上传图片
    for (const [uuid, blob] of data.images) {
      const buffer = await blob.arrayBuffer();
      await client.put(`${basePath}/images/${uuid}`, Buffer.from(buffer));
    }

    // 上传版本控制数据
    if (data.versions && data.branches) {
      const versionData = {
        versions: data.versions,
        branches: data.branches,
      };
      const versionJson = JSON.stringify(versionData, null, 2);
      await client.put(`${basePath}/versions.json`, Buffer.from(versionJson));
    }
  } catch (error) {
    console.error("Failed to upload to OSS:", error);
    throw error;
  }
};

/**
 * 从阿里云 OSS 下载数据
 */
export const downloadFromOSS = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<{
  contest: Contest;
  images: Map<string, Blob>;
  versions?: any[];
  branches?: any[];
} | null> => {
  if (config.platform !== "oss") {
    throw new Error("Invalid platform");
  }

  const client = new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
  });

  const basePath = getStoragePath(contestTitle);

  try {
    // 下载配置文件
    const configResult = await client.get(`${basePath}/contest.json`);
    const contest: Contest = JSON.parse(configResult.content.toString());

    // 下载图片
    const images = new Map<string, Blob>();
    const imageUuids = contest.images?.map((img) => img.uuid) || [];

    for (const uuid of imageUuids) {
      try {
        const imageResult = await client.get(`${basePath}/images/${uuid}`);
        const blob = new Blob([imageResult.content]);
        images.set(uuid, blob);
      } catch (e) {
        console.warn(`Failed to download image ${uuid}:`, e);
      }
    }

    // 下载版本控制数据
    let versions, branches;
    try {
      const versionResult = await client.get(`${basePath}/versions.json`);
      const parsedData = JSON.parse(versionResult.content.toString());
      versions = parsedData.versions;
      branches = parsedData.branches;
    } catch (e) {
      console.warn("No version data found:", e);
    }

    return { contest, images, versions, branches };
  } catch (error) {
    console.error("Failed to download from OSS:", error);
    throw error;
  }
};

/**
 * 上传数据到 GitHub
 */
export const uploadToGitHub = async (
  config: OnlineSyncConfig,
  contestTitle: string,
  data: {
    contest: Contest;
    images: Map<string, Blob>;
    versions?: any[];
    branches?: any[];
  }
): Promise<void> => {
  if (config.platform !== "github") {
    throw new Error("Invalid platform");
  }

  const octokit = new Octokit({
    auth: config.token,
  });

  const [owner, repo] = config.repo.split("/");
  const basePath = getStoragePath(contestTitle);

  const getFileSha = async (path: string): Promise<string | undefined> => {
    try {
      const res = await octokit.repos.getContent({ owner, repo, path });
      return (res.data as any)?.sha as string | undefined;
    } catch (e: any) {
      if (e?.status === 404) return undefined;
      throw e;
    }
  };

  try {
    // 上传配置文件
    const configJson = JSON.stringify(data.contest, null, 2);
    const configBase64 = base64FromString(configJson);

    const configSha = await getFileSha(`${basePath}/contest.json`);
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `${basePath}/contest.json`,
      message: `Update contest: ${contestTitle}`,
      content: configBase64,
      sha: configSha,
      committer: {
        name: "xcpc-statement-generator",
        email: "xcpc@generator.local",
      },
    });

    // 上传图片
    for (const [uuid, blob] of data.images) {
      const arrayBuffer = await blob.arrayBuffer();
      const imageBase64 = base64FromBytes(new Uint8Array(arrayBuffer));

      const imageSha = await getFileSha(`${basePath}/images/${uuid}`);
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `${basePath}/images/${uuid}`,
        message: `Add image: ${uuid}`,
        content: imageBase64,
        sha: imageSha,
        committer: {
          name: "xcpc-statement-generator",
          email: "xcpc@generator.local",
        },
      });
    }

    // 上传版本控制数据
    if (data.versions && data.branches) {
      const versionData = {
        versions: data.versions,
        branches: data.branches,
      };
      const versionJson = JSON.stringify(versionData, null, 2);
      const versionBase64 = base64FromString(versionJson);

      const versionSha = await getFileSha(`${basePath}/versions.json`);
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `${basePath}/versions.json`,
        message: `Update version control data`,
        content: versionBase64,
        sha: versionSha,
        committer: {
          name: "xcpc-statement-generator",
          email: "xcpc@generator.local",
        },
      });
    }
  } catch (error) {
    console.error("Failed to upload to GitHub:", error);
    throw error;
  }
};

/**
 * 从 GitHub 下载数据
 */
export const downloadFromGitHub = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<{
  contest: Contest;
  images: Map<string, Blob>;
  versions?: any[];
  branches?: any[];
} | null> => {
  if (config.platform !== "github") {
    throw new Error("Invalid platform");
  }

  const octokit = new Octokit({
    auth: config.token,
  });

  const [owner, repo] = config.repo.split("/");
  const basePath = getStoragePath(contestTitle);

  try {
    // 下载配置文件
    const configResponse = await octokit.repos.getContent({
      owner,
      repo,
      path: `${basePath}/contest.json`,
    });

    const configContent = stringFromBase64((configResponse.data as any).content);
    const contest: Contest = JSON.parse(configContent);

    // 下载图片
    const images = new Map<string, Blob>();
    const imageUuids = contest.images?.map((img) => img.uuid) || [];

    for (const uuid of imageUuids) {
      try {
        const imageResponse = await octokit.repos.getContent({
          owner,
          repo,
          path: `${basePath}/images/${uuid}`,
        });

        const imageBytes = bytesFromBase64((imageResponse.data as any).content);
        const blob = new Blob([imageBytes as unknown as BlobPart]);
        images.set(uuid, blob);
      } catch (e) {
        console.warn(`Failed to download image ${uuid}:`, e);
      }
    }

    // 下载版本控制数据
    let versions, branches;
    try {
      const versionResponse = await octokit.repos.getContent({
        owner,
        repo,
        path: `${basePath}/versions.json`,
      });

      const versionContent = stringFromBase64((versionResponse.data as any).content);
      const parsedData = JSON.parse(versionContent);
      versions = parsedData.versions;
      branches = parsedData.branches;
    } catch (e) {
      console.warn("No version data found:", e);
    }

    return { contest, images, versions, branches };
  } catch (error) {
    console.error("Failed to download from GitHub:", error);
    throw error;
  }
};

/**
 * 上传数据到 Cloudflare R2
 */
export const uploadToR2 = async (
  config: OnlineSyncConfig,
  contestTitle: string,
  data: {
    contest: Contest;
    images: Map<string, Blob>;
    versions?: any[];
    branches?: any[];
  }
): Promise<void> => {
  if (config.platform !== "r2") {
    throw new Error("Invalid platform");
  }

  const s3Client = new S3Client({
    region: "auto",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  });

  const basePath = getStoragePath(contestTitle);

  try {
    // 上传配置文件
    const configJson = JSON.stringify(data.contest, null, 2);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: `${basePath}/contest.json`,
        Body: configJson,
        ContentType: "application/json",
      })
    );

    // 上传图片
    for (const [uuid, blob] of data.images) {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: `${basePath}/images/${uuid}`,
          Body: buffer,
        })
      );
    }

    // 上传版本控制数据
    if (data.versions && data.branches) {
      const versionData = {
        versions: data.versions,
        branches: data.branches,
      };
      const versionJson = JSON.stringify(versionData, null, 2);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: `${basePath}/versions.json`,
          Body: versionJson,
          ContentType: "application/json",
        })
      );
    }
  } catch (error) {
    console.error("Failed to upload to R2:", error);
    throw error;
  }
};

/**
 * 从 Cloudflare R2 下载数据
 */
export const downloadFromR2 = async (
  config: OnlineSyncConfig,
  contestTitle: string
): Promise<{
  contest: Contest;
  images: Map<string, Blob>;
  versions?: any[];
  branches?: any[];
} | null> => {
  if (config.platform !== "r2") {
    throw new Error("Invalid platform");
  }

  const s3Client = new S3Client({
    region: "auto",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  });

  const basePath = getStoragePath(contestTitle);

  try {
    // 下载配置文件
    const configResult = await s3Client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: `${basePath}/contest.json`,
      })
    );

    const configBuffer = await configResult.Body?.transformToString();
    const contest: Contest = JSON.parse(configBuffer || "{}");

    // 下载图片
    const images = new Map<string, Blob>();
    const imageUuids = contest.images?.map((img) => img.uuid) || [];

    for (const uuid of imageUuids) {
      try {
        const imageResult = await s3Client.send(
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: `${basePath}/images/${uuid}`,
          })
        );

        const imageBuffer = await imageResult.Body?.transformToByteArray();
        if (imageBuffer) {
          const blob = new Blob([new Uint8Array(imageBuffer)]);
          images.set(uuid, blob);
        }
      } catch (e) {
        console.warn(`Failed to download image ${uuid}:`, e);
      }
    }

    // 下载版本控制数据
    let versions, branches;
    try {
      const versionResult = await s3Client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: `${basePath}/versions.json`,
        })
      );

      const versionBuffer = await versionResult.Body?.transformToString();
      const parsedData = JSON.parse(versionBuffer || "{}");
      versions = parsedData.versions;
      branches = parsedData.branches;
    } catch (e) {
      console.warn("No version data found:", e);
    }

    return { contest, images, versions, branches };
  } catch (error) {
    console.error("Failed to download from R2:", error);
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
  switch (config.platform) {
    case "cos":
      return uploadToCOS(config, contestTitle, data);
    case "oss":
      return uploadToOSS(config, contestTitle, data);
    case "github":
      return uploadToGitHub(config, contestTitle, data);
    case "r2":
      return uploadToR2(config, contestTitle, data);
    default:
      throw new Error("Unsupported platform");
  }
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
  switch (config.platform) {
    case "cos":
      return downloadFromCOS(config, contestTitle);
    case "oss":
      return downloadFromOSS(config, contestTitle);
    case "github":
      return downloadFromGitHub(config, contestTitle);
    case "r2":
      return downloadFromR2(config, contestTitle);
    default:
      throw new Error("Unsupported platform");
  }
};

/**
 * 测试连接
 */
export const testConnection = async (config: OnlineSyncConfig): Promise<boolean> => {
  try {
    switch (config.platform) {
      case "cos": {
        const client = getCOSClient(config);
        await new Promise<void>((resolve, reject) => {
          client.headBucket(
            {
              Bucket: config.bucket,
              Region: config.region,
            },
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        return true;
      }
      case "oss": {
        const client = new OSS({
          region: config.region,
          accessKeyId: config.accessKeyId,
          accessKeySecret: config.accessKeySecret,
          bucket: config.bucket,
        });
        await client.getBucketInfo();
        return true;
      }
      case "github": {
        const octokit = new Octokit({
          auth: config.token,
        });
        const [owner, repo] = config.repo.split("/");
        await octokit.repos.get({ owner, repo });
        return true;
      }
      case "r2": {
        const s3Client = new S3Client({
          region: "auto",
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        });
        await s3Client.send(
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: "test.txt",
          })
        );
        return true;
      }
      default:
        return false;
    }
  } catch (error) {
    console.error("Connection test failed:", error);
    return false;
  }
};
