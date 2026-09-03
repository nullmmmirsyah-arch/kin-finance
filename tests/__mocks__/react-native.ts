// Minimal mock for react-native to allow vitest to import MonthPicker without parsing Flow
import * as React from "react";

export const Modal = (props: any) => React.createElement("div", props, props.children);
export const Pressable = (props: any) => React.createElement("div", props, props.children);
export const View = (props: any) => React.createElement("div", props, props.children);
export const Text = (props: any) => React.createElement("span", props, props.children);
export const useColorScheme = () => "light";

// Re-export everything else as stub
export default {
  Modal,
  Pressable,
  View,
  Text,
  useColorScheme,
};
