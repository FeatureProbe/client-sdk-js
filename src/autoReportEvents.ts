import { getPlatform } from "./platform";
import { FPUser } from ".";
import { EventRecorder } from "./EventRecorder";
import { ClickEvent, IEvent, IEventValue, PageViewEvent } from "./types";

const WATCHURLCHANGEINTERVAL = 300;

// Reference: https://github.com/sindresorhus/escape-string-regexp
function escapeStringRegexp(string: string): string {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }

  return string
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d');
}

/**
 * 
 * Validate whether current page url matches the rule set by event.matcher
 * 
 * @param event
 *    Event detail
 */
function matchUrl(event: IEventValue): boolean {
  const { href, hash, search } = window.location;
  let regex;
  let testUrl;

  switch (event.matcher) {
    case 'EXACT':
      testUrl = href;
      regex = new RegExp('^' + escapeStringRegexp(event.url) + '/?$');
      break;
    case 'SIMPLE':
      testUrl = href.replace(hash, '').replace(search, '');
      regex = new RegExp('^' + escapeStringRegexp(event.url) + '/?$');
      break;
    case 'SUBSTRING':
      testUrl =  href.replace(search, '');
      regex = new RegExp('.*' + escapeStringRegexp(event.url) + '.*$');
      break;
    case 'REGULAR':
      testUrl =  href.replace(search, '');
      regex = new RegExp(event.url);
      break;
    default:
      return false;
  }

  return regex.test(testUrl);
}

export default function reportEvents(
  clientSdkKey: string, 
  user: FPUser, 
  getEventsUrl: string, 
  eventRecorder: EventRecorder,
): void {
  let previousUrl: string = window.location.href;
  let currentUrl;
  let cb: (event: MouseEvent) => void;
  let totalEvents: IEvent;

  /**
   * 
   * Report different events to Server API
   * 
   * @param kind 
   *    Event type, like click, pageview, etc.
   * @param event
   *    Event detail
   */
  function sendEvents(kind: string, event: IEventValue) {
    const sendEvent: PageViewEvent = {
      kind: kind,
      name: event.name,
      time: Date.now(),
      user: user.getKey(),
      url: window.location.href,
    };

    if (kind === 'click' && event.selector) {
      (sendEvent as ClickEvent).selector = event.selector;
    }

    eventRecorder?.recordTrackEvent(sendEvent);
  }

  /**
   * 
   * Find the element that was clicked by event bubbling
   * 
   * @param event 
   *   Mouse event
   * @param clickEvents
   *   All click events
   * @returns 
   *   Match click events
   */
  function getClickEvents(event: MouseEvent, clickEvents: IEventValue[]) {
    const matchedEvents = [];

    for (const clickEvent of clickEvents) {
      let target = event.target;
      const selector = clickEvent.selector;

      const elements = selector && document.querySelectorAll(selector);

      while (target && elements && elements.length > 0) {
        for (let j = 0; j < elements.length; j++) {
          if (target === elements[j]) {
            matchedEvents.push(clickEvent);
          }
        }
        target = (<HTMLElement>(<HTMLElement>target).parentNode);
      }
    }
  
    return matchedEvents;
  }

  /**
   * 
   * First, find all events URLs, if current page url matches one of them, 
   * send pageview events automatically.
   * 
   * Second, register document click event, if an element is clicked, 
   * and it's CSS selector matches the event's selector, 
   * send click event automatically.
   * 
   * 
   * @param data
   * 
   */
  function distinguishEvents(data: IEvent) {
    const clickEvents: IEventValue[] = [];

    for (const key in data) {
      const event: IEventValue = data[key];

      if (matchUrl(event)) {
        if (event.type === 'PAGE_VIEW') {
          sendEvents('pageview', event);
        } else if (event.type === 'CLICK') {
          sendEvents('pageview', event);
          clickEvents.push(event);
        }
      }
    }

    if (clickEvents.length > 0) {
      cb = function(event: MouseEvent) {
        const result = getClickEvents(event, clickEvents);
        for (const event of result) {
          sendEvents('click', event);
        }
      };
  
      document.addEventListener('click', cb);
    }
  }

  /**
   * 
   * Watch the change of the page url. 
   * If it changes, register the pageview events and click events again.
   * 
   */
  function watchUrlChange() {
    currentUrl = window.location.href;

    if (currentUrl !== previousUrl) {
      previousUrl = currentUrl;
      document.removeEventListener('click', cb);
      cb = function() {
        // do nothing
      }

      distinguishEvents(totalEvents);
    }
  }

  /**
   * Register popstate event when using history router
   */
  window.addEventListener('popstate', watchUrlChange);

  /**
   * Register hashchange event when using hash router
   */
  window.addEventListener('hashchange', watchUrlChange);

  /**
   * If popstate or hashchange events are not supported
   */
  setInterval(() => {
    watchUrlChange();
  }, WATCHURLCHANGEINTERVAL);

  /**
   * Get events data from Server API
   */
  getPlatform().httpRequest.get(getEventsUrl, {
    'Authorization': clientSdkKey,
    "Content-Type": "application/json",
    'UA': getPlatform()?.UA,
  }, {}, res => {
    if (res) {
      distinguishEvents(res as IEvent);
      totalEvents = res as IEvent;
    }
  }, (error: string) => {
    console.error('FeatureProbe JS SDK: Error getting events: ', error);
  })
}
