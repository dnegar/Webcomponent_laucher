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
["require", "MagicPortal", "LightningFS", "myGitHttp", "IsomorphicGit"],
function(require, MagicPortal, LightningFS, GitHttp, git) {

portal = new MagicPortal(this);
let dir = '/';
let username;
let password;
let ref = 'main';
let url = '';
let remote = 'origin';
let commits = [];
let depth = 10;
let repoFileSystems = {};
let fs = new LightningFS('fs');
let loggingOn = true;

function consoleLog(...parameters) {
  if (!loggingOn) return;
  console.log(...parameters)
}

this.addEventListener("message", ({ data }) => consoleLog(data));

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

async function fetchWithServiceWorker(operation, args) {
  try {
      const response = await fetch('/git', {
          method: 'POST',
          body: JSON.stringify({ operation, args }),
          headers: { 'Content-Type': 'application/json' }
      });
      consoleLog('response',response.text)

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
          consoleLog('jsonResponse',jsonResponse)
          return jsonResponse;
      } catch (jsonError) {
          console.error('Error parsing JSON response:', jsonError);
          throw new Error('Response is not valid JSON');
      }

  } catch (error) {
      console.error('Fetch error:', error);
      throw error;
  }
}

//This function sets the directory for your working directory
async function setDir(_dir) {
  dir = _dir;
  await self.setDir();
}

async function setUrl(_url) {
  url = _url;
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

//this function sets up the branch that user wants to do things on
//gets branch name as parameter
//if there are uncommited changes this function return 2 and abort
async function checkoutBranch(_ref) {

    let current = await currentBranch();
    consoleLog('current branch', current)
    consoleLog('commits', commits)
    consoleLog('ref', ref)
    consoleLog('_ref', _ref)

    let branchesList = await listBranches();
    consoleLog('branchesList', branchesList)

    if (!branchesList.includes(_ref)){
      await createBranch({ref: _ref});
    }
    if (ref === _ref || current === _ref){
      consoleLog(`you are already on the branch ${_ref}`);
      return;
    }
    else{
      let changedFiles = await getCheckoutFilesList();
      if (Object.keys(changedFiles).length === 0){
        await checkout({ref: _ref, noCheckout: false, noUpdateHead: false});
        ref = _ref;
        await doFetch({});
        consoleLog('done');
        return;
      }
      else{
        consoleLog('failed');
        return 0;
      }
    }

}

//create local branch, branch
async function createBranch(args) {
  //consoleLog('object', args.object);
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
    console.error("Error in listBranches:", error);
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

//This function gets a filePath and push it to a remote repository
//gets username, email, commitMessage, remote, url and filePath as parameters 
async function doPushFile(args) {
  try {
    await addFile(args);
    await commit(args);
    await push(args);
  }
  catch (error){
    consoleLog('Something bad happened pushing your file: ', error)
  }
}

//This function push all changed files to the remote repo
//gets username, email, commitMessage, remote, url as parameters 
async function doPushAll(args) {
  try {
    await addDot();
    await commit(args);
    await push(args);
  }
  catch (error){
    consoleLog('Something bad happened pushing your files: ', error)
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
    consoleLog('Something bad happened pushing your files: ', error)
  }
}

//this function fetches the last information for the given url
//you can change depth by using setDepth
//remote is a prerequisite for this function which is being set using clone
async function doFetch(args) {
  await setUrl(args.url);
  try {
    try {
      await fetchWithServiceWorker('fetch', args);
    } catch (error) {
      throw error;
    }
  } catch (error) {
    await handleDeleteCloseAndReclone(args);
  }
}


//isSync function checks if user's last local commit is equal to the
//last remote commit or not, gets url as arguments
//returns 1 if it is sync and 0 if it's not
async function isSync() {
  try{  
    let lastLocalCommit = commits[0];
    await doFetch({});
    let lastRemoteCommit = await readFile({filePath: dir + `/.git/refs/remotes/${remote}/${ref}`});
    if (lastRemoteCommit.trim() === lastLocalCommit.trim()){
      return 1;
    }
    else{
      return 0;
    }
  }
  catch(error){
    consoleLog(
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
    consoleLog('some error happend while adding remote: ', error)
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
    consoleLog('some error happend while deleting remote: ', error)
  }
}

//lists remotes for an fs
async function listRemotes() {
  return git.listRemotes({
    fs, 
    dir
  });
}

//wipes fs
async function wipeFs(repoName) {
  try {
    consoleLog('wiping garbage fs ...')
    repoFileSystems[repoName] = new LightningFS(repoName, {
      fileStoreName: `fs_${repoName}`,
      wipe: true,
    });
    consoleLog('Fs successfully wiped out ...')
  } catch (error) {
      console.error("Error wiping file system:", error);
      throw error; 
  }
}


//args are remote and url
async function handleNoRef(args) {
  try {
    await addRemote(args);
    let branchList = await listRemoteBranches() || [];
    consoleLog(branchList)
    if (branchList.length == 0) {
      return false;
    }
  } catch (error) {
      console.error("Error handling no ref:", error);
      throw error; 
  }
}


//gets fileContents, username, email, commitMessage as parameters
async function initRemoteRepo(args){
  try{
    let fileContents = args.fileContents ?? '';
    let filePath = ''
    if (dir === '/'){
      filePath = dir + 'README.md'
    }
    else{
      filePath = dir + '/' + 'README.md'
    }
    await wipeFs();
    await init();
    await writeFile({filePath: filePath, fileContents: fileContents});
    await addFile({filePath: filePath});
    await commit({username: args.username, email: args.email, commitMessage: args.commitMessage});
    await createBranch({ref})
    await addRemote(args)
  }
  catch(error){
  consoleLog('something went wrong while initing your remote repo: ', error)
  }
}

async function init(){
  try{
    await git.init({
      fs,
      dir
    })
  }
  catch(error){
  consoleLog('something went wrong while initing the repo: ', error)
  }
}

async function extractRepoAddress(url) {
  const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)\/(.+)/;
  const match = url.match(regex);
  if (match) {
    let domain =  match[1];
    let repoName = match[2];
    return (`${domain}/${repoName}`)
  }
  return null;
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
      consoleLog('Directory does not exist:', dir);
      return false; // Directory or file does not exist
    } else {
      console.error('Error checking directory existence:', err);
      throw err; // Some other error occurred
    }
  }
}

async function initializeStore(repoName) {
  // Initialize the file system for the repository
  repoFileSystems[repoName] = new LightningFS(repoName, {
    fileStoreName: `fs_${repoName}`,
    wipe: false, // Set to true if you want to clear the store each time
  });

  consoleLog(`Initialized file system for ${repoName}`);
}

//returns false if the repo is not initiated yet, then you can init by using initRemoteRepo()
//parameters are url, remote, ...
//you can change depth by using setDepth function
async function doCloneAndStuff(args) {
  let useNetwork = args.useNetwork  || false;
  const repoName = await extractRepoAddress(args.url);
  await setUrl(args.url);
  try {
    let handleNoRefResult = true;
    if (!repoFileSystems[repoName]) {
      await initializeStore(repoName);
    }

    fs = repoFileSystems[repoName];

    let dirExists = await checkDirExists();
    if (dirExists && !useNetwork) {
      consoleLog(`Directory ${repoName} already exists. Using existing directory...`);
      let head = await currentBranch();
      await setRef(head);
      return ({handleNoRefResult, message: 'exists'});
    } else {
      consoleLog(`Cloning repository ${repoName}...`);
      cloneResult = await clone(args);
      ref = cloneResult.data.ref;
      let head = await currentBranch();
      await setRef(head);
      consoleLog(cloneResult, head)
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
    return ({handleNoRefResult, message: 'notExist'});
  } catch (error) {
    await handleDeleteCloseAndReclone(args);
    throw error;
  }
}

async function handleDeleteCloseAndReclone(args) {
  const repoName = await extractRepoAddress(url);

  try {
    await deleteIndexedDB(repoName);

    consoleLog('Trying to reclone the repository...');
    await doCloneAndStuff({...args, url: url});
    consoleLog('Reclone successful!');

  } catch (error) {
    console.error(`Error during delete, close, and reclone process for ${repoName}:`, error);
    throw error;
  }
}

async function deleteIndexedDB(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => {
      consoleLog(`Deleted database ${dbName} successfully`);
      resolve();
    };
    request.onerror = (event) => {
      console.error(`Error deleting database ${dbName}:`, event);
      reject(event);
    };
    request.onblocked = () => {
      console.warn(`Delete database ${dbName} blocked`);
    };
  });
}

//this function removes a dir and its subdirectories recursively from FS
async function removeDirRecursively(path) {
  try {
    const stat = await fs.promises.stat(path);
    if (!stat.isDirectory()) {        
      consoleLog(fullPath)
      await fs.promises.unlink(fullPath);
    }
    else{
      const files = await fs.promises.readdir(path);
      for (const file of files) {
        const fullPath = `${path}/${file}`;
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) {
          await removeDirRecursively(fullPath); // Recursively remove subdirectory contents
          await fs.promises.rmdir(fullPath); // Remove subdirectory
        } else {
          await fs.promises.unlink(fullPath); // Remove file
        }
      }
    }
  } catch (error) {
    console.error(`Error while removing directory contents: ${path}`, error);
    throw error;
  }
}


async function updateLocalCommits() {
  try {
  const remoteCommits = await log({});
  commits = Object.values(remoteCommits).map((item) => item.oid);
  } catch(error){
    consoleLog('Some error occured while updating local commits: ', error)
  }
}

async function initializeLocalBranches() {
  try {
    await updateLocalCommits();
    let remoteBranches = await listRemoteBranches();
    let localBranches = await listBranches();
    localBranches.push('HEAD');
    filteredBranches = remoteBranches.filter(item => !localBranches.includes(item));
    consoleLog('filteredBranches',filteredBranches)
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
      console.error("Error initializing local branches:", error);
      throw error; // Re-throw to allow further handling if needed
  }
}

async function clone(args) {
  try {
      cloneResult = await fetchWithServiceWorker('clone', args);
      return cloneResult;
  } catch (error) {
      console.error("Some error happened while cloning:", error);
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
    console.error("Error while removing the file:", error);
  }
}

//gets filePath as parameter
async function unlink(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error("Error occured while unlinking:", error);
  }
}

//gets nothing but dir and returns log of commits
//you can change depth by using setDepth function
async function log(args) {
  try {
    consoleLog('Attempting to retrieve log with the following args:', { ...args, fs, depth, dir, ref });
    const logResult = await git.log({ ...args, fs, depth, dir, ref });
    consoleLog('git.log result:', logResult);
    return logResult;

  } catch (error) {
    console.error("Error in log:", error);

    if (error && typeof error === 'object' && Object.keys(error).length > 0) {
      console.error('Error properties:', Object.keys(error));
      console.error('Full error object:', JSON.stringify(error, null, 2));
    } else {
      console.error('An unknown error occurred, and no additional error details are available.');
    }

    throw new Error('An unknown error occurred during the log operation');
  }
}

//gets remote, url as parameters
async function push(args) {
  await setUrl(args.url);
  try {
    await setConfigs(args);
    try {
      await fetchWithServiceWorker('push', args); // Attempt to push with the main branch
    } catch (error) {
      throw error;
    }
  } catch (error) {
    await handleDeleteCloseAndReclone(args);
  }
}

//This function takes username as argument
async function setUsername(args) {
  try {
    await git.setConfig({
      fs,
      dir: dir,
      path: 'user.name',
      value: args.username
    })
  } catch (error) {
    console.error('An error occurred while setting user name:', error);
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
    console.error('An error occurred while setting email:', error);
  }
}

//This function takes username and email as arguments
async function setConfigs(args) {
  try {
    await setUsername(args);
    await setEmail(args);
  } catch (error) {
    console.error('An error occurred while setting configs:', error);
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
              console.error(`Error creating directory: ${currentPath}`, error);
          }
      }
  }
}

//This function takes url, username, email
//as arguments and pulls the remote directory
async function pull(args) {
  await setUrl(args.url);
  try {
    await setConfigs(args);
    try {
      await fetchWithServiceWorker('pull', args);
      await updateLocalCommits();
    } catch (error) {
      throw error;
    }
  } catch (error) {
    await handleDeleteCloseAndReclone(args);
  }
}

async function fastForward(args) {
  try {
    try {
      await fetchWithServiceWorker('fastForward', args); // Attempt fast-forward with the main branch
      await updateLocalCommits();
    } catch (error) {
      throw error;
    }
  } catch (error) {
    consoleLog('This error occured while fast-forwarding: ', error);
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
    console.error('An error occurred while adding the file(s):', error);
  }
}

//gets nothings and add all changed files to staging area
async function addDot() {
  try {
    const changedFiles = await getChangedFilesList();
    for (let filePath in changedFiles){
      await addFile({filePath: filePath});
    }
  } catch (error) {
    console.error('Error adding all changed files:', error);
  }
}



//gets username, email and commitMessage as parameters 
async function commit(args) {
try{
  commits.unshift(await git.commit({
    fs,
    dir,
    author: {
      name: args.username,
      email: args.email,
    },
    message: args.commitMessage || "Commit by dnegar"
  }));
}
catch (error) {
  consoleLog('This error occured while commiting: ', error)
}
}

//gets filePath and returns contents written in filePath
async function readFile(args) {
  try {
    return await fs.promises.readFile(args.filePath, 'utf8');
  } catch (error) {
    console.error('Error reading file:', error);
  }
}

//gets dir (default can be set using setDir) and returns an object containing filenames for key
//and paths for values
async function listFiles(filePath = dir) {
  try {
    consoleLog('dir',dir)
      let path = filePath
      let files = await fs.promises.readdir(filePath);
      let result = {};

      for (const file of files) {
          if (path !== '/') {
            consoleLog('filePath',filePath)
            filePath = path + '/' + file;
          }
          else {
            consoleLog('filePath',filePath)
            filePath = path + file;
          }
          const stat = await fs.promises.lstat(filePath);
          if (stat.isDirectory()) {
              result = Object.assign(await listFiles(filePath), result)
          } else {
              result[filePath] = file;
          }
      
    }
    return result;
  } catch (error) {
    console.error('Error listing files:', error);
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
    console.error('an error happend while writing to file:', error);
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
    consoleLog(resultObject)
    return resultObject;
  } catch (error) {
    console.error('Error getting changed files list:', error);
  }
}

(async () => {
  portal.set("workerThread", {
    setAuthParams,
    setDir,
    setRef,
    setDepth,
    setConfigs,
    setRemote,
    commit,
    addFile,
    addDot,
    doPushFile,
    doPushAll,
    removeAndPush,
    initRemoteRepo,
    doCloneAndStuff,
    listBranches,
    log,
    isSync,
    addRemote,
    push,
    pull,
    listFiles,
    readFile,
    writeFile,
    getChangedFilesList,
    checkoutBranch,
    doFetch
  });
})();
});