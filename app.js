(() => {
  const DB = window.UchetDB;
  const D = window.UchetDomain;
  const main = document.getElementById("main");
  const toastEl = document.getElementById("toast");

  let state = {
    section: "orders",
    orders: [],
    selectedId: null,
    filter: "",
    mode: "list", // list | form | detail
    formMode: "new", // new | edit
    formValues: {},
    formErrors: [],
  };

  function toast(msg, isError = false) {
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.classList.toggle("is-error", isError);
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.hidden = true;
    }, 2500);
  }

  function badge(status) {
    const cls =
      status === "paid" ? "badge badge--accent" : status === "shipped" ? "badge badge--success" : "badge";
    return `<span class="${cls}">${D.STATUS_LABELS[status] || status}</span>`;
  }

  function emptyForm() {
    return {
      created_at: D.todayISO(),
      customer_name: "",
      phone: "",
      email: "",
      car: "",
      vin: "",
      engine: "",
      gearbox: "",
      power_hp: "",
      torque_nm: "",
      consumption: "",
      vmax: "",
      spec_notes: "",
      amount: "",
      status: "created",
      delivery: "cdek",
      item_firmware: "",
      item_ecu: "",
    };
  }

  function valuesFromOrder(o) {
    return {
      created_at: o.created_at,
      customer_name: o.customer_name,
      phone: o.phone || "",
      email: o.email || "",
      car: o.car || "",
      vin: o.vin || "",
      engine: o.engine || "",
      gearbox: o.gearbox || "",
      power_hp: o.power_hp == null ? "" : String(o.power_hp),
      torque_nm: o.torque_nm == null ? "" : String(o.torque_nm),
      consumption: o.consumption == null ? "" : String(o.consumption).replace(".", ","),
      vmax: o.vmax == null ? "" : String(o.vmax),
      spec_notes: o.spec_notes || "",
      amount: D.moneyInput(o.amount_cents),
      status: o.status,
      delivery: o.delivery,
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
      errors.push("Дата заказа должна быть в формате ГГГГ-ММ-ДД.");
    }

    const amount_cents = D.parseMoney(values.amount);
    if (amount_cents === null) errors.push("Сумма должна быть числом, например 45 000,50.");

    const numbers = {};
    for (const [field, label] of [
      ["power_hp", "Мощность"],
      ["torque_nm", "Момент"],
      ["consumption", "Расход"],
      ["vmax", "Максимальная скорость"],
    ]) {
      const parsed = D.parseNumberField(values[field]);
      if (parsed === "invalid") {
        errors.push(`${label}: введите число.`);
        numbers[field] = null;
      } else numbers[field] = parsed;
    }

    const item_firmware = values.item_firmware === "on" || values.item_firmware === true;
    const item_ecu = values.item_ecu === "on" || values.item_ecu === true;
    if (!item_firmware && !item_ecu) {
      errors.push("Отметьте хотя бы одну позицию: «Прошивка» или «Блок управления».");
    }

    const status = D.STATUSES.includes(values.status) ? values.status : "created";
    const delivery = D.DELIVERIES.includes(values.delivery) ? values.delivery : "cdek";

    if (errors.length || amount_cents === null) return { draft: null, errors };

    return {
      errors: [],
      draft: {
        created_at,
        customer_name,
        phone: (values.phone || "").trim().slice(0, 40),
        email: (values.email || "").trim().slice(0, 120),
        car: (values.car || "").trim().slice(0, 120),
        vin: (values.vin || "").trim().slice(0, 40),
        engine: (values.engine || "").trim().slice(0, 80),
        gearbox: (values.gearbox || "").trim().slice(0, 80),
        power_hp: numbers.power_hp,
        torque_nm: numbers.torque_nm,
        consumption: numbers.consumption,
        vmax: numbers.vmax,
        spec_notes: (values.spec_notes || "").trim().slice(0, 2000),
        item_firmware,
        item_ecu,
        amount_cents,
        status,
        delivery,
      },
    };
  }

  function readForm(form) {
    const fd = new FormData(form);
    const values = emptyForm();
    for (const key of Object.keys(values)) {
      if (key === "item_firmware" || key === "item_ecu") {
        values[key] = fd.get(key) ? "on" : "";
      } else {
        values[key] = fd.has(key) ? String(fd.get(key)) : "";
      }
    }
    return values;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  function renderOrders() {
    const needle = state.filter.trim().toLowerCase();
    const rows = needle
      ? state.orders.filter((o) =>
          [o.customer_name, o.car, o.vin, o.phone, o.engine].join(" ").toLowerCase().includes(needle),
        )
      : state.orders;

    const total = rows.reduce((s, o) => s + o.amount_cents, 0);
    const selected = state.orders.find((o) => o.id === state.selectedId);

    const listHtml = rows.length
      ? rows
          .map(
            (o) => `
      <a class="order-row${o.id === state.selectedId ? " is-selected" : ""}" href="#" data-select="${o.id}">
        <span class="order-row__top">
          <span class="order-row__name">${D.escapeHtml(o.customer_name)}</span>
          ${badge(o.status)}
        </span>
        <span class="order-row__meta">${D.escapeHtml(o.car || "Автомобиль не указан")}</span>
        <span class="order-row__meta">
          <span>${D.formatDate(o.created_at)}</span>
          <span>${D.formatMoney(o.amount_cents)}</span>
        </span>
      </a>`,
          )
          .join("")
      : `<p class="empty">${needle ? "Ничего не найдено." : "Заказов пока нет. Создайте первый."}</p>`;

    let detail = "";
    if (selected) {
      detail = renderDetail(selected);
    } else {
      detail = `
        <div class="card stack">
          <p class="empty">${state.orders.length ? "Выберите заказ в списке." : "Нажмите «Новый заказ»."}</p>
          <div class="actions">
            <button type="button" data-action="new">Новый заказ</button>
          </div>
        </div>`;
    }

    main.innerHTML = `
      <div class="stack split-mobile">
        <div class="card stack">
          <label class="field">
            <span class="field__label">Поиск</span>
            <input type="search" id="filter-input" value="${D.escapeHtml(state.filter)}" placeholder="Имя, авто, VIN" />
          </label>
          <p class="list-total">Заказов: <strong>${rows.length}</strong> · на сумму <strong>${D.formatMoney(total)}</strong></p>
          <div id="order-list">${listHtml}</div>
          <div class="actions">
            <button type="button" data-action="new">Новый заказ</button>
          </div>
        </div>
        <div class="detail-panel">${detail}</div>
      </div>`;
  }

  function renderDetail(o) {
    const consumption =
      o.consumption == null ? "—" : `${D.formatNumber(o.consumption)} л/100 км`;
    return `
      <div class="card stack">
        <div class="order-head">
          <h2 class="order-head__title">Заказ №${o.id}</h2>
          ${badge(o.status)}
        </div>
        <table class="detail-table">
          <tr><th>Дата</th><td>${D.formatDate(o.created_at)}</td></tr>
          <tr><th>Покупатель</th><td>${D.escapeHtml(o.customer_name)}</td></tr>
          <tr><th>Телефон</th><td>${D.escapeHtml(o.phone) || "—"}</td></tr>
          <tr><th>E-mail</th><td>${D.escapeHtml(o.email) || "—"}</td></tr>
          <tr><th>Автомобиль</th><td>${D.escapeHtml(o.car) || "—"}</td></tr>
          <tr><th>VIN</th><td>${D.escapeHtml(o.vin) || "—"}</td></tr>
          <tr><th>Двигатель</th><td>${D.escapeHtml(o.engine) || "—"}</td></tr>
          <tr><th>КПП</th><td>${D.escapeHtml(o.gearbox) || "—"}</td></tr>
          <tr><th>Мощность</th><td>${D.formatNumber(o.power_hp, " л.с.")}</td></tr>
          <tr><th>Момент</th><td>${D.formatNumber(o.torque_nm, " Н·м")}</td></tr>
          <tr><th>Расход</th><td>${consumption}</td></tr>
          <tr><th>Vmax</th><td>${D.formatNumber(o.vmax, " км/ч")}</td></tr>
          <tr><th>Позиции</th><td>${D.escapeHtml(D.itemsLabel(o))}</td></tr>
          <tr><th>Сумма</th><td><strong>${D.formatMoney(o.amount_cents)}</strong></td></tr>
          <tr><th>Доставка</th><td>${D.DELIVERY_LABELS[o.delivery] || o.delivery}</td></tr>
          <tr><th>Комментарий</th><td style="white-space:pre-wrap">${D.escapeHtml(o.spec_notes) || "—"}</td></tr>
        </table>
        <div class="actions">
          <label class="field field--inline">
            <span class="field__label">Статус</span>
            <select id="quick-status">
              ${D.STATUSES.map((s) => `<option value="${s}"${s === o.status ? " selected" : ""}>${D.STATUS_LABELS[s]}</option>`).join("")}
            </select>
          </label>
          <label class="field field--inline">
            <span class="field__label">Доставка</span>
            <select id="quick-delivery">
              ${D.DELIVERIES.map((d) => `<option value="${d}"${d === o.delivery ? " selected" : ""}>${D.DELIVERY_LABELS[d]}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="secondary" data-action="quick-save" data-id="${o.id}">Сохранить</button>
        </div>
        <div class="actions">
          <button type="button" data-action="edit" data-id="${o.id}">Редактировать</button>
          <button type="button" class="danger" data-action="delete" data-id="${o.id}">Удалить</button>
        </div>
      </div>`;
  }

  function field(label, name, values, opts = {}) {
    const v = values[name] ?? "";
    return `<label class="field${opts.wide ? " field--wide" : ""}">
      <span class="field__label">${label}</span>
      <input name="${name}" type="${opts.type || "text"}" value="${D.escapeHtml(v)}"
        ${opts.placeholder ? `placeholder="${opts.placeholder}"` : ""}
        ${opts.inputmode ? `inputmode="${opts.inputmode}"` : ""} />
    </label>`;
  }

  function renderForm() {
    const v = state.formValues;
    const title = state.formMode === "edit" ? `Заказ №${state.selectedId}` : "Новый заказ";
    const err =
      state.formErrors.length > 0
        ? `<div class="errors"><ul>${state.formErrors.map((e) => `<li>${D.escapeHtml(e)}</li>`).join("")}</ul></div>`
        : "";

    main.innerHTML = `
      <div class="card stack">
        <div class="order-head">
          <h2 class="order-head__title">${title}</h2>
          <button type="button" class="secondary" data-action="cancel-form">К списку</button>
        </div>
        ${err}
        <form id="order-form" class="stack">
          <div class="form-grid">
            ${field("Дата", "created_at", v, { type: "date" })}
            ${field("Покупатель *", "customer_name", v)}
            ${field("Телефон", "phone", v, { inputmode: "tel" })}
            ${field("E-mail", "email", v, { type: "email" })}
            ${field("Автомобиль", "car", v)}
            ${field("VIN", "vin", v)}
            ${field("Двигатель", "engine", v)}
            ${field("КПП", "gearbox", v)}
            ${field("Мощность, л.с.", "power_hp", v, { inputmode: "decimal" })}
            ${field("Момент, Н·м", "torque_nm", v, { inputmode: "decimal" })}
            ${field("Расход, л/100 км", "consumption", v, { inputmode: "decimal" })}
            ${field("Макс. скорость, км/ч", "vmax", v, { inputmode: "decimal" })}
            ${field("Сумма, ₽ *", "amount", v, { inputmode: "decimal", placeholder: "45 000,00" })}
            <label class="field">
              <span class="field__label">Статус</span>
              <select name="status">
                ${D.STATUSES.map((s) => `<option value="${s}"${s === v.status ? " selected" : ""}>${D.STATUS_LABELS[s]}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span class="field__label">Доставка</span>
              <select name="delivery">
                ${D.DELIVERIES.map((d) => `<option value="${d}"${d === v.delivery ? " selected" : ""}>${D.DELIVERY_LABELS[d]}</option>`).join("")}
              </select>
            </label>
            <label class="field field--wide">
              <span class="field__label">Комментарий</span>
              <textarea name="spec_notes">${D.escapeHtml(v.spec_notes)}</textarea>
            </label>
            <div class="field field--wide">
              <span class="field__label">Позиции *</span>
              <div class="checks">
                <label class="check"><input type="checkbox" name="item_firmware" ${v.item_firmware ? "checked" : ""} /> Прошивка</label>
                <label class="check"><input type="checkbox" name="item_ecu" ${v.item_ecu ? "checked" : ""} /> Блок управления</label>
              </div>
            </div>
          </div>
          <div class="actions">
            <button type="submit">Сохранить</button>
            <button type="button" class="secondary" data-action="cancel-form">Отмена</button>
          </div>
        </form>
      </div>`;
  }

  function breakdown(title, rows) {
    return `
      <div class="card stack">
        <h3 class="section-title">${title}</h3>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Категория</th><th class="num">Кол-во</th><th class="num">Сумма</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) =>
                    `<tr><td>${D.escapeHtml(r.label)}</td><td class="num">${r.count}</td><td class="num">${D.formatMoney(r.sum_cents)}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function periodBlock(p) {
    const range =
      p.period.from === p.period.to
        ? D.formatDate(p.period.from)
        : `${D.formatDate(p.period.from)} — ${D.formatDate(p.period.to)}`;
    return `
      <section class="stack">
        <div class="toolbar">
          <h2>${D.escapeHtml(p.title)}</h2>
          <span class="hint">${range}</span>
          <button type="button" class="secondary" data-action="export" data-period="${p.key}">CSV</button>
        </div>
        <div class="kpis">
          <div class="kpi"><span class="kpi__label">Сумма</span><span class="kpi__value">${D.formatMoney(p.sum_cents)}</span></div>
          <div class="kpi"><span class="kpi__label">Заказов</span><span class="kpi__value">${p.count}</span></div>
          <div class="kpi"><span class="kpi__label">Средний чек</span><span class="kpi__value">${D.formatMoney(p.average_cents)}</span></div>
          <div class="kpi"><span class="kpi__label">Оплачено и отгружено</span><span class="kpi__value">${D.formatMoney(p.earned_cents)}</span></div>
        </div>
        <div class="stack">
          ${breakdown("По статусам", p.byStatus)}
          ${breakdown("По доставке", p.byDelivery)}
        </div>
      </section>`;
  }

  function renderAnalytics() {
    const today = D.todayISO();
    const week = D.analyticsFor(state.orders, D.weekPeriod(today), "week", "Текущая неделя");
    const month = D.analyticsFor(state.orders, D.monthPeriod(today), "month", "Текущий месяц");
    const monthOrders = state.orders.filter((o) => D.inPeriod(o, month.period)).slice(0, 20);

    const recent = monthOrders.length
      ? `<div class="card stack">
          <h3 class="section-title">Последние заказы месяца</h3>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Дата</th><th>Покупатель</th><th>Позиции</th><th>Статус</th><th class="num">Сумма</th></tr></thead>
              <tbody>
                ${monthOrders
                  .map(
                    (o) =>
                      `<tr>
                        <td>${D.formatDate(o.created_at)}</td>
                        <td><a href="#" data-select="${o.id}" data-goto-orders="1">${D.escapeHtml(o.customer_name)}</a></td>
                        <td>${D.escapeHtml(D.itemsLabel(o))}</td>
                        <td>${badge(o.status)}</td>
                        <td class="num">${D.formatMoney(o.amount_cents)}</td>
                      </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>`
      : "";

    main.innerHTML = `<div class="stack">${periodBlock(week)}${periodBlock(month)}${recent}</div>`;
  }

  function render() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.section === state.section);
    });

    if (state.section === "analytics") {
      renderAnalytics();
      return;
    }
    if (state.mode === "form") {
      renderForm();
      return;
    }
    renderOrders();
  }

  // ── Events ──────────────────────────────────────────────────────────────

  document.querySelector(".tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    state.section = btn.dataset.section;
    state.mode = "list";
    render();
  });

  main.addEventListener("click", async (e) => {
    const select = e.target.closest("[data-select]");
    if (select) {
      e.preventDefault();
      state.selectedId = Number(select.dataset.select);
      if (select.dataset.gotoOrders) {
        state.section = "orders";
        state.mode = "list";
      }
      render();
      return;
    }

    const action = e.target.closest("[data-action]");
    if (!action) return;
    const act = action.dataset.action;

    if (act === "new") {
      state.mode = "form";
      state.formMode = "new";
      state.formValues = emptyForm();
      state.formErrors = [];
      state.selectedId = null;
      render();
      return;
    }

    if (act === "cancel-form") {
      state.mode = "list";
      render();
      return;
    }

    if (act === "edit") {
      const id = Number(action.dataset.id);
      const o = await DB.getOrder(id);
      if (!o) {
        toast("Заказ не найден", true);
        return;
      }
      state.mode = "form";
      state.formMode = "edit";
      state.selectedId = id;
      state.formValues = valuesFromOrder(o);
      state.formErrors = [];
      render();
      return;
    }

    if (act === "delete") {
      const id = Number(action.dataset.id);
      if (!confirm("Удалить заказ №" + id + "?")) return;
      await DB.deleteOrder(id);
      state.orders = await DB.listOrders();
      state.selectedId = null;
      state.mode = "list";
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

    if (act === "export") {
      exportCsv(action.dataset.period);
    }
  });

  main.addEventListener("input", (e) => {
    if (e.target.id === "filter-input") {
      state.filter = e.target.value;
      // re-render list only
      const prev = state.selectedId;
      renderOrders();
      state.selectedId = prev;
    }
  });

  main.addEventListener("submit", async (e) => {
    if (e.target.id !== "order-form") return;
    e.preventDefault();
    const values = readForm(e.target);
    state.formValues = values;
    const parsed = parseForm(values);
    if (!parsed.draft) {
      state.formErrors = parsed.errors;
      render();
      return;
    }
    if (state.formMode === "edit" && state.selectedId) {
      await DB.updateOrder(state.selectedId, parsed.draft);
      toast("Изменения сохранены");
    } else {
      const created = await DB.createOrder(parsed.draft);
      state.selectedId = created.id;
      toast("Заказ создан");
    }
    state.orders = await DB.listOrders();
    state.mode = "list";
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
      ["E-mail", (o) => o.email || ""],
      ["Автомобиль", (o) => o.car || ""],
      ["VIN", (o) => o.vin || ""],
      ["Двигатель", (o) => o.engine || ""],
      ["КПП", (o) => o.gearbox || ""],
      ["Мощность", (o) => (o.power_hp == null ? "" : String(o.power_hp))],
      ["Момент", (o) => (o.torque_nm == null ? "" : String(o.torque_nm))],
      ["Расход", (o) => (o.consumption == null ? "" : String(o.consumption))],
      ["Vmax", (o) => (o.vmax == null ? "" : String(o.vmax))],
      ["Комментарий", (o) => o.spec_notes || ""],
      ["Прошивка", (o) => (o.item_firmware ? "да" : "нет")],
      ["Блок управления", (o) => (o.item_ecu ? "да" : "нет")],
      ["Сумма", (o) => (o.amount_cents / 100).toFixed(2).replace(".", ",")],
      ["Статус", (o) => D.STATUS_LABELS[o.status]],
      ["Доставка", (o) => D.DELIVERY_LABELS[o.delivery]],
    ];
    const cell = (s) => `"${String(s).replace(/\r?\n/g, " ").replace(/"/g, '""')}"`;
    const lines = [
      cols.map(([t]) => cell(t)).join(";"),
      ...rows.map((o) => cols.map(([, fn]) => cell(fn(o))).join(";")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mastermitsu-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("CSV сохранён");
  }

  async function init() {
    try {
      state.orders = await DB.listOrders();
    } catch (e) {
      console.error(e);
      toast("Ошибка базы данных", true);
    }
    render();
  }

  init();
})();
