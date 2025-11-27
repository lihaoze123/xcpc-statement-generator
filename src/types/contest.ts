/**
 * 比赛和题目相关的 TypeScript 类型定义
 * 基于 olymp-in-typst 的数据结构
 */

// 样例输入输出对
export interface Sample {
  input: string;
  output: string;
}

// 题目元数据
export interface ProblemMetadata {
  display_name: string;    // 题目名称
  latex?: boolean;         // 是否使用 LaTeX 渲染，默认 false
  markdown?: boolean;      // 是否使用 Markdown 渲染，默认 false
  samples: Sample[];       // 输入输出样例数组
}

// 题目描述
export interface ProblemStatement {
  description: string;     // 题目详细描述，支持数学表达式
  input?: string;          // 输入格式说明
  output?: string;         // 输出格式说明
  notes?: string;          // 约束条件和提示
}

// 完整的题目结构
export interface Problem {
  problem: ProblemMetadata;
  statement: ProblemStatement;
}

// 比赛元数据
export interface ContestMetadata {
  title: string;           // 比赛标题
  subtitle: string;        // 比赛副标题
  author: string;          // 作者/主办方
  date: string;            // 比赛日期
  enable_titlepage: boolean; // 是否生成标题页
}

// 完整的比赛配置
export interface Contest {
  meta: ContestMetadata;
  problems: Problem[];
}