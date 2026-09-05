import * as React from "react";

// Minimal mock for @testing-library/react-native to satisfy vitest without installing the lib.
// Returns a truthy JSON tree for any component.

export function render(element: React.ReactElement) {
  return {
    toJSON: () => ({ type: "mock", props: {}, children: element }),
    getByLabelText: () => element,
    getByText: () => element,
    getByTestId: () => element,
    queryByText: () => null,
  };
}
export const screen = {};
export default { render, screen };
