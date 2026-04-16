import 'dotenv/config';

export default {
  expo: {
    name: "Lumiva CRM",
    slug: "lumiva-crm",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#f6f7fb"
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.lumiva.crm"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.lumiva.crm",
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.DETECT_SCREEN_CAPTURE"
      ]
    },
    extra: {
      apiHost: process.env.EXPO_PUBLIC_API_HOST || "https://crm.lumiva.agency",
      apiBase: process.env.EXPO_PUBLIC_API_BASE || "/v1",
      clientKey: process.env.EXPO_PUBLIC_CLIENT_KEY || "demo-client",
      eas: {
        projectId: "7f6dbd95-f8c2-41cc-a2b7-a307f3e8455c"
      }
    }
  }
};
