/**
 * Polygon 比赛包转换器
 * 将 Codeforces Polygon 格式的比赛包转换为 Contest 类型
 */

import JSZip from 'jszip';
import type {
  Contest,
  ContestMetadata,
  Problem,
  ProblemFormat,
} from '../types/contest';

/**
 * Polygon problem-properties.json 的接口定义
 */
interface PolygonProblemProperties {
  name: string;
  legend: string;
  input?: string;
  output?: string;
  notes?: string;
  sampleTests?: Array<{
    input: string;
    output: string;
    inputFile?: string;
    outputFile?: string;
  }>;
  timeLimit?: number;
  memoryLimit?: number;
}

/**
 * 解析后的 contest.xml 结构
 */
interface ParsedContestXml {
  contest: {
    url: string;
    names: Array<{
      name: Array<{
        $: {
          language: string;
          value: string;
        };
      }>;
    }>;
    problems: Array<{
      problem: Array<{
        $: {
          index: string;
          url: string;
        };
      }>;
    }>;
  };
}

/**
 * ZIP 文件中的虚拟文件
 */
interface VirtualFile {
  path: string;
  content: string | Uint8Array;
  isText: boolean;
}

/**
 * Polygon 比赛包转换器类
 */
export class PolygonContestConverter {
  private virtualFiles: VirtualFile[] = [];

  /**
   * 从比赛包目录转换为 Contest 对象
   * @param packageFiles - 比赛包中的所有文件（FileList 或 File 数组）
   * @returns Promise<Contest>
   */
  async convertToContest(packageFiles: FileList | File[]): Promise<Contest> {
    // 将 FileList 转换为 File 数组
    const files = Array.from(packageFiles);

    // 检查是否是 ZIP 文件
    if (files.length === 1 && files[0].name.endsWith('.zip')) {
      await this.extractZipFile(files[0]);
    } else {
      // 直接从文件列表加载
      this.virtualFiles = await Promise.all(
        files.map(async (file) => ({
          path: file.webkitRelativePath || file.name,
          content: await file.text(),
          isText: true,
        }))
      );
    }

    // 1. 解析 contest.xml
    const contestXml = await this.parseContestXml();

    // 2. 构建元数据
    const meta = this.extractContestMetadata(contestXml);

    // 3. 处理所有题目
    const problems = await this.processProblems(contestXml);

    return { meta, problems };
  }

  /**
   * 解压 ZIP 文件
   */
  private async extractZipFile(zipFile: File): Promise<void> {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(await zipFile.arrayBuffer());

    this.virtualFiles = [];

    for (const [path, zipEntry] of Object.entries(zipData.files)) {
      if (zipEntry.dir) continue;

      // 判断文件类型
      const isText =
        path.endsWith('.xml') ||
        path.endsWith('.json') ||
        path.endsWith('.tex') ||
        path.endsWith('.md') ||
        path.endsWith('.typ') ||
        path.endsWith('.txt');

      const content = isText
        ? await zipEntry.async('string')
        : await zipEntry.async('uint8array');

      this.virtualFiles.push({
        path,
        content,
        isText,
      });
    }
  }

  /**
   * 查找虚拟文件
   */
  private findFile(pattern: string | RegExp): VirtualFile | undefined {
    if (typeof pattern === 'string') {
      return this.virtualFiles.find(
        (f) => f.path.endsWith(pattern) || f.path.includes(pattern)
      );
    } else {
      return this.virtualFiles.find((f) => pattern.test(f.path));
    }
  }

  /**
   * 查找所有匹配的虚拟文件
   */
  private findFiles(pattern: string | RegExp): VirtualFile[] {
    if (typeof pattern === 'string') {
      return this.virtualFiles.filter(
        (f) => f.path.includes(pattern) || f.path.endsWith(pattern)
      );
    } else {
      return this.virtualFiles.filter((f) => pattern.test(f.path));
    }
  }

  /**
   * 解析 contest.xml 文件
   */
  private async parseContestXml(): Promise<ParsedContestXml> {
    const contestXmlFile = this.findFile('contest.xml');

    if (!contestXmlFile) {
      throw new Error('contest.xml not found in package');
    }

    const xmlContent =
      typeof contestXmlFile.content === 'string'
        ? contestXmlFile.content
        : new TextDecoder().decode(contestXmlFile.content);

    return this.parseXmlContent(xmlContent);
  }

  /**
   * 解析 XML 内容（简化版，不依赖外部库）
   */
  private parseXmlContent(xmlContent: string): ParsedContestXml {
    // 提取比赛 URL
    const urlMatch = xmlContent.match(/contest\s+url="([^"]+)"/);
    const url = urlMatch ? urlMatch[1] : '';

    // 提取比赛名称
    const nameMatch = xmlContent.match(
      /name\s+language="([^"]+)"\s+value="([^"]+)"/
    );
    const language = nameMatch ? nameMatch[1] : 'chinese';
    const value = nameMatch ? nameMatch[2] : 'Unknown Contest';

    // 提取所有题目
    const problemMatches = Array.from(
      xmlContent.matchAll(
        /<problem\s+index="([^"]+)"\s+url="([^"]+)"/g
      )
    );

    const problems = problemMatches.map((match) => ({
      $: {
        index: match[1],
        url: match[2],
      },
    }));

    return {
      contest: {
        url,
        names: [
          {
            name: [
              {
                $: {
                  language,
                  value,
                },
              },
            ],
          },
        ],
        problems: [{ problem: problems }],
      },
    };
  }

  /**
   * 从解析的 XML 中提取比赛元数据
   */
  private extractContestMetadata(contestXml: ParsedContestXml): ContestMetadata {
    const contestUrl = contestXml.contest.url;
    const contestName =
      contestXml.contest.names[0]?.name[0]?.$?.value || 'Unknown Contest';

    const contestId = this.extractContestId(contestUrl);
    const currentDate = new Date().toISOString().split('T')[0];

    return {
      title: contestName,
      subtitle: `Contest ID: ${contestId}`,
      author: 'Polygon Package',
      date: currentDate,
      language: 'zh',
      enable_titlepage: true,
      enable_header_footer: true,
      enable_problem_list: true,
    };
  }

  /**
   * 从 URL 中提取比赛 ID
   */
  private extractContestId(contestUrl: string): string {
    const match = contestUrl.match(/\/c\/(\d+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * 处理所有题目
   */
  private async processProblems(
    contestXml: ParsedContestXml
  ): Promise<Problem[]> {
    const problems: Problem[] = [];
    const problemNodes = contestXml.contest.problems[0]?.problem || [];

    for (const problemNode of problemNodes) {
      const problemUrl = problemNode.$.url;
      const problemId = this.extractProblemId(problemUrl);

      try {
        const problem = await this.convertProblem(problemId);
        problems.push(problem);
      } catch (error) {
        console.warn(`Failed to process problem ${problemId}:`, error);
        // 创建一个默认的题目对象
        problems.push(this.createDefaultProblem(problemId));
      }
    }

    return problems;
  }

  /**
   * 从 URL 中提取题目 ID
   */
  private extractProblemId(problemUrl: string): string {
    const parts = problemUrl.split('/');
    return parts[parts.length - 1];
  }

  /**
   * 转换单个题目
   */
  private async convertProblem(problemId: string): Promise<Problem> {
    // 查找题目的 problem-properties.json 文件
    const propertiesFile = this.findFile(
      new RegExp(`problems/${problemId}/.*problem-properties\\.json$`)
    );

    if (!propertiesFile) {
      throw new Error(
        `problem-properties.json not found for problem ${problemId}`
      );
    }

    const jsonText =
      typeof propertiesFile.content === 'string'
        ? propertiesFile.content
        : new TextDecoder().decode(propertiesFile.content);

    const jsonContent: PolygonProblemProperties = JSON.parse(jsonText);

    // 检测格式
    const format = await this.detectFormat(problemId);

    return {
      problem: {
        display_name: jsonContent.name || 'Unknown Problem',
        format,
        samples: (jsonContent.sampleTests || []).map((test) => ({
          input: test.input,
          output: test.output,
        })),
      },
      statement: {
        description: jsonContent.legend || '',
        input: jsonContent.input,
        output: jsonContent.output,
        notes: jsonContent.notes || undefined,
      },
    };
  }

  /**
   * 检测题目格式
   */
  private async detectFormat(problemId: string): Promise<ProblemFormat> {
    const problemFiles = this.findFiles(`problems/${problemId}/statements`);

    const formatChecks: Array<{ filename: string; format: ProblemFormat }> = [
      { filename: 'problem.typ', format: 'typst' },
      { filename: 'problem.md', format: 'markdown' },
      { filename: 'problem.tex', format: 'latex' },
    ];

    for (const { filename, format } of formatChecks) {
      if (problemFiles.some((f) => f.path.endsWith(filename))) {
        return format;
      }
    }

    // 默认返回 latex
    return 'latex';
  }

  /**
   * 创建默认的题目对象
   */
  private createDefaultProblem(problemId: string): Problem {
    return {
      problem: {
        display_name: problemId,
        format: 'latex',
        samples: [],
      },
      statement: {
        description: 'Problem description not available',
        input: 'Input format not available',
        output: 'Output format not available',
      },
    };
  }
}

/**
 * 验证转换后的比赛数据
 */
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

/**
 * 验证 Contest 对象的完整性
 */
export function validateContest(contest: Contest): ValidationResult {
  const issues: string[] = [];

  // 检查必填字段
  if (!contest.meta.title) {
    issues.push('Missing contest title');
  }
  if (!contest.problems.length) {
    issues.push('No problems found');
  }

  // 检查每个题目
  contest.problems.forEach((problem, index) => {
    if (!problem.problem.display_name) {
      issues.push(`Problem ${index}: Missing display name`);
    }
    if (!problem.statement.description) {
      issues.push(`Problem ${index}: Missing description`);
    }
    if (!problem.problem.samples.length) {
      issues.push(`Problem ${index}: No samples found`);
    }
  });

  return { isValid: issues.length === 0, issues };
}

/**
 * 辅助函数：从 input 元素加载比赛包
 */
export async function loadPolygonPackage(
  files: FileList | File[]
): Promise<Contest> {
  const converter = new PolygonContestConverter();
  const contest = await converter.convertToContest(files);

  // 验证转换结果
  const validation = validateContest(contest);
  if (!validation.isValid) {
    console.warn('Contest validation issues:', validation.issues);
  }

  return contest;
}
