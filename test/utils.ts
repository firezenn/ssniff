import { getFreePort } from "../utils";
import fastify, { FastifyInstance } from "fastify";

export const createFastifyApp = async (): Promise<{
  app: FastifyInstance;
  port: number;
}> => {
  const app = fastify({
    disableRequestLogging: true,
  });

  app.post("/ping", async (req, reply) => {
    return req.body;
  });
  return await new Promise(async (resolve) => {
    const port: number = await getFreePort();
    app.listen({ port }, (err, addr) => {});
    app.listen({ port }, () => {
      resolve({ app, port });
    });
  });
};

export const sleep = async (seconds: number) => {
  await new Promise((resolve) => {
    setTimeout(() => resolve(true), seconds * 1000);
  });
};
