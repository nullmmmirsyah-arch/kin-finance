# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Styling Rules

- Use NativeWind (`className`), not `StyleSheet.create`.
- Import theme from `constants/theme.ts` — do not hardcode colors.
- Gradient cards: `expo-linear-gradient` + `Gradients.card`.
- Shadows: `Shadow.card` or `Shadow.elevated`.
- **NativeWind v4 gotcha:** Never use `style` callback functions on `Pressable` (e.g. `style={({ pressed }) => [...]}`). This breaks all style rendering including `className`. Use `useState` for pressed state + static `style` or `className` instead. See [GitHub #847](https://github.com/nativewind/nativewind/issues/847).

# Documentation

- PRDs: `docs/Product Requirement Document/`
- Architecture: `docs/ARCHITECTURE.md`
- Design system + screens: `docs/DESIGN.md`
- Colors, typography, spacing: `constants/theme.ts`
