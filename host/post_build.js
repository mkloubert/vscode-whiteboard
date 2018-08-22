const fs = require('fs-extra');
const path = require('path');

(async () => {
    const WEB_APP_DEST_DIR = path.join(__dirname, 'dist/webapp');

    console.log('Copying web app ...');

    await fs.mkdirs(WEB_APP_DEST_DIR);

    await fs.copy(path.join(__dirname, 'src/webapp'), WEB_APP_DEST_DIR, {
        preserveTimestamps: true,
        recursive: true,
    });
})();