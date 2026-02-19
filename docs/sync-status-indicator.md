# 云同步状态指示器功能说明

## 概览

在题目编辑界面中新增了云同步状态指示器（云图标），用于显示当前题目数据和版本数据是否已与云端保持同步。

## 功能特性

### 状态显示

指示器支持以下四种状态：

| 状态 | 图标 | 颜色 | 含义 |
|------|------|------|------|
| **synced** | ☁️ | 绿色 | 数据已同步到云端 |
| **syncing** | ☁️↓ | 蓝色 | 正在同步数据中 |
| **pending** | ☁️ + 红点 | 橙色 | 本地有未同步的修改 |
| **disabled** | ☁️ | 灰色 | 未配置云同步 |

### 位置

云同步状态指示器出现在以下位置：

1. **桌面版本**
   - 左侧工具栏底部（在导出按钮上方）
   
2. **题目编辑界面**
   - 题目标题旁的工具栏中（在导出按钮左侧）
   
3. **移动版本**
   - 顶部工具栏中（在"添加题目"按钮左侧）

### 交互功能

- **点击指示器**：打开在线同步管理器
  - 在 `disabled` 或 `syncing` 状态下无法点击
  - 其他状态下点击可打开配置和上传/下载界面

- **悬停提示**：显示同步状态详情和最后同步时间
  - `synced`：显示"已同步: 时间"
  - `syncing`：显示"正在同步..."
  - `pending`：显示"待同步"（带红点提示）
  - `disabled`：显示"未配置"

## 实现细节

### 状态跟踪机制

1. **初始化**：应用启动时，从 localStorage 加载在线同步设置
2. **变化检测**：每当题目数据修改时，自动检测变化并更新状态
   - 如果数据与最后同步的数据不同，状态变为 `pending`
3. **同步更新**：执行上传/下载操作后，更新同步时间和状态

### 数据变化对比

系统通过对比以下数据来判断是否有未同步的修改：
- 题目标题和子标题 (`meta`)
- 题目列表及其内容 (`problems`)

> 注意：图片和版本历史数据的变化不影响同步状态指示（因为它们可以单独同步）

### 云同步管理器集成

- 打开在线同步管理器后，用户可以：
  - 查看当前同步配置
  - 测试连接
  - 上传数据到云端
  - 从云端下载数据
  
- 上传/下载完成后，指示器状态会自动更新

## 组件结构

### 新增组件

**SyncStatusIndicator** (`src/components/SyncStatusIndicator.tsx`)
- 独立的同步状态显示组件
- Props：
  - `status`: 同步状态
  - `lastSyncTime`: 最后同步时间戳
  - `onClick`: 点击回调

### 集成位置

1. **Sidebar.tsx** - 左侧工具栏
2. **MobileToolbar.tsx** - 移动版工具栏
3. **EditorArea.tsx** - 题目编辑界面
4. **index.tsx (ContestEditor)** - 主编辑器，管理状态

## 使用流程

```
1. 用户编辑题目
   ↓
2. 本地数据自动保存，状态变为 "pending"（橙色云图标）
   ↓
3. 用户点击云图标打开在线同步管理器
   ↓
4. 点击"上传到云端"按钮
   ↓
5. 同步过程中显示"syncing"状态（蓝色云图标，旋转）
   ↓
6. 同步完成，状态变为"synced"（绿色云图标）
```

## 样式特点

- **响应式设计**：在桌面和移动设备上都能正常显示
- **无障碍友好**：提供 `title` 属性显示详细信息
- **视觉反馈**：
  - 待同步时显示红点警告
  - 同步中时显示旋转动画
  - 各状态有不同的背景色悬停效果

## 技术细节

### 状态管理

```typescript
// 编辑器状态
const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending' | 'disabled'>('disabled');
const [lastSyncTime, setLastSyncTime] = useState<number | undefined>(undefined);
const lastSyncDataRef = useRef<string>(""); // 用于对比最后同步的数据
```

### 数据变化跟踪

```typescript
useEffect(() => {
  const currentDataStr = JSON.stringify({
    meta: contestData.meta,
    problems: contestData.problems,
  });

  // 检测数据变化
  if (lastSyncDataRef.current && currentDataStr !== lastSyncDataRef.current) {
    if (syncStatus === 'synced') {
      setSyncStatus('pending');
    }
  }
}, [contestData, syncStatus]);
```

### 同步完成后的处理

```typescript
onDataImported={(data) => {
  updateContestData(() => data);
  // 更新同步状态和时间
  setSyncStatus('synced');
  setLastSyncTime(Date.now());
  lastSyncDataRef.current = JSON.stringify({
    meta: data.meta,
    problems: data.problems,
  });
}}
```

## 未来改进方向

- 支持自动定时同步
- 显示同步进度百分比
- 冲突检测和合并机制
- 同步历史记录
- 离线修改暂存功能

---

最后更新：2026-02-19
