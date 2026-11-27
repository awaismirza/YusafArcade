export function start(onExit: () => void): () => void {
  onExit();
  return () => {};
}
