# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Styling Rules

- Use NativeWind (`className`), not `StyleSheet.create`.
- Import theme from `constants/theme.ts` — do not hardcode colors.
- Gradient cards: `expo-linear-gradient` + `Gradients.card`.
- Shadows: `Shadow.card` or `Shadow.elevated`.

# Documentation

- PRDs: `docs/Product Requirement Document/`
- Architecture: `docs/ARCHITECTURE.md`
- Design system + screens: `docs/DESIGN.md`
- Colors, typography, spacing: `constants/theme.ts`
