#import <CoreLocation/CoreLocation.h>
#import <GeolocationProviderSpec/GeolocationProviderSpec.h>

@interface GeolocationProvider : NativeGeolocationProviderSpecBase <NativeGeolocationProviderSpec, CLLocationManagerDelegate>
@end
