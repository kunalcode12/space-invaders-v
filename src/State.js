export default {
  state: "TITLESCREEN",
  level: 0,
  lives: 3,
  score: 0,
  scoreMultiplier: 1,
  defaultFPS:60,
  FPS: 60, // FPS and delta are updated every frame.
  delta: 1,
  slowMotionMultiplier: 1, // Global slow-motion multiplier (1 = normal, 0.6 = slow-motion)
  precisionModeActive: false, // Precision Mode active flag
  rainDropActive: false, // Rain Drop bonus active flag
  addScore(points = 0) {
    const multiplier = this.scoreMultiplier || 1;
    const adjusted = Math.round(points * multiplier);
    this.score += adjusted;
    return adjusted;
  }
}
