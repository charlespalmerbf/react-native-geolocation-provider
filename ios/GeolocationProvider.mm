#import "GeolocationProvider.h"

@interface GeolocationProvider ()
@property(nonatomic, strong) CLLocationManager *watchManager;
@property(nonatomic, strong) CLLocationManager *requestManager;
@property(nonatomic, strong) CLLocationManager *permissionManager;
@property(nonatomic, copy) RCTPromiseResolveBlock requestResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock requestReject;
@property(nonatomic, copy) RCTPromiseResolveBlock authorizationResolve;
@property(nonatomic, strong) NSTimer *requestTimer;
@end

@implementation GeolocationProvider

- (void)requestAuthorization:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self requestAuthorization:resolve reject:reject];
    });
    return;
  }

  CLAuthorizationStatus status = [self authorizationStatus];
  if (status != kCLAuthorizationStatusNotDetermined) {
    resolve([self authorizationStatusString:status]);
    return;
  }

  self.authorizationResolve = resolve;
  self.permissionManager = [CLLocationManager new];
  self.permissionManager.delegate = self;
  [self.permissionManager requestWhenInUseAuthorization];
}

- (void)getCurrentPosition:(NSString *)options
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self getCurrentPosition:options resolve:resolve reject:reject];
    });
    return;
  }

  NSDictionary *parsed = [self optionsFromJSON:options];
  self.requestResolve = resolve;
  self.requestReject = reject;
  self.requestManager = [self configuredManager:parsed];
  self.requestManager.delegate = self;

  CLAuthorizationStatus status = [self authorizationStatus];
  if (![self isLocationPermissionAllowed:status]) {
    [self finishRequestWithCode:1 message:@"Location permission has not been granted"];
    return;
  }

  [self startCurrentLocationRequestWithOptions:parsed];
}

- (void)startCurrentLocationRequestWithOptions:(NSDictionary *)parsed
{
  CLLocation *cached = self.requestManager.location;
  NSTimeInterval maximumAge = [parsed[@"maximumAge"] doubleValue] / 1000.0;
  if (cached && maximumAge > 0 && -[cached.timestamp timeIntervalSinceNow] <= maximumAge) {
    [self finishRequestWithLocation:cached];
    return;
  }

  NSTimeInterval timeout = MAX([parsed[@"timeout"] doubleValue] / 1000.0, 0.001);
  if (!parsed[@"timeout"]) timeout = 30.0;
  self.requestTimer = [NSTimer scheduledTimerWithTimeInterval:timeout
                                                     target:self
                                                   selector:@selector(requestTimedOut)
                                                   userInfo:nil
                                                    repeats:NO];
  [self.requestManager requestLocation];
}

- (void)startObserving:(NSString *)options
{
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self startObserving:options];
    });
    return;
  }

  if (self.watchManager) return;

  NSDictionary *parsed = [self optionsFromJSON:options];
  self.watchManager = [self configuredManager:parsed];
  self.watchManager.delegate = self;

  CLAuthorizationStatus status = [self authorizationStatus];
  if (![self isLocationPermissionAllowed:status]) {
    [self emitOnLocationError:[self errorJSON:1 message:@"Location permission has not been granted"]];
    [self clearWatch];
    return;
  }

  [self startLocationWatchWithOptions:parsed];
}

- (void)startLocationWatchWithOptions:(NSDictionary *)parsed
{
  self.watchManager.distanceFilter = parsed[@"distanceFilter"] ? [parsed[@"distanceFilter"] doubleValue] : kCLDistanceFilterNone;
  [self.watchManager startUpdatingLocation];
}

- (void)stopObserving
{
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self stopObserving];
    });
    return;
  }

  [self clearWatch];
}

- (void)locationManager:(CLLocationManager *)manager didUpdateLocations:(NSArray<CLLocation *> *)locations
{
  CLLocation *location = locations.lastObject;
  if (!location) return;
  if (manager == self.requestManager) {
    [self finishRequestWithLocation:location];
  } else if (manager == self.watchManager) {
    [self emitOnLocation:[self locationJSON:location]];
  }
}

- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error
{
  NSInteger code = error.code == kCLErrorDenied ? 1 : 2;
  NSString *message = error.localizedDescription ?: @"Unable to determine location";
  if (manager == self.requestManager) {
    [self finishRequestWithCode:code message:message];
  } else if (manager == self.watchManager) {
    [self emitOnLocationError:[self errorJSON:code message:message]];
  }
}

- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager
{
  [self handleAuthorizationChangeForManager:manager status:manager.authorizationStatus];
}

- (void)locationManager:(CLLocationManager *)manager didChangeAuthorizationStatus:(CLAuthorizationStatus)status
{
  [self handleAuthorizationChangeForManager:manager status:status];
}

- (void)handleAuthorizationChangeForManager:(CLLocationManager *)manager status:(CLAuthorizationStatus)status
{
  if (status == kCLAuthorizationStatusNotDetermined) return;

  if (manager == self.permissionManager) {
    RCTPromiseResolveBlock resolve = self.authorizationResolve;
    [self clearAuthorizationRequest];
    if (resolve) resolve([self authorizationStatusString:status]);
  }
}

- (CLLocationManager *)configuredManager:(NSDictionary *)options
{
  CLLocationManager *manager = [CLLocationManager new];
  manager.desiredAccuracy = [options[@"enableHighAccuracy"] boolValue]
    ? kCLLocationAccuracyBest
    : kCLLocationAccuracyHundredMeters;
  return manager;
}

- (CLAuthorizationStatus)authorizationStatus
{
  if (@available(iOS 14.0, *)) {
    return CLLocationManager.authorizationStatus;
  }

  return [CLLocationManager authorizationStatus];
}

- (BOOL)isLocationPermissionAllowed:(CLAuthorizationStatus)status
{
  return status == kCLAuthorizationStatusAuthorizedWhenInUse ||
    status == kCLAuthorizationStatusAuthorizedAlways;
}

- (NSString *)authorizationStatusString:(CLAuthorizationStatus)status
{
  if ([self isLocationPermissionAllowed:status]) return @"granted";
  if (status == kCLAuthorizationStatusRestricted) return @"restricted";
  if (status == kCLAuthorizationStatusNotDetermined) return @"notDetermined";
  return @"denied";
}

- (NSDictionary *)optionsFromJSON:(NSString *)json
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  NSDictionary *options = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  return [options isKindOfClass:NSDictionary.class] ? options : @{};
}

- (NSString *)locationJSON:(CLLocation *)location
{
  CLHeading *heading = self.watchManager.heading;
  NSDictionary *coords = @{
    @"latitude": @(location.coordinate.latitude),
    @"longitude": @(location.coordinate.longitude),
    @"altitude": location.verticalAccuracy >= 0 ? @(location.altitude) : NSNull.null,
    @"accuracy": @(location.horizontalAccuracy),
    @"altitudeAccuracy": location.verticalAccuracy >= 0 ? @(location.verticalAccuracy) : NSNull.null,
    @"heading": location.course >= 0 ? @(location.course) : (heading ? @(heading.trueHeading) : NSNull.null),
    @"speed": location.speed >= 0 ? @(location.speed) : NSNull.null
  };
  NSDictionary *position = @{
    @"coords": coords,
    @"timestamp": @([location.timestamp timeIntervalSince1970] * 1000.0)
  };
  NSData *data = [NSJSONSerialization dataWithJSONObject:position options:0 error:nil];
  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (NSString *)errorJSON:(NSInteger)code message:(NSString *)message
{
  NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"code": @(code), @"message": message} options:0 error:nil];
  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (void)finishRequestWithLocation:(CLLocation *)location
{
  RCTPromiseResolveBlock resolve = self.requestResolve;
  [self clearRequest];
  if (resolve) resolve([self locationJSON:location]);
}

- (void)finishRequestWithCode:(NSInteger)code message:(NSString *)message
{
  RCTPromiseRejectBlock reject = self.requestReject;
  [self clearRequest];
  if (reject) reject([NSString stringWithFormat:@"%ld", (long)code], message, nil);
}

- (void)requestTimedOut
{
  [self finishRequestWithCode:3 message:@"Location request timed out"];
}

- (void)clearRequest
{
  [self.requestTimer invalidate];
  self.requestTimer = nil;
  self.requestManager.delegate = nil;
  self.requestManager = nil;
  self.requestResolve = nil;
  self.requestReject = nil;
}

- (void)clearWatch
{
  [self.watchManager stopUpdatingLocation];
  self.watchManager.delegate = nil;
  self.watchManager = nil;
}

- (void)clearAuthorizationRequest
{
  self.permissionManager.delegate = nil;
  self.permissionManager = nil;
  self.authorizationResolve = nil;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeGeolocationProviderSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"GeolocationProvider";
}

@end
