package dev.dablulite.sway

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.content.Intent
import android.os.Bundle
import com.facebook.react.bridge.Promise
import com.zoontek.rnbootsplash.RNBootSplash
import com.reactnative.googlecast.api.RNGCCastContext
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {
    companion object {
        var pendingCdmPromise: Promise? = null
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "SwayMusicMobile"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.AppTheme)
        supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
        RNBootSplash.init(this, R.style.BootTheme)
        super.onCreate(savedInstanceState)

        RNGCCastContext.getSharedInstance(this)
        handleUsbIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleUsbIntent(intent)
    }

    private fun handleUsbIntent(intent: Intent?) {
        if (intent?.action == android.hardware.usb.UsbManager.ACTION_USB_DEVICE_ATTACHED) {
            // Consume the USB attach intent gracefully - AudioManager will enumerate the
            // device via UsbAudioModule's AudioDeviceCallback. Don't re-launch or crash
            // if the UsbDevice parcel is unexpected.
            try {
                android.util.Log.i("MainActivity", "USB device attached intent received")
            } catch (_: Throwable) {
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == CdmModule.REQ_CDM) {
            // Forward to CDM module for cancelled-case cleanup; success is delivered via Callback.onAssociationCreated
            if (resultCode == RESULT_CANCELED) {
                pendingCdmPromise?.let {
                    try {
                        it.reject("CANCELLED", "User cancelled CDM dialog")
                    } catch (_: Throwable) {
                    }
                    pendingCdmPromise = null
                }
            }
        }
    }
}
