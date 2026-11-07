import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver (SnowmanNav observes its header).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
