document.addEventListener('DOMContentLoaded', () => {
  const serviceInputs = [...document.querySelectorAll('#services-list input')];
  const otherService = document.querySelector('#other-service');
  const summary = document.querySelector('#summary');
  const serviceCount = document.querySelector('#service-count');
  const checklistInputs = [...document.querySelectorAll('#checklist input')];
  const checklistStatus = document.querySelector('#checklist-status');
  const technicianPanel = document.querySelector('#technician-panel');
  const licensePlate = document.querySelector('#license-plate');
  const alarmCode = document.querySelector('#alarm-code');
  const toggleAlarm = document.querySelector('#toggle-alarm');

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

  function updateSummary() {
    const selected = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService.value.trim()) selected.push(otherService.value.trim());
    serviceCount.textContent = `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}`;
    summary.innerHTML = selected.length ? selected.map((name) => `<div class="summary-row"><span>${name}</span><small>-</small></div>`).join('') : '<span>No hay servicios seleccionados</span>';
  }

  serviceInputs.forEach((input) => input.addEventListener('change', updateSummary));
  otherService.addEventListener('input', updateSummary);

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

  checklistInputs.forEach((input) => input.addEventListener('change', () => {
    const completed = checklistInputs.filter((item) => item.checked).length;
    checklistStatus.textContent = `${completed} presente${completed === 1 ? '' : 's'}`;
    checklistStatus.classList.toggle('complete', completed > 0);
  }));

  ['tire-width', 'tire-height', 'tire-rim'].forEach((id) => document.querySelector(`#${id}`).addEventListener('input', () => {
    document.querySelector('#tire-result').textContent = `${document.querySelector('#tire-width').value || 0}/${document.querySelector('#tire-height').value || 0}R${document.querySelector('#tire-rim').value || 0}`;
  }));

  ['old-tire-width', 'old-tire-height', 'old-tire-rim'].forEach((id) => document.querySelector(`#${id}`).addEventListener('input', () => {
    document.querySelector('#old-tire-result').textContent = `${document.querySelector('#old-tire-width').value || 0}/${document.querySelector('#old-tire-height').value || 0}R${document.querySelector('#old-tire-rim').value || 0}`;
  }));

  function displayValue(value) {
    return value && value.trim() ? value.trim() : 'No registrado';
  }

  function updateOrderSummary() {
    const newBrand = document.querySelector('#new-brand').value;
    const oldBrand = document.querySelector('.technical-details .brand-select').value;
    const services = serviceInputs.filter((input) => input.checked).map((input) => input.value);
    if (otherService.value.trim()) services.push(otherService.value.trim());
    const presentItems = checklistInputs.filter((input) => input.checked).map((input) => input.value);
    const rows = [
      ['Cliente', document.querySelector('#customer-name').value],
      ['Correo electrónico', document.querySelector('#customer-email').value],
      ['Teléfono', document.querySelector('#customer-phone').value],
      ['Fecha', document.querySelector('#order-date').value],
      ['Asesor de ventas', document.querySelector('#salesperson').value],
      ['Cantidad de llantas', document.querySelector('#tire-quantity').value],
      ['Llanta nueva', `${newBrand || 'No registrada'} - ${document.querySelector('#tire-result').textContent}`],
      ['Servicios contratados', services.length ? services.join(', ') : 'Ninguno'],
      ['Observaciones del vendedor', document.querySelector('.notes-panel textarea').value],
      ['Placa', document.querySelector('#license-plate').value],
      ['Kilometraje', document.querySelector('#technician-panel input[type="number"]').value],
      ['Código de alarma', document.querySelector('#alarm-code').value],
      ['Llanta vieja', `${oldBrand || 'No registrada'} - ${document.querySelector('#old-tire-result').textContent}`],
      ['Elementos presentes al recibir', presentItems.length ? presentItems.join(', ') : 'Ninguno marcado'],
      ['Observaciones de ingreso', document.querySelector('.technical-notes').value]
    ];
    document.querySelector('#order-summary-body').innerHTML = rows.map(([label, value]) => `<tr><th>${label}</th><td>${displayValue(value)}</td></tr>`).join('');
    document.querySelector('#order-summary-panel').hidden = false;
  }

  document.querySelector('#order-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const message = document.querySelector('#save-message');
    message.textContent = '✓ Orden guardada correctamente';
    updateOrderSummary();
    setTimeout(() => { message.textContent = ''; }, 3500);
  });

  document.querySelector('#save-technician').addEventListener('click', () => {
    const message = document.querySelector('#technician-message');
    message.textContent = 'Orden de instalación guardada correctamente';
    updateOrderSummary();
    setTimeout(() => { message.textContent = ''; }, 3500);
  });

  document.querySelector('#print-order').addEventListener('click', () => window.print());
});
