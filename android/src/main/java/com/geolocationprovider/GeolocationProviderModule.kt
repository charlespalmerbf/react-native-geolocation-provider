package com.geolocationprovider

import com.facebook.react.bridge.ReactApplicationContext

class GeolocationProviderModule(reactContext: ReactApplicationContext) :
  NativeGeolocationProviderSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeGeolocationProviderSpec.NAME
  }
}
