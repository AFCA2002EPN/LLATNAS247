document.addEventListener('DOMContentLoaded', () => {
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const loginMessage = document.getElementById('login-message');
  const logoutButton = document.getElementById('logout-button');

  if (sessionStorage.getItem('llantas_auth_token')) {
    mostrarApp();
  }

 loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    loginMessage.textContent = 'Verificando...';
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: user, password: pass })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error de conexión');
      
      sessionStorage.setItem('llantas_auth_token', data.token);
      sessionStorage.setItem('llantas_user_role', data.rol);
      sessionStorage.setItem('llantas_user_name', data.usuario);
      
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('app-container').hidden = false;
      
      const role = data.rol;
      const targetView = role === 'tecnico' ? 'technician' : 'seller';
      const viewButton = document.querySelector(`[data-view="${targetView}"]`);
      if (viewButton) viewButton.click();

    } catch (error) {
      loginMessage.textContent = error.message;
    }
  });

  logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem('llantas_auth_token');
    sessionStorage.removeItem('llantas_user_role');
    sessionStorage.removeItem('llantas_user_name');
    location.reload();
  });

  function mostrarApp() {
    loginContainer.hidden = true;
    appContainer.hidden = false;
    
    const role = sessionStorage.getItem('llantas_user_role');
    const targetView = role === 'tecnico' ? 'technician' : 'seller';
    
    setTimeout(() => {
      const viewButton = document.querySelector(`[data-view="${targetView}"]`);
      if (viewButton) {
        viewButton.click();
      }
    }, 50);
  }

  let orderNumber = '#ORD-2026-0000';
  let loadedOrder = false;
  let orderSaved = false;
  const statusNumber = document.querySelector('.order-number strong');
  const summaryNumber = document.querySelector('#summary-order-number');
  let invoiceHeader;
  const branchSelect = document.querySelector('#branch-select');
  const savedBranch = localStorage.getItem('llantas247-branch');
  if (savedBranch && [...branchSelect.options].some((option) => option.value === savedBranch)) branchSelect.value = savedBranch;
  const orderDate = document.querySelector('#order-date');
  const headerDate = document.querySelector('.heading-meta span strong');

  function updateHeaderDate() {
    if (!orderDate.value) return;
    const [year, month, day] = orderDate.value.split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    if (headerDate) {
      headerDate.textContent = `${day} de ${meses[parseInt(month, 10) - 1]} de ${year}`;
    }
  }

  if (!orderDate.value) orderDate.value = new Date().toISOString().slice(0, 10);
  updateHeaderDate(); 
  orderDate.addEventListener('input', updateHeaderDate); 

  const setOrderNumber = (number) => {
    orderNumber = number;
    statusNumber.textContent = orderNumber;
    summaryNumber.textContent = orderNumber;
    if (invoiceHeader) invoiceHeader.querySelector('.invoice-number').textContent = orderNumber;
  };

  const loadNextOrderNumber = async () => {
    try {
      const response = await fetch(`/api/proximo-numero/${orderDate.value.slice(0, 4)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'No se pudo consultar el consecutivo.');
      setOrderNumber(result.numero_orden);
    } catch (error) {
      statusNumber.textContent = 'Consecutivo no disponible';
    }
  };

  branchSelect.addEventListener('change', () => {
    localStorage.setItem('llantas247-branch', branchSelect.value);
    document.querySelector('.invoice-kicker').textContent = `Gestión de taller · ${branchSelect.value}`;
  });
  statusNumber.textContent = orderNumber;
  summaryNumber.textContent = orderNumber;

  const salespersonSelect = document.querySelector('#salesperson');
  const customSalespersonLabel = document.createElement('label');
  customSalespersonLabel.className = 'salesperson-custom';
  customSalespersonLabel.hidden = true;
  customSalespersonLabel.innerHTML = 'Nombre del asesor<input id="salesperson-custom-name" type="text" placeholder="Escriba el nombre">';
  salespersonSelect.closest('label').after(customSalespersonLabel);
  const customSalespersonName = customSalespersonLabel.querySelector('input');
  salespersonSelect.insertAdjacentHTML('beforeend', '<option value="Otro asesor">Otro asesor</option>');
  salespersonSelect.addEventListener('change', () => {
    customSalespersonLabel.hidden = salespersonSelect.value !== 'Otro asesor';
    if (!customSalespersonLabel.hidden) customSalespersonName.focus();
  });

  const manufactureLabel = [...document.querySelectorAll('#technician-panel label')]
    .find((label) => label.textContent.includes('Fecha de fabricación'));
  if (manufactureLabel) {
    manufactureLabel.innerHTML = 'Código DOT (semana y año)<input id="manufacture-code" class="dot-code" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="Ej.: 3526" title="Ingrese exactamente 4 números: semana y año">';
    manufactureLabel.querySelector('input').addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
    });
  }

  const invoicePanel = document.querySelector('#order-summary-panel');
  invoiceHeader = document.createElement('div');
  invoiceHeader.className = 'invoice-header';
  invoiceHeader.innerHTML = '<div><img class="invoice-brand" src="assets/images/llantas247_logo.jpg" alt="Llantas 247"><h2 class="invoice-heading">Orden de servicio</h2><p class="invoice-kicker"></p></div><strong class="invoice-number"></strong>';
  invoiceHeader.querySelector('.invoice-kicker').textContent = `Gestión de taller · ${branchSelect.value}`;
  invoiceHeader.querySelector('.invoice-number').textContent = orderNumber;
  const invoiceAccent = document.createElement('div');
  invoiceAccent.className = 'invoice-accent';
  invoicePanel.prepend(invoiceHeader);
  invoicePanel.prepend(invoiceAccent);

  const style = document.createElement('style');
  style.textContent = '.salesperson-custom[hidden]{display:none}.dot-code{max-width:200px;text-transform:uppercase;letter-spacing:.16em}.invoice-header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:24px 20px;background:linear-gradient(120deg,#10182e,#1e2c4d);color:#fff}.invoice-brand{width:200px;height:85px;padding:7px;border-radius:6px;background:#fff;object-fit:contain}.invoice-heading{margin:0;font-size:22px}.invoice-kicker{margin:5px 0 0;color:#9fb0cc;font:10px IBM Plex Mono,monospace;text-transform:uppercase;letter-spacing:.14em}.invoice-number{color:#fff;font:700 15px IBM Plex Mono,monospace;white-space:nowrap}.invoice-accent{height:5px;background:#ed0010}.consent-panel{margin-top:24px}.consent-intro{margin:0 20px 18px;color:var(--muted);line-height:1.5}.consent-list{display:grid;gap:10px;padding:0 20px 20px}.consent-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(180px,1fr) 112px auto;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:6px}.consent-row[hidden]{display:none}.consent-role{font-weight:700}.consent-row input{width:100%;min-width:0}.consent-status{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase}.consent-status.notified{color:#2563eb}.consent-status.approved{color:#00bd7b}.consent-status.rejected{color:#ed0010}.consent-actions{display:flex;gap:6px}.consent-button{border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer}.consent-button:hover{border-color:var(--red);color:var(--red)}.consent-note{grid-column:1/-1;margin:0;color:var(--muted);font-size:11px}.consent-warning{display:block;margin:0 20px 20px;color:var(--red);font-weight:700}.consent-warning[hidden]{display:none}';
  
  style.textContent += '.damage-map-wrapper{padding:16px 20px;display:flex;justify-content:center;background:#f8fafc;border-bottom:1px solid var(--line)}.damage-map-container{position:relative;display:inline-block;max-width:100%;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#fff;cursor:crosshair}.damage-map-container img{display:block;max-width:100%;height:auto;pointer-events:none;width:420px}.damage-pin{position:absolute;width:16px;height:16px;background:#ed0010;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.35);transition:transform 0.15s;-webkit-print-color-adjust:exact;print-color-adjust:exact;z-index:5}.damage-pin:hover{transform:translate(-50%,-50%) scale(1.3);background:#c9000d;z-index:10}';
  
  style.textContent += `
  @media print {
    @page { margin: 0.5cm; size: auto; }
    body { font-size: 10px !important; background: #fff !important; }
    .panel { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }
    .invoice-header { padding: 10px 0 !important; background: transparent !important; color: #000 !important; border-bottom: 2px solid #000; }
    .invoice-brand { filter: grayscale(100%); height: 40px !important; }
    .invoice-heading, .invoice-number, .invoice-kicker { color: #000 !important; margin: 0; }
    .order-summary-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .order-summary-table th, .order-summary-table td { padding: 4px !important; border-bottom: 1px solid #ddd; font-size: 10px !important; }
    .damage-map-container img { width: 220px !important; }
    .summary-actions, header, footer { display: none !important; }
    #order-summary-panel { display: block !important; }
    main > section:not(#order-summary-panel) { display: none !important; }
  }`;

  document.head.append(style);

  const serviceInputs = [...document.querySelectorAll('#services-list input')];
  const otherService = document.querySelector('#other-service');
  const summary = document.querySelector('#summary');
  const serviceCount = document.querySelector('#service-count');
  const checklistInputs = [...document.querySelectorAll('#checklist input[type="checkbox"]')];
  const quantityInputs = [...document.querySelectorAll('#checklist .item-quantity')];
  const checklistStatus = document.querySelector('#checklist-status');
  const technicianPanel = document.querySelector('#technician-panel');
  const licensePlate = document.querySelector('#license-plate');
  const newInstallationOrderButton = document.querySelector('#new-installation-order');
  const clearOrderButton = document.querySelector('#clear-order');
  document.querySelector('.order-actions').append(newInstallationOrderButton);
  
  const lookupBox = document.createElement('div');
  lookupBox.className = 'order-lookup';
  lookupBox.innerHTML = '<label>Seleccionar sucursal<select id="lookup-branch"><option>Granados</option><option>Valle de los Chillos</option><option>Guayaquil</option></select></label><label>Órdenes recientes de la sucursal<select id="recent-orders"><option value="">Cargando órdenes...</option></select></label><button class="consent-button" type="button" id="load-recent-order">Cargar orden reciente</button><label>O buscar por número<input id="lookup-order-number" type="text" placeholder="#ORD-2026-0003"></label><button class="consent-button" type="button" id="load-order">Cargar orden</button><output class="technician-message" id="lookup-message" aria-live="polite"></output>';
  technicianPanel.prepend(lookupBox);
  
  const lookupBranch = lookupBox.querySelector('#lookup-branch');
  const recentOrders = lookupBox.querySelector('#recent-orders');
  const loadRecentOrderButton = lookupBox.querySelector('#load-recent-order');
  const lookupInput = lookupBox.querySelector('#lookup-order-number');
  const loadOrderButton = lookupBox.querySelector('#load-order');
  const lookupMessage = lookupBox.querySelector('#lookup-message');
  lookupBranch.value = branchSelect.value;

  let damagePins = [];
  let damageMapContainer = document.querySelector('#damage-map-container');

  if (!damageMapContainer) {
    const damageSectionWrapper = document.createElement('div');
    damageSectionWrapper.innerHTML = `<div class="panel-title">Mapa de daños del vehículo</div><p class="checklist-help" style="margin:0 20px 10px;color:var(--muted);font-size:12px">Haga clic en la imagen para marcar golpes o rayones. Haga clic sobre un punto rojo para eliminarlo.</p><div class="damage-map-wrapper"><div id="damage-map-container" class="damage-map-container"><img src="assets/images/mapa de daño.png" alt="Mapa del vehículo"></div></div>`;
    
    const checklistStatusEl = document.querySelector('#checklist-status');
    const targetTitle = checklistStatusEl ? checklistStatusEl.closest('.panel-title') : null;
    if (targetTitle) {
      targetTitle.before(damageSectionWrapper);
    } else {
      technicianPanel.appendChild(damageSectionWrapper);
    }
    damageMapContainer = document.querySelector('#damage-map-container');
  }

  function renderDamagePins() {
    if (!damageMapContainer) return;
    damageMapContainer.querySelectorAll('.damage-pin').forEach(pin => pin.remove());
    damagePins.forEach((pin, index) => {
      const pinEl = document.createElement('div');
      pinEl.className = 'damage-pin';
      pinEl.style.left = `${pin.x}%`;
      pinEl.style.top = `${pin.y}%`;
      pinEl.dataset.index = index;
      pinEl.title = "Clic para eliminar este daño";
      damageMapContainer.appendChild(pinEl);
    });
  }

  if (damageMapContainer) {
    damageMapContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('damage-pin')) {
        const idx = parseInt(e.target.dataset.index, 10);
        if (!isNaN(idx)) {
          damagePins.splice(idx, 1);
          renderDamagePins();
          updateOrderSummary();
        }
        return;
      }
      const rect = damageMapContainer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
      damagePins.push({ x, y });
      renderDamagePins();
      updateOrderSummary();
    });
  }
  
  async function loadRecentOrders() {
    recentOrders.innerHTML = '<option value="">Cargando órdenes...</option>';
    try {
      const response = await fetch(`/api/ordenes-recientes/${encodeURIComponent(lookupBranch.value)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'No se pudieron consultar las órdenes.');
      recentOrders.innerHTML = result.ordenes.length
        ? result.ordenes.map((order) => `<option value="${order.numero_orden}">${order.cliente} - ${order.numero_orden} (${order.fecha})${order.instalacion_guardada ? ' - Instalación completada' : ''}</option>`).join('')
        : '<option value="">No hay órdenes en esta sucursal</option>';
    } catch (error) {
      recentOrders.innerHTML = '<option value="">No se pudieron cargar</option>';
      lookupMessage.textContent = `Error: ${error.message}`;
    }
  }
  lookupBranch.addEventListener('change', loadRecentOrders);
  loadRecentOrderButton.addEventListener('click', () => {
    if (!recentOrders.value) {
      lookupMessage.textContent = 'No hay una orden reciente para cargar.';
      return;
    }
    lookupInput.value = recentOrders.value;
    loadOrderButton.click();
  });
  loadRecentOrders();
  lookupInput.addEventListener('input', () => {
    const typedNumber = lookupInput.value.trim().toUpperCase();
    if (/^#ORD-\d{4}-\d{4}$/.test(typedNumber)) setOrderNumber(typedNumber);
  });
  document.querySelector('[data-view="technician"]').addEventListener('click', () => {
    if (!loadedOrder) statusNumber.textContent = 'Selecciona una orden';
    lookupBranch.value = branchSelect.value;
    loadRecentOrders();
  });

  const consentPanel = document.createElement('section');
  consentPanel.className = 'panel consent-panel';
  consentPanel.innerHTML = '<div class="panel-title with-badge">Consentimientos de la orden <b id="consent-count">0/5 aprobados</b></div><p class="consent-intro">Cada responsable debe aprobar la orden antes de iniciar el trabajo.</p><div class="consent-list"></div><output class="consent-warning" hidden></output>';
  document.querySelector('main').append(consentPanel);
  const consentList = consentPanel.querySelector('.consent-list');
  const consentWarning = consentPanel.querySelector('.consent-warning');
  
  const consentRows = [
    { id: 'client_datos', role: 'Cliente (Protección de Datos)', required: true },
    { id: 'client_reciclaje', role: 'Cliente (Reciclaje de Llantas)', required: true },
    { id: 'advisor', role: 'Asesor de ventas', required: true, email: 'notificaciones@llantas247.com' },
    { id: 'tire-installer', role: 'Instalador de enllantaje', service: 'Enllantaje - Balanceo' },
    { id: 'alignment-installer', role: 'Instalador de alineación', service: 'Alineación' }
  ];
  
  const savedConsent = JSON.parse(localStorage.getItem(`consent-${orderNumber}`) || '{}');
  
  consentRows.forEach(({ id, role, email }) => {
    const row = document.createElement('div');
    row.className = 'consent-row';
    row.dataset.consentId = id;
    
    const hideButtonStr = (id === 'client_reciclaje') ? 'style="display:none;"' : '';
    
    row.innerHTML = `<strong class="consent-role">${role}</strong><input type="email" class="consent-email" placeholder="Correo electrónico" aria-label="Correo de ${role}"><span class="consent-status">Pendiente</span><div class="consent-actions"><button type="button" class="consent-button notify-button" ${hideButtonStr}>Notificar</button></div><p class="consent-note">Notificación por correo disponible.</p>`;
    
    row.querySelector('.consent-email').value = email || '';
    const savedStatus = savedConsent[id]?.status;
    if (savedStatus) setConsentStatus(row, savedStatus);
    
    row.querySelector('.notify-button').addEventListener('click', () => {
      notifyConsent(row, role);
    });
    consentList.append(row);
  });

  const mainEmailInput = document.querySelector('#customer-email');
  const emailVal = mainEmailInput.value || 'adriancorrea1234518@gmail.com';
  const rowDatosEmail = document.querySelector('.consent-row[data-consent-id="client_datos"] .consent-email');
  const rowReciclajeEmail = document.querySelector('.consent-row[data-consent-id="client_reciclaje"] .consent-email');
  
  if(rowDatosEmail) rowDatosEmail.value = emailVal;
  if(rowReciclajeEmail) rowReciclajeEmail.value = emailVal;

  mainEmailInput.addEventListener('input', (event) => {
    if(rowDatosEmail) rowDatosEmail.value = event.target.value;
    if(rowReciclajeEmail) rowReciclajeEmail.value = event.target.value;
  });
  
 async function notifyConsent(row, role) {
    const email = row.querySelector('.consent-email').value.trim();
    if (!email) { 
      lookupMessage.textContent = `Escribe el correo de ${role}.`; 
      return; 
    }
    try {
      const consentId = row.dataset.consentId;
      if (consentId.startsWith('client_')) {
        await fetch(`/api/notificar-consentimiento/${encodeURIComponent(orderNumber)}/client_datos`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: email }) 
        });
        await fetch(`/api/notificar-consentimiento/${encodeURIComponent(orderNumber)}/client_reciclaje`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: email }) 
        });
        
        setConsentStatus(document.querySelector('.consent-row[data-consent-id="client_datos"]'), 'notified');
        setConsentStatus(document.querySelector('.consent-row[data-consent-id="client_reciclaje"]'), 'notified');
        lookupMessage.textContent = `✓ 2 correos de notificación enviados al cliente`;
      } else {
        // Esto procesa correctamente al asesor (advisor) y a los instaladores
        const response = await fetch(`/api/notificar-consentimiento/${encodeURIComponent(orderNumber)}/${consentId}`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: email }) 
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'No se pudo enviar la notificación.');
        
        setConsentStatus(row, 'notified');
        lookupMessage.textContent = `✓ ${result.mensaje || 'Notificación enviada con éxito'}`;
      }
      
      updateConsentState();
      
      // 👇 AQUÍ ESTÁ LA MAGIA 👇
      // Encendemos el radar inmediatamente para que vigile si ya firmaron en el correo
      if (!consentPollingInterval) {
        startConsentPolling(orderNumber);
      }
      
    } catch (error) { 
      lookupMessage.textContent = `Error: ${error.message}`; 
    }
  }

  function setConsentStatus(row, status) {
    const statusLabel = row.querySelector('.consent-status');
    const noteText = row.querySelector('.consent-note');
    row.dataset.status = status;
    statusLabel.className = `consent-status ${status}`;
    
    if (status === 'pending') {
      statusLabel.textContent = 'Pendiente';
      noteText.textContent = 'Notificación por correo disponible.';
      row.style.background = '';
      row.style.borderColor = '';
    } else if (status === 'notified') {
      statusLabel.textContent = 'Notificado';
      noteText.textContent = 'Correo enviado. Esperando respuesta...';
      row.style.background = '#eff6ff';
      row.style.borderColor = '#3b82f6';
    } else if (status === 'approved') {
      statusLabel.textContent = 'Aprobado';
      noteText.textContent = '✓ Aprobado con éxito.';
      row.style.background = '#d9f8ed';
      row.style.borderColor = '#00bd7b';
      const btn = row.querySelector('.notify-button');
      if(btn) btn.style.display = 'none';
    } else if (status === 'rejected') {
      statusLabel.textContent = 'Rechazado';
      noteText.textContent = '✗ Rechazado.';
      row.style.background = '#fff3f3';
      row.style.borderColor = '#ed0010';
    }

    const consentState = JSON.parse(localStorage.getItem(`consent-${orderNumber}`) || '{}');
    consentState[row.dataset.consentId] = { status, at: new Date().toISOString() };
    localStorage.setItem(`consent-${orderNumber}`, JSON.stringify(consentState));
  }

  function updateConsentState() {
    const selectedServices = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    consentRows.forEach(({ id }) => {
      const row = consentList.querySelector(`[data-consent-id="${id}"]`);
      if(row) {
        row.hidden = false;
        if (!['approved', 'rejected', 'notified'].includes(row.dataset.status)) {
          row.dataset.status = 'pending';
          row.querySelector('.consent-status').textContent = 'Pendiente';
        }
      }
    });
    const visibleRows = [...consentList.querySelectorAll('.consent-row:not([hidden])')];
    const approved = visibleRows.filter((row) => row.dataset.status === 'approved').length;
    consentPanel.querySelector('#consent-count').textContent = `${approved}/${visibleRows.length} aprobados`;
    consentWarning.hidden = approved === visibleRows.length;
    consentWarning.textContent = `Faltan ${visibleRows.length - approved} consentimiento(s) para completar la orden.`;
  }

  let consentPollingInterval = null;

  function stopConsentPolling() {
    if (consentPollingInterval) {
      clearInterval(consentPollingInterval);
      consentPollingInterval = null;
    }
  }

  function showConsentToast(role, estado) {
    const toast = document.createElement('div');
    const esAprobado = estado === 'aprobado';
    toast.style.cssText = `position:fixed;bottom:28px;right:28px;z-index:9999;padding:14px 20px;border-radius:10px;font:700 14px 'Space Grotesk',sans-serif;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.22);display:flex;align-items:center;gap:10px;transition:opacity .4s;background:${esAprobado ? '#00bd7b' : '#ed0010'}`;
    toast.innerHTML = `<span style="font-size:20px">${esAprobado ? '✅' : '❌'}</span> <span>${role} ha <strong>${esAprobado ? 'APROBADO' : 'RECHAZADO'}</strong> la orden</span>`;
    document.body.append(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 4500);
  }

  function syncConsentFromDB(consentimientosBD) {
    let changed = false;
    consentRows.forEach(({ id, role }) => {
      const row = consentList.querySelector(`[data-consent-id="${id}"]`);
      if (!row) return;
      
      let datosGuardados = consentimientosBD[id]; 
      
      if (datosGuardados) {
        const estadoBD = datosGuardados.estado;
        let nuevoStatus = 'pending';
        
        if (estadoBD === 'aprobado') nuevoStatus = 'approved';
        else if (estadoBD === 'rechazado') nuevoStatus = 'rejected';
        else if (estadoBD === 'notificado') nuevoStatus = 'notified';

        if (row.dataset.status !== nuevoStatus && nuevoStatus !== 'pending') {
          changed = true;
          setConsentStatus(row, nuevoStatus);
          
          if (estadoBD === 'aprobado' || estadoBD === 'rechazado') {
            showConsentToast(role, estadoBD);
          }
        }
      }
    });
    
    if (changed) {
      updateConsentState();
      updateOrderSummary();
    }
  }

  function startConsentPolling(numeroOrden) {
    stopConsentPolling();
    consentPollingInterval = setInterval(async () => {
      const visibles = [...consentList.querySelectorAll('.consent-row:not([hidden])')]; 
      const hayPendientes = visibles.some((row) => row.dataset.status === 'pending' || row.dataset.status === 'notified');
      if (!hayPendientes) { stopConsentPolling(); return; }
      
      try {
        const url = `/api/orden/${encodeURIComponent(numeroOrden)}?t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.instalacion?.consentimientos) {
          syncConsentFromDB(data.instalacion.consentimientos);
        }
      } catch { /* silencioso */ }
    }, 5000);
  }

  licensePlate.addEventListener('input', () => {
    licensePlate.value = licensePlate.value.toUpperCase();
  });

  const customerPhone = document.querySelector('#customer-phone');
  if (customerPhone) {
    customerPhone.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  document.querySelectorAll('.brand-select').forEach((select) => {
    select.addEventListener('change', () => {
      const customBrand = select.closest('section, .technical-details')?.querySelector('.brand-custom');
      if (customBrand) {
        customBrand.hidden = select.value !== 'Otra marca';
        if (!customBrand.hidden) customBrand.querySelector('input')?.focus();
      }
    });
  });

  function getPresentItems() {
    return checklistInputs.filter((input) => input.checked).map((input) => {
      const quantity = input.closest('.quantity-check')?.querySelector('.item-quantity');
      return quantity?.value ? `${input.value}: ${quantity.value}` : input.value;
    });
  }

  function displayValue(value) {
    return value && String(value).trim() ? String(value).trim() : 'No registrado';
  }

  function getConsentText(id) {
    const row = document.querySelector(`.consent-row[data-consent-id="${id}"]`);
    if (!row) return 'No solicitado';
    const status = row.dataset.status;
    if (status === 'approved') return '✅ Aprobado';
    if (status === 'rejected') return '❌ Rechazado';
    if (status === 'notified') return '⏳ Notificado (Esperando)';
    return 'Pendiente';
  }

  function updateSummary() {
    const selected = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService && otherService.value.trim()) selected.push(otherService.value.trim());
    if (serviceCount) serviceCount.textContent = `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}`;
    if (summary) summary.innerHTML = selected.length ? selected.map((name) => `<div class="summary-row"><span>${name}</span><small>-</small></div>`).join('') : '<span>No hay servicios seleccionados</span>';
  }

  function updateOrderSummary() {
    const newBrand = document.querySelector('#new-brand')?.value || '';
    const oldBrand = (document.querySelector('#technician-panel .brand-select') || document.querySelector('.technical-details .brand-select'))?.value || '';
    const services = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService && otherService.value.trim()) services.push(otherService.value.trim());
    
    const pinsSummaryHtml = damagePins.map(pin => `<div style="position:absolute; width:10px; height:10px; background:#ed0010; border:2px solid #fff; border-radius:50%; left:${pin.x}%; top:${pin.y}%; transform:translate(-50%,-50%); -webkit-print-color-adjust:exact; print-color-adjust:exact;"></div>`).join('');
    const mapPreviewHtml = `<div style="position:relative; display:inline-block; border:1px solid #ccc; border-radius:4px; overflow:hidden; max-width:240px; background:#fff;"><img src="assets/images/mapa de daño.png" alt="Mapa de daños" style="display:block; width:100%; height:auto;" />${pinsSummaryHtml}</div>`;

    const presentItems = getPresentItems();
    const rows = [
      ['Cliente', document.querySelector('#customer-name')?.value || ''],
      ['Sucursal', branchSelect?.value || ''],
      ['Correo electrónico', document.querySelector('#customer-email')?.value || ''],
      ['Teléfono', document.querySelector('#customer-phone')?.value || ''],
      ['Fecha', document.querySelector('#order-date')?.value || ''],
      ['Asesor de ventas', salespersonSelect?.value === 'Otro asesor' ? customSalespersonName?.value : (salespersonSelect?.value || '')],
      ['Cantidad de llantas', document.querySelector('#tire-quantity')?.value || ''],
      ['Llanta nueva', `${newBrand || 'No registrada'} - ${document.querySelector('#tire-result')?.textContent || '-'}`],
      ['Servicios contratados', services.length ? services.join(', ') : 'Ninguno'],
      ['Observaciones del vendedor', document.querySelector('.notes-panel textarea')?.value || ''],
      ['Placa', document.querySelector('#license-plate')?.value || ''],
      ['Kilometraje', document.querySelector('#technician-panel input[type="number"]')?.value || ''],
      ['Llanta vieja', `${oldBrand || 'No registrada'} - ${document.querySelector('#old-tire-result')?.textContent || '-'}`],
      ['Código DOT', document.querySelector('#manufacture-code')?.value || ''],
      ['Elementos presentes al recibir', presentItems.length ? presentItems.join(', ') : 'Ninguno marcado'],
      ['Mapa de daños del vehículo', damagePins.length ? mapPreviewHtml : 'Sin daños reportados'],
      ['Observaciones de ingreso', document.querySelector('.technical-notes')?.value || ''],
      ['Firma: Protección de Datos', getConsentText('client_datos')],
      ['Firma: Reciclaje de Llantas', getConsentText('client_reciclaje')],
      ['Firma: Asesor', getConsentText('advisor')],
      ['Firma: Instalador Enllantaje', getConsentText('tire-installer')],
      ['Firma: Instalador Alineación', getConsentText('alignment-installer')]
    ];

    const summaryBody = document.querySelector('#order-summary-body');
    if (summaryBody) {
      summaryBody.innerHTML = rows.map(([label, value]) => `<tr><th>${label}</th><td>${displayValue(value)}</td></tr>`).join('');
    }
    const summaryPanel = document.querySelector('#order-summary-panel');
    if (summaryPanel) summaryPanel.hidden = false;
  }

  loadOrderButton.addEventListener('click', async () => {
    const requestedNumber = lookupInput.value.trim().toUpperCase();
    if (!requestedNumber) {
      lookupMessage.textContent = 'Escribe el número de la orden.';
      return;
    }
    lookupMessage.textContent = 'Cargando orden...';
    try {
      const response = await fetch(`/api/orden/${encodeURIComponent(requestedNumber)}`);
      const order = await response.json();
      if (!response.ok) throw new Error(order.detail || 'No se pudo cargar la orden.');
      loadedOrder = true;
      orderSaved = true;
      setOrderNumber(order.numero_orden);
      
      sessionStorage.setItem('activeOrderNumber', order.numero_orden);

      const existingOrderButton = document.querySelector('#order-form .save-button');
      if (existingOrderButton) {
        existingOrderButton.disabled = true;
        existingOrderButton.innerHTML = '<span>✓</span> Orden guardada';
      }
      branchSelect.value = order.sucursal || branchSelect.value;
      lookupBranch.value = branchSelect.value;
      localStorage.setItem('llantas247-branch', branchSelect.value);
      orderDate.value = order.fecha;
      updateHeaderDate();
      
      document.querySelector('#customer-name').value = order.cliente || '';
      document.querySelector('#customer-email').value = order.correo || '';
      
      const rDatos = document.querySelector('.consent-row[data-consent-id="client_datos"] .consent-email');
      const rReciclaje = document.querySelector('.consent-row[data-consent-id="client_reciclaje"] .consent-email');
      if(rDatos) rDatos.value = order.correo || '';
      if(rReciclaje) rReciclaje.value = order.correo || '';
      
      document.querySelector('#customer-phone').value = order.telefono || '';
      if ([...salespersonSelect.options].some((option) => option.value === order.asesor)) salespersonSelect.value = order.asesor || '';
      else salespersonSelect.value = '';

      if (order.instalacion) {
        const installation = order.instalacion;
        document.querySelector('#new-brand').value = installation.marca_llanta_nueva || '';
        const newMeasure = (installation.medida_llanta_nueva || '').match(/^(\d+)\/(\d+)R(\d+)$/);
        if (newMeasure) {
          document.querySelector('#tire-width').value = newMeasure[1];
          document.querySelector('#tire-height').value = newMeasure[2];
          document.querySelector('#tire-rim').value = newMeasure[3];
          document.querySelector('#tire-result').textContent = installation.medida_llanta_nueva;
          ['old-tire-width', 'old-tire-height', 'old-tire-rim'].forEach((id, index) => {
            const el = document.querySelector(`#${id}`);
            if (el) el.value = newMeasure[index + 1];
          });
          document.querySelector('#old-tire-rim')?.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.querySelector('#tire-quantity').value = installation.cantidad_llantas ?? '';
        serviceInputs.forEach((input) => { input.checked = (installation.servicios || []).includes(input.value); });
        document.querySelector('.notes-panel textarea').value = installation.observaciones_vendedor || '';
        
        licensePlate.value = installation.placa || '';
        const kmEl = document.querySelector('#technician-panel input[type="number"]');
        if (kmEl) kmEl.value = installation.kilometraje ?? '';
        
        const oldMeasureText = installation.medida_llanta_vieja || installation.medida_llanta_nueva || '';
        document.querySelector('#old-tire-result').textContent = oldMeasureText || '-';
        const measure = oldMeasureText.match(/^(\d+)\/(\d+)R(\d+)$/);
        if (measure) {
          document.querySelector('#old-tire-width').value = measure[1];
          document.querySelector('#old-tire-height').value = measure[2];
          document.querySelector('#old-tire-rim').value = measure[3];
        }
        const dotEl = document.querySelector('#manufacture-code');
        if (dotEl) dotEl.value = installation.codigo_dot || '';
        const techNotes = document.querySelector('.technical-notes');
        if (techNotes) techNotes.value = installation.observaciones_ingreso || '';
        checklistInputs.forEach((input) => {
          const savedItem = (installation.elementos_presentes || []).find((item) => item === input.value || item.startsWith(`${input.value}: `));
          input.checked = Boolean(savedItem);
          const quantity = input.closest('.quantity-check')?.querySelector('.item-quantity');
          if (quantity) quantity.value = savedItem?.match(/: (\d+)$/)?.[1] || '';
        });
        
        damagePins = installation.mapa_danos || [];
        renderDamagePins();
      }
      
      if (order.instalacion && order.instalacion.consentimientos) {
        syncConsentFromDB(order.instalacion.consentimientos);
      }
      
      checklistStatus.textContent = `${checklistInputs.filter((input) => input.checked).length} presentes`;
      document.querySelector('#order-summary-panel').hidden = true;
      lookupMessage.textContent = `✓ Orden ${order.numero_orden} cargada.`;
      
      updateOrderSummary();
      startConsentPolling(order.numero_orden);
    } catch (error) {
      lookupMessage.textContent = `Error: ${error.message}`;
    }
  });

  serviceInputs.forEach((input) => input.addEventListener('change', () => {
    updateSummary();
    updateConsentState();
  }));
  if (otherService) otherService.addEventListener('input', updateSummary);
  updateConsentState();

  document.querySelectorAll('.view-button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.view-button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const technician = button.dataset.view === 'technician';
      document.querySelector('#order-form').hidden = technician;
      technicianPanel.hidden = !technician;
      document.querySelector('#heading-kicker').textContent = technician ? 'Datos para instalación' : 'Formulario de creación';
      document.querySelector('#page-title').textContent = technician ? 'Información del técnico' : 'Nueva Orden de Servicio';
      if (technician) technicianPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function updateChecklistStatus() {
    const completed = getPresentItems().length;
    checklistStatus.textContent = `${completed} presente${completed === 1 ? '' : 's'}`;
    checklistStatus.classList.toggle('complete', completed > 0);
  }
  checklistInputs.forEach((input) => input.addEventListener('change', updateChecklistStatus));
  quantityInputs.forEach((input) => input.addEventListener('input', () => {
    const checkbox = input.closest('.quantity-check')?.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = Number(input.value) > 0;
    updateChecklistStatus();
  }));

  ['tire-width', 'tire-height', 'tire-rim'].forEach((id) => document.querySelector(`#${id}`)?.addEventListener('input', () => {
    document.querySelector('#tire-result').textContent = `${document.querySelector('#tire-width')?.value || 0}/${document.querySelector('#tire-height')?.value || 0}R${document.querySelector('#tire-rim')?.value || 0}`;
  }));

  ['old-tire-width', 'old-tire-height', 'old-tire-rim'].forEach((id) => document.querySelector(`#${id}`)?.addEventListener('input', () => {
    document.querySelector('#old-tire-result').textContent = `${document.querySelector('#old-tire-width')?.value || 0}/${document.querySelector('#old-tire-height')?.value || 0}R${document.querySelector('#old-tire-rim')?.value || 0}`;
  }));

  const tireDimensionPairs = [['tire-width', 'old-tire-width'], ['tire-height', 'old-tire-height'], ['tire-rim', 'old-tire-rim']];
  const oldTireDimensionsEdited = new Set();
  tireDimensionPairs.forEach(([, oldId]) => {
    document.querySelector(`#${oldId}`)?.addEventListener('input', () => oldTireDimensionsEdited.add(oldId));
  });
  tireDimensionPairs.forEach(([newId, oldId]) => {
    document.querySelector(`#${newId}`)?.addEventListener('input', () => {
      const oldInput = document.querySelector(`#${oldId}`);
      if (oldInput && !oldTireDimensionsEdited.has(oldId)) oldInput.value = document.querySelector(`#${newId}`).value;
      oldInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  document.querySelector('#order-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('#save-message');
    const submitButton = document.querySelector('#order-form .save-button');
    
    // Validar que la asesora haya aprobado su consentimiento desde el correo
    const advisorRow = consentList.querySelector('[data-consent-id="advisor"]');
    const advisorStatus = advisorRow ? advisorRow.dataset.status : 'pending';
    
    if (advisorStatus !== 'approved') {
      message.style.color = 'var(--red)';
      message.textContent = 'Esperando que la firma de la asesora sea aceptada';
      message.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (orderSaved) {
      message.textContent = 'Esta orden ya fue guardada. Usa Nueva orden de instalación para crear otra.';
      return;
    }
    const formData = {
      fecha: document.querySelector('#order-date').value,
      sucursal: branchSelect.value,
      cliente: document.querySelector('#customer-name').value.trim(),
      marca_llanta_nueva: document.querySelector('#new-brand').value,
      medida_llanta_nueva: document.querySelector('#tire-result').textContent,
      cantidad_llantas: document.querySelector('#tire-quantity').value ? Number(document.querySelector('#tire-quantity').value) : null,
      servicios: serviceInputs.filter((input) => input.checked).map((input) => input.value),
      observaciones_vendedor: document.querySelector('.notes-panel textarea').value.trim(),
      correo: document.querySelector('#customer-email').value.trim(),
      telefono: document.querySelector('#customer-phone').value.trim(),
      asesor: salespersonSelect.value === 'Otro asesor' ? customSalespersonName.value.trim() : salespersonSelect.value
    };
    submitButton.disabled = true;
    message.textContent = 'Guardando orden...';
    try {
      const response = await fetch('/api/guardar-orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'No se pudo guardar la orden.');
      if (result.numero_orden) {
        loadedOrder = true;
        orderSaved = true;
        setOrderNumber(result.numero_orden);
        lookupInput.value = result.numero_orden;
        sessionStorage.setItem('activeOrderNumber', result.numero_orden);
      }
      message.textContent = `✓ ${result.mensaje || 'Orden guardada correctamente'}`;
      submitButton.disabled = true;
      submitButton.innerHTML = '<span>✓</span> Orden guardada';
      updateOrderSummary();
      startConsentPolling(result.numero_orden);
    } catch (error) {
      message.textContent = `Error al guardar: ${error.message}`;
    } finally {
      submitButton.disabled = false;
      setTimeout(() => { message.textContent = ''; }, 5000);
    }
  });

  document.querySelector('#save-technician').addEventListener('click', async () => {
    const message = document.querySelector('#technician-message');
    const saveButton = document.querySelector('#save-technician');
    if (orderNumber === '#ORD-2026-0000') {
      message.textContent = 'Primero guarda la orden del cliente.';
      return;
    }
    const oldTireBrand = (document.querySelector('#technician-panel .brand-select') || document.querySelector('.technical-details .brand-select'))?.value || '';
    
    const installationData = {
      placa: licensePlate.value.trim(),
      kilometraje: document.querySelector('#technician-panel input[type="number"]')?.value ? Number(document.querySelector('#technician-panel input[type="number"]').value) : null,
      marca_llanta_vieja: oldTireBrand,
      medida_llanta_vieja: document.querySelector('#old-tire-result').textContent,
      codigo_dot: document.querySelector('#manufacture-code')?.value || '',
      elementos_presentes: getPresentItems(),
      observaciones_ingreso: document.querySelector('.technical-notes')?.value.trim() || '',
      mapa_danos: damagePins 
    };

    saveButton.disabled = true;
    message.textContent = 'Guardando instalación...';
    try {
      const response = await fetch(`/api/guardar-instalacion/${encodeURIComponent(orderNumber)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installationData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'No se pudo guardar la instalación.');
      message.textContent = `✓ ${result.mensaje}`;
      updateOrderSummary();
    } catch (error) {
      message.textContent = `Error al guardar: ${error.message}`;
    } finally {
      saveButton.disabled = false;
      setTimeout(() => { message.textContent = ''; }, 5000);
    }
  });

  newInstallationOrderButton.addEventListener('click', () => {
    stopConsentPolling(); 
    if (!window.confirm('Se limpiarán los datos de la pantalla para crear una nueva orden. La orden ya guardada no se borrará.')) return;
    
    sessionStorage.removeItem('activeOrderNumber');
    
    document.querySelector('#order-form').reset();
    technicianPanel.querySelectorAll('input, textarea, select').forEach((field) => {
      if (field.type === 'checkbox') field.checked = false;
      else if (field.id !== 'license-plate') field.value = '';
    });
    orderDate.value = new Date().toISOString().slice(0, 10);
    updateHeaderDate();
    document.querySelector('#tire-result').textContent = '-';
    document.querySelector('#old-tire-result').textContent = '-';
    serviceCount.textContent = '0 seleccionados';
    summary.innerHTML = '<span>No hay servicios seleccionados</span>';
    checklistStatus.textContent = '0 presentes';
    checklistStatus.classList.remove('complete');
    quantityInputs.forEach((input) => { input.value = ''; });
    document.querySelectorAll('.brand-custom, .salesperson-custom').forEach((field) => { field.hidden = true; });
    document.querySelector('#order-summary-panel').hidden = true;
    document.querySelector('#save-message').textContent = '';
    document.querySelector('#technician-message').textContent = '';
    setOrderNumber('#ORD-2026-0000');
    loadedOrder = false;
    orderSaved = false;
    const orderSaveButton = document.querySelector('#order-form .save-button');
    orderSaveButton.disabled = false;
    orderSaveButton.innerHTML = '<span>▣</span> Guardar orden';
    loadNextOrderNumber();
    
    consentList.querySelectorAll('.consent-row').forEach((row) => {
      row.dataset.status = 'pending';
      row.querySelector('.consent-status').textContent = 'Pendiente';
      row.querySelector('.consent-note').textContent = 'Notificación por correo disponible.';
      row.style.background = '';
      row.style.borderColor = '';
      row.querySelector('.consent-email').value = '';
      
      const btn = row.querySelector('.notify-button');
      if(btn) {
        if(row.dataset.consentId === 'client_reciclaje') {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'block'; 
        }
      }
    });
    
    updateConsentState();
    
    damagePins = [];
    renderDamagePins();

    document.querySelector('#order-form').hidden = false;
    technicianPanel.hidden = true;
    document.querySelector('[data-view="seller"]').click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  clearOrderButton.addEventListener('click', () => {
    if (orderSaved) {
      alert('La orden no se puede limpiar porque ya fue guardada. Si deseas crear una nueva, haz clic en "Nueva orden de instalación".');
      return;
    }
    
    if (!window.confirm('¿Estás seguro de limpiar los datos ingresados?')) return;
    
    document.querySelector('#order-form').reset();
    orderDate.value = new Date().toISOString().slice(0, 10);
    if (typeof updateHeaderDate === 'function') updateHeaderDate();
    document.querySelector('#tire-result').textContent = '-';
    serviceCount.textContent = '0 seleccionados';
    summary.innerHTML = '<span>No hay servicios seleccionados</span>';
    document.querySelectorAll('.brand-custom, .salesperson-custom').forEach(field => field.hidden = true);
    document.querySelector('#save-message').textContent = '';
    
    damagePins = [];
    renderDamagePins();
  });

  document.querySelector('#print-order').addEventListener('click', () => {
    const tituloOriginal = document.title;
    document.title = `${orderNumber} LLANTAS247`;
    window.print();
    document.title = tituloOriginal;
  });

  const activeOrder = sessionStorage.getItem('activeOrderNumber');
  if (activeOrder) {
    lookupInput.value = activeOrder;
    setTimeout(() => loadOrderButton.click(), 50);
  } else {
    loadNextOrderNumber();
  }
});