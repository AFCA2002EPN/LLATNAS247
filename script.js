document.addEventListener('DOMContentLoaded', () => {
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
  if (!orderDate.value) orderDate.value = new Date().toISOString().slice(0, 10);
  const setOrderNumber = (number) => {
    orderNumber = number;
    statusNumber.textContent = orderNumber;
    summaryNumber.textContent = orderNumber;
    if (invoiceHeader) invoiceHeader.querySelector('.invoice-number').textContent = orderNumber;
  };
  const loadNextOrderNumber = async () => {
    try {
      const response = await fetch(`http://localhost:8001/api/proximo-numero/${orderDate.value.slice(0, 4)}`);
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
  manufactureLabel.innerHTML = 'Código DOT (semana y año)<input id="manufacture-code" class="dot-code" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="Ej.: 3526" title="Ingrese exactamente 4 números: semana y año">';
  manufactureLabel.querySelector('input').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
  });

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
  loadNextOrderNumber();

  const style = document.createElement('style');
  style.textContent = '.salesperson-custom[hidden]{display:none}.dot-code{max-width:160px;text-transform:uppercase;letter-spacing:.16em}.invoice-header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:24px 20px;background:linear-gradient(120deg,#10182e,#1e2c4d);color:#fff}.invoice-brand{width:112px;height:64px;padding:7px;border-radius:6px;background:#fff;object-fit:contain}.invoice-heading{margin:0;font-size:22px}.invoice-kicker{margin:5px 0 0;color:#9fb0cc;font:10px IBM Plex Mono,monospace;text-transform:uppercase;letter-spacing:.14em}.invoice-number{color:#fff;font:700 15px IBM Plex Mono,monospace;white-space:nowrap}.invoice-accent{height:5px;background:#ed0010}.consent-panel{margin-top:24px}.consent-intro{margin:0 20px 18px;color:var(--muted);line-height:1.5}.consent-list{display:grid;gap:10px;padding:0 20px 20px}.consent-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(180px,1fr) 112px auto;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:6px}.consent-row[hidden]{display:none}.consent-role{font-weight:700}.consent-row input{width:100%;min-width:0}.consent-status{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase}.consent-status.approved{color:var(--green)}.consent-status.rejected{color:var(--red)}.consent-actions{display:flex;gap:6px}.consent-button{border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer}.consent-button:hover{border-color:var(--red);color:var(--red)}.consent-note{grid-column:1/-1;margin:0;color:var(--muted);font-size:11px}.consent-warning{display:block;margin:0 20px 20px;color:var(--red);font-weight:700}.consent-warning[hidden]{display:none}@media(max-width:720px){.consent-row{grid-template-columns:1fr}.consent-actions{justify-content:flex-start}}@media print{.invoice-header{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice-brand{width:100px;height:56px}.order-summary-table{font-size:11px}.consent-panel{break-inside:avoid}}';
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
  const alarmCode = document.querySelector('#alarm-code');
  const toggleAlarm = document.querySelector('#toggle-alarm');
  const newInstallationOrderButton = document.querySelector('#new-installation-order');
  const clearOrderButton = document.querySelector('#clear-order');
  document.querySelector('.order-actions').append(newInstallationOrderButton);
  const lookupBox = document.createElement('div');
  lookupBox.className = 'order-lookup';
  lookupBox.innerHTML = '<label>Seleccionar sucursal<select id="lookup-branch"><option>Granados</option><option>Valle de los Chillos</option><option>Guayaquil</option></select></label><label>Ordenes recientes de la sucursal<select id="recent-orders"><option value="">Cargando ordenes...</option></select></label><button class="consent-button" type="button" id="load-recent-order">Cargar orden reciente</button><label>O buscar por numero<input id="lookup-order-number" type="text" placeholder="#ORD-2026-0003"></label><button class="consent-button" type="button" id="load-order">Cargar orden</button><output class="technician-message" id="lookup-message" aria-live="polite"></output>';
  technicianPanel.prepend(lookupBox);
  const lookupBranch = lookupBox.querySelector('#lookup-branch');
  const recentOrders = lookupBox.querySelector('#recent-orders');
  const loadRecentOrderButton = lookupBox.querySelector('#load-recent-order');
  const lookupInput = lookupBox.querySelector('#lookup-order-number');
  const loadOrderButton = lookupBox.querySelector('#load-order');
  const lookupMessage = lookupBox.querySelector('#lookup-message');
  lookupBranch.value = branchSelect.value;
  async function loadRecentOrders() {
    recentOrders.innerHTML = '<option value="">Cargando ordenes...</option>';
    try {
      const response = await fetch(`http://localhost:8001/api/ordenes-recientes/${encodeURIComponent(lookupBranch.value)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'No se pudieron consultar las ordenes.');
      recentOrders.innerHTML = result.ordenes.length
        ? result.ordenes.map((order) => `<option value="${order.numero_orden}">${order.cliente} - ${order.numero_orden} (${order.fecha})${order.instalacion_guardada ? ' - Instalacion completada' : ''}</option>`).join('')
        : '<option value="">No hay ordenes en esta sucursal</option>';
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
  consentPanel.innerHTML = '<div class="panel-title with-badge">Consentimientos de la orden <b id="consent-count">0/4 aprobados</b></div><p class="consent-intro">Cada responsable debe aprobar la orden. Cliente, asesor e instaladores deben aprobar la orden antes de iniciar el trabajo.</p><div class="consent-list"></div><output class="consent-warning" hidden></output>';
  document.querySelector('main').append(consentPanel);
  const consentList = consentPanel.querySelector('.consent-list');
  const consentWarning = consentPanel.querySelector('.consent-warning');
  const consentRows = [
    { id: 'client', role: 'Cliente', required: true },
    { id: 'advisor', role: 'Asesor de ventas', required: true, email: 'sistemas@llantas247.com' },
    { id: 'tire-installer', role: 'Instalador de enllantaje', service: 'Enllantaje - Balanceo' },
    { id: 'alignment-installer', role: 'Instalador de alineacion', service: 'Alineación' }
  ];
  const savedConsent = JSON.parse(localStorage.getItem(`consent-${orderNumber}`) || '{}');
  consentRows.forEach(({ id, role, email }) => {
    const row = document.createElement('div');
    row.className = 'consent-row';
    row.dataset.consentId = id;
    row.innerHTML = `<strong class="consent-role">${role}</strong><input type="email" class="consent-email" placeholder="Correo electronico" aria-label="Correo de ${role}"><span class="consent-status">Pendiente</span><div class="consent-actions"><button type="button" class="consent-button notify-button">Notificar</button><button type="button" class="consent-button approve-button">Aprobar</button><button type="button" class="consent-button reject-button">Rechazar</button></div><p class="consent-note">Notificacion por correo disponible.</p>`;
    row.querySelector('.consent-email').value = email || '';
    const savedStatus = savedConsent[id]?.status;
    if (savedStatus) {
      row.dataset.status = savedStatus;
      row.querySelector('.consent-status').textContent = savedStatus === 'approved' ? 'Aprobado' : 'Rechazado';
      row.querySelector('.consent-status').classList.add(savedStatus);
    }
    row.querySelector('.notify-button').addEventListener('click', () => {
      notifyConsent(row, role);
    });
    row.querySelector('.approve-button').addEventListener('click', () => {
      setConsentStatus(row, 'approved');
      updateConsentState();
    });
    row.querySelector('.reject-button').addEventListener('click', () => {
      setConsentStatus(row, 'rejected');
      updateConsentState();
    });
    consentList.append(row);
  });

  document.querySelector('.consent-row[data-consent-id="client"] .consent-email').value = document.querySelector('#customer-email').value;
  if (!document.querySelector('#customer-email').value) document.querySelector('#customer-email').value = 'adriancorrea1234518@gmail.com';
  document.querySelector('.consent-row[data-consent-id="client"] .consent-email').value = document.querySelector('#customer-email').value;
  document.querySelector('#customer-email').addEventListener('input', (event) => {
    document.querySelector('.consent-row[data-consent-id="client"] .consent-email').value = event.target.value;
  });
  async function notifyConsent(row, role) {
    const email = row.querySelector('.consent-email').value.trim();
    if (!email) { lookupMessage.textContent = `Escribe el correo de ${role}.`; return; }
    try {
      const response = await fetch(`http://localhost:8001/api/notificar-consentimiento/${encodeURIComponent(orderNumber)}/${row.dataset.consentId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'No se pudo enviar la notificacion.');
      lookupMessage.textContent = `✓ ${result.mensaje}`;
    } catch (error) { lookupMessage.textContent = `Error: ${error.message}`; }
  }

  function setConsentStatus(row, status) {
    const statusLabel = row.querySelector('.consent-status');
    row.dataset.status = status;
    statusLabel.textContent = status === 'approved' ? 'Aprobado' : 'Rechazado';
    statusLabel.classList.remove('approved', 'rejected');
    statusLabel.classList.add(status);
    const consentState = JSON.parse(localStorage.getItem(`consent-${orderNumber}`) || '{}');
    consentState[row.dataset.consentId] = { status, at: new Date().toISOString() };
    localStorage.setItem(`consent-${orderNumber}`, JSON.stringify(consentState));
  }

  function updateConsentState() {
    const selectedServices = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    consentRows.forEach(({ id }) => {
      const row = consentList.querySelector(`[data-consent-id="${id}"]`);
      row.hidden = false;
      if (!['approved', 'rejected'].includes(row.dataset.status)) {
        row.dataset.status = 'pending';
        row.querySelector('.consent-status').textContent = 'Pendiente';
      }
    });
    const visibleRows = [...consentList.querySelectorAll('.consent-row:not([hidden])')];
    const approved = visibleRows.filter((row) => row.dataset.status === 'approved').length;
    consentPanel.querySelector('#consent-count').textContent = `${approved}/${visibleRows.length} aprobados`;
    consentWarning.hidden = approved === visibleRows.length;
    consentWarning.textContent = `Faltan ${visibleRows.length - approved} consentimiento(s) para completar la orden.`;
  }

  // --- POLLING DE CONSENTIMIENTOS EN TIEMPO REAL ---
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
      let datosGuardados = consentimientosBD[id] || null;
      if (datosGuardados) {
        const estadoBD = datosGuardados.estado;
        const nuevoStatus = estadoBD === 'aprobado' ? 'approved' : (estadoBD === 'rechazado' ? 'rejected' : 'pending');
        if (row.dataset.status !== nuevoStatus && nuevoStatus !== 'pending') {
          changed = true;
          const statusLabel = row.querySelector('.consent-status');
          row.dataset.status = nuevoStatus;
          statusLabel.textContent = nuevoStatus === 'approved' ? 'Aprobado' : 'Rechazado';
          statusLabel.classList.remove('approved', 'rejected', 'pending');
          statusLabel.classList.add(nuevoStatus);
          // Flash visual en la fila
          row.style.transition = 'background .3s, border-color .3s';
          row.style.background = nuevoStatus === 'approved' ? '#d9f8ed' : '#fff3f3';
          row.style.borderColor = nuevoStatus === 'approved' ? '#00bd7b' : '#ed0010';
          setTimeout(() => { row.style.background = ''; row.style.borderColor = ''; }, 2500);
          showConsentToast(role, estadoBD);
        }
      }
    });
    if (changed) updateConsentState();
  }

  function startConsentPolling(numeroOrden) {
    stopConsentPolling();
    consentPollingInterval = setInterval(async () => {
      // Detener si ya no hay filas pendientes
      const visibles = [...consentList.querySelectorAll('.consent-row:not([hidden])')]; 
      const hayPendientes = visibles.some((row) => !['approved', 'rejected'].includes(row.dataset.status));
      if (!hayPendientes) { stopConsentPolling(); return; }
      try {
        const res = await fetch(`http://localhost:8001/api/orden/${encodeURIComponent(numeroOrden)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.instalacion?.consentimientos) syncConsentFromDB(data.instalacion.consentimientos);
      } catch { /* silencioso */ }
    }, 5000);
  }
  // --- FIN POLLING ---

  licensePlate.addEventListener('input', () => {
    licensePlate.value = licensePlate.value.toUpperCase();
  });

  toggleAlarm.addEventListener('click', () => {
    const visible = alarmCode.type === 'text';
    alarmCode.type = visible ? 'password' : 'text';
    toggleAlarm.textContent = visible ? 'Mostrar' : 'Ocultar';
  });

  document.querySelectorAll('.brand-select').forEach((select) => {
    select.addEventListener('change', () => {
      const customBrand = select.closest('section, .technical-details').querySelector('.brand-custom');
      customBrand.hidden = select.value !== 'Otra marca';
      if (!customBrand.hidden) customBrand.querySelector('input').focus();
    });
  });

  loadOrderButton.addEventListener('click', async () => {
    const requestedNumber = lookupInput.value.trim().toUpperCase();
    if (!requestedNumber) {
      lookupMessage.textContent = 'Escribe el número de la orden.';
      return;
    }
    lookupMessage.textContent = 'Cargando orden...';
    try {
      const response = await fetch(`http://localhost:8001/api/orden/${encodeURIComponent(requestedNumber)}`);
      const order = await response.json();
      if (!response.ok) throw new Error(order.detail || 'No se pudo cargar la orden.');
      loadedOrder = true;
      orderSaved = true;
      setOrderNumber(order.numero_orden);
      const existingOrderButton = document.querySelector('#order-form .save-button');
      existingOrderButton.disabled = true;
      existingOrderButton.innerHTML = '<span>✓</span> Orden guardada';
      branchSelect.value = order.sucursal || branchSelect.value;
      lookupBranch.value = branchSelect.value;
      localStorage.setItem('llantas247-branch', branchSelect.value);
      orderDate.value = order.fecha;
      document.querySelector('#customer-name').value = order.cliente || '';
      document.querySelector('#customer-email').value = order.correo || '';
      document.querySelector('.consent-row[data-consent-id="client"] .consent-email').value = order.correo || '';
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
            document.querySelector(`#${id}`).value = newMeasure[index + 1];
          });
          document.querySelector('#old-tire-rim').dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.querySelector('#tire-quantity').value = installation.cantidad_llantas ?? '';
        serviceInputs.forEach((input) => { input.checked = (installation.servicios || []).includes(input.value); });
        document.querySelector('.notes-panel textarea').value = installation.observaciones_vendedor || '';
        updateSummary();
        licensePlate.value = installation.placa || '';
        document.querySelector('#technician-panel input[type="number"]').value = installation.kilometraje ?? '';
        alarmCode.value = installation.codigo_alarma || '';
        const oldMeasureText = installation.medida_llanta_vieja || installation.medida_llanta_nueva || '';
        document.querySelector('#old-tire-result').textContent = oldMeasureText || '-';
        const measure = oldMeasureText.match(/^(\d+)\/(\d+)R(\d+)$/);
        if (measure) {
          document.querySelector('#old-tire-width').value = measure[1];
          document.querySelector('#old-tire-height').value = measure[2];
          document.querySelector('#old-tire-rim').value = measure[3];
        }
        document.querySelector('#manufacture-code').value = installation.codigo_dot || '';
        document.querySelector('.technical-notes').value = installation.observaciones_ingreso || '';
        checklistInputs.forEach((input) => {
          const savedItem = (installation.elementos_presentes || []).find((item) => item === input.value || item.startsWith(`${input.value}: `));
          input.checked = Boolean(savedItem);
          const quantity = input.closest('.quantity-check')?.querySelector('.item-quantity');
          if (quantity) quantity.value = savedItem?.match(/: (\d+)$/)?.[1] || '';
        });
      }
      // --- LEER CONSENTIMIENTOS DESDE POSTGRESQL ---
      if (order.instalacion && order.instalacion.consentimientos) {
        const consentimientosBD = order.instalacion.consentimientos;
        consentRows.forEach(({ id }) => {
          const row = consentList.querySelector(`[data-consent-id="${id}"]`);
          let datosGuardados = null;
          if (id === 'client') datosGuardados = consentimientosBD['client'];
          if (id === 'advisor') datosGuardados = consentimientosBD['advisor'];
          if (datosGuardados) {
            const estadoBD = datosGuardados.estado; // 'pendiente', 'aprobado' o 'rechazado'
            const statusLabel = row.querySelector('.consent-status');
            row.dataset.status = estadoBD === 'aprobado' ? 'approved' : (estadoBD === 'rechazado' ? 'rejected' : 'pending');
            statusLabel.textContent = estadoBD === 'aprobado' ? 'Aprobado' : (estadoBD === 'rechazado' ? 'Rechazado' : 'Pendiente');
            statusLabel.classList.remove('approved', 'rejected', 'pending');
            if (estadoBD === 'aprobado') statusLabel.classList.add('approved');
            if (estadoBD === 'rechazado') statusLabel.classList.add('rejected');
          }
        });
        updateConsentState();
      }
      // --- FIN DE LEER CONSENTIMIENTOS ---
      checklistStatus.textContent = `${checklistInputs.filter((input) => input.checked).length} presentes`;
      document.querySelector('#order-summary-panel').hidden = true;
      lookupMessage.textContent = `✓ Orden ${order.numero_orden} cargada.`;
      // Iniciar polling para detectar aprobaciones en tiempo real
      startConsentPolling(order.numero_orden);
    } catch (error) {
      lookupMessage.textContent = `Error: ${error.message}`;
    }
  });

  function updateSummary() {
    const selected = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService.value.trim()) selected.push(otherService.value.trim());
    serviceCount.textContent = `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}`;
    summary.innerHTML = selected.length ? selected.map((name) => `<div class="summary-row"><span>${name}</span><small>-</small></div>`).join('') : '<span>No hay servicios seleccionados</span>';
  }

  serviceInputs.forEach((input) => input.addEventListener('change', () => {
    updateSummary();
    updateConsentState();
  }));
  otherService.addEventListener('input', updateSummary);
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

  function getPresentItems() {
    return checklistInputs.filter((input) => input.checked).map((input) => {
      const quantity = input.closest('.quantity-check')?.querySelector('.item-quantity');
      return quantity?.value ? `${input.value}: ${quantity.value}` : input.value;
    });
  }
  function updateChecklistStatus() {
    const completed = getPresentItems().length;
    checklistStatus.textContent = `${completed} presente${completed === 1 ? '' : 's'}`;
    checklistStatus.classList.toggle('complete', completed > 0);
  }
  checklistInputs.forEach((input) => input.addEventListener('change', updateChecklistStatus));
  quantityInputs.forEach((input) => input.addEventListener('input', () => {
    const checkbox = input.closest('.quantity-check').querySelector('input[type="checkbox"]');
    checkbox.checked = Number(input.value) > 0;
    updateChecklistStatus();
  }));

  ['tire-width', 'tire-height', 'tire-rim'].forEach((id) => document.querySelector(`#${id}`).addEventListener('input', () => {
    document.querySelector('#tire-result').textContent = `${document.querySelector('#tire-width').value || 0}/${document.querySelector('#tire-height').value || 0}R${document.querySelector('#tire-rim').value || 0}`;
  }));

  ['old-tire-width', 'old-tire-height', 'old-tire-rim'].forEach((id) => document.querySelector(`#${id}`).addEventListener('input', () => {
    document.querySelector('#old-tire-result').textContent = `${document.querySelector('#old-tire-width').value || 0}/${document.querySelector('#old-tire-height').value || 0}R${document.querySelector('#old-tire-rim').value || 0}`;
  }));

  const tireDimensionPairs = [
    ['tire-width', 'old-tire-width'],
    ['tire-height', 'old-tire-height'],
    ['tire-rim', 'old-tire-rim']
  ];
  const oldTireDimensionsEdited = new Set();
  tireDimensionPairs.forEach(([, oldId]) => {
    document.querySelector(`#${oldId}`).addEventListener('input', () => oldTireDimensionsEdited.add(oldId));
  });
  tireDimensionPairs.forEach(([newId, oldId]) => {
    document.querySelector(`#${newId}`).addEventListener('input', () => {
      const oldInput = document.querySelector(`#${oldId}`);
      if (!oldTireDimensionsEdited.has(oldId)) oldInput.value = document.querySelector(`#${newId}`).value;
      oldInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  function displayValue(value) {
    return value && value.trim() ? value.trim() : 'No registrado';
  }

  function updateOrderSummary() {
    const newBrand = document.querySelector('#new-brand').value;
    const oldBrand = document.querySelector('.technical-details .brand-select').value;
    const services = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService.value.trim()) services.push(otherService.value.trim());
    const presentItems = getPresentItems();
    const rows = [
      ['Cliente', document.querySelector('#customer-name').value],
      ['Sucursal', branchSelect.value],
      ['Correo electrónico', document.querySelector('#customer-email').value],
      ['Teléfono', document.querySelector('#customer-phone').value],
      ['Fecha', document.querySelector('#order-date').value],
      ['Asesor de ventas', salespersonSelect.value === 'Otro asesor' ? customSalespersonName.value : salespersonSelect.value],
      ['Cantidad de llantas', document.querySelector('#tire-quantity').value],
      ['Llanta nueva', `${newBrand || 'No registrada'} - ${document.querySelector('#tire-result').textContent}`],
      ['Servicios contratados', services.length ? services.join(', ') : 'Ninguno'],
      ['Observaciones del vendedor', document.querySelector('.notes-panel textarea').value],
      ['Placa', document.querySelector('#license-plate').value],
      ['Kilometraje', document.querySelector('#technician-panel input[type="number"]').value],
      ['Código de alarma', document.querySelector('#alarm-code').value],
      ['Llanta vieja', `${oldBrand || 'No registrada'} - ${document.querySelector('#old-tire-result').textContent}`],
      ['Código DOT', document.querySelector('#manufacture-code').value],
      ['Elementos presentes al recibir', presentItems.length ? presentItems.join(', ') : 'Ninguno marcado'],
      ['Observaciones de ingreso', document.querySelector('.technical-notes').value]
    ];
    document.querySelector('#order-summary-body').innerHTML = rows.map(([label, value]) => `<tr><th>${label}</th><td>${displayValue(value)}</td></tr>`).join('');
    document.querySelector('#order-summary-panel').hidden = false;
  }

  document.querySelector('#order-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('#save-message');
    const submitButton = document.querySelector('#order-form .save-button');
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
      const response = await fetch('http://localhost:8001/api/guardar-orden', {
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
      }
      message.textContent = `✓ ${result.mensaje || 'Orden guardada correctamente'}`;
      submitButton.disabled = true;
      submitButton.innerHTML = '<span>✓</span> Orden guardada';
      updateOrderSummary();
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
    const oldTireBrand = document.querySelector('#technician-panel .brand-select').value;
    const installationData = {
      placa: licensePlate.value.trim(),
      kilometraje: document.querySelector('#technician-panel input[type="number"]').value ? Number(document.querySelector('#technician-panel input[type="number"]').value) : null,
      codigo_alarma: alarmCode.value,
      marca_llanta_vieja: oldTireBrand,
      medida_llanta_vieja: document.querySelector('#old-tire-result').textContent,
      codigo_dot: document.querySelector('#manufacture-code').value,
      elementos_presentes: getPresentItems(),
      observaciones_ingreso: document.querySelector('.technical-notes').value.trim()
    };
    saveButton.disabled = true;
    message.textContent = 'Guardando instalación...';
    try {
      const response = await fetch(`http://localhost:8001/api/guardar-instalacion/${encodeURIComponent(orderNumber)}`, {
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
    stopConsentPolling(); // Cancelar polling al limpiar la orden
    if (!window.confirm('Se limpiaran los datos de la pantalla para crear una nueva orden. La orden ya guardada no se borrara.')) return;
    document.querySelector('#order-form').reset();
    technicianPanel.querySelectorAll('input, textarea, select').forEach((field) => {
      if (field.type === 'checkbox') field.checked = false;
      else if (field.id !== 'license-plate') field.value = '';
    });
    orderDate.value = new Date().toISOString().slice(0, 10);
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
      row.querySelector('.consent-status').classList.remove('approved', 'rejected');
      row.querySelector('.consent-email').value = '';
    });
    updateConsentState();
    document.querySelector('#order-form').hidden = false;
    technicianPanel.hidden = true;
    document.querySelector('[data-view="seller"]').click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  clearOrderButton.addEventListener('click', () => newInstallationOrderButton.click());

  document.querySelector('#print-order').addEventListener('click', () => window.print());
});
