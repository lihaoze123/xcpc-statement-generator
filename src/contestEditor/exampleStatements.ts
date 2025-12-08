import type { Contest } from "@/types/contest";

export const exampleStatements: Record<string, Contest> = {
  SupportedGrammar: {
    meta: {
      title: "这是一场 XCPC 程序设计竞赛",
      subtitle: "试题册",
      author: "初梦",
      date: "2025 年 12 月 4 日",
      language: "zh",
      enable_titlepage: true,
      enable_header_footer: true,
      enable_problem_list: true,
    },
    problems: [
      {
        problem: {
          display_name: "Hello, World!",
          samples: [
            { input: "World", output: "Hello, World!" },
            { input: "Typst", output: "Hello, Typst!" }
          ],
          format: "latex"
        },
        statement: {
          description: "\\begin{tabular}{ll}\n    Input file: & standard input \\\\\n    Output file: & standard output \\\\\n    Time Limit: & 1 second \\\\\n    Memory Limit: & 512 megabytes \\\\\n\\end{tabular}\n\n给定一个字符串 $S$，输出 “Hello, $S$!”",
          input: "输入一个字符串 $S$。",
          output: "输出答案。",
          notes: "字符串长度不超过 100。",
        },
      },
      {
        problem: {
          display_name: "A + B",
          samples: [
            { input: "1 2", output: "3" },
            { input: "10 20", output: "30" }
          ],
          format: "latex"
        },
        statement: {
          description: "计算 $A + B$ 的值。",
          input: "输入两个整数 $A$ 和 $B$。",
          output: "输出 $A + B$ 的值。",
          notes: "$-10^9 \\leq A, B \\leq 10^9$。",
        },
      },
      {
        problem: {
          display_name: "回文串判断",
          samples: [
            { input: "racecar", output: "Yes" },
            { input: "hello", output: "No" },
            { input: "a", output: "Yes" }
          ],
          format: "latex"
        },
        statement: {
          description: "给定一个字符串，判断它是否为回文串（正读和反读都一样的字符串）。",
          input: "输入一个字符串 $S$。",
          output: "如果是回文串输出 \\texttt{Yes}，否则输出 \\texttt{No}。",
          notes: "字符串长度不超过 $10^5$。",
        },
      },
      {
        problem: {
          display_name: "数组排序",
          samples: [
            { input: "5\n3 1 4 2 5", output: "1 2 3 4 5" },
            { input: "3\n5 5 5", output: "5 5 5" }
          ],
          format: "latex"
        },
        statement: {
          description: "给定一个数组，将其排序后输出。",
          input: "第一行输入一个整数 $n$（$1 \\leq n \\leq 1000$），表示数组长度。\n\n第二行输入 $n$ 个整数，表示数组元素。",
          output: "输出排序后的数组，元素之间用空格分隔。",
          notes: "数组元素范围在 $-10^6$ 到 $10^6$ 之间。",
        },
      },
      {
        problem: {
          display_name: "LaTeX 示例 (Demo)",
          samples: [
            { input: "3", output: "6" },
            { input: "5", output: "120" }
          ],
          format: "latex"
        },
        statement: {
          description: "计算 $n$ 的阶乘。\n\n\\textbf{Definition:} The factorial of a non-negative integer $n$ is the product of all positive integers less than or equal to $n$.",
          input: "输入一个整数 $n$（$0 \\le n \\le 20$）。",
          output: "输出 $n!$ 的值。",
          notes: "请注意 $20! = 2,432,902,008,176,640,000$ 。",
        },
      },
      {
        problem: {
          display_name: "Markdown 示例 (Demo)",
          samples: [
            { input: "5", output: "1 4 9 16 25" },
            { input: "3", output: "1 4 9" }
          ],
          format: "markdown"
        },
        statement: {
          description: "对于给定的整数 $n$，输出从 $1$ 到 $n$ 所有整数的平方。\n\n**示例：**\n- 当 $n = 3$ 时，输出 `1 4 9`\n- 当 $n = 5$ 时，输出 `1 4 9 16 25`\n\n### 公式\n\n每个整数的平方可以通过以下公式计算：\n\n$$x^2 = x \\times x$$\n\n其中 $x$ 是从 $1$ 到 $n$ 的整数。",
          input: "第一行输入一个整数 $n$（$1 \\le n \\le 1000$）。",
          output: "输出 $n$ 个数，第 $i$ 个数是 $i^2$，数之间用空格分隔。",
          notes: "### 数据范围\n- $1 \\le n \\le 1000$\n- 结果在 32 位整数范围内\n\n### 提示\n可以使用循环或公式直接计算。",
        },
      },
    ],
  }
};
