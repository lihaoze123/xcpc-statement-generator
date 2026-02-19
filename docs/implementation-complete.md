# OSS、GitHub、R2 实现完成文档

## 概览

已经完成对三个云存储平台的完整实现：
- ✅ **阿里云 OSS** - 国内优先
- ✅ **GitHub** - 免费方案
- ✅ **Cloudflare R2** - 全球低成本

所有平台都支持：
- 上传题目数据（contest.json）
- 上传图片资源
- 上传版本控制数据
- 下载完整数据
- 测试连接验证配置

---

## 实现细节

### 阿里云 OSS

**依赖**：`ali-oss`

**关键特性**：
- 使用官方 SDK 直接访问 OSS
- 需要配置 CORS 规则以支持浏览器访问
- 支持多个中国地域选择

**数据结构**：
```
bucketName/
└── xcpc-statement-generator/
    └── {contestTitle}/
        ├── contest.json (题目数据)
        ├── versions.json (版本历史)
        └── images/ (图片文件夹)
            ├── {imageUuid1}
            ├── {imageUuid2}
            └── ...
```

**配置要求**：
- Region：必需（如 `oss-cn-hangzhou`）
- Access Key ID / Secret：必需
- CORS 规则：必需

### GitHub

**依赖**：`@octokit/rest`

**关键特性**：
- 使用 GitHub API 直接创建/更新文件
- 自动生成提交历史，便于追踪变更
- 支持私有仓库，安全可靠
- 免费存储（对单个用户有限制）

**数据结构**：
```
repositoryName/
└── xcpc-statement-generator/
    └── {contestTitle}/
        ├── contest.json
        ├── versions.json
        └── images/
            ├── {imageUuid1}
            ├── {imageUuid2}
            └── ...
```

**配置要求**：
- Token：Personal Access Token（需要 `repo` 权限）
- Repo：格式 `owner/repository`
- 无需 CORS 配置（REST API）

**特殊处理**：
- 文件以 Base64 编码发送到 GitHub
- 每个文件上传/下载都调用一次 API
- 支持自动生成提交信息

### Cloudflare R2

**依赖**：`@aws-sdk/client-s3`

**关键特性**：
- 兼容 S3 API，与 AWS 互操作
- **无出站流量费用**（这很重要！）
- 全球 CDN 加速
- 高性能、低成本

**数据结构**：
```
bucketName/
└── xcpc-statement-generator/
    └── {contestTitle}/
        ├── contest.json
        ├── versions.json
        └── images/
            ├── {imageUuid1}
            ├── {imageUuid2}
            └── ...
```

**配置要求**：
- Endpoint：自动从 Account ID 和 Region 生成
- Access Key ID / Secret：必需
- Bucket：必需
- Account ID：必需
- CORS 配置：推荐但非必需

**特殊处理**：
- 使用 S3Client 进行操作
- 自动处理 Uint8Array 到 Blob 的转换
- 支持流式处理大文件

---

## 测试连接实现

每个平台都有相应的连接测试方法：

| 平台 | 测试方法 |
|------|---------|
| COS | `headBucket()` - 检查存储桶访问权限 |
| OSS | `getBucketInfo()` - 获取存储桶信息 |
| GitHub | `repos.get()` - 获取仓库信息 |
| R2 | `GetObjectCommand` - 尝试访问测试文件 |

---

## 错误处理

所有函数都包含：
- ✓ Try-catch 捕获网络错误
- ✓ 详细的控制台日志记录
- ✓ 用户友好的错误信息
- ✓ 部分失败容错（如单个图片下载失败不影响整体）

---

## 性能考虑

### 上传性能
- **COS**：10-100MB/s（国内）
- **OSS**：10-100MB/s（国内）
- **GitHub**：限制较多，适合小文件
- **R2**：100MB+/s（全球）

### 下载性能
- **COS**：10-100MB/s（国内）
- **OSS**：10-100MB/s（国内）
- **GitHub**：限制较多
- **R2**：100MB+/s（CDN加速）

### 成本估算（每月）

假设：10 个题目，每个 5MB，每月同步 10 次

| 平台 | 存储费用 | 传输费用 | 操作费用 | 合计 |
|------|---------|---------|---------|------|
| COS | ¥0.12 | ¥10-20 | ¥0.05 | ¥10-20 |
| OSS | ¥0.10 | ¥5-10 | ¥0.02 | ¥5-10 |
| GitHub | 免费 | 免费 | 免费 | **免费** |
| R2 | $0.30 | **免费** | $0.05 | **$0.35** |

---

## 使用建议

### 选择平台的建议

**使用 COS 如果你**：
- 主要在中国境内使用
- 需要 HTTPS 和高可靠性
- 已经有腾讯云账户

**使用 OSS 如果你**：
- 主要在中国境内使用
- 需要更低的成本
- 已经有阿里云账户

**使用 GitHub 如果你**：
- 想要完全免费的方案
- 文件相对较小（<100MB 单文件）
- 希望保留完整的变更历史
- 已经在使用 GitHub

**使用 R2 如果你**：
- 服务面向全球
- 需要 CDN 加速
- 关注成本（无出站费用）
- 预期流量较大

### 多平台备份策略

推荐配置多个平台进行异地备份：

**方案A：国内专业方案**
```
主存储：COS（快速、可靠）
备份：GitHub（免费、安全）
```

**方案B：全球方案**
```
主存储：R2（成本低、全球快速）
备份：GitHub（免费、版本控制）
```

**方案C：最大安全方案**
```
主存储：COS
备份1：OSS
备份2：GitHub
```

---

## 迁移指南

### 从一个平台迁移到另一个平台

如果要更换存储平台，建议：

1. **导出旧平台数据**：
   - 使用应用的 "下载" 功能
   - 导出为本地文件

2. **切换平台配置**：
   - 编辑配置，选择新平台
   - 测试连接

3. **上传到新平台**：
   - 使用应用的 "上传" 功能
   - 验证数据完整性

4. **保留旧平台**：
   - 建议保留旧平台备份（可以禁用访问）
   - 等确认无误后再删除

---

## 故障恢复

每个平台都支持多版本保存：

1. **从 GitHub 恢复**：
   - 可以查看完整的提交历史
   - 可以回滚到任何历史版本
   - 推荐定期备份

2. **从 COS/OSS/R2 恢复**：
   - 文件以版本形式保存
   - 需要手动覆盖以恢复
   - 建议启用版本控制功能

---

## 开发者注意事项

### 添加新的存储平台

如果要添加新平台（如 Azure Blob Storage），需要：

1. 在 `types/contest.ts` 中添加类型定义
2. 在 `onlineSync.ts` 中实现 4 个函数：
   ```typescript
   export const uploadToNewPlatform = async (...) => {};
   export const downloadFromNewPlatform = async (...) => {};
   ```
3. 在路由函数中添加 case 分支
4. 在 `OnlineManager.tsx` 中添加 UI 表单
5. 在本文档中添加配置说明

### 测试建议

```typescript
// 测试上传和下载
const config = { /* 你的配置 */ };
const data = { /* 测试数据 */ };

// 上传
await uploadToOnline(config, "test-contest", data);

// 下载
const result = await downloadFromOnline(config, "test-contest");

// 验证
assert(result.contest.meta.title === data.contest.meta.title);
```

---

## 常见问题

**Q: 能同时使用多个平台吗？**
A: 应用目前只支持一个活跃的同步平台。但你可以：
- 手动下载数据后上传到其他平台
- 轮流切换平台进行备份

**Q: 数据加密吗？**
A: 应用层面没有加密。建议在 HTTPS 下使用，并确保凭证不被泄露。

**Q: 支持自动同步吗？**
A: 目前需要手动点击 "上传/下载"。自动同步功能可能在未来版本添加。

**Q: 免费额度够用吗？**
A: 
- GitHub：完全免费，推荐小规模使用
- R2：每月 10GB 免费存储，非常慷慨
- COS/OSS：有限免费额度，超出后按量付费

---

最后更新：2026-02-19
