package dev.dablulite.sway

import android.bluetooth.*
import android.util.Log
import com.facebook.react.bridge.*
import java.lang.reflect.Constructor
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method

class BtCodecModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    companion object {
        private const val TAG = "BtCodecModule"
    }

    override fun getName() = "BtCodecModule"

    private var a2dp: BluetoothA2dp? = null
    private var pendingPromise: Promise? = null
    private val getCodecStatusMethod: Method by lazy {
        BluetoothA2dp::class.java.getMethod("getCodecStatus", BluetoothDevice::class.java)
    }
    private val setCodecConfigPreferenceMethod: Method by lazy {
        BluetoothA2dp::class.java.getMethod(
            "setCodecConfigPreference",
            BluetoothDevice::class.java,
            BluetoothCodecConfig::class.java
        )
    }
    private val codecConfigCtor: Constructor<BluetoothCodecConfig> by lazy {
        BluetoothCodecConfig::class.java.getDeclaredConstructor(
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType,
            Long::class.javaPrimitiveType,
            Long::class.javaPrimitiveType,
            Long::class.javaPrimitiveType,
            Long::class.javaPrimitiveType
        ).apply { isAccessible = true }
    }

    // Constants from android.bluetooth.BluetoothCodecConfig — verify against the
    // AOSP source for your minSdk/targetSdk before shipping; a few have shifted
    // in recent releases (see note below on getSupportedCodecTypes).
    private object Codec {
        const val TYPE_SBC = 0
        const val TYPE_AAC = 1
        const val TYPE_APTX = 2
        const val TYPE_APTX_HD = 3
        const val TYPE_LDAC = 4
    }
    private object SampleRate {
        const val R44100 = 0x1
        const val R48000 = 0x1 shl 1
        const val R88200 = 0x1 shl 2
        const val R96000 = 0x1 shl 3
        const val R176400 = 0x1 shl 4
        const val R192000 = 0x1 shl 5
    }
    private object Bits {
        const val B16 = 0x1
        const val B24 = 0x1 shl 1
        const val B32 = 0x1 shl 2
    }
    private val CHANNEL_STEREO = 0x1 shl 1

    private val profileListener = object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
            if (profile == BluetoothProfile.A2DP) {
                a2dp = proxy as BluetoothA2dp
                pendingPromise?.resolve(true)
                pendingPromise = null
            }
        }
        override fun onServiceDisconnected(profile: Int) {
            if (profile == BluetoothProfile.A2DP) a2dp = null
        }
    }

    private fun rootCauseMessage(t: Throwable): String {
        var cause: Throwable? = t
        while (cause?.cause != null && cause.cause !== cause) {
            cause = cause.cause
        }
        return cause?.message ?: t.message ?: "Unknown error"
    }

    @ReactMethod
    fun connect(promise: Promise) {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) { promise.reject("NO_ADAPTER", "No Bluetooth adapter"); return }
        pendingPromise = promise
        adapter.getProfileProxy(reactApplicationContext, profileListener, BluetoothProfile.A2DP)
    }

    private fun decodeSampleRate(flag: Int): Int = when (flag) {
        SampleRate.R192000 -> 192000
        SampleRate.R176400 -> 176400
        SampleRate.R96000 -> 96000
        SampleRate.R88200 -> 88200
        SampleRate.R48000 -> 48000
        SampleRate.R44100 -> 44100
        else -> {
            // OEMs sometimes return raw Hz; also handle combined bitmask (pick highest single bit)
            when {
                flag >= 1000 -> flag
                flag and SampleRate.R192000 != 0 -> 192000
                flag and SampleRate.R176400 != 0 -> 176400
                flag and SampleRate.R96000 != 0 -> 96000
                flag and SampleRate.R88200 != 0 -> 88200
                flag and SampleRate.R48000 != 0 -> 48000
                flag and SampleRate.R44100 != 0 -> 44100
                else -> flag
            }
        }
    }

    private fun decodeBitsPerSample(flag: Int): Int = when (flag) {
        Bits.B32 -> 32
        Bits.B24 -> 24
        Bits.B16 -> 16
        else -> when {
            flag >= 16 -> flag // already raw
            flag and Bits.B32 != 0 -> 32
            flag and Bits.B24 != 0 -> 24
            flag and Bits.B16 != 0 -> 16
            else -> flag
        }
    }

    @ReactMethod
    fun getCurrentCodecInfo(promise: Promise) {
        val proxy = a2dp ?: return promise.reject("NO_A2DP", "Call connect() first")
        val device = proxy.connectedDevices.firstOrNull()
            ?: return promise.reject("NO_DEVICE", "No connected A2DP device")

        try {
            val status = getCodecStatusMethod.invoke(proxy, device) as? BluetoothCodecStatus ?: run {
                promise.reject("NO_STATUS", "getCodecStatus returned null"); return
            }
            val cfg = status.codecConfig ?: run {
                promise.reject("NO_CODEC_CONFIG", "codecConfig returned null"); return
            }
            // cfg.sampleRate/bitsPerSample are bitmask flags (e.g. 0x1,0x2,0x4), not raw Hz/bits.
            // Previously returned flag (e.g. 2) which looks like "option index 2/2".
            val map = Arguments.createMap().apply {
                putInt("codecType", cfg.codecType)
                putInt("sampleRate", decodeSampleRate(cfg.sampleRate))
                putInt("bitsPerSample", decodeBitsPerSample(cfg.bitsPerSample))
            }
            promise.resolve(map)
        } catch (e: InvocationTargetException) {
            Log.w(TAG, "getCurrentCodecInfo hidden API invocation failed", e.targetException ?: e)
            val root = e.targetException ?: e
            promise.reject("CODEC_STATUS_UNAVAILABLE", rootCauseMessage(root))
        } catch (t: Throwable) {
            Log.w(TAG, "getCurrentCodecInfo failed", t)
            promise.reject("REFLECT_FAIL", rootCauseMessage(t))
        }
    }

    /**
     * sampleRate/bitsPerSample are the *raw track values* (e.g. 96000, 24),
     * not the bitmask flags — this method does the mapping.
     */
    @ReactMethod
    fun applyPreferredParams(sampleRate: Int, bitsPerSample: Int, promise: Promise) {
        val proxy = a2dp ?: return promise.reject("NO_A2DP", "Call connect() first")
        val device = proxy.connectedDevices.firstOrNull()
            ?: return promise.reject("NO_DEVICE", "No connected A2DP device")

        val srFlag = mapSampleRate(sampleRate)
        val bitsFlag = mapBits(bitsPerSample)
        if (srFlag == 0 || bitsFlag == 0) {
            promise.reject("UNSUPPORTED_FORMAT", "No matching codec flag for $sampleRate/$bitsPerSample")
            return
        }

        try {
            val current = (getCodecStatusMethod.invoke(proxy, device) as? BluetoothCodecStatus)?.codecConfig
                ?: return promise.reject("NO_STATUS", "Could not read current codec config")

            // Only proceed if the connected device is actually on LDAC —
            // don't force LDAC onto a device that's on AAC/SBC/aptX.
            if (current.codecType != Codec.TYPE_LDAC) {
                promise.resolve(false) // no-op, not an error
                return
            }

            val newConfig = codecConfigCtor.newInstance(
                current.codecType,
                current.codecPriority,
                srFlag,
                bitsFlag,
                CHANNEL_STEREO,
                current.codecSpecific1,
                current.codecSpecific2,
                current.codecSpecific3,
                current.codecSpecific4
            )
            setCodecConfigPreferenceMethod.invoke(proxy, device, newConfig)
            promise.resolve(true)
        } catch (e: InvocationTargetException) {
            Log.w(TAG, "applyPreferredParams hidden API invocation failed", e.targetException ?: e)
            val root = e.targetException ?: e
            promise.reject("APPLY_UNAVAILABLE", rootCauseMessage(root))
        } catch (t: Throwable) {
            Log.w(TAG, "applyPreferredParams failed", t)
            promise.reject("APPLY_FAILED", rootCauseMessage(t))
        }
    }

    private fun mapSampleRate(hz: Int): Int = when {
        hz >= 176400 -> if (hz == 192000) SampleRate.R192000 else SampleRate.R176400
        hz >= 88200 -> if (hz == 96000) SampleRate.R96000 else SampleRate.R88200
        hz == 48000 -> SampleRate.R48000
        hz == 44100 -> SampleRate.R44100
        else -> 0
    }

    private fun mapBits(bits: Int): Int = when (bits) {
        32 -> Bits.B32
        24 -> Bits.B24
        16 -> Bits.B16
        else -> 0
    }
}
