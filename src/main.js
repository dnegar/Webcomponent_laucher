// src/main.js
import { loadComponentFromRepo } from './utils/componentLoader';
import { register } from './serviceWorkerRegistration';

await register();

// Define attributes for the Web Component
const attributes = { color: 'lightblue', size: 'large', 'data-custom': 'Hello!' };

// Load the component from the repository
await loadComponentFromRepo({
    filePath: '/wc2.js',
    attributes
});
