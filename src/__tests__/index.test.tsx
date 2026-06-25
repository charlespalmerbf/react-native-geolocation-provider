import { expect, it, jest } from '@jest/globals';

let mockEmitLocation: (payload: string) => void;

jest.mock('../NativeGeolocationProvider', () => ({
  __esModule: true,
  default: {
    requestAuthorization: jest.fn<() => Promise<string>>(),
    getCurrentPosition: jest.fn<() => Promise<string>>(),
    startObserving: jest.fn(),
    stopObserving: jest.fn(),
    onLocation: jest.fn((listener: (payload: string) => void) => {
      mockEmitLocation = listener;
      return { remove: jest.fn() };
    }),
    onLocationError: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

import NativeGeolocationProvider from '../NativeGeolocationProvider';
import {
  clearWatch,
  getCurrentPosition,
  requestAuthorization,
  watchPosition,
} from '../index';

const mockNativeModule = jest.mocked(NativeGeolocationProvider);

const position = {
  coords: {
    latitude: 50.8,
    longitude: -1.1,
    altitude: null,
    accuracy: 4,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1_750_000_000_000,
};

it('fetches and parses the current native position', async () => {
  mockNativeModule.getCurrentPosition.mockResolvedValue(
    JSON.stringify(position)
  );

  await expect(getCurrentPosition()).resolves.toEqual(position);
});

it('requests native location authorization', async () => {
  mockNativeModule.requestAuthorization.mockResolvedValue('granted');

  await expect(requestAuthorization()).resolves.toBe('granted');
});

it('forwards native updates and stops the final watcher', () => {
  const listener = jest.fn();
  const watchId = watchPosition(listener);

  mockEmitLocation(JSON.stringify(position));
  expect(listener).toHaveBeenCalledWith(position);

  clearWatch(watchId);
  expect(mockNativeModule.stopObserving).toHaveBeenCalled();
});
