import { LauncherApp, LauncherAppPlugin } from '@xmcl/runtime/app'
import { LaunchService } from '@xmcl/runtime/launch'

/**
 * Plugin to add RivaTuner Statistics Server (RTSS) compatibility workaround
 * 
 * This addresses the issue where Minecraft won't launch when RivaTuner Statistics Server
 * (commonly used with MSI Afterburner) is running in the background.
 * 
 * The problem occurs because RTSS injects hooks into processes, which can interfere
 * with Java/LWJGL initialization, causing the game to freeze after loading LWJGL.
 * 
 * The fix adds multiple environment variables that tell RTSS and similar overlay software
 * to exclude the launched Minecraft process from hooking:
 * - RTSS_EXCLUDE: Tells RTSS to skip injection
 * - NoHook: Generic flag that some overlay software respects
 * - NOHOOKEX: Alternative flag for overlay exclusion
 * - DISABLE_RTSS_LAYER: Disables RTSS Vulkan layer
 */
export const pluginRTSSWorkaround: LauncherAppPlugin = async (app) => {
  // Only apply on Windows where RTSS is commonly used
  if (app.platform.os !== 'windows') return

  const { log } = app.getLogger('RTSSWorkaround')
  log('Applying RivaTuner Statistics Server (RTSS) compatibility workaround')

  app.registry.get(LaunchService).then((service) => {
    service.registerMiddleware({
      name: 'rtss-workaround',
      async onBeforeLaunch(input, payload) {
        // Only apply to client-side launches
        if (payload.side === 'server') return

        // Ensure extraExecOption.env exists
        if (!payload.options.extraExecOption) {
          payload.options.extraExecOption = {
            shell: false,
            detached: true,
            cwd: input.gameDirectory,
            env: { ...process.env },
          }
        }

        if (!payload.options.extraExecOption.env) {
          payload.options.extraExecOption.env = { ...process.env }
        }

        // Add multiple environment variables to exclude from RTSS and overlay software
        // These tell RTSS and similar tools to skip DLL injection
        payload.options.extraExecOption.env.RTSS_EXCLUDE = '1'
        payload.options.extraExecOption.env.NoHook = '1'
        payload.options.extraExecOption.env.NOHOOKEX = '1'
        payload.options.extraExecOption.env.DISABLE_RTSS_LAYER = '1'

        log('Added RTSS/overlay exclusion environment variables for compatibility')
      },
    })
  })
}
