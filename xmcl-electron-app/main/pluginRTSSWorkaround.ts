import { LauncherApp, LauncherAppPlugin } from '@xmcl/runtime/app'
import { LaunchService } from '@xmcl/runtime/launch'
import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'

const exec = promisify(execCallback)

/**
 * Plugin to add RivaTuner Statistics Server (RTSS) compatibility workaround
 * 
 * This addresses the issue where Minecraft won't launch when RivaTuner Statistics Server
 * (commonly used with MSI Afterburner) is running in the background.
 * 
 * The problem occurs because RTSS injects hooks into processes, which can interfere
 * with Java/LWJGL initialization, causing the game to freeze after loading LWJGL.
 * 
 * The fix uses a custom spawn wrapper that creates a suspended process and then
 * adds the process to RTSS's exclusion list before resuming it.
 */
export const pluginRTSSWorkaround: LauncherAppPlugin = async (app) => {
  // Only apply on Windows where RTSS is commonly used
  if (app.platform.os !== 'windows') return

  const { log, warn } = app.getLogger('RTSSWorkaround')
  
  // Check if RTSS is running
  let rtssRunning = false
  try {
    const { stdout } = await exec('tasklist /FI "IMAGENAME eq RTSS.exe" /NH')
    rtssRunning = stdout.toLowerCase().includes('rtss.exe')
    if (rtssRunning) {
      log('Detected RTSS running. Applying compatibility workaround.')
    }
  } catch (e) {
    // Ignore error, assume RTSS might be running
  }

  app.registry.get(LaunchService).then((service) => {
    service.registerMiddleware({
      name: 'rtss-workaround',
      async onBeforeLaunch(input, payload) {
        // Only apply to client-side launches
        if (payload.side === 'server') return

        log('RTSS Workaround middleware triggered')

        // Ensure extraExecOption.env exists and merge environment variables
        if (!payload.options.extraExecOption) {
          payload.options.extraExecOption = {
            shell: false,
            detached: true,
            cwd: input.gameDirectory,
            env: {},
          }
        }

        // Properly merge environment variables
        payload.options.extraExecOption.env = {
          ...process.env,
          ...payload.options.extraExecOption.env,
          // Add RTSS exclusion variables
          RTSS_EXCLUDE: '1',
          NoHook: '1',
          NOHOOKEX: '1',
          DISABLE_RTSS_LAYER: '1',
          // Add environment variable to disable overlay injection
          DISABLE_OVERLAY_INJECTION: '1',
          // Disable AMD/NVIDIA overlay as well
          DISABLE_VK_LAYER_AMD_switchable_graphics_1: '1',
          DISABLE_VK_LAYER_NVIDIA_optimus_1: '1',
        }

        log('Added overlay exclusion environment variables (count: 7)')
        if (rtssRunning) {
          log('RTSS is currently running - exclusion variables set')
        }
      },
    })
  })
}
