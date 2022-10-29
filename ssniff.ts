import EventEmitter from "events";
import { fork, ChildProcess } from "child_process";
import fs from "fs";
import fastify, { FastifyInstance } from "fastify";
import { getFreePort } from "./utils";
import { parseRequest, parseResponse, parseMetadata } from "./http";

export interface Dialog {
  metadata: {
    client_addr_v4: string;
    server_addr_v4: string;
    client_hw_addr: string;
    server_hw_addr: string;
    raw: string;
  };
  request: {
    method: string;
    uri: string;
    headers: string[];
    body: any;
    query: any;
    raw: string;
  };
  response: {
    protocolVersion: string;
    statusCode: string;
    statusMessage: string;
    headers: string[];
    body: any;
    raw: string;
  };
}

export interface SSNiffConfig {
  pcapFilter: string;
  networkInterface: string;
  execSsniffPath?: string;
  dialogChannelName: string;
}

/**
  import SSNiff, { Dialog } from "ssniff";
  const ssniff = new SSNiff({
    pcapFilter: "tcp port 9001",
    networkInterface: "lo0",
    dialogChannelName: "newDialogs"
  });
  ssniff.dialogEmitter.on("newDialogs", (newDialogs: Dialog[]) => {
      console.log(newDialogs); // [{ metadata, request, response }]
  });
  ssniff.start(); // start sniffig
  // listen on port 9001 and send http packets to localhost:9001
  ssniff.stop(); // Important to stop in order kill child process
*/
export class SSNiff {
  dialogEmitter = new EventEmitter();
  private SSNIFF_BLOCK = "----SSNIFFBLOCK----";
  private SSNIFF_SPLIT = "----SSNIFF----";
  private ssniffCP = new ChildProcess();
  private distributerServer: FastifyInstance = fastify({
    disableRequestLogging: true,
  });
  private execSsniffLocations = [
    __dirname + "/exec-ssniff.js",
    "./node_modules/ssniff/dist/exec-ssniff.js",
    "./dist/exec-ssniff.js",
    "./exec-ssniff.js",
  ];

  constructor(public config: SSNiffConfig) {
    this.initDistributionServer();
  }

  private initDistributionServer() {
    this.distributerServer.addContentTypeParser(
      "text/plain",
      { parseAs: "string", bodyLimit: 10000000 },
      function (req, body, done) {
        done(null, body);
      }
    );

    this.distributerServer.post("/", async (req, reply) => {
      const newDialogSplittedAll = (req.body as string)
        .trim()
        .split(this.SSNIFF_BLOCK);
      const newDialogs = [];
      for (const newDialogStr of newDialogSplittedAll) {
        const newDialogSplitted = newDialogStr.trim().split(this.SSNIFF_SPLIT);
        if (newDialogSplitted[0] === "") {
          newDialogSplitted.shift();
        }

        if (newDialogSplitted.length === 0) continue;
        const metadata = newDialogSplitted[0];
        const request = newDialogSplitted[1];
        const response = newDialogSplitted[2];
        const parsedMetadata = parseMetadata(metadata);
        const parsedRequest = parseRequest(request);
        const parsedResponse = parseResponse(response);
        const newDialog = {
          request: parsedRequest,
          response: parsedResponse,
          metadata: parsedMetadata,
        };
        newDialogs.push(newDialog);
      }

      this.dialogEmitter.emit(this.config.dialogChannelName, newDialogs);
    });
  }

  start = async (): Promise<void> => {
    let execLocation: any;
    if (this.config.execSsniffPath) {
      if (fs.existsSync(this.config.execSsniffPath)) {
        execLocation = this.config.execSsniffPath;
      }
    }

    if (!execLocation) {
      for (const location of this.execSsniffLocations) {
        if (fs.existsSync(location)) {
          execLocation = location;
        }
      }
    }

    if (!execLocation) {
      console.log("exec-ssniff.js not found! try changing execSsniffPath");
      return;
    }

    return await new Promise(async (resolve) => {
      const serverPort = await getFreePort();
      this.distributerServer.listen({ port: serverPort }, () => {
        this.ssniffCP = fork(execLocation, [String(serverPort)], {
          detached: true,
        });
        this.ssniffCP.send(this.config);
        resolve();
      });
    });
  };

  stop = (): void => {
    this.ssniffCP.kill("SIGHUP");
    this.distributerServer.close();
  };
}
