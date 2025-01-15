/* eslint-env serviceworker */
/* globals LightningFS git GitHttp */

importScripts('./src/libs/isomorphicgit.js');
importScripts('./src/libs/LightningFS.js');
importScripts('./src/libs/GitHttp.js');

let username = '';
let password = '';
let dir = '/';
let depth = 1;
let remote = 'origin';
let ref = 'main';
let corsProxy = 'http://localhost:3000' //'https://cors-proxy-temp.liara.run/' 
let cache = {};
let settingsFileAddresses = {};
const http = GitHttp;
const useCacheForRepo = 0;
let broadcastChannel;
let fs = new LightningFS('fs');
let noMainErrorCounts = {
  cloneCount: 0,
  pushCount: 0,
  pullCount: 0,
  fetchCount: 0,
  ffCount: 0
};
let consoleLoggingOn = true;
let fsArgs = {};

function consoleDotLog(...parameters) {
  if (!consoleLoggingOn) return;

  console.log(...parameters);
  //console.trace();
}

function consoleDotError(...parameters) {
  if (!consoleLoggingOn) return;

  console.error(...parameters);
  console.trace();
}

const CACHE_NAME = 'cache-v1';
//const OFFLINE_URL = '/offline.html';
const URLS_TO_CACHE = [
  './src/libs/GitHttp.js',
  './src/libs/isomorphicgit.js',
  './src/libs/LightningFS.js',
  './src/libs/MagicPortal.js',
  './src/libs/require.js',
  './src/libs/gitWorker.js'
];

const basePath = new URL(self.registration.scope).pathname.split('/')[1];
const scopePath = basePath ? `/${basePath}/` : '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  consoleDotLog('install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      consoleDotLog('Opened cache');
      return cache.addAll(URLS_TO_CACHE);
    }).catch((error) => {
      consoleDotError('Failed to cache', error);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      username = '';
      password = '';
      dir = '/';
      depth = 1;
      remote = 'origin';
      ref = 'main';
      cache = {};
      settingsFileAddresses = {};
      http = GitHttp;
      useCacheForRepo = 0;
      broadcastChannel;
      fs = new LightningFS('fs');
      noMainErrorCounts = {
        cloneCount: 0,
        pushCount: 0,
        pullCount: 0,
        fetchCount: 0,
        ffCount: 0
      };
      consoleLoggingOn = true;
      fsArgs = {};
      
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })()
  );
  return self.clients.claim();
});


self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.broadcastChannelInitialized = false;

if (!self.broadcastChannelInitialized) {
  broadcastChannel = new BroadcastChannel('worker-channel');

  broadcastChannel.onmessage = async function (event) {
    const message = event.data;
    consoleDotLog(message);

    try {
      switch (message.operation) {
        case 'setAuthParams':
          await handleSetAuthParams(message.data);
          break;
        case 'setDir':
          await handleSetDir(message.data);
          break;
        case 'setRepoDir':
          await handleSetRepoDir(message.data);
          break;
        case 'setDepth':
          await handleSetDepth(message.data);
          break;
        case 'setRemote':
          await handleSetRemote(message.data);
          break;
        case 'setRef':
          await handleSetRef(message.data);
          break;
        case 'setSettingsAddresses':
          await handleSetSettingsFileAddresses(message.data);
          break;
        case 'passFsArgs':
          await handlePassFsArgs(message.data);
          break;
        default:
          await exceptionHandler(message);
          break;
      }
    } catch (error) {
      consoleDotError(`${message.operation} failed`, error);
      throw new Error(error.message);
    }
  };

  self.broadcastChannelInitialized = true;
}

async function exceptionHandler(message) {
  consoleDotError('Unhandled message operation:', message.operation);
}

async function handleSetAuthParams(data) {
  if (username !== data.username || password !== data.password) {
    username = data.username || '';
    password = data.password || '';
    consoleDotLog('handlesetauthparame: ', data);
    broadcastChannel.postMessage({ operation: 'setAuthParams', success: true });
  } else{
    broadcastChannel.postMessage({ operation: 'setAuthParams', success: true });
  }
}

async function handleSetDir(data) {
  if (dir !== data) {
    dir = data;
    broadcastChannel.postMessage({ operation: 'setDir', success: true });
  } else {
    broadcastChannel.postMessage({ operation: 'setDir', success: true });
  }
}

async function handleSetRef(data) {
  if (ref !== data) {
    ref = data;
    broadcastChannel.postMessage({ operation: 'setRef', success: true });
  } else {
    broadcastChannel.postMessage({ operation: 'setRef', success: true });
  }
}

async function handleSetRepoDir(data) {
  if (dir !== data) {
    dir = data;
    broadcastChannel.postMessage({ operation: 'setRepoDir', success: true });
  } else {
    broadcastChannel.postMessage({ operation: 'setRepoDir', success: true });
  }
}

async function handleSetDepth(data) {
  if (depth !== data) {
    depth = data;
    broadcastChannel.postMessage({ operation: 'setDepth', success: true });
  } else{
    broadcastChannel.postMessage({ operation: 'setDepth', success: true });
  }
}

async function handleSetRemote(data) {
  if (remote !== data) {
    remote = data;
    broadcastChannel.postMessage({ operation: 'setRemote', success: true });
  } else{
    broadcastChannel.postMessage({ operation: 'setRemote', success: true });
  }
}

async function handleSetSettingsFileAddresses(data) {
  if (settingsFileAddresses !== data) {
    settingsFileAddresses = data;
    broadcastChannel.postMessage({ operation: 'setSettingsAddresses', success: true });
  } else{
    broadcastChannel.postMessage({ operation: 'setSettingsAddresses', success: true });
  };
}

async function handlePassFsArgs(data) {
  try {
    if (fsArgs !== data) {
      fsArgs = data;
      databaseManager.setFs(fsArgs);
      broadcastChannel.postMessage({ operation: 'passFsArgs', success: true });
    } else {
      broadcastChannel.postMessage({ operation: 'passFsArgs', success: true });
    }
  } catch(error) {
    consoleDotError('some error happened in passFsArgs: ', error);
  }
}

async function fetchSettingsFileContent(pathname) {
  try {
    consoleDotLog('pathname',pathname)
    const content = await fs.promises.readFile(pathname, 'utf8');
    if (content) {
      consoleDotLog('fetch content', content)
      return content;
    }
  } catch (error) {
    throw new Error('Unable to fetch file content: ' + error.message);
  }
}

self.addEventListener('fetch', (event) => {
  try {
    const url = new URL(event.request.url);
    consoleDotLog(`Fetching: ${url.pathname}`);

    // If the request is for `/git`, handle it specifically
    if (url.pathname === '/git') {
      event.respondWith(handleGitRequest(event.request));
      return;
    }

    const extractedPath = scopePath && url.pathname.startsWith(scopePath)
      ? url.pathname.slice(scopePath.length - 1)
      : url.pathname;

    consoleDotLog(`Extracted path: ${extractedPath}`);

    if (settingsFileAddresses[extractedPath]) {
      consoleDotLog('Matched settings file path:', extractedPath);

      event.respondWith(
        fetchSettingsFileContent(extractedPath)
          .then((content) =>
            new Response(content, {
              headers: { 'Content-Type': 'application/json' },
            })
          )
          .catch((error) => {
            consoleDotError('Error reading file:', error);
            const statusCode = mapErrorToStatusCode(error.message || error.toString());
            return new Response(
              JSON.stringify({ error: 'File not found or inaccessible', details: error.message }),
              {
                status: statusCode,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          })
      );
      return;
    }

    event.respondWith(
      fetch(event.request).catch((error) => {
        consoleDotError('Network fetch failed:', error);
        const statusCode = mapErrorToStatusCode(error.message || error.toString());
        return new Response(
          JSON.stringify({ error: 'Network error', details: error.message }),
          {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
  } catch (error) {
    consoleDotError('Error in fetch handler:', error);
    const statusCode = mapErrorToStatusCode(error.message || error.toString());
    event.respondWith(
      new Response(
        JSON.stringify({ error: 'Unexpected error', details: error.message }),
        {
          status: statusCode,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
  }
});

class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  async lock() {
    return new Promise((resolve) => {
      const execute = () => {
        this.locked = true;
        resolve();
      };

      if (this.locked) {
        this.queue.push(execute);
      } else {
        execute();
      }
    });
  }

  unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }
}

const mutex = new Mutex();

async function handleGitRequest(request) {
    const requestData = await request.json();
    const { operation, args } = requestData;

    let response;

    switch (operation) {
      case 'clone':
        response = await clone(args);
        break;
      case 'pull':
        response = await pull(args);
        break;
      case 'push':
        response = await push(args);
        break;
      case 'fetch':
        response = await doFetch(args);
        break;
        case 'fastForward':
          response = await fastForward(args);
          break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid operation' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
 
}

class DatabaseManager {
  constructor(fs) {
    this.repoFileSystems = {};
    this.currentFs = null;
  }

  async setFs({ url, databaseName }) {
    try {
      const repoName = databaseName || await this.extractRepoAddress(url);

      if (!this.repoFileSystems[repoName]) {
        await this.initializeStore(repoName);
      }

      this.currentFs = this.repoFileSystems[repoName];
      fs = this.currentFs;
      consoleDotLog('File system set for repo:', repoName);
      return this.currentFs;
    } catch (error) {
      consoleDotError('Error setting FS:', error);
    }
  }

  async initializeStore(repoName) {
    if (!this.repoFileSystems[repoName]) {
      this.repoFileSystems[repoName] = new LightningFS(repoName, {
        fileStoreName: `fs_${repoName}`,
        wipe: false,
      });
      consoleDotLog(`Initialized file system for ${repoName}`);
    }
  }

  async extractRepoAddress(url) {
    const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)\/(.+)/;
    const match = url?.match(regex);
    if (match) {
      let domain = match[1].replace('/', '-');
      let repoName = match[2].replace('/', '-');;
      return `${domain}-${repoName}`;
    }
    return null;
  }

  //wipes fs
  async wipeFs({url, databaseName}) {
    try {
      const databaseName = this.getDatabaseName({ url, databaseName });
      consoleDotLog('wiping garbage fs ...')
      this.repoFileSystems[databaseName] = new LightningFS(databaseName, {
        fileStoreName: `fs_${databaseName}`,
        wipe: true,
      });
      consoleDotLog('Fs successfully wiped out ...')
    } catch (error) {
        consoleDotError("Error wiping file system:", error);
        throw error; 
    }
  }

  async getDatabaseName({ url, databaseName }) {
    try {
      const repoName = databaseName || await this.extractRepoAddress(url);
      return repoName;
    } catch(error) {
      consoleDotError('some error happend: ', error);
    }
  }
}

const databaseManager = new DatabaseManager(fs);


async function deleteIndexedDB(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => {
      consoleDotLog(`Deleted database ${dbName} successfully`);
      resolve();
    };
    request.onerror = (event) => {
      consoleDotError(`Error deleting database ${dbName}:`, event);
      reject(event);
    };
    request.onblocked = () => {
      console.warn(`Delete database ${dbName} blocked`);
    };
  });
}

async function generateCacheKey(url) {
  const { domain, path } = await databaseManager.getDatabaseName(url);
  if (domain && path) {
    return `${domain}|${path}`;
  }
  return null;
}

async function gitReset({dir, ref, branch}) {
  var re = /^HEAD~([0-9]+)$/
  var m = ref.match(re);
  if (m) {
      var count = +m[1];
      var commits = await git.log({fs, dir, depth: count + 1});
      var commit = commits.pop().oid;
      return new Promise((resolve, reject) => {
          fs.writeFile(dir + `/.git/refs/heads/${branch}`, commit, (err) => {
              if (err) {
                  return reject(err);
              }
              fs.unlink(dir + '/.git/index', (err) => {
                  if (err) {
                      return reject(err);
                  }
                  git.checkout({ dir, fs, ref: branch, force: true }).then(resolve);
              });
          });
      });
  }
  return Promise.reject(`Wrong ref ${ref}`);
}
async function regenerateIdxFiles() {
  const packDir = `${dir}/.git/objects/pack`;
  let packfiles = await fs.promises.readdir(packDir);
  packfiles = packfiles.filter(name => name.endsWith('.idx'));

  for (const packfile of packfiles) {
      await fs.promises.unlink(`${packDir}/${packfile}`);
      consoleDotLog(`Deleted .idx file: ${packfile}`);
  }

  // **Regenerate .idx files**
  packfiles = await fs.promises.readdir(packDir);
  packfiles = packfiles.filter(name => name.endsWith('.pack'));

  for (const packfile of packfiles) {
      const packFilePath = `${packDir}/${packfile}`;
      try {
          const relativePackFilePath = packFilePath.replace(`${dir}/`, '');
          consoleDotLog('Attempting to generate .idx file for:', packFilePath);
          const { oids } = await git.indexPack({
              fs,
              dir,
              filepath: relativePackFilePath,
              async onProgress(evt) {
                  consoleDotLog(`${evt.phase}: ${evt.loaded} / ${evt.total}`);
              }
          });
          consoleDotLog('Generated .idx file for:', relativePackFilePath, 'OIDs:', oids);
      } catch (err) {
          consoleDotError(`Error regenerating .idx files for ${packfile}:`, err);
      }
  }
}

async function retryOperation(operation, args, maxRetries = 2) {
  let retryCount = 0;
  let delay = 1000;

  while (retryCount <= maxRetries) {
    try {
      return await operation(args);
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS') || error.message.includes('HTTP Error')) {
        retryCount++;
        if (retryCount > maxRetries) throw new Error('Max retries reached for operation.');
        
        consoleDotLog(`Network error, Retrying operation in ${delay / 1000} seconds... (Attempt ${retryCount})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

function buildHeaders(username, password) {
  if (!username && !password) {
    consoleDotLog('No username or password provided. Returning empty headers.');
    return {};
  }
  return {
    authorization: `Basic ${btoa(`${username}:${password}`)}`
  };
}


async function clone(args) {
  consoleDotLog('entering clone with : ', args);
  return await retryOperation(async (args) => {
    consoleDotLog('Entering clone function with arguments:', args);

    noMainErrorCounts.cloneCount ++;
    let cloneResult = {};
    let repoName = await databaseManager.getDatabaseName(args);
    await mutex.lock();
    try {
        consoleDotLog('ref', ref)
        if (!databaseManager.repoFileSystems[repoName]) {
            await databaseManager.setFs(args);
        }

        fs = databaseManager.repoFileSystems[repoName];
        cloneResult = await fetchCachedFileList(repoName);
        if (!cloneResult) {
            const result = await git.clone({
                ...args,
                fs,
                cache,
                http,
                dir,
                remote,
                ref,
                corsProxy,
                depth,
                headers: buildHeaders(username, password),
                onAuth() {
                    return authenticate.fill();
                },
                onAuthFailure() {
                    return authenticate.rejected();
                },
            });

            consoleDotLog('Clone successful', result);
            if (useCacheForRepo){
              //await regenerateIdxFiles();
              const fileList = await listFiles();
              await cacheFileList(repoName, fileList);
            }
            cloneResult = { isCacheUsed: false, ref: ref};

            await logToCache('clone', { repoName, result });
        } else {
            await writeFilesToIndexedDB(cloneResult);
            await gitReset({ dir, ref: 'HEAD~1', branch: ref });
            await logToCache('clone (from cache)', { repoName });
            consoleDotLog('log', await retrieveLogFromCache());
            cloneResult = { isCacheUsed: true, ref: ref };
        }

        return { success: true, message: 'The repo has successfully cloned', data: cloneResult };
    } catch (error) {
        consoleDotError('Clone failed with error:', error);
        if (error?.message?.includes('Could not find') && error?.code === 'NotFoundError') {
              let isHandled = await handleNoMainError(clone, args, noMainErrorCounts.cloneCount);
              if (!isHandled) {
                  throw error;
              }
              noMainErrorCounts.cloneCount = 0;
              cloneResult = { isCacheUsed: false, ref: ref};
              return { success: true, message: 'The repo has successfully cloned', data: cloneResult };
        } else if (error?.response?.status === 500) {
            consoleDotError('Server responded with 500 Internal Server Error');
            throw new Error('Internal Server Error: The server encountered an error.');
        } else if (typeof error === 'object') {
            consoleDotError('Error properties:', Object.keys(error));
            throw new Error(error.message || 'An unknown error occurred during the clone operation');
        } else {
            consoleDotError('Unknown error:', error);
            throw new Error('An unknown error occurred during the clone operation');
        }
    } finally {
        mutex.unlock();
      }
    }, args);
}

async function cacheFileList(cacheKey, fileList) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const filesWithContent = {};
    consoleDotLog('fl', fileList);

    for (const [fileName, filePath] of Object.entries(fileList)) {
      consoleDotLog('fn, fp', fileName, filePath);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isDirectory()) {
        // Store an empty string for directories
        filesWithContent[filePath] = '';
      } else if (stats.isFile()) {
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        filesWithContent[filePath] = fileContent;
      }
    }

    consoleDotLog('filesWithContent', filesWithContent);

    const response = new Response(JSON.stringify(filesWithContent), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(cacheKey, response);
    consoleDotLog('File list and contents cached successfully', response);
  } catch (error) {
    consoleDotError('Error caching file list and contents:', error);
  }
}

async function listFiles(filePath = dir) {
  try {
    let path = filePath;
    let files = await fs.promises.readdir(filePath);
    let result = {};
    consoleDotLog('files',files)
    result[filePath] = filePath;

    for (const file of files) {
      consoleDotLog('file',file)
      let fullPath = path !== '/' ? `${path}/${file}` : `${path}${file}`;
      const stat = await fs.promises.lstat(fullPath);

      if (stat.isDirectory()) {
        consoleDotLog('fullPath',fullPath)
        result = { ...result, ...await listFiles(fullPath) };
      } else {
        consoleDotLog('result',result)
        result[fullPath] = fullPath;
      }
    }
    return result;
  } catch (error) {
    consoleDotError('Error listing files:', error);
    throw error;
  }
}

async function fetchCachedFileList(cacheKey) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      const filesWithContent = await cachedResponse.json();
      consoleDotLog('Files and contents fetched from cache:', filesWithContent);
      return filesWithContent;
    } else {
      consoleDotLog('No cached file list found');
      return null;
    }
  } catch (error) {
    consoleDotError('Error fetching cached file list and contents:', error);
    return null;
  }
}

async function writeFilesToIndexedDB(filesWithContents) {
  for (const [filePath, fileContent] of Object.entries(filesWithContents)) {
    const directories = filePath.split('/').slice(0, -1).join('/');

    // Create directories if they don't exist
    if (directories) {
      await ensureDirectoryExists(fs, directories);
    }

    if (fileContent === '') {
      // If fileContent is an empty string, create the directory
      await fs.promises.mkdir(filePath, { recursive: true });
      consoleDotLog(`Directory created: ${filePath}`);
    } else {
      // Write file content to the appropriate path
      await fs.promises.writeFile(filePath, fileContent);
    }
  }
  consoleDotLog('All files and contents have been written to IndexedDB using LightningFS.');
}

async function ensureDirectoryExists(fs, dirPath) {
  const parts = dirPath.split('/').filter(part => part);
  let currentPath = '';

  for (const part of parts) {
    currentPath += `/${part}`;
    try {
      await fs.promises.mkdir(currentPath);
      consoleDotLog(`Directory created: ${currentPath}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        consoleDotError(`Error creating directory: ${currentPath}`, error);
        throw error;
      }
    }
  }
}

async function writeFilesToIndexedDB(filesWithContents) {
  try {
    for (const [filePath, fileContent] of Object.entries(filesWithContents)) {
      const directories = filePath.split('/').slice(0, -1).join('/');
      consoleDotLog(filePath);

      try {
        // Create directories if they don't exist
        if (directories) {
          await ensureDirectoryExists(fs, directories);
        }
      } catch (dirError) {
        consoleDotError(`Error creating directories for path: ${directories}. Error: ${dirError.message}`);
        throw dirError; // Re-throw to exit the loop or handle it outside this function
      }

      try {
        // Write file content to the appropriate path
        await fs.promises.writeFile(filePath, fileContent);
      } catch (writeError) {
        consoleDotError(`Error writing file at path: ${filePath}. Error: ${writeError.message}`);
        throw writeError; 
      }
    }
    consoleDotLog('All files and contents have been written to IndexedDB using LightningFS.');
  } catch (error) {
    consoleDotError('An error occurred during the write operation:', error);
    throw error; 
  }
}



function mapErrorToStatusCode(message) {
  if (message.includes('400')) return 400;
  if (message.includes('401')) return 401;
  if (message.includes('403')) return 403;
  if (message.includes('404')) return 404;
  if (message.includes('409')) return 409;
  if (message.includes('422')) return 422;
  if (message.includes('429')) return 429;
  if (message.includes('500')) return 500;
  if (message.includes('501')) return 501;
  if (message.includes('502')) return 502;
  if (message.includes('503')) return 503;
  if (message.includes('504')) return 504;
  return 500;
}

// Auth object
const authenticate = {
  async fill() {
    consoleDotLog('authenticate', username, password)
    return { username: username, password: password };
  },
  async rejected() {
    consoleDotLog("Authentication rejected");
    return;
  }
};


async function pull(args) {
  return await retryOperation(async (args) => {
    noMainErrorCounts.pullCount++;
    let pullResult = {};
    await mutex.lock();
    try {
      await databaseManager.setFs(args);
      consoleDotLog('Entering pull function with arguments:', args);

      if (!ref) {
        throw new Error('Reference (ref) is not defined.');
      }

      consoleDotLog('Using reference (ref):', ref);

      const result = await git.pull({
        ...args,
        fs,
        http,
        dir,
        corsProxy,
        remote,
        remoteRef: ref,
        fastForward: true,
        forced: true,
        singleBranch: true,
        headers: buildHeaders(username, password),
        onAuth() {
          return authenticate.fill();
        },
        onAuthFailure() {
          return authenticate.rejected();
        },
      });
      pullResult = { ref: ref };
      consoleDotLog('Pull successful. Result:', result);
      return { success: true, message: result, data: pullResult };
    } catch (error) {
      if (error?.message?.includes('Could not find') && error?.code === 'NotFoundError') {
        let isHandled = await handleNoMainError(pull, args, noMainErrorCounts.pullCount);
        if (!isHandled) {
          throw error;
        }
        noMainErrorCounts.pullCount = 0;
        pullResult = { ref: ref };
        return { success: true, message: 'pull was successful', data: pullResult };
      }
      consoleDotError('Error occurred during pull operation:', error);
      throw new Error(`Pull failed: ${error.message}`);
    } finally {
      consoleDotLog('Exiting pull function.');
      mutex.unlock();
    }
  }, args);
}

async function fastForward(args) {
  return await retryOperation(async (args) => {
    noMainErrorCounts.ffCount++;
    let ffResult = {};
    await mutex.lock();
    try {
      await databaseManager.setFs(args);
      consoleDotLog('Entering fastForward function with arguments:', args);

      if (!ref) {
        throw new Error('Reference (ref) is not defined.');
      }

      const result = await git.fastForward({
        ...args,
        fs,
        cache,
        http,
        dir,
        remote,
        corsProxy,
        ref,
        remoteref: ref,
        forced: true,
        singleBranch: false,
        headers: buildHeaders(username, password),
        onAuth() {
          return authenticate.fill();
        },
        onAuthFailure() {
          return authenticate.rejected();
        },
      });

      ffResult = { ref: ref };
      consoleDotLog('FastForward pull successful. Result:', result);
      return { success: true, message: result, data: ffResult };
    } catch (error) {
      if (error?.message?.includes('Could not find') && error?.code === 'NotFoundError') {
        let isHandled = await handleNoMainError(fastForward, args, noMainErrorCounts.ffCount);
        if (!isHandled) {
          throw error;
        }
        noMainErrorCounts.ffCount = 0;
        ffResult = { ref: ref };
        return { success: true, message: 'FastForward was successful', data: ffResult };
      }
      consoleDotError('Error occurred during fastForward operation:', error);
      throw new Error(`FastForward pull failed: ${error.message}`);
    } finally {
      consoleDotLog('Exiting fastForward function.');
      mutex.unlock();
    }
  }, args);
}

async function push(args) {
  return await retryOperation(async (args) => {
    noMainErrorCounts.pushCount++;
    let pushResult = {};
    await mutex.lock();
    try {
      await databaseManager.setFs(args);
      consoleDotLog('Entering push function with arguments:', args);

      if (!ref) {
        throw new Error('Reference (ref) is not defined.');
      }

      const result = await git.push({
        ...args,
        fs,
        http,
        dir,
        corsProxy,
        remote,
        ref,
        force: true,
        headers: buildHeaders(username, password),
        onAuth() {
          return authenticate.fill();
        },
        onAuthFailure() {
          return authenticate.rejected();
        },
      });

      pushResult = { ref: ref };
      consoleDotLog('Push successful. Result:', result);
      return { success: true, message: 'Push was successful', data: pushResult };
    } catch (error) {
      if (error?.message?.includes('Could not find') && error?.code === 'NotFoundError') {
        let isHandled = await handleNoMainError(push, args, noMainErrorCounts.pushCount);
        if (!isHandled) {
          throw error;
        }
        noMainErrorCounts.pushCount = 0;
        pushResult = { ref: ref };
        return { success: true, message: 'Push was successful', data: pushResult };
      }
      consoleDotError('Error occurred during push operation:', error);
    } finally {
      consoleDotLog('Exiting push function.');
      mutex.unlock();
    }
  }, args);
}

async function doFetch(args) {
  return await retryOperation(async (args) => {
    noMainErrorCounts.fetchCount++;
    let fetchResult = {};
    await mutex.lock();
    try {
      await databaseManager.setFs(args);
      consoleDotLog('Entering doFetch function with arguments:', args);

      if (!ref) {
        throw new Error('Reference (ref) is not defined.');
      }

      const result = await git.fetch({
        ...args,
        fs,
        http,
        dir,
        corsProxy,
        ref,
        remote,
        depth,
        singleBranch: false,
        tags: false,
        headers: buildHeaders(username, password),
        onAuth() {
          return authenticate.fill();
        },
        onAuthFailure() {
          return authenticate.rejected();
        },
      });

      fetchResult = { ref: ref };
      consoleDotLog('Fetch successful. Result:', result);
      return { success: true, message: 'Fetch was successful', data: fetchResult };
    } catch (error) {
      if (error?.message?.includes('Could not find') && error?.code === 'NotFoundError') {
        let isHandled = await handleNoMainError(doFetch, args, noMainErrorCounts.fetchCount);
        if (!isHandled) {
          throw error;
        }
        noMainErrorCounts.fetchCount = 0;
        fetchResult = { ref: ref };
        return { success: true, message: 'The repo has successfully cloned', data: fetchResult };
      }
      consoleDotError('Error occurred during fetch operation:', error);
      throw new Error(`Fetch failed: ${error.message}`);
    } finally {
      consoleDotLog('Exiting doFetch function.');
      mutex.unlock();
    }
  }, args);
}

async function logToCache(action, data) {
  try {
    const cache = await caches.open(CACHE_NAME);

    // Retrieve existing logs
    let response = await caches.match('log');
    let logs = response ? await response.json() : [];

    // Add new log entry with a timestamp
    const timestamp = new Date().toISOString();
    const newLogEntry = { action, data, timestamp };
    logs.push(newLogEntry);

    // Check if logs exceed 5 KB limit
    let logSize = new Blob([JSON.stringify(logs)]).size;
    const maxSize = 5 * 1024; // 5 KB

    // Remove oldest logs if necessary
    while (logSize > maxSize) {
      logs.shift(); // Remove the oldest log entry
      logSize = new Blob([JSON.stringify(logs)]).size;
    }

    // Save updated logs back to cache
    const updatedResponse = new Response(JSON.stringify(logs), { headers: { 'Content-Type': 'application/json' } });
    await cache.put('log', updatedResponse);

    consoleDotLog(`Logged action: ${action} at ${timestamp}`, newLogEntry);
  } catch (error) {
    consoleDotError('Error logging data to cache:', error);
  }
}


async function retrieveLogFromCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('log');
    
    if (response) {
      const logs = await response.json();
      consoleDotLog('Retrieved logs from cache:', logs);
      return logs;
    } else {
      consoleDotLog('No logs found in cache.');
      return [];
    }
  } catch (error) {
    consoleDotError('Error retrieving logs from cache:', error);
    return [];
  }
}

async function handleNoMainError(operation, args, count) {
  consoleDotLog(`Attempt ${count + 1}: Branch "${ref}" not found. Attempting to checkout to the other branch.`);

  try {
      if (count < 2) { // Allow for two retries (3 attempts in total)
          // Unlock mutex if it was locked
          mutex.unlock();

          // Switch between 'main' and 'master'
          ref = (ref === 'main') ? 'master' : (ref === 'master') ? 'main' : undefined;

          if (ref === undefined) {
              consoleDotError('No default branch name found, you should set it manually!');
              return false; // Indicate that no retry is possible
          }

          // Increment count and retry the operation with the new ref
          return await operation(args, count + 1);
      } else {
          consoleDotError('Exceeded the maximum number of retries. Please check the branch name manually.');
          noMainErrorCounts = {
            cloneCount: 0,
            pushCount: 0,
            pullCount: 0,
            fetchCount: 0,
            ffCount: 0
          };
          throw new Error('Exceeded the maximum number of retries.');
      }
  } catch (checkoutError) {
      consoleDotError(`Checkout to branch "${ref}" failed:`, checkoutError);
      throw checkoutError; // Propagate the error after all attempts
  }
}