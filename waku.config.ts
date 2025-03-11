import type { Hono } from "hono";
import { type Config, defineConfig } from "waku/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

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
    "build-client": () => ({
      plugins: [buildIdPlugin({ filename: "client-build-id.txt" })],
    }),
  },
});

/**
 * Vite plugin to generate and write a build ID to a file in the dist assets folder
 * @param {Object} options - Plugin options
 * @param {string} options.filename - The name of the file to write the build ID to
 * @returns {Plugin}
 */
export function buildIdPlugin(options?: { filename?: string }): Plugin {
  const { filename = "build-id.txt" } = options || {};

  return {
    name: "vite-plugin-build-id",
    enforce: "post",
    apply: "build", // Only run during build

    writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir || path.resolve(process.cwd(), "dist");
      const assetsDir = path.join(outDir, "assets");
      const filePath = path.join(assetsDir, filename);

      // Create a hash based on bundle content
      const hash = crypto.createHash("sha256");

      // Use the filenames in the bundle - they already contain content hashes
      const sortedFiles = Object.keys(bundle).sort();
      for (const fileName of sortedFiles) {
        const file = bundle[fileName];
        // Only include JS and CSS files for the hash
        if (fileName.endsWith(".js") || fileName.endsWith(".css")) {
          hash.update(fileName);
        }
      }

      const buildId = hash.digest("hex").substring(0, 16);

      // Ensure the assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      fs.writeFileSync(filePath, buildId);

      console.log(`✓ Build ID written to ${filePath}: ${buildId}`);
    },
  };
}
