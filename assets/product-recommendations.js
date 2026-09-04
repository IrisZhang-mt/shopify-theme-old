/**
 *  @class
 *  @function ProductRecommendations
 */
{
const initProductRecommendationDesktopScroller = (container) => {
  if (!container?.closest(".section-product-recommendations")) {
    return;
  }
  const grid = container.querySelector(".product-recommendations__grid");
  const nav = container.querySelector(".product-recommendations__desktop-nav");
  const prevButton = nav?.querySelector(".flickity-prev");
  const nextButton = nav?.querySelector(".flickity-next");

  if (!grid || !nav || !prevButton || !nextButton || nav.dataset.initiated === "true") {
    return;
  }

  nav.dataset.initiated = "true";

  const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;
  const getMaxScroll = () => Math.max(grid.scrollWidth - grid.clientWidth, 0);
  const getStep = () => {
    const firstCard = grid.querySelector(":scope > .columns");
    const cardWidth = firstCard?.getBoundingClientRect().width || grid.clientWidth;
    const gap = parseFloat(window.getComputedStyle(grid).columnGap || window.getComputedStyle(grid).gap) || 0;

    return Math.max(cardWidth + gap, 1);
  };

  const updateNavState = () => {
    const maxScroll = getMaxScroll();
    const canScroll = isDesktop() && maxScroll > 1;
    const atStart = !canScroll || grid.scrollLeft <= 1;
    const atEnd = !canScroll || grid.scrollLeft >= maxScroll - 1;

    nav.hidden = !canScroll;
    prevButton.classList.toggle("is-disabled", atStart);
    nextButton.classList.toggle("is-disabled", atEnd);
    prevButton.setAttribute("aria-disabled", atStart ? "true" : "false");
    nextButton.setAttribute("aria-disabled", atEnd ? "true" : "false");
  };

  const scrollByStep = (direction) => {
    if (!isDesktop()) {
      return;
    }
    const target = Math.min(Math.max(grid.scrollLeft + getStep() * direction, 0), getMaxScroll());

    grid.scrollTo({
      left: target,
      behavior: "smooth",
    });
  };

  prevButton.addEventListener("click", () => {
    if (!prevButton.classList.contains("is-disabled")) {
      scrollByStep(-1);
    }
  });
  nextButton.addEventListener("click", () => {
    if (!nextButton.classList.contains("is-disabled")) {
      scrollByStep(1);
    }
  });
  grid.addEventListener("scroll", updateNavState, { passive: true });
  window.addEventListener("resize", updateNavState, { passive: true });
  document.fonts?.ready.then(updateNavState);
  window.requestAnimationFrame(updateNavState);
};

const scrollProductRecommendationDesktopGrid = (container, direction) => {
  const grid = container?.querySelector(".product-recommendations__grid");

  if (!grid || !window.matchMedia("(min-width: 768px)").matches) {
    return;
  }

  const firstCard = grid.querySelector(":scope > .columns");
  const cardWidth = firstCard?.getBoundingClientRect().width || grid.clientWidth;
  const gap = parseFloat(window.getComputedStyle(grid).columnGap || window.getComputedStyle(grid).gap) || 0;
  const step = Math.max(cardWidth + gap, 1);
  const maxScroll = Math.max(grid.scrollWidth - grid.clientWidth, 0);
  const target = Math.min(Math.max(grid.scrollLeft + step * direction, 0), maxScroll);

  grid.scrollTo({
    left: target,
    behavior: "smooth",
  });
};

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(
      ".section-product-recommendations .product-recommendations__desktop-nav .flickity-nav"
    );

    if (!button || button.classList.contains("is-disabled")) {
      return;
    }

    const recommendations = button.closest("product-recommendations");
    const direction = button.classList.contains("flickity-prev") ? -1 : 1;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    scrollProductRecommendationDesktopGrid(recommendations, direction);
  },
  true
);

if (!customElements.get("product-recommendations")) {
class ProductRecommendations extends HTMLElement {
  constructor() {
    super();

    this.parent = this.closest(".product-recommendations--parent");
  }
  fetchProducts() {
    fetch(this.dataset.url)
      .then((response) => response.text())
      .then((text) => {
        const html = document.createElement("template");
        html.innerHTML = text;
        const recommendations = html.content.querySelector("product-recommendations");

        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
          this.initDesktopScroller();
          this.initMobileCarousel();

          if (this.parent) {
            this.parent.classList.add("product-recommendations--full");

            if (document.body.classList.contains("open-cart")) {
              this.parent.classList.add("active");
            }
          }
        }
        // FIXME:
        // Not sure why the .length is 0, maybe we find the html, and the recommendations inside it is empty?
        // console.log(
        //   "Product Recommendations text: Len",
        //   recommendations.innerHTML.trim().length,
        //   text
        // );

        this.classList.add("product-recommendations--loaded");
      })
      .catch((e) => {
        console.error(e);
      });
  }
  initMobileCarousel(retry = 0) {
    const carousel = this.querySelector(".product-recommendations__mobile-carousel");
    if (!carousel || carousel.dataset.initiated === "true") {
      return;
    }
    if (!window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    if (typeof Flickity === "undefined") {
      if (retry < 10) {
        window.requestAnimationFrame(() => this.initMobileCarousel(retry + 1));
      }
      return;
    }

    const prevButton = carousel.querySelector(".flickity-prev");
    const nextButton = carousel.querySelector(".flickity-next");
    let resizeObserver;

    if (prevButton && nextButton) {
      let navWrapper = this.querySelector(".product-recommendations__mobile-nav");

      if (!navWrapper) {
        navWrapper = document.createElement("div");
        navWrapper.className = "product-recommendations__mobile-nav";
        carousel.insertAdjacentElement("afterend", navWrapper);
      }

      navWrapper.append(prevButton, nextButton);
    }

    const flkty = new Flickity(carousel, {
      wrapAround: false,
      cellAlign: "left",
      pageDots: false,
      contain: true,
      prevNextButtons: false,
      cellSelector: ".carousel__slide",
      selectedAttraction: 0.015,
      friction: 0.24,
    });

    carousel.dataset.initiated = "true";

    const syncMobileCarouselHeight = () => {
      if (!window.matchMedia("(max-width: 767px)").matches) {
        carousel.style.removeProperty("--recommendations-mobile-viewport-height");
        carousel.style.removeProperty("--recommendations-mobile-carousel-height");
        return;
      }

      const slides = [...carousel.querySelectorAll(".carousel__slide")];
      const viewport = carousel.querySelector(".flickity-viewport") || carousel;
      const viewportRect = viewport.getBoundingClientRect();
      const visibleSlides = slides.filter((slide) => {
        const slideRect = slide.getBoundingClientRect();

        return slideRect.right > viewportRect.left + 1 && slideRect.left < viewportRect.right - 1;
      });
      const measuredSlides = visibleSlides.length ? visibleSlides : [slides[flkty.selectedIndex] || slides[0]].filter(Boolean);
      const cardHeight = measuredSlides.reduce((height, slide) => {
        const card = slide.querySelector(".product-card") || slide;

        return Math.max(height, Math.ceil(card.getBoundingClientRect().height));
      }, 0);

      if (!cardHeight) {
        return;
      }

      carousel.style.setProperty("--recommendations-mobile-viewport-height", `${cardHeight}px`);
      carousel.style.setProperty("--recommendations-mobile-carousel-height", `${cardHeight}px`);

      flkty.resize();
      flkty.reposition();
    };

    const getStepIndices = () => {
      if (!flkty.slides || !flkty.slides.length) {
        return [0];
      }

      const tolerance = 0.5;
      const stepIndices = [];

      flkty.slides.forEach((slide, index) => {
        const previousIndex = stepIndices[stepIndices.length - 1];
        const previousTarget = flkty.slides[previousIndex]?.target;

        if (previousTarget === undefined || Math.abs(slide.target - previousTarget) > tolerance) {
          stepIndices.push(index);
        }
      });

      return stepIndices.length ? stepIndices : [0];
    };

    const getCurrentStep = () => {
      const stepIndices = getStepIndices();
      const selectedTarget = flkty.slides?.[flkty.selectedIndex]?.target;

      if (selectedTarget === undefined) {
        return 0;
      }

      return stepIndices.reduce((closest, stepIndex, position) => {
        const currentDistance = Math.abs((flkty.slides?.[stepIndex]?.target ?? 0) - selectedTarget);
        const closestDistance = Math.abs((flkty.slides?.[stepIndices[closest]]?.target ?? 0) - selectedTarget);

        return currentDistance < closestDistance ? position : closest;
      }, 0);
    };

    let currentStep = getCurrentStep();

    const updateNavState = () => {
      if (!prevButton || !nextButton) {
        return;
      }

      const maxStep = Math.max(getStepIndices().length - 1, 0);
      currentStep = Math.min(Math.max(getCurrentStep(), 0), maxStep);

      prevButton.classList.toggle("is-disabled", currentStep <= 0);
      nextButton.classList.toggle("is-disabled", currentStep >= maxStep);
      prevButton.setAttribute("aria-disabled", currentStep <= 0 ? "true" : "false");
      nextButton.setAttribute("aria-disabled", currentStep >= maxStep ? "true" : "false");
    };

    const move = (direction) => {
      const stepIndices = getStepIndices();
      const maxStep = Math.max(stepIndices.length - 1, 0);
      const targetStep = Math.min(Math.max(currentStep + direction, 0), maxStep);

      if (targetStep === currentStep) {
        updateNavState();
        return;
      }

      currentStep = targetStep;
      flkty.select(stepIndices[targetStep] ?? 0, false, false);
      updateNavState();
    };

    if (prevButton && nextButton) {
      prevButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!prevButton.classList.contains("is-disabled")) {
          move(-1);
        }
      });
      nextButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!nextButton.classList.contains("is-disabled")) {
          move(1);
        }
      });
    }

    flkty.on("change", () => {
      updateNavState();
    });
    flkty.on("settle", () => {
      syncMobileCarouselHeight();
      updateNavState();
    });
    flkty.on("ready", syncMobileCarouselHeight);

    resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(syncMobileCarouselHeight);
    });
    carousel.querySelectorAll(".carousel__slide, .product-card, .product-card-info").forEach((element) => {
      resizeObserver.observe(element);
    });
    carousel.querySelectorAll("img").forEach((image) => {
      if (!image.complete) {
        image.addEventListener("load", syncMobileCarouselHeight, { once: true });
      }
    });
    window.addEventListener("resize", syncMobileCarouselHeight, { passive: true });
    document.fonts?.ready.then(() => {
      syncMobileCarouselHeight();
      flkty.resize();
      flkty.reposition();
      updateNavState();
    });
    window.requestAnimationFrame(() => {
      syncMobileCarouselHeight();
      updateNavState();
    });
  }
  initDesktopScroller() {
    initProductRecommendationDesktopScroller(this);
  }
  connectedCallback() {
    this.fetchProducts();
  }
}

customElements.define("product-recommendations", ProductRecommendations);
}

const initLoadedProductRecommendationDesktopScrollers = () => {
  document.querySelectorAll("product-recommendations.product-recommendations--loaded").forEach((recommendations) => {
    initProductRecommendationDesktopScroller(recommendations);
  });
};

document.addEventListener("DOMContentLoaded", initLoadedProductRecommendationDesktopScrollers);
window.addEventListener("load", initLoadedProductRecommendationDesktopScrollers);
}
