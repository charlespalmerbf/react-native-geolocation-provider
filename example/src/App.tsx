import { Text, View, StyleSheet } from 'react-native';
import { getCurrentPosition } from 'react-native-geolocation-provider';
import { useState } from 'react';

export default function App() {
  const [result, setResult] = useState('Waiting for location');

  return (
    <View style={styles.container}>
      <Text
        onPress={() =>
          getCurrentPosition().then((position) =>
            setResult(JSON.stringify(position))
          )
        }
      >
        {result}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
