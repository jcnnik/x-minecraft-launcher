import { LauncherApp, LauncherAppPlugin } from '@xmcl/runtime/app'
import { LaunchService } from '@xmcl/runtime/launch'

/**
 * Plugin to add AMD GPU workaround for rendering issues on Windows
 * 
 * This addresses the issue where AMD driver version 25.10.2 and higher
 * causes invisible blocks when using Sodium mod in Minecraft.
 * 
 * The problem occurs because certain JVM arguments cause LWJGL/JNA/Netty to extract
 * natives at runtime, which triggers a bug in AMD's OpenGL driver. The fix is to
 * remove these properties and rely only on pre-extracted natives via -Djava.library.path.
 * 
 * Reference: https://github.com/CaffeineMC/sodium/issues/3318
 */
export const pluginAMDGPUWorkaround: LauncherAppPlugin = async (app) => {
  // Only apply on Windows
  if (app.platform.os !== 'windows') return

  const info = await app.host.getGPUInfo('basic') as any
  const gpus = info?.gpuDevice || []

  // Check if AMD GPU is present (vendor ID 4098 = 0x1002)
  const hasAMD = gpus.some((gpu: any) => gpu?.vendorId === 4098)

  if (!hasAMD) return

  const { log } = app.getLogger('AMDGPUWorkaround')
  log('Detected AMD GPU on Windows. Applying workaround for driver version 25.10.2+ Sodium compatibility.')

  app.registry.get(LaunchService).then((service) => {
    service.registerMiddleware({
      name: 'amd-gpu-workaround',
      async onBeforeLaunch(input, payload) {
        // Only apply to client-side launches
        if (payload.side === 'server') return

        // Remove problematic system properties that cause runtime native extraction
        // These properties trigger the AMD driver bug with Sodium
        const problematicProperties = [
          '-Djna.tmpdir=',
          '-Dorg.lwjgl.system.SharedLibraryExtractPath=',
          '-Dio.netty.native.workdir=',
        ]

        if (!payload.options.extraJVMArgs) {
          payload.options.extraJVMArgs = []
        }

        // Filter out problematic arguments
        const originalCount = payload.options.extraJVMArgs.length
        payload.options.extraJVMArgs = payload.options.extraJVMArgs.filter((arg) => {
          return !problematicProperties.some(prop => arg.startsWith(prop))
        })

        const removed = originalCount - payload.options.extraJVMArgs.length
        if (removed > 0) {
          log(`Removed ${removed} runtime native extraction properties for AMD GPU compatibility`)
        }
      },
    })
  })
}
