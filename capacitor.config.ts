import type { CapacitorConfig } from "@capacitor/cli";

const appUrl = process.env.MVM_WEB_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.mvmsolo.mvmbrowser",
  appName: "MVM Browser",
  webDir: "android-shell",
  server: appUrl
    ? {
        url: appUrl,
        cleartext: false,
      }
    : undefined,
  android: {
    allowMixedContent: false,
  },
};

export default config;
