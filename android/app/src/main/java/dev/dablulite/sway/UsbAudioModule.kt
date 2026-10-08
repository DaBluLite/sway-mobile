package dev.dablulite.sway

import android.app.PendingIntent
import android.content.*
import android.hardware.usb.UsbManager
import android.media.*
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class UsbAudioModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        private const val TAG = "UsbAudioModule"
        const val ACTION_USB_PERMISSION = "dev.dablulite.sway.USB_PERMISSION"
    }
    override fun getName() = "UsbAudioModule"

    private var preferredDevice: AudioDeviceInfo? = null
    private var exclusiveGranted = false
    private var pendingExclusivePromise: Promise? = null
    private var pendingExclusiveDeviceId: Int = -1
    private var lastAppliedRate: Int = 0
    private var lastAppliedBits: Int = 0
    private var lastDirectSupported: Boolean = false

    private var audioCallback: AudioDeviceCallback? = null
    private var usbReceiverRegistered = false

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                ACTION_USB_PERMISSION -> {
                    val device = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, android.hardware.usb.UsbDevice::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    if (granted) {
                        grantExclusive(pendingExclusiveDeviceId)
                    } else {
                        pendingExclusivePromise?.reject("PERMISSION_DENIED", "USB permission denied for $device")
                        pendingExclusivePromise = null
                    }
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    // Give AudioManager a moment to enumerate
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ emitAttached() }, 800)
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    sendEvent("UsbAudioDeviceDetached", null)
                    if (exclusiveGranted) { preferredDevice = null; exclusiveGranted = false; sendEvent("UsbAudioExclusiveReleased", null) }
                }
            }
        }
    }

    override fun initialize() {
        super.initialize()
        try { registerReceiver() } catch (t: Throwable) { Log.w(TAG, "registerReceiver failed", t) }
        try { registerAudioCallback() } catch (t: Throwable) { Log.w(TAG, "registerAudioCallback failed", t) }
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            try { emitAttached() } catch (t: Throwable) { Log.w(TAG, "emitAttached failed", t) }
        }, 1500)
    }

    private fun registerReceiver() {
        if (usbReceiverRegistered) return
        val f = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION); addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED); addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        if (Build.VERSION.SDK_INT >= 33) reactApplicationContext.registerReceiver(usbReceiver, f, Context.RECEIVER_NOT_EXPORTED)
        else reactApplicationContext.registerReceiver(usbReceiver, f)
        usbReceiverRegistered = true
    }

    private fun registerAudioCallback() {
        if (Build.VERSION.SDK_INT < 23) return
        val am = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val cb = object : AudioDeviceCallback() {
            override fun onAudioDevicesAdded(devices: Array<AudioDeviceInfo>) {
                val usb = devices.any { it.type == AudioDeviceInfo.TYPE_USB_DEVICE || it.type == AudioDeviceInfo.TYPE_USB_HEADSET || it.type == AudioDeviceInfo.TYPE_USB_ACCESSORY }
                if (usb) emitAttached()
            }
            override fun onAudioDevicesRemoved(devices: Array<AudioDeviceInfo>) {
                val usb = devices.any { it.type == AudioDeviceInfo.TYPE_USB_DEVICE || it.type == AudioDeviceInfo.TYPE_USB_HEADSET || it.type == AudioDeviceInfo.TYPE_USB_ACCESSORY }
                if (usb) sendEvent("UsbAudioDeviceDetached", null)
            }
        }
        am.registerAudioDeviceCallback(cb, android.os.Handler(android.os.Looper.getMainLooper()))
        audioCallback = cb
    }

    private fun emitAttached() {
        try {
            val devs = getUsbDevices()
            if (devs.isEmpty()) return
            val arr = Arguments.createArray().apply { devs.forEach { pushMap(deviceToMap(it)) } }
            sendEventArray("UsbAudioDeviceAttached", arr)
            sendEventArray("UsbAudioDevicesChanged", arr)
        } catch (t: Throwable) { Log.w(TAG, "emitAttached failed", t) }
    }

    private fun getUsbDevices(): Array<AudioDeviceInfo> {
        val am = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        return if (Build.VERSION.SDK_INT >= 23) {
            am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
                .filter { it.type == AudioDeviceInfo.TYPE_USB_DEVICE || it.type == AudioDeviceInfo.TYPE_USB_HEADSET || it.type == AudioDeviceInfo.TYPE_USB_ACCESSORY }
                .toTypedArray()
        } else arrayOf()
    }

    private fun deviceToMap(d: AudioDeviceInfo): WritableMap = Arguments.createMap().apply {
        putInt("id", d.id); putString("name", d.productName?.toString() ?: "USB DAC"); putInt("type", d.type)
        putArray("sampleRates", Arguments.createArray().apply { d.sampleRates.forEach { pushInt(it) } })
        putArray("channelCounts", Arguments.createArray().apply { d.channelCounts.forEach { pushInt(it) } })
        putString("productName", d.productName?.toString() ?: "")
    }

    @ReactMethod fun getUsbDevices(promise: Promise) {
        try { promise.resolve(Arguments.createArray().apply { getUsbDevices().forEach { pushMap(deviceToMap(it)) } }) }
        catch (t: Throwable) { promise.reject("ENUM_FAIL", t.message, t) }
    }

    private fun grantExclusive(deviceId: Int) {
        val target = getUsbDevices().find { it.id == deviceId } ?: getUsbDevices().firstOrNull()
        if (target == null) { pendingExclusivePromise?.reject("NO_USB", "No USB DAC"); pendingExclusivePromise=null; return }
        preferredDevice = target; exclusiveGranted = true
        val map = Arguments.createMap().apply { putInt("deviceId", target.id); putString("deviceName", target.productName?.toString() ?: "USB DAC") }
        sendEvent("UsbAudioExclusiveGranted", map)
        pendingExclusivePromise?.resolve(true); pendingExclusivePromise=null
    }

    @ReactMethod fun requestExclusive(deviceId: Int, promise: Promise) {
        try {
            val devs = getUsbDevices()
            if (devs.isEmpty()) return promise.reject("NO_USB", "No USB DAC connected")
            // USB audio class DACs are accessed via AudioManager and do NOT require
            // UsbManager permission – requesting it for class-1 devices triggers the
            // system "use with this app" chooser and was crashing (IllegalArgumentException
            // on PendingIntent / receiver export on Android 14+). Grant exclusive directly.
            // Only fall back to UsbManager flow if explicitly needed.
            pendingExclusivePromise = promise; pendingExclusiveDeviceId = deviceId
            grantExclusive(deviceId)
        } catch (t: Throwable) {
            Log.e(TAG, "requestExclusive failed", t)
            try { promise.reject("EXCLUSIVE_FAIL", t.message ?: "unknown", t) } catch (_: Throwable) {}
        }
    }

    @ReactMethod fun requestUsbPermission(promise: Promise) {
        try {
            val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
            val rawDevice = usbManager.deviceList.values.firstOrNull() ?: return promise.reject("NO_USB", "No USB device")
            if (usbManager.hasPermission(rawDevice)) return promise.resolve(true)
            pendingExclusivePromise = promise; pendingExclusiveDeviceId = -1
            val pi = PendingIntent.getBroadcast(reactApplicationContext, 0, Intent(ACTION_USB_PERMISSION), PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            usbManager.requestPermission(rawDevice, pi)
        } catch (t: Throwable) { promise.reject("PERM_FAIL", t.message, t) }
    }

    @ReactMethod fun releaseExclusive(promise: Promise) {
        preferredDevice = null; exclusiveGranted = false; sendEvent("UsbAudioExclusiveReleased", null); promise.resolve(true)
    }
    @ReactMethod fun isExclusiveGranted(promise: Promise) { promise.resolve(exclusiveGranted) }
    @ReactMethod fun getPreferredDevice(promise: Promise) {
        val d = preferredDevice; if (d == null) promise.resolve(null) else promise.resolve(deviceToMap(d))
    }
    @ReactMethod fun getPlaybackState(promise: Promise) {
        try {
            val dev = preferredDevice
            val devs = getUsbDevices()
            val map = Arguments.createMap().apply {
                putBoolean("exclusiveGranted", exclusiveGranted)
                putBoolean("connected", devs.isNotEmpty())
                if (dev != null) {
                    putMap("device", deviceToMap(dev))
                    putInt("appliedSampleRate", lastAppliedRate)
                    putInt("appliedBitDepth", lastAppliedBits)
                    putBoolean("directSupported", lastDirectSupported)
                } else if (devs.isNotEmpty()) {
                    putMap("device", deviceToMap(devs[0]))
                }
            }
            promise.resolve(map)
        } catch (t: Throwable) { promise.reject("STATE_FAIL", t.message, t) }
    }
    @ReactMethod fun applyBitPerfectParams(sampleRate: Int, bitDepth: Int, promise: Promise) {
        if (!exclusiveGranted) { promise.resolve(false); return }
        val device = preferredDevice ?: return promise.reject("NO_DEVICE", "Call requestExclusive first")
        val bestRate = device.sampleRates.let { rates -> if (rates.isEmpty()) sampleRate else rates.minByOrNull { kotlin.math.abs(it - sampleRate) } ?: sampleRate }
        val encoding = when (bitDepth) { 32 -> AudioFormat.ENCODING_PCM_FLOAT; 24 -> AudioFormat.ENCODING_PCM_24BIT_PACKED; else -> AudioFormat.ENCODING_PCM_16BIT }
        val format = AudioFormat.Builder().setSampleRate(bestRate).setEncoding(encoding).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build()
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()
        var directSupported = false
        if (Build.VERSION.SDK_INT >= 29) { try { directSupported = AudioTrack.isDirectPlaybackSupported(format, attrs) } catch (_: Throwable) {} }
        val map = Arguments.createMap().apply {
            putInt("requestedSampleRate", sampleRate); putInt("requestedBitDepth", bitDepth)
            putInt("appliedSampleRate", bestRate); putInt("appliedBitDepth", bitDepth)
            putBoolean("directSupported", directSupported); putInt("deviceId", device.id)
        }
        lastAppliedRate = bestRate; lastAppliedBits = bitDepth; lastDirectSupported = directSupported
        sendEvent("UsbAudioParamsApplied", map)
        Log.i(TAG, "applyBitPerfect $sampleRate/$bitDepth -> $bestRate direct=$directSupported")
        promise.resolve(map)
    }

    private fun sendEvent(name: String, params: WritableMap?) {
        if (reactApplicationContext.hasActiveReactInstance())
            reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, params)
    }
    private fun sendEventArray(name: String, params: WritableArray) {
        if (reactApplicationContext.hasActiveReactInstance())
            reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, params)
    }
    @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
    override fun onCatalystInstanceDestroy() {
        try { if (audioCallback != null) (reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager).unregisterAudioDeviceCallback(audioCallback!!) } catch (_: Throwable) {}
        try { if (usbReceiverRegistered) reactApplicationContext.unregisterReceiver(usbReceiver) } catch (_: Throwable) {}
    }
}
