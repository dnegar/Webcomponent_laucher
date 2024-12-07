class LoadingSpinner extends HTMLElement {
    constructor() {
      super();
      const shadow = this.attachShadow({ mode: 'open' });
  
      // Create a loading spinner element
      const loadingDiv = document.createElement('div');
      loadingDiv.setAttribute('class', 'loading');
  
      // Append the loading spinner to the shadow DOM
      shadow.appendChild(loadingDiv);
  
      // Styles for the loading spinner
      const style = document.createElement('style');
      style.textContent = `
        /* Absolute Center Spinner */
        .loading {
          position: fixed;
          z-index: 999;
          height: 2em;
          width: 2em;
          margin: auto;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          visibility: hidden; /* Initially hidden */
        }
  
        /* Transparent Overlay */
        .loading:before {
          content: '';
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.3);
        }
  
        .loading:not(:required) {
          font: 0/0 a;
          color: transparent;
          text-shadow: none;
          background-color: transparent;
          border: 0;
        }
  
        .loading:not(:required):after {
          content: '';
          display: block;
          font-size: 10px;
          width: 1em;
          height: 1em;
          margin-top: -0.5em;
          animation: spinner 1500ms infinite linear;
          border-radius: 0.5em;
          box-shadow: rgba(0, 0, 0, 0.75) 1.5em 0 0 0, 
                      rgba(0, 0, 0, 0.75) 1.1em 1.1em 0 0, 
                      rgba(0, 0, 0, 0.75) 0 1.5em 0 0, 
                      rgba(0, 0, 0, 0.75) -1.1em 1.1em 0 0, 
                      rgba(0, 0, 0, 0.5) -1.5em 0 0 0, 
                      rgba(0, 0, 0, 0.5) -1.1em -1.1em 0 0, 
                      rgba(0, 0, 0, 0.75) 0 -1.5em 0 0, 
                      rgba(0, 0, 0, 0.75) 1.1em -1.1em 0 0;
        }
  
        @keyframes spinner {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `;
  
      // Append styles to the shadow DOM
      shadow.appendChild(style);
    }
  
    // Show the spinner
    show() {
      const loadingDiv = this.shadowRoot.querySelector('.loading');
      loadingDiv.style.visibility = 'visible';
    }
  
    // Hide the spinner
    hide() {
      const loadingDiv = this.shadowRoot.querySelector('.loading');
      loadingDiv.style.visibility = 'hidden';
    }
  }
  
  // Define the loading spinner component
  customElements.define('loading-spinner', LoadingSpinner);
  