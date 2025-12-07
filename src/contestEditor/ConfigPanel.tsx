import { type FC } from "react";
import { Card, Form, Input, Button, Space, Switch, Select, Upload, App, Tooltip, Typography, Dropdown } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faInbox, faCopy, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import type { ContestWithImages, ProblemFormat, ImageData } from "@/types/contest";
import { saveImageToDB, deleteImageFromDB } from "@/utils/indexedDBUtils";

interface ConfigPanelProps {
  contestData: ContestWithImages;
  updateContestData: (update: (draft: ContestWithImages) => void) => void;
}

const ConfigPanel: FC<ConfigPanelProps> = ({ contestData, updateContestData }) => {
  const { message } = App.useApp();

  // Add image handler
  const handleAddImage = async (file: File) => {
    const uuid = crypto.randomUUID();
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);

    // Save to IndexedDB
    await saveImageToDB(uuid, blob);

    // Add to state
    updateContestData((draft) => {
      draft.images.push({
        uuid,
        name: file.name,
        url,
      });
    });

    message.success(`图片 "${file.name}" 上传成功`);
  };

  // Delete image handler
  const handleDeleteImage = async (index: number) => {
    const img = contestData.images[index];
    if (!img) return;

    // Revoke blob URL
    URL.revokeObjectURL(img.url);

    // Delete from IndexedDB
    await deleteImageFromDB(img.uuid);

    // Remove from state
    updateContestData((draft) => {
      draft.images.splice(index, 1);
    });

    message.success("图片已删除");
  };

  // Copy image reference to clipboard
  const handleCopyImageRef = (img: ImageData, format: "typst" | "latex" | "markdown") => {
    let ref: string;
    switch (format) {
      case "typst":
        ref = `#image("/asset/${img.uuid}")`;
        break;
      case "latex":
        ref = `\\includegraphics{/asset/${img.uuid}}`;
        break;
      case "markdown":
        ref = `![${img.name}](/asset/${img.uuid})`;
        break;
    }
    navigator.clipboard.writeText(ref);
    message.success("图片引用已复制到剪贴板");
  };

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

      <Card title="图片管理" size="small" style={{ marginBottom: 16 }}>
        <div className="image-upload-section">
          <Upload.Dragger
            name="add-image"
            beforeUpload={async (file) => {
              if (
                !["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(file.type)
              ) {
                message.error("不支持该图片类型，仅支持 PNG/JPEG/GIF/SVG");
                return Upload.LIST_IGNORE;
              }
              // Handle file directly here and prevent default upload
              try {
                await handleAddImage(file);
              } catch (err) {
                console.error("Failed to add image:", err);
                message.error("图片上传失败");
              }
              return false; // Prevent default upload behavior
            }}
            showUploadList={false}
            accept=".png,.jpg,.jpeg,.gif,.svg,image/png,image/jpeg,image/gif,image/svg+xml"
            multiple
          >
            <div className="upload-dragger-content">
              <FontAwesomeIcon icon={faInbox} size="2x" style={{ color: "#999" }} />
              <div style={{ marginTop: 8 }}>点击或拖拽上传图片</div>
              <div style={{ fontSize: 12, color: "#999" }}>支持 PNG/JPEG/GIF/SVG 格式</div>
            </div>
          </Upload.Dragger>

          {contestData.images.length > 0 && (
            <div className="image-list">
              {contestData.images.map((img, index) => (
                <div key={img.uuid} className="image-item">
                  <div className="image-thumbnail-container">
                    <img src={img.url} alt={img.name} className="image-thumbnail" />
                  </div>
                  <div className="image-info">
                    <Typography.Text ellipsis style={{ maxWidth: 120 }} title={img.name}>
                      {img.name}
                    </Typography.Text>
                    <div className="image-actions">
                      <Dropdown
                        menu={{
                          items: [
                            { key: "typst", label: "Typst" },
                            { key: "latex", label: "LaTeX" },
                            { key: "markdown", label: "Markdown" },
                          ],
                          onClick: ({ key }) => handleCopyImageRef(img, key as "typst" | "latex" | "markdown"),
                        }}
                        trigger={["click"]}
                      >
                        <Tooltip title="复制引用代码">
                          <Button type="text" size="small">
                            <FontAwesomeIcon icon={faCopy} />
                            <FontAwesomeIcon icon={faChevronDown} style={{ marginLeft: 4, fontSize: 10 }} />
                          </Button>
                        </Tooltip>
                      </Dropdown>
                      <Tooltip title="删除图片">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<FontAwesomeIcon icon={faTrash} />}
                          onClick={() => handleDeleteImage(index)}
                        />
                      </Tooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {contestData.images.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              点击复制按钮选择格式（Typst / LaTeX / Markdown）获取引用代码
            </div>
          )}
        </div>
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
