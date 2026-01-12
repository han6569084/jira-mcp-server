# JIRA MCP Server

这是一个基于 Model Context Protocol (MCP) 的 JIRA 服务端实现，允许 AI 助手创建、查询和评论 JIRA 问题。

## 功能

该 MCP Server 提供了以下工具来操作 JIRA：

- **`create_issue`**: 创建新的 JIRA 问题。支持指定项目、总结、描述、问题类型及父任务（针对子任务）。
- **`get_issue`**: 获取指定 JIRA 问题的详细信息（JSON 格式）。
- **`get_transitions`**: 获取指定问题的可用状态流转列表。
- **`transition_issue`**: 执行状态流转，修改问题状态。
- **`search_issues`**: 使用 JQL（JIRA Query Language）搜索问题。
- **`add_comment`**: 为问题添加评论。
- **`update_issue`**: 更新问题详情。支持修改：
    - `assignee`: 经办人
    - `summary`: 摘要
    - `description`: 描述
    - `issueType`: 问题类型
    - `timeEstimate`: 时间预估 (如 `16h`, `2d`)
    - `startDate`: 开始日期 (格式 `YYYY-MM-DD`, 对应 `customfield_10101`)
    - `dueDate`: 到期日期 (格式 `YYYY-MM-DD`)
- **`delete_issue`**: 删除 JIRA 问题。

## 安装与配置

### 1. 准备环境变量

本项目针对 **JIRA Server (v8.12.2)** 进行了优化，使用 **Basic Auth (用户名/密码)** 进行认证。

你需要配置以下环境变量：

| 变量名 | 说明 | 示例 |
| :--- | :--- | :--- |
| `JIRA_HOST` | JIRA 实例的基础 URL | `https://jira.yourcompany.com` |
| `JIRA_USER` | JIRA 登录用户名 | `your_username` |
| `JIRA_PASSWORD` | JIRA 登录密码或 API Token | `your_password` |

### 2. 编译项目

在项目根目录下运行：
```bash
npm install
npm run build
```

### 3. 集成到 VS Code (GitHub Copilot)

1. **打开 VS Code 设置**：使用快捷键 `Ctrl+,` (Windows/Linux) 或 `Cmd+,` (macOS)。
2. **搜索 MCP**：在搜索栏输入 `mcp`，找到 **Extensions > GitHub Copilot > Chat: MCP: Servers** 配置项。
3. **编辑 settings.json**：点击 "Edit in settings.json"，添加以下配置：

```json
"github.copilot.chat.mcp.servers": [
  {
    "name": "jira",
    "command": "node",
    "args": ["/home/hanzj/workspace/mcp_server/jira-mcp-server/build/index.js"],
    "env": {
      "JIRA_HOST": "https://jira.yourcompany.com",
      "JIRA_USER": "your_username",
      "JIRA_PASSWORD": "your_password"
    }
  }
]
```

**注意**: 
- 请确保 `args` 中的路径为 `build/index.js` 的**绝对路径**。
- 如果你是通过 `.vscode/settings.json` (项目级) 配置，请确保该配置生效。

### 4. 在 Copilot Chat 中使用

1. 打开 VS Code 中的 Copilot Chat 窗格。
2. 输入 `#` 或 `/` 触发工具调用，或者直接在对话中描述 JIRA 相关任务（如“帮我查一下 ABC-123 的进度”）。
3. Copilot 会自动根据需要调用集成好的工具。

## 开发

- `npm run dev`: 监听文件变化并自动编译。
- `npm run build`: 手动编译。
