class AlertComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        const template = document.createElement('template');
        template.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: rgba(0, 0, 0, 0.8);
                    z-index: 9999;
                    font-family: 'Inter', sans-serif;
                    display: none; /* Hidden by default */
                }

                .alert-box {
                    background-color: #f8f9fa; /* Light monochrome background */
                    color: #212529; /* Dark text for contrast */
                    border-radius: 10px;
                    padding: 20px 30px;
                    max-width: 400px;
                    text-align: center;
                    box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.2);
                    animation: fadeIn 0.2s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                .alert-box h2 {
                    font-size: 1.4rem;
                    font-weight: 500;
                    margin-bottom: 10px;
                }

                .alert-box p {
                    font-size: 1rem;
                    margin-bottom: 20px;
                    color: #495057;
                }

                .buttons {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }

                button {
                    padding: 10px 20px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background-color 0.2s ease, transform 0.1s ease;
                }

                button:hover {
                    transform: translateY(-1px);
                }

                button.ok {
                    background-color: #212529;
                    color: #f8f9fa;
                }

                button.ok:hover {
                    background-color: #343a40;
                }

                button.cancel {
                    background-color: #dee2e6;
                    color: #212529;
                }

                button.cancel:hover {
                    background-color: #ced4da;
                }
            </style>
            <div class="alert-box">
                <h2 id="title">Notification</h2>
                <p id="message"></p>
                <div class="buttons">
                    <button id="ok" class="ok">بله</button>
                    <button id="cancel" class="cancel" style="display: none;">خیر</button>
                </div>
            </div>
        `;
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.titleElement = this.shadowRoot.querySelector('#title');
        this.messageElement = this.shadowRoot.querySelector('#message');
        this.okButton = this.shadowRoot.querySelector('#ok');
        this.cancelButton = this.shadowRoot.querySelector('#cancel');

        // Event Handlers
        this.okButton.addEventListener('click', () => this.handleResponse(true));
        this.cancelButton.addEventListener('click', () => this.handleResponse(false));
    }

    handleResponse(response) {
        this.style.display = 'none';
        if (this.resolve) {
            this.resolve(response);
        }
    }

    show(type, message, title = '') {
        this.messageElement.textContent = message;
        (title && title !== '') ? (this.titleElement.textContent = title) : (this.titleElement.textContent = type === 'confirm' ? 'فرم' : 'اطلاعیه');
        this.cancelButton.style.display = type === 'confirm' ? 'inline-block' : 'none';
        this.style.display = 'flex';

        if (type === 'confirm') {
            return new Promise((resolve) => {
                this.resolve = resolve;
            });
        }
    }
}

customElements.define('custom-alert', AlertComponent);
