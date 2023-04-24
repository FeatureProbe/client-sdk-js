import flushEventBeforPageUnload from "../src/flushEvents";
import { EventRecorder } from "../src/EventRecorder";



test("flushEventBeforPageUnload should add event listeners and flush events on page unload", () => {
  const INTERVAL = 1000;

  // Make a eventRecorder instance
  const eventRecorder = new EventRecorder("sdkKey", "https://www.com", INTERVAL);

  // Spy on the flush method of the mock EventRecorder object
  const flushSpy = jest.spyOn(eventRecorder, "flush");

  // Call the flushEventBeforPageUnload function with the mock EventRecorder object
  flushEventBeforPageUnload(eventRecorder);

  // Simulate a page unload event
  window.dispatchEvent(new Event("unload"));

  // Expect the EventRecorder's flush method to have been called
  expect(flushSpy).toHaveBeenCalled();
});
