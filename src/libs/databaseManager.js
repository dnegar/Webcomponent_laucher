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
        console.log('File system set for repo:', repoName);
        return this.currentFs;
      } catch (error) {
        console.error('Error setting FS:', error);
      }
    }
  
    async initializeStore(repoName) {
      if (!this.repoFileSystems[repoName]) {
        this.repoFileSystems[repoName] = new LightningFS(repoName, {
          fileStoreName: `fs_${repoName}`,
          wipe: false,
        });
        console.log(`Initialized file system for ${repoName}`);
      }
    }
  
    async extractRepoAddress(url) {
      const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)\/(.+)/;
      const match = url.match(regex);
      if (match) {
        let domain = match[1];
        let repoName = match[2];
        return `${domain}/${repoName}`;
      }
      return null;
    }
  
    //wipes fs
    async wipeFs({url, databaseName}) {
      try {
        const databaseName = getDatabaseName({ url, databaseName });
        consoleDotLog('wiping garbage fs ...')
        this.repoFileSystems[databaseName] = new LightningFS(databaseName, {
          fileStoreName: `fs_${databaseName}`,
          wipe: true,
        });
        consoleDotLog('Fs successfully wiped out ...')
      } catch (error) {
          console.error("Error wiping file system:", error);
          throw error; 
      }
    }
  
    async getDatabaseName({ url, databaseName }) {
      try {
        const repoName = databaseName || await this.extractRepoAddress(url);
        return repoName;
      } catch(error) {
        console.error('some error happend: ', error);
      }
    }
  }
  