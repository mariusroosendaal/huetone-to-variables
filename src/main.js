import App from "./PluginUI.svelte";

function init() {
  const app = new App({
    target: document.getElementById("app") || document.body,
  });
  return app;
}

// Wait for DOM to be ready before mounting
// (Script may execute in <head> before <body> is parsed)
let app;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    app = init();
  });
} else {
  app = init();
}

export default app;
