import { Dialog, SSNiff } from "../ssniff";
import { createFastifyApp, sleep } from "./utils";
import axios from "axios";
import { expect } from "chai";

describe("SSNiff", async () => {
  // create http server
  const { app, port } = await createFastifyApp();
  const pingUrl = `http://localhost:${port}/ping?a=foo&b=bar`;
  after(async () => {
    return await new Promise((resolve) => {
      app.close(() => {
        resolve();
      });
    });
  });

  it("should start ssniff, post request to http server when stream captured, send a message back to test then stop", async () => {
    const ssniff = new SSNiff({
      pcapFilter: `tcp port ${port}`,
      networkInterface: "lo0",
      dialogChannelName: "newDialog",
    });
    const allDialogs: any = [];
    ssniff.dialogEmitter.on(
      ssniff.config.dialogChannelName,
      (newDialogs: Dialog[]) => {
        for (const newDialog of newDialogs) {
          if (newDialog.request.body?.foo !== newDialog.response.body?.foo) {
            ssniff.stop();
            console.log(newDialog);
          }
          expect(newDialog.request.body).to.deep.equal(newDialog.response.body);
          allDialogs.push(newDialog);
        }
      }
    );

    ssniff.start();
    await sleep(1); // wait a bit for libtins to start
    expect(allDialogs).to.have.length(0);

    // send http post request
    const requestBody = { bar: "foo" };
    const { data: responseData } = await axios.post(pingUrl, requestBody);

    await sleep(2); // wait a bit for libtins to caputre req/res stream
    expect(allDialogs).to.have.length(1);
    expect(allDialogs[0].request.body).to.deep.equal(requestBody);
    expect(allDialogs[0].request.query).to.deep.equal({ a: "foo", b: "bar" });
    expect(allDialogs[0].response.body).to.deep.equal(responseData);
    expect(allDialogs[0].response.body).to.deep.equal(responseData);

    ssniff.stop();
    await sleep(1); // wait a bit for libtins to stop
    await axios.post(pingUrl, requestBody); // resend data
    await sleep(2); // wait a bit to see if libtins will capture the stream
    expect(allDialogs).to.have.length(1); // should remain 1 pair
  }).timeout(0);
});
