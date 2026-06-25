import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  clearWatch,
  getCurrentPosition,
  requestAuthorization,
  watchPosition,
  type GeolocationError,
  type GeolocationPosition,
} from 'react-native-geolocation-provider';
import { useState } from 'react';

export default function App() {
  const [currentPosition, setCurrentPosition] = useState<
    GeolocationPosition | undefined
  >();
  const [watchId, setWatchId] = useState<number | undefined>();
  const [logs, setLogs] = useState<string[]>([
    'Grant location permission, then choose a location action.',
  ]);

  const log = (message: string) =>
    setLogs((previous) => [
      `${new Date().toLocaleTimeString()} ${message}`,
      ...previous,
    ]);

  const logPosition = (label: string, position: GeolocationPosition) => {
    const latitude = position.coords.latitude.toFixed(6);
    const longitude = position.coords.longitude.toFixed(6);
    const accuracy = position.coords.accuracy.toFixed(1);

    setCurrentPosition(position);
    log(`${label}: ${latitude}, ${longitude} +/-${accuracy}m`);
  };

  const logError = (label: string, error: GeolocationError) => {
    log(`${label} error ${error.code}: ${error.message}`);
  };

  const requestLocationPermission = () => {
    log('Requesting location permission');
    requestAuthorization()
      .then((status) => log(`Location permission: ${status}`))
      .catch((error: { message?: string }) =>
        log(`Location permission error: ${error.message ?? 'Unknown error'}`)
      );
  };

  const fetchCurrentPosition = () => {
    log('Requesting current position');
    getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 30_000,
      maximumAge: 0,
    })
      .then((position) => logPosition('Current position', position))
      .catch((error: GeolocationError) => logError('Current position', error));
  };

  const startWatch = () => {
    if (watchId !== undefined) {
      log(`Watch already running: ${watchId}`);
      return;
    }

    const id = watchPosition(
      (position) => logPosition('Watch update', position),
      (error) => logError('Watch', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 3_000,
        fastestInterval: 1_000,
      }
    );
    setWatchId(id);
    log(`Started watch: ${id}`);
  };

  const stopWatch = () => {
    if (watchId === undefined) {
      log('No watch is running');
      return;
    }

    clearWatch(watchId);
    log(`Stopped watch: ${watchId}`);
    setWatchId(undefined);
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#f6f7fb" barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Latest position</Text>
          <Text style={styles.value}>
            {currentPosition
              ? `${currentPosition.coords.latitude.toFixed(6)}, ${currentPosition.coords.longitude.toFixed(6)}`
              : 'No location received yet'}
          </Text>
          <Text style={styles.meta}>
            {currentPosition
              ? `Accuracy ${currentPosition.coords.accuracy.toFixed(1)}m`
              : `Watch status: ${watchId === undefined ? 'stopped' : `running (${watchId})`}`}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Request location permission"
            onPress={requestLocationPermission}
          />
          <Button label="Get current position" onPress={fetchCurrentPosition} />
          <Button
            label={
              watchId === undefined ? 'Start watch position' : 'Watch running'
            }
            onPress={startWatch}
            disabled={watchId !== undefined}
          />
          <Button
            label="Stop watch position"
            onPress={stopWatch}
            disabled={watchId === undefined}
            variant="secondary"
          />
          <Button
            label="Clear logs"
            onPress={() => setLogs([])}
            variant="secondary"
          />
        </View>

        <View style={styles.logCard}>
          <Text style={styles.label}>Logs</Text>
          <ScrollView
            style={styles.logs}
            contentContainerStyle={styles.logList}
          >
            {logs.length === 0 ? (
              <Text style={styles.meta}>No logs yet</Text>
            ) : (
              logs.map((entry, index) => (
                <Text key={`${entry}-${index}`} style={styles.logEntry}>
                  {entry}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.secondaryButtonText,
          disabled && styles.disabledButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7fb',
    paddingTop: 24,
    paddingBottom: 24,
  },
  container: {
    flex: 1,
    gap: 18,
    paddingHorizontal: 24,
    backgroundColor: '#f6f7fb',
  },
  card: {
    gap: 8,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    color: '#101828',
    fontSize: 20,
    fontWeight: '600',
  },
  meta: {
    color: '#667085',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
  },
  button: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: '#155eef',
  },
  secondaryButton: {
    borderColor: '#d0d5dd',
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  disabledButton: {
    backgroundColor: '#eaecf0',
  },
  pressedButton: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#344054',
  },
  disabledButtonText: {
    color: '#98a2b3',
  },
  logCard: {
    flex: 1,
    minHeight: 160,
    gap: 10,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#101828',
  },
  logs: {
    flex: 1,
  },
  logList: {
    gap: 8,
  },
  logEntry: {
    color: '#d0d5dd',
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
  },
});
