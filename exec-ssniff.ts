import bindings from "bindings";
import { SSNiffConfig } from "./ssniff";

const ssniff = bindings("ssniff");
const tcpPort = process.argv[2];

process.on("message", (config: SSNiffConfig) => {
  ssniff.start(config.pcapFilter, config.networkInterface, tcpPort);
});
