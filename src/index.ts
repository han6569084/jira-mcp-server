import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Version2Client } from "jira.js";
import { z } from "zod";

// Initialize JIRA client
const jiraHost = process.env.JIRA_HOST;
const jiraUser = process.env.JIRA_USER || process.env.JIRA_EMAIL;
const jiraPassword = process.env.JIRA_PASSWORD || process.env.JIRA_API_TOKEN;

if (!jiraHost || !jiraUser || !jiraPassword) {
  console.error("Missing required environment variables: JIRA_HOST, JIRA_USER, JIRA_PASSWORD");
  process.exit(1);
}

// For JIRA Server v8.12.2, we use Version2Client and Basic Auth
// Note: jira.js uses 'email' and 'apiToken' fields for Basic Auth, 
// but for JIRA Server these are actually 'username' and 'password'.
const jira = new Version2Client({
  host: jiraHost,
  authentication: {
    basic: {
      email: jiraUser,
      apiToken: jiraPassword,
    },
  },
});

const server = new Server(
  {
    name: "jira-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
const CreateIssueSchema = z.object({
  projectKey: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  issueType: z.string().default("Task"),
  parent: z.string().optional(),
});

const GetIssueSchema = z.object({
  issueKey: z.string(),
});

const GetTransitionsSchema = z.object({
  issueKey: z.string(),
});

const TransitionIssueSchema = z.object({
  issueKey: z.string(),
  transitionId: z.string(),
});

const SearchIssuesSchema = z.object({
  jql: z.string(),
  maxResults: z.number().optional().default(10),
});

const AddCommentSchema = z.object({
  issueKey: z.string(),
  comment: z.string(),
});

const UpdateIssueSchema = z.object({
  issueKey: z.string(),
  assignee: z.string().optional(),
  issueType: z.string().optional(),
  parent: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  timeEstimate: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});

const DeleteIssueSchema = z.object({
  issueKey: z.string(),
});

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_issue",
        description: "Create a new JIRA issue (JIRA Server)",
        inputSchema: {
          type: "object",
          properties: {
            projectKey: { type: "string", description: "The project key (e.g., PROJ)" },
            summary: { type: "string", description: "The issue summary/title" },
            description: { type: "string", description: "The issue description" },
            issueType: { type: "string", description: "The issue type", default: "Task" },
            parent: { type: "string", description: "Parent issue key (for sub-tasks)" },
          },
          required: ["projectKey", "summary"],
        },
      },
      {
        name: "get_issue",
        description: "Get details of a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "The issue key" },
          },
          required: ["issueKey"],
        },
      },
      {
        name: "get_transitions",
        description: "Get available transitions for a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "The issue key" },
          },
          required: ["issueKey"],
        },
      },
      {
        name: "transition_issue",
        description: "Transition a JIRA issue to a new status",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "The issue key" },
            transitionId: { type: "string", description: "The transition ID" },
          },
          required: ["issueKey", "transitionId"],
        },
      },
      {
        name: "search_issues",
        description: "Search for JIRA issues using JQL",
        inputSchema: {
          type: "object",
          properties: {
            jql: { type: "string", description: "The JQL query string" },
            maxResults: { type: "number", description: "Max results", default: 10 },
          },
          required: ["jql"],
        },
      },
      {
        name: "add_comment",
        description: "Add a comment to a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "The issue key" },
            comment: { type: "string", description: "The comment text" },
          },
          required: ["issueKey", "comment"],
        },
      },
      {
        name: "update_issue",
        description: "Update a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "The issue key" },
            assignee: { type: "string", description: "Assignee username" },
            issueType: { type: "string", description: "Issue type (e.g., Task, Sub-task)" },
            parent: { type: "string", description: "Parent issue key (for sub-tasks)" },
            summary: { type: "string", description: "Issue summary" },
            description: { type: "string", description: "Issue description" },
            timeEstimate: { type: "string", description: "Time estimate (e.g., 16h, 2d)" },
            startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
            dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
          },
          required: ["issueKey"],
        },
      },
      {
        name: "delete_issue",
        description: "Delete a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "The issue key" },
          },
          required: ["issueKey"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_issue": {
        const { projectKey, summary, description, issueType, parent } = CreateIssueSchema.parse(args);
        const fields: any = {
          project: { key: projectKey },
          summary,
          description: description,
          issuetype: { name: issueType },
        };
        if (parent) {
          fields.parent = { key: parent };
        }
        const issue = await jira.issues.createIssue({
          fields,
        });
        return {
          content: [{ type: "text", text: `Successfully created issue: ${issue.key}` }],
        };
      }

      case "get_issue": {
        const { issueKey } = GetIssueSchema.parse(args);
        const issue = await jira.issues.getIssue({ issueIdOrKey: issueKey });
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "get_transitions": {
        const { issueKey } = GetTransitionsSchema.parse(args);
        const transitions = await jira.issues.getTransitions({ issueIdOrKey: issueKey });
        return {
          content: [{ type: "text", text: JSON.stringify(transitions, null, 2) }],
        };
      }

      case "transition_issue": {
        const { issueKey, transitionId } = TransitionIssueSchema.parse(args);
        try {
          await jira.issues.doTransition({
            issueIdOrKey: issueKey,
            transition: { id: transitionId },
          });
        } catch (error: any) {
          if (error.response && error.response.data) {
            throw new Error(`JIRA Error: ${JSON.stringify(error.response.data)}`);
          }
          throw error;
        }
        return {
          content: [{ type: "text", text: `Successfully transitioned issue ${issueKey}` }],
        };
      }

      case "search_issues": {
        const { jql, maxResults } = SearchIssuesSchema.parse(args);
        const results = await jira.issueSearch.searchForIssuesUsingJql({
          jql,
          maxResults,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(results.issues, null, 2) }],
        };
      }

      case "add_comment": {
        const { issueKey, comment } = AddCommentSchema.parse(args);
        // In jira.js Version 2, the field is 'comment'
        await jira.issueComments.addComment({
          issueIdOrKey: issueKey,
          comment: comment,
        } as any);
        return {
          content: [{ type: "text", text: `Successfully added comment to ${issueKey}` }],
        };
      }

      case "update_issue": {
        const { issueKey, assignee, issueType, parent, summary, description, timeEstimate, startDate, dueDate } = UpdateIssueSchema.parse(args);
        const fields: any = {};
        if (assignee) fields.assignee = { name: assignee };
        if (issueType) fields.issuetype = { name: issueType };
        if (parent) fields.parent = { key: parent };
        if (summary) fields.summary = summary;
        if (description) fields.description = description;
        if (timeEstimate) fields.timetracking = { originalEstimate: timeEstimate };
        if (startDate) fields.customfield_10101 = startDate; // Start date field
        if (dueDate) fields.duedate = dueDate;
        await jira.issues.editIssue({
          issueIdOrKey: issueKey,
          fields,
        });
        return {
          content: [{ type: "text", text: `Successfully updated issue ${issueKey}` }],
        };
      }

      case "delete_issue": {
        const { issueKey } = DeleteIssueSchema.parse(args);
        await jira.issues.deleteIssue({
          issueIdOrKey: issueKey,
        });
        return {
          content: [{ type: "text", text: `Successfully deleted issue ${issueKey}` }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("JIRA Server (v2) MCP Server running on stdio");