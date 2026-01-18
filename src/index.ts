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
        name: "jira_create_issue",
        description: "Create a new JIRA issue with optional custom fields",
        inputSchema: {
          type: "object",
          properties: {
            projectKey: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            issueType: { type: "string", description: "Default is 'Bug' or 'Task'" },
            assignee: { type: "string" },
            severity: { type: "string", description: "P0, P1, P2, P3" },
            repairPlatform: { type: "string", description: "e.g. FW, Android, iOS" },
            discoveryStage: { type: "string", description: "e.g. 开发, 测试, Code Review" },
            probability: { type: "string", description: "e.g. 10%, 100%, 必现" },
            extraFields: { type: "object", description: "Additional raw field ID/value pairs" }
          },
          required: ["projectKey", "summary"]
        }
      },
      {
        name: "jira_update_issue",
        description: "Update fields of a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            assignee: { type: "string" },
            extraFields: { type: "object" }
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

const FIELD_MAP: Record<string, string> = {
  "severity": "customfield_10401",
  "repairPlatform": "customfield_10404",
  "discoveryStage": "customfield_11000",
  "probability": "customfield_10716"
};

const VALUE_MAP: Record<string, Record<string, string>> = {
  "severity": { "P0": "10301", "P1": "10302", "P2": "10303", "P3": "10304" },
  "repairPlatform": { "FW": "10311", "Android": "10309", "iOS": "10310" },
  "discoveryStage": { "开发": "11000", "测试": "11001", "Code Review": "11730" },
  "probability": { "10%": "10625", "100%": "10623", "必现": "10623" }
};

async function executeTool(name: string, a: any) {
  if (name === "jira_create_issue") {
    const fields: any = {
      project: { key: a.projectKey },
      summary: a.summary,
      description: a.description,
      issuetype: { name: a.issueType || "Bug" }
    };
    
    // Add versions if creating for COLOGNE
    if (a.projectKey === "COLOGNE") {
       fields.versions = [{ id: "66200" }];
    }

    if (a.assignee) fields.assignee = { name: a.assignee };
    
    // Map helper fields
    for (const [key, fieldId] of Object.entries(FIELD_MAP)) {
      if (a[key]) {
        const val = VALUE_MAP[key]?.[a[key]] || a[key];
        fields[fieldId] = { id: val };
      }
    }

    if (a.extraFields) Object.assign(fields, a.extraFields);

    const res = await jira.issues.createIssue({ fields });
    return `Success: ${res.key}`;
  }

  if (name === "jira_update_issue") {
    const fields: any = {};
    if (a.summary) fields.summary = a.summary;
    if (a.description) fields.description = a.description;
    if (a.assignee) fields.assignee = { name: a.assignee };
    if (a.extraFields) Object.assign(fields, a.extraFields);
    
    await jira.issues.editIssue({ issueIdOrKey: a.issueKey, fields });
    return `Success: Updated ${a.issueKey}`;
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
