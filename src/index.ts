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

interface IpfsAddResponse {
  Hash: string;
  Size: string;
}

interface IpfsPinResponse {
  Pins: Array<string>;
  Progress: bigint;
}

async function addFileToIPFS(
  filePath: string
): Promise<IpfsAddResponse | null> {
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

    const data = (await response.json()) as IpfsAddResponse;
    return data;
  } catch (error) {
    console.error("Error adding file to IPFS");
    return null;
  }
}

async function getFileFromIpfs(cid: string): Promise<string | null> {
  try {
    const response = await fetch(`${IPFS_API_BASE}/cat?arg=${cid}`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.statusText}`);
    }

    const data = await response.text();

    return data;
  } catch (error) {
    console.error("Error fetching file from IPFS: ", error);
    return null;
  }
}

async function pinIpfsFile(cid: string): Promise<IpfsPinResponse | null> {
  try {
    const response = await fetch(`${IPFS_API_BASE}/pin/add?arg=${cid}`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.statusText}`);
    }

    const data = (await response.json()) as IpfsPinResponse;

    return data;
  } catch (error) {
    console.error("Error fetching file from IPFS: ", error);
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
    const ipfsData = await addFileToIPFS(filePath);

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
    const ipfsFile = await getFileFromIpfs(cid);

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
    const ipfsPinFile = await pinIpfsFile(cid);

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
