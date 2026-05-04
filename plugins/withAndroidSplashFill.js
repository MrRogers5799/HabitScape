const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches every ic_launcher_background.xml variant written by expo-splash-screen
 * so the bitmap gravity is "fill" instead of "center".
 *
 * Why this is needed:
 *   expo-splash-screen hardcodes android:gravity="center" in its generated
 *   layer-list drawable. That centers the splash image at its native size,
 *   leaving bars on devices whose screen differs from the image dimensions.
 *   Changing gravity to "fill" stretches the bitmap to cover the full screen.
 *
 * Why the previous version silently failed:
 *   It hardcoded the path to "drawable/ic_launcher_background.xml".
 *   expo-splash-screen resolves the path via getResourceXMLPathAsync which
 *   can return "drawable-v24/" or other qualified folders. The existsSync
 *   check returned false and nothing was patched.
 *
 * This version scans all drawable/* folders so it always finds the file
 * regardless of which qualifier expo-splash-screen chose.
 */
const withAndroidSplashFill = (config) => {
  return withDangerousMod(config, ['android', async (config) => {
    const resDir = path.join(
      config.modRequest.projectRoot,
      'android', 'app', 'src', 'main', 'res'
    );

    if (!fs.existsSync(resDir)) {
      console.warn('[withAndroidSplashFill] res/ directory not found — skipping');
      return config;
    }

    // Patch every drawable variant that contains ic_launcher_background.xml
    const folders = fs.readdirSync(resDir).filter(f => f.startsWith('drawable'));
    let patched = 0;

    for (const folder of folders) {
      const filePath = path.join(resDir, folder, 'ic_launcher_background.xml');
      if (!fs.existsSync(filePath)) continue;

      const original = fs.readFileSync(filePath, 'utf8');
      const updated = original.replace(/android:gravity="center"/g, 'android:gravity="fill"');

      if (updated !== original) {
        fs.writeFileSync(filePath, updated);
        console.log(`[withAndroidSplashFill] Patched gravity → fill in ${folder}/ic_launcher_background.xml`);
        patched++;
      } else {
        console.log(`[withAndroidSplashFill] No center gravity found in ${folder}/ic_launcher_background.xml`);
      }
    }

    if (patched === 0 && folders.length > 0) {
      console.warn('[withAndroidSplashFill] Found drawable folders but nothing was patched — expo-splash-screen may have already set fill, or uses a different file.');
    }

    return config;
  }]);
};

module.exports = withAndroidSplashFill;
