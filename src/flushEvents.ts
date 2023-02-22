import { EventRecorder } from "./EventRecorder";

export default function flushEventBeforPageUnload(
  eventRecorder: EventRecorder,
): void {

  const flushHandler = () => {
    eventRecorder.flush();
  };

  window.addEventListener("beforeunload", flushHandler);
  window.addEventListener("unload", flushHandler);
  window.addEventListener("pagehide", flushHandler);

  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState !== "visible") {
      flushHandler();
    }
  });
}
