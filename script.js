document.addEventListener('DOMContentLoaded', () => {
  // =======================================================
  // 1. VARIABLES GLOBALES Y ELEMENTOS DEL DOM
  // =======================================================
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const loginMessage = document.getElementById('login-message');
  const logoutButton = document.getElementById('logout-button');

  let orderNumber = '#ORD-2026-0000';
  let loadedOrder = false;
  let orderSaved = false;
  let consentPollingInterval = null;
  let damagePins = [];
  let datosReporteActual = []; 

  const statusNumber = document.querySelector('#header-order-number');
  const summaryNumber = document.querySelector('#summary-order-number');
  const branchSelect = document.querySelector('#branch-select');
  const orderDate = document.querySelector('#order-date');
  const headerDate = document.querySelector('.heading-meta span strong');
  
  const serviceInputs = [...document.querySelectorAll('#services-list input')];
  const otherService = document.querySelector('#other-service');
  const summary = document.querySelector('#summary');
  const serviceCount = document.querySelector('#service-count');
  
  const checklistInputs = [...document.querySelectorAll('#checklist input[type="checkbox"]')];
  const quantityInputs = [...document.querySelectorAll('#checklist .item-quantity')];
  const checklistStatus = document.querySelector('#checklist-status');
  const licensePlate = document.querySelector('#license-plate');
  const technicianPanel = document.querySelector('#technician-panel');
  const orderForm = document.querySelector('#order-form');
  
  const newInstallationOrderButton = document.querySelector('#new-installation-order');
  const clearOrderButton = document.querySelector('#clear-order');
  const saveTechnicianBtn = document.querySelector('#save-technician');
  const printBtn = document.querySelector('#print-order');

  // Variables globales del buscador unificadas
  let lookupInput, loadOrderButton, lookupBranch, recentOrders, loadRecentOrderButton, lookupMessage;

  if (sessionStorage.getItem('llantas_auth_token')) mostrarApp();

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
      
      mostrarApp();
    } catch (error) {
      loginMessage.textContent = error.message;
    }
  });

  logoutButton.addEventListener('click', () => {
    sessionStorage.clear();
    location.reload();
  });

  function mostrarApp() {
    loginContainer.style.display = 'none';
    appContainer.hidden = false;
    
    const role = sessionStorage.getItem('llantas_user_role');
    const userName = sessionStorage.getItem('llantas_user_name'); 
    
    const userBadge = document.getElementById('current-user-badge');
    if (userBadge) {
      userBadge.innerHTML = `👤 ${userName} <span style="font-size: 9px; color: var(--muted);">(${role})</span>`;
    }
    
    if (role === 'reporteria') {
      document.querySelector('.views').style.display = 'none';
      document.querySelector('.views-reporter').hidden = false;
      document.querySelector('.order-number').style.display = 'none';
      
      if(orderForm) orderForm.style.display = 'none';
      if(technicianPanel) technicianPanel.style.display = 'none';
      
      document.querySelector('.page-heading').querySelector('div:first-child').innerHTML = '<h1 id="page-title">Estadísticas y Reportes</h1>';
      
      const reporterPanel = document.querySelector('#reporter-panel');
      if(reporterPanel) {
        reporterPanel.hidden = false;
        reporterPanel.style.display = 'block';
      }
      
      const consentSec = document.querySelector('.consent-panel');
      if (consentSec) consentSec.style.display = 'none';
    } else {
      const reporterPanel = document.querySelector('#reporter-panel');
      if(reporterPanel) {
        reporterPanel.hidden = true;
        reporterPanel.style.display = 'none';
      }
      
      if(orderForm && role !== 'tecnico') orderForm.style.display = 'grid';

      const targetView = role === 'tecnico' ? 'technician' : 'seller';
      setTimeout(() => {
        const viewButton = document.querySelector(`[data-view="${targetView}"]`);
        if (viewButton) viewButton.click();
      }, 50);
    }
  }

  // =======================================================
  // 2. REPORTERÍA Y EXCEL
  // =======================================================
  document.getElementById('btn-generar-reporte')?.addEventListener('click', async () => {
    const inicio = document.getElementById('rep-inicio').value;
    const fin = document.getElementById('rep-fin').value;
    const asesor = document.getElementById('rep-asesor').value;
    const sucursal = document.getElementById('rep-sucursal').value;
    
    const tbody = document.querySelector('#tabla-reportes tbody');
    const totalEl = document.getElementById('rep-total');
    const btnExportar = document.getElementById('btn-exportar-csv');
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Cargando información...</td></tr>';
    btnExportar.style.display = 'none';
    
    try {
      let url = '/api/reportes?';
      if (inicio) url += `fecha_inicio=${inicio}&`;
      if (fin) url += `fecha_fin=${fin}&`;
      if (asesor) url += `asesor=${encodeURIComponent(asesor)}&`;
      if (sucursal) url += `sucursal=${encodeURIComponent(sucursal)}&`;
      
      const res = await fetch(url);
      const data = await res.json();
      datosReporteActual = data.reportes; 
      
      if (datosReporteActual.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--red);">No se encontraron órdenes con estos filtros</td></tr>';
        totalEl.textContent = '0 encontradas';
        return;
      }
      
      tbody.innerHTML = datosReporteActual.map(r => `
        <tr>
          <td><strong style="color:var(--navy); font-family:monospace;">${r.numero_orden}</strong></td>
          <td>${r.fecha}</td>
          <td>${r.sucursal}</td>
          <td>${r.asesor || '-'}</td>
          <td>${r.cliente}</td>
          <td><strong style="color:#ed0010;">${r.placa}</strong></td>
          <td style="font-size: 11px;">${r.servicios}</td>
        </tr>
      `).join('');
      
      totalEl.textContent = `${datosReporteActual.length} encontrada(s)`;
      btnExportar.style.display = 'block'; 
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--red);">Error al cargar reporte: ${e.message}</td></tr>`;
    }
  });

  document.getElementById('btn-exportar-csv')?.addEventListener('click', () => {
    if (datosReporteActual.length === 0) return;
    let csvContent = "No. Orden,Fecha,Sucursal,Asesor,Cliente,Placa,Servicios\n";
    datosReporteActual.forEach(r => {
      const clienteStr = r.cliente.replace(/,/g, '');
      const serviciosStr = r.servicios.replace(/,/g, ' |'); 
      csvContent += `${r.numero_orden},${r.fecha},${r.sucursal},${r.asesor},${clienteStr},${r.placa},${serviciosStr}\n`;
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Llantas247_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  const savedBranch = localStorage.getItem('llantas247-branch');
  if (savedBranch && branchSelect && [...branchSelect.options].some((opt) => opt.value === savedBranch)) {
    branchSelect.value = savedBranch;
  }

  function updateHeaderDate() {
    if (!orderDate || !orderDate.value) return;
    const [year, month, day] = orderDate.value.split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    if (headerDate) headerDate.textContent = `${day} de ${meses[parseInt(month, 10) - 1]} de ${year}`;
  }

  if (orderDate && !orderDate.value) orderDate.value = new Date().toISOString().slice(0, 10);
  updateHeaderDate(); 
  if(orderDate) orderDate.addEventListener('input', updateHeaderDate); 

  const setOrderNumber = (number) => {
    orderNumber = number;
    if(statusNumber) statusNumber.textContent = orderNumber;
    if(summaryNumber) summaryNumber.textContent = orderNumber;
    const invoiceNumberEl = document.querySelector('.invoice-number');
    if (invoiceNumberEl) invoiceNumberEl.textContent = orderNumber;
  };

  const loadNextOrderNumber = async () => {
    if(!orderDate) return;
    try {
      const response = await fetch(`/api/proximo-numero/${orderDate.value.slice(0, 4)}`);
      const result = await response.json();
      if (!response.ok) throw new Error();
      setOrderNumber(result.numero_orden);
    } catch (error) {
      if(statusNumber) statusNumber.textContent = 'Consecutivo no disponible';
    }
  };

  if(branchSelect) {
    branchSelect.addEventListener('change', () => {
      localStorage.setItem('llantas247-branch', branchSelect.value);
      const kicker = document.querySelector('.invoice-kicker');
      if(kicker) kicker.textContent = `Gestión de taller · ${branchSelect.value}`;
    });
  }

  const salespersonSelect = document.querySelector('#salesperson');
  const customSalespersonLabel = document.createElement('label');
  customSalespersonLabel.className = 'salesperson-custom';
  customSalespersonLabel.hidden = true;
  customSalespersonLabel.innerHTML = 'Nombre del asesor<input id="salesperson-custom-name" type="text" placeholder="Escriba el nombre">';
  
  if(salespersonSelect) {
    salespersonSelect.closest('label').after(customSalespersonLabel);
    const customSalespersonName = customSalespersonLabel.querySelector('input');
    salespersonSelect.insertAdjacentHTML('beforeend', '<option value="Otro asesor">Otro asesor</option>');
    salespersonSelect.addEventListener('change', () => {
      customSalespersonLabel.hidden = salespersonSelect.value !== 'Otro asesor';
      if (!customSalespersonLabel.hidden) customSalespersonName.focus();
    });
  }

  const invoicePanel = document.querySelector('#order-summary-panel');
  if(invoicePanel) {
    const invoiceHeader = document.createElement('div');
    invoiceHeader.className = 'invoice-header';
    invoiceHeader.innerHTML = '<div><img class="invoice-brand" src="assets/images/llantas247_logo.jpg" alt="Llantas 247"><h2 class="invoice-heading">Orden de servicio</h2><p class="invoice-kicker"></p></div><strong class="invoice-number"></strong>';
    invoiceHeader.querySelector('.invoice-kicker').textContent = `Gestión de taller · ${branchSelect?.value || 'Granados'}`;
    invoiceHeader.querySelector('.invoice-number').textContent = orderNumber;
    const invoiceAccent = document.createElement('div');
    invoiceAccent.className = 'invoice-accent';
    invoicePanel.prepend(invoiceHeader);
    invoicePanel.prepend(invoiceAccent);
  }

  // =======================================================
  // 3. BUSCADOR Y MAPA DE DAÑOS
  // =======================================================
  const lookupBox = document.createElement('div');
  lookupBox.className = 'order-lookup';
  lookupBox.innerHTML = '<label>Seleccionar sucursal<select id="lookup-branch"><option>Granados</option><option>Valle de los Chillos</option><option>Guayaquil</option></select></label><label>Órdenes recientes de la sucursal<select id="recent-orders"><option value="">Cargando órdenes...</option></select></label><button class="consent-button" type="button" id="load-recent-order">Cargar orden reciente</button><label>O buscar por número<input id="lookup-order-number" type="text" placeholder="#ORD-2026-0003"></label><button class="consent-button" type="button" id="load-order">Cargar orden</button><output class="technician-message" id="lookup-message" aria-live="polite"></output>';
  if(technicianPanel) technicianPanel.prepend(lookupBox);
  
  // Inicializamos las referencias usando la caja creada
  lookupBranch = lookupBox.querySelector('#lookup-branch');
  recentOrders = lookupBox.querySelector('#recent-orders');
  loadRecentOrderButton = lookupBox.querySelector('#load-recent-order');
  lookupInput = lookupBox.querySelector('#lookup-order-number');
  loadOrderButton = lookupBox.querySelector('#load-order');
  lookupMessage = lookupBox.querySelector('#lookup-message');
  
  if(lookupBranch) lookupBranch.value = branchSelect?.value || 'Granados';

  let damageMapContainer = document.querySelector('#damage-map-container');
  if (!damageMapContainer && technicianPanel) {
    const damageSectionWrapper = document.createElement('div');
    damageSectionWrapper.innerHTML = `<div class="panel-title">Mapa de daños del vehículo</div><p class="checklist-help" style="margin:0 20px 10px;color:var(--muted);font-size:12px">Haga clic en la imagen para marcar golpes o rayones. Haga clic sobre un punto rojo para eliminarlo.</p><div class="damage-map-wrapper"><div id="damage-map-container" class="damage-map-container"><img src="assets/images/mapa de daño.png" alt="Mapa del vehículo"></div></div>`;
    
    if (checklistStatus) {
      checklistStatus.closest('.panel-title').before(damageSectionWrapper);
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
    if(!recentOrders) return;
    recentOrders.innerHTML = '<option value="">Cargando órdenes...</option>';
    try {
      const response = await fetch(`/api/ordenes-recientes/${encodeURIComponent(lookupBranch.value)}`);
      const result = await response.json();
      if (!response.ok) throw new Error('Error al consultar.');
      recentOrders.innerHTML = result.ordenes.length
        ? result.ordenes.map((order) => `<option value="${order.numero_orden}">${order.cliente} - ${order.numero_orden} (${order.fecha})${order.instalacion_guardada ? ' - Instalada' : ''}</option>`).join('')
        : '<option value="">No hay órdenes en esta sucursal</option>';
    } catch (error) {
      recentOrders.innerHTML = '<option value="">Error de red</option>';
    }
  }

  if(lookupBranch) lookupBranch.addEventListener('change', loadRecentOrders);
  if(loadRecentOrderButton) {
    loadRecentOrderButton.addEventListener('click', () => {
      if (!recentOrders.value) {
        lookupMessage.textContent = 'Seleccione una orden válida de la lista.';
        return;
      }
      lookupInput.value = recentOrders.value;
      loadOrderButton.click();
    });
  }

  if(lookupInput) {
    lookupInput.addEventListener('input', () => {
      const typedNumber = lookupInput.value.trim().toUpperCase();
      if (/^#ORD-\d{4}-\d{4}$/.test(typedNumber)) setOrderNumber(typedNumber);
    });
  }

  if(loadOrderButton) {
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
        if (!response.ok) throw new Error('No se pudo cargar la orden.');
        
        loadedOrder = true;
        orderSaved = true;
        setOrderNumber(order.numero_orden);
        sessionStorage.setItem('activeOrderNumber', order.numero_orden);

        const existingOrderButton = document.querySelector('#order-form .save-button');
        if (existingOrderButton) {
          existingOrderButton.disabled = true;
          existingOrderButton.innerHTML = '<span>✓</span> Orden guardada';
        }
        
        if(branchSelect) branchSelect.value = order.sucursal || branchSelect.value;
        if(lookupBranch) lookupBranch.value = order.sucursal || lookupBranch.value;
        localStorage.setItem('llantas247-branch', order.sucursal);
        if(orderDate) orderDate.value = order.fecha;
        updateHeaderDate();
        
        document.querySelector('#customer-name').value = order.cliente || '';
        document.querySelector('#customer-email').value = order.correo || '';
        document.querySelector('#customer-phone').value = order.telefono || '';
        
        if (salespersonSelect) {
          if ([...salespersonSelect.options].some((option) => option.value === order.asesor)) {
              salespersonSelect.value = order.asesor || '';
          } else {
              salespersonSelect.value = 'Otro asesor';
              document.querySelector('#salesperson-custom-name').value = order.asesor;
              document.querySelector('.salesperson-custom').hidden = false;
          }
        }

        if (order.instalacion) {
          const installation = order.instalacion;
          document.querySelector('#new-brand').value = installation.marca_llanta_nueva || '';
          const newMeasure = (installation.medida_llanta_nueva || '').match(/^(\d+)\/(\d+)R(\d+)$/);
          if (newMeasure) {
            document.querySelector('#tire-width').value = newMeasure[1];
            document.querySelector('#tire-height').value = newMeasure[2];
            document.querySelector('#tire-rim').value = newMeasure[3];
            document.querySelector('#tire-result').textContent = installation.medida_llanta_nueva;
          }
          document.querySelector('#tire-quantity').value = installation.cantidad_llantas ?? '';
          serviceInputs.forEach((input) => { input.checked = (installation.servicios || []).includes(input.value); });
          document.querySelector('.notes-panel textarea').value = installation.observaciones_vendedor || '';
          
          if(licensePlate) licensePlate.value = installation.placa || '';
          const kmEl = document.querySelector('#technician-panel input[type="number"]');
          if (kmEl) kmEl.value = installation.kilometraje ?? '';
          
          const oldMeasureText = installation.medida_llanta_vieja || '';
          document.querySelector('#old-tire-result').textContent = oldMeasureText || '-';
          const measure = oldMeasureText.match(/^(\d+)\/(\d+)R(\d+)$/);
          if (measure) {
            document.querySelector('#old-tire-width').value = measure[1];
            document.querySelector('#old-tire-height').value = measure[2];
            document.querySelector('#old-tire-rim').value = measure[3];
          }
          
          const oldBrandSelect = document.querySelector('#old-brand-select');
          if(oldBrandSelect) oldBrandSelect.value = installation.marca_llanta_vieja || '';

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
        
        if(checklistStatus) checklistStatus.textContent = `${checklistInputs.filter((input) => input.checked).length} presentes`;
        if(invoicePanel) invoicePanel.hidden = true;
        lookupMessage.textContent = `✓ Orden ${order.numero_orden} cargada.`;
        
        updateOrderSummary();
        startConsentPolling(order.numero_orden);
      } catch (error) {
        lookupMessage.textContent = `Error: ${error.message}`;
      }
    });
  }

  // =======================================================
  // 4. CONSENTIMIENTOS Y FIRMAS
  // =======================================================
  const consentPanel = document.createElement('section');
  consentPanel.className = 'panel consent-panel';
  consentPanel.innerHTML = '<div class="panel-title with-badge">Firmas y Autorizaciones <b id="consent-count">0/5 aprobados</b></div><p class="consent-intro">Cada responsable debe aprobar la orden antes de iniciar el trabajo.</p><div class="consent-list"></div><output class="consent-warning" hidden></output>';
  if(document.querySelector('main')) document.querySelector('main').append(consentPanel);
  const consentList = consentPanel.querySelector('.consent-list');
  const consentWarning = consentPanel.querySelector('.consent-warning');
  
  const consentRows = [
    { id: 'client_datos', role: 'Cliente (Protección Datos)', required: true },
    { id: 'client_reciclaje', role: 'Cliente (Reciclaje)', required: true },
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
    const userRole = sessionStorage.getItem('llantas_user_role');
    let showApproveBtn = false;
    if (userRole === 'admin') showApproveBtn = true;
    if (userRole === 'tecnico' && id.startsWith('client_')) showApproveBtn = true;
    if (userRole === 'asesor' && id.startsWith('client_')) showApproveBtn = true;

    const btnAprobarLocal = showApproveBtn 
      ? `<button type="button" class="btn-mini-action btn-approve local-approve-btn" style="background:#d1fae5; margin-left:5px;">Aprobar</button>` 
      : '';

    row.innerHTML = `<strong class="consent-role">${role}</strong>
      <input type="email" class="consent-email" placeholder="Correo electrónico" aria-label="Correo de ${role}">
      <span class="consent-status">Pendiente</span>
      <div class="consent-actions">
        <button type="button" class="consent-button notify-button" ${hideButtonStr}>Notificar</button>
        ${btnAprobarLocal}
      </div>
      <p class="consent-note">Notificación por correo disponible.</p>`;
    
    row.querySelector('.consent-email').value = email || '';
    const savedStatus = savedConsent[id]?.status;
    if (savedStatus) setConsentStatus(row, savedStatus);
    
    row.querySelector('.notify-button').addEventListener('click', () => notifyConsent(row, role));
    
    const btnApprove = row.querySelector('.local-approve-btn');
    if (btnApprove) {
      btnApprove.addEventListener('click', async () => {
        try {
          const res = await fetch(`/api/aprobar-local/${encodeURIComponent(orderNumber)}/${id}`, { method: 'POST' });
          if(res.ok) {
            setConsentStatus(row, 'approved');
            updateConsentState();
            updateOrderSummary();
          }
        } catch(e) { console.error('Error aprobando local', e) }
      });
    }

    if(consentList) consentList.append(row);
  });

  const mainEmailInput = document.querySelector('#customer-email');
  if(mainEmailInput) {
    mainEmailInput.addEventListener('input', (event) => {
      const rowDatosEmail = document.querySelector('.consent-row[data-consent-id="client_datos"] .consent-email');
      const rowReciclajeEmail = document.querySelector('.consent-row[data-consent-id="client_reciclaje"] .consent-email');
      if(rowDatosEmail) rowDatosEmail.value = event.target.value;
      if(rowReciclajeEmail) rowReciclajeEmail.value = event.target.value;
    });
  }

  async function notifyConsent(row, role) {
    const email = row.querySelector('.consent-email').value.trim();
    if (!email) { 
      alert(`Escribe el correo de ${role}`);
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
      } else {
        await fetch(`/api/notificar-consentimiento/${encodeURIComponent(orderNumber)}/${consentId}`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: email }) 
        });
        setConsentStatus(row, 'notified');
      }
      
      updateConsentState();
      if (!consentPollingInterval) startConsentPolling(orderNumber);
    } catch (error) { 
      console.error('Error enviando notificación:', error);
    }
  }

  function setConsentStatus(row, status) {
    if(!row) return;
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
      const localBtn = row.querySelector('.local-approve-btn');
      if(localBtn) localBtn.style.display = 'none';
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
    if(!consentList) return;
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
    
    const consentCount = consentPanel.querySelector('#consent-count');
    if(consentCount) consentCount.textContent = `${approved}/${visibleRows.length} aprobados`;
    
    if(consentWarning) {
      consentWarning.hidden = approved === visibleRows.length;
      consentWarning.textContent = `Faltan ${visibleRows.length - approved} autorización(es) para guardar u operar la orden.`;
    }
  }

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
    if(!consentList) return;
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
          if (estadoBD === 'aprobado' || estadoBD === 'rechazado') showConsentToast(role, estadoBD);
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
      if(!consentList) { stopConsentPolling(); return; }
      const visibles = [...consentList.querySelectorAll('.consent-row:not([hidden])')]; 
      const hayPendientes = visibles.some((row) => row.dataset.status === 'pending' || row.dataset.status === 'notified');
      if (!hayPendientes) { stopConsentPolling(); return; }
      
      try {
        const url = `/api/orden/${encodeURIComponent(numeroOrden)}?t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.instalacion?.consentimientos) syncConsentFromDB(data.instalacion.consentimientos);
      } catch { }
    }, 5000);
  }

  // =======================================================
  // 5. VISTAS Y AUTO-COPIADO
  // =======================================================
  document.querySelectorAll('.view-button').forEach((button) => {
    button.addEventListener('click', () => {
      if(button.id === 'logout-button') return;
      document.querySelectorAll('.view-button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const technician = button.dataset.view === 'technician';
      
      if(orderForm) orderForm.hidden = technician;
      if(technicianPanel) technicianPanel.hidden = !technician;
      
      const pageTitle = document.querySelector('#page-title');
      const headingKicker = document.querySelector('#heading-kicker');
      if(headingKicker) headingKicker.textContent = technician ? 'Datos para instalación' : 'Formulario de creación';
      if(pageTitle) pageTitle.textContent = technician ? 'Información del técnico' : 'Nueva Orden de Servicio';
      
      if (technician && document.querySelector('#old-tire-width') && !document.querySelector('#old-tire-width').value) {
         document.querySelector('#old-tire-width').value = document.querySelector('#tire-width')?.value || '';
         document.querySelector('#old-tire-height').value = document.querySelector('#tire-height')?.value || '';
         document.querySelector('#old-tire-rim').value = document.querySelector('#tire-rim')?.value || '';
         
         const newBrand = document.querySelector('#new-brand')?.value || '';
         const oldBrandSelect = document.querySelector('#old-brand-select');
         if(oldBrandSelect) {
           if ([...oldBrandSelect.options].some(opt => opt.value === newBrand)) {
               oldBrandSelect.value = newBrand;
           } else if (newBrand) {
               oldBrandSelect.value = 'Otra marca';
               const customField = document.querySelector('#technician-panel .brand-custom input');
               if(customField) {
                 customField.value = newBrand;
                 customField.closest('label').hidden = false;
               }
           }
         }
         document.querySelector('#old-tire-rim')?.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (technician) {
        if (!loadedOrder && statusNumber) statusNumber.textContent = 'Selecciona una orden';
        if(lookupBranch && branchSelect) lookupBranch.value = branchSelect.value;
        if(typeof loadRecentOrders === 'function') loadRecentOrders();
        if(technicianPanel) technicianPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

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

  serviceInputs.forEach((input) => input.addEventListener('change', () => {
    updateSummary();
    updateConsentState();
  }));

  if(licensePlate) licensePlate.addEventListener('input', () => { licensePlate.value = licensePlate.value.toUpperCase(); });
  const customerPhone = document.querySelector('#customer-phone');
  if (customerPhone) customerPhone.addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10); });

  document.querySelectorAll('.brand-select').forEach((select) => {
    select.addEventListener('change', () => {
      const customBrand = select.closest('section, .technical-details')?.querySelector('.brand-custom');
      if (customBrand) {
        customBrand.hidden = select.value !== 'Otra marca';
        if (!customBrand.hidden) customBrand.querySelector('input')?.focus();
      }
    });
  });

  if(checklistStatus) {
    checklistInputs.forEach((input) => input.addEventListener('change', () => {
      const completed = getPresentItems().length;
      checklistStatus.textContent = `${completed} presente${completed === 1 ? '' : 's'}`;
      checklistStatus.classList.toggle('complete', completed > 0);
    }));
    quantityInputs.forEach((input) => input.addEventListener('input', () => {
      const checkbox = input.closest('.quantity-check')?.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = Number(input.value) > 0;
      checklistInputs[0].dispatchEvent(new Event('change'));
    }));
  }

  function getPresentItems() {
    return checklistInputs.filter((input) => input.checked).map((input) => {
      const quantity = input.closest('.quantity-check')?.querySelector('.item-quantity');
      return quantity?.value ? `${input.value}: ${quantity.value}` : input.value;
    });
  }

  function updateSummary() {
    const selected = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService && otherService.value.trim()) selected.push(otherService.value.trim());
    if (serviceCount) serviceCount.textContent = `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}`;
    if (summary) summary.innerHTML = selected.length ? selected.map((name) => `<div class="summary-row"><span>${name}</span><small>-</small></div>`).join('') : '<span>No hay servicios seleccionados</span>';
  }

  // RESUMEN Y PDF
  function updateOrderSummary() {
    const newBrand = document.querySelector('#new-brand')?.value || '';
    const oldBrand = (document.querySelector('#technician-panel .brand-select'))?.value || '';
    const services = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService && otherService.value.trim()) services.push(otherService.value.trim());
    
    let pinsSummaryHtml = '';
    if(damagePins.length > 0) {
      pinsSummaryHtml = damagePins.map(pin => `<div style="position:absolute; width:10px; height:10px; background:#ed0010; border:2px solid #fff; border-radius:50%; left:${pin.x}%; top:${pin.y}%; transform:translate(-50%,-50%); -webkit-print-color-adjust:exact; print-color-adjust:exact;"></div>`).join('');
    }
    const mapPreviewHtml = `<div style="position:relative; display:inline-block; border:1px solid #ccc; border-radius:4px; overflow:hidden; max-width:240px; background:#fff;"><img src="assets/images/mapa de daño.png" alt="Mapa de daños" style="display:block; width:100%; height:auto;" />${pinsSummaryHtml}</div>`;

    const presentItems = getPresentItems();
    
    let firmasHtml = '';
    if (consentList) {
        const visibleConsentRows = Array.from(consentList.querySelectorAll('.consent-row:not([hidden])'));
        firmasHtml = visibleConsentRows.map(row => {
          const role = row.querySelector('.consent-role').textContent;
          const status = row.dataset.status;
          
          let statusDisplay = '<br>Firma en físico: ___________________________________';
          if (status === 'approved') statusDisplay = '<span style="color: #00bd7b; font-weight: bold; font-size: 13px;">✓ Aprobado y firmado digitalmente</span>';
          else if (status === 'rejected') statusDisplay = '<span style="color: #ed0010; font-weight: bold;">✗ Rechazado digitalmente</span>';
          else if (status === 'notified') statusDisplay = '<span style="color: #3b82f6;">⏳ Notificado (Esperando respuesta)</span><br><br>Firma en físico: ___________________________________';
          
          return `<div style="margin-bottom: 15px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
                    <strong style="color: #111827; text-transform: uppercase;">${role}:</strong><br>
                    ${statusDisplay}
                  </div>`;
        }).join('');
    }

    const salespersonVal = document.querySelector('#salesperson')?.value;
    const finalSalesperson = salespersonVal === 'Otro asesor' ? document.querySelector('#salesperson-custom-name')?.value : salespersonVal;

    const rows = [
      ['Cliente', document.querySelector('#customer-name')?.value || ''],
      ['Sucursal', branchSelect?.value || ''],
      ['Correo electrónico', document.querySelector('#customer-email')?.value || ''],
      ['Teléfono', document.querySelector('#customer-phone')?.value || ''],
      ['Fecha', document.querySelector('#order-date')?.value || ''],
      ['Asesor de ventas', finalSalesperson || ''],
      ['Cantidad de llantas', document.querySelector('#tire-quantity')?.value || ''],
      ['Llanta nueva', `${newBrand || 'No registrada'} - ${document.querySelector('#tire-result')?.textContent || '-'}`],
      ['Servicios contratados', services.length ? services.join(', ') : 'Ninguno'],
      ['Observaciones del vendedor', document.querySelector('.notes-panel textarea')?.value || ''],
      ['Placa', document.querySelector('#license-plate')?.value || ''],
      ['Kilometraje', document.querySelector('#technician-panel input[type="number"]')?.value || ''],
      ['Llanta vieja', `${oldBrand || 'No registrada'} - ${document.querySelector('#old-tire-result')?.textContent || '-'}`],
      ['Código DOT', document.querySelector('#manufacture-code')?.value || ''],
      ['Elementos presentes al recibir', presentItems.length ? presentItems.join(', ') : 'Ninguno marcado'],
      ['Mapa de daños del vehículo', (damagePins.length > 0) ? mapPreviewHtml : 'Sin daños reportados'],
      ['Observaciones de ingreso', document.querySelector('.technical-notes')?.value || ''],
      ['Firmas y Autorizaciones', firmasHtml || 'No hay responsables asignados']
    ];

    const summaryBody = document.querySelector('#order-summary-body');
    if (summaryBody) {
      summaryBody.innerHTML = rows.map(([label, value]) => `<tr><th>${label}</th><td>${value || 'No registrado'}</td></tr>`).join('');
    }
    const summaryPanel = document.querySelector('#order-summary-panel');
    if (summaryPanel) summaryPanel.hidden = false;
  }

  // BOTONES FINALES
  if (newInstallationOrderButton) {
    newInstallationOrderButton.innerHTML = '➕ Crear Nueva Orden';
    newInstallationOrderButton.style.display = 'inline-block';
    const orderActions = document.querySelector('.order-actions');
    if (orderActions) orderActions.appendChild(newInstallationOrderButton);
  }

  if(orderForm) {
    orderForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = document.querySelector('#save-message');
      const submitButton = document.querySelector('#order-form .save-button');
      
      const advisorRow = document.querySelector('.consent-list [data-consent-id="advisor"]');
      const advisorStatus = advisorRow ? advisorRow.dataset.status : 'pending';
      
      if (advisorStatus !== 'approved') {
        message.style.color = 'var(--red)';
        message.textContent = '⚠️ Falta aprobación del asesor: Debe aceptar la notificación enviada a su correo o aprobarla localmente antes de guardar.';
        message.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (orderSaved) {
        message.textContent = 'Esta orden ya fue guardada. Usa Crear Nueva Orden para hacer otra.';
        return;
      }
      
      const salespersonVal = document.querySelector('#salesperson').value;
      const finalSalesperson = salespersonVal === 'Otro asesor' ? document.querySelector('#salesperson-custom-name').value.trim() : salespersonVal;

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
        asesor: finalSalesperson
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
          if(lookupInput) lookupInput.value = result.numero_orden;
          sessionStorage.setItem('activeOrderNumber', result.numero_orden);
        }
        message.style.color = 'var(--green)';
        message.textContent = `✓ ${result.mensaje || 'Orden guardada correctamente'}`;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span>✓</span> Orden guardada';
        updateOrderSummary();
        startConsentPolling(result.numero_orden);
      } catch (error) {
        message.style.color = 'var(--red)';
        message.textContent = `Error al guardar: ${error.message}`;
      } finally {
        submitButton.disabled = false;
        setTimeout(() => { message.textContent = ''; }, 5000);
      }
    });
  }

  if(saveTechnicianBtn) {
    saveTechnicianBtn.addEventListener('click', async () => {
      const message = document.querySelector('#technician-message');
      
      if (orderNumber === '#ORD-2026-0000') {
        message.style.color = 'var(--red)';
        message.textContent = 'Primero guarda la orden del cliente.';
        return;
      }
      
      const consentList = document.querySelector('.consent-list');
      if(consentList) {
        const visibleRows = [...consentList.querySelectorAll('.consent-row:not([hidden])')];
        const unapproved = visibleRows.filter((row) => row.dataset.status !== 'approved');
        
        if (unapproved.length > 0) {
          message.style.color = 'var(--red)';
          message.textContent = '⚠️ Validaciones pendientes: Es necesario aprobar todos los consentimientos técnicos y del cliente para guardar el mapa de daños.';
          return;
        }
      }

      const oldTireBrand = document.querySelector('#old-brand-select')?.value || '';
      
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

      saveTechnicianBtn.disabled = true;
      message.style.color = 'var(--green)';
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
        message.style.color = 'var(--red)';
        message.textContent = `Error al guardar: ${error.message}`;
      } finally {
        saveTechnicianBtn.disabled = false;
        setTimeout(() => { message.textContent = ''; }, 5000);
      }
    });
  }

  if(newInstallationOrderButton) {
    newInstallationOrderButton.addEventListener('click', () => {
      stopConsentPolling(); 
      if (!window.confirm('Se limpiarán los datos de la pantalla para crear una nueva orden. La orden ya guardada no se borrará.')) return;
      
      sessionStorage.removeItem('activeOrderNumber');
      
      if(orderForm) orderForm.reset();
      if(technicianPanel) technicianPanel.querySelectorAll('input, textarea, select').forEach((field) => {
        if (field.type === 'checkbox') field.checked = false;
        else if (field.id !== 'license-plate') field.value = '';
      });
      orderDate.value = new Date().toISOString().slice(0, 10);
      updateHeaderDate();
      document.querySelector('#tire-result').textContent = '-';
      document.querySelector('#old-tire-result').textContent = '-';
      if(serviceCount) serviceCount.textContent = '0 seleccionados';
      if(summary) summary.innerHTML = '<span>No hay servicios seleccionados</span>';
      if(checklistStatus) {
        checklistStatus.textContent = '0 presentes';
        checklistStatus.classList.remove('complete');
      }
      quantityInputs.forEach((input) => { input.value = ''; });
      document.querySelectorAll('.brand-custom, .salesperson-custom').forEach((field) => { field.hidden = true; });
      const orderSummaryPanel = document.querySelector('#order-summary-panel');
      if(orderSummaryPanel) orderSummaryPanel.hidden = true;
      document.querySelector('#save-message').textContent = '';
      const techMsg = document.querySelector('#technician-message');
      if(techMsg) techMsg.textContent = '';
      
      setOrderNumber('#ORD-2026-0000');
      loadedOrder = false;
      orderSaved = false;
      const orderSaveButton = document.querySelector('#order-form .save-button');
      if(orderSaveButton) {
        orderSaveButton.disabled = false;
        orderSaveButton.innerHTML = '<span>▣</span> Guardar orden';
      }
      loadNextOrderNumber();
      
      const consentList = document.querySelector('.consent-list');
      if(consentList) {
        consentList.querySelectorAll('.consent-row').forEach((row) => {
          row.dataset.status = 'pending';
          row.querySelector('.consent-status').textContent = 'Pendiente';
          row.querySelector('.consent-note').textContent = 'Notificación por correo disponible.';
          row.style.background = '';
          row.style.borderColor = '';
          row.querySelector('.consent-email').value = '';
          
          const btn = row.querySelector('.notify-button');
          if(btn) {
            if(row.dataset.consentId === 'client_reciclaje') btn.style.display = 'none';
            else btn.style.display = 'block'; 
          }
          const localBtn = row.querySelector('.local-approve-btn');
          if(localBtn) localBtn.style.display = 'inline-block';
        });
      }
      updateConsentState();
      
      damagePins = [];
      renderDamagePins();

      if(orderForm) orderForm.hidden = false;
      if(technicianPanel) technicianPanel.hidden = true;
      const sellerViewBtn = document.querySelector('[data-view="seller"]');
      if(sellerViewBtn) sellerViewBtn.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if(clearOrderButton) {
    clearOrderButton.innerHTML = '🧹 Limpiar formulario';
    clearOrderButton.addEventListener('click', () => {
      if (orderSaved) {
        alert('La orden no se puede limpiar porque ya fue guardada. Si deseas crear una nueva, haz clic en "➕ Crear Nueva Orden".');
        return;
      }
      if (!window.confirm('¿Estás seguro de limpiar los datos ingresados?')) return;
      
      if(orderForm) orderForm.reset();
      orderDate.value = new Date().toISOString().slice(0, 10);
      updateHeaderDate();
      document.querySelector('#tire-result').textContent = '-';
      if(serviceCount) serviceCount.textContent = '0 seleccionados';
      if(summary) summary.innerHTML = '<span>No hay servicios seleccionados</span>';
      document.querySelectorAll('.brand-custom, .salesperson-custom').forEach(field => field.hidden = true);
      document.querySelector('#save-message').textContent = '';
      
      damagePins = [];
      renderDamagePins();
    });
  }

  if(printBtn) {
    printBtn.addEventListener('click', () => {
      const tituloOriginal = document.title;
      document.title = `${orderNumber} LLANTAS247`;
      window.print();
      document.title = tituloOriginal;
    });
  }

  const activeOrder = sessionStorage.getItem('activeOrderNumber');
  if (activeOrder && lookupInput && loadOrderButton) {
    lookupInput.value = activeOrder;
    setTimeout(() => loadOrderButton.click(), 50);
  } else {
    loadNextOrderNumber();
  }
});