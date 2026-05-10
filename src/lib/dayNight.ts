// Shared mutable day factor — updated by SceneSetup each frame, read by glow components.
// 1 = midday, 0 = midnight. Not React state — no re-renders needed.
export const dayNight = { factor: 1.0 };
