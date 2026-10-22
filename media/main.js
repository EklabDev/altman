// Altman Webview Client Script
(function () {
  const vscode = acquireVsCodeApi();

  // App State
  let collections = [];
  let environments = [];
  let history = [];
  let settings = {};
  let activeEnvironmentName = '';

  let currentRequest = {
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    collectionName: '',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    queryParams: [],
    auth: { type: 'noauth' },
    body: { mode: 'none', raw: '', options: { raw: { language: 'json' } }, urlencoded: [] },
    preRequestScript: '',
    testScript: 'pm.test("Status code is 200", function () {\n    pm.expect(pm.response.code).to.equal(200);\n});'
  };

  let generatedCodeSnippets = {};
  let editingEnvIndex = -1;

  // DOM Elements
  const envSelect = document.getElementById('envSelect');
  const btnManageEnv = document.getElementById('btnManageEnv');
  const btnNewRequest = document.getElementById('btnNewRequest');
  const btnImportColl = document.getElementById('btnImportColl');
  const btnExportColl = document.getElementById('btnExportColl');
  const btnOpenNewman = document.getElementById('btnOpenNewman');
  const btnOpenCodeGen = document.getElementById('btnOpenCodeGen');

  const collectionsList = document.getElementById('collectionsList');
  const environmentsList = document.getElementById('environmentsList');
  const historyList = document.getElementById('historyList');

  const requestNameInput = document.getElementById('requestNameInput');
  const collectionCrumb = document.getElementById('collectionCrumb');
  const methodSelect = document.getElementById('methodSelect');
  const urlInput = document.getElementById('urlInput');
  const btnSend = document.getElementById('btnSend');
  const btnSave = document.getElementById('btnSave');

  const queryParamsBody = document.getElementById('queryParamsBody');
  const btnAddQueryParam = document.getElementById('btnAddQueryParam');
  const headersBody = document.getElementById('headersBody');
  const btnAddHeader = document.getElementById('btnAddHeader');
  const headerCountBadge = document.getElementById('headerCountBadge');

  const authTypeSelect = document.getElementById('authTypeSelect');
  const authConfigFields = document.getElementById('authConfigFields');

  const rawBodyOptions = document.getElementById('rawBodyOptions');
  const rawLanguageSelect = document.getElementById('rawLanguageSelect');
  const rawEditorContainer = document.getElementById('rawEditorContainer');
  const rawBodyTextarea = document.getElementById('rawBodyTextarea');
  const btnBeautifyBody = document.getElementById('btnBeautifyBody');
  const urlencodedContainer = document.getElementById('urlencodedContainer');
  const urlEncodedBody = document.getElementById('urlEncodedBody');
  const btnAddUrlEncoded = document.getElementById('btnAddUrlEncoded');

  const preScriptEditor = document.getElementById('preScriptEditor');
  const testScriptEditor = document.getElementById('testScriptEditor');

  const metricStatus = document.getElementById('metricStatus');
  const metricTime = document.getElementById('metricTime');
  const metricSize = document.getElementById('metricSize');
  const responseBodyViewer = document.getElementById('responseBodyViewer');
  const responseHeadersBody = document.getElementById('responseHeadersBody');
  const responseCookiesBody = document.getElementById('responseCookiesBody');
  const testResultsList = document.getElementById('testResultsList');
  const consoleLogsList = document.getElementById('consoleLogsList');
  const respHeaderBadge = document.getElementById('respHeaderBadge');
  const respCookieBadge = document.getElementById('respCookieBadge');
  const respTestsBadge = document.getElementById('respTestsBadge');
  const respLogsBadge = document.getElementById('respLogsBadge');
  const btnCopyResp = document.getElementById('btnCopyResp');

  // Modals
  const codeGenModal = document.getElementById('codeGenModal');
  const btnCloseCodeGen = document.getElementById('btnCloseCodeGen');
  const codeSnippetViewer = document.getElementById('codeSnippetViewer');
  const btnCopySnippet = document.getElementById('btnCopySnippet');

  const newmanModal = document.getElementById('newmanModal');
  const btnCloseNewman = document.getElementById('btnCloseNewman');
  const newmanCollectionSelect = document.getElementById('newmanCollectionSelect');
  const newmanEnvSelect = document.getElementById('newmanEnvSelect');
  const newmanIterations = document.getElementById('newmanIterations');
  const newmanInsecure = document.getElementById('newmanInsecure');
  const newmanBail = document.getElementById('newmanBail');
  const newmanCommandPreview = document.getElementById('newmanCommandPreview');
  const btnCopyNewman = document.getElementById('btnCopyNewman');
  const btnRunNewmanTerminal = document.getElementById('btnRunNewmanTerminal');

  const envManagerModal = document.getElementById('envManagerModal');
  const btnCloseEnvModal = document.getElementById('btnCloseEnvModal');
  const envModalTitle = document.getElementById('envModalTitle');
  const envNameInput = document.getElementById('envNameInput');
  const envVariablesBody = document.getElementById('envVariablesBody');
  const btnAddEnvVar = document.getElementById('btnAddEnvVar');
  const btnSaveEnvModal = document.getElementById('btnSaveEnvModal');
  const btnAddCollection = document.getElementById('btnAddCollection');
  const btnAddEnvironment = document.getElementById('btnAddEnvironment');
  const btnClearHistory = document.getElementById('btnClearHistory');

  // Collection Manager Modal
  const collManagerModal = document.getElementById('collManagerModal');
  const btnCloseCollModal = document.getElementById('btnCloseCollModal');
  const collModalTitle = document.getElementById('collModalTitle');
  const collNameInput = document.getElementById('collNameInput');
  const collVariablesBody = document.getElementById('collVariablesBody');
  const btnAddCollVar = document.getElementById('btnAddCollVar');
  const collPreScriptEditor = document.getElementById('collPreScriptEditor');
  const collTestScriptEditor = document.getElementById('collTestScriptEditor');
  const btnDeleteCollInModal = document.getElementById('btnDeleteCollInModal');
  const btnSaveCollModal = document.getElementById('btnSaveCollModal');

  // New Collection Modal
  const newCollModal = document.getElementById('newCollModal');
  const btnCloseNewCollModal = document.getElementById('btnCloseNewCollModal');
  const newCollNameInput = document.getElementById('newCollNameInput');
  const btnSubmitNewColl = document.getElementById('btnSubmitNewColl');

  // Confirm Dialog Modal
  const confirmDialogModal = document.getElementById('confirmDialogModal');
  const confirmDialogTitle = document.getElementById('confirmDialogTitle');
  const confirmDialogMessage = document.getElementById('confirmDialogMessage');
  const btnCloseConfirmDialog = document.getElementById('btnCloseConfirmDialog');
  const btnCancelConfirmDialog = document.getElementById('btnCancelConfirmDialog');
  const btnProceedConfirmDialog = document.getElementById('btnProceedConfirmDialog');

  // View Mode & OpenAPI Elements
  const btnViewPostman = document.getElementById('btnViewPostman');
  const btnViewOpenApi = document.getElementById('btnViewOpenApi');
  const postmanWorkbenchView = document.getElementById('postmanWorkbenchView');
  const openApiWorkbenchView = document.getElementById('openApiWorkbenchView');
  const openApiCollSelect = document.getElementById('openApiCollSelect');
  const btnRefreshOpenApi = document.getElementById('btnRefreshOpenApi');
  const btnCopyOpenApi = document.getElementById('btnCopyOpenApi');
  const btnExportOpenApi = document.getElementById('btnExportOpenApi');
  const openApiYamlViewer = document.getElementById('openApiYamlViewer');

  // Initialization
  function init() {
    setupEventListeners();
    vscode.postMessage({ type: 'getInitialData' });
  }

  function setupEventListeners() {
    // View Mode Toggle
    btnViewPostman.addEventListener('click', () => {
      btnViewPostman.classList.add('active');
      btnViewOpenApi.classList.remove('active');
      postmanWorkbenchView.classList.remove('hidden');
      openApiWorkbenchView.classList.add('hidden');
    });

    btnViewOpenApi.addEventListener('click', () => {
      btnViewOpenApi.classList.add('active');
      btnViewPostman.classList.remove('active');
      postmanWorkbenchView.classList.add('hidden');
      openApiWorkbenchView.classList.remove('hidden');
      populateOpenApiCollSelect();
      fetchOpenApiYaml();
    });

    openApiCollSelect.addEventListener('change', () => {
      fetchOpenApiYaml();
    });

    btnRefreshOpenApi.addEventListener('click', () => {
      fetchOpenApiYaml();
    });

    btnCopyOpenApi.addEventListener('click', () => {
      navigator.clipboard.writeText(openApiYamlViewer.innerText);
      btnCopyOpenApi.textContent = '✓ Copied!';
      setTimeout(() => { btnCopyOpenApi.textContent = '📋 Copy YAML'; }, 1500);
    });

    btnExportOpenApi.addEventListener('click', () => {
      const selectedColl = openApiCollSelect.value || currentRequest.collectionName;
      vscode.postMessage({
        type: 'exportOpenApiYaml',
        collectionName: selectedColl
      });
    });

    // Top bar
    envSelect.addEventListener('change', () => {
      activeEnvironmentName = envSelect.value;
      vscode.postMessage({ type: 'setActiveEnvironment', name: activeEnvironmentName });
    });

    btnManageEnv.addEventListener('click', openAddEnvironmentModal);
    btnAddEnvironment.addEventListener('click', openAddEnvironmentModal);

    btnNewRequest.addEventListener('click', () => {
      resetRequestWorkbench();
    });

    btnImportColl.addEventListener('click', () => {
      vscode.postMessage({ type: 'importCollectionFile' });
    });

    btnExportColl.addEventListener('click', () => {
      if (!currentRequest.collectionName && collections.length > 0) {
        vscode.postMessage({ type: 'exportCollectionFile', collectionName: collections[0].info.name });
      } else if (currentRequest.collectionName) {
        vscode.postMessage({ type: 'exportCollectionFile', collectionName: currentRequest.collectionName });
      }
    });

    btnAddCollection.addEventListener('click', () => {
      openNewCollectionModal();
    });

    btnClearHistory.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearHistory' });
    });

    // Sidebar Tab Switching
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.getAttribute('data-tab'));
        if (target) target.classList.add('active');
      });
    });

    // Request Workbench Tab Switching
    document.querySelectorAll('.req-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.req-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.req-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.getAttribute('data-panel'));
        if (target) target.classList.add('active');
      });
    });

    // Response Tab Switching
    document.querySelectorAll('.resp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.resp-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.resp-subpanel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.getAttribute('data-resp-panel'));
        if (target) target.classList.add('active');
      });
    });

    // URL change updates query params
    urlInput.addEventListener('input', () => {
      syncUrlToQueryParams();
    });

    // Send button
    btnSend.addEventListener('click', executeActiveRequest);

    // Save button
    btnSave.addEventListener('click', saveActiveRequest);

    // Params Table Add
    btnAddQueryParam.addEventListener('click', () => {
      currentRequest.queryParams.push({ key: '', value: '', description: '', enabled: true });
      renderQueryParamsTable();
    });

    // Headers Table Add
    btnAddHeader.addEventListener('click', () => {
      currentRequest.headers.push({ key: '', value: '', description: '', enabled: true });
      renderHeadersTable();
    });

    // Auth selector
    authTypeSelect.addEventListener('change', () => {
      currentRequest.auth.type = authTypeSelect.value;
      renderAuthConfigFields();
    });

    // Body mode radio
    document.querySelectorAll('input[name="bodyMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        currentRequest.body.mode = mode;
        updateBodyUI();
      });
    });

    rawLanguageSelect.addEventListener('change', (e) => {
      if (!currentRequest.body.options) currentRequest.body.options = {};
      if (!currentRequest.body.options.raw) currentRequest.body.options.raw = {};
      currentRequest.body.options.raw.language = e.target.value;
    });

    btnBeautifyBody.addEventListener('click', () => {
      try {
        const val = rawBodyTextarea.value;
        const formatted = JSON.stringify(JSON.parse(val), null, 2);
        rawBodyTextarea.value = formatted;
        currentRequest.body.raw = formatted;
      } catch (e) {
        alert('Invalid JSON body');
      }
    });

    btnAddUrlEncoded.addEventListener('click', () => {
      if (!Array.isArray(currentRequest.body.urlencoded)) currentRequest.body.urlencoded = [];
      currentRequest.body.urlencoded.push({ key: '', value: '', enabled: true });
      renderUrlEncodedTable();
    });

    btnCopyResp.addEventListener('click', () => {
      navigator.clipboard.writeText(responseBodyViewer.innerText);
    });

    // Code Gen Modal
    btnOpenCodeGen.addEventListener('click', () => {
      syncWorkbenchToRequestState();
      const headersMap = {};
      for (const h of currentRequest.headers) {
        if (h.enabled && h.key) headersMap[h.key] = h.value;
      }
      vscode.postMessage({
        type: 'generateCode',
        request: {
          url: currentRequest.url || 'https://api.example.com',
          method: currentRequest.method,
          headers: headersMap,
          body: currentRequest.body.raw,
          contentType: currentRequest.body.mode === 'raw' ? 'application/json' : undefined
        }
      });
      codeGenModal.classList.remove('hidden');
    });

    btnCloseCodeGen.addEventListener('click', () => codeGenModal.classList.add('hidden'));

    document.querySelectorAll('.code-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const lang = tab.getAttribute('data-lang');
        codeSnippetViewer.innerText = generatedCodeSnippets[lang] || '';
      });
    });

    btnCopySnippet.addEventListener('click', () => {
      navigator.clipboard.writeText(codeSnippetViewer.innerText);
    });

    // Newman Modal
    btnOpenNewman.addEventListener('click', () => {
      populateNewmanModal();
      newmanModal.classList.remove('hidden');
    });
    btnCloseNewman.addEventListener('click', () => newmanModal.classList.add('hidden'));

    newmanCollectionSelect.addEventListener('change', updateNewmanPreview);
    newmanEnvSelect.addEventListener('change', updateNewmanPreview);
    newmanIterations.addEventListener('input', updateNewmanPreview);
    newmanInsecure.addEventListener('change', updateNewmanPreview);
    newmanBail.addEventListener('change', updateNewmanPreview);

    btnCopyNewman.addEventListener('click', () => {
      navigator.clipboard.writeText(newmanCommandPreview.value);
    });

    btnRunNewmanTerminal.addEventListener('click', () => {
      runNewman(true);
      newmanModal.classList.add('hidden');
    });

    // Environment Modal
    btnCloseEnvModal.addEventListener('click', () => envManagerModal.classList.add('hidden'));
    btnAddEnvVar.addEventListener('click', () => {
      addEnvVarRow('', '', true);
    });
    btnSaveEnvModal.addEventListener('click', saveEnvironmentModal);

    // Collection Manager Modal
    btnCloseCollModal.addEventListener('click', () => collManagerModal.classList.add('hidden'));
    btnAddCollVar.addEventListener('click', () => addCollVarRow('', '', '', true));
    btnSaveCollModal.addEventListener('click', saveCollectionModal);
    btnDeleteCollInModal.addEventListener('click', () => {
      showConfirmDialog('Delete Collection', `Are you sure you want to delete collection "${editingCollOriginalName}"?`, () => {
        vscode.postMessage({ type: 'deleteCollection', name: editingCollOriginalName });
        collManagerModal.classList.add('hidden');
        if (currentRequest.collectionName === editingCollOriginalName) {
          resetRequestWorkbench();
        }
      });
    });

    document.querySelectorAll('[data-coll-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-coll-tab]').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.coll-modal-tab-content').forEach(c => c.classList.add('hidden'));
        tab.classList.add('active');
        const target = document.getElementById(tab.getAttribute('data-coll-tab'));
        if (target) target.classList.remove('hidden');
      });
    });

    // New Collection Modal
    btnCloseNewCollModal.addEventListener('click', closeNewCollectionModal);
    btnSubmitNewColl.addEventListener('click', submitNewCollection);
    newCollNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitNewCollection();
      }
    });

    // Confirm Dialog Modal
    btnCloseConfirmDialog.addEventListener('click', closeConfirmDialog);
    btnCancelConfirmDialog.addEventListener('click', closeConfirmDialog);
    btnProceedConfirmDialog.addEventListener('click', () => {
      if (confirmActionCallback) {
        confirmActionCallback();
      }
      closeConfirmDialog();
    });
  }

  // Handle incoming messages from extension host
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'initialDataLoaded':
        collections = message.data.collections || [];
        environments = message.data.environments || [];
        history = message.data.history || [];
        settings = message.data.settings || {};
        activeEnvironmentName = message.data.activeEnvironmentName || '';

        renderEnvironmentDropdown();
        renderCollectionsTree();
        renderEnvironmentsTree();
        renderHistoryTree();
        renderWorkbenchFromState();
        break;

      case 'collectionsUpdated':
        collections = message.collections || [];
        renderCollectionsTree();
        populateOpenApiCollSelect();
        break;

      case 'environmentsUpdated':
        environments = message.environments || [];
        renderEnvironmentDropdown();
        renderEnvironmentsTree();
        break;

      case 'requestExecuted':
        handleRequestExecuted(message.response, message.history);
        break;

      case 'codeGenerated':
        generatedCodeSnippets = message.code;
        const activeTab = document.querySelector('.code-tab.active');
        const lang = activeTab ? activeTab.getAttribute('data-lang') : 'curl';
        codeSnippetViewer.innerText = generatedCodeSnippets[lang] || '';
        break;

      case 'newmanCommandComposed':
        newmanCommandPreview.value = message.command;
        break;

      case 'historyCleared':
        history = [];
        renderHistoryTree();
        break;

      case 'openApiYamlGenerated':
        openApiYamlViewer.innerText = message.yaml || '# (Empty specification)';
        if (message.spec) {
          renderSwaggerUi(message.spec);
        }
        break;

      case 'loadSpecificRequest':
        // Ensure we are in Postman view
        btnViewPostman.classList.add('active');
        btnViewOpenApi.classList.remove('active');
        postmanWorkbenchView.classList.remove('hidden');
        openApiWorkbenchView.classList.add('hidden');

        const foundColl = collections.find(c => c.info.name === message.collectionName);
        if (foundColl) {
          const reqItem = findItemRecursive(foundColl.item || [], message.requestName);
          if (reqItem) {
            loadRequestIntoWorkbench(reqItem, message.collectionName);
          }
        }
        break;
    }
  });

  function findItemRecursive(items, name) {
    for (const it of items) {
      if (it.name === name && it.request) return it;
      if (Array.isArray(it.item)) {
        const found = findItemRecursive(it.item, name);
        if (found) return found;
      }
    }
    return undefined;
  }

  function populateOpenApiCollSelect() {
    openApiCollSelect.innerHTML = '';
    for (const c of collections) {
      const opt = document.createElement('option');
      opt.value = c.info.name;
      opt.textContent = c.info.name;
      if (c.info.name === currentRequest.collectionName) opt.selected = true;
      openApiCollSelect.appendChild(opt);
    }
    if (collections.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(No collections)';
      openApiCollSelect.appendChild(opt);
    }
  }

  function fetchOpenApiYaml() {
    const collName = openApiCollSelect.value || currentRequest.collectionName;
    openApiYamlViewer.innerText = 'Generating OpenAPI 3.0.3 YAML from Postman collection...';
    vscode.postMessage({
      type: 'generateOpenApiYaml',
      collectionName: collName
    });
  }

  let swaggerUiInstance = null;

  function renderSwaggerUi(specObj) {
    const container = document.getElementById('swaggerUiContainer');
    if (!container) return;

    if (typeof SwaggerUIBundle !== 'undefined') {
      try {
        container.innerHTML = '';
        swaggerUiInstance = SwaggerUIBundle({
          dom_id: '#swaggerUiContainer',
          spec: specObj,
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            typeof SwaggerUIStandalonePreset !== 'undefined' ? SwaggerUIStandalonePreset : undefined
          ].filter(Boolean),
          layout: "BaseLayout",
          docExpansion: "list",
          defaultModelsExpandDepth: 1
        });
      } catch (err) {
        console.error('Swagger UI render error:', err);
        container.innerHTML = '<div style="color:red; padding: 10px;">Failed to render Swagger UI: ' + escapeHtml(err.message) + '</div>';
      }
    } else {
      container.innerHTML = '<div class="placeholder-text">Swagger UI offline library loading...</div>';
    }
  }

  // Renderers
  function renderEnvironmentDropdown() {
    envSelect.innerHTML = '<option value="">No Environment</option>';
    for (const env of environments) {
      const opt = document.createElement('option');
      opt.value = env.name;
      opt.textContent = env.name;
      if (env.name === activeEnvironmentName) {
        opt.selected = true;
      }
      envSelect.appendChild(opt);
    }
  }

  function renderCollectionsTree() {
    collectionsList.innerHTML = '';
    if (collections.length === 0) {
      collectionsList.innerHTML = '<div class="placeholder-text">No collections in .altman/collections. Click Import or + Collection.</div>';
      return;
    }

    for (const coll of collections) {
      const collItem = document.createElement('div');
      collItem.className = 'tree-node tree-folder';
      collItem.innerHTML = `
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📁 ${escapeHtml(coll.info.name)}</span>
        <button class="btn btn-xs btn-outline btn-add-req-to-coll" title="Add Request to Collection">+</button>
        <button class="btn btn-xs btn-outline btn-edit-coll" title="Collection Settings (Variables & Scripts)">⚙️</button>
        <button class="btn-danger-text btn-del-coll" title="Delete Collection">&times;</button>
      `;

      collItem.querySelector('.btn-add-req-to-coll').addEventListener('click', (e) => {
        e.stopPropagation();
        addRequestToCollection(coll.info.name);
      });

      collItem.querySelector('.btn-edit-coll').addEventListener('click', (e) => {
        e.stopPropagation();
        openCollectionManagerModal(coll.info.name);
      });

      collItem.querySelector('.btn-del-coll').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmDialog('Delete Collection', `Are you sure you want to delete collection "${coll.info.name}"?`, () => {
          vscode.postMessage({ type: 'deleteCollection', name: coll.info.name });
        });
      });

      collectionsList.appendChild(collItem);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'folder-items';

      renderCollectionItems(coll.item || [], itemsContainer, coll.info.name);
      collectionsList.appendChild(itemsContainer);
    }
  }

  function renderCollectionItems(items, container, collName) {
    for (const item of items) {
      if (Array.isArray(item.item)) {
        // Nested Folder
        const folderNode = document.createElement('div');
        folderNode.className = 'tree-node tree-folder';
        folderNode.innerHTML = `<span>📂 ${escapeHtml(item.name)}</span>`;
        container.appendChild(folderNode);

        const subContainer = document.createElement('div');
        subContainer.className = 'folder-items';
        renderCollectionItems(item.item, subContainer, collName);
        container.appendChild(subContainer);
      } else {
        // Request Item
        const reqNode = document.createElement('div');
        reqNode.className = 'tree-node';
        const method = item.request?.method || 'GET';
        reqNode.innerHTML = `
          <span class="badge-method ${method}">${method}</span>
          <span class="tree-item-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
          <button class="btn-danger-text btn-del-req" title="Delete Request">&times;</button>
        `;
        reqNode.addEventListener('click', () => {
          loadRequestIntoWorkbench(item, collName);
        });
        reqNode.querySelector('.btn-del-req').addEventListener('click', (e) => {
          e.stopPropagation();
          showConfirmDialog('Delete Request', `Are you sure you want to delete request "${item.name}" from collection "${collName}"?`, () => {
            deleteRequestFromCollection(collName, item.name);
          });
        });
        container.appendChild(reqNode);
      }
    }
  }

  function renderEnvironmentsTree() {
    environmentsList.innerHTML = '';
    if (environments.length === 0) {
      environmentsList.innerHTML = '<div class="placeholder-text">No environments saved. Click + Environment.</div>';
      return;
    }

    for (let i = 0; i < environments.length; i++) {
      const env = environments[i];
      const node = document.createElement('div');
      node.className = 'tree-node';
      node.innerHTML = `
        <span style="flex:1;">🌐 ${escapeHtml(env.name)} (${env.values ? env.values.length : 0} vars)</span>
        <button class="btn btn-xs btn-outline btn-edit-env" title="Edit">✏️</button>
        <button class="btn-danger-text btn-del-env" title="Delete">&times;</button>
      `;

      node.querySelector('.btn-edit-env').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditEnvironmentModal(i);
      });

      node.querySelector('.btn-del-env').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmDialog('Delete Environment', `Are you sure you want to delete environment "${env.name}"?`, () => {
          vscode.postMessage({ type: 'deleteEnvironment', name: env.name });
          if (activeEnvironmentName === env.name) {
            activeEnvironmentName = '';
            envSelect.value = '';
            vscode.postMessage({ type: 'setActiveEnvironment', name: '' });
          }
        });
      });

      node.addEventListener('click', () => {
        activeEnvironmentName = env.name;
        envSelect.value = env.name;
        vscode.postMessage({ type: 'setActiveEnvironment', name: env.name });
      });

      environmentsList.appendChild(node);
    }
  }

  function renderHistoryTree() {
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = '<div class="placeholder-text">No requests run yet.</div>';
      return;
    }

    for (const h of history) {
      const node = document.createElement('div');
      node.className = 'tree-node';
      const statusClass = h.statusCode >= 200 && h.statusCode < 300 ? 'badge-get' : 'badge-delete';
      node.innerHTML = `
        <span class="badge-method ${h.method}">${h.method}</span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(h.url)}">${escapeHtml(h.url)}</span>
        <span style="font-size:10px; color: var(--${statusClass});">${h.statusCode}</span>
      `;
      node.addEventListener('click', () => {
        currentRequest.method = h.method;
        currentRequest.url = h.url;
        currentRequest.name = h.requestName || h.url;
        renderWorkbenchFromState();
      });
      historyList.appendChild(node);
    }
  }

  function loadRequestIntoWorkbench(item, collName) {
    currentRequest.name = item.name || 'Untitled Request';
    currentRequest.originalName = item.name || '';
    currentRequest.collectionName = collName;
    currentRequest.method = item.request?.method || 'GET';
    const rawUrl = typeof item.request?.url === 'string' ? item.request.url : item.request?.url?.raw || '';
    currentRequest.url = rawUrl;

    currentRequest.headers = (item.request?.header || []).map(h => ({
      key: h.key || '',
      value: h.value || '',
      description: h.description || '',
      enabled: !h.disabled
    }));

    currentRequest.auth = item.request?.auth || { type: 'noauth' };
    currentRequest.body = item.request?.body || { mode: 'none', raw: '' };

    // Scripts
    currentRequest.preRequestScript = '';
    currentRequest.testScript = '';
    for (const ev of item.event || []) {
      const scriptCode = Array.isArray(ev.script?.exec) ? ev.script.exec.join('\n') : (ev.script?.exec || '');
      if (ev.listen === 'prerequest') {
        currentRequest.preRequestScript = scriptCode;
      } else if (ev.listen === 'test') {
        currentRequest.testScript = scriptCode;
      }
    }

    renderWorkbenchFromState();
    syncUrlToQueryParams();
  }

  function resetRequestWorkbench() {
    currentRequest = {
      name: 'Untitled Request',
      originalName: '',
      method: 'GET',
      url: '',
      collectionName: '',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      queryParams: [],
      auth: { type: 'noauth' },
      body: { mode: 'none', raw: '', options: { raw: { language: 'json' } }, urlencoded: [] },
      preRequestScript: '',
      testScript: 'pm.test("Status code is 200", function () {\n    pm.expect(pm.response.code).to.equal(200);\n});'
    };
    renderWorkbenchFromState();
  }

  function renderWorkbenchFromState() {
    requestNameInput.value = currentRequest.name;
    collectionCrumb.textContent = currentRequest.collectionName ? `📁 ${currentRequest.collectionName}` : 'No Collection';
    methodSelect.value = currentRequest.method;
    urlInput.value = currentRequest.url;

    renderHeadersTable();
    renderQueryParamsTable();
    authTypeSelect.value = currentRequest.auth?.type || 'noauth';
    renderAuthConfigFields();

    // Body
    const mode = currentRequest.body?.mode || 'none';
    const radio = document.querySelector(`input[name="bodyMode"][value="${mode}"]`);
    if (radio) radio.checked = true;
    updateBodyUI();

    rawBodyTextarea.value = currentRequest.body?.raw || '';
    if (currentRequest.body?.options?.raw?.language) {
      rawLanguageSelect.value = currentRequest.body.options.raw.language;
    }

    renderUrlEncodedTable();

    // Scripts
    preScriptEditor.value = currentRequest.preRequestScript || '';
    testScriptEditor.value = currentRequest.testScript || '';
  }

  function syncWorkbenchToRequestState() {
    currentRequest.name = requestNameInput.value;
    currentRequest.method = methodSelect.value;
    currentRequest.url = urlInput.value;
    currentRequest.preRequestScript = preScriptEditor.value;
    currentRequest.testScript = testScriptEditor.value;
    currentRequest.body.raw = rawBodyTextarea.value;
  }

  function updateBodyUI() {
    const mode = currentRequest.body.mode;
    if (mode === 'raw') {
      rawBodyOptions.classList.remove('hidden');
      rawEditorContainer.classList.remove('hidden');
      urlencodedContainer.classList.add('hidden');
    } else if (mode === 'urlencoded') {
      rawBodyOptions.classList.add('hidden');
      rawEditorContainer.classList.add('hidden');
      urlencodedContainer.classList.remove('hidden');
    } else {
      rawBodyOptions.classList.add('hidden');
      rawEditorContainer.classList.add('hidden');
      urlencodedContainer.classList.add('hidden');
    }
  }

  function renderHeadersTable() {
    headersBody.innerHTML = '';
    headerCountBadge.textContent = currentRequest.headers.filter(h => h.enabled && h.key).length;

    currentRequest.headers.forEach((h, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" ${h.enabled ? 'checked' : ''} class="h-enabled"></td>
        <td><input type="text" value="${escapeHtml(h.key)}" placeholder="Key" class="h-key"></td>
        <td><input type="text" value="${escapeHtml(h.value)}" placeholder="Value" class="h-val"></td>
        <td><input type="text" value="${escapeHtml(h.description || '')}" placeholder="Description" class="h-desc"></td>
        <td><button class="btn-danger-text btn-del-header">&times;</button></td>
      `;

      tr.querySelector('.h-enabled').addEventListener('change', (e) => {
        h.enabled = e.target.checked;
        headerCountBadge.textContent = currentRequest.headers.filter(x => x.enabled && x.key).length;
      });
      tr.querySelector('.h-key').addEventListener('input', (e) => {
        h.key = e.target.value;
        headerCountBadge.textContent = currentRequest.headers.filter(x => x.enabled && x.key).length;
      });
      tr.querySelector('.h-val').addEventListener('input', (e) => { h.value = e.target.value; });
      tr.querySelector('.h-desc').addEventListener('input', (e) => { h.description = e.target.value; });
      tr.querySelector('.btn-del-header').addEventListener('click', () => {
        currentRequest.headers.splice(idx, 1);
        renderHeadersTable();
      });

      headersBody.appendChild(tr);
    });
  }

  function syncUrlToQueryParams() {
    try {
      const u = urlInput.value;
      const qIdx = u.indexOf('?');
      if (qIdx >= 0) {
        const search = u.substring(qIdx + 1);
        const params = new URLSearchParams(search);
        currentRequest.queryParams = [];
        params.forEach((val, key) => {
          currentRequest.queryParams.push({ key, value: val, enabled: true });
        });
        renderQueryParamsTable();
      }
    } catch (e) {}
  }

  function syncQueryParamsToUrl() {
    const u = urlInput.value;
    const base = u.split('?')[0];
    const params = new URLSearchParams();
    for (const q of currentRequest.queryParams) {
      if (q.enabled && q.key) {
        params.append(q.key, q.value);
      }
    }
    const queryString = params.toString();
    urlInput.value = queryString ? `${base}?${queryString}` : base;
  }

  function renderQueryParamsTable() {
    queryParamsBody.innerHTML = '';
    currentRequest.queryParams.forEach((q, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" ${q.enabled ? 'checked' : ''} class="q-enabled"></td>
        <td><input type="text" value="${escapeHtml(q.key)}" placeholder="Key" class="q-key"></td>
        <td><input type="text" value="${escapeHtml(q.value)}" placeholder="Value" class="q-val"></td>
        <td><input type="text" value="${escapeHtml(q.description || '')}" placeholder="Description" class="q-desc"></td>
        <td><button class="btn-danger-text btn-del-query">&times;</button></td>
      `;

      tr.querySelector('.q-enabled').addEventListener('change', (e) => {
        q.enabled = e.target.checked;
        syncQueryParamsToUrl();
      });
      tr.querySelector('.q-key').addEventListener('input', (e) => {
        q.key = e.target.value;
        syncQueryParamsToUrl();
      });
      tr.querySelector('.q-val').addEventListener('input', (e) => {
        q.value = e.target.value;
        syncQueryParamsToUrl();
      });
      tr.querySelector('.btn-del-query').addEventListener('click', () => {
        currentRequest.queryParams.splice(idx, 1);
        renderQueryParamsTable();
        syncQueryParamsToUrl();
      });

      queryParamsBody.appendChild(tr);
    });
  }

  function renderAuthConfigFields() {
    authConfigFields.innerHTML = '';
    const type = currentRequest.auth?.type || 'noauth';

    if (type === 'bearer') {
      const token = currentRequest.auth.bearer?.find(b => b.key === 'token')?.value || '';
      authConfigFields.innerHTML = `
        <div class="form-row">
          <label>Token:</label>
          <input type="text" class="altman-input" style="flex:1;" id="bearerTokenInput" value="${escapeHtml(token)}" placeholder="{{token}}" />
        </div>
      `;
      document.getElementById('bearerTokenInput').addEventListener('input', (e) => {
        currentRequest.auth.bearer = [{ key: 'token', value: e.target.value, type: 'string' }];
      });
    } else if (type === 'basic') {
      const user = currentRequest.auth.basic?.find(b => b.key === 'username')?.value || '';
      const pass = currentRequest.auth.basic?.find(b => b.key === 'password')?.value || '';
      authConfigFields.innerHTML = `
        <div class="form-row">
          <label>Username:</label>
          <input type="text" class="altman-input" style="flex:1;" id="basicUserInput" value="${escapeHtml(user)}" />
        </div>
        <div class="form-row">
          <label>Password:</label>
          <input type="password" class="altman-input" style="flex:1;" id="basicPassInput" value="${escapeHtml(pass)}" />
        </div>
      `;
      document.getElementById('basicUserInput').addEventListener('input', (e) => {
        updateBasicAuth(e.target.value, pass);
      });
      document.getElementById('basicPassInput').addEventListener('input', (e) => {
        updateBasicAuth(user, e.target.value);
      });
    } else if (type === 'apikey') {
      const key = currentRequest.auth.apikey?.find(k => k.key === 'key')?.value || '';
      const val = currentRequest.auth.apikey?.find(k => k.key === 'value')?.value || '';
      authConfigFields.innerHTML = `
        <div class="form-row">
          <label>Key:</label>
          <input type="text" class="altman-input" style="flex:1;" id="apiKeyName" value="${escapeHtml(key)}" />
        </div>
        <div class="form-row">
          <label>Value:</label>
          <input type="text" class="altman-input" style="flex:1;" id="apiKeyValue" value="${escapeHtml(val)}" />
        </div>
      `;
      document.getElementById('apiKeyName').addEventListener('input', (e) => {
        updateApiKey(e.target.value, val);
      });
      document.getElementById('apiKeyValue').addEventListener('input', (e) => {
        updateApiKey(key, e.target.value);
      });
    }
  }

  function updateBasicAuth(u, p) {
    currentRequest.auth.basic = [
      { key: 'username', value: u, type: 'string' },
      { key: 'password', value: p, type: 'string' }
    ];
  }

  function updateApiKey(k, v) {
    currentRequest.auth.apikey = [
      { key: 'key', value: k, type: 'string' },
      { key: 'value', value: v, type: 'string' },
      { key: 'in', value: 'header', type: 'string' }
    ];
  }

  function renderUrlEncodedTable() {
    urlEncodedBody.innerHTML = '';
    const list = currentRequest.body.urlencoded || [];
    list.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" ${item.enabled !== false ? 'checked' : ''} class="u-enabled"></td>
        <td><input type="text" value="${escapeHtml(item.key)}" placeholder="Key" class="u-key"></td>
        <td><input type="text" value="${escapeHtml(item.value)}" placeholder="Value" class="u-val"></td>
        <td><button class="btn-danger-text btn-del-urlencoded">&times;</button></td>
      `;
      tr.querySelector('.u-enabled').addEventListener('change', (e) => { item.enabled = e.target.checked; });
      tr.querySelector('.u-key').addEventListener('input', (e) => { item.key = e.target.value; });
      tr.querySelector('.u-val').addEventListener('input', (e) => { item.value = e.target.value; });
      tr.querySelector('.btn-del-urlencoded').addEventListener('click', () => {
        list.splice(idx, 1);
        renderUrlEncodedTable();
      });
      urlEncodedBody.appendChild(tr);
    });
  }

  // Execution
  function executeActiveRequest() {
    syncWorkbenchToRequestState();

    btnSend.textContent = 'Sending...';
    btnSend.disabled = true;

    metricStatus.textContent = 'Status: Sending...';
    metricStatus.className = 'metric-pill';

    const headersToSend = currentRequest.headers.map(h => ({
      key: h.key,
      value: h.value,
      disabled: !h.enabled
    }));

    vscode.postMessage({
      type: 'executeRequest',
      payload: {
        request: {
          method: currentRequest.method,
          url: currentRequest.url,
          headers: headersToSend,
          auth: currentRequest.auth,
          body: currentRequest.body,
          preRequestScript: currentRequest.preRequestScript,
          testScript: currentRequest.testScript,
          collectionName: currentRequest.collectionName,
          requestName: currentRequest.name
        },
        activeEnvironmentName: activeEnvironmentName
      }
    });
  }

  function handleRequestExecuted(resp, updatedHistory) {
    btnSend.textContent = 'Send';
    btnSend.disabled = false;

    if (updatedHistory) {
      history = updatedHistory;
      renderHistoryTree();
    }

    // Update Status Pill
    const isSuccess = resp.statusCode >= 200 && resp.statusCode < 300;
    metricStatus.textContent = `Status: ${resp.statusCode} ${resp.statusText}`;
    metricStatus.className = `metric-pill ${isSuccess ? 'success' : 'error'}`;

    metricTime.textContent = `Time: ${resp.timeMs} ms`;
    metricSize.textContent = `Size: ${formatBytes(resp.sizeBytes)}`;

    // Body
    if (resp.isJson) {
      try {
        responseBodyViewer.innerText = JSON.stringify(JSON.parse(resp.body), null, 2);
      } catch (e) {
        responseBodyViewer.innerText = resp.body;
      }
    } else {
      responseBodyViewer.innerText = resp.body || '(empty response)';
    }

    // Headers
    responseHeadersBody.innerHTML = '';
    const headerEntries = Object.entries(resp.headers || {});
    respHeaderBadge.textContent = headerEntries.length;
    for (const [k, v] of headerEntries) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(String(v))}</td>`;
      responseHeadersBody.appendChild(tr);
    }

    // Cookies
    responseCookiesBody.innerHTML = '';
    respCookieBadge.textContent = (resp.cookies || []).length;
    for (const c of resp.cookies || []) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${escapeHtml(c.name)}</b></td><td>${escapeHtml(c.value)}</td>`;
      responseCookiesBody.appendChild(tr);
    }

    // Tests
    testResultsList.innerHTML = '';
    const tests = resp.testResults || [];
    const passedCount = tests.filter(t => t.passed).length;
    respTestsBadge.textContent = `${passedCount}/${tests.length}`;

    if (tests.length === 0) {
      testResultsList.innerHTML = '<div class="placeholder-text">No tests found in response.</div>';
    } else {
      for (const t of tests) {
        const item = document.createElement('div');
        item.className = `test-item ${t.passed ? 'passed' : 'failed'}`;
        item.innerHTML = `
          <span>${t.passed ? 'PASS ✓' : 'FAIL ✗'}</span>
          <span>${escapeHtml(t.name)}</span>
          ${t.error ? `<div style="font-size:11px; margin-top:2px;">${escapeHtml(t.error)}</div>` : ''}
        `;
        testResultsList.appendChild(item);
      }
    }

    // Logs
    consoleLogsList.innerHTML = '';
    const logs = resp.logs || [];
    respLogsBadge.textContent = logs.length;
    if (logs.length === 0) {
      consoleLogsList.innerHTML = '<div class="placeholder-text">No console logs output by scripts.</div>';
    } else {
      for (const l of logs) {
        const logNode = document.createElement('div');
        logNode.className = `log-entry ${l.level}`;
        const timeStr = new Date(l.timestamp).toLocaleTimeString();
        logNode.innerHTML = `<span style="color:var(--text-muted);">[${timeStr}] [${l.level.toUpperCase()}]</span> ${escapeHtml(l.message)}`;
        consoleLogsList.appendChild(logNode);
      }
    }
  }

  // Save Request
  function saveActiveRequest() {
    syncWorkbenchToRequestState();

    if (!currentRequest.collectionName) {
      if (collections.length === 0) {
        openNewCollectionModal((createdName) => {
          currentRequest.collectionName = createdName;
          saveActiveRequest();
        });
        return;
      } else {
        currentRequest.collectionName = collections[0].info.name;
      }
    }

    let coll = collections.find(c => c.info.name === currentRequest.collectionName);
    if (!coll) {
      coll = {
        info: { name: currentRequest.collectionName, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [],
        variable: []
      };
      collections.push(coll);
    }

    // Check if request exists in collection
    const postmanItem = {
      name: currentRequest.name,
      request: {
        method: currentRequest.method,
        url: { raw: currentRequest.url },
        header: currentRequest.headers.map(h => ({ key: h.key, value: h.value, disabled: !h.enabled, description: h.description })),
        body: currentRequest.body,
        auth: currentRequest.auth
      },
      event: []
    };

    if (currentRequest.preRequestScript) {
      postmanItem.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: currentRequest.preRequestScript.split('\n') } });
    }
    if (currentRequest.testScript) {
      postmanItem.event.push({ listen: 'test', script: { type: 'text/javascript', exec: currentRequest.testScript.split('\n') } });
    }

    let existingIdx = -1;
    if (currentRequest.originalName) {
      existingIdx = coll.item.findIndex(i => i.name === currentRequest.originalName);
    }
    if (existingIdx < 0) {
      existingIdx = coll.item.findIndex(i => i.name === currentRequest.name);
    }

    if (existingIdx >= 0) {
      coll.item[existingIdx] = postmanItem;
    } else {
      coll.item.push(postmanItem);
    }
    currentRequest.originalName = currentRequest.name;

    vscode.postMessage({ type: 'saveCollection', collection: coll });
    collectionCrumb.textContent = `📁 ${coll.info.name}`;
    renderCollectionsTree();
  }

  // Newman Modal
  function populateNewmanModal() {
    newmanCollectionSelect.innerHTML = '';
    for (const c of collections) {
      const opt = document.createElement('option');
      opt.value = `.altman/collections/${c.info.name.replace(/[/\\?%*:|"<>]/g, '_')}.json`;
      opt.textContent = c.info.name;
      newmanCollectionSelect.appendChild(opt);
    }

    newmanEnvSelect.innerHTML = '<option value="">(None)</option>';
    for (const e of environments) {
      const opt = document.createElement('option');
      opt.value = `.altman/environments/${e.name.replace(/[/\\?%*:|"<>]/g, '_')}.altman_env.json`;
      opt.textContent = e.name;
      if (e.name === activeEnvironmentName) opt.selected = true;
      newmanEnvSelect.appendChild(opt);
    }

    updateNewmanPreview();
  }

  function updateNewmanPreview() {
    runNewman(false);
  }

  function runNewman(executeInTerminal) {
    const collPath = newmanCollectionSelect.value;
    const envPath = newmanEnvSelect.value;
    const iters = parseInt(newmanIterations.value, 10) || 1;
    const insecure = newmanInsecure.checked;
    const bail = newmanBail.checked;

    vscode.postMessage({
      type: 'runNewmanCommand',
      executeInTerminal,
      options: {
        collectionPath: collPath,
        environmentPath: envPath || undefined,
        iterationCount: iters,
        insecureSsl: insecure,
        bailOnError: bail,
        reporters: ['cli']
      }
    });
  }

  // Environment Manager Modal
  function openAddEnvironmentModal() {
    editingEnvIndex = -1;
    envModalTitle.textContent = 'Add Environment';
    envNameInput.value = '';
    envVariablesBody.innerHTML = '';
    addEnvVarRow('', '', true);
    envManagerModal.classList.remove('hidden');
  }

  function openEditEnvironmentModal(index) {
    editingEnvIndex = index;
    const env = environments[index];
    envModalTitle.textContent = `Edit Environment: ${env.name}`;
    envNameInput.value = env.name;
    envVariablesBody.innerHTML = '';

    for (const v of env.values || []) {
      addEnvVarRow(v.key, v.value, v.enabled !== false);
    }
    if ((env.values || []).length === 0) {
      addEnvVarRow('', '', true);
    }
    envManagerModal.classList.remove('hidden');
  }

  function addEnvVarRow(key, val, enabled) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" ${enabled ? 'checked' : ''} class="ev-enabled"></td>
      <td><input type="text" value="${escapeHtml(key)}" placeholder="Variable Name" class="ev-key"></td>
      <td><input type="text" value="${escapeHtml(val)}" placeholder="Value" class="ev-val"></td>
      <td><button class="btn-danger-text btn-del-ev">&times;</button></td>
    `;
    tr.querySelector('.btn-del-ev').addEventListener('click', () => tr.remove());
    envVariablesBody.appendChild(tr);
  }

  function saveEnvironmentModal() {
    const name = envNameInput.value.trim();
    if (!name) {
      envNameInput.focus();
      return;
    }

    const values = [];
    envVariablesBody.querySelectorAll('tr').forEach(tr => {
      const enabled = tr.querySelector('.ev-enabled').checked;
      const k = tr.querySelector('.ev-key').value.trim();
      const v = tr.querySelector('.ev-val').value;
      if (k) {
        values.push({ key: k, value: v, enabled, type: 'default' });
      }
    });

    const envObj = {
      name,
      values,
      _postman_variable_scope: 'environment'
    };

    if (editingEnvIndex >= 0 && environments[editingEnvIndex] && environments[editingEnvIndex].name !== name) {
      vscode.postMessage({ type: 'deleteEnvironment', name: environments[editingEnvIndex].name });
    }

    vscode.postMessage({ type: 'saveEnvironment', environment: envObj });
    envManagerModal.classList.add('hidden');
  }

  // Collection Manager Modal (Variables & Pre/Test Scripts)
  let editingCollOriginalName = '';
  function openCollectionManagerModal(collName) {
    const coll = collections.find(c => c.info.name === collName);
    if (!coll) return;
    editingCollOriginalName = coll.info.name;

    collModalTitle.textContent = `Collection Settings: ${coll.info.name}`;
    collNameInput.value = coll.info.name;

    // Reset tabs to Variables tab
    document.querySelectorAll('[data-coll-tab]').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.coll-modal-tab-content').forEach(c => c.classList.add('hidden'));
    const defaultTab = document.querySelector('[data-coll-tab="collVarsTab"]');
    if (defaultTab) defaultTab.classList.add('active');
    const defaultContent = document.getElementById('collVarsTab');
    if (defaultContent) defaultContent.classList.remove('hidden');

    // Populate Variables
    collVariablesBody.innerHTML = '';
    for (const v of coll.variable || []) {
      addCollVarRow(v.key, v.value, v.description, !v.disabled);
    }
    if ((coll.variable || []).length === 0) {
      addCollVarRow('', '', '', true);
    }

    // Populate Scripts from coll.event
    let preScript = '';
    let testScript = '';
    for (const ev of coll.event || []) {
      const code = Array.isArray(ev.script?.exec) ? ev.script.exec.join('\n') : (ev.script?.exec || '');
      if (ev.listen === 'prerequest') {
        preScript = code;
      } else if (ev.listen === 'test') {
        testScript = code;
      }
    }
    collPreScriptEditor.value = preScript;
    collTestScriptEditor.value = testScript;

    collManagerModal.classList.remove('hidden');
  }

  function addCollVarRow(key, val, desc, enabled) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" ${enabled !== false ? 'checked' : ''} class="cv-enabled"></td>
      <td><input type="text" value="${escapeHtml(key)}" placeholder="Variable Name" class="cv-key"></td>
      <td><input type="text" value="${escapeHtml(val)}" placeholder="Value" class="cv-val"></td>
      <td><input type="text" value="${escapeHtml(desc || '')}" placeholder="Description" class="cv-desc"></td>
      <td><button class="btn-danger-text btn-del-cv">&times;</button></td>
    `;
    tr.querySelector('.btn-del-cv').addEventListener('click', () => tr.remove());
    collVariablesBody.appendChild(tr);
  }

  function saveCollectionModal() {
    const coll = collections.find(c => c.info.name === editingCollOriginalName);
    if (!coll) return;

    const newName = collNameInput.value.trim() || coll.info.name;
    const isRenamed = newName !== coll.info.name;

    // Collect Variables
    const variables = [];
    collVariablesBody.querySelectorAll('tr').forEach(tr => {
      const enabled = tr.querySelector('.cv-enabled').checked;
      const k = tr.querySelector('.cv-key').value.trim();
      const v = tr.querySelector('.cv-val').value;
      const d = tr.querySelector('.cv-desc').value;
      if (k) {
        variables.push({
          key: k,
          value: v,
          type: 'string',
          description: d || undefined,
          disabled: !enabled
        });
      }
    });
    coll.variable = variables;

    // Collect Scripts in coll.event
    if (!Array.isArray(coll.event)) {
      coll.event = [];
    }
    coll.event = coll.event.filter(e => e.listen !== 'prerequest' && e.listen !== 'test');
    const pre = collPreScriptEditor.value;
    if (pre && pre.trim()) {
      coll.event.push({
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: pre.split('\n')
        }
      });
    }
    const test = collTestScriptEditor.value;
    if (test && test.trim()) {
      coll.event.push({
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: test.split('\n')
        }
      });
    }

    if (isRenamed) {
      const oldName = coll.info.name;
      coll.info.name = newName;
      if (currentRequest.collectionName === oldName) {
        currentRequest.collectionName = newName;
        collectionCrumb.textContent = `📁 ${newName}`;
      }
      vscode.postMessage({ type: 'deleteCollection', name: oldName });
    }

    vscode.postMessage({ type: 'saveCollection', collection: coll });
    collManagerModal.classList.add('hidden');
    renderCollectionsTree();
  }

  // New Collection Modal
  let newCollCallback = null;
  function openNewCollectionModal(callback) {
    newCollCallback = callback || null;
    newCollNameInput.value = '';
    newCollModal.classList.remove('hidden');
    setTimeout(() => {
      newCollNameInput.focus();
    }, 50);
  }

  function closeNewCollectionModal() {
    newCollModal.classList.add('hidden');
    newCollCallback = null;
  }

  function submitNewCollection() {
    const name = newCollNameInput.value.trim();
    if (!name) return;
    const newColl = {
      info: {
        name,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [],
      variable: []
    };
    collections.push(newColl);
    vscode.postMessage({ type: 'saveCollection', collection: newColl });
    closeNewCollectionModal();
    renderCollectionsTree();
    if (newCollCallback) {
      newCollCallback(name);
    }
  }

  // Confirmation Modal
  let confirmActionCallback = null;
  function showConfirmDialog(title, message, onProceed) {
    confirmDialogTitle.textContent = title;
    confirmDialogMessage.textContent = message;
    confirmActionCallback = onProceed;
    confirmDialogModal.classList.remove('hidden');
  }

  function closeConfirmDialog() {
    confirmDialogModal.classList.add('hidden');
    confirmActionCallback = null;
  }

  // Add Request to Collection
  function addRequestToCollection(collName) {
    const coll = collections.find(c => c.info.name === collName);
    if (!coll) return;
    if (!Array.isArray(coll.item)) coll.item = [];

    let baseName = 'New Request';
    let reqName = baseName;
    let counter = 1;
    while (coll.item.some(i => i.name === reqName)) {
      reqName = `${baseName} ${counter++}`;
    }

    const newPostmanItem = {
      name: reqName,
      request: {
        method: 'GET',
        url: { raw: 'https://httpbin.org/get' },
        header: [
          { key: 'Accept', value: 'application/json' }
        ],
        body: { mode: 'none', raw: '' }
      },
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'pm.test("Status code is 200", function () {',
              '    pm.expect(pm.response.code).to.equal(200);',
              '});'
            ]
          }
        }
      ]
    };

    coll.item.push(newPostmanItem);
    vscode.postMessage({ type: 'saveCollection', collection: coll });
    loadRequestIntoWorkbench(newPostmanItem, collName);
    renderCollectionsTree();
    requestNameInput.focus();
    requestNameInput.select();
  }

  // Delete Request from Collection
  function deleteRequestFromCollection(collName, reqName) {
    const coll = collections.find(c => c.info.name === collName);
    if (!coll || !Array.isArray(coll.item)) return;

    function removeItemRecursive(items) {
      const idx = items.findIndex(i => i.name === reqName);
      if (idx >= 0) {
        items.splice(idx, 1);
        return true;
      }
      for (const item of items) {
        if (Array.isArray(item.item)) {
          if (removeItemRecursive(item.item)) return true;
        }
      }
      return false;
    }

    const removed = removeItemRecursive(coll.item);
    if (removed) {
      vscode.postMessage({ type: 'saveCollection', collection: coll });
      if (currentRequest.collectionName === collName && currentRequest.name === reqName) {
        resetRequestWorkbench();
      }
      renderCollectionsTree();
    }
  }

  // Helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Run initial setup
  init();
})();
