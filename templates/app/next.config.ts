import type { NextConfig } from "next";

const config: NextConfig = {
  /*
   * Needed by deploy/Dockerfile, harmless otherwise.
   *
   * Next works out which files the server actually reaches and writes them, with a trimmed
   * node_modules, to .next/standalone. That is what the image copies, which is the difference
   * between an image carrying the whole dependency tree and one carrying what it runs.
   */
  output: "standalone",
};

export default config;
