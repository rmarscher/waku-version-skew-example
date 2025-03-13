import type { Plugin } from "vite";

const VIRTUAL_MODULE_ID = 'virtual:build-version';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * Vite plugin to generate a build version, write it to a file, and expose it via a virtual module
 * @param {Object} options - Plugin options
 * @param {string} options.filename - The name of the file to write the build ID to
 * @returns {Plugin}
 */
export function buildVersionPlugin(options?: {
  filename?: string;
  varName?: string;
}): Plugin {
  const { filename = "build-version.txt", varName = "BUILD_ID" } = options || {};
  let buildId = 'dev'; // Default dev build ID

  return {
    name: "vite-plugin-build-version",

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      return null;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        return `export const ${varName} = "${buildId}";`;
      }
      return null;
    },
  };
}
