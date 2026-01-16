import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Version2Client } from "jira.js";

const jiraHost = process.env.JIRA_HOST || "";
const jiraUser = process.env.JIRA_USER || "";
const jiraPassword = process.env.JIRA_PASSWORD || "";

const jira = new Version2Client({
  host: jiraHost,
  authentication: {
    basic: { email: jiraUser, apiToken: jiraPassword },
  },
});

const server = new Server(
  { name: "jira-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "jira_get_issue",
        description: "Get full details of a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string" }
          },
          required: ["issueKey"]
        }
      },
      {
        name: "jira_search_issues",
        description: "Search for JIRA issues using JQL",
        inputSchema: {
          type: "object",
          properties: {
            jql: { type: "string" },
            maxResults: { type: "number" }
          },
          required: ["jql"]
        }
      },
      {
        name: "jira_get_transitions",
        description: "Get available transitions for a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string" }
          },
          required: ["issueKey"]
        }
      },
      {
        name: "jira_update_issue_status",
        description: "Update the status of a JIRA issue (Transition)",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string" },
            transitionId: { type: "string" }
          },
          required: ["issueKey", "transitionId"]
        }
      },
      {
        name: "jira_add_comment",
        description: "Add a comment to a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string" },
            body: { type: "string" }
          },
          required: ["issueKey", "body"]
        }
      }
    ]
  };
});

async function executeTool(name: string, a: any) {
  if (name === "jira_create_issue") {
    const res = await jira.issues.createIssue({
      fields: {
        project: { key: a.projectKey },
        summary: a.summary,
        description: a.description,
        issuetype: { name: a.issueType || "Task" }
      }
    });
    return `Success: ${res.key}`;
  }

  if (name === "jira_search_issues") {
    const res = await jira.issueSearch.searchForIssuesUsingJql({
      jql: a.jql,
      maxResults: a.maxResults || 50
    });
    return JSON.stringify(res, null, 2);
  }

  if (name === "jira_get_issue") {
    const res = await jira.issues.getIssue({ issueIdOrKey: a.issueKey });
    return JSON.stringify(res, null, 2);
  }

  if (name === "jira_get_transitions") {
    const res = await jira.issues.getTransitions({ issueIdOrKey: a.issueKey });
    return JSON.stringify(res, null, 2);
  }

  if (name === "jira_update_issue_status") {
    await jira.issues.doTransition({
      issueIdOrKey: a.issueKey,
      transition: { id: a.transitionId }
    });
    return `Transition successful for ${a.issueKey}`;
  }

  if (name === "jira_add_comment") {
    const res = await jira.issueComments.addComment({
      issueIdOrKey: a.issueKey,
      comment: a.body
    });
    return `Comment added to ${a.issueKey}`;
  }
  throw new Error(`Tool not found: ${name}`);
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: a } = request.params as any;
  try {
    const result = await executeTool(name, a);
    return { content: [{ type: "text", text: result }] };
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message || String(error) }]
    };
  }
});

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const [toolName, ...toolParams] = args;
    try {
      let parsedArgs = {};
      if (toolParams[0]) {
        try {
          parsedArgs = JSON.parse(toolParams.join(" "));
        } catch (e) {
          toolParams.forEach(arg => {
            const [k, v] = arg.split("=");
            if (k && v) (parsedArgs as any)[k] = v;
          });
        }
      }
      const result = await executeTool(toolName, parsedArgs);
      console.log(result);
      process.exit(0);
    } catch (error: any) {
      console.error(`CLI Error: ${error.message}`);
      process.exit(1);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
