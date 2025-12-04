import { type FC } from "react";
import { Card, Form, Input, Button, Space, Switch, Select } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { Contest, ProblemFormat } from "@/types/contest";

interface ConfigPanelProps {
  contestData: Contest;
  updateContestData: (update: (draft: Contest) => void) => void;
}

const ConfigPanel: FC<ConfigPanelProps> = ({ contestData, updateContestData }) => {
  return (
    <div className="config-panel">
      <Card title="比赛配置" size="small" style={{ marginBottom: 16 }}>
        <Form layout="vertical" size="small">
          <Form.Item label="比赛标题">
            <Input
              value={contestData.meta.title}
              onChange={(e) => updateContestData((d) => { d.meta.title = e.target.value; })}
              placeholder="输入比赛标题"
            />
          </Form.Item>
          <Form.Item label="比赛副标题">
            <Input
              value={contestData.meta.subtitle}
              onChange={(e) => updateContestData((d) => { d.meta.subtitle = e.target.value; })}
              placeholder="输入比赛副标题"
            />
          </Form.Item>
          <Form.Item label="作者/主办方">
            <Input
              value={contestData.meta.author}
              onChange={(e) => updateContestData((d) => { d.meta.author = e.target.value; })}
              placeholder="输入作者或主办方"
            />
          </Form.Item>
          <Form.Item label="比赛日期">
            <Input
              value={contestData.meta.date}
              onChange={(e) => updateContestData((d) => { d.meta.date = e.target.value; })}
              placeholder="输入比赛日期"
            />
          </Form.Item>
          <Form.Item>
            <Switch
              checked={contestData.meta.enable_titlepage}
              onChange={(checked) => updateContestData((d) => { d.meta.enable_titlepage = checked; })}
            />
            <span style={{ marginLeft: 8 }}>生成标题页</span>
          </Form.Item>
          <Form.Item>
            <Switch
              checked={contestData.meta.enable_header_footer}
              onChange={(checked) => updateContestData((d) => { d.meta.enable_header_footer = checked; })}
            />
            <span style={{ marginLeft: 8 }}>显示页眉/页尾</span>
          </Form.Item>
          <Form.Item>
            <Switch
              checked={contestData.meta.enable_problem_list}
              onChange={(checked) => updateContestData((d) => { d.meta.enable_problem_list = checked; })}
            />
            <span style={{ marginLeft: 8 }}>显示试题列表</span>
          </Form.Item>
        </Form>
      </Card>

      <Card title="题目列表" size="small">
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          {contestData.problems.map((problem, index) => (
            <Card key={index} size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <Input
                  size="small"
                  placeholder={`题目 ${index + 1} 名称`}
                  value={problem.problem.display_name}
                  onChange={(e) => updateContestData((d) => { d.problems[index].problem.display_name = e.target.value; })}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>格式:</span>
                  <Select<ProblemFormat>
                    size="small"
                    value={problem.problem.format || "latex"}
                    onChange={(value) => updateContestData((d) => { d.problems[index].problem.format = value; })}
                    options={[
                      { label: "LaTeX", value: "latex" },
                      { label: "Markdown", value: "markdown" },
                      { label: "Typst", value: "typst" },
                    ]}
                    style={{ flex: 1 }}
                  />
                </div>
                <Input.TextArea
                  size="small"
                  placeholder="题目描述"
                  value={problem.statement.description}
                  onChange={(e) => updateContestData((d) => { d.problems[index].statement.description = e.target.value; })}
                  rows={3}
                />
                <Input.TextArea
                  size="small"
                  placeholder="输入格式"
                  value={problem.statement.input || ""}
                  onChange={(e) => updateContestData((d) => { d.problems[index].statement.input = e.target.value; })}
                  rows={2}
                />
                <Input.TextArea
                  size="small"
                  placeholder="输出格式"
                  value={problem.statement.output || ""}
                  onChange={(e) => updateContestData((d) => { d.problems[index].statement.output = e.target.value; })}
                  rows={2}
                />
                <Input.TextArea
                  size="small"
                  placeholder="提示"
                  value={problem.statement.notes || ""}
                  onChange={(e) => updateContestData((d) => { d.problems[index].statement.notes = e.target.value; })}
                  rows={2}
                />

                <div style={{ fontSize: 12, color: "#666" }}>样例输入输出:</div>
                {problem.problem.samples.map((sample, sIdx) => (
                  <div key={sIdx} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12 }}>样例 {sIdx + 1}</span>
                      {problem.problem.samples.length > 1 && (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<FontAwesomeIcon icon={faTrash} />}
                          onClick={() => updateContestData((d) => { d.problems[index].problem.samples.splice(sIdx, 1); })}
                        />
                      )}
                    </div>
                    <Input.TextArea
                      size="small"
                      placeholder="输入"
                      value={sample.input}
                      onChange={(e) => updateContestData((d) => { d.problems[index].problem.samples[sIdx].input = e.target.value; })}
                      rows={2}
                      style={{ marginBottom: 4, fontFamily: "monospace" }}
                    />
                    <Input.TextArea
                      size="small"
                      placeholder="输出"
                      value={sample.output}
                      onChange={(e) => updateContestData((d) => { d.problems[index].problem.samples[sIdx].output = e.target.value; })}
                      rows={2}
                      style={{ fontFamily: "monospace" }}
                    />
                  </div>
                ))}
                <Button
                  type="dashed"
                  size="small"
                  icon={<FontAwesomeIcon icon={faPlus} />}
                  onClick={() => updateContestData((d) => { d.problems[index].problem.samples.push({ input: "", output: "" }); })}
                  style={{ width: "100%" }}
                >
                  添加样例
                </Button>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<FontAwesomeIcon icon={faTrash} />}
                  onClick={() => updateContestData((d) => { d.problems.splice(index, 1); })}
                >
                  删除题目
                </Button>
              </Space>
            </Card>
          ))}

          <Button
            type="dashed"
            icon={<FontAwesomeIcon icon={faPlus} />}
            onClick={() => updateContestData((d) => {
              d.problems.push({
                problem: { display_name: `题目 ${d.problems.length + 1}`, samples: [{ input: "", output: "" }] },
                statement: { description: "", input: "", output: "", notes: "" },
              });
            })}
            style={{ width: "100%" }}
          >
            添加题目
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default ConfigPanel;
