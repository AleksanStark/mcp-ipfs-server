import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import fetch from "node-fetch";

const IPFS_API_BASE = "http://3.25.111.209:5001/api/v0";

const server = new McpServer({
  name: "mcp-ipfs-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

interface IpfsResponse {
  Hash: string;
  Size: string;
}

async function addFileToIPFS(filePath: string): Promise<IpfsResponse | null> {
  const formData = new FormData();

  formData.append(
    "file",
    fs.createReadStream(filePath),
    path.basename(filePath)
  );

  try {
    const response = await fetch(`${IPFS_API_BASE}/add`, {
      method: "POST",
      headers: formData.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to add file to IPFS ${response.statusText}`);
    }

    const data = (await response.json()) as IpfsResponse;
    return data;
  } catch (error) {
    console.error("Error adding file to IPFS");
    return null;
  }
}

server.tool(
  "upload-file",
  {
    filePath: z
      .string()
      .describe("Enter absolute path to ypur file (e.g. /path/to/file.txt"),
  },
  async ({ filePath }) => {
    const ipfsData = await addFileToIPFS(filePath);

    if (!ipfsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve ipfs data",
          },
        ],
      };
    }

    const response = ipfsData || {};

    if (Object.values(response).length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "File not found or doesn't exists",
          },
        ],
      };
    }

    const alertsText = `File found and uploaded successfully ${response.Hash}, ${response.Size}`;

    return {
      content: [
        {
          type: "text",
          text: alertsText,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server working on stdio.");
}

main().catch((error) => {
  console.error("fatal error in main():", error);
  process.exit(1);
});
