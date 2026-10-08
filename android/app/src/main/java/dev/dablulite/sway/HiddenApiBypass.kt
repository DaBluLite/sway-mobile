package dev.dablulite.sway

import android.util.Log

object HiddenApiBypass {
    fun exempt() {
        try {
            val vmRuntimeClass = Class.forName("dalvik.system.VMRuntime")
            val getRuntime = vmRuntimeClass.getDeclaredMethod("getRuntime")
            val vmRuntime = getRuntime.invoke(null)
            val setExemptions = vmRuntimeClass.getDeclaredMethod(
                "setHiddenApiExemptions", Array<String>::class.java
            )
            setExemptions.invoke(vmRuntime, arrayOf("L"))  // "L" prefix exempts everything
        } catch (t: Throwable) {
            // Some OEM builds patch this away entirely — treat as "bit-perfect codec control unavailable"
            Log.w("HiddenApiBypass", "Could not exempt hidden APIs", t)
        }
    }
}
