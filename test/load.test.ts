import { SSNiff, Dialog } from "../ssniff";
import { createFastifyApp, sleep } from "./utils";
import { exec } from "child_process";
import { expect } from "chai";

describe("Load Testing", async () => {
  const { app, port } = await createFastifyApp();
  const target = `http://localhost:${port}/ping`;
  after(async () => {
    await new Promise((resolve) => {
      app.close(() => {
        resolve(true);
      });
    });
  });

  [
    [10, 100],
    [10, 500],
    [10, 1000],
    [10, 1200],
    [10, 1500],
  ].forEach(([duration, arrivalRate]) => {
    const amount = duration * arrivalRate;
    it(`${amount} requests in ~${duration} seconds`, async () => {
      const ssniff = new SSNiff({
        pcapFilter: `tcp port ${port}`,
        networkInterface: "lo0",
        dialogChannelName: "newDialog",
      });
      let allDialogsCount = 0;
      ssniff.dialogEmitter.on(
        ssniff.config.dialogChannelName,
        (newDialogs: Dialog[]) => {
          for (const newDialog of newDialogs) {
            if (newDialog.request.body?.foo !== newDialog.response.body?.foo) {
              ssniff.stop();
            }
            expect(newDialog.request.body).to.deep.equal(
              newDialog.response.body
            );
            expect(newDialog.metadata.client_addr_v4).to.eq("127.0.0.1");
            allDialogsCount++;
          }
        }
      );

      ssniff.start();
      await sleep(1);
      let k6Ended = false;
      let actualAmountSent = 0;
      // TODO: find better load tester?
      exec(
        `k6 run -e TARGET=${target} -e PRE_ALLOC=${amount} -e DURATION=${duration}s -e RATE=${arrivalRate} ${__dirname}/k6.js`,
        (error, report) => {
          //console.log(error);
          //console.log(report);
          let reqStr = "http_reqs......................:";
          const amountPosStart = report.indexOf(reqStr) + reqStr.length + 1;
          actualAmountSent = parseInt(
            report.substring(amountPosStart, amountPosStart + 6)
          );
          k6Ended = true;
        }
      );

      while (!k6Ended) await sleep(1);
      await sleep(5);
      ssniff.stop();
      //expect([amount - 1, amount, amount + 1]).to.include(allDialogsCount);
      expect([
        actualAmountSent - 1,
        actualAmountSent,
        actualAmountSent + 1,
      ]).to.include(allDialogsCount);
    }).timeout(0);
  });
});
