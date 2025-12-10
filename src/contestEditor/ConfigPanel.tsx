import { type FC } from "react";
import { Card, Form, Input, Button, Space, Switch, Select, Upload, App, Tooltip, Typography, Dropdown } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faInbox, faCopy, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import Editor from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import type { ContestWithImages, ProblemFormat, ImageData, AutoLanguageOption } from "@/types/contest";
import { saveImageToDB, deleteImageFromDB } from "@/utils/indexedDBUtils";

interface ConfigPanelProps {
  contestData: ContestWithImages;
  updateContestData: (update: (draft: ContestWithImages) => void) => void;
}

const ConfigPanel: FC<ConfigPanelProps> = ({ contestData, updateContestData }) => {
  const { message } = App.useApp();
  const { t } = useTranslation();

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

    message.success(t('messages:imageUploadSuccess', { name: file.name }));
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

    message.success(t('messages:imageDeleted'));
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
    message.success(t('messages:imageCopied'));
  };

  return (
    <div className="config-panel">
      <Card title={t('editor:contestConfig')} size="small" style={{ marginBottom: 16 }}>
        <Form layout="vertical" size="small">
          <Form.Item label={t('editor:contestTitle')}>
            <Input
              value={contestData.meta.title}
              onChange={(e) => updateContestData((d) => { d.meta.title = e.target.value; })}
              placeholder={t('editor:inputPlaceholder', { field: t('editor:contestTitle') })}
            />
          </Form.Item>
          <Form.Item label={t('editor:contestSubtitle')}>
            <Input
              value={contestData.meta.subtitle}
              onChange={(e) => updateContestData((d) => { d.meta.subtitle = e.target.value; })}
              placeholder={t('editor:inputPlaceholder', { field: t('editor:contestSubtitle') })}
            />
          </Form.Item>
          <Form.Item label={t('editor:author')}>
            <Input
              value={contestData.meta.author}
              onChange={(e) => updateContestData((d) => { d.meta.author = e.target.value; })}
              placeholder={t('editor:inputPlaceholder', { field: t('editor:author') })}
            />
          </Form.Item>
          <Form.Item label={t('editor:contestDate')}>
            <Input
              value={contestData.meta.date}
              onChange={(e) => updateContestData((d) => { d.meta.date = e.target.value; })}
              placeholder={t('editor:inputPlaceholder', { field: t('editor:contestDate') })}
            />
          </Form.Item>
          <Form.Item>
            <Switch
              checked={contestData.meta.enable_titlepage}
              onChange={(checked) => updateContestData((d) => { d.meta.enable_titlepage = checked; })}
            />
            <span style={{ marginLeft: 8 }}>{t('editor:enableTitlepage')}</span>
          </Form.Item>
          <Form.Item>
            <Switch
              checked={contestData.meta.enable_header_footer}
              onChange={(checked) => updateContestData((d) => { d.meta.enable_header_footer = checked; })}
            />
            <span style={{ marginLeft: 8 }}>{t('editor:enableHeaderFooter')}</span>
          </Form.Item>
          <Form.Item>
            <Switch
              checked={contestData.meta.enable_problem_list}
              onChange={(checked) => updateContestData((d) => { d.meta.enable_problem_list = checked; })}
            />
            <span style={{ marginLeft: 8 }}>{t('editor:enableProblemList')}</span>
          </Form.Item>
          <Form.Item>
            <Switch
              checked={contestData.meta.language === "en"}
              onChange={(checked) => updateContestData((d) => { d.meta.language = checked ? "en" : "zh"; })}
            />
            <span style={{ marginLeft: 8 }}>{t('editor:englishMode')}</span>
          </Form.Item>
          <Form.Item label={t('editor:titlepageLanguage')}>
            <Select<AutoLanguageOption>
              size="small"
              value={contestData.meta.titlepage_language || "auto"}
              onChange={(value) => updateContestData((d) => { d.meta.titlepage_language = value; })}
              options={[
                { label: t('editor:languageAuto'), value: "auto" },
                { label: t('editor:languageChinese'), value: "zh" },
                { label: t('editor:languageEnglish'), value: "en" },
              ]}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label={t('editor:problemLanguage')}>
            <Select<AutoLanguageOption>
              size="small"
              value={contestData.meta.problem_language || "auto"}
              onChange={(value) => updateContestData((d) => { d.meta.problem_language = value; })}
              options={[
                { label: t('editor:languageAuto'), value: "auto" },
                { label: t('editor:languageChinese'), value: "zh" },
                { label: t('editor:languageEnglish'), value: "en" },
              ]}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card title={t('editor:imageManagement')} size="small" style={{ marginBottom: 16 }}>
        <div className="image-upload-section">
          <Upload.Dragger
            name="add-image"
            beforeUpload={async (file) => {
              if (
                !["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(file.type)
              ) {
                message.error(t('messages:unsupportedImageType'));
                return Upload.LIST_IGNORE;
              }
              // Handle file directly here and prevent default upload
              try {
                await handleAddImage(file);
              } catch (err) {
                console.error("Failed to add image:", err);
                message.error(t('messages:imageUploadFailed'));
              }
              return false; // Prevent default upload behavior
            }}
            showUploadList={false}
            accept=".png,.jpg,.jpeg,.gif,.svg,image/png,image/jpeg,image/gif,image/svg+xml"
            multiple
          >
            <div className="upload-dragger-content">
              <FontAwesomeIcon icon={faInbox} size="2x" style={{ color: "#999" }} />
              <div style={{ marginTop: 8 }}>{t('editor:clickOrDragUpload')}</div>
              <div style={{ fontSize: 12, color: "#999" }}>{t('editor:supportedFormats')}</div>
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
                        <Tooltip title={t('editor:copyReference')}>
                          <Button type="text" size="small">
                            <FontAwesomeIcon icon={faCopy} />
                            <FontAwesomeIcon icon={faChevronDown} style={{ marginLeft: 4, fontSize: 10 }} />
                          </Button>
                        </Tooltip>
                      </Dropdown>
                      <Tooltip title={t('editor:deleteImage')}>
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
              {t('editor:copyReferenceHint')}
            </div>
          )}
        </div>
      </Card>

      <Card title={t('editor:problemList')} size="small">
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          {contestData.problems.map((problem, index) => (
            <Card key={index} size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <Input
                  size="small"
                  placeholder={t('editor:problemName', { number: index + 1 })}
                  value={problem.problem.display_name}
                  onChange={(e) => updateContestData((d) => { d.problems[index].problem.display_name = e.target.value; })}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>{t('editor:format')}</span>
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
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{t('editor:problemDescription')}</div>
                  <Editor
                    height="150px"
                    language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                    value={problem.statement.description}
                    onChange={(value) => updateContestData((d) => { d.problems[index].statement.description = value || ""; })}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: "off",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      wrappingIndent: "same",
                    }}
                    theme="vs-light"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{t('editor:inputFormat')}</div>
                  <Editor
                    height="100px"
                    language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                    value={problem.statement.input || ""}
                    onChange={(value) => updateContestData((d) => { d.problems[index].statement.input = value || ""; })}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: "off",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      wrappingIndent: "same",
                    }}
                    theme="vs-light"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{t('editor:outputFormat')}</div>
                  <Editor
                    height="100px"
                    language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                    value={problem.statement.output || ""}
                    onChange={(value) => updateContestData((d) => { d.problems[index].statement.output = value || ""; })}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: "off",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      wrappingIndent: "same",
                    }}
                    theme="vs-light"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{t('editor:hints')}</div>
                  <Editor
                    height="100px"
                    language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                    value={problem.statement.notes || ""}
                    onChange={(value) => updateContestData((d) => { d.problems[index].statement.notes = value || ""; })}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: "off",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      wrappingIndent: "same",
                    }}
                    theme="vs-light"
                  />
                </div>

                <div style={{ fontSize: 12, color: "#666" }}>{t('editor:sampleInputOutput')}</div>
                {problem.problem.samples.map((sample, sIdx) => (
                  <div key={sIdx} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>{t('editor:sampleNumber', { number: sIdx + 1 })}</span>
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
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>{t('editor:input')}</div>
                    <Editor
                      height="60px"
                      language="plaintext"
                      value={sample.input}
                      onChange={(value) => updateContestData((d) => { d.problems[index].problem.samples[sIdx].input = value || ""; })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "off",
                        scrollBeyondLastLine: false,
                        wordWrap: "off",
                        wrappingIndent: "same",
                        fontFamily: "monospace",
                      }}
                      theme="vs-light"
                    />
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 2, marginTop: 4 }}>{t('editor:output')}</div>
                    <Editor
                      height="60px"
                      language="plaintext"
                      value={sample.output}
                      onChange={(value) => updateContestData((d) => { d.problems[index].problem.samples[sIdx].output = value || ""; })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "off",
                        scrollBeyondLastLine: false,
                        wordWrap: "off",
                        wrappingIndent: "same",
                        fontFamily: "monospace",
                      }}
                      theme="vs-light"
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
                  {t('editor:addSample')}
                </Button>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<FontAwesomeIcon icon={faTrash} />}
                  onClick={() => updateContestData((d) => { d.problems.splice(index, 1); })}
                >
                  {t('editor:deleteProblem')}
                </Button>
              </Space>
            </Card>
          ))}

          <Button
            type="dashed"
            icon={<FontAwesomeIcon icon={faPlus} />}
            onClick={() => updateContestData((d) => {
              d.problems.push({
                problem: { display_name: t('editor:problemPlaceholder', { number: d.problems.length + 1 }), samples: [{ input: "", output: "" }] },
                statement: { description: "", input: "", output: "", notes: "" },
              });
            })}
            style={{ width: "100%" }}
          >
            {t('editor:addProblem')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default ConfigPanel;
