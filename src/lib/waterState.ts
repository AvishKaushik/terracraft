// Shared mutable flag — set by PlayerController each frame, read by SceneSetup.
// Avoids React state overhead for a per-frame rendering decision.
export const waterState = { eyeInWater: false };
