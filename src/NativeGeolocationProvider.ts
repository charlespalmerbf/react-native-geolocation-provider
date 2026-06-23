import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

export interface Spec extends TurboModule {
  getCurrentPosition(options: string): Promise<string>;
  startObserving(options: string): void;
  stopObserving(): void;
  readonly onLocation: CodegenTypes.EventEmitter<string>;
  readonly onLocationError: CodegenTypes.EventEmitter<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GeolocationProvider');
