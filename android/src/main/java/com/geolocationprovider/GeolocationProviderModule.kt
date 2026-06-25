package com.geolocationprovider

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.location.LocationRequest
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import org.json.JSONObject

class GeolocationProviderModule(private val reactContext: ReactApplicationContext) :
  NativeGeolocationProviderSpec(reactContext), LocationListener, PermissionListener {

  private val locationManager =
    reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
  private val handler = Handler(Looper.getMainLooper())
  private var observing = false
  private var authorizationPromise: Promise? = null

  override fun requestAuthorization(promise: Promise) {
    if (hasPermission()) {
      promise.resolve("granted")
      return
    }

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.resolve("granted")
      return
    }

    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("2", "No current activity is available to request location permission")
      return
    }

    val permissionAwareActivity = activity as? PermissionAwareActivity
    if (permissionAwareActivity == null) {
      promise.reject("2", "Current activity cannot request location permission")
      return
    }

    authorizationPromise = promise
    permissionAwareActivity.requestPermissions(
      arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
      ),
      LOCATION_PERMISSION_REQUEST,
      this
    )
  }

  override fun getCurrentPosition(options: String, promise: Promise) {
    if (!hasPermission()) {
      promise.reject("1", "Location permission has not been granted")
      return
    }

    val parsed = JSONObject(options.ifBlank { "{}" })
    val maximumAge = parsed.optLong("maximumAge", 0L)
    val provider = selectProvider(parsed.optBoolean("enableHighAccuracy", false))
    if (provider == null) {
      promise.reject("2", "No location provider is available")
      return
    }

    val cached = locationManager.getLastKnownLocation(provider)
    if (cached != null && maximumAge > 0 && System.currentTimeMillis() - cached.time <= maximumAge) {
      promise.resolve(locationJson(cached))
      return
    }

    val timeout = parsed.optLong("timeout", 30000L).coerceAtLeast(1L)
    var completed = false
    lateinit var timeoutTask: Runnable
    val listener = object : LocationListener {
      override fun onLocationChanged(location: Location) {
        if (completed) return
        completed = true
        handler.removeCallbacks(timeoutTask)
        locationManager.removeUpdates(this)
        promise.resolve(locationJson(location))
      }

      override fun onProviderDisabled(disabledProvider: String) {
        if (completed) return
        completed = true
        handler.removeCallbacks(timeoutTask)
        locationManager.removeUpdates(this)
        promise.reject("2", "Location provider was disabled")
      }

      @Deprecated("Deprecated in Android")
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
    }
    timeoutTask = Runnable {
      if (!completed) {
        completed = true
        locationManager.removeUpdates(listener)
        promise.reject("3", "Location request timed out")
      }
    }
    locationManager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
    handler.postDelayed(timeoutTask, timeout)
  }

  override fun startObserving(options: String) {
    if (observing) return
    if (!hasPermission()) {
      emitOnLocationError(errorJson(1, "Location permission has not been granted"))
      return
    }

    val parsed = JSONObject(options.ifBlank { "{}" })
    val provider = selectProvider(parsed.optBoolean("enableHighAccuracy", false))
    if (provider == null) {
      emitOnLocationError(errorJson(2, "No location provider is available"))
      return
    }

    val interval = parsed.optLong("interval", 1000L).coerceAtLeast(0L)
    val fastestInterval = parsed.optLong("fastestInterval", interval).coerceIn(0L, interval)
    val distance = parsed.optDouble("distanceFilter", 0.0).coerceAtLeast(0.0).toFloat()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val quality = if (parsed.optBoolean("enableHighAccuracy", false)) {
        LocationRequest.QUALITY_HIGH_ACCURACY
      } else {
        LocationRequest.QUALITY_BALANCED_POWER_ACCURACY
      }
      val request = LocationRequest.Builder(interval)
        .setMinUpdateIntervalMillis(fastestInterval)
        .setMinUpdateDistanceMeters(distance)
        .setQuality(quality)
        .build()
      locationManager.requestLocationUpdates(
        provider,
        request,
        ContextCompat.getMainExecutor(reactContext),
        this
      )
    } else {
      locationManager.requestLocationUpdates(provider, interval, distance, this, Looper.getMainLooper())
    }
    observing = true
  }

  override fun stopObserving() {
    locationManager.removeUpdates(this)
    observing = false
  }

  override fun onLocationChanged(location: Location) = emitOnLocation(locationJson(location))

  override fun onProviderDisabled(provider: String) {
    emitOnLocationError(errorJson(2, "Location provider was disabled"))
  }

  @Deprecated("Deprecated in Android")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  override fun invalidate() {
    stopObserving()
    handler.removeCallbacksAndMessages(null)
    authorizationPromise = null
    super.invalidate()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ): Boolean {
    if (requestCode != LOCATION_PERMISSION_REQUEST) return false

    authorizationPromise?.resolve(if (hasPermission()) "granted" else "denied")
    authorizationPromise = null
    return true
  }

  private fun hasPermission(): Boolean =
    ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  private fun selectProvider(highAccuracy: Boolean): String? {
    val preferred = if (highAccuracy) LocationManager.GPS_PROVIDER else LocationManager.NETWORK_PROVIDER
    if (locationManager.isProviderEnabled(preferred)) return preferred
    val fallback = if (highAccuracy) LocationManager.NETWORK_PROVIDER else LocationManager.GPS_PROVIDER
    return fallback.takeIf(locationManager::isProviderEnabled)
  }

  private fun locationJson(location: Location) = JSONObject().apply {
    put("timestamp", location.time.toDouble())
    put("coords", JSONObject().apply {
      put("latitude", location.latitude)
      put("longitude", location.longitude)
      put("altitude", if (location.hasAltitude()) location.altitude else JSONObject.NULL)
      put("accuracy", location.accuracy.toDouble())
      put("altitudeAccuracy", if (android.os.Build.VERSION.SDK_INT >= 26 && location.hasVerticalAccuracy()) location.verticalAccuracyMeters.toDouble() else JSONObject.NULL)
      put("heading", if (location.hasBearing()) location.bearing.toDouble() else JSONObject.NULL)
      put("speed", if (location.hasSpeed()) location.speed.toDouble() else JSONObject.NULL)
    })
  }.toString()

  private fun errorJson(code: Int, message: String) =
    JSONObject().put("code", code).put("message", message).toString()

  companion object {
    const val NAME = NativeGeolocationProviderSpec.NAME
    private const val LOCATION_PERMISSION_REQUEST = 1001
  }
}
