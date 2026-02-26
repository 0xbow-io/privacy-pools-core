import http from "node:http";

async function startServer(host: string, port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/ping") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("pong");
      } else if (
        req.url?.startsWith("/artifacts") &&
        req.url === "/artifacts/withdraw.wasm"
      ) {
        const data = new Uint8Array([0, 1, 2, 3]);
        res.writeHead(200, { "Content-Type": "application/octet-stream" });
        res.end(data);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("ErrorNotFound\n");
      }
    });
    server.listen(port, host, () => resolve(server));
  });
}

let teardownHappened = false;
let server: http.Server;

export async function setup() {
  server = await startServer("0.0.0.0", 8888);
}

export async function teardown() {
  if (teardownHappened) {
    throw new Error("teardown called twice");
  }
  teardownHappened = true;
  // tear it down here
  server.close();
}
