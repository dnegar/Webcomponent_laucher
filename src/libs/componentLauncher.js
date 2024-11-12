// src/componentLauncher.js
import MagicPortal from './MagicPortalES6.js';
import {register} from "./serviceWorkerRegistration.js";

class componentLauncher extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.workerThread;
        this.lastLocalCommit;
    }

    async connectedCallback() {
        // Get attributes passed to the component
        const repoUrl = this.getAttribute('repoUrl');
        const username = this.getAttribute('username');
        const password = this.getAttribute('password');
        const attributes = JSON.parse(this.getAttribute('attributes') || '{}');
        const fileName = this.getAttribute('fileName');
        const interval = this.getAttribute('updateInterval');

        // Initialize worker and run the component
        await register();
        await this.initializeWorker(repoUrl, username, password, attributes, fileName);
        this.checkForUpdates(interval ,repoUrl, username, password, attributes, fileName)
    }

    disconnectedCallback() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    async initializeWorker(repoUrl, username, password, attributes, fileName) {
        const gitWorker = new Worker("/src/libs/gitWorker.js");
        const portal = new MagicPortal(gitWorker);
        this.workerThread = await portal.get("workerThread");

        const content = await this.getWebComponentFromRepo(repoUrl, username, password, fileName);
        this.runWebComponent(content, attributes);
    }

    async getWebComponentFromRepo(repoUrl, username, password, fileName) {
        const workerThread = this.workerThread;
        await workerThread.setRef('main');
        await workerThread.setDepth(10);
        await workerThread.setAuthParams(username, password);
        const d = await workerThread.getFileStoresFromDatabases();
        console.log('asdfasdf', d)
        await workerThread.doCloneAndStuff({ url: repoUrl});
        let content = await workerThread.readFile({ filePath: `/${fileName}` });
        this.lastLocalCommit = await workerThread.getLastLocalCommit();
        const lastRemoteCommit = await workerThread.getLastRemoteCommit();
        console.log('lastRemoteCommit getweb', lastRemoteCommit)
        return content;
    }

    async checkForUpdatesLogic(repoUrl, username, password, fileName) {
        const workerThread = this.workerThread;
        await workerThread.setRef('main');
        await workerThread.setDepth(10);
        await workerThread.setAuthParams(username, password);
        const tempCloneResult = await workerThread.doCloneAndStuff({ url: repoUrl, databaseName: 'tempDB'});
        const lastRemoteCommit = await workerThread.getLastRemoteCommit();
        console.log('lastRemoteCommit getweb', lastRemoteCommit)
        await workerThread.doFetch({url: repoUrl, databaseName: 'tempDB'});
        if (tempCloneResult.message === 'exists'){
            console.log(1)
            console.log(this.lastLocalCommit, lastRemoteCommit)

            if (this.lastLocalCommit != lastRemoteCommit) {
                console.log(2)

                    await workerThread.fastForward({
                    url: repoUrl,
                    databaseName: 'tempDB',
                });
                const content = await workerThread.readFile({ filePath: `/${fileName}` });
                return {content, lastRemoteCommit};
            }
        };
        return null;
    }

    async checkForUpdates(interval, repoUrl, username, password, attributes, fileName) {
        this.updateInterval = setInterval(async () => {
          const updateData = await this.checkForUpdatesLogic(repoUrl, username, password, fileName);
          if (updateData) {
            const userResponse = window.confirm("A new update is ready, do you want to update now?");
            console.log('updateData', updateData)
            userResponse && (this.runWebComponent(updateData.content, attributes));
            this.lastLocalCommit = updateData.lastRemoteCommit;
          }
        }, interval);
    }

    runWebComponent(content, attributes) {
        console.log(content, attributes);
    
        this.clearShadowDOM();
        const scriptElement = document.createElement('script');
        scriptElement.textContent = content;
        this.shadowRoot.appendChild(scriptElement);
    
        const componentName = this.extractComponentName(content);
        if (componentName) {
            const componentInstance = document.createElement(componentName);
    
            Object.entries(attributes).forEach(([key, value]) => {
                const attributeValue = (typeof value === 'object')
                    ? JSON.stringify(value)
                    : value;
                componentInstance.setAttribute(key, attributeValue);
            });
    
            this.shadowRoot.appendChild(componentInstance);
        }
    }    

    extractComponentName(content) {
        const match = content.match(/customElements\.define\('([^']+)'/);
        console.log('match', match[1])

        return match ? match[1] : null;
    }

    clearShadowDOM() {
        console.log('first elem 1', this.shadowRoot)

        while (this.shadowRoot.firstChild) {
            console.log('first elem 2', this.shadowRoot.firstChild)
          this.shadowRoot.removeChild(this.shadowRoot.firstChild);
        }
        console.log('first elem 3', this.shadowRoot)

    }
}

customElements.define('component-launcher', componentLauncher);
