import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

class YjsManager {
  static instances = {};

  constructor(docID, setPeers, metadata = {}, signalingServers = ['ws://localhost:4444']) {
    if (YjsManager.instances[docID]) {
      console.warn(`YjsManager instance for docID ${docID} already exists.`);
      return YjsManager.instances[docID];
    }

    this.docID = docID;
    this.setPeers = setPeers;
    this.metadata = metadata; 
    this.ydoc = new Y.Doc();

    const defaultMetadata = { id: `peer-${Math.random().toString(36).substring(2)}`, ...metadata };

    this.provider = new WebrtcProvider(`room-${docID}`, this.ydoc, {
      signaling: signalingServers,
      metadata: defaultMetadata,
    });

    this.yText = this.ydoc.getText(`text-${docID}`);
    this.peers = [];
    this.metadataMap = this.ydoc.getMap('metadata');

    this.metadataMap.set(defaultMetadata.id, defaultMetadata);

    this.provider.awareness.setLocalState(defaultMetadata);

    YjsManager.instances[docID] = this;

    this.persistence = new IndexeddbPersistence(`editor-content-${docID}`, this.ydoc);
    this.persistence.on('synced', () => {
      console.log(`IndexedDB: content loaded for docID ${docID}`);
    });

    this.provider.on('status', (event) => {
      console.log(`WebRTC status: ${event.status}`);
    });

    this.provider.on('peers', (event) => {
      this.updatePeers();
    });

    this.yText.observe(() => {
      this.updateEditorContent();
    });

    this.metadataMap.observe(() => {
      this.updatePeers();
    });
  }

  updateMetadata(newMetadata) {
    this.metadataMap.set(newMetadata.id, newMetadata);
    this.provider.awareness.setLocalState(newMetadata);
  }

  updatePeers() {
    const peerStates = this.provider.awareness.getStates();
    this.peers = Array.from(peerStates.keys()).map(peerID => {
      const peerMetadata = peerStates.get(peerID);
      const metadata = peerMetadata ? this.metadataMap.get(peerMetadata.id) || {} : {};
      return {
        id: peerID,
        metadata
      };
    });

    this.setPeers(this.peers);
  }

  updateEditorContent() {
    const content = this.getContent();
    if (this.onContentUpdateCallback) {
      this.onContentUpdateCallback(content);
    }
  }

  getEditorContentForRender() {
    const content = this.getContent();
    if (content) {
      return {
        blocks: content.split('\n').map(text => ({
          type: 'paragraph',
          data: { text },
        })),
      };
    }
    return null;
  }
  
  syncEditorContent(text) {
    this.setContent(text);
  }

  getContent() {
    return this.yText.toString();
  }

  setContent(content) {
    this.yText.delete(0, this.yText.length);
    this.yText.insert(0, content);
  }

  onContentUpdate(callback) {
    this.onContentUpdateCallback = callback;
  }

  destroy() {
    if (this.provider && this.provider.connected) {
      this.provider.disconnect();
    }
    if (this.ydoc) {
      this.ydoc.destroy();
    }
    delete YjsManager.instances[this.docID];
  }
}

export default YjsManager;
