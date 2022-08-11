# FeatureProbe Client Side SDK for JavaScript

[![Top Language](https://img.shields.io/github/languages/top/FeatureProbe/client-sdk-js)](https://github.com/FeatureProbe/client-sdk-js/search?l=rust)
[![Coverage Status](https://coveralls.io/repos/github/FeatureProbe/client-sdk-js/badge.svg?branch=main)](https://coveralls.io/github/FeatureProbe/client-sdk-js?branch=main)
[![Github Star](https://img.shields.io/github/stars/FeatureProbe/client-sdk-js)](https://github.com/FeatureProbe/client-sdk-js/stargazers)
[![Apache-2.0 license](https://img.shields.io/github/license/FeatureProbe/FeatureProbe)](https://github.com/FeatureProbe/FeatureProbe/blob/main/LICENSE)

FeatureProbe is an open source feature management service. This SDK is used to control features in JavaScript programs. This
SDK is designed primarily for use in multi-user systems such as web servers and applications.

## Basic Terms

Reading the short [Basic Terms](https://github.com/FeatureProbe/FeatureProbe/blob/main/BASIC_TERMS.md) will help to understand the code blow more easily.  [中文](https://github.com/FeatureProbe/FeatureProbe/blob/main/BASIC_TERMS_CN.md)

## Try Out Demo Code

We provide a runnable demo code for you to understand how FeatureProbe SDK is used.

1. Start FeatureProbe Service with docker composer. [How to](https://github.com/FeatureProbe/FeatureProbe#1-starting-featureprobe-service-with-docker-compose)
2. Download this repo and run the demo program:
```bash
git clone https://github.com/FeatureProbe/client-sdk-js.git
cd client-sdk-js
// open example/index.html in browser
```

3. Find the Demo code in [example](https://github.com/FeatureProbe/client-sdk-js/tree/main/example), 
do some change and run the program again.
```
// open example/index.html in browser
```

## Step-by-Step Guide

In this guide we explain how to use feature toggles in a JavaScript application using FeatureProbe.

### Step 1. Install the JavaScript SDK

First, install the FeatureProbe SDK as a dependency in your application.

NPM:

```js
npm install featureprobe-client-sdk-js --save
```

Or via CDN:

```js
<script type="text/javascript" src="https://unpkg.com/featureprobe-client-sdk-js@latest/dist/featureprobe-client-sdk-js.min.js"></script>
```

### Step 2. Create a FeatureProbe instance

After you install and import the SDK, create a single, shared instance of the FeatureProbe sdk.

NPM:

```js
const uniqueUserId = /* uniqueUserId */;
const user = new FPUser(uniqueUserId);
user.with("userId", /* userId */);

let remoteUrl = "https://featureprobe.io/server";
// let remoteUrl = "http://localhost:4007";   // for local docker

const fp = new FeatureProbe({
  remoteUrl,
  clientSdkKey: /* clientSdkKey */
  user,
});
fp.start();
```

Or via CDN:

```js
const uniqueUserId = /* uniqueUserId */;
const user = new featureProbe.FPUser(uniqueUserId);
user.with("userId", /* userId */);

let remoteUrl = "https://featureprobe.io/server";
// let remoteUrl = "http://localhost:4007";   // for local docker

const fp = new featureProbe.FeatureProbe({
  remoteUrl,
  clientSdkKey: /* clientSdkKey */
  user,
});
fp.start();
```

### Step 3. Use the instance to get your setting value

You can use sdk to check which value this user will receive for a given feature flag.

```js
fp.on("ready", function() {
  const result = fp.boolValue(/* toggleKey */, false);
  if (result) {
    do_some_thing();
  } else {
    do_other_thing();
  }
  const reason = fp.boolDetail(/* toggleKey */, false);
  console.log(reason);
})
```

### Step 4. Unit Testing (Optional)
NPM:

```js
test("feature probe unit testing", (done) => {
  let fp = FeatureProbe.newForTest({ testToggle: true });
  fp.start();

  fp.on("ready", function () {
    let t = fp.boolValue(/* toggleKey */, false);
    expect(t).toBe(true);
    done();
  });
});
```

Or via CDN:

```js
test("feature probe unit testing", (done) => {
  let fp = featureProbe.FeatureProbe.newForTest({ testToggle: true });
  fp.start();

  fp.on("ready", function () {
    let t = fp.boolValue(/* toggleKey */, false);
    expect(t).toBe(true);
    done();
  });
});
```

## Available options

This SDK takes the following options:

| option            | required       | default | description                                                                                                                                      |
|-------------------|----------------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| remoteUrl         | depends | n/a     | The unified URL to get toggles and post events |
| togglesUrl        | no             | n/a     | The specific URL to get toggles, once set, remoteUrl will be ignored |
| eventsUrl         | no             | n/a     | The specific URL to post events, once set, remoteUrl will be ignored |
| clientSdkKey      | yes            | n/a     | The Client SDK Key is used to authentification   |
| user              | yes            | n/a     | The User with attributes like name, age is used when toggle evaluation |
| refreshInterval   | no            | 1000    | The SDK check for updated in millisecond   |

## Testing

We have unified integration tests for all our SDKs. Integration test cases are added as submodules for each SDK repo. So
be sure to pull submodules first to get the latest integration tests before running tests.

```js
npm run test
```

## Contributing

We are working on continue evolving FeatureProbe core, making it flexible and easier to use.
Development of FeatureProbe happens in the open on GitHub, and we are grateful to the
community for contributing bugfixes and improvements.

Please read [CONTRIBUTING](https://github.com/FeatureProbe/featureprobe/blob/master/CONTRIBUTING.md)
for details on our code of conduct, and the process for taking part in improving FeatureProbe.

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
