/**
 * XCPC 比赛和题目相关的 TypeScript 类型定义
 */

// 样例输入输出对
export interface Sample {
  input: string;
  output: string;
}

// 题目格式类型
export type ProblemFormat = "typst" | "latex" | "markdown";

// 题目元数据
export interface ProblemMetadata {
  display_name: string;
  format?: ProblemFormat; // 默认为 typst
  samples: Sample[];
}

// 题目描述
export interface ProblemStatement {
  description: string;
  input?: string;
  output?: string;
  notes?: string;
}

// 完整的题目结构
export interface Problem {
  key?: string; // 用于拖拽排序的唯一标识
  problem: ProblemMetadata;
  statement: ProblemStatement;
}

// 语言选项类型
export type LanguageOption = "zh" | "en";
export type AutoLanguageOption = "auto" | LanguageOption;

// 比赛元数据
export interface ContestMetadata {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  language: LanguageOption;
  titlepage_language: AutoLanguageOption;
  problem_language: AutoLanguageOption;
  enable_titlepage: boolean;
  enable_header_footer: boolean;
  enable_problem_list: boolean;
}

// 图片元数据（用于存储）
export interface ImageMeta {
  uuid: string;
  name: string;
}

// 图片数据（包含 URL，用于运行时）
export interface ImageData extends ImageMeta {
  url: string; // Blob URL for display
}

// 完整的比赛配置（存储格式，不含 Blob URL）
export interface Contest {
  meta: ContestMetadata;
  problems: Problem[];
  images?: ImageMeta[];
}

// 比赛配置（运行时格式，包含 Blob URL）
export interface ContestWithImages {
  meta: ContestMetadata;
  problems: Problem[];
  images: ImageData[];
}

// 导出的图片数据
export interface ExportedImageData {
  uuid: string;
  name: string;
  data?: string; // base64 encoded
}

// 版本/快照
export interface Version {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  branchId: string;
  parentVersionId?: string;
  contest: Contest;
  images: ImageMeta[];
}

// 分支
export interface Branch {
  id: string;
  name: string;
  createdAt: number;
  currentVersionId: string;
}

// 导出的版本包
export interface ExportedVersions {
  type: "xcpc-versions";
  version: "1.0";
  exportedAt: number;
  branches: Branch[];
  versions: (Omit<Version, "contest" | "images"> & {
    contest: Contest;
    images: ExportedImageData[];
  })[];
}
