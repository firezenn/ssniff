import net from "net";

export async function getFreePort(): Promise<any> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port }: any = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
