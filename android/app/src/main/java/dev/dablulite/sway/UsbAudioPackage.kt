package dev.dablulite.sway
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
class UsbAudioPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(UsbAudioModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext) = emptyList<ViewManager<*,*>>()
}
