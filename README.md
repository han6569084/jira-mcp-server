# JIRA MCP Server

这是一个基于 Model Context Protocol (MCP) 的 JIRA 服务端实现，允许 AI 助手创建、查询和评论 JIRA 问题。

## 功能

- `create_issue`: 创建新的 JIRA 问题。
- `get_issue`: 获取 JIRA 问题的详细信息。
- `search_issues`: 使用 JQL 搜索问题。
- `add_comment`: 为问题添加评论。

## 安装与配置

### 1. 准备 JIRA 凭据 (JIRA Server v8.12.2)

由于你的 JIRA 版本是 8.12.2，不支持 Personal Access Tokens (PAT)，你需要使用 **用户名** 和 **密码** 进行认证。

你需要以下信息：
- **JIRA_HOST**: 你的企业 JIRA 地址 (例如 `http://jira.yourcompany.com`)。
- **JIRA_USER**: 你的 JIRA 登录用户名。
- **JIRA_PASSWORD**: 你的 JIRA 登录密码。

### 2. 编译项目

在项目根目录下运行：
```bash
npm install
npm run build
```

### 3. 集成到 Claude Desktop

编辑你的 `claude_desktop_config.json` 文件，添加以下配置：

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/home/hanzj/workspace/mcp_server/jira-mcp-server/build/index.js"],
      "env": {
        "JIRA_HOST": "http://jira.yourcompany.com",
        "JIRA_USER": "your_username",
        "JIRA_PASSWORD": "your_password"
      }
    }
  }
}
```

**注意**: 请将 `/path/to/jira-mcp-server/build/index.js` 替换为该文件的实际绝对路径。

### 4. 重启 Claude Desktop

重启后，你应该能在 Claude 中看到 JIRA 相关的工具。

## 开发

- `npm run dev`: 监听文件变化并自动编译。
- `npm run build`: 手动编译。
