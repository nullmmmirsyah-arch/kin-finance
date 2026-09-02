// app.config.js — variant-aware config
// Docs: https://docs.expo.dev/build-reference/variants/
// APP_VARIANT=development  -> com.kinfinance.app.dev   (kin-finance (Dev))
// APP_VARIANT=preview      -> com.kinfinance.app.preview (kin-finance (Preview))
// unset / production       -> com.kinfinance.app       (kin-finance)

const APP_VARIANT = process.env.APP_VARIANT;

const isDev = APP_VARIANT === "development";
const isPreview = APP_VARIANT === "preview";

function getAppName() {
  if (isDev) return "kin-finance (Dev)";
  if (isPreview) return "kin-finance (Preview)";
  return "kin-finance";
}

function getBundleIdentifier() {
  if (isDev) return "com.kinfinance.app.dev";
  if (isPreview) return "com.kinfinance.app.preview";
  return "com.kinfinance.app";
}

function getPackage() {
  if (isDev) return "com.kinfinance.app.dev";
  if (isPreview) return "com.kinfinance.app.preview";
  return "com.kinfinance.app";
}

/** @type {import('expo/config').ExpoConfig} */
export default {
  name: getAppName(),
  slug: "kin-finance",
  version: "1.0.5",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "kinfinance",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleIdentifier(),
  },
  android: {
    package: getPackage(),
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#FFFBF5",
        dark: {
          backgroundColor: "#1C1917",
        },
      },
    ],
    "expo-secure-store",
    "@clerk/expo",
    "@react-native-community/datetimepicker",
    "expo-localization",
    [
      "expo-dev-client",
      {
        // Only generate dev-client scheme for dev variant so QR codes / EAS Update
        // always open the dev build when both are installed.
        addGeneratedScheme: isDev,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "3d0f78fd-4210-4c6b-832b-f56ebadc380b",
    },
  },
  owner: "nullmm",
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://u.expo.dev/3d0f78fd-4210-4c6b-832b-f56ebadc380b",
    checkAutomatically: "ON_ERROR_RECOVERY",
    fallbackToCacheTimeout: 0,
  },
};
