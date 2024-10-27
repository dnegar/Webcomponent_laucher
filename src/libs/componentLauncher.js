// src/componentLauncher.js
import MagicPortal from './MagicPortalES6.js';
import {register} from "./serviceWorkerRegistration.js";

class componentLauncher extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.workerThread;
    }

    async connectedCallback() {
        // Get attributes passed to the component
        const repoUrl = this.getAttribute('repoUrl');
        const username = this.getAttribute('username');
        const password = this.getAttribute('password');
        const attributes = JSON.parse(this.getAttribute('attributes') || '{}');
        const fileName = this.getAttribute('fileName');

        // Initialize worker and run the component
        await register();
        await this.initializeWorker(repoUrl, username, password, attributes, fileName);
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
        const cloneResult = await workerThread.doCloneAndStuff({ url: repoUrl });
        await workerThread.doFetch({url: repoUrl});
        if (cloneResult.message === 'exists'){
            await workerThread.pull({
                url: repoUrl,
                username: username,
                email: 'wc@example.com',
            });
        }        
        const content = await workerThread.readFile({ filePath: `/${fileName}` });
        return content;
    }

    runWebComponent(content, attributes) {
        console.log(content, attributes);
    
        // Add the component script to the shadow DOM
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
        return match ? match[1] : null;
    }
}

customElements.define('component-launcher', componentLauncher);
