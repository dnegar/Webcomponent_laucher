// src/componentLauncher.js
import MagicPortal from './MagicPortalES6.js';
import {register} from "./serviceWorkerRegistration.js";
import './alert-component.js';

class componentLauncher extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.workerThread;
        this.lastLocalCommit;
        this.updatedAttributes;
        this.alertComponent = document.createElement('custom-alert');
    }

    async connectedCallback() {
        const repoUrl = this.getAttribute('repoUrl');
        const username = this.getAttribute('username');
        const password = this.getAttribute('password');
        const attributes = JSON.parse(this.getAttribute('attributes') || '{}');
        const fileName = this.getAttribute('fileName');
        const interval = this.getAttribute('updateInterval');

        const style = document.createElement('style');
        style.textContent = `
            .body {
                font-size: 14px;
                font-weight: 400;
            }
        `;
        
        this.shadowRoot.appendChild(style);

        await register();
        await this.initializeWorker(repoUrl, username, password, attributes, fileName);
        this.checkForUpdates(interval, repoUrl, username, password, this.updatedAttributes, fileName);
    }

    disconnectedCallback() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    async applySettings(attributes) {
        const settings = await this.workerThread.readSettingsFile('attributes'); // Read all settings for the type
        
        const updatedAttributes = { ...attributes, ...settings };    
        for (const [key, value] of Object.entries(updatedAttributes)) {
            if (typeof value === 'string' && value.startsWith('path:')) {
                const filePath = value.slice(5).trim(); // Remove the 'path:' prefix
                try {
                    const fileContent = await this.workerThread.readFile({ filePath: filePath });
                    updatedAttributes[key] = fileContent; // Replace value with the file content
                } catch (error) {
                    console.error(`Error reading file at ${filePath}:`, error);
                    updatedAttributes[key] = null; // Set to null if file reading fails
                }
            }
        }
        
        return updatedAttributes;
    }
    

async initializeWorker(repoUrl, username, password, attributes, fileName) {
    try {

        const gitWorker = new Worker('./src/libs/gitWorker.js');
        const portal = new MagicPortal(gitWorker);
        this.workerThread = await portal.get('workerThread');
        const content = await this.getWebComponentFromRepo(repoUrl, username, password, fileName);
        this.updatedAttributes = await this.applySettings(attributes);
        const setSettingsAddresses = await this.workerThread.setSettingsAddresses();
        console.log('setSettingsAddresses', setSettingsAddresses)
        this.runWebComponent(content, this.updatedAttributes);
        
    } catch (err) {
        console.error('Error during worker initialization:', err);
    }
}


    async cloneWebComponent(repoUrl, username, password) {
        const workerThread = this.workerThread;
        await workerThread.setRef('main');
        await workerThread.setDepth(10);
        await workerThread.setAuthParams(username, password);
        await workerThread.doCloneAndStuff({ url: repoUrl });
    }

    async getWebComponentFromRepo(repoUrl, username, password, fileName) {
        try{
            const workerThread = this.workerThread;
            await this.cloneWebComponent(repoUrl, username, password);
            let content = await workerThread.readFile({ filePath: `/${fileName}` });
            if (content === false) {
                const databaseName = await this.workerThread.getDatabaseName({url: repoUrl});
                await this.workerThread.deleteIndexedDB(databaseName);
                console.log('trying to delete database and reclone!');
                await this.cloneWebComponent(repoUrl, username, password);
                content = await workerThread.readFile({ filePath: `/${fileName}` });
            }
            this.lastLocalCommit = await workerThread.getLastLocalCommit();
            const lastRemoteCommit = await workerThread.getLastRemoteCommit();
            return content;
        } catch(error){
            console.error('some error happend: ', error);
            if (error.code === 'ENOENT') {
                console.log('recloning');
                await this.cloneWebComponent(repoUrl, username, password);
            }
        }
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
                // const content = await workerThread.readFile({ filePath: `/${fileName}` });
                return lastRemoteCommit;
            }
        };
        return null;
    }

    async checkForUpdates(interval, repoUrl, username, password, attributes, fileName) {
        this.updateInterval = setInterval(async () => {
            try {
                const lastRemoteCommit = await this.checkForUpdatesLogic(repoUrl, username, password, fileName);
                if (lastRemoteCommit) {
                    const userResponse = await this.alertComponent.show('confirm', "یک نسخه‌ی جدید وجود دارد، آیا می‌خواهید به روزرسانی شود؟");
                    console.log('userResponse', userResponse)
                    if (userResponse){
                        const databaseName = await this.workerThread.getDatabaseName({url: repoUrl});
                        await this.workerThread.deleteIndexedDB(databaseName);
                        console.log('databaseName', databaseName)
                        await this.cloneWebComponent(repoUrl, username, password);
                    }

                    this.lastLocalCommit = lastRemoteCommit;
                    this.alertComponent.show('alert', 'با موفقیت به روزرسانی شد، در بازدید بعدی شما این تغییرات اعمال می‌شود');
                }
            } catch(error) {
                console.error('This error happend while updateing: ', error)
            }
        }, interval);
    }

    runWebComponent(content, attributes) {
        const scriptElement = document.createElement('script');
        scriptElement.textContent = content;
        this.shadowRoot.appendChild(this.alertComponent);
        this.shadowRoot.appendChild(scriptElement);
        console.log('cont', content)
        const componentName = this.extractComponentName(content);
        console.log('componentName',componentName)
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
        const match = content.match(/customElements\.define\(['"]([^'"]+)['"]/);
        console.log('match', match);
        return match ? match[1] : null;
    }    
}

customElements.define('component-launcher', componentLauncher);
