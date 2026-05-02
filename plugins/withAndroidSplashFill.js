const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Changes the Android splash screen bitmap gravity from "center" to "fill"
 * so the splash image stretches to cover the full screen (including edge-to-edge areas).
 * Must run after expo-splash-screen in the plugins array.
 */
const withAndroidSplashFill = (config) => {
  return withDangerousMod(config, ['android', async (config) => {
    const drawablePath = path.join(
      config.modRequest.projectRoot,
      'android/app/src/main/res/drawable/ic_launcher_background.xml'
    );
    if (fs.existsSync(drawablePath)) {
      let xml = fs.readFileSync(drawablePath, 'utf8');
      xml = xml.replace(/android:gravity="center"/g, 'android:gravity="fill"');
      fs.writeFileSync(drawablePath, xml);
    }
    return config;
  }]);
};

module.exports = withAndroidSplashFill;
