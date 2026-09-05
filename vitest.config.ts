import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "react-native": path.resolve(__dirname, "tests/__mocks__/react-native.ts"),
      "react-native-svg": path.resolve(__dirname, "tests/__mocks__/react-native-svg.ts"),
      "@expo/vector-icons/Feather": path.resolve(__dirname, "tests/__mocks__/expo-feather.ts"),
      "@expo/vector-icons": path.resolve(__dirname, "tests/__mocks__/expo-feather.ts"),
      "expo-linear-gradient": path.resolve(__dirname, "tests/__mocks__/expo-linear-gradient.ts"),
      "@testing-library/react-native": path.resolve(
        __dirname,
        "tests/__mocks__/testing-library-react-native.ts"
      ),
    },
  },
  test: {
    globals: false,
    environment: "node",
  },
});
