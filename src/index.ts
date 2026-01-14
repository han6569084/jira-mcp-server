import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Version2Client } from "jira.js";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

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

const BulkTransitionSchema = z.object({
  issueKeys: z.array(z.string()),
  transitionName: z.string(),
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

/**
 * 核心逻辑：执行工具调用
 */
async function executeTool(name: string, args: any) {
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
      return `Successfully created issue: ${issue.key}`;
    }

    case "get_issue": {
      const { issueKey } = GetIssueSchema.parse(args);
      const issue = await jira.issues.getIssue({ issueIdOrKey: issueKey });
      return JSON.stringify(issue, null, 2);
    }

    case "get_issue_summary": {
      const { issueKey } = GetIssueSchema.parse(args);
      const issue = await jira.issues.getIssue({ issueIdOrKey: issueKey });
      const summary = {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        assignee: issue.fields.assignee?.displayName || "Unassigned",
        updated: issue.fields.updated,
      };
      return JSON.stringify(summary, null, 2);
    }

    case "get_transitions": {
      const { issueKey } = GetTransitionsSchema.parse(args);
      const transitions = await jira.issues.getTransitions({ issueIdOrKey: issueKey });
      return JSON.stringify(transitions, null, 2);
    }

    case "transition_issue": {
      const { issueKey, transitionId } = TransitionIssueSchema.parse(args);
      await jira.issues.doTransition({
        issueIdOrKey: issueKey,
        transition: { id: transitionId },
      });
      return `Successfully transitioned issue ${issueKey}`;
    }

    case "search_issues": {
      const { jql, maxResults } = SearchIssuesSchema.parse(args);
      const results = await jira.issueSearch.searchForIssuesUsingJql({
        jql,
        maxResults,
      });
      return JSON.stringify((results.issues || []).map((i: any) => ({
        key: i.key,
        summary: i.fields.summary,
        status: i.fields.status?.name,
        created: i.fields.created
      })), null, 2);
    }

    case "bulk_transition": {
      const { issueKeys, transitionName } = BulkTransitionSchema.parse(args);
      const results = [];
      for (const issueKey of issueKeys) {
        try {
          const transitions = await jira.issues.getTransitions({ issueIdOrKey: issueKey });
          const transition = transitions.transitions?.find(
            (t: any) => t.name?.toLowerCase() === transitionName.toLowerCase()
          );
          if (!transition) {
            results.push(`${issueKey}: Transition '${transitionName}' not found`);
            continue;
          }
          await jira.issues.doTransition({
            issueIdOrKey: issueKey,
            transition: { id: transition.id },
          });
          results.push(`${issueKey}: OK (${transitionName})`);
        } catch (error: any) {
          results.push(`${issueKey}: Error: ${error.message}`);
        }
      }
      return results.join("\n");
    }

    case "add_comment": {
      const { issueKey, comment } = AddCommentSchema.parse(args);
      await jira.issueComments.addComment({
        issueIdOrKey: issueKey,
        comment: comment,
      } as any);
      return `Successfully added comment to ${issueKey}`;
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
      if (startDate) fields.customfield_10101 = startDate;
      if (dueDate) fields.duedate = dueDate;
      await jira.issues.editIssue({
        issueIdOrKey: issueKey,
        fields,
      });
      return `Successfully updated issue ${issueKey}`;
    }

    case "delete_issue": {
      const { issueKey } = DeleteIssueSchema.parse(args);
      await jira.issues.deleteIssue({
        issueIdOrKey: issueKey,
      });
      return `Successfully deleted issue ${issueKey}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await executeTool(name, args);
    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// --- CLI 模式支持 ---
const args = process.argv.slice(2);
if (args.length > 0) {
  const [toolName, ...toolArgs] = args;
  try {
    // 简单的参数解析：如果是 JSON 则解析，否则作为字符串
    let parsedArgs = {};
    if (toolArgs[0]) {
      try {
        parsedArgs = JSON.parse(toolArgs.join(" "));
      } catch (e) {
        // 如果不是 JSON，尝试以 key=value 形式解析
        toolArgs.forEach(arg => {
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
console.error("JIRA Server (v2) MCP Server running on stdio");