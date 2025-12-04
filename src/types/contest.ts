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
  problem: ProblemMetadata;
  statement: ProblemStatement;
}

// 比赛元数据
export interface ContestMetadata {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  enable_titlepage: boolean;
  enable_header_footer: boolean;
  enable_problem_list: boolean;
}

// 完整的比赛配置
export interface Contest {
  meta: ContestMetadata;
  problems: Problem[];
}
