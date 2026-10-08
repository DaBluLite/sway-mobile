package dev.dablulite.sway

import android.bluetooth.BluetoothA2dp
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHeadset
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.companion.AssociationRequest
import android.companion.AssociationInfo
import android.companion.BluetoothDeviceFilter
import android.companion.CompanionDeviceManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.IntentSender
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import java.util.concurrent.Executor
import java.util.regex.Pattern

class CdmModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CdmModule"
        const val REQ_CDM = 0x43444d // "CDM"
        private var pendingIntentSender: IntentSender? = null
    }

    override fun getName() = "CdmModule"

    private val mainExecutor: Executor by lazy {
        Executor { cmd -> reactContext.runOnUiQueueThread(cmd) }
    }

    private var autoReceiverRegistered = false
    private val pendingAutoMacs = mutableSetOf<String>()
    private val attemptedAutoMacs = mutableSetOf<String>()

    private fun getCdm(): CompanionDeviceManager? {
        return reactContext.getSystemService(CompanionDeviceManager::class.java)
    }

    private fun hasBluetoothConnect(): Boolean {
        return ContextCompat.checkSelfPermission(
            reactContext, android.Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasAssociationSync(mac: String): Boolean {
        return try {
            val cdm = getCdm() ?: return false
            val upper = mac.uppercase()
            if (Build.VERSION.SDK_INT >= 33) {
                cdm.myAssociations.any { it.deviceMacAddress?.toString()?.uppercase() == upper }
            } else {
                @Suppress("DEPRECATION")
                cdm.associations.any { it.uppercase() == upper }
            }
        } catch (_: Throwable) { false }
    }

    private fun getConnectedAudioMacs(): Set<String> {
        if (!hasBluetoothConnect()) return emptySet()
        val macs = mutableSetOf<String>()
        try {
            val btManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            if (btManager != null) {
                fun addProfile(profile: Int) {
                    try { for (d in btManager.getConnectedDevices(profile)) d.address?.let { macs.add(it) } } catch (_: Throwable) {}
                }
                addProfile(BluetoothProfile.A2DP)
                addProfile(BluetoothProfile.HEADSET)
                addProfile(BluetoothProfile.HEARING_AID)
                if (Build.VERSION.SDK_INT >= 33) {
                    try { addProfile(22 /* BluetoothProfile.LE_AUDIO */) } catch (_: Throwable) {}
                }
            }
            // Fallback: A2DP proxy bonded check if manager returns empty (some OEMs)
            if (macs.isEmpty()) {
                BluetoothAdapter.getDefaultAdapter()?.bondedDevices?.forEach { d ->
                    try {
                        // Only consider devices that look like audio (cheap heuristic)
                        if (d.bluetoothClass?.majorDeviceClass == 1024 /* AUDIO_VIDEO */) {
                            // Can't know if connected; skip unless we have receiver fallback
                        }
                    } catch (_: Throwable) {}
                }
            }
        } catch (t: Throwable) { Log.w(TAG, "getConnectedAudioMacs failed", t) }
        return macs
    }

    private fun triggerAutoAssociate(mac: String, displayName: String? = null) {
        val upper = mac.uppercase()
        Log.d(TAG, "triggerAutoAssociate: $mac name=$displayName hasBT=${hasBluetoothConnect()} alreadyAssoc=${hasAssociationSync(mac)} attempted=${upper in attemptedAutoMacs} pending=${MainActivity.pendingCdmPromise != null} activity=${reactContext.currentActivity}")
        if (MainActivity.pendingCdmPromise != null) { Log.d(TAG, "skip $mac - dialog already pending"); return }
        if (upper in attemptedAutoMacs) { Log.d(TAG, "skip $mac - already attempted"); return }
        if (hasAssociationSync(mac)) { Log.i(TAG, "skip $mac - already associated"); return }
        val activity = reactContext.currentActivity
        if (activity == null) {
            Log.i(TAG, "No activity for $mac, queueing")
            pendingAutoMacs.add(mac)
            return
        }
        if (!hasBluetoothConnect()) { Log.w(TAG, "Missing BLUETOOTH_CONNECT for $mac"); return }
        attemptedAutoMacs.add(upper)
        Log.i(TAG, "Auto-associating $mac via CDM")
        val cdm = getCdm() ?: run { Log.w(TAG, "No CDM"); attemptedAutoMacs.remove(upper); return }
        fun doAssociate(useSelfManaged: Boolean) {
            try {
                val filterBuilder = BluetoothDeviceFilter.Builder()
                if (Build.VERSION.SDK_INT >= 33) filterBuilder.setAddress(mac)
                else filterBuilder.setNamePattern(Pattern.compile(Pattern.quote(mac)))
                val reqBuilder = AssociationRequest.Builder().addDeviceFilter(filterBuilder.build()).setSingleDevice(true)
                if (Build.VERSION.SDK_INT >= 33 && useSelfManaged) {
                    reqBuilder.setSelfManaged(true)
                    val name = displayName?.takeIf { it.isNotBlank() } ?: mac
                    reqBuilder.setDisplayName(name)
                }
                val req = reqBuilder.build()
                Log.d(TAG, "Built request selfManaged=$useSelfManaged for $mac")
                if (Build.VERSION.SDK_INT >= 33) {
                    cdm.associate(req, mainExecutor, object : CompanionDeviceManager.Callback() {
                        override fun onAssociationPending(s: IntentSender) {
                            Log.i(TAG, "onAssociationPending for $mac, launching dialog")
                            try { activity.startIntentSenderForResult(s, REQ_CDM, null, 0, 0, 0) } catch (e: Throwable) { Log.w(TAG, "auto startIntentSender failed", e); attemptedAutoMacs.remove(upper) }
                        }
                        override fun onAssociationCreated(info: AssociationInfo) { Log.i(TAG, "Auto CDM association created for $mac: $info") }
                        override fun onFailure(err: CharSequence?) { Log.w(TAG, "Auto CDM failed for $mac: $err"); attemptedAutoMacs.remove(upper) }
                    })
                } else {
                    @Suppress("DEPRECATION")
                    cdm.associate(req, object : CompanionDeviceManager.Callback() {
                        override fun onDeviceFound(s: IntentSender) {
                            Log.i(TAG, "onDeviceFound for $mac")
                            try { activity.startIntentSenderForResult(s, REQ_CDM, null, 0, 0, 0) } catch (e: Throwable) { Log.w(TAG, "auto startIntentSender failed", e); attemptedAutoMacs.remove(upper) }
                        }
                        override fun onFailure(err: CharSequence?) { Log.w(TAG, "Auto CDM failed for $mac: $err"); attemptedAutoMacs.remove(upper) }
                    }, null)
                }
            } catch (t: Throwable) {
                Log.w(TAG, "triggerAutoAssociate throw (selfManaged=$useSelfManaged)", t)
                // Fallback: if self-managed failed due to missing SELF_MANAGED perm, retry without it (shows device chooser instead of direct dialog)
                // Keep attempted flag so we don't retrigger from the next BT broadcast (ACL/A2DP/HEADSET fire 3x).
                if (useSelfManaged && Build.VERSION.SDK_INT >= 33) {
                    Log.i(TAG, "Retrying without selfManaged for $mac")
                    try { doAssociate(false) } catch (_: Throwable) { attemptedAutoMacs.remove(upper) }
                } else {
                    attemptedAutoMacs.remove(upper)
                }
            }
        }
        // For third-party apps SELF_MANAGED is signature -> always throws SecurityException (seen in log).
        // Use non-selfManaged directly to show single-device chooser without exception spam.
        doAssociate(false)
    }

    private val btReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            try {
                if (intent == null) return
                val action = intent.action
                // Only CONNECTED audio profiles — not ACL_CONNECTED (nearby)
                if (action != BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED &&
                    action != BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED &&
                    action != "android.bluetooth.action.LE_AUDIO_CONNECTION_STATE_CHANGED") return
                Log.d(TAG, "btReceiver: $action")
                val device: BluetoothDevice? = if (Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                } else {
                    @Suppress("DEPRECATION") intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                }
                val addr = device?.address ?: run { Log.d(TAG, "btReceiver no device for $action"); return }
                val state = intent.getIntExtra(BluetoothProfile.EXTRA_STATE, -1)
                Log.d(TAG, "btReceiver device=$addr name=${device.name} alias=${try{device.alias}catch(_:Throwable){null}} state=$state action=$action class=${try{device.bluetoothClass?.majorDeviceClass}catch(_:Throwable){"?"}}")
                if (state != BluetoothProfile.STATE_CONNECTED) return
                val isAudio = try {
                    val major = device.bluetoothClass?.majorDeviceClass
                    major == 1024 || major == 0 || major == 1028
                } catch (_: Throwable) { true }
                if (!isAudio) { Log.d(TAG, "skip non-audio $addr"); return }
                val displayName = try { device.alias ?: device.name } catch (_: Throwable) { device.name } ?: addr
                // Offload hasAssociation disk IPC off receiver main thread
                mainExecutor.execute { triggerAutoAssociate(addr, displayName) }
            } catch (t: Throwable) {
                Log.w(TAG, "btReceiver crash guarded", t)
            }
        }
    }

    private fun registerAutoAssociate() {
        if (autoReceiverRegistered) return
        autoReceiverRegistered = true
        // Only CONNECTED audio profiles — ACL_CONNECTED fires for any nearby device
        val filter = IntentFilter().apply {
            addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
            addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED)
            if (Build.VERSION.SDK_INT >= 33) addAction("android.bluetooth.action.LE_AUDIO_CONNECTION_STATE_CHANGED")
        }
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                reactContext.registerReceiver(btReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                reactContext.registerReceiver(btReceiver, filter)
            }
            Log.i(TAG, "auto CDM receiver registered (CONNECTED audio only)")
        } catch (t: Throwable) { Log.w(TAG, "registerReceiver failed", t) }

        // Once on startup: check already-CONNECTED headphones; event listener handles new connects
        reactContext.runOnUiQueueThread {
            // Defer one frame so BLUETOOTH_CONNECT grant + CDM service ready
            try {
                for (mac in getConnectedAudioMacs()) triggerAutoAssociate(mac)
            } catch (t: Throwable) { Log.w(TAG, "startup scan failed", t) }
        }

        // Retry pending (activity was null) + one lightweight rescan for headphones already CONNECTED
        // (covers cold-start where BLUETOOTH_CONNECT was granted after registerAutoAssociate).
        // Debounced via attemptedAutoMacs/hasAssociationSync so no duplicate dialog/lag.
        reactContext.addLifecycleEventListener(object : LifecycleEventListener {
            override fun onHostResume() {
                if (pendingAutoMacs.isNotEmpty()) {
                    val pending = pendingAutoMacs.toList().also { pendingAutoMacs.clear() }
                    pending.forEach { triggerAutoAssociate(it) }
                }
                // Light rescan: only if no pending dialog and not already debounced
                if (MainActivity.pendingCdmPromise == null) {
                    try {
                        val macs = getConnectedAudioMacs()
                        if (macs.isNotEmpty()) Log.d(TAG, "onHostResume rescan: $macs")
                        for (m in macs) triggerAutoAssociate(m)
                    } catch (_: Throwable) {}
                }
            }
            override fun onHostPause() {}
            override fun onHostDestroy() {}
        })
    }

    @ReactMethod
    fun associateConnected(promise: Promise) {
        try {
            if (!hasBluetoothConnect()) { promise.reject("NO_PERM", "BLUETOOTH_CONNECT not granted"); return }
            val macs = getConnectedAudioMacs()
            Log.i(TAG, "associateConnected: $macs")
            if (macs.isEmpty()) { promise.reject("NO_DEVICE", "No connected A2DP/HEADSET device found. Ensure headphones are connected and BLUETOOTH_CONNECT granted."); return }
            for (m in macs) triggerAutoAssociate(m)
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("FAIL", t.message, t) }
    }

    @ReactMethod
    fun debugState(promise: Promise) {
        val map = Arguments.createMap()
        map.putBoolean("hasBluetoothConnect", hasBluetoothConnect())
        map.putString("currentActivity", reactContext.currentActivity?.javaClass?.name ?: "null")
        val macs = Arguments.createArray()
        for (m in getConnectedAudioMacs()) macs.pushString(m)
        map.putArray("connectedMacs", macs)
        val assoc = Arguments.createArray()
        try {
            val cdm = getCdm()
            if (cdm != null) {
                if (Build.VERSION.SDK_INT >= 33) for (a in cdm.myAssociations) assoc.pushString("${a.deviceMacAddress} id=${a.id}")
                else @Suppress("DEPRECATION") for (s in cdm.associations) assoc.pushString(s)
            }
        } catch (_: Throwable) {}
        map.putArray("associations", assoc)
        map.putBoolean("receiverRegistered", autoReceiverRegistered)
        promise.resolve(map)
    }

    override fun initialize() {
        super.initialize()
        // Defer until context has activity; also triggered via lifecycle
        reactContext.runOnUiQueueThread { registerAutoAssociate() }
    }

    @ReactMethod
    fun hasAssociation(macAddress: String?, promise: Promise) {
        try {
            val cdm = getCdm() ?: run { promise.resolve(false); return }
            val mac = macAddress?.uppercase() ?: run { promise.resolve(false); return }
            // API 33+ has getMyAssociations()
            if (Build.VERSION.SDK_INT >= 33) {
                val list: List<AssociationInfo> = cdm.myAssociations
                val has = list.any { it.deviceMacAddress?.toString()?.uppercase() == mac }
                promise.resolve(has)
            } else {
                @Suppress("DEPRECATION")
                val list = cdm.associations // List<String> of MACs pre-33
                val has = list.any { it.uppercase() == mac }
                promise.resolve(has)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "hasAssociation failed", t)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getAssociations(promise: Promise) {
        try {
            val cdm = getCdm() ?: run { promise.resolve(Arguments.createArray()); return }
            val out = Arguments.createArray()
            if (Build.VERSION.SDK_INT >= 33) {
                for (a in cdm.myAssociations) {
                    out.pushString(a.deviceMacAddress?.toString())
                }
            } else {
                @Suppress("DEPRECATION")
                for (m in cdm.associations) out.pushString(m)
            }
            promise.resolve(out)
        } catch (t: Throwable) {
            promise.reject("CDM_FAIL", t.message, t)
        }
    }

    @ReactMethod
    fun disassociate(macAddress: String, promise: Promise) {
        try {
            val cdm = getCdm() ?: run { promise.reject("NO_CDM","No CDM"); return }
            if (Build.VERSION.SDK_INT >= 33) {
                val id = cdm.myAssociations.firstOrNull {
                    it.deviceMacAddress?.toString()?.equals(macAddress, ignoreCase = true) == true
                }?.id
                if (id == null) { promise.resolve(false); return }
                cdm.disassociate(id)
                promise.resolve(true)
            } else {
                @Suppress("DEPRECATION")
                cdm.disassociate(macAddress)
                promise.resolve(true)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "disassociate failed", t)
            promise.reject("DISASSOC_FAIL", t.message, t)
        }
    }

    /**
     * Triggers the system CDM dialog for the currently connected A2DP device
     * (or explicit macAddress). Resolves true when association created,
     * false if user cancelled / already associated.
     * Unrooted, Play-compliant: uses public CompanionDeviceManager.associate().
     */
    @ReactMethod
    fun associate(macAddress: String?, promise: Promise) {
        val cdm = getCdm() ?: run { promise.reject("NO_CDM","CompanionDeviceManager unavailable"); return }
        val activity = reactContext.currentActivity

        // Resolve target MAC: explicit param wins, else first connected A2DP device
        val targetMac: String? = macAddress?.takeIf { it.isNotBlank() } ?: run {
            try {
                val adapter = BluetoothAdapter.getDefaultAdapter() ?: return@run null
                // Use A2DP profile proxy synchronously via connectedDevices if already bound?
                // Fallback: bonded devices not reliable, so let caller pass macAddress.
                null
            } catch (_: Throwable) { null }
        }

        // CompanionDeviceManager requires Activity context for the IntentSender dialog
        try {
            val filterBuilder = BluetoothDeviceFilter.Builder()
            if (targetMac != null && Build.VERSION.SDK_INT >= 33) {
                filterBuilder.setAddress(targetMac)
            } else if (targetMac != null) {
                filterBuilder.setNamePattern(Pattern.compile(Pattern.quote(targetMac)))
            } else {
                // No MAC supplied: show nearby BT chooser (user picks device) — still creates CDM assoc
            }
            val requestBuilder = AssociationRequest.Builder()
                .addDeviceFilter(filterBuilder.build())
                .setSingleDevice(true)
            if (Build.VERSION.SDK_INT >= 33) {
                requestBuilder.setSelfManaged(true)
                val name = try {
                    BluetoothAdapter.getDefaultAdapter()?.getRemoteDevice(targetMac ?: "")?.let {
                        try { it.alias ?: it.name } catch (_: Throwable) { it.name }
                    }
                } catch (_: Throwable) { null } ?: targetMac ?: "Bluetooth device"
                requestBuilder.setDisplayName(name)
            }
            val request = requestBuilder.build()
            if (Build.VERSION.SDK_INT >= 33) {
                cdm.associate(request, mainExecutor, object : CompanionDeviceManager.Callback() {
                    override fun onAssociationPending(sender: IntentSender) {
                        pendingIntentSender = sender
                        try {
                            activity?.startIntentSenderForResult(sender, REQ_CDM, null, 0, 0, 0)
                            // Promise stays pending; result delivered via onAssociationCreated/Failed
                            // Store promise for later resolution via static holder in MainActivity
                            MainActivity.pendingCdmPromise = promise
                        } catch (e: Throwable) {
                            Log.w(TAG, "startIntentSender failed", e)
                            promise.reject("INTENT_FAILED", e.message, e)
                        }
                    }
                    override fun onAssociationCreated(info: AssociationInfo) {
                        // Self-managed path may call this directly without pending sender
                        promise.resolve(true)
                        MainActivity.pendingCdmPromise = null
                    }
                    override fun onFailure(err: CharSequence?) {
                        promise.reject("ASSOC_FAILED", err?.toString() ?: "Association failed")
                        MainActivity.pendingCdmPromise = null
                    }
                })
            } else {
                @Suppress("DEPRECATION")
                cdm.associate(request, object : CompanionDeviceManager.Callback() {
                    override fun onDeviceFound(sender: IntentSender) {
                        pendingIntentSender = sender
                        try {
                            activity?.startIntentSenderForResult(sender, REQ_CDM, null, 0, 0, 0)
                            MainActivity.pendingCdmPromise = promise
                        } catch (e: Throwable) {
                            promise.reject("INTENT_FAILED", e.message, e)
                        }
                    }
                    override fun onFailure(err: CharSequence?) {
                        promise.reject("ASSOC_FAILED", err?.toString() ?: "Association failed")
                        MainActivity.pendingCdmPromise = null
                    }
                }, null)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "associate() failed", t)
            promise.reject("ASSOC_THROW", t.message, t)
        }
    }

    // Called from MainActivity.onActivityResult to forward result if needed
    fun onCdmActivityResult(requestCode: Int, resultCode: Int) {
        // CDM handles association via Callback, but we clear pending if cancelled
        if (requestCode == REQ_CDM && resultCode == 0) {
            // RESULT_CANCELED == 0 — user dismissed
            MainActivity.pendingCdmPromise?.let {
                try { it.reject("CANCELLED", "User cancelled CDM dialog") } catch (_: Throwable) {}
                MainActivity.pendingCdmPromise = null
            }
        }
    }
}
