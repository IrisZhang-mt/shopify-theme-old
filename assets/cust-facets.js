(function () {
  function hideRewardsLauncher() {
    const selectors = [
      '#smile-ui-container',
      '#smile-ui-lite-container',
      '#smile-ui-lite-launcher-frame-container',
      '.smile-launcher-frame',
      '.smile-prompt-frame',
      '.smile-launcher',
      '.smile-launcher-frame-container',
      '.smile-prompt-frame-container',
      '[id*="smile" i]',
      '[class*="smile" i]',
      '[data-smile-launcher]',
      'iframe[id*="smile" i]',
      'iframe[class*="smile" i]',
      'iframe[src*="smile" i]',
      'iframe[title*="rewards" i]',
      'iframe[name*="smile" i]'
    ];

    document.querySelectorAll(selectors.join(',')).forEach((element) => {
      element.style.setProperty('display', 'none', 'important');
    });
  }

  function setFiltersHidden(hidden) {
    document.body.classList.toggle('cust-product-grid-filters-hidden', hidden);
    document.querySelectorAll('[data-cust-hide-filters], [data-cust-show-filters]').forEach((button) => {
      button.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    });
  }

  function setInitialFiltersState() {
    const container = document.querySelector('[data-cust-product-grid-container]');

    if (!container) {
      return;
    }

    setFiltersHidden(container.dataset.filtersInitiallyHidden === 'true');
  }

  function openMobileFilters() {
    const drawer = document.getElementById('Facet-Drawer');

    if (!drawer) {
      return;
    }

    document.body.classList.add('open-cc');
    drawer.classList.add('active');
  }

  function toggleMobileFilter(summary) {
    const details = summary.closest('details');

    if (!details) {
      return;
    }

    details.getAnimations().forEach((animation) => animation.cancel());
    details.style.height = '';
    details.style.overflow = '';
    details.open = !details.open;
  }

  document.addEventListener('click', (event) => {
    const hideButton = event.target.closest('[data-cust-hide-filters]');
    const showButton = event.target.closest('[data-cust-show-filters]');

    if (hideButton) {
      event.preventDefault();
      setFiltersHidden(true);
    }

    if (showButton) {
      event.preventDefault();
      if (window.matchMedia('(max-width: 1067px)').matches) {
        openMobileFilters();
        return;
      }

      setFiltersHidden(false);
    }
  });

  document.addEventListener('click', (event) => {
    const summary = event.target.closest('#Facet-Drawer .facets__mobile_form .thb-filter-title');

    if (!summary || !document.querySelector('.section-cust-main-collection-product-grid')) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMobileFilter(summary);
  }, true);

  document.addEventListener('shopify:section:load', () => {
    setInitialFiltersState();
    hideRewardsLauncher();
  });

  setInitialFiltersState();
  hideRewardsLauncher();

  const rewardsObserver = new MutationObserver(() => {
    hideRewardsLauncher();
  });

  rewardsObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
