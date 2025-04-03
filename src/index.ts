import {
  McpServer,
  ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { record, z } from "zod";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import fetch from "node-fetch";
import { text } from "stream/consumers";

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

interface IpfsObject {
  Hash: string;
  Links: IpfsLink[];
}

interface IpfsLink {
  Hash: string;
  ModTime: string;
  Mode: number;
  Name: string;
  Size: number;
  Target: string;
  Type: number;
}

interface IpfsLsResponse {
  Objects: IpfsObject[];
}

async function makeIpfsRequest<T>(
  url: string,
  method?: "POST" | "GET" | "PUT" | "DELETE",
  type?: "text" | "json",
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

    if (type === "text") {
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
      "text",

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

    if (!ipfsFile) {
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
          text: ipfsFile,
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

server.tool(
  "list-folder",
  "List contents of an IPFS directory",
  {
    cid: z
      .string()
      .describe("Please enter your CID for shows list of files from IPFS"),
  },
  async ({ cid }) => {
    const ipfsFolderList = await makeIpfsRequest<IpfsLsResponse>(
      `ls?arg=${cid}`,
      "POST"
    );

    if (!ipfsFolderList) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to get file list",
          },
        ],
      };
    }

    const formattedIpfsFolderList = ipfsFolderList.Objects.flatMap((item) =>
      item.Links.map((link) =>
        [
          `Hash: ${link.Hash}`,
          `ModTime: ${link.ModTime}`,
          `Mode: ${link.Mode}`,
          `Name: ${link.Name}`,
          `Size: ${link.Size}`,
          `Target: ${link.Target}`,
          `Type: ${link.Type}`,
        ].join("\n")
      )
    );

    return {
      content: [
        {
          type: "text",
          text: `File list has been successfully retrived: \n ${formattedIpfsFolderList.join(
            "\n"
          )}`,
        },
      ],
    };
  }
);

server.tool(
  "remove-file",
  "Delete a file from IPFS",
  {
    filePath: z
      .string()
      .describe("Please enter the CID to delete the file from ipfs"),
  },
  async ({ filePath }) => {
    const result = await makeIpfsRequest<string>(
      `files/rm?arg=${filePath}`,
      "POST",
      "text"
    );

    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to remove file",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: result,
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
