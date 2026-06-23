# react-native-geolocation-provider

[![npm version](https://img.shields.io/npm/v/react-native-geolocation-provider.svg)](https://www.npmjs.com/package/react-native-geolocation-provider)
[![npm downloads](https://img.shields.io/npm/dm/react-native-geolocation-provider.svg)](https://www.npmjs.com/package/react-native-geolocation-provider)
[![license](https://img.shields.io/npm/l/react-native-geolocation-provider.svg)](https://github.com/charlespalmerbf/react-native-geolocation-provider/blob/main/LICENSE)

Native Core Location and Android LocationManager bindings for React Native.

## React Native support

This package is implemented as a React Native TurboModule using codegen, rather
than the deprecated legacy bridge module used by older geolocation packages. It
is intended for current React Native applications that use the New Architecture
tooling, while still exposing the familiar `getCurrentPosition`,
`watchPosition`, `clearWatch`, and `stopObserving` JavaScript API.

## Installation

```sh
yarn add react-native-geolocation-provider
cd ios && pod install
```

The application remains responsible for requesting runtime location permission.
Add `NSLocationWhenInUseUsageDescription` to the iOS application Info.plist.
Android coarse and fine location permissions are merged from this library's
manifest.

## Repository structure

This project is a monorepo managed using
[Yarn workspaces](https://yarnpkg.com/features/workspaces). It contains the
library package at the repository root and the React Native example app in
`example`.

## Current location

```ts
import { getCurrentPosition } from 'react-native-geolocation-provider';

const position = await getCurrentPosition({
  enableHighAccuracy: true,
  timeout: 30_000,
  maximumAge: 5_000,
});
```

The community geolocation callback signature is also supported:

```ts
getCurrentPosition(onLocation, onError, { enableHighAccuracy: true });
```

### `getCurrentPosition(options)`

Returns a promise that resolves with one `GeolocationPosition`.

- `options.enableHighAccuracy` uses GPS/high accuracy when available.
- `options.timeout` sets the maximum wait time in milliseconds.
- `options.maximumAge` allows a cached location within this age in milliseconds.

### `getCurrentPosition(success, error, options)`

Callback-compatible form for replacing community geolocation calls.

- `success(position)` receives the resolved `GeolocationPosition`.
- `error(error)` receives a `GeolocationError`.
- `options` supports the same fields as the promise form.

## Location updates

```ts
import { clearWatch, watchPosition } from 'react-native-geolocation-provider';

const watchId = watchPosition(onLocation, onError, {
  enableHighAccuracy: true,
  distanceFilter: 5,
  interval: 1_000,
  fastestInterval: 500,
});

clearWatch(watchId);
```

### `watchPosition(success, error, options)`

Starts native location observation and returns a numeric watch id.

- `success(position)` is called for each native location update.
- `error(error)` is called when native observation fails.
- `options.enableHighAccuracy` uses GPS/high accuracy when available.
- `options.distanceFilter` sets the minimum movement in metres.
- `options.interval` sets the preferred Android update interval in milliseconds.
- `options.fastestInterval` sets Android's fastest accepted interval in milliseconds.

### `clearWatch(id)`

Stops the watcher matching the id returned by `watchPosition`. Native
observation is stopped automatically when the final watcher is cleared.

### `stopObserving()`

Stops all watchers and removes native location subscriptions.

## API surface

Documented public methods are `getCurrentPosition`, `watchPosition`,
`clearWatch`, and `stopObserving`. There are no additional public methods.
Native event emitters are internal implementation details.

Positions contain W3C-style `coords` and millisecond `timestamp` values. Errors
use codes `1` (permission), `2` (unavailable), and `3` (timeout).

## License

MIT
