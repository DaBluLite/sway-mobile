package dev.dablulite.sway

import android.bluetooth.BluetoothA2dp
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SystemUiModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    companion object {
        private const val TAG = "SystemUiModule"

        private const val EVENT_BATTERY = "onSystemBatteryLevel"
        private const val EVENT_NETWORK = "onSystemNetworkType"
        private const val EVENT_BLUETOOTH = "onSystemBluetoothState"

        // Fallback re-emit interval used when a state change cannot be captured
        // through an Android event (e.g. a broadcast never arrives).
        private const val FALLBACK_INTERVAL_MS = 5000L
    }

    override fun getName() = "SystemUiModule"

    private val handler = Handler(Looper.getMainLooper())

    // Reference counts so native listeners are only active while JS is listening.
    private var batteryListeners = 0
    private var networkListeners = 0
    private var bluetoothListeners = 0

    private var batteryReceiver: BroadcastReceiver? = null
    private var bluetoothReceiver: BroadcastReceiver? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var fallbackRunnable: Runnable? = null

    private var lastBattery: Int? = null
    private var lastNetwork: String? = null
    private var lastBluetooth: Boolean? = null

    private fun emit(eventName: String, data: Any) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }

    private fun emitBattery(level: Int) {
        lastBattery = level
        emit(EVENT_BATTERY, level)
    }

    private fun emitNetwork(type: String) {
        lastNetwork = type
        emit(EVENT_NETWORK, type)
    }

    private fun emitBluetooth(state: Boolean) {
        lastBluetooth = state
        emit(EVENT_BLUETOOTH, state)
    }

    private fun readBatteryLevel(): Int {
        val bm = reactApplicationContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    private fun readNetworkType(): String {
        val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = cm.activeNetwork ?: return "none"
        val caps = cm.getNetworkCapabilities(activeNetwork) ?: return "none"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "wifi"
            else -> "none"
        }
    }

    private fun readBluetoothState(): Boolean {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null || !adapter.isEnabled) return false
        val state = adapter.getProfileConnectionState(BluetoothProfile.A2DP)
        return state == BluetoothProfile.STATE_CONNECTED
    }

    @ReactMethod
    fun startBatteryUpdates() {
        batteryListeners++
        if (batteryListeners == 1) {
            batteryReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    emitBattery(readBatteryLevel())
                }
            }
            runCatching {
                reactApplicationContext.registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            }
            startFallbackIfNeeded()
            // Initial value so subscribers always get a state on subscribe.
            emitBattery(readBatteryLevel())
        }
    }

    @ReactMethod
    fun stopBatteryUpdates() {
        batteryListeners = (batteryListeners - 1).coerceAtLeast(0)
        if (batteryListeners == 0) {
            batteryReceiver?.let {
                runCatching { reactApplicationContext.unregisterReceiver(it) }
            }
            batteryReceiver = null
            lastBattery = null
            stopFallbackIfNeeded()
        }
    }

    @ReactMethod
    fun startNetworkUpdates() {
        networkListeners++
        if (networkListeners == 1) {
            val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) = emitNetwork(readNetworkType())
                override fun onLost(network: Network) = emitNetwork(readNetworkType())
                override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) =
                    emitNetwork(readNetworkType())
            }
            runCatching {
                cm.registerDefaultNetworkCallback(networkCallback!!)
            }
            startFallbackIfNeeded()
            // Initial value so subscribers always get a state on subscribe.
            emitNetwork(readNetworkType())
        }
    }

    @ReactMethod
    fun stopNetworkUpdates() {
        networkListeners = (networkListeners - 1).coerceAtLeast(0)
        if (networkListeners == 0) {
            val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            networkCallback?.let { runCatching { cm.unregisterNetworkCallback(it) } }
            networkCallback = null
            lastNetwork = null
            stopFallbackIfNeeded()
        }
    }

    @ReactMethod
    fun startBluetoothUpdates() {
        bluetoothListeners++
        if (bluetoothListeners == 1) {
            bluetoothReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    emitBluetooth(readBluetoothState())
                }
            }
            val filter = IntentFilter().apply {
                addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
                addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
            }
            runCatching {
                reactApplicationContext.registerReceiver(bluetoothReceiver, filter)
            }
            startFallbackIfNeeded()
            // Initial value so subscribers always get a state on subscribe.
            emitBluetooth(readBluetoothState())
        }
    }

    @ReactMethod
    fun stopBluetoothUpdates() {
        bluetoothListeners = (bluetoothListeners - 1).coerceAtLeast(0)
        if (bluetoothListeners == 0) {
            bluetoothReceiver?.let {
                runCatching { reactApplicationContext.unregisterReceiver(it) }
            }
            bluetoothReceiver = null
            lastBluetooth = null
            stopFallbackIfNeeded()
        }
    }

    private fun startFallbackIfNeeded() {
        if (fallbackRunnable == null && (batteryListeners > 0 || networkListeners > 0 || bluetoothListeners > 0)) {
            fallbackRunnable = Runnable {
                runFallbackTick()
                fallbackRunnable?.let { handler.postDelayed(it, FALLBACK_INTERVAL_MS) }
            }
            handler.postDelayed(fallbackRunnable!!, FALLBACK_INTERVAL_MS)
        }
    }

    private fun stopFallbackIfNeeded() {
        if (batteryListeners == 0 && networkListeners == 0 && bluetoothListeners == 0) {
            fallbackRunnable?.let { handler.removeCallbacks(it) }
            fallbackRunnable = null
        }
    }

    private fun runFallbackTick() {
        if (batteryListeners > 0) {
            val level = readBatteryLevel()
            if (level != lastBattery) emitBattery(level)
        }
        if (networkListeners > 0) {
            val type = readNetworkType()
            if (type != lastNetwork) emitNetwork(type)
        }
        if (bluetoothListeners > 0) {
            val state = readBluetoothState()
            if (state != lastBluetooth) emitBluetooth(state)
        }
    }

    override fun invalidate() {
        stopBatteryUpdates()
        stopNetworkUpdates()
        stopBluetoothUpdates()
        super.invalidate()
    }

    private fun rootCauseMessage(t: Throwable): String {
        var cause: Throwable? = t
        while (cause?.cause != null && cause.cause !== cause) {
            cause = cause.cause
        }
        return cause?.message ?: t.message ?: "Unknown error"
    }

    @ReactMethod
    fun enterCarHomeUi(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
            ?: return promise.reject("NO_ACTIVITY", "No current activity")
        activity.runOnUiThread {
            try {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                val window = activity.window
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    window.setDecorFitsSystemWindows(false)
                    window.insetsController?.let { controller ->
                        controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                        controller.systemBarsBehavior =
                            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    }
                } else {
                    @Suppress("DEPRECATION")
                    window.setFlags(
                        WindowManager.LayoutParams.FLAG_FULLSCREEN,
                        WindowManager.LayoutParams.FLAG_FULLSCREEN
                    )
                    @Suppress("DEPRECATION")
                    window.decorView.systemUiVisibility =
                        (android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                or android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                or android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                or android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                or android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                                or android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
                }
                promise.resolve(true)
            } catch (t: Throwable) {
                promise.reject("CAR_HOME_ENTER_FAILED", rootCauseMessage(t))
            }
        }
    }

    @ReactMethod
    fun exitCarHomeUi(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
            ?: return promise.reject("NO_ACTIVITY", "No current activity")
        activity.runOnUiThread {
            try {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                val window = activity.window
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    window.setDecorFitsSystemWindows(true)
                    window.insetsController?.show(
                        WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
                    )
                } else {
                    @Suppress("DEPRECATION")
                    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
                    @Suppress("DEPRECATION")
                    window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                }
                promise.resolve(true)
            } catch (t: Throwable) {
                promise.reject("CAR_HOME_EXIT_FAILED", rootCauseMessage(t))
            }
        }
    }
}
