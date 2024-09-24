import YjsManager from "./src/yjsManager.js";  // Correct relative path
import EditorJS from '@editorjs/editorjs';
import Paragraph from '@editorjs/paragraph';

let editorInstance = null;
let yjsManager = null;
let peersListElement = null;

const saveCursorPosition = () => {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const { startContainer, startOffset } = range;

    const blockIndex = Array.from(document.querySelectorAll('.ce-block')).findIndex(block =>
      block.contains(startContainer)
    );

    return { blockIndex, startOffset };
  }
  return null;
};

const restoreCursorPosition = (savedCursor) => {
  if (!savedCursor) return;

  const { blockIndex, startOffset } = savedCursor;
  const blocks = document.querySelectorAll('.ce-block');

  if (blocks[blockIndex]) {
    const blockText = blocks[blockIndex].querySelector('[contenteditable]');
    if (blockText && blockText.firstChild) {
      const range = document.createRange();
      const selection = window.getSelection();

      range.setStart(blockText.firstChild, startOffset);
      range.setEnd(blockText.firstChild, startOffset);

      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
};

// Function to initialize the editor and YjsManager
const initEditor = () => {
  const editorElement = document.getElementById('editor');
  if (!editorElement) {
    console.error('Editor element with ID "editor" not found!');
    return;
  }

  peersListElement = document.getElementById('peers-list'); // Ensure element is ready

  const docID = 'example-doc';  // Change this dynamically if needed
  const metadata = { username: 'User1', name: 'User One' };

  // Initialize YjsManager with docID
  yjsManager = new YjsManager(docID, updatePeers, metadata);

  const updateEditorContent = async () => {
    if (editorInstance && editorInstance.blocks) {
      const content = yjsManager.getEditorContentForRender();
      if (content && content.blocks && content.blocks.length > 0) {
        try {
          const savedCursor = saveCursorPosition();
          await editorInstance.blocks.render(content);
          restoreCursorPosition(savedCursor);
        } catch (error) {
          console.error('Error rendering content:', error);
        }
      }
    }
  };

  // Set up Editor.js instance
  editorInstance = new EditorJS({
    holder: 'editor',  // Element with id 'editor' where Editor.js will render
    autofocus: true,
    placeholder: 'Start typing...',
    tools: {
      paragraph: {
        class: Paragraph,
        inlineToolbar: true,
        config: {
          preserveBlank: true,
        },
      },
    },
    onReady: async () => {
      await updateEditorContent();
    },
    onChange: async () => {
      const output = await editorInstance.save();
      const text = output.blocks.map(block => block.data.text).join('\n');
      yjsManager.syncEditorContent(text);
    },
  });

  // Fetch content from Yjs when there are updates
  yjsManager.onContentUpdate(updateEditorContent);
};

// Update peers list in the UI
const updatePeers = (peers) => {
  if (!peersListElement) return;
  peersListElement.innerHTML = '';  // Clear current peers list
  peers.forEach(peer => {
    const li = document.createElement('li');
    li.textContent = `Peer ID: ${peer.id} - Metadata: ${JSON.stringify(peer.metadata)}`;
    peersListElement.appendChild(li);
  });
};

// Ensure the DOM is fully loaded before initializing the editor
document.addEventListener('DOMContentLoaded', () => {
  initEditor();  // Initialize the editor once the DOM is ready
});
