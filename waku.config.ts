import type { Hono } from "hono";
import { type Config, defineConfig } from "waku/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { buildVersionPlugin } from "./vite-plugin-build-version";
import { writeBuildVersionPlugin } from "./vite-plugin-build-version-write";

const BUILD_VERSION_FILENAME = "client-build-version.txt";
const BUILD_VERSION_VAR_NAME = "CLIENT_BUILD_VERSION";

export default defineConfig({
  ...(import.meta.env && !import.meta.env.PROD
    ? {
        unstable_honoEnhancer: ((createApp: (app: Hono) => Hono) => {
          const handlerPromise = import("./waku.cloudflare-dev-server").then(
            ({ cloudflareDevServer }) =>
              cloudflareDevServer({
                // Optional config settings for the Cloudflare dev server (wrangler proxy)
                // https://developers.cloudflare.com/workers/wrangler/api/#parameters-1
                persist: {
                  path: ".wrangler/state/v3",
                },
              }),
          );
          return (appToCreate: Hono) => {
            const app = createApp(appToCreate);
            return {
              fetch: async (req: Request) => {
                const devHandler = await handlerPromise;
                return devHandler(req, app);
              },
            };
          };
        }) as Config["unstable_honoEnhancer"],
      }
    : {}),
  middleware: () => {
    return [
      import("waku/middleware/context"),
      import("waku/middleware/dev-server"),
      import("./waku.cloudflare-middleware"),
      import("waku/middleware/handler"),
    ];
  },
  unstable_viteConfigs: {
    "common": () => ({
      plugins: [
        buildVersionPlugin({ filename: BUILD_VERSION_FILENAME, varName: BUILD_VERSION_VAR_NAME }),
      ],
    }),
    "build-client": () => ({
      plugins: [writeBuildVersionPlugin({ filename: BUILD_VERSION_FILENAME, varName: BUILD_VERSION_VAR_NAME })],
    }),
  },
});
