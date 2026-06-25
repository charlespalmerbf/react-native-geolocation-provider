import NativeGeolocationProvider from './NativeGeolocationProvider';

export type GeolocationOptions = {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  interval?: number;
  fastestInterval?: number;
};

export type LocationAuthorizationStatus =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'notDetermined';

export type GeolocationCoordinates = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
};

export type GeolocationPosition = {
  coords: GeolocationCoordinates;
  timestamp: number;
};

export type GeolocationError = {
  code: 1 | 2 | 3;
  message: string;
};

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationError) => void;

const watchers = new Map<
  number,
  { success: SuccessCallback; error?: ErrorCallback }
>();
let nextWatchId = 1;
let locationSubscription: { remove(): void } | undefined;
let errorSubscription: { remove(): void } | undefined;

function serialise(options: GeolocationOptions = {}): string {
  return JSON.stringify(options);
}

function ensureNativeObserver(options: GeolocationOptions): void {
  if (locationSubscription) return;

  locationSubscription = NativeGeolocationProvider.onLocation(
    (payload: string) => {
      const position = JSON.parse(payload) as GeolocationPosition;
      watchers.forEach(({ success }) => success(position));
    }
  );
  errorSubscription = NativeGeolocationProvider.onLocationError(
    (payload: string) => {
      const error = JSON.parse(payload) as GeolocationError;
      watchers.forEach((watcher) => watcher.error?.(error));
    }
  );
  NativeGeolocationProvider.startObserving(serialise(options));
}

export function requestAuthorization(): Promise<LocationAuthorizationStatus> {
  return NativeGeolocationProvider.requestAuthorization().then(
    (status) => status as LocationAuthorizationStatus
  );
}

export function getCurrentPosition(
  options?: GeolocationOptions
): Promise<GeolocationPosition>;
export function getCurrentPosition(
  success: SuccessCallback,
  error?: ErrorCallback,
  options?: GeolocationOptions
): void;
export function getCurrentPosition(
  optionsOrSuccess: GeolocationOptions | SuccessCallback = {},
  error?: ErrorCallback,
  callbackOptions: GeolocationOptions = {}
): Promise<GeolocationPosition> | void {
  const options =
    typeof optionsOrSuccess === 'function' ? callbackOptions : optionsOrSuccess;
  const request = NativeGeolocationProvider.getCurrentPosition(
    serialise(options)
  )
    .then((payload) => JSON.parse(payload) as GeolocationPosition)
    .catch((reason: { code?: string; message?: string }) =>
      Promise.reject({
        code: Number(reason.code ?? 2) as GeolocationError['code'],
        message: reason.message ?? 'Unable to determine location',
      } satisfies GeolocationError)
    );

  if (typeof optionsOrSuccess === 'function') {
    request
      .then(optionsOrSuccess)
      .catch((reason: GeolocationError) => error?.(reason));
    return;
  }
  return request;
}

export function watchPosition(
  success: SuccessCallback,
  error?: ErrorCallback,
  options: GeolocationOptions = {}
): number {
  const id = nextWatchId++;
  watchers.set(id, { success, error });
  ensureNativeObserver(options);
  return id;
}

export function clearWatch(id: number): void {
  watchers.delete(id);
  if (watchers.size !== 0) return;

  NativeGeolocationProvider.stopObserving();
  locationSubscription?.remove();
  errorSubscription?.remove();
  locationSubscription = undefined;
  errorSubscription = undefined;
}

export function stopObserving(): void {
  watchers.clear();
  NativeGeolocationProvider.stopObserving();
  locationSubscription?.remove();
  errorSubscription?.remove();
  locationSubscription = undefined;
  errorSubscription = undefined;
}

export default {
  requestAuthorization,
  getCurrentPosition,
  watchPosition,
  clearWatch,
  stopObserving,
};
