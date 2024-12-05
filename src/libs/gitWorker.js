/* eslint-disable guard-for-in */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-unused-vars */
/* eslint no-use-before-define: 0 */
/* eslint-disable no-undef */
/* globals LightningFS git MagicPortal GitHttp */
/* eslint-env worker */


importScripts(
  './require.js',
);

require({
  baseUrl: "./"
},
["require", "MagicPortal", "LightningFS", "isomorphicgit"],
function(require, MagicPortal, LightningFS, git) {

portal = new MagicPortal(this);
let dir = '/';
let username;
let password;
let ref = 'main';
let url = '';
let databaseName = null;
let remote = 'origin';
let depth = 10;
let settingsFileAddresses = {};
let fs = new LightningFS('fs');
let consoleLoggingOn = true;
let gitConfigFilePath = '/settings';

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

this.addEventListener("message", ({ data }) => consoleDotLog(data));

//broadcastChannel for sending set functions' parameters
function sendMessageToSW(message) {
  return new Promise((resolve) => {
    const broadcastChannel = new BroadcastChannel('worker-channel');

    broadcastChannel.onmessage = (event) => {
      if (event.data.operation === `${message.operation}`) {
        broadcastChannel.close();
        resolve(event.data);
      }
    };

    broadcastChannel.postMessage(message);
  });
}

self.setAuthParams = async function() {
  await sendMessageToSW({ 
    operation: 'setAuthParams',
    data: {username: username, password: password}
  });
};

self.setDir = async function() {
  await sendMessageToSW({ operation: 'setDir', data: dir });
};

self.setRef = async function () {
  await sendMessageToSW({ operation: 'setRef', data: ref });
}
self.setDepth = async function() {
  await sendMessageToSW({ operation: 'setDepth', data: depth });
};

self.setRemote = async function() {
  await sendMessageToSW({ operation: 'setRemote', data: remote });
};

self.setRepoDir = async function() {
  await sendMessageToSW({ operation: 'setRepoDir', data: dir });
}

self.setSettingsAddresses = async function () {
  await sendMessageToSW({ operation: 'setSettingsAddresses', data: settingsFileAddresses });
}

async function fetchWithServiceWorker(operation, args) {
  try {
      const response = await fetch('/git', {
          method: 'POST',
          body: JSON.stringify({ operation, args }),
          headers: { 'Content-Type': 'application/json' }
      });
      consoleDotLog('response',response.text)

      if (!response.ok) {
          let errorMessage = `Fetch failed with status: ${response.status}`;

          switch (response.status) {
              case 400:
                  errorMessage = "Bad Request: The server could not understand the request.";
                  break;
              case 401:
                  errorMessage = "Unauthorized: Authentication is required or has failed.";
                  break;
              case 403:
                  errorMessage = "Forbidden: You do not have permission to access this resource.";
                  break;
              case 404:
                  errorMessage = "Not Found: The requested resource could not be found.";
                  break;
              case 500:
                  errorMessage = "Internal Server Error: The server encountered an error.";
                  break;
              case 502:
                  errorMessage = "Bad Gateway: The server received an invalid response from the upstream server.";
                  break;
              case 503:
                  errorMessage = "Service Unavailable: The server is currently unable to handle the request.";
                  break;
              case 504:
                  errorMessage = "Gateway Timeout: The server did not receive a timely response from the upstream server.";
                  break;
              default:
                  errorMessage = `Unexpected status code: ${response.status}`;
          }

          throw new Error(errorMessage);
      }

      try {
          const jsonResponse = await response.json();
          consoleDotLog('jsonResponse',jsonResponse)
          return jsonResponse;
      } catch (jsonError) {
          consoleDotError('Error parsing JSON response:', jsonError);
          throw new Error('Response is not valid JSON');
      }

  } catch (error) {
      consoleDotError('Fetch error:', error);
      throw error;
  }
}

//This function sets the directory for your working directory
async function setDir(_dir) {
  dir = _dir;
  await self.setDir();
}

function isValidUrl(url) {
  const pattern = /^https?:\/\/.+/;
  return pattern.test(url);
}

//setUrl is an essential function that should be called when you want to
//work with files in the fs, because fileSystem is named after url address
async function setUrl(_url) {
  consoleDotLog('seturl url ', _url)

  if (!isValidUrl(_url)) {
    throw new Error("Invalid Git URL format.");
  }
  url = _url;
}

async function setDatabaseName(_databaseName) {
  _databaseName && (databaseName = _databaseName);
}

async function setRef(_ref) {
  ref = _ref;
  await self.setRef();
}

//This function sets depth
async function setDepth(_depth) {
  depth = _depth;
  await self.setDepth();
}

//Using this function sets the CorsProxy of your choice
async function setCorsProxy(_corsProxy) {
  corsProxy = _corsProxy;
}

//Using this function sets the username and password to use in clone and other functions
async function setAuthParams(_username, _password) {
  username = _username;
  password = _password;
  await self.setAuthParams();
}

//this function sets up the remote that user wants to do things on
async function setRemote(_remote) {
  remote = _remote;
  await self.setRemote();
}

async function setSettingsAddresses() {
  try {
      const libraries = await readSettingsFile('library'); 
      consoleDotLog('libs', libraries)
      const directories = await listFiles(); 
      consoleDotLog('directories', directories)

      if (libraries && directories){
        for (const [fileName, filePath] of Object.entries(libraries)) {
            if (!directories[filePath]) {
                throw new Error(`File not found: ${filePath}`);
            }

            settingsFileAddresses[filePath] = {
                fileName, 
                filePath,
            };
            console.log(`File mapped: ${filePath}`);
            await self.setSettingsAddresses();
            return {success: true};
        }
      } else {
        return {success: false};
      }
  } catch (error) {
      console.error(`Error in setSettingsAddresses: ${error.message}`);
  }
}

class DatabaseManager {
  constructor() {
    this.repoFileSystems = {};
    this.currentFs = null;
    this.databaseName = null;
  }

  async setFs({ url, databaseName }) {
    try {
      const repoName = databaseName || await this.extractRepoAddress(url);

      if (!this.repoFileSystems[repoName]) {
        await this.initializeStore(repoName);
      }

      this.currentFs = repoName;
      console.log('File system set for repo:', repoName, this.repoFileSystems);
      return {name: this.currentFs, fs: this.repoFileSystems[repoName]};
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
      console.log('2000:', this.repoFileSystems[repoName]);
      console.log(`Initialized file system for ${repoName}`);
    }
  }

  async extractRepoAddress(url) {
    consoleDotLog('urllll', url)
    const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)\/(.+)/;
    const match = url.match(regex);
    if (match) {
      let domain = match[1].replace('/', '-');
      let repoName = match[2].replace('/', '-');
      return `${domain}-${repoName}`;
    }
    return null;
  }

  //wipes fs
  async wipeFs({url, databaseName}) {
    try {
      const databaseName = await this.getDatabaseName({ url, databaseName });
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

  async deleteIndexedDB(databaseName) {
    const parsedDatabaseName = await this.getDatabaseName({ url, databaseName });
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(parsedDatabaseName);
      request.onsuccess = () => {
        consoleDotLog(`Deleted database ${parsedDatabaseName} successfully`);
        resolve();
      };
      request.onerror = (event) => {
        consoleDotError(`Error deleting database ${parsedDatabaseName}:`, event);
        reject(event);
      };
      request.onblocked = () => {
        console.warn(`Delete database ${parsedDatabaseName} blocked`);
      };
    });
  }

  async processDatabaseList(dbList) {
    const fileStoreNames = [];

    for (const db of dbList) {
      const dbName = typeof db === 'string' ? db : db.name; // Normalize db name

      const dbOpenRequest = await this.openDatabase(dbName);
      const fileStores = dbOpenRequest.objectStoreNames;

      // Filter stores starting with "fs_" and map them with their database name
      const fsStores = Array.from(fileStores)
        .filter((store) => store.startsWith('fs_'))
        .map((store) => ({ database: dbName, fileStore: store }));

      fileStoreNames.push(...fsStores);
    }
    consoleDotLog('entering procesDB' , fileStoreNames)
    return fileStoreNames;
  }

  async openDatabase(dbName) {
    consoleDotLog('entering opendb')
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        resolve(db);
      };
      
      request.onerror = (event) => {
        reject(`Error opening database ${dbName}: ${event.target.error}`);
      };
    });
  }

  async getFileStoresFromDatabases() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.webkitGetDatabaseNames
        ? indexedDB.webkitGetDatabaseNames()
        : indexedDB.databases
        ? indexedDB.databases()
        : null;

      if (!request) {
        reject('Your browser does not support retrieving a list of IndexedDB databases');
        return;
      }

      if (request instanceof Promise) {
        request
          .then((dbList) => {
            this.processDatabaseList(dbList)
              .then((fileStoreNames) => resolve(fileStoreNames))
              .catch((err) => reject(err));
          })
          .catch((err) => reject(err));
      } else {
        request.onsuccess = async (event) => {
          const dbList = event.target.result;
          try {
            const fileStoreNames = await this.processDatabaseList(dbList);
            resolve(fileStoreNames);
          } catch (err) {
            reject(err);
          }
        };

        request.onerror = (event) => {
          reject(`Error retrieving database list: ${event.target.error}`);
        };
      }
    });
  }
}

const databaseManager = new DatabaseManager(fs);

async function deleteIndexedDB(databaseName) {
  await databaseManager.deleteIndexedDB(databaseName);
}

async function getDatabaseName(args) {
  return await databaseManager.getDatabaseName(args);
}

async function getFileStoresFromDatabases() {
  consoleDotLog('entering getFileStoresFromDatabases object')
  const FileStoreNames = await databaseManager.getFileStoresFromDatabases();
  return {success : true, data: FileStoreNames};
}

async function setFs(args) {
  const result = await databaseManager.setFs(args);
  fs = result.fs;
  return result.name;
}
//this function sets up the branch that user wants to do things on
//gets branch name as parameter
//if there are uncommited changes this function return 2 and abort
async function checkoutBranch(_ref) {

    let current = await currentBranch();
    consoleDotLog('current branch', current)
    consoleDotLog('ref', ref)
    consoleDotLog('_ref', _ref)

    let branchesList = await listBranches();
    consoleDotLog('branchesList', branchesList)

    if (!branchesList.includes(_ref)){
      await createBranch({ref: _ref});
    }
    if (ref === _ref || current === _ref){
      consoleDotLog(`you are already on the branch ${_ref}`);
      return;
    }
    else{
      let changedFiles = await getCheckoutFilesList();
      if (Object.keys(changedFiles).length === 0){
        await checkout({ref: _ref, noCheckout: false, noUpdateHead: false});
        ref = _ref;
        await doFetch({url});
        consoleDotLog('done');
        return;
      }
      else{
        consoleDotLog('failed');
        return 0;
      }
    }

}

//create local branch, branch
async function createBranch(args) {
  //consoleDotLog('object', args.object);
  return await git.branch({
    ...args,
    fs,
    dir
  })
}

//git checkout function implementation
//gets ref as parameter
async function checkout(args) {
  return await git.checkout({
    ...args,
    fs,
    dir,
    remote,
  })
}

//this function lists local branches
async function listBranches() {
  return await git.listBranches({
    fs,
    dir,
  })
}

//this function lists local branches
//you can get another list for another remote by using setRemote function
async function listRemoteBranches() {
  try {
    return await git.listBranches({ fs, dir, remote });
  } catch (error) {
    consoleDotError("Error in listBranches:", error);
  }
}

// Get the current branch name
async function currentBranch() {
  return await git.currentBranch({
    fs,
    dir,
    fullname: false
  })
}

function parseIni(content) {
  const result = {};
  let currentSection = null;

  content.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) {
      // Ignore empty lines and comments
      return;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      // New section
      currentSection = line.slice(1, -1).trim();
      result[currentSection] = result[currentSection] || {};
    } else {
      // Key-value pair
      const [key, value] = line.split('=').map((part) => part.trim());
      if (currentSection) {
        result[currentSection][key] = value;
      }
    }
  });
  return result;
}

function stringifyIni(data) {
  let iniString = '';

  Object.keys(data).forEach((section) => {
    iniString += `[${section}]\n`;
    Object.entries(data[section]).forEach(([key, value]) => {
      iniString += `    ${key} = ${value}\n`;
    });
    iniString += '\n';
  });

  return iniString;
}

async function readSettingsFile(type = null, key = null) {
  try {
    const settingsPath = await fs.promises.readdir(`${dir}`)
    if (settingsPath.includes('settings')){
      const content = await readFile({filePath: gitConfigFilePath});
      const settingsData = parseIni(content);
      consoleDotLog('settingsData,',settingsData)

      if (type && key) {
        return settingsData[type] && settingsData[type][key] ? settingsData[type][key] : null;
      } else if (type) {
        return settingsData[type] ? settingsData[type] : null;
      }

      return settingsData;
    }
    else{
      consoleDotError('The settings file dosen\'t exist yet!')
      return;    
    }
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeSettingsFile(data) {
  const iniContent = stringifyIni(data);
  await writeFile({filePath: gitConfigFilePath, fileContents: iniContent});
}

async function addToSetting(type, key, value) {
  let settingsData = {};
  try {
    settingsData = await readSettingsFile();
    consoleDotLog(settingsData)
    if (!settingsData){
      settingsData = {};
      consoleDotLog('No past data is available. New file will be created.');
    }
    if (!settingsData[type]) {
      settingsData[type] = {};
    }
  
    settingsData[type][key] = value;
    consoleDotLog('settingsData',settingsData);
    await writeSettingsFile(settingsData);
    consoleDotLog('done');

  } catch (error) {
    consoleDotLog('No past data is available.');
  }


}

//This function gets a filePath and push it to a remote repository
//gets username, email, commitMessage (optional), url and filePath as parameters 
async function doPushFile(args) {
  try {
    await addFile(args);
    await commit(args);
    return await push(args);
  }
  catch (error){
    consoleDotLog('Something bad happened pushing your file: ', error)
  }
}

//This function push all changed files to the remote repo
//gets username, email, commitMessage, remote, url as parameters 
async function doPushAll(args) {
  try {
    await addDot();
    await commit(args);
    return await push(args);
  }
  catch (error){
    consoleDotLog('Something bad happened pushing your files: ', error)
  }
}

//This function removes a filePath from a remote repository
//gets username, email, commitMessage, remote, url and filePath as parameters 
async function removeAndPush(args) {
  try {
    await remove(args);
    await commit(args);
    await push(args);
  }
  catch (error){
    consoleDotLog('Something bad happened pushing your files: ', error)
  }
}

//this function fetches the last information for the given url
//you can change depth by using setDepth
//remote is a prerequisite for this function which is being set using clone
async function doFetch(args) {
  await setUrl(args.url);
  try {
    try {
      await databaseManager.setFs(args);
      await setDatabaseName(args?.databaseName);
      await fetchWithServiceWorker('fetch', args);
      return {success: true}
    } catch (error) {
      throw error;
    }
  } catch (error) {
    consoleDotError('some error happend while fetching: ', error);
    await handleDeleteCloseAndReclone(args);
    return {success: false}
  }
}

async function getLastRemoteCommit() {
  try{
    consoleDotLog('databaseNameremote', databaseName);
    let lastRemoteCommit = await readFile({filePath: dir + `/.git/refs/remotes/${remote}/${ref}`});
    return lastRemoteCommit?.trim();
  }
  catch(error){
    consoleDotLog(
      'some error happend while getting last remote commit: '
    , error);
  }
}

async function getLastLocalCommit() {
  try{
    consoleDotLog('databaseNamelocal', databaseName);
    const localRef = await git.resolveRef({ fs, dir, ref: `refs/remotes/${remote}/${ref}` });
    return localRef?.trim();
  }
  catch(error){
    consoleDotLog(
      'some error happend while getting last local commit: '
    , error);
  }
}

//isSync function checks if user's last local commit is equal to the
//last remote commit or not, gets url as arguments
//returns 1 if it is sync and 0 if it's not
async function isSync() {
  try{
    const localRef = await getLastLocalCommit();
    consoleDotLog('lastRemoteCommit', 'localRef', localRef)

    await doFetch({url,   depth: 1, databaseName});
    let lastRemoteCommit = await getLastRemoteCommit();
    if (lastRemoteCommit === localRef){
      consoleDotLog('lastRemoteCommit', lastRemoteCommit, 'localRef', localRef)
      return 1;
    }
    else{
      return 0;
    }
  }
  catch(error){
    consoleDotLog(
      'some error happend while checking whether you are sync or not: '
    , error);
  }
}

//parameters are remote and url. this function adds remote for an url
async function addRemote(args) {
  try{
    return git.addRemote({
      url: args.url,
      force: true,
      fs,
      dir,
      remote,
    });
  }
  catch(error){
    consoleDotLog('some error happend while adding remote: ', error)
  }
}

//gets remote as parameter and removes that remote
async function deleteRemote(args) {
  try{
    return git.deleteRemote({
      ...args,
      fs,
      dir,
      remote,
    })
  }
  catch(error){
    consoleDotLog('some error happend while deleting remote: ', error)
  }
}

//lists remotes for an fs
async function listRemotes() {
  return git.listRemotes({
    fs, 
    dir
  });
}

//args are remote and url
async function handleNoRef(args) {
  try {
    await addRemote(args);
    let branchList = await listRemoteBranches() || [];
    consoleDotLog(branchList)
    if (branchList.length == 0) {
      return false;
    }
  } catch (error) {
      consoleDotError("Error handling no ref:", error);
      throw error; 
  }
}

async function init(){
  try{
    await git.init({
      fs,
      dir
    })
    consoleDotLog('kiri')
  }
  catch(error){
  consoleDotLog('something went wrong while initing the repo: ', error)
  }
}

async function checkDirExists() {
  try {

    const contents = await fs.promises.readdir(dir); // List the contents of the current directory

      if (contents.length === 0) {
        return false; // Part of the path does not exist in the current directory
      }
    return true;

  } catch (err) {
    if (err.code === 'ENOENT') {
      consoleDotLog('Directory does not exist:', dir);
      return false; // Directory or file does not exist
    } else {
      consoleDotError('Error checking directory existence:', err);
      throw err; // Some other error occurred
    }
  }
}

//returns false if the repo is not initiated yet
//parameters are url, remote, ...
//you can change depth by using setDepth function
async function doCloneAndStuff(args) {
  let useNetwork = false;
  const repoName = await databaseManager.getDatabaseName(args);
  consoleDotLog('doclone repoName ', repoName)
  await setUrl(args.url);
  await setDepth(depth);

  try {
    let handleNoRefResult = true;
    if (!databaseManager.repoFileSystems[repoName]) {
      await databaseManager.setFs(args);
      await setDatabaseName(args?.databaseName);
    }

    databaseManager.currentFs = databaseManager.repoFileSystems[repoName];
    fs = databaseManager.currentFs;

    let dirExists = await checkDirExists();
    if (dirExists && !useNetwork) {
      consoleDotLog(`Directory ${repoName} already exists. Using existing directory...`);
      let head = await currentBranch();
      await setRef(head);
      return ({handleNoRefResult, message: 'exists', success: true});
    } else {
      consoleDotLog(`Cloning repository ${repoName}...`);
      cloneResult = await clone(args);
      ref = cloneResult.data.ref;
      let head = await currentBranch();
      await setRef(head);
      consoleDotLog(cloneResult, head)
      if (cloneResult.data){
        if (cloneResult.data.isCacheUsed){
          await fastForward({
            url: args.url,
          });
        }
      }
      handleNoRefResult = await handleNoRef(args);
      await initializeLocalBranches();
    }
    return ({handleNoRefResult, message: 'notExist', success: true});
  } catch (error) {
    consoleDotError('some error happend while doCloneAndStuff: ', error);
    await handleDeleteCloseAndReclone(args);
    return {success: false}
  }
}

async function handleDeleteCloseAndReclone(args, retries = 3) {
  const repoName = await databaseManager.getDatabaseName(args);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to delete and reclone...`);

      await databaseManager.deleteIndexedDB(repoName);

      console.log('Trying to reclone the repository...');
      await doCloneAndStuff({ ...args, url: args.url });
      console.log('Reclone successful!');
      
      return;

    } catch (error) {
      consoleDotError(`Error during delete, close, and reclone process for ${repoName} (Attempt ${attempt}):`, error);

      if (attempt === retries) {
        consoleDotError(`All ${retries} attempts failed.`);
        throw error;
      }
    }
  }
}

async function isDirectory(path) {
  const stat = await fs.promises.lstat(path);
  return stat.isDirectory();
}
//this function removes a dir and its subdirectories recursively from FS
async function removeDirRecursively(path) {
  try {
    if (!await isDirectory(path)) {        
      consoleDotLog(fullPath)
      await fs.promises.unlink(fullPath);
    }
    else{
      const files = await fs.promises.readdir(path);
      for (const file of files) {
        const fullPath = `${path}/${file}`;
        if (await isDirectory(fullPath)) {
          await removeDirRecursively(fullPath); // Recursively remove subdirectory contents
          await fs.promises.rmdir(fullPath); // Remove subdirectory
        } else {
          await fs.promises.unlink(fullPath); // Remove file
        }
      }
    }
  } catch (error) {
    consoleDotError(`Error while removing directory contents: ${path}`, error);
    throw error;
  }
}

async function initializeLocalBranches() {
  try {
    let remoteBranches = await listRemoteBranches();
    let localBranches = await listBranches();
    localBranches.push('HEAD');
    filteredBranches = remoteBranches.filter(item => !localBranches.includes(item));
    consoleDotLog('filteredBranches',filteredBranches)
    let path = (dir === '/') ? '' : dir
    await Promise.all(filteredBranches.map(async item => {
      await createBranch({
        ref: item,
        object: path + '/' + `.git/refs/remotes/${remote}/${item}`
      });
      await writeFile({
        filePath: path + '/' + `.git/refs/heads/${item}`,
        fileContents: await readFile({filePath: path + '/' + `.git/refs/remotes/${remote}/${item}`})
      });
    })
  );
  } catch (error) {
      consoleDotError("Error initializing local branches:", error);
      throw error; // Re-throw to allow further handling if needed
  }
}

async function clone(args) {
  try {
      cloneResult = await fetchWithServiceWorker('clone', args);
      return cloneResult;
  } catch (error) {
      consoleDotError("Some error happened while cloning:", error);
      throw error;
  }
}


//gets filePath as parameter and returns relative path to the dir
async function relativePath(filePath){
  let path = filePath.split('/').filter(path => path.trim() !== ''); 
  let removeLen = dir.split('/').filter(path => path.trim() !== '').join('').length;
  path = path.join('/');
  path = (dir === '/' ? path : path.slice(removeLen+1));
  return path;
}

//gets filePath as parameter and removes the filePath from .git and fs
async function remove(args) {
  try {
    let filePath = await relativePath(args.filePath);
    await git.remove({
      fs,
      dir, 
      filepath: filePath
    })
    await removeDirRecursively(args.filePath);
  } catch (error) {
    consoleDotError("Error while removing the file:", error);
  }
}

//gets filePath as parameter
async function unlink(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    consoleDotError("Error occured while unlinking:", error);
  }
}

//gets nothing but dir and returns log of commits
//you can change depth by using setDepth function
async function log(args) {
  try {
    consoleDotLog('Attempting to retrieve log with the following args:', { ...args, fs, depth, dir, ref });
    const logResult = await git.log({ ...args, fs, depth, dir, ref });
    consoleDotLog('git.log result:', logResult);
    return logResult;

  } catch (error) {
    consoleDotError("Error in log:", error);

    if (error && typeof error === 'object' && Object.keys(error).length > 0) {
      consoleDotError('Error properties:', Object.keys(error));
      consoleDotError('Full error object:', JSON.stringify(error, null, 2));
    } else {
      consoleDotError('An unknown error occurred, and no additional error details are available.');
    }

    throw new Error('An unknown error occurred during the log operation');
  }
}

//gets remote, url as parameters
async function push(args) {
  await setUrl(args.url);
  try {
    await databaseManager.setFs(args);
    await setDatabaseName(args?.databaseName);
    await setConfigs(args);
    try {
      await fetchWithServiceWorker('push', args);
      return {success: true}
    } catch (error) {
      throw error;
    }
  } catch (error) {
    consoleDotError('some error happend while pushing: ', error);
    await handleDeleteCloseAndReclone(args);
    return {success: false}
  }
}

//This function takes username as argument
async function setUsername(args) {
  try {
    await git.setConfig({
      fs,
      dir,
      path: 'user.name',
      value: args.username
    })
  } catch (error) {
    consoleDotError('An error occurred while setting user name:', error);
  }
}

//This function takes email as argument
async function setEmail(args) {
  try {
    await git.setConfig({
      fs,
      dir: dir,
      path: 'user.email',
      value: args.email
    })
  } catch (error) {
    consoleDotError('An error occurred while setting email:', error);
  }
}

async function getEmail() {
  try {
    const email = await git.getConfig({
      fs,
      dir,
      path: 'user.email'
    });
    consoleDotLog(email);
    return email;
  } catch (error) {
    consoleDotError('An error occurred while getting email:', error);
  }
}

// Function to get username
async function getUsername() {
  try {
    const username = await git.getConfig({
      fs,
      dir,
      path: 'user.name'
    });
    consoleDotLog(username);
    return username;
  } catch (error) {
    consoleDotError('An error occurred while getting username:', error);
  }
}

async function getRemoteUrl() {
  try {
    const remoteUrl = await git.getConfig({
      fs,
      dir,
      path: `remote.${remote}.url`
    });
    consoleDotLog(remoteUrl);
    return remoteUrl;
  } catch (error) {
    consoleDotError('An error occurred while getting remote url:', error);
  }
}

//This function takes username and email as arguments
async function setConfigs(args) {
  try {
    await setUsername(args);
    await setEmail(args);
  } catch (error) {
    consoleDotError('An error occurred while setting configs:', error);
  } 
}

//path is the path to file
//it recursively makes directories that aren't made yet
async function mkdirRecursive(path) {
  const folders = path.split('/').filter(folder => folder.trim() !== '');
  let currentPath = '';
  for (const folder of folders) {
      if (currentPath === '/'){
      currentPath += folder;
      }
      else{
        currentPath += '/' + folder;
      }
      try {
          await fs.promises.mkdir(currentPath);
      } catch (error) {
          if (error.code === 'EEXIST') {
          } else {
              consoleDotError(`Error creating directory: ${currentPath}`, error);
          }
      }
  }
}


//This function takes url, username, email
//as arguments and pulls the remote directory
async function pull(args) {
  await setUrl(args.url);
  try {
    await databaseManager.setFs(args);
    await setDatabaseName(args?.databaseName);
    await setConfigs(args);
    try {
      await fetchWithServiceWorker('pull', args); // Attempt to pull with the main branch
      return {success: true}
    } catch (error) {
      throw error;
    }
  } catch (error) {
    consoleDotError('some error happend while pulling: ', error);
    await handleDeleteCloseAndReclone(args);
    return {success: false}
  }
}

//gets url as argument
async function fastForward(args) {
  try {
    try {
      await databaseManager.setFs(args);
      await setDatabaseName(args?.databaseName);
      await fetchWithServiceWorker('fastForward', args);
      return {success: true}
    } catch (error) {
      throw error;
    }
  } catch (error) {
    consoleDotLog('This error occured while fast-forwarding: ', error);
    await handleDeleteCloseAndReclone(args);
    return {success: false}
  }
}

//gets filePath and adds the filePath to the staging area
async function addFile(args) {
  try {
    let filePath = await relativePath(args.filePath);
    await git.add({
      fs,
      dir,
      filepath: filePath
    });
  } catch (error) {
    consoleDotError('An error occurred while adding the file(s):', error);
  }
}

//gets nothings and add all changed files to staging area
async function addDot() {
  try {
    const changedFiles = await getChangedFilesList();
    consoleDotLog('changedFiles', changedFiles)
    for (let filePath in changedFiles){
      await addFile({filePath: filePath});
    }
  } catch (error) {
    consoleDotError('Error adding all changed files:', error);
  }
}

//gets filepath and filecontents as parameters
async function addFileToStaging(args) {
  try {
    await writeFile(args);
    await addFile(args);
  } catch (error) {
    consoleDotError('Error adding file to staging area:', error);
  } 
}

//gets username, email and commitMessage as parameters 
async function commit(args) {
try{
  await git.commit({
    fs,
    dir,
    author: {
      name: args.username,
      email: args.email,
    },
    message: args.commitMessage || "Commit by dnegar"
  });
}
catch (error) {
  consoleDotLog('This error occured while commiting: ', error)
}
}

//gets filePath and returns contents written in filePath
async function readFile(args) {
  try {
    return await fs.promises.readFile(args.filePath, 'utf8');
  } catch (error) {
    consoleDotError('Error reading file:', error);
    return false;
  }
}

//gets dir (default can be set using setDir) and returns an object containing filenames for key
//and paths for values
async function listFiles(filePath = dir) {
  try {
    consoleDotLog(1000);
      let path = filePath
      let files = await fs.promises.readdir(filePath);
      let result = {};

      consoleDotLog('files', files)
      for (const file of files) {
          if (path !== '/') {
            consoleDotLog('filePath',filePath)
            filePath = path + '/' + file;
          }
          else {
            consoleDotLog('filePath',filePath)
            filePath = path + file;
          }
          if (await isDirectory(filePath)) {
              result = Object.assign(await listFiles(filePath), result)
          } else {
              result[filePath] = file;
          }
    }
    consoleDotLog('result', result);
    return result;
  } catch (error) {
    consoleDotError('Error listing files:', error);
    throw error; 
  }
}
//you should pass filePath and fileContents which you want to write in the file, filePath is : /path/to/your/file
//and fileContents is a string.
async function writeFile(args) {
  try {

    await mkdirRecursive(args.filePath);
    await fs.promises.writeFile(args.filePath, args.fileContents, 'utf8');

  } catch (error) {
    consoleDotError('an error happend while writing to file:', error);
  }
}

//this function lists all changedFiles as an object including filePaths as keys and state of
//the file as values 
async function getChangedFilesList() {
  const HEAD = 1, WORKDIR = 2, STAGE = 3;
  let statusMatrix = await git.statusMatrix({ fs, dir });
  statusMatrix = statusMatrix.filter(row => row[HEAD] !== row[WORKDIR] || row[HEAD] !== row[STAGE]);
  return await statusMapper(statusMatrix);
}

//Unstaged and Uncommited files list
async function getCheckoutFilesList() {
  const HEAD = 1, WORKDIR = 2, STAGE = 3;
  let statusMatrix = await git.statusMatrix({ fs, dir });
  statusMatrix = statusMatrix.filter(row => row[WORKDIR] !== row[STAGE] || row[HEAD] !== row[STAGE]);
  return await statusMapper(statusMatrix);
}

//this function gets statusMatrix and gives back and object with filePaths and their
//corresponding status
async function statusMapper(statusMatrix) {
  const FILE = 0;
  const statusMapping = {
    "003": "added, staged, deleted unstaged",
    "020": "new, untracked",
    "022": "added, staged",
    "023": "added, staged, with unstaged changes",
    "100": "deleted, staged",
    "101": "deleted, unstaged",
    "103": "modified, staged, deleted unstaged",
    "111": "unmodified",
    "121": "modified, unstaged",
    "122": "modified, staged",
    "123": "modified, staged, with unstaged changes"
  };
  try {
    const resultObject = {};
    statusMatrix.forEach(row => {
      const file = row[FILE];
      const status = statusMapping[row.slice(1).join("")];
      if (dir !== '/'){
      resultObject[dir + '/' + file] = status;
      }
      else{
        resultObject[dir + file] = status;
      }
    }); 
    consoleDotLog(resultObject)
    return resultObject;
  } catch (error) {
    consoleDotError('Error getting changed files list:', error);
  }
}

(async () => {
  portal.set("workerThread", {
    addDot,
    addFile,
    addFileToStaging,
    addRemote,
    addToSetting,
    checkoutBranch,
    commit,
    deleteIndexedDB,
    doCloneAndStuff,
    doFetch,
    doPushAll,
    doPushFile,
    fastForward,
    getChangedFilesList,
    getDatabaseName,
    getEmail,
    getFileStoresFromDatabases,
    getLastRemoteCommit,
    getLastLocalCommit,
    getRemoteUrl,
    getUsername,
    init,
    isDirectory,
    isSync,
    listBranches,
    listFiles,
    log,
    pull,
    push,
    readFile,
    readSettingsFile,
    removeAndPush,
    setAuthParams,
    setConfigs,
    setDatabaseName,
    setDepth,
    setDir,
    setFs,
    setRef,
    setRemote,
    setSettingsAddresses,
    setUrl,
    writeFile,    
  });
})();
});