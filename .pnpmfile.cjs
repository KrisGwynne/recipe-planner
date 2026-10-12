// TypeScript 7 has no programmatic API yet, so the project's `typescript`
// (and `tsc`) is 7, while typescript-eslint, which imports the API, gets the
// 6.0 API package: its `typescript` peer becomes a direct dependency on
// @typescript/typescript6. pnpm overrides and packageExtensions can't do
// this, because the root `typescript` always satisfies the peer.
// Remove this file when typescript-eslint supports TypeScript 7.
const TS6 = "npm:@typescript/typescript6@^6.0.2";

function readPackage(pkg) {
  const usesTsApi =
    pkg.name === "typescript-eslint" ||
    pkg.name === "eslint-config-next" ||
    pkg.name === "ts-api-utils" ||
    pkg.name.startsWith("@typescript-eslint/");
  if (usesTsApi && pkg.peerDependencies?.typescript) {
    delete pkg.peerDependencies.typescript;
    if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: TS6 };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
