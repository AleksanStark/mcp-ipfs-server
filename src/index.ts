import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import fetch from "node-fetch";
import { url } from "inspector";

const IPFS_API_BASE = "http://3.25.111.209:5001/api/v0";

const server = new McpServer({
  name: "mcp-ipfs-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

interface IpfsAddResponse {
  Hash: string;
  Size: string;
}

interface IpfsPinResponse {
  Pins: Array<string>;
  Progress: bigint;
}

async function makeIpfsRequest<T>(
  url: string,
  method?: string,
  headers?: HeadersInit,
  body?: FormData
): Promise<T | null> {
  try {
    const response = await fetch(`${IPFS_API_BASE}/${url}`, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`HTTP Error! status code: ${response.statusText}`);
    }

    let data;

    if (url.includes("cat")) {
      data = (await response.text()) as T;
      return data;
    }

    data = (await response.json()) as T;
    return data;
  } catch (error) {
    console.error("Failed to retrive data");
    return null;
  }
}

server.tool(
  "upload-file",
  "Upload a file to IPFS and get its CID.",
  {
    filePath: z
      .string()
      .describe(
        "Enter the absolute path to your file (e.g., /path/to/file.txt)."
      ),
  },
  async ({ filePath }) => {
    const formData = new FormData();

    formData.append(
      "file",
      fs.createReadStream(filePath),
      path.basename(filePath)
    );

    const ipfsData = await makeIpfsRequest<IpfsAddResponse>(
      "add",
      "POST",
      formData.getHeaders(),
      formData
    );

    if (!ipfsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to upload file to IPFS.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `File uploaded successfully!\nCID: ${ipfsData.Hash}\nSize: ${ipfsData.Size} bytes`,
        },
      ],
    };
  }
);

server.tool(
  "get-file",
  "Retrieve a file from IPFS using its CID.",
  {
    cid: z.string().describe("Enter the CID of the file you want to retrieve."),
  },
  async ({ cid }) => {
    const ipfsFile = await makeIpfsRequest<string>(`cat?arg=${cid}`, "POST");

    if (!ipfsFile || ipfsFile.trim().length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "File not found or does not exist on IPFS.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `File successfully retrieved:\n${ipfsFile}`,
        },
      ],
    };
  }
);

server.tool(
  "pin-file",
  "Pin a file in IPFS using it's CID",
  {
    cid: z.string().describe("Please enter your CID for pin a file on IPFS"),
  },
  async ({ cid }) => {
    const ipfsPinFile = await makeIpfsRequest<IpfsPinResponse>(
      `pin/add?arg=${cid}`,
      "POST"
    );

    if (!ipfsPinFile) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to pin file on IPFS",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `The file has been successfully pinned: \n Pins: ${ipfsPinFile.Pins}`,
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
