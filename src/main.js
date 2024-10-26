// src/main.js
import MagicPortal from './libs/MagicPortalES6.js';
import { register, unregister } from './serviceWorkerRegistration';

async function initializeWorker() {
    const userSettingsGitWorker = new Worker("/src/workers/worker.js");
    const portal = new MagicPortal(userSettingsGitWorker);
    const workerThread = await portal.get("workerThread");
    
    window.workerThread = workerThread;
    window.userSettingsGitWorker = userSettingsGitWorker;

    console.log('this.workerThread', workerThread);   
}

async function testFunction(args) {
    await workerThread.setDir('/');
    await workerThread.setDepth(10);
    await workerThread.setAuthParams('ahmadkani', '12345678');
    await workerThread.doCloneAndStuff({
      url: "https://gitea-test-oliwswto5.liara.run/ahmadkani/test"
    });
    await workerThread.setConfigs({username: 'ahmadkani', email: 'asghar'});
    const content = await workerThread.readFile({filePath: '/wc.js'});
    console.log('content', content);

    // Run the content as a web component
    runWebComponent(content);
}

function runWebComponent(content) {
    // Create a script element to define the web component
    const scriptElement = document.createElement('script');
    scriptElement.textContent = content;

    // Append the script to the body to define the web component
    document.body.appendChild(scriptElement);

    // After the script is loaded, create an instance of the web component
    // This could be improved to handle multiple components or parameters
    const webComponentName = getWebComponentName(content);
    if (webComponentName) {
        const webComponentInstance = document.createElement(webComponentName);
        document.body.appendChild(webComponentInstance);
    }
}

// Utility function to extract the web component name from the content
function getWebComponentName(content) {
    const match = content.match(/customElements\.define\('([^']+)'/);
    return match ? match[1] : null;
}

// Call the functions to initialize and test
await register();
await initializeWorker();
await testFunction();
