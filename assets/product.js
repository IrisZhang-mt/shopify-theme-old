if (!customElements.get('variant-selects')) {

  /**
   *  @class
   *  @function VariantSelects
   */
  class VariantSelects extends HTMLElement {
    constructor() {
      super();
      this.sticky = this.dataset.sticky;
      this.updateUrl = this.dataset.updateUrl === 'true';
      this.isDisabledFeature = this.dataset.isDisabled;
      this.addEventListener('change', this.onVariantChange);
      this.addEventListener('pointerdown', this.onOptionPointerDown, true);
      this.addEventListener('click', this.onOptionClick, true);
      this.other = Array.from(document.querySelectorAll('variant-selects')).filter((selector) => {
        return selector != this;
      });
      this.productWrapper = this.closest('.thb-product-detail');
      if (this.productWrapper) {
        this.productSlider = this.productWrapper.querySelector(`#MediaGallery-${this.dataset.section}`);
        this.hideVariants = this.productSlider.dataset.hideVariants === 'true';
      }
      this.classList.remove('is-loading');
      this.classList.add('is-ready');
    }

    connectedCallback() {
      this.updateOptions();
      this.updateMasterId();
      this.setDisabled();

      this.setImageSet();
      this.applySwatchColors();
      this.onVariantChange();
    }

    onVariantChange(event) {
      this.handleVariantChange();
    }

    onOptionPointerDown(event) {
      this.selectLabelOption(event);
    }

    onOptionClick(event) {
      this.selectLabelOption(event);
    }

    selectLabelOption(event) {
      const label = event.target.closest('label');
      if (!label || !this.contains(label)) return;

      const inputId = label.getAttribute('for');
      if (!inputId) return;

      const input = this.querySelector(`#${CSS.escape(inputId)}`);
      if (!input || input.type !== 'radio' || input.disabled) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      if (event.type === 'click' && this.lastPointerOptionInput === input) {
        this.lastPointerOptionInput = null;
        return;
      }

      if (event.type === 'pointerdown') {
        this.lastPointerOptionInput = input;
      }

      input.checked = true;
      input.focus({ preventScroll: true });
      window.clearTimeout(this.variantChangeTimeout);
      this.handleVariantChange();
    }

    handleVariantChange() {
      this.updateOptions();
      this.updateMasterId();
      this.updatePickupAvailability();
      this.removeErrorMessage();
      this.updateVariantText();
      this.setDisabled();

      if (!this.currentVariant) {
        this.toggleAddButton(true, '', true);
        this.setUnavailable();
      } else {
         this.updateColorRelatedMedia();
        this.updateMedia();
       
        if (this.updateUrl) {
          this.updateURL();
        }
        this.updateVariantInput();
        this.toggleAddButton(!this.currentVariant.available, window.theme.variantStrings.soldOut);
        this.renderProductInfo();
        //this.updateShareUrl();
      }
      this.updateOther();
      dispatchCustomEvent('product:variant-change', {
        variant: this.currentVariant,
        sectionId: this.dataset.section
      });
    }

    updateOptions() {
      this.fieldsets = Array.from(this.querySelectorAll('fieldset'));
      this.options = [];
      this.option_keys = [];
      this.fieldsets.forEach((fieldset, i) => {
        if (fieldset.querySelector('select')) {
          this.options.push(fieldset.querySelector('select').value);
          this.option_keys.push(fieldset.querySelector('select').name);
        } else if (fieldset.querySelectorAll('input').length) {
          this.options.push(fieldset.querySelector('input:checked').value);
          this.option_keys.push(fieldset.querySelector('input').name);
        }
      });
      this.dataset.options = this.options;
    }
    updateVariantText() {
      const fieldsets = Array.from(this.querySelectorAll('fieldset'));
      fieldsets.forEach((item, i) => {
        let label = item.querySelector('.form__label__value');
        if (label) {
          label.innerHTML = this.options[i];
        }
      });
    }
    updateMasterId() {
      this.currentVariant = this.getVariantData().find((variant) => {
        return !variant.options.map((option, index) => {
          return this.options[index] === option;
        }).includes(false);
      });
    }

    updateOther() {
      if (this.dataset.updateUrl === 'false') {
        return;
      }
      if (this.other.length) {
        let fieldsets = this.other[0].querySelectorAll('fieldset'),
          fieldsets_array = Array.from(fieldsets);
        this.options.forEach((option, i) => {
          if (fieldsets_array[i].querySelector('select')) {
            fieldsets_array[i].querySelector(`select`).value = option;
          } else if (fieldsets_array[i].querySelectorAll('input').length) {
            fieldsets_array[i].querySelector(`input[value="${option}"]`).checked = true;
          }
        });
        this.other[0].updateOptions();
        this.other[0].updateMasterId();
        this.other[0].updateVariantText();
        this.other[0].setDisabled();
        this.other[0].setImageSetMedia();
      }
    }

    updateMedia() {
      if (!this.currentVariant) return;
      if (!this.currentVariant.featured_media) return;
      if (!this.productSlider) return;
      let mediaId = `${this.dataset.section}-${this.currentVariant.featured_media.id}`;
      let activeMedia = this.productSlider.querySelector(`[data-media-id="${mediaId}"]`);


      this.productSlider.querySelectorAll('[data-media-id]').forEach((element) => {
        element.classList.remove('is-active');
      });

      this.setImageSetMedia();

      activeMedia.classList.add('is-active');

      activeMedia.parentElement.prepend(activeMedia);

      if (!this.sticky) {
        // window.setTimeout(() => {
        //   if (window.innerWidth > 1068) {
        //     let header_h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height'));
        //     window.scrollTo({
        //       left: 0,
        //       top: (activeMedia.parentElement.offsetTop - header_h),
        //       behavior: 'instant'
        //     });
        //   }
        //   this.productWrapper.querySelector(`#Product-Slider`).scrollTo({
        //     left: 0,
        //     behavior: 'instant'
        //   });
        // });
      }

    }

    updateColorRelatedMedia() {
      const colorRelatedMedia =
        this.productWrapper.querySelectorAll(`[data-color-info]`);

      // Language-independent anchor: compare each media's English **color** marker
      // against the CURRENT variant's own featured_media alt marker (also English),
      // instead of against the translated variant options. In zh/es/it the translated
      // option never equals the English marker, which used to hide every image.
      const currentAlt =
        (this.currentVariant.featured_media && this.currentVariant.featured_media.alt) || "";
      const currentColor = (currentAlt.match(/\*\*(.*?)\*\*/)?.[1] || "")
        .toLowerCase()
        .trim();

      colorRelatedMedia.forEach((media) => {
        const datasetColorInfo = media.dataset.colorInfo;
        if (!datasetColorInfo) return;

        // we try to extract the content between **, for example: **red** will return red
        const mediaColor = (datasetColorInfo.match(/\*\*(.*?)\*\*/)?.[1] || "")
          .toLowerCase()
          .trim();

        // Media without a color marker are color-agnostic -> always visible.
        // If we can't resolve the current color, don't hide anything (avoid empty gallery).
        if (!mediaColor || !currentColor) {
          media.classList.remove("color-info-hide");
        } else if (mediaColor === currentColor) {
          media.classList.remove("color-info-hide");
        } else {
          media.classList.add("color-info-hide");
        }
      });


      // update the slider pagination:
      function updateSliderPagination(productSlider, newCurrentIndex) {
        // 1. find the parent element of product-slider:
        const productImageContainer = productSlider.querySelector('.product-image-container');
        if (!productImageContainer) return;
        // 2. find the original pagination and hide it (.product-images-buttons.no-js-hidden):
        const originalPagination = productImageContainer.querySelector('.product-images-buttons.no-js-hidden');
        if (!originalPagination) return;
        
        // 3. check if there is already a pagination with the class .product-images-buttons--custom, if so, no need to duplicate
        let customPagination = productImageContainer.querySelector('.product-images-buttons--custom');
        // remove it if it exists
        if (customPagination) {
          customPagination.remove();
        }
        // 4. duplicate the original pagination and add it to the productSliderParent:
        customPagination = originalPagination.cloneNode(true);

        customPagination.classList.add("product-images-buttons--custom");
        customPagination.removeAttribute("style");
        productImageContainer.appendChild(customPagination);

        originalPagination.style.display = "none";

        // 5. update the slider pagination counter: .slider-counter--current and .slider-counter--total
        const sliderCounterCurrent = customPagination.querySelector('.slider-counter--current');
        const sliderCounterTotal = customPagination.querySelector('.slider-counter--total');

        let currentIndex;
        // we want to use getBoundingClientRect to check which is closest to the left
        productSlider.querySelectorAll('[data-media-id]:not(.color-info-hide)').forEach((element, index) => {
          if (element.getBoundingClientRect().left <= productSlider.getBoundingClientRect().left) {
            currentIndex = index;
          }
        });
        if (
          newCurrentIndex ||
          (newCurrentIndex === 0 && typeof newCurrentIndex === "number")
        )
          currentIndex = newCurrentIndex;

        const total = productSlider.querySelectorAll('[data-media-id]:not(.color-info-hide)').length;

        // console.log(currentIndex, total);

        // sliderCounterCurrent.textContent = currentIndex + 1;
        sliderCounterTotal.textContent = total;

        // 6. update the slider .slider-button--prev and .slider-button--next to check if they need to be disabled:
        const prevButton = customPagination.querySelector('.slider-button--prev');
        const nextButton = customPagination.querySelector('.slider-button--next');

        if (currentIndex === 0) {
          prevButton.setAttribute('disabled', 'disabled');
        } else {
          prevButton.removeAttribute('disabled');
        }

        if (currentIndex === total - 1) {
          nextButton.setAttribute('disabled', 'disabled');
        } else {
          nextButton.removeAttribute('disabled');
        }

        // 7. add event listeners to the prev and next buttons to send the click event to existingCustomPagination:
        function handlePrevButtonClick() {
          originalPagination.querySelector(".slider-button--prev").click();
          updateSliderPagination(productSlider, currentIndex - 1);
        }
        function handleNextButtonClick() {
          originalPagination.querySelector(".slider-button--next").click();
          updateSliderPagination(productSlider, currentIndex + 1);
        };

        prevButton.addEventListener('click', handlePrevButtonClick);
        nextButton.addEventListener('click', handleNextButtonClick);
      }
      updateSliderPagination(this.productSlider, 0);
    }

    updateURL() {
      if (!this.currentVariant || this.dataset.updateUrl === 'false') return;
      window.history.replaceState({}, '', `${this.dataset.url}?variant=${this.currentVariant.id}`);
    }

    updateShareUrl() {
      const shareButton = document.getElementById(`Share-${this.dataset.section}`);
      if (!shareButton) return;
      shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`);
    }

updateVariantInput() {
  const productForms = document.querySelectorAll(
    `#product-form-${this.dataset.section}, #product-form-installment`
  );

  productForms.forEach((productForm) => {
    // 兼容 hidden input 和 select
    const input = productForm.querySelector('[name="id"]');

    if (!input) {
      console.warn('⚠️ No variant input found in form:', productForm);
      return;
    }

    if (input.tagName.toLowerCase() === 'select') {
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (input.type === 'hidden' || input.type === 'text') {
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}



    updatePickupAvailability() {
      const pickUpAvailability = document.querySelector('.pickup-availability-wrapper');

      if (!pickUpAvailability) return;

      if (this.currentVariant && this.currentVariant.available) {
        pickUpAvailability.fetchAvailability(this.currentVariant.id);
      } else {
        pickUpAvailability.removeAttribute('available');
        pickUpAvailability.innerHTML = '';
      }
    }

    removeErrorMessage() {
      const section = this.closest('section');
      if (!section) return;

      const productForm = section.querySelector('product-form');
      if (productForm && typeof productForm.handleErrorMessage === 'function') productForm.handleErrorMessage();
    }

    getSectionsToRender() {
      return [`price-${this.dataset.section}`, `price-${this.dataset.section}--sticky`, `product-image-${this.dataset.section}--sticky`, `inventory-${this.dataset.section}`, `sku-${this.dataset.section}`, `quantity-${this.dataset.section}`];
    }

    renderProductInfo() {
      let sections = this.getSectionsToRender();
      this.productInfoRequestId = (this.productInfoRequestId || 0) + 1;
      const requestId = this.productInfoRequestId;
      if (this.productInfoAbortController) {
        this.productInfoAbortController.abort();
      }
      this.productInfoAbortController = new AbortController();

      fetch(`${this.dataset.url}?variant=${this.currentVariant.id}&section_id=${this.dataset.section}`, {
        signal: this.productInfoAbortController.signal
      })
        .then((response) => response.text())
        .then((responseText) => {
          if (requestId !== this.productInfoRequestId) return;

          const html = new DOMParser().parseFromString(responseText, 'text/html');
          sections.forEach((id) => {
            const destination = document.getElementById(id);
            const source = html.getElementById(id);

            if (source && destination) destination.innerHTML = source.innerHTML;

            const price = document.getElementById(id);
            const price_fixed = document.getElementById(id + '--sticky');

            if (price) price.classList.remove('visibility-hidden');
            if (price_fixed) price_fixed.classList.remove('visibility-hidden');

          });
          this.toggleAddButton(!this.currentVariant.available, window.theme.variantStrings.soldOut);

        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            console.error(error);
          }
        });
    }

    toggleAddButton(disable = true, text = false, modifyClass = true) {
      const productForm = document.getElementById(`product-form-${this.dataset.section}`);
      if (!productForm) return;

      const productTemplate = productForm.closest('.product-form').getAttribute('template');
      const submitButtons = document.querySelectorAll('.single-add-to-cart-button');

      if (!submitButtons) return;

      submitButtons.forEach((submitButton) => {
        const submitButtonText = submitButton.querySelector('.single-add-to-cart-button--text');

        if (!submitButtonText) return;

        if (disable) {
          submitButton.setAttribute('disabled', 'disabled');
          submitButton.classList.add('sold-out');
          if (text) submitButtonText.textContent = text;
        } else {
          submitButton.removeAttribute('disabled');
          submitButton.classList.remove('loading');
          submitButton.classList.remove('sold-out');

          if (productTemplate?.includes('pre-order')) {
            submitButtonText.textContent = window.theme.variantStrings.preOrder;
          } else {
            submitButtonText.textContent = window.theme.variantStrings.addToCart;
          }
        }
      });

      if (!modifyClass) return;
    }

    setUnavailable() {
      const submitButtons = document.querySelectorAll('.single-add-to-cart-button');
      const price = document.getElementById(`price-${this.dataset.section}`);
      const price_fixed = document.getElementById(`price-${this.dataset.section}--sticky`);

      submitButtons.forEach((submitButton) => {
        const submitButtonText = submitButton.querySelector('.single-add-to-cart-button--text');
        if (!submitButton) return;
        submitButtonText.textContent = window.theme.variantStrings.unavailable;
        submitButton.classList.add('sold-out');
      });
      if (price) price.classList.add('visibility-hidden');
      if (price_fixed) price_fixed.classList.add('visibility-hidden');
    }

    setDisabled() {
      if (this.isDisabledFeature != 'true') {
        return;
      }
      const variant_data = this.getVariantData();


      if (variant_data && this.currentVariant) {
        const selected_options = this.currentVariant.options.map((value, index) => {
          return {
            value,
            index: `option${index + 1}`
          };
        });

        const available_options = this.createAvailableOptionsTree(variant_data, selected_options);


        this.fieldsets.forEach((fieldset, i) => {
          const fieldset_options = Object.values(available_options)[i];

          if (fieldset_options) {
            console.log(fieldset_options,"aaaa");
            
            if (fieldset.querySelector('select')) {
            
              fieldset_options.forEach((option) => {
                const selectOption = fieldset.querySelector('option[value="' + JSON.stringify(option.value) + '"]');
                
                if (selectOption) {
                  selectOption.disabled = option.isUnavailable;
                }
              });
            } else if (fieldset.querySelectorAll('input').length) {
              fieldset.querySelectorAll('input').forEach((input) => {
              // console.log(fieldset_options[input_i])
            
                const matchedOption = fieldset_options.find(option => option.value === input.value);
                
                if (matchedOption) {
                  input.classList.toggle('is-disabled', matchedOption.isUnavailable);
                }
              });
            }
            
          }
        });

      }
      return true;
    }

    getImageSetName(variant_name) {
      return variant_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '').replace(/^-/, '');
    }

    setImageSet() {
      if (!this.productSlider) return;

      let dataSetEl = this.productSlider.querySelector('[data-set-name]');
      if (dataSetEl) {
        this.imageSetName = dataSetEl.dataset.setName;
        this.imageSetIndex = this.querySelector('.product-form__input[data-handle="' + this.imageSetName + '"]').dataset.index;

        this.setImageSetMedia();
      }
    }

    setImageSetMedia() {
      if (!this.imageSetIndex) {
        return;
      }
      let setValue = this.getImageSetName(this.currentVariant[this.imageSetIndex]);
      let group = this.imageSetName + '_' + setValue;
      let selected_set_images = this.productSlider.querySelectorAll(`[data-set-name="${this.imageSetName}"]`);

      if (this.hideVariants) {
        selected_set_images.forEach(thumb => {
          thumb.classList.toggle('is-active', thumb.dataset.group === group);
        });

      } else {
        let set_images = Array.from(selected_set_images).filter(function (element) {
          return element.dataset.group === group;
        });
        set_images.forEach(thumb => {
          thumb.parentElement.prepend(thumb);
        });
      }

    }

    createAvailableOptionsTree(variant_data, selected_options) {
      // Reduce variant array into option availability tree
      return variant_data.reduce((options, variant) => {

        // Check each option group (e.g. option1, option2, option3) of the variant
        Object.keys(options).forEach(index => {

          if (variant[index] === null) return;

          let entry = options[index].find(option => option.value === variant[index]);

          if (typeof entry === 'undefined') {
            // If option has yet to be added to the options tree, add it
            entry = {
              value: variant[index],
              isUnavailable: true
            };
            options[index].push(entry);
          }

          // Check how many selected option values match a variant
          const countVariantOptionsThatMatchCurrent = selected_options.reduce((count, {
            value,
            index
          }) => {
            return variant[index] === value ? count + 1 : count;
          }, 0);

          // Only enable an option if an available variant matches all but one current selected value
          if (countVariantOptionsThatMatchCurrent >= selected_options.length - 1) {
            entry.isUnavailable = entry.isUnavailable && variant.available ? false : entry.isUnavailable;
          }

          // Make sure if a variant is unavailable, disable currently selected option
          if ((!this.currentVariant || !this.currentVariant.available) && selected_options.find((option) => option.value === entry.value && index === option.index)) {
            entry.isUnavailable = true;
          }

          // First option is always enabled
          if (index === 'option1') {
            entry.isUnavailable = entry.isUnavailable && variant.available ? false : entry.isUnavailable;
          }
        });

        return options;
      }, {
        option1: [],
        option2: [],
        option3: []
      });
    }

    getVariantData() {
      this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent);
      return this.variantData;
    }

    
    // Language-independent color-swatch painting for localized stores.
    // Root cause: product-option.liquid colors each swatch by matching the (translated)
    // option value against the English keys of settings.color_swatches. In zh/es/it the
    // value is translated -> no match -> --option-color becomes an invalid color string
    // -> blank swatch. Fix: bridge each translated value to its English name via the
    // variant's featured_media alt (**English** marker), then read the data-swatch-map
    // (rendered in product-option.liquid) to paint the swatch. Falls back to constructing
    // a Files CDN url from the English slug when the map key is missing/translated (es/it).
    applySwatchColors() {
      const mapEl = this.querySelector('[data-swatch-map]');
      const colorInputs = this.querySelectorAll('.product-form__input--color input[type="radio"]');
      if (!mapEl || !colorInputs.length) return;

      let swatchMap;
      try {
        swatchMap = JSON.parse(mapEl.textContent);
      } catch (e) {
        return;
      }

      // translated value (lower) -> English color name (lower)
      const colorValues = new Set(
        Array.from(colorInputs).map((i) => i.value.toLowerCase().trim())
      );
      const bridge = {};
      (this.getVariantData() || []).forEach((variant) => {
        const alt = (variant.featured_media && variant.featured_media.alt) || "";
        const english = (alt.match(/\*\*(.*?)\*\*/)?.[1] || "").toLowerCase().trim();
        if (!english) return;
        (variant.options || []).forEach((opt) => {
          const key = String(opt).toLowerCase().trim();
          if (colorValues.has(key)) bridge[key] = english;
        });
      });

      // Derive a Files CDN base dir from any image entry, so we can construct fallback
      // urls from the English slug when the map key is missing/translated.
      let swatchBaseUrl = "";
      for (const k in swatchMap) {
        const img = swatchMap[k] && swatchMap[k].image;
        if (img && img.indexOf("/") > -1) {
          swatchBaseUrl = img.slice(0, img.lastIndexOf("/") + 1);
          break;
        }
      }

      colorInputs.forEach((input) => {
        const label = this.querySelector(`label[for="${input.id}"]`);
        if (!label) return;
        const raw = input.value.toLowerCase().trim();
        const english = bridge[raw] || raw;

        // Prefer an exact map hit by English key, then by the raw value (English store).
        const info = swatchMap[english] || swatchMap[raw];
        if (info && info.image) {
          label.style.setProperty("--option-color", "var(--bg-body)");
          label.style.setProperty("--option-color-image", `url('${info.image}')`);
          return;
        }
        if (info && info.color) {
          label.style.setProperty("--option-color", info.color);
          label.style.removeProperty("--option-color-image");
          return;
        }
        // No map hit (translated color_swatches in es/it): rebuild from the English slug.
        if (swatchBaseUrl && english) {
          this.applyConstructedSwatch(label, swatchBaseUrl, english);
        }
      });
    }

    // Probe png/jpg/jpeg/webp for a constructed Files url and paint the first that loads.
    applyConstructedSwatch(label, baseUrl, english) {
      const slug = english.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      if (!slug) return;
      const cleanBase = baseUrl.split("?")[0];
      const exts = ["png", "jpg", "jpeg", "webp"];
      let i = 0;
      const tryNext = () => {
        if (i >= exts.length) return;
        const url = `${cleanBase}${slug}.${exts[i++]}`;
        const img = new Image();
        img.onload = () => {
          label.style.setProperty("--option-color", "var(--bg-body)");
          label.style.setProperty("--option-color-image", `url('${url}')`);
        };
        img.onerror = tryNext;
        img.src = url;
      };
      tryNext();
    }
  }
  customElements.define('variant-selects', VariantSelects);

  /**
   *  @class
   *  @function VariantRadios
   */
  class VariantRadios extends VariantSelects {
    constructor() {
      super();
    }

    updateOptions() {
      const fieldsets = Array.from(this.querySelectorAll('fieldset'));
      this.options = fieldsets.map((fieldset) => {
        return Array.from(fieldset.querySelectorAll('input')).find((radio) => radio.checked).value;
      });
    }
  }

  customElements.define('variant-radios', VariantRadios);
}
if (!customElements.get('product-slider')) {
  /**
   *  @class
   *  @function ProductSlider
   */
  class ProductSlider extends HTMLElement {
    constructor() {
      super();

    }
    connectedCallback() {
      this.pagination = this.parentElement.querySelector('.product-images-buttons');
      this.sliderItems = this.querySelectorAll('[id^="Slide-"]');

      // Start Gallery
      let observer = new MutationObserver(() => {
        this.setupProductGallery();
      });

      observer.observe(this, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        characterData: false
      });

      this.setupProductGallery();

      // Start Pagination
      if (this.pagination) {
        this.setupPagination();
        this.addEventListener('scroll', this.updatePagination.bind(this));
        const resizeObserver = new ResizeObserver(entries => this.onPaginationResize());
        resizeObserver.observe(this);
      }
    }
    setupProductGallery() {
      if (!this.querySelectorAll('.product-single__media-zoom').length) {
        return;
      }

      this.setEventListeners();
    }
    buildItems(activeImages) {
      let images = activeImages.map((item) => {
        let activelink = item.querySelector('.product-single__media-zoom');
        return {
          src: activelink.getAttribute('href'),
          msrc: activelink.dataset.msrc,
          w: activelink.dataset.w,
          h: activelink.dataset.h,
          title: activelink.getAttribute('title')
        };
      });
      return images;
    }
    setEventListeners() {
      let activeImages = Array.from(this.querySelectorAll('.product-images__slide--image')).filter(element => element.clientWidth > 0),
        items = this.buildItems(activeImages),
        captionEl = this.dataset.captions,
        pswpElement = document.querySelectorAll('.pswp')[0],
        options = {
          maxSpreadZoom: 2,
          loop: false,
          allowPanToNext: false,
          closeOnScroll: false,
          showHideOpacity: false,
          arrowKeys: true,
          history: false,
          captionEl: captionEl,
          fullscreenEl: false,
          zoomEl: false,
          shareEl: false,
          counterEl: true,
          arrowEl: true,
          preloaderEl: true
        };

      let openPswp = function (e, link, options, pswpElement, items) {
        let parent = link.closest('.product-images__slide');
        let i = activeImages.indexOf(parent);
        options.index = parseInt(i, 10);
        options.getThumbBoundsFn = () => {
          const thumbnail = link.closest('.product-single__media'),
            pageYScroll = window.scrollY || document.documentElement.scrollTop,
            rect = thumbnail.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top + pageYScroll,
            w: rect.width
          };
        };
        if (typeof PhotoSwipe !== 'undefined') {
          let pswp = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, options);

          pswp.listen('firstUpdate', () => {
            pswp.listen('parseVerticalMargin', function (item) {
              item.vGap = {
                top: 50,
                bottom: 50
              };
            });
          });
          pswp.init();
        }
        e.preventDefault();
      };
      this.querySelectorAll('.product-single__media-zoom').forEach(function (link) {
        let thumbnail = link.closest('.product-single__media');
        let clone = link.cloneNode(true);
        thumbnail.append(clone);
        link.remove();
        clone.addEventListener('click', (e) => openPswp(e, clone, options, pswpElement, items));
      });

    }
    setupPagination() {
      this.sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
      if (this.sliderItemsToShow.length < 2) return;

      this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;

      this.currentPageElement = this.pagination.querySelector('.slider-counter--current');
      this.pageTotalElement = this.pagination.querySelector('.slider-counter--total');

      this.prevButton = this.pagination.querySelector('button[name="previous"]');
      this.nextButton = this.pagination.querySelector('button[name="next"]');


      this.prevButton.addEventListener('click', this.onPaginationButtonClick.bind(this));
      this.nextButton.addEventListener('click', this.onPaginationButtonClick.bind(this));

      this.updatePagination();
    }
    onPaginationResize() {
      this.sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
      if (this.sliderItemsToShow.length < 2) return;

      this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    }
    onPaginationButtonClick(event) {
      event.preventDefault();
      this.slideScrollPosition = event.currentTarget.name === 'next' ? this.scrollLeft + (1 * this.sliderItemOffset) : this.scrollLeft - (1 * this.sliderItemOffset);
      this.scrollTo({
        left: this.slideScrollPosition
      });
    }
    updatePagination() {
      if (!this.nextButton) return;

      const previousPage = this.currentPage;
      this.currentPage = Math.round(this.scrollLeft / this.sliderItemOffset) + 1;

      if (this.currentPageElement) {
        this.currentPageElement.textContent = this.currentPage;
      }
      if (this.currentPage != previousPage) {
        this.dispatchEvent(new CustomEvent('slideChanged', {
          detail: {
            currentPage: this.currentPage,
            currentElement: this.sliderItemsToShow[this.currentPage - 1]
          }
        }));
      }

      if (this.isSlideVisible(this.sliderItemsToShow[0]) && this.scrollLeft === 0) {
        this.prevButton.setAttribute('disabled', 'disabled');
      } else {
        this.prevButton.removeAttribute('disabled');
      }

      if (this.isSlideVisible(this.sliderItemsToShow[this.sliderItemsToShow.length - 1])) {
        this.nextButton.setAttribute('disabled', 'disabled');
      } else {
        this.nextButton.removeAttribute('disabled');
      }
    }
    isSlideVisible(element, offset = 0) {
      const lastVisibleSlide = this.clientWidth + this.scrollLeft - offset;
      return (element.offsetLeft + element.clientWidth) <= lastVisibleSlide && element.offsetLeft >= this.scrollLeft;
    }
  }
  customElements.define('product-slider', ProductSlider);
}

/**
 *  @class
 *  @function ProductForm
 */
if (!customElements.get('product-form')) {
  customElements.define('product-form', class ProductForm extends HTMLElement {
    constructor() {
      super();
    }
    connectedCallback() {
      this.sticky = this.dataset.sticky;
      this.form = document.getElementById(`product-form-${this.dataset.section}`);
      this.form.querySelector('[name=id]').disabled = false;
      if (!this.sticky) {
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
      }
      this.cartNotification = document.querySelector('cart-notification');
      this.body = document.body;

      this.hideErrors = this.dataset.hideErrors === 'true';
    }
    onSubmitHandler(evt) {
      evt.preventDefault();
      if (!this.form.reportValidity()) {
        return;
      }
      const submitButtons = document.querySelectorAll('.single-add-to-cart-button');

      submitButtons.forEach((submitButton) => {
        if (submitButton.classList.contains('loading')) return;
        submitButton.setAttribute('aria-disabled', true);
        submitButton.classList.add('loading');
      });

      this.handleErrorMessage();


      const config = {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/javascript'
        }
      };
            let formData = new FormData(this.form);

      // 只请求当前页面真实存在的 section：PDP 上没有 #Cart，就不让 Shopify 白渲染整页 main-cart。
      formData.append(
        'sections',
        this.getSectionsToRender()
          .filter((section) => document.getElementById(section.id))
          .map((section) => section.section)
      );
      formData.append('sections_url', window.location.pathname);

      // formData.append('sections', this.getSectionsToRender().map((section) => section.section));
      // formData.append('sections_url', window.location.pathname);
      config.body = formData;

      // 加购即时反馈：点击瞬间就开抽屉（别等这 1-3 秒的跨境网络往返），先给用户看到反应。
      // 排除快速加购(quick-view，那条走 renderContents 里自己的过渡分支)。
      const inQuickView = document.getElementById('Product-Drawer')?.contains(this);
      this._optimisticOpen = false;
      if (document.getElementById('Cart-Drawer') && !inQuickView) {
        const drawer = document.getElementById('Cart-Drawer');
        document.body.classList.add('open-cc', 'open-cart');
        drawer.classList.add('active', 'is-updating'); // is-updating 触发 spinner 遮罩
        // 空购物车首次加购：用不透明遮罩彻底盖住"空车"文案，避免闪现空车
        if (drawer.querySelector('.cart-drawer__empty-cart')) {
          drawer.classList.add('is-updating--cover');
        }
        dispatchCustomEvent('cart-drawer:open');
        this._optimisticOpen = true;
      }

      fetch(`${theme.routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            dispatchCustomEvent('product:variant-error', {
              source: 'product-form',
              productVariantId: formData.get('id'),
              errors: response.description,
              message: response.message
            });
            this.handleErrorMessage(response.description);
            this._rollbackOptimisticOpen();
            return;
          }

          this.renderContents(response);

          dispatchCustomEvent('cart:item-added', {
            product: response.hasOwnProperty('items') ? response.items[0] : response
          });
        })
        .catch((e) => {
          console.error(e);
          this._rollbackOptimisticOpen();
        })
        .finally(() => {
          document.getElementById('Cart-Drawer')?.classList.remove('is-updating', 'is-updating--cover');
          submitButtons.forEach((submitButton) => {
            submitButton.classList.remove('loading');
            submitButton.removeAttribute('aria-disabled');
          });
        });
    }
    
    // 回滚移动端"乐观打开"的抽屉：仅当本次加购是我们主动提前打开时才收回，
    // 让加购失败(缺货等)时露出 PDP 上的错误提示，而不是留个空抽屉。
    _rollbackOptimisticOpen() {
      if (!this._optimisticOpen) return;
      const drawer = document.getElementById('Cart-Drawer');
      if (drawer) drawer.classList.remove('active', 'is-updating', 'is-updating--cover');
      document.body.classList.remove('open-cart', 'open-cc');
      this._optimisticOpen = false;
    }

    getSectionsToRender() {
      return [{
        id: 'Cart',
        section: 'main-cart',
        selector: '.thb-cart-form'
      },
      {
        id: 'Cart-Drawer',
        section: 'cart-drawer',
        selector: '.cart-drawer'
      },
      {
        id: 'cart-drawer-toggle',
        section: 'cart-bubble',
        selector: '.thb-item-count'
      }];
    }
    renderContents(parsedState) {
      this.getSectionsToRender().forEach((section => {
        if (!document.getElementById(section.id)) {
          return;
        }
        const elementToReplace = document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
        elementToReplace.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);

        if (typeof CartDrawer !== 'undefined') {
          new CartDrawer();
        }
        if (typeof Cart !== 'undefined') {
          new Cart().renderContents(parsedState);
        }
      }));



      let product_drawer = document.getElementById('Product-Drawer');
      if (product_drawer && product_drawer.contains(this)) {
        product_drawer.querySelector('.product-quick-images--container').classList.remove('active');
        document.body.classList.remove('open-quick-view');

        if (window.innerWidth < 1069) {
          product_drawer.classList.remove('active');
          if (document.getElementById('Cart-Drawer')) {
            document.getElementById('Cart-Drawer').classList.add('active');
            document.body.classList.add('open-cart');
            document.getElementById('Cart-Drawer').querySelector('.product-recommendations--full').classList.add('active');
            dispatchCustomEvent('cart-drawer:open');
          }
        } else {
          product_drawer.querySelector('.product-quick-images--container').addEventListener('transitionend', function () {
            product_drawer.classList.remove('active');

            if (document.getElementById('Cart-Drawer')) {
              document.getElementById('Cart-Drawer').classList.add('active');
              document.body.classList.add('open-cart');
              document.getElementById('Cart-Drawer').querySelector('.product-recommendations--full').classList.add('active');
              dispatchCustomEvent('cart-drawer:open');
            }
          });
        }

        if (!document.getElementById('Cart-Drawer')) {
          document.body.classList.remove('open-cc');
        }
      } else if (document.getElementById('Cart-Drawer')) {
        document.body.classList.add('open-cc');
        document.body.classList.add('open-cart');
        document.getElementById('Cart-Drawer').classList.add('active');
        dispatchCustomEvent('cart-drawer:open');
      }
    }
    getSectionInnerHTML(html, selector = '.shopify-section') {
      return new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector(selector).innerHTML;
    }
    handleErrorMessage(errorMessage = false) {
      if (this.hideErrors) return;
      this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
      this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

      this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

      if (errorMessage) {
        this.errorMessage.textContent = errorMessage;
      }
    }
  });
}


/**
 *  @class
 *  @function ProductAddToCartSticky
 */
if (!customElements.get('product-add-to-cart-sticky')) {
  class ProductAddToCartSticky extends HTMLElement {
    constructor() {
      super();

      this.animations_enabled = document.body.classList.contains('animations-true') && typeof gsap !== 'undefined';
    }
    connectedCallback() {
      this.setupObservers();
      this.setupToggle();
    }
    setupToggle() {
      const button = this.querySelector('.product-add-to-cart-sticky--inner'),
        content = this.querySelector('.product-add-to-cart-sticky--content');

      if (this.animations_enabled) {
        const tl = gsap.timeline({
          reversed: true,
          paused: true,
          onStart: () => {
            button.classList.add('sticky-open');
          },
          onReverseComplete: () => {
            button.classList.remove('sticky-open');
          }
        });

        tl
          .set(content, {
            display: 'block',
            height: 'auto'
          }, 'start')
          .from(content, {
            height: 0,
            duration: 0.25
          }, 'start+=0.001');

        button.addEventListener('click', function () {
          tl.reversed() ? tl.play() : tl.reverse();

          return false;
        });
      } else {
        button.addEventListener('click', function () {
          content.classList.toggle('active');
          return false;
        });
      }


    }
    setupObservers() {
      let _this = this,
        observer = new IntersectionObserver(function (entries) {
          entries.forEach((entry) => {
            if (entry.target === footer) {
              if (entry.intersectionRatio > 0) {
                _this.classList.remove('sticky--visible');
              } else if (entry.intersectionRatio == 0 && _this.formPassed) {
                _this.classList.add('sticky--visible');
              }
            }
            if (entry.target === form) {
              let boundingRect = form.getBoundingClientRect();

              if (entry.intersectionRatio === 0 && window.scrollY > (boundingRect.top + boundingRect.height)) {
                _this.formPassed = true;
                _this.classList.add('sticky--visible');
              } else if (entry.intersectionRatio === 1) {
                _this.formPassed = false;
                _this.classList.remove('sticky--visible');
              }
            }
          });
        }, {
          threshold: [0, 1]
        }),
        form = document.getElementById(`product-form-${this.dataset.section}`),
        footer = document.getElementById('footer');
      _this.formPassed = false;
      observer.observe(form);
      observer.observe(footer);
    }
  }

  customElements.define('product-add-to-cart-sticky', ProductAddToCartSticky);
}

/**
 *  @class
 *  @function ProductSidePanelLinks
 */
if (!customElements.get('side-panel-links')) {
  class ProductSidePanelLinks extends HTMLElement {
    constructor() {
      super();
      this.links = this.querySelectorAll('button');
      this.drawer = document.getElementById('Product-Information-Drawer');
      this.buttons = this.drawer.querySelector('.side-panel-content--tabs');
      this.panels = this.drawer.querySelector('.side-panel-content--inner').querySelectorAll('.side-panel-content--tab-panel');
      this.body = document.body;
    }
    connectedCallback() {
      this.setupObservers();
    }
    disconnectedCallback() {

    }
    setupObservers() {
      this.links.forEach((item, i) => {
        item.addEventListener('click', (e) => {
          this.body.classList.add('open-cc');
          this.buttons.toggleActiveClass(i);
          this.drawer.classList.add('active');
        });
      });
    }
  }

  customElements.define('side-panel-links', ProductSidePanelLinks);
}

if (!customElements.get('product-media-carousel')) {
  class ProductMediaCarousel extends HTMLElement {
    connectedCallback() {
      if (!this.classList.contains('product-media-carousel--carousel')) return;

      this.slider = this.querySelector('#Product-Slider');
      this.slides = Array.from(this.querySelectorAll('.product-images__slide'));
      this.thumbnails = Array.from(this.querySelectorAll('.product-media-carousel__thumbnail'));
      this.prevButton = this.querySelector('[data-product-media-prev]');
      this.nextButton = this.querySelector('[data-product-media-next]');
      this.currentElement = this.querySelector('[data-product-media-current]');
      this.totalElement = this.querySelector('[data-product-media-total]');
      this.imageContainer = this.querySelector('.product-image-container');
      this.thumbnailContainer = this.querySelector('.product-media-carousel__thumbnails');
      this.handleResize = () => {
        this.syncViewportHeight();
        this.updateNavigation();
      };
      this.handleWindowLoad = () => this.syncViewportHeight();
      this.isSelecting = false;
      this.selectionTarget = null;
      this.isUpdatingActiveSlide = false;

      if (!this.slider || !this.slides.length) return;

      this.syncViewportHeight();
      this.bindEvents();
      this.syncThumbnailsToSlides();
      this.syncFromActiveSlide();
      this.updateNavigation();
      window.requestAnimationFrame(() => this.syncViewportHeight());
    }

    bindEvents() {
      this.prevButton?.addEventListener('click', () => this.goToOffset(-1));
      this.nextButton?.addEventListener('click', () => this.goToOffset(1));

      this.thumbnails.forEach((thumbnail) => {
        thumbnail.addEventListener('click', () => {
          const slide = this.getSlideByMediaId(thumbnail.dataset.mediaId);
          if (slide) this.goToSlide(slide);
        });
      });

      this.slider.addEventListener('scroll', () => {
        window.requestAnimationFrame(() => {
          if (this.isSelecting) {
            this.unlockSelectionIfSettled();
            this.updateNavigation();
            return;
          }

          window.clearTimeout(this.scrollSyncTimeout);
          this.scrollSyncTimeout = window.setTimeout(() => {
            if (this.isSelecting) return;
            this.syncFromScroll();
            this.updateNavigation();
          }, 80);
        });
      });

      // 滚动真正停止(含惯性滚动)时立即锁定下划线,不再干等 1200ms 兜底
      this.slider.addEventListener('scrollend', () => {
        if (this.isSelecting) this.finishSelection();
      });

      // 用户手动接管滚动(触摸/拖拽)时立刻退出选中态,让下划线跟随实际位置
      this.slider.addEventListener('pointerdown', () => {
        if (this.isSelecting) this.finishSelection();
      });

      const observer = new MutationObserver(() => {
        this.slides = Array.from(this.querySelectorAll('.product-images__slide'));
        this.syncThumbnailsToSlides();
        if (this.isUpdatingActiveSlide) {
          this.updateNavigation();
          return;
        }
        if (this.isSelecting) {
          this.updateNavigation();
          return;
        }
        this.syncFromActiveSlide();
        this.updateNavigation();
      });

      observer.observe(this.slider, { childList: true });

      this.slides.forEach((slide) => {
        observer.observe(slide, {
          attributes: true,
          attributeFilter: ['class']
        });
      });

      window.addEventListener('resize', this.handleResize, { passive: true });
      window.addEventListener('load', this.handleWindowLoad, { once: true });
    }

    disconnectedCallback() {
      window.removeEventListener('resize', this.handleResize);
      window.removeEventListener('load', this.handleWindowLoad);
    }

    syncViewportHeight() {
      if (!this.imageContainer) return;

      if (!window.matchMedia('(min-width: 1068px)').matches) {
        document.documentElement.style.removeProperty('--pdp-carousel-measured-height');
        document.documentElement.style.removeProperty('--pdp-carousel-total-height');
        return;
      }

      const imageRect = this.imageContainer.getBoundingClientRect();
      const imagePageTop = imageRect.top + window.scrollY;
      const availableHeight = window.innerHeight - imagePageTop;
      if (availableHeight <= 0) return;

      const thumbnailRect = this.thumbnailContainer?.getBoundingClientRect();
      const thumbnailExtraHeight = thumbnailRect
        ? Math.max(0, Math.ceil(thumbnailRect.bottom - imageRect.bottom))
        : 0;
      const imageHeight = Math.max(360, Math.floor(availableHeight));
      const totalHeight = imageHeight + thumbnailExtraHeight;

      document.documentElement.style.setProperty(
        '--pdp-carousel-measured-height',
        `${imageHeight}px`
      );
      document.documentElement.style.setProperty(
        '--pdp-carousel-total-height',
        `${totalHeight}px`
      );
    }

    getVisibleSlides() {
      return this.slides.filter((slide) => {
        return window.getComputedStyle(slide).display !== 'none' && !slide.classList.contains('color-info-hide');
      });
    }

    getActiveSlide() {
      return this.getVisibleSlides().find((slide) => slide.classList.contains('is-active'));
    }

    getSlideByMediaId(mediaId) {
      return this.slides.find((slide) => slide.dataset.mediaId === mediaId);
    }

    goToOffset(offset) {
      const visibleSlides = this.getVisibleSlides();
      if (!visibleSlides.length) return;

      const currentSlide = this.getActiveSlide() || this.getClosestSlide();
      const currentIndex = Math.max(visibleSlides.indexOf(currentSlide), 0);
      const nextIndex = Math.min(Math.max(currentIndex + offset, 0), visibleSlides.length - 1);

      this.goToSlide(visibleSlides[nextIndex]);
    }

    goToSlide(slide) {
      if (!slide) return;

      // 清掉滑动留下的 80ms 防抖,防止它在动画中途按中间位置覆盖掉目标下划线
      window.clearTimeout(this.scrollSyncTimeout);

      this.isSelecting = true;
      this.selectionTarget = slide;
      this.setActiveSlide(slide);
      this.slider.scrollTo({
        left: slide.offsetLeft,
        behavior: 'smooth'
      });
      this.setActiveThumbnail(slide.dataset.mediaId);
      this.updateNavigation();
      window.clearTimeout(this.selectingTimeout);
      this.watchSelectionSettle();
      this.selectingTimeout = window.setTimeout(() => {
        this.finishSelection();
      }, 1200);
    }

    watchSelectionSettle() {
      window.cancelAnimationFrame(this.selectionFrame);

      const check = () => {
        if (!this.isSelecting) return;
        if (this.unlockSelectionIfSettled()) return;

        this.selectionFrame = window.requestAnimationFrame(check);
      };

      this.selectionFrame = window.requestAnimationFrame(check);
    }

    unlockSelectionIfSettled() {
      if (!this.selectionTarget) return false;

      const distance = Math.abs(this.slider.scrollLeft - this.selectionTarget.offsetLeft);
      if (distance > 2) return false;

      this.finishSelection();
      return true;
    }

    finishSelection() {
      window.clearTimeout(this.selectingTimeout);
      window.cancelAnimationFrame(this.selectionFrame);
      this.isSelecting = false;
      this.selectionTarget = null;
      this.syncFromScroll();
      this.updateNavigation();
    }

    getClosestSlide() {
      const visibleSlides = this.getVisibleSlides();
      const sliderLeft = this.slider.scrollLeft;

      return visibleSlides.reduce((closest, slide) => {
        const distance = Math.abs(slide.offsetLeft - sliderLeft);
        return distance < closest.distance ? { slide, distance } : closest;
      }, { slide: visibleSlides[0], distance: Infinity }).slide;
    }

    setActiveSlide(slide) {
      if (!slide) return;

      this.isUpdatingActiveSlide = true;
      this.slides.forEach((item) => item.classList.toggle('is-active', item === slide));
      window.clearTimeout(this.activeSlideUpdateTimeout);
      this.activeSlideUpdateTimeout = window.setTimeout(() => {
        this.isUpdatingActiveSlide = false;
      }, 0);
    }

    syncFromScroll() {
      const closestSlide = this.getClosestSlide();
      if (!closestSlide) return;

      this.setActiveSlide(closestSlide);
      this.setActiveThumbnail(closestSlide.dataset.mediaId);
    }

    syncFromActiveSlide() {
      const activeSlide = this.getActiveSlide() || this.getVisibleSlides()[0];
      if (!activeSlide) return;

      this.setActiveThumbnail(activeSlide.dataset.mediaId);
      this.slider.scrollTo({
        left: activeSlide.offsetLeft,
        behavior: 'auto'
      });
    }

    syncThumbnailsToSlides() {
      const visibleSlides = this.getVisibleSlides();

      this.thumbnails.forEach((thumbnail) => {
        const slide = this.getSlideByMediaId(thumbnail.dataset.mediaId);
        if (!slide) return;

        thumbnail.hidden = !visibleSlides.includes(slide);
        thumbnail.classList.toggle('product-images__slide-item--variant', slide.classList.contains('product-images__slide-item--variant'));
      });
      this.updateThumbnailScrollState();
    }

    updateThumbnailScrollState() {
      if (!this.thumbnailContainer) return;
      window.requestAnimationFrame(() => {
        const visibleThumbnails = this.thumbnails.filter((thumbnail) => !thumbnail.hidden && window.getComputedStyle(thumbnail).display !== 'none');
        const containerStyle = window.getComputedStyle(this.thumbnailContainer);
        const gap = parseFloat(containerStyle.columnGap || containerStyle.gap) || 0;
        const contentWidth = visibleThumbnails.reduce((width, thumbnail) => width + thumbnail.offsetWidth, 0) + Math.max(0, visibleThumbnails.length - 1) * gap;
        const isScrollable = contentWidth > this.thumbnailContainer.clientWidth + 1;
        this.thumbnailContainer.classList.toggle('is-scrollable', isScrollable);
        if (!isScrollable) this.thumbnailContainer.scrollLeft = 0;
      });
    }

    setActiveThumbnail(mediaId) {
      let activeThumbnail = null;

      this.thumbnails.forEach((thumbnail) => {
        const isActive = thumbnail.dataset.mediaId === mediaId;
        thumbnail.classList.toggle('is-active', isActive);
        thumbnail.setAttribute('aria-current', isActive ? 'true' : 'false');
        if (isActive) activeThumbnail = thumbnail;
      });

      this.centerActiveThumbnail(activeThumbnail);
      window.clearTimeout(this.centerThumbnailTimeout);
      this.centerThumbnailTimeout = window.setTimeout(() => {
        this.centerActiveThumbnail(this.thumbnailContainer?.querySelector('.product-media-carousel__thumbnail.is-active'));
      }, 180);
    }

    centerActiveThumbnail(activeThumbnail, behavior = this.isSelecting ? 'smooth' : 'auto') {
      if (!activeThumbnail || !this.thumbnailContainer || !this.thumbnailContainer.classList.contains('is-scrollable')) return;

      const containerRect = this.thumbnailContainer.getBoundingClientRect();
      const thumbnailRect = activeThumbnail.getBoundingClientRect();
      const offset = thumbnailRect.left - containerRect.left;
      const scrollLeft = this.thumbnailContainer.scrollLeft + offset - (containerRect.width / 2) + (thumbnailRect.width / 2);

      this.thumbnailContainer.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior
      });
    }

    updateNavigation() {
      const visibleSlides = this.getVisibleSlides();
      const activeSlide = this.getActiveSlide() || this.getClosestSlide();
      const activeIndex = visibleSlides.indexOf(activeSlide);
      const atStart = activeIndex <= 0;
      const atEnd = activeIndex >= visibleSlides.length - 1;

      this.prevButton?.toggleAttribute('disabled', atStart);
      this.nextButton?.toggleAttribute('disabled', atEnd);

      if (this.currentElement) {
        this.currentElement.textContent = visibleSlides.length ? activeIndex + 1 : 0;
      }
      if (this.totalElement) {
        this.totalElement.textContent = visibleSlides.length;
      }
    }
  }

  customElements.define('product-media-carousel', ProductMediaCarousel);
}

if (typeof addIdToRecentlyViewed !== "undefined") {
  addIdToRecentlyViewed();
}

if (
  !document.querySelector("product-slider").classList.contains("scroll-watcher")
) {
  // update the current index every 100ms:
  setInterval(() => {
    // find ..slider-counter--current
    const sliderCounterCurrent = document.querySelector(
      ".product-images-buttons--custom .slider-counter--current"
    );
    if (sliderCounterCurrent) {
      const productSlider = document.querySelector("product-slider");
      const slides = Array.from(
        productSlider.querySelectorAll("[data-media-id]:not(.color-info-hide)")
      );
      const sliderWidth = productSlider.offsetWidth;
      const scrollPosition = productSlider.scrollLeft + sliderWidth / 2;

      const newIndex = slides.reduce(
        (closest, slide, index) => {
          const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
          const distance = Math.abs(scrollPosition - slideCenter);
          return distance < closest.distance ? { index, distance } : closest;
        },
        { index: 0, distance: Infinity }
      ).index;
      sliderCounterCurrent.textContent = newIndex + 1;
    }
  }, 100);
  document.querySelector("product-slider").classList.add("scroll-watcher");
}
