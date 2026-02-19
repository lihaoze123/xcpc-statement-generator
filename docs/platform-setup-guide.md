# 在线同步平台配置指南

本项目支持四个云存储平台用于题目数据和版本控制的在线备份。选择适合你的平台并按照以下步骤配置。

## 目录
1. [腾讯云 COS](#腾讯云-cos)
2. [阿里云 OSS](#阿里云-oss)
3. [GitHub](#github)
4. [Cloudflare R2](#cloudflare-r2)

---

## 腾讯云 COS

### 特点
- ✅ 国内速度快，支持多个地域
- ✅ 纯前端实现，无后端依赖
- ✅ 付费透明，按使用量计费

### 配置步骤

#### 1. 获取 API 密钥
1. 登录[腾讯云控制台](https://console.cloud.tencent.com/)
2. 进入 **访问管理** → **用户** → **API 密钥管理**
3. 点击 **新建密钥**，记录以下内容：
   - **Secret ID**：如 `AKIDXXXXXXXXXXXXXXXX`
   - **Secret Key**：如 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### 2. 创建 COS 存储桶
1. 进入 **对象存储 COS** 服务
2. 点击 **创建存储桶**
3. 填写配置：
   - **存储桶名称**：如 `xcpc-backup-1234567890`
   - **所属地域**：选择距离最近的地域（如 `ap-guangzhou`）
   - **访问权限**：选择 **私有读写**（重要！）

#### 3. 配置 CORS 规则
这是**最重要的一步**，否则浏览器会因为同源策略而无法访问。

1. 点击创建好的存储桶
2. 进入 **安全管理** → **跨域资源共享（CORS）**
3. 点击 **编辑**，添加以下规则：

```
允许的来源：http://localhost:5173 （开发环境）
允许的来源：https://yourdomain.com （生产域名）
允许的方法：PUT、GET、POST、DELETE、HEAD
允许的头部：*
暴露的头部：x-cos-version-id
最大有效期：3600
```

#### 4. 在应用中配置
1. 打开应用的在线同步管理器
2. 选择 **腾讯云 COS**
3. 填入以下信息：
   - **Secret ID**：你的 Secret ID
   - **Secret Key**：你的 Secret Key
   - **Bucket**：存储桶名称（如 `xcpc-backup-1234567890`）
   - **Region**：存储桶所在地域（如 `ap-guangzhou`）
4. 点击 **测试连接** 验证配置
5. 点击 **保存配置**

### 常见问题

**Q: 遇到 CORS 错误怎么办？**
A: 请确保已在腾讯云控制台配置了 CORS 规则，并且来源地址与应用实际访问地址相符。

**Q: 如何查看已备份的数据？**
A: 登录腾讯云控制台，进入 COS 存储桶，可以看到 `xcpc-statement-generator/` 目录下的所有备份文件。

---

## 阿里云 OSS

### 特点
- ✅ 国内速度快，大文件传输优化
- ✅ 完整的权限管理系统
- ✅ 低廉的存储成本

### 配置步骤

#### 1. 获取 Access Key
1. 登录[阿里云控制台](https://console.aliyun.com/)
2. 进入 **访问控制 (RAM)** → **用户** 
3. 点击 **创建用户**，或使用现有用户
4. 点击用户名 → **用户详情**
5. 在 **访问密钥** 部分点击 **创建访问密钥**
6. 记录以下内容：
   - **Access Key ID**
   - **Access Key Secret**

#### 2. 配置 RAM 权限
1. 回到 RAM 用户页面
2. 点击 **添加权限**
3. 搜索并选择 **AliyunOSSFullAccess** 权限
4. 点击 **确定**

#### 3. 创建 OSS 存储桶
1. 进入 **对象存储 OSS**
2. 点击 **创建存储桶**
3. 填写配置：
   - **存储桶名称**：如 `xcpc-backup`
   - **所在地域**：选择距离最近的地域（如 `oss-cn-hangzhou`）
   - **访问权限**：选择 **私有**
4. 创建存储桶

#### 4. 配置跨域 (CORS)
1. 点击创建好的存储桶
2. 进入 **基础设置** → **跨域设置**
3. 点击 **设置**，添加以下规则：

```
来源：http://localhost:5173
来源：https://yourdomain.com
允许的方法：PUT, GET, POST, DELETE, HEAD
允许的头部：*
暴露的头部：x-oss-version-id
缓存时间：3600
```

#### 5. 在应用中配置
1. 打开应用的在线同步管理器
2. 选择 **阿里云 OSS**
3. 填入以下信息：
   - **Access Key ID**：你的 Access Key ID
   - **Access Key Secret**：你的 Access Key Secret
   - **Bucket**：存储桶名称（如 `xcpc-backup`）
   - **Region**：所在地域（如 `oss-cn-hangzhou`）
4. 点击 **测试连接** 验证配置
5. 点击 **保存配置**

### 常见问题

**Q: Access Key Secret 丢失了怎么办？**
A: 无法恢复，需要删除后重新创建新的 Access Key。

**Q: 存储桶中的数据可以持久化吗？**
A: 是的，OSS 中的数据会永久保存，直到主动删除。

---

## GitHub

### 特点
- ✅ 免费存储（有公私仓选项）
- ✅ 内置版本控制和历史记录
- ✅ 方便的代码审查和协作
- ⚠️ 文件大小限制（单文件 100MB）

### 配置步骤

#### 1. 创建 GitHub Personal Access Token
1. 登录 [GitHub](https://github.com/)
2. 进入 **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. 点击 **Generate new token (classic)**
4. 填写配置：
   - **Token name**：`xcpc-statement-generator`
   - **Expiration**：选择合适的过期时间（建议 90 天）
   - **Scopes**：选择以下权限：
     - ✅ `repo` - 完整仓库访问
     - ✅ `user:email` - 访问用户邮箱
5. 点击 **Generate token**
6. **立即复制并保存** Token（刷新后将无法再看到）

#### 2. 创建备份仓库
1. 点击 GitHub 头像 → **Your repositories**
2. 点击 **New**
3. 填写配置：
   - **Repository name**：`xcpc-statement-backup`
   - **Description**：可选，如 "XCPC 题目备份"
   - **Visibility**：选择 **Private**（建议）
   - **Initialize with README**：取消勾选
4. 点击 **Create repository**

#### 3. 在应用中配置
1. 打开应用的在线同步管理器
2. 选择 **GitHub**
3. 填入以下信息：
   - **Personal Access Token**：你的 Token
   - **Repository**：格式为 `username/repo-name`（如 `octocat/xcpc-statement-backup`）
4. 点击 **测试连接** 验证配置
5. 点击 **保存配置**

### 常见问题

**Q: Token 安全吗？**
A: Token 存储在浏览器本地 localStorage 中。为了安全，建议：
- 不要在公共电脑上使用
- 定期轮换 Token
- 如果泄露，立即删除并重新生成

**Q: 仓库会变得非常大吗？**
A: 是的，频繁上传会导致仓库变大。可以定期创建新的仓库或清理历史记录。

**Q: 能否在 GitHub Pages 上预览？**
A: 可以，但需要手动在设置中启用。题目数据是 JSON 格式，不是网页。

---

## Cloudflare R2

### 特点
- ✅ 兼容 S3 API，成本低
- ✅ 全球 CDN 加速
- ✅ 无 egress 费用（很便宜！）
- ⚠️ 需要 Cloudflare 账户

### 配置步骤

#### 1. 获取 R2 API 令牌
1. 登录 [Cloudflare 控制面板](https://dash.cloudflare.com/)
2. 进入 **R2** 服务
3. 点击 **创建存储桶** 或进入现有存储桶
4. 进入 **设置** → **R2 API 令牌**
5. 点击 **创建 API 令牌**
6. 填写配置：
   - **令牌名称**：`xcpc-sync`
   - **权限**：选择 **Admin Read & Write**
   - **TTL**：设置过期时间
7. 点击 **创建令牌**
8. 记录以下信息：
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID**（R2 API 调用时需要）

#### 2. 创建 R2 存储桶
1. 在 R2 首页点击 **创建存储桶**
2. 填写配置：
   - **存储桶名称**：`xcpc-backup`
   - 其他选项使用默认值
3. 点击 **创建存储桶**

#### 3. 配置 CORS（可选但推荐）
1. 进入存储桶 → **设置**
2. 在 **CORS** 部分添加规则：

```json
[
  {
    "allowedOrigins": [
      "http://localhost:5173",
      "https://yourdomain.com"
    ],
    "allowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "allowedHeaders": ["*"]
  }
]
```

#### 4. 在应用中配置
1. 打开应用的在线同步管理器
2. 选择 **Cloudflare R2**
3. 填入以下信息：
   - **Access Key ID**：你的 Access Key ID
   - **Secret Access Key**：你的 Secret Access Key
   - **Bucket**：存储桶名称（如 `xcpc-backup`）
   - **Account ID**：你的 Account ID
4. 点击 **测试连接** 验证配置
5. 点击 **保存配置**

### 常见问题

**Q: Account ID 在哪里找？**
A: 登录 Cloudflare，进入 R2，在任何存储桶页面的 URL 或左侧信息栏中可以看到。

**Q: R2 比 S3 便宜吗？**
A: 是的！R2 **没有 egress 费用**，这对频繁下载数据非常省钱。

---

## 平台对比

| 功能 | COS | OSS | GitHub | R2 |
|------|-----|-----|--------|-----|
| 国内速度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 免费额度 | 小 | 小 | ✅ | ✅ |
| 存储成本 | 中 | 低 | 低/免费 | 最低 |
| 配置复杂度 | 中 | 中 | 简单 | 中 |
| 文件大小限制 | 无 | 无 | 100MB | 无 |
| 推荐用途 | 国内生产 | 国内生产 | 全球/小规模 | 全球/成本优先 |

## 最佳实践

1. **开发环境**：使用 GitHub 或本地存储
2. **国内生产**：使用腾讯云 COS 或阿里云 OSS
3. **国际化应用**：使用 Cloudflare R2
4. **多备份策略**：配置多个平台进行异地备份
5. **定期检查**：每个月检查一次备份数据的完整性

## 故障排查

### 通用问题

**问题：测试连接失败**
- ✓ 检查网络连接是否正常
- ✓ 确认输入的凭证是否正确
- ✓ 确认 CORS 规则已配置（如适用）
- ✓ 浏览器控制台查看具体错误信息

**问题：上传速度很慢**
- ✓ 检查网络连接带宽
- ✓ 尝试压缩图片尺寸
- ✓ 选择更近的地域

**问题：数据上传后消失了**
- ✓ 检查是否设置了生命周期规则（自动删除）
- ✓ 确认存储桶权限设置正确
- ✓ 检查是否选错了存储桶

---

## 安全建议

⚠️ **重要**：永远不要在公开仓库或论坛上分享你的凭证：
- Secret Key / Access Key Secret
- 个人 Token
- API 密钥

如果不小心泄露：
1. 立即停用该凭证
2. 创建新的凭证
3. 更新应用中的配置

---

需要帮助？查看应用内的错误信息或文档部分的其他文件。
