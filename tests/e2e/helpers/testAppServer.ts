import { type Server, createServer } from "node:http";

export interface TestAppServer {
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}

const APP_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>E2E Harness App</title>
    <style>
      body { font-family: sans-serif; margin: 24px; }
      main { max-width: 720px; }
      .controls { display: flex; gap: 8px; }
      .list { margin-top: 16px; }
    </style>
  </head>
  <body>
    <main>
      <h1 data-testid="title">E2E Harness App</h1>
      <div class="controls">
        <input id="item-input" data-testid="item-input" />
        <button id="add-btn" data-testid="add-btn">Add</button>
      </div>
      <ul id="items" class="list" data-testid="items"></ul>
      <script>
        const input = document.getElementById("item-input");
        const addBtn = document.getElementById("add-btn");
        const items = document.getElementById("items");

        addBtn.addEventListener("click", () => {
          const value = input.value.trim();
          if (!value) return;
          const li = document.createElement("li");
          li.textContent = value;
          li.setAttribute("data-testid", "item");
          items.appendChild(li);
          input.value = "";
        });
      </script>
    </main>
  </body>
</html>`;

export async function createTestAppServer(): Promise<TestAppServer> {
  const server = createServer((request, response) => {
    if (request.url === "/" || request.url === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(APP_HTML);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test app server address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
