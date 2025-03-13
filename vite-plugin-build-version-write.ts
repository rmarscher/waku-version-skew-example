import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const VIRTUAL_MODULE_ID = 'virtual:build-version';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * Vite plugin to generate a build version, write it to a file, and expose it via a virtual module
 *
 * The version identifier is a hash of the javascript filenames in the bundle, which is useful for cache busting.
 * The build version can be imported in your application code using
 * `import { BUILD_VERSION } from 'virtual:build-id';`
 *
 * @param {Object} options - Plugin options
 * @param {string} options.filename - The name of the file to write the build version to
 * @param {string} options.varName - The name of the variable to store the build version
 * @returns {Plugin}
 */
export function writeBuildVersionPlugin(options?: {
  filename?: string;
  varName?: string;
}): Plugin {
  const { filename = "build-version.txt", varName = "BUILD_ID" } = options || {};

  return {
    name: "vite-plugin-build-version-write",
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
        // const file = bundle[fileName];
        // Only include JS and CSS files for the hash
        if (fileName.endsWith(".js") || fileName.endsWith(".css")) {
          hash.update(fileName);
        }
      }

      const buildVersion = hash.digest("hex").substring(0, 16);

      // Ensure the assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      fs.writeFileSync(filePath, buildVersion);

      console.log(`✓ Build version written to ${filePath}: ${buildVersion}`);

      const distDir = path.resolve(process.cwd(), "dist");
      console.log("checking dist", distDir);
      // if we can find the placeholder in
      // the dist output, replace it with the real value.
      // the bundle sorted files is not good enough, we need to use the out dir
      // `${varName}="${buildVersion}"`
      const placeholderSearch = new RegExp(`${varName} ?= ?"(.*?)"`, 'g');
      const placeholderReplace = `${varName}="${buildVersion}"`;
      const files = fs.readdirSync(distDir, { recursive: true });
      for (const file of files) {
        const filePath = path.join(distDir, file);
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, "utf-8");
          console.log(`Looking for placeholder in ${filePath}`);
          if (placeholderSearch.test(content)) {
            const newContent = content.replace(placeholderSearch, placeholderReplace);
            fs.writeFileSync(filePath, newContent);
            console.log(`✓ Replaced placeholder in ${filePath}`);
          }
        }
      }
      console.log("Done looking for files to replace");
      // Return the build version for use in other plugins
      // return {
      //   name: "vite-plugin-build-version-write",
      //   buildVersion,
      //   filename,
      //   varName,
      // }
    },
  };
}
