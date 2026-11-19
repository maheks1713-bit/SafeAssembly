/* eslint-env jest */
// Runs before every app test file.

// In-memory AsyncStorage (ships with the package).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Tests never read app/.env: config is a plain mutable object, mock-data mode by default.
// A test can flip `require("@/lib/config").USE_MOCKS = false` to exercise the live code paths;
// compiled imports read these as properties, so the change is seen immediately.
jest.mock("@/lib/config", () => ({
  __esModule: true,
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  API_URL: "http://api.test",
  EVENT_ID: "00000000-0000-4000-8000-000000000001",
  USE_MOCKS: true,
}));

// Never build a real Supabase client in tests. Live-mode tests set `sb` to a fake.
jest.mock("@/lib/supabase", () => ({ __esModule: true, sb: null }));

// Local notifications: a plain stub, so tests can spy on what would buzz the phone.
jest.mock("expo-notifications", () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve("notification-id")),
  AndroidImportance: { MAX: 5 },
}));

// Safe-area insets without a native module.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
