package dev.dablulite.sway

import android.os.Build
import android.view.RoundedCorner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class ScreenCornerRadiusModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ScreenCornerRadiusModule"

    @ReactMethod
    fun getCornerRadii(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("isSupported", false)
                putDouble("topLeft", 0.0)
                putDouble("topRight", 0.0)
                putDouble("bottomLeft", 0.0)
                putDouble("bottomRight", 0.0)
            })
            return
        }

        UiThreadUtil.runOnUiThread {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("E_NO_ACTIVITY", "Screen corner radii require an active Activity.")
                return@runOnUiThread
            }

            try {
                // Use the full display bounds, not an inset or split-screen app window.
                val insets = activity.windowManager.maximumWindowMetrics.windowInsets
                val density = activity.resources.displayMetrics.density.toDouble()
                val radii = Arguments.createMap().apply {
                    putBoolean("isSupported", true)
                    putDouble(
                        "topLeft",
                        (insets.getRoundedCorner(RoundedCorner.POSITION_TOP_LEFT)?.radius ?: 0) / density
                    )
                    putDouble(
                        "topRight",
                        (insets.getRoundedCorner(RoundedCorner.POSITION_TOP_RIGHT)?.radius ?: 0) / density
                    )
                    putDouble(
                        "bottomLeft",
                        (insets.getRoundedCorner(RoundedCorner.POSITION_BOTTOM_LEFT)?.radius ?: 0) / density
                    )
                    putDouble(
                        "bottomRight",
                        (insets.getRoundedCorner(RoundedCorner.POSITION_BOTTOM_RIGHT)?.radius ?: 0) / density
                    )
                }
                promise.resolve(radii)
            } catch (error: Exception) {
                promise.reject("E_SCREEN_CORNER_RADIUS", "Unable to read screen corner radii.", error)
            }
        }
    }
}
