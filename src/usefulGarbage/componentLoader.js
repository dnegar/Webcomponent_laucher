// src/utils/componentLoader.js
import MagicPortal from '../libs/MagicPortalES6.js';

let workerThread;

async function initializeWorker() {
    const gitWorker = new Worker("/src/workers/gitWorker.js");
    const portal = new MagicPortal(gitWorker);
    workerThread = await portal.get("workerThread");
    
    console.log('Worker initialized:', workerThread);
}

export async function loadComponentFromRepo({ fileName, attributes }) {
    if (!workerThread) {
        await initializeWorker();
    }

    await workerThread.setDir('/');
    await workerThread.setDepth(10);
    await workerThread.setAuthParams('ahmadkani', '12345678');
    await workerThread.doCloneAndStuff({
        url: "https://gitea-test-oliwswto5.liara.run/ahmadkani/test"
    });
    await workerThread.setConfigs({ username: 'ahmadkani', email: 'asghar' });
    
    const webComponentContent = await workerThread.readFile({ filePath: `/${fileName}` });
    console.log('Fetched content:', webComponentContent);

    runWebComponent(webComponentContent, attributes);
}

function runWebComponent(content, attributes = {}) {
    const scriptElement = document.createElement('script');
    scriptElement.textContent = content;
    document.body.appendChild(scriptElement);

    const webComponentName = getWebComponentName(content);
    if (webComponentName) {
        const webComponentInstance = document.createElement(webComponentName);

        Object.keys(attributes).forEach(attr => {
            webComponentInstance.setAttribute(attr, attributes[attr]);
        });

        document.body.appendChild(webComponentInstance);
    }
}

function getWebComponentName(content) {
    const match = content.match(/customElements\.define\('([^']+)'/);
    return match ? match[1] : null;
}