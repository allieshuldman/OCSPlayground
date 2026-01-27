const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.ocsplayground.app',
    executableName: 'OCS Playground',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ocsplayground',
        setupExe: 'OCS-Playground-Setup.exe',
      },
      platforms: ['win32'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'OCS Playground',
        format: 'ULFO',
      },
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-zip',
      config: {},
      platforms: ['darwin', 'win32'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/electron-main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
