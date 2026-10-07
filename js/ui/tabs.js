
export class Tabs {
  constructor(tablist, { onChange } = {}) {
    this.tabs = [...tablist.querySelectorAll('[role="tab"]')];
    this.onChange = onChange;
    tablist.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) this.select(tab.id);
    });
    tablist.addEventListener('keydown', (e) => {
      const index = this.tabs.indexOf(document.activeElement);
      const targets = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: this.tabs.length - 1 };
      if (index < 0 || !(e.key in targets)) return;
      e.preventDefault();
      const next = this.tabs[(targets[e.key] + this.tabs.length) % this.tabs.length];
      this.select(next.id, { focus: true });
    });
  }

  select(id, { focus = false } = {}) {
    const known = this.tabs.some((tab) => tab.id === id) ? id : this.tabs[0].id;
    this.tabs.forEach((tab) => {
      const selected = tab.id === known;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
      if (selected && focus) tab.focus();
    });
    this.onChange?.(known);
  }
}

/** Sets or clears an inline field error wired through aria-describedby. */
export const setFieldError = (input, message) => {
  input.setAttribute('aria-invalid', String(Boolean(message)));
  document.getElementById(`${input.id}-error`).textContent = message;
};
