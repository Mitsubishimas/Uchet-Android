(() => {
  const DB = window.UchetDB;
  const D = window.UchetDomain;
  const main = document.getElementById("main");
  const titleEl = document.getElementById("screen-title");
  const toastEl = document.getElementById("toast");

  const TITLES = {
    home: "Рабочий стол",
    new: "Новый заказ",
    list: "Список заказов",
    report: "Отчёт",
    detail: "Заказ",
    edit: "Редактирование",
  };

  let state = {
    tab: "home",
    view: "tab",
    orders: [],
    selectedId: null,
    filter: "",
    formValues: {},
    formErrors: [],
    homePanel: null, // in_work | unpaid | paid | shipped
  };

  function toast(msg, isError = false) {
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.classList.toggle("is-error", isError);
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => { toastEl.hidden = true; }, 2500);
  }

  function badge(status) {
    const cls =
      status === "paid" ? "badge badge--accent"
      : status === "shipped" ? "badge badge--success"
      : "badge badge--warn";
    return `<span class="${cls}">${D.STATUS_LABELS[status] || status}</span>`;
  }

  function emptyForm() {
    return {
      created_at: D.todayISO(),
      customer_name: "", phone: "", email: "",
      car: "", vin: "", engine: "", gearbox: "",
      power_hp: "", torque_nm: "", consumption: "", vmax: "",
      spec_notes: "", amount: "",
      status: "created", delivery: "cdek",
      item_firmware: "", item_ecu: "",
    };
  }

  function valuesFromOrder(o) {
    return {
      created_at: o.created_at,
      customer_name: o.customer_name,
      phone: o.phone || "", email: o.email || "",
      car: o.car || "", vin: o.vin || "",
      engine: o.engine || "", gearbox: o.gearbox || "",
      power_hp: o.power_hp == null ? "" : String(o.power_hp),
      torque_nm: o.torque_nm == null ? "" : String(o.torque_nm),
      consumption: o.consumption == null ? "" : String(o.consumption).replace(".", ","),
      vmax: o.vmax == null ? "" : String(o.vmax),
      spec_notes: o.spec_notes || "",
      amount: D.moneyInput(o.amount_cents),
      status: o.status, delivery: o.delivery,
      item_firmware: o.item_firmware ? "on" : "",
      item_ecu: o.item_ecu ? "on" : "",
    };
  }

  function parseForm(values) {
    const errors = [];
    const customer_name = (values.customer_name || "").trim().slice(0, 120);
    if (!customer_name) errors.push("Укажите имя покупателя.");
    const created_at = (values.created_at || "").trim() || D.todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(created_at) || Number.isNaN(Date.parse(created_at))) {
      errors.push("Дата в формате ГГГГ-ММ-ДД.");
    }
    const amount_cents = D.parseMoney(values.amount);
    if (amount_cents === null) errors.push("Сумма должна быть числом, например 45 000,50.");
    const numbers = {};
    for (const [field, label] of [
      ["power_hp", "Мощность"], ["torque_nm", "Момент"],
      ["consumption", "Расход"], ["vmax", "Макс. скорость"],
    ]) {
      const parsed = D.parseNumberField(values[field]);
      if (parsed === "invalid") { errors.push(label + ": введите число."); numbers[field] = null; }
      else numbers[field] = parsed;
    }
    const item_firmware = values.item_firmware === "on" || values.item_firmware === true;
    const item_ecu = values.item_ecu === "on" || values.item_ecu === true;
    if (!item_firmware && !item_ecu) errors.push("Отметьте «Прошивка» или «Блок управления».");
    const status = D.STATUSES.includes(values.status) ? values.status : "created";
    const delivery = D.DELIVERIES.includes(values.delivery) ? values.delivery : "cdek";
    if (errors.length || amount_cents === null) return { draft: null, errors };
    return {
      errors: [],
      draft: {
        created_at, customer_name,
        phone: (values.phone || "").trim().slice(0, 40),
        email: (values.email || "").trim().slice(0, 120),
        car: (values.car || "").trim().slice(0, 120),
        vin: (values.vin || "").trim().slice(0, 40),
        engine: (values.engine || "").trim().slice(0, 80),
        gearbox: (values.gearbox || "").trim().slice(0, 80),
        power_hp: numbers.power_hp, torque_nm: numbers.torque_nm,
        consumption: numbers.consumption, vmax: numbers.vmax,
        spec_notes: (values.spec_notes || "").trim().slice(0, 2000),
        item_firmware, item_ecu, amount_cents, status, delivery,
      },
    };
  }

  function readForm(form) {
    const fd = new FormData(form);
    const values = emptyForm();
    for (const key of Object.keys(values)) {
      if (key === "item_firmware" || key === "item_ecu") values[key] = fd.get(key) ? "on" : "";
      else values[key] = fd.has(key) ? String(fd.get(key)) : "";
    }
    return values;
  }

  function orderCard(o) {
    return '<button type="button" class="order-card" data-open="' + o.id + '">' +
      '<span class="order-card__top"><span class="order-card__name">' + D.escapeHtml(o.customer_name) + '</span>' + badge(o.status) + '</span>' +
      '<span class="order-card__meta">' + D.escapeHtml(o.car || "Авто не указан") + '</span>' +
      '<span class="order-card__meta"><span>' + D.formatDate(o.created_at) + '</span><span>' + D.formatMoney(o.amount_cents) + '</span></span></button>';
  }

  function renderHome() {
    const unpaid = state.orders.filter((o) => o.status === "created");
    const paid = state.orders.filter((o) => o.status === "paid");
    const shipped = state.orders.filter((o) => o.status === "shipped");
    const inWork = state.orders.filter((o) => o.status === "created" || o.status === "paid");
    const unpaidSum = unpaid.reduce((s, o) => s + o.amount_cents, 0);
    const paidSum = paid.reduce((s, o) => s + o.amount_cents, 0);

    const panels = {
      in_work: { title: "В работе", list: inWork },
      unpaid: { title: "Ждут оплаты", list: unpaid },
      paid: { title: "Оплачены", list: paid },
      shipped: { title: "Отгружены", list: shipped },
    };
    const open = state.homePanel && panels[state.homePanel] ? panels[state.homePanel] : null;
    const listHtml = open
      ? ('<div class="card crm-panel"><div class="crm-panel__head"><p class="crm-panel__title">' +
         D.escapeHtml(open.title) + " · " + open.list.length +
         '</p><button type="button" class="secondary sm" data-home-panel="">Свернуть</button></div>' +
         (open.list.length
           ? open.list.map(orderCard).join("")
           : '<p class="empty">Нет заказов</p>') +
         "</div>")
      : "";

    function tile(key, label, count, sumHtml, extraClass) {
      const openCls = state.homePanel === key ? " is-open" : "";
      return (
        '<button type="button" class="crm-tile' + (extraClass ? " " + extraClass : "") + openCls +
        '" data-home-panel="' + key + '">' +
        '<span class="crm-tile__label">' + label + "</span>" +
        '<span class="crm-tile__count">' + count + "</span>" +
        (sumHtml || "") +
        "</button>"
      );
    }

    main.innerHTML =
      '<div class="stack">' +
      '<div class="crm-grid">' +
      tile("in_work", "В работе", inWork.length, "", "crm-tile--accent") +
      tile("unpaid", "Ждут оплаты", unpaid.length,
        '<span class="crm-tile__sum">Должны: ' + D.formatMoney(unpaidSum) + "</span>", "crm-tile--warn") +
      tile("paid", "Оплачены", paid.length,
        '<span class="crm-tile__sum">' + D.formatMoney(paidSum) + "</span>", "crm-tile--accent") +
      tile("shipped", "Отгружены", shipped.length, "", "crm-tile--ok") +
      "</div>" +
      listHtml +
      "</div>";
  }

  function field(label, name, values, opts) {
    opts = opts || {};
    const v = values[name] ?? "";
    return '<label class="field' + (opts.wide ? " field--wide" : "") + '"><span class="field__label">' + label + '</span>' +
      '<input name="' + name + '" type="' + (opts.type || "text") + '" value="' + D.escapeHtml(v) + '"' +
      (opts.placeholder ? ' placeholder="' + opts.placeholder + '"' : "") +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "") + " /></label>";
  }

  function renderForm(mode) {
    const v = state.formValues;
    const err = state.formErrors.length
      ? '<div class="errors"><ul>' + state.formErrors.map((e) => "<li>" + D.escapeHtml(e) + "</li>").join("") + "</ul></div>"
      : "";
    main.innerHTML =
      '<div class="card stack">' + err +
      '<form id="order-form" class="stack" data-mode="' + mode + '"><div class="form-grid">' +
      field("Дата", "created_at", v, { type: "date" }) +
      field("Покупатель *", "customer_name", v) +
      field("Телефон", "phone", v, { inputmode: "tel" }) +
      field("E-mail", "email", v, { type: "email" }) +
      field("Автомобиль", "car", v) + field("VIN", "vin", v) +
      field("Двигатель", "engine", v) + field("КПП", "gearbox", v) +
      field("Мощность, л.с.", "power_hp", v, { inputmode: "decimal" }) +
      field("Момент, Н·м", "torque_nm", v, { inputmode: "decimal" }) +
      field("Расход, л/100 км", "consumption", v, { inputmode: "decimal" }) +
      field("Макс. скорость", "vmax", v, { inputmode: "decimal" }) +
      field("Сумма, ₽ *", "amount", v, { inputmode: "decimal", placeholder: "45 000,00" }) +
      '<label class="field"><span class="field__label">Статус</span><select name="status">' +
      D.STATUSES.map((s) => '<option value="' + s + '"' + (s === v.status ? " selected" : "") + ">" + D.STATUS_LABELS[s] + "</option>").join("") +
      '</select></label><label class="field"><span class="field__label">Доставка</span><select name="delivery">' +
      D.DELIVERIES.map((d) => '<option value="' + d + '"' + (d === v.delivery ? " selected" : "") + ">" + D.DELIVERY_LABELS[d] + "</option>").join("") +
      '</select></label><label class="field field--wide"><span class="field__label">Комментарий</span><textarea name="spec_notes">' + D.escapeHtml(v.spec_notes) + '</textarea></label>' +
      '<div class="field field--wide"><span class="field__label">Позиции *</span><div class="checks">' +
      '<label class="check"><input type="checkbox" name="item_firmware"' + (v.item_firmware ? " checked" : "") + " /> Прошивка</label>" +
      '<label class="check"><input type="checkbox" name="item_ecu"' + (v.item_ecu ? " checked" : "") + " /> Блок управления</label>" +
      '</div></div></div><div class="actions"><button type="submit">Сохранить</button>' +
      '<button type="button" class="secondary" data-action="cancel-form">Отмена</button></div></form></div>';
  }

  function renderList() {
    const needle = state.filter.trim().toLowerCase();
    const rows = needle
      ? state.orders.filter((o) => [o.customer_name, o.car, o.vin, o.phone, o.engine].join(" ").toLowerCase().includes(needle))
      : state.orders;
    const total = rows.reduce((s, o) => s + o.amount_cents, 0);
    main.innerHTML =
      '<div class="stack"><div class="card stack"><label class="field"><span class="field__label">Поиск</span>' +
      '<input type="search" id="filter-input" value="' + D.escapeHtml(state.filter) + '" placeholder="Имя, авто, VIN" /></label>' +
      '<p class="hint">Найдено: <strong>' + rows.length + "</strong> · " + D.formatMoney(total) + "</p></div><div class=\"card\">" +
      (rows.length ? rows.map(orderCard).join("") : '<p class="empty">Заказов нет</p>') + "</div></div>";
  }

  function renderDetail(o) {
    const consumption = o.consumption == null ? "—" : D.formatNumber(o.consumption) + " л/100 км";
    main.innerHTML =
      '<div class="card stack"><div class="order-head"><h2 class="order-head__title">Заказ №' + o.id + "</h2>" + badge(o.status) + "</div>" +
      '<table class="detail-table">' +
      "<tr><th>Дата</th><td>" + D.formatDate(o.created_at) + "</td></tr>" +
      "<tr><th>Покупатель</th><td>" + D.escapeHtml(o.customer_name) + "</td></tr>" +
      "<tr><th>Телефон</th><td>" + (D.escapeHtml(o.phone) || "—") + "</td></tr>" +
      "<tr><th>E-mail</th><td>" + (D.escapeHtml(o.email) || "—") + "</td></tr>" +
      "<tr><th>Автомобиль</th><td>" + (D.escapeHtml(o.car) || "—") + "</td></tr>" +
      "<tr><th>VIN</th><td>" + (D.escapeHtml(o.vin) || "—") + "</td></tr>" +
      "<tr><th>Двигатель</th><td>" + (D.escapeHtml(o.engine) || "—") + "</td></tr>" +
      "<tr><th>КПП</th><td>" + (D.escapeHtml(o.gearbox) || "—") + "</td></tr>" +
      "<tr><th>Мощность</th><td>" + D.formatNumber(o.power_hp, " л.с.") + "</td></tr>" +
      "<tr><th>Момент</th><td>" + D.formatNumber(o.torque_nm, " Н·м") + "</td></tr>" +
      "<tr><th>Расход</th><td>" + consumption + "</td></tr>" +
      "<tr><th>Vmax</th><td>" + D.formatNumber(o.vmax, " км/ч") + "</td></tr>" +
      "<tr><th>Позиции</th><td>" + D.escapeHtml(D.itemsLabel(o)) + "</td></tr>" +
      "<tr><th>Сумма</th><td><strong>" + D.formatMoney(o.amount_cents) + "</strong></td></tr>" +
      "<tr><th>Доставка</th><td>" + (D.DELIVERY_LABELS[o.delivery] || o.delivery) + "</td></tr>" +
      '<tr><th>Комментарий</th><td style="white-space:pre-wrap">' + (D.escapeHtml(o.spec_notes) || "—") + "</td></tr></table>" +
      '<p class="section-title">Статус заказа</p><div class="status-row">' +
      '<label class="field"><span class="field__label">Статус</span><select id="quick-status">' +
      D.STATUSES.map((s) => '<option value="' + s + '"' + (s === o.status ? " selected" : "") + ">" + D.STATUS_LABELS[s] + "</option>").join("") +
      '</select></label><label class="field"><span class="field__label">Доставка</span><select id="quick-delivery">' +
      D.DELIVERIES.map((d) => '<option value="' + d + '"' + (d === o.delivery ? " selected" : "") + ">" + D.DELIVERY_LABELS[d] + "</option>").join("") +
      '</select></label><button type="button" class="sm" data-action="quick-save" data-id="' + o.id + '">Сохранить статус</button></div>' +
      '<div class="actions"><button type="button" data-action="edit" data-id="' + o.id + '">Редактировать</button>' +
      '<button type="button" class="danger" data-action="delete" data-id="' + o.id + '">Удалить</button>' +
      '<button type="button" class="secondary" data-action="back-list">К списку</button></div></div>';
  }

  function renderReport() {
    const today = D.todayISO();
    const week = D.analyticsFor(state.orders, D.weekPeriod(today), "week", "Текущая неделя");
    const month = D.analyticsFor(state.orders, D.monthPeriod(today), "month", "Текущий месяц");
    function block(p) {
      const range = p.period.from === p.period.to ? D.formatDate(p.period.from) : D.formatDate(p.period.from) + " — " + D.formatDate(p.period.to);
      return '<div class="card stack"><div class="toolbar"><strong>' + D.escapeHtml(p.title) + '</strong><span class="hint">' + range + '</span>' +
        '<button type="button" class="secondary sm" data-action="export" data-period="' + p.key + '">CSV</button></div>' +
        '<div class="kpi-row">' +
        '<div class="kpi"><span class="kpi__label">Сумма</span><span class="kpi__value">' + D.formatMoney(p.sum_cents) + "</span></div>" +
        '<div class="kpi"><span class="kpi__label">Заказов</span><span class="kpi__value">' + p.count + "</span></div>" +
        '<div class="kpi"><span class="kpi__label">Средний чек</span><span class="kpi__value">' + D.formatMoney(p.average_cents) + "</span></div>" +
        '<div class="kpi"><span class="kpi__label">Оплачено + отгружено</span><span class="kpi__value">' + D.formatMoney(p.earned_cents) + "</span></div></div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>Статус</th><th class="num">Кол-во</th><th class="num">Сумма</th></tr></thead><tbody>' +
        p.byStatus.map((r) => "<tr><td>" + D.escapeHtml(r.label) + '</td><td class="num">' + r.count + '</td><td class="num">' + D.formatMoney(r.sum_cents) + "</td></tr>").join("") +
        "</tbody></table></div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>Доставка</th><th class="num">Кол-во</th><th class="num">Сумма</th></tr></thead><tbody>' +
        p.byDelivery.map((r) => "<tr><td>" + D.escapeHtml(r.label) + '</td><td class="num">' + r.count + '</td><td class="num">' + D.formatMoney(r.sum_cents) + "</td></tr>").join("") +
        "</tbody></table></div></div>";
    }
    main.innerHTML = '<div class="stack">' + block(week) + block(month) + "</div>";
  }

  function setNav() {
    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === state.tab && state.view === "tab");
    });
    if (state.view === "detail") titleEl.textContent = TITLES.detail;
    else if (state.view === "edit") titleEl.textContent = TITLES.edit;
    else titleEl.textContent = TITLES[state.tab] || "";
  }

  function render() {
    setNav();
    if (state.view === "detail") {
      const o = state.orders.find((x) => x.id === state.selectedId);
      if (o) { renderDetail(o); return; }
      state.view = "tab";
    }
    if (state.view === "edit") { renderForm("edit"); return; }
    if (state.tab === "home") renderHome();
    else if (state.tab === "new") {
      if (!state.formValues.created_at) state.formValues = emptyForm();
      renderForm("new");
    } else if (state.tab === "list") renderList();
    else if (state.tab === "report") renderReport();
  }

  document.querySelector(".bottom-nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    state.view = "tab";
    state.formErrors = [];
    if (state.tab === "new") state.formValues = emptyForm();
    if (state.tab !== "home") state.homePanel = null;
    render();
  });

  main.addEventListener("click", async (e) => {
    const homePanelBtn = e.target.closest("[data-home-panel]");
    if (homePanelBtn) {
      const key = homePanelBtn.getAttribute("data-home-panel");
      state.homePanel = key ? (state.homePanel === key ? null : key) : null;
      if (state.tab === "home" && state.view === "tab") renderHome();
      else render();
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) {
      state.selectedId = Number(open.dataset.open);
      state.view = "detail";
      render();
      return;
    }
    const action = e.target.closest("[data-action]");
    if (!action) return;
    const act = action.dataset.action;
    if (act === "cancel-form") {
      if (state.view === "edit") state.view = "detail";
      else { state.tab = "list"; state.view = "tab"; }
      render();
      return;
    }
    if (act === "back-list") { state.view = "tab"; state.tab = "list"; render(); return; }
    if (act === "edit") {
      const id = Number(action.dataset.id);
      const o = await DB.getOrder(id);
      if (!o) { toast("Заказ не найден", true); return; }
      state.selectedId = id;
      state.formValues = valuesFromOrder(o);
      state.formErrors = [];
      state.view = "edit";
      render();
      return;
    }
    if (act === "delete") {
      const id = Number(action.dataset.id);
      if (!confirm("Удалить заказ №" + id + "?")) return;
      await DB.deleteOrder(id);
      state.orders = await DB.listOrders();
      state.view = "tab";
      state.tab = "list";
      toast("Заказ удалён");
      render();
      return;
    }
    if (act === "quick-save") {
      const id = Number(action.dataset.id);
      const o = await DB.getOrder(id);
      if (!o) return;
      const status = document.getElementById("quick-status").value;
      const delivery = document.getElementById("quick-delivery").value;
      await DB.updateOrder(id, { ...o, status, delivery });
      state.orders = await DB.listOrders();
      toast("Статус обновлён");
      render();
      return;
    }
    if (act === "export") exportCsv(action.dataset.period);
  });

  main.addEventListener("input", (e) => {
    if (e.target.id === "filter-input") {
      state.filter = e.target.value;
      renderList();
    }
  });

  main.addEventListener("submit", async (e) => {
    if (e.target.id !== "order-form") return;
    e.preventDefault();
    const mode = e.target.dataset.mode;
    const values = readForm(e.target);
    state.formValues = values;
    const parsed = parseForm(values);
    if (!parsed.draft) {
      state.formErrors = parsed.errors;
      render();
      return;
    }
    if (mode === "edit" && state.selectedId) {
      await DB.updateOrder(state.selectedId, parsed.draft);
      toast("Изменения сохранены");
      state.orders = await DB.listOrders();
      state.view = "detail";
    } else {
      const created = await DB.createOrder(parsed.draft);
      state.selectedId = created.id;
      toast("Заказ создан");
      state.orders = await DB.listOrders();
      state.tab = "list";
      state.view = "detail";
    }
    render();
  });

  function exportCsv(periodKey) {
    const today = D.todayISO();
    const period = periodKey === "week" ? D.weekPeriod(today) : D.monthPeriod(today);
    const rows = state.orders.filter((o) => D.inPeriod(o, period));
    const cols = [
      ["Номер", (o) => String(o.id)],
      ["Дата", (o) => D.formatDate(o.created_at)],
      ["Покупатель", (o) => o.customer_name],
      ["Телефон", (o) => o.phone || ""],
      ["Автомобиль", (o) => o.car || ""],
      ["VIN", (o) => o.vin || ""],
      ["Позиции", (o) => D.itemsLabel(o)],
      ["Сумма", (o) => (o.amount_cents / 100).toFixed(2).replace(".", ",")],
      ["Статус", (o) => D.STATUS_LABELS[o.status]],
      ["Доставка", (o) => D.DELIVERY_LABELS[o.delivery]],
    ];
    const cell = (s) => '"' + String(s).replace(/\r?\n/g, " ").replace(/"/g, '""') + '"';
    const lines = [cols.map((c) => cell(c[0])).join(";")].concat(rows.map((o) => cols.map((c) => cell(c[1](o))).join(";")));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mastermitsu-" + period.from + "_" + period.to + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("CSV сохранён");
  }

  async function init() {
    try { state.orders = await DB.listOrders(); }
    catch (err) { console.error(err); toast("Ошибка базы данных", true); }
    render();
  }
  init();
})();
