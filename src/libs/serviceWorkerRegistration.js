export async function register(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('service-worker.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered:', registration);

        // If there's an already waiting worker, notify the user
        if (registration.waiting) {
          updateReady(registration.waiting);
        }

        // Listen for updates to the service worker
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          newWorker.onstatechange = () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateReady(newWorker);
            }
          };
        };
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  } else {
    console.log('Service Worker not supported');
  }

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('my-sync').then(() => {
        console.log('Sync registered');
      }).catch((error) => {
        console.error('Sync registration failed:', error);
      });
    });
  } else {
    console.log('Background Sync not supported');
  }
}

function updateReady(worker) {
  console.log('New update ready:', worker);
  // Notify the user about the update
  if (confirm("A new version is available. Would you like to update?")) {
    // If the user agrees, skip waiting and activate the new worker
    worker.postMessage({ action: 'skipWaiting' });
    
    // Reload the page to apply the new service worker
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        window.location.reload();
      }
    });
  }
}

navigator.serviceWorker.addEventListener('controllerchange', () => {
  console.log('Service Worker controller changed.');
  // Optionally refresh the page when the new SW takes control
  window.location.reload();
});

export async function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}
